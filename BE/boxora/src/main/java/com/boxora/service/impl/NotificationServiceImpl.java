package com.boxora.service.impl;

import com.boxora.common.response.PageResponse;
import com.boxora.dto.response.NotificationLogResponse;
import com.boxora.dto.response.RenewalReminderScanResponse;
import com.boxora.entity.Facility;
import com.boxora.entity.NotificationLog;
import com.boxora.entity.RentalContract;
import com.boxora.entity.User;
import com.boxora.enums.ActivityAction;
import com.boxora.enums.NotificationChannel;
import com.boxora.enums.NotificationType;
import com.boxora.enums.RentalContractStatus;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.repository.NotificationLogRepository;
import com.boxora.repository.RentalContractRepository;
import com.boxora.security.FacilityAccessGuard;
import com.boxora.security.RequestContext;
import com.boxora.service.ActivityLogService;
import com.boxora.service.EmailService;
import com.boxora.service.NotificationService;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationServiceImpl implements NotificationService {

    private final NotificationLogRepository notificationLogRepository;
    private final RentalContractRepository rentalContractRepository;
    private final EmailService emailService;
    private final ActivityLogService activityLogService;
    private final FacilityAccessGuard facilityAccessGuard;
    private final RequestContext requestContext;

    @Override
    @Transactional
    public RenewalReminderScanResponse scanAndSendRenewalReminders() {
        LocalDate today = LocalDate.now();
        List<RentalContract> activeContracts = rentalContractRepository.findByStatus(RentalContractStatus.ACTIVE);

        int scanned = activeContracts.size();
        int count7d = 0;
        int count3d = 0;

        for (RentalContract contract : activeContracts) {
            if (contract.getEndDate() == null) continue;

            long daysRemaining = ChronoUnit.DAYS.between(today, contract.getEndDate());
            User customer = contract.getCustomer();
            if (customer == null || customer.getEmail() == null) continue;

            // Mốc 7 ngày trước khi hết hạn
            if (daysRemaining == 7) {
                boolean alreadySent = notificationLogRepository
                        .existsByNotificationTypeAndReferenceId(NotificationType.RENEWAL_REMINDER_7D, contract.getId());
                if (!alreadySent) {
                    sendReminder(contract, customer, 7, NotificationType.RENEWAL_REMINDER_7D);
                    count7d++;
                }
            }
            // Mốc 3 ngày trước khi hết hạn (Khẩn cấp)
            else if (daysRemaining == 3) {
                boolean alreadySent = notificationLogRepository
                        .existsByNotificationTypeAndReferenceId(NotificationType.RENEWAL_REMINDER_3D, contract.getId());
                if (!alreadySent) {
                    sendReminder(contract, customer, 3, NotificationType.RENEWAL_REMINDER_3D);
                    count3d++;
                }
            }
        }

        log.info("Renewal reminder scan completed: scanned={}, 7d_reminders={}, 3d_reminders={}",
                scanned, count7d, count3d);

        return RenewalReminderScanResponse.builder()
                .scannedContractsCount(scanned)
                .sevenDayRemindersSent(count7d)
                .threeDayRemindersSent(count3d)
                .scanTimestamp(LocalDateTime.now())
                .build();
    }

    private void sendReminder(RentalContract contract, User customer, long daysRemaining, NotificationType type) {
        String unitCode = contract.getUnit() != null ? contract.getUnit().getUnitCode() : "N/A";
        BigDecimal monthlyFee = contract.getMonthlyFee() != null ? contract.getMonthlyFee() : BigDecimal.ZERO;

        try {
            emailService.sendRenewalReminderEmail(
                    customer.getEmail(),
                    customer.getFullName() != null ? customer.getFullName() : customer.getUsername(),
                    contract.getContractCode(),
                    unitCode,
                    contract.getEndDate(),
                    daysRemaining,
                    monthlyFee
            );
        } catch (Exception e) {
            log.warn("Failed to send renewal reminder email to {}: {}", customer.getEmail(), e.getMessage());
        }

        String title = (daysRemaining <= 3 ? "⚠ [Khẩn cấp] Nhắc hạn hợp đồng " : "🔔 Nhắc gia hạn hợp đồng ") + contract.getContractCode();
        String content = "Hợp đồng thuê kho " + contract.getContractCode() + " (vị trí: " + unitCode + ") sẽ hết hạn sau " + daysRemaining + " ngày. Vui lòng gia hạn trên hệ thống.";

        notificationLogRepository.save(NotificationLog.builder()
                .recipient(customer)
                .recipientEmail(customer.getEmail())
                .recipientName(customer.getFullName() != null ? customer.getFullName() : customer.getUsername())
                .facility(contract.getFacility())
                .channel(NotificationChannel.EMAIL)
                .notificationType(type)
                .referenceType("RentalContract")
                .referenceId(contract.getId())
                .title(title)
                .content(content)
                .status("SENT")
                .build());

        activityLogService.record(
                contract.getFacility() != null ? contract.getFacility().getId() : null,
                ActivityAction.RENEWAL_REQUEST,
                "RentalContract",
                contract.getId(),
                "Phát hành email thông báo nhắc gia hạn (" + daysRemaining + " ngày trước hạn) tới: " + customer.getEmail(),
                null,
                contract.getContractCode()
        );
    }

    @Override
    @Transactional
    public void sendSingleContractRenewalReminder(UUID contractId) {
        RentalContract contract = rentalContractRepository.findById(contractId)
                .orElseThrow(() -> new AppException(ErrorCode.CONTRACT_NOT_FOUND));

        if (contract.getFacility() != null && facilityAccessGuard.isFacilityScoped()) {
            facilityAccessGuard.checkFacilityAccess(contract.getFacility().getId());
        }

        User customer = contract.getCustomer();
        if (customer == null || customer.getEmail() == null) {
            throw new AppException(ErrorCode.USER_NOT_FOUND);
        }

        LocalDate today = LocalDate.now();
        long daysRemaining = (contract.getEndDate() != null)
                ? ChronoUnit.DAYS.between(today, contract.getEndDate())
                : 0;

        NotificationType type = (daysRemaining <= 3) ? NotificationType.RENEWAL_REMINDER_3D : NotificationType.RENEWAL_REMINDER_7D;
        sendReminder(contract, customer, daysRemaining, type);
    }

    @Override
    @Transactional(readOnly = true)
    public NotificationLogResponse getById(UUID id) {
        NotificationLog logEntry = notificationLogRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.NOTIFICATION_NOT_FOUND));

        if (logEntry.getFacility() != null && facilityAccessGuard.isFacilityScoped()) {
            facilityAccessGuard.checkFacilityAccess(logEntry.getFacility().getId());
        }
        return toResponse(logEntry);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<NotificationLogResponse> getLogs(UUID recipientId, UUID facilityId, NotificationType type, int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));

        UUID effectiveFacilityId = facilityId;
        if (facilityAccessGuard.isFacilityScoped()) {
            effectiveFacilityId = facilityAccessGuard.scopedFacilityIdOrNull();
        }

        UUID effectiveRecipientId = recipientId;
        if ("CUSTOMER".equalsIgnoreCase(requestContext.currentUserRole())) {
            effectiveRecipientId = requestContext.currentUserId();
        }

        final UUID queryFacilityId = effectiveFacilityId;
        final UUID queryRecipientId = effectiveRecipientId;

        Specification<NotificationLog> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (queryFacilityId != null) {
                predicates.add(cb.equal(root.get("facility").get("id"), queryFacilityId));
            }
            if (queryRecipientId != null) {
                predicates.add(cb.equal(root.get("recipient").get("id"), queryRecipientId));
            }
            if (type != null) {
                predicates.add(cb.equal(root.get("notificationType"), type));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };

        Page<NotificationLog> pageResult = notificationLogRepository.findAll(spec, pageable);
        return PageResponse.from(pageResult.map(this::toResponse));
    }

    private NotificationLogResponse toResponse(NotificationLog n) {
        return NotificationLogResponse.builder()
                .id(n.getId())
                .recipientId(n.getRecipient() != null ? n.getRecipient().getId() : null)
                .recipientEmail(n.getRecipientEmail())
                .recipientName(n.getRecipientName())
                .facilityId(n.getFacility() != null ? n.getFacility().getId() : null)
                .facilityName(n.getFacility() != null ? n.getFacility().getName() : null)
                .channel(n.getChannel())
                .notificationType(n.getNotificationType())
                .referenceType(n.getReferenceType())
                .referenceId(n.getReferenceId())
                .title(n.getTitle())
                .content(n.getContent())
                .status(n.getStatus())
                .createdAt(n.getCreatedAt())
                .build();
    }
}

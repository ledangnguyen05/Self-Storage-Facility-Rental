package com.boxora.service.impl;

import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.SealingCreateRequest;
import com.boxora.dto.request.SealingUnsealRequest;
import com.boxora.dto.response.SealingRecordResponse;
import com.boxora.entity.*;
import com.boxora.enums.*;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.repository.*;
import com.boxora.security.FacilityAccessGuard;
import com.boxora.security.RequestContext;
import com.boxora.service.ActivityLogService;
import com.boxora.service.EmailService;
import com.boxora.service.SealingService;
import com.boxora.util.VNPayUtil;
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
public class SealingServiceImpl implements SealingService {

    private final SealingRecordRepository sealingRecordRepository;
    private final RentalContractRepository rentalContractRepository;
    private final StorageUnitRepository storageUnitRepository;
    private final UserRepository userRepository;
    private final FacilityPolicyRepository facilityPolicyRepository;
    private final NotificationLogRepository notificationLogRepository;
    private final EmailService emailService;
    private final ActivityLogService activityLogService;
    private final FacilityAccessGuard facilityAccessGuard;
    private final RequestContext requestContext;

    @Override
    @Transactional
    public SealingRecordResponse createSealing(SealingCreateRequest request) {
        RentalContract contract = null;
        if (request.getContractId() != null) {
            contract = rentalContractRepository.findById(request.getContractId())
                    .orElseThrow(() -> new AppException(ErrorCode.CONTRACT_NOT_FOUND));
        }

        StorageUnit unit = null;
        if (contract != null) {
            unit = contract.getUnit();
        } else if (request.getUnitId() != null) {
            unit = storageUnitRepository.findById(request.getUnitId())
                    .orElseThrow(() -> new AppException(ErrorCode.STORAGE_UNIT_NOT_FOUND));
            contract = rentalContractRepository.findFirstByUnit_IdOrderByCreatedAtDesc(unit.getId()).orElse(null);
        }

        if (unit == null) {
            throw new AppException(ErrorCode.STORAGE_UNIT_NOT_FOUND);
        }
        if (contract == null) {
            throw new AppException(ErrorCode.CONTRACT_NOT_FOUND, "A rental contract is required for overdue sealing");
        }

        Facility facility = unit.getFacility() != null ? unit.getFacility() : (contract != null ? contract.getFacility() : null);
        if (facility == null || contract.getFacility() == null
                || !facility.getId().equals(contract.getFacility().getId())) {
            throw new AppException(ErrorCode.FACILITY_ACCESS_DENIED);
        }
        facilityAccessGuard.checkFacilityAccess(facility.getId());

        if (contract.getStatus() != RentalContractStatus.ACTIVE
                && contract.getStatus() != RentalContractStatus.OVERDUE
                && contract.getStatus() != RentalContractStatus.EXPIRED) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Only active or expired rental contracts can be sealed for overdue debt");
        }
        if (contract.getEndDate() == null || !contract.getEndDate().isBefore(LocalDate.now())) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "The contract must be past its end date before sealing");
        }
        if (contract.getMonthlyFee() == null || contract.getMonthlyFee().compareTo(BigDecimal.ZERO) <= 0) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "A valid contract rent amount is required before sealing");
        }
        Booking booking = contract.getBooking();
        if (booking != null) {
            if (booking.getStorageUnit() == null || !unit.getId().equals(booking.getStorageUnit().getId())) {
                throw new AppException(ErrorCode.INVALID_REQUEST, "The booking and contract units do not match");
            }
            if ((booking.getStatus() != com.boxora.enums.BookingStatus.ACTIVE
                    && booking.getStatus() != com.boxora.enums.BookingStatus.OVERDUE)
                    || "REFUNDED".equalsIgnoreCase(booking.getPaymentStatus())) {
                throw new AppException(ErrorCode.INVALID_REQUEST, "Only active, non-refunded bookings can be sealed for overdue debt");
            }
            String paymentStatus = booking.getPaymentStatus();
            if (paymentStatus == null || !("UNPAID".equalsIgnoreCase(paymentStatus)
                    || "PARTIALLY_PAID".equalsIgnoreCase(paymentStatus)
                    || "PAID".equalsIgnoreCase(paymentStatus))) {
                throw new AppException(ErrorCode.INVALID_REQUEST, "The booking payment status is not reconciled");
            }
        }
        FacilityPolicy policy = facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(facility.getId())
                .orElseThrow(() -> new AppException(ErrorCode.FACILITY_POLICY_NOT_FOUND));
        if (policy.getOverdueSealingDays() == null || policy.getOverdueSealingDays() < 0
                || policy.getOverdueGraceDays() == null || policy.getOverdueGraceDays() < 0
                || policy.getDailyLateFee() == null || policy.getDailyLateFee().compareTo(BigDecimal.ZERO) < 0) {
            throw new AppException(ErrorCode.FACILITY_POLICY_NOT_FOUND, "The active facility policy is incomplete for overdue sealing");
        }
        long overdueDays = ChronoUnit.DAYS.between(contract.getEndDate(), LocalDate.now());
        if (overdueDays < policy.getOverdueSealingDays()) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "The facility policy sealing threshold has not been reached");
        }

        // 1. Kiểm tra trạng thái hiện tại đã bị niêm phong chưa
        if (sealingRecordRepository.existsByUnitIdAndStatus(unit.getId(), SealingStatus.SEALED)) {
            throw new AppException(ErrorCode.UNIT_ALREADY_SEALED);
        }

        // 2. Xác thực Performer & Witness (Two-Person Integrity)
        UUID currentUserId = requestContext != null ? requestContext.currentUserId() : null;
        User performer = currentUserId != null ? userRepository.findById(currentUserId).orElse(null) : null;
        if (performer == null || !Boolean.TRUE.equals(performer.getIsActive())) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }
        if (!isFacilityOperator(performer, facility)) {
            throw new AppException(ErrorCode.FACILITY_ACCESS_DENIED);
        }

        if (request.getWitnessId() == null) {
            throw new AppException(ErrorCode.SEALING_WITNESS_REQUIRED);
        }
        User witness = userRepository.findById(request.getWitnessId())
                .orElseThrow(() -> new AppException(ErrorCode.MASTER_KEY_WITNESS_NOT_FOUND));

        if (performer.getId().equals(witness.getId())) {
            throw new AppException(ErrorCode.SEALING_WITNESS_REQUIRED);
        }

        if (!Boolean.TRUE.equals(witness.getIsActive())) {
            throw new AppException(ErrorCode.MASTER_KEY_WITNESS_INACTIVE);
        }
        String witnessRole = witness.getRole() != null ? witness.getRole().getName() : null;
        if (!"STAFF".equalsIgnoreCase(witnessRole) && !"FACILITY_MANAGER".equalsIgnoreCase(witnessRole)) {
            throw new AppException(ErrorCode.MASTER_KEY_WITNESS_UNAUTHORIZED_ROLE);
        }
        if (witness.getFacility() == null || !facility.getId().equals(witness.getFacility().getId())) {
            throw new AppException(ErrorCode.FACILITY_ACCESS_DENIED, "The sealing witness must belong to the same facility");
        }

        // 3. Tính toán số ngày quá hạn và tổng công nợ tại thời điểm niêm phong
        BigDecimal monthlyFee = contract.getMonthlyFee();
        BigDecimal dailyLateFee = policy.getDailyLateFee();
        long billableDays = Math.max(0, overdueDays - policy.getOverdueGraceDays());
        BigDecimal totalLateFee = dailyLateFee.multiply(BigDecimal.valueOf(billableDays));
        BigDecimal totalDebt = monthlyFee.add(totalLateFee);

        // 4. Tạo mã biên bản niêm phong chuẩn
        String protocolNumber = "SEAL-" + System.currentTimeMillis() + "-" + VNPayUtil.randomAlphaNumeric(4).toUpperCase();
        String sealTagNumber = (request.getSealTagNumber() != null && !request.getSealTagNumber().isBlank())
                ? request.getSealTagNumber().trim()
                : ("TEM-BOXORA-" + (System.currentTimeMillis() % 100000));
        String reason = (request.getReason() != null && !request.getReason().isBlank())
                ? request.getReason().trim()
                : "Khách hàng quá hạn thanh toán tiền thuê kho theo quy định BR-RULE-012";

        SealingRecord record = SealingRecord.builder()
                .protocolNumber(protocolNumber)
                .contract(contract)
                .unit(unit)
                .facility(facility)
                .performedBy(performer)
                .witness(witness)
                .sealTagNumber(sealTagNumber)
                .reason(reason)
                .overdueDays(overdueDays)
                .totalDebtAmount(totalDebt)
                .inventorySummary(request.getInventorySummary())
                .notes(request.getNotes())
                .evidenceUrls(request.getEvidenceUrls())
                .status(SealingStatus.SEALED)
                .sealedAt(LocalDateTime.now())
                .build();

        record = sealingRecordRepository.save(record);

        // 5. Cập nhật trạng thái Unit & Contract thành OVERDUE_LOCKED
        unit.setStatus(UnitStatus.OVERDUE_LOCKED);
        storageUnitRepository.save(unit);

        if (contract != null) {
            contract.setStatus(RentalContractStatus.OVERDUE_LOCKED);
            rentalContractRepository.save(contract);
        }

        // 6. Gửi Email thông báo khẩn cấp cho khách hàng
        User customer = contract.getCustomer();
        if (customer != null && customer.getEmail() != null) {
            try {
                emailService.sendSealingNoticeEmail(
                        customer.getEmail(),
                        customer.getFullName() != null ? customer.getFullName() : customer.getUsername(),
                        contract.getContractCode(),
                        unit.getUnitCode(),
                        record.getProtocolNumber(),
                        record.getSealTagNumber(),
                        overdueDays,
                        totalDebt,
                        record.getReason()
                );
            } catch (Exception e) {
                log.warn("Failed to send sealing notice email: {}", e.getMessage());
            }

            // Ghi nhận NotificationLog
            notificationLogRepository.save(NotificationLog.builder()
                    .recipient(customer)
                    .recipientEmail(customer.getEmail())
                    .recipientName(customer.getFullName() != null ? customer.getFullName() : customer.getUsername())
                    .facility(facility)
                    .channel(NotificationChannel.EMAIL)
                    .notificationType(NotificationType.SEALING_NOTICE)
                    .referenceType("SealingRecord")
                    .referenceId(record.getId())
                    .title("Biên bản niêm phong kho " + unit.getUnitCode())
                    .content("Kho đã bị niêm phong do quá hạn thanh toán " + overdueDays + " ngày. Số biên bản: " + record.getProtocolNumber())
                    .status("SENT")
                    .build());
        }

        // 7. Audit Logging
        activityLogService.record(
                facility != null ? facility.getId() : null,
                ActivityAction.OVERDUE_SEALING_APPROVED,
                "SealingRecord",
                record.getId(),
                "Lập biên bản niêm phong kho " + unit.getUnitCode() + " (Mã kẹp chì: " + record.getSealTagNumber() + "). Người làm chứng: " + witness.getUsername(),
                UnitStatus.OCCUPIED.name(),
                UnitStatus.OVERDUE_LOCKED.name()
        );

        return toResponse(record);
    }

    @Override
    @Transactional
    public SealingRecordResponse unseal(UUID sealingId, SealingUnsealRequest request) {
        SealingRecord record = sealingRecordRepository.findById(sealingId)
                .orElseThrow(() -> new AppException(ErrorCode.SEALING_RECORD_NOT_FOUND));

        if (record.getStatus() == SealingStatus.UNSEALED) {
            throw new AppException(ErrorCode.UNIT_NOT_SEALED);
        }

        Facility facility = record.getFacility();
        if (facility == null) {
            throw new AppException(ErrorCode.FACILITY_ACCESS_DENIED);
        }
        facilityAccessGuard.checkFacilityAccess(facility.getId());

        UUID currentUserId = requestContext.currentUserId();
        User unsealedByUser = currentUserId != null
                ? userRepository.findById(currentUserId).orElse(null)
                : null;
        if (unsealedByUser == null || !Boolean.TRUE.equals(unsealedByUser.getIsActive())) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }
        if (!isFacilityOperator(unsealedByUser, facility)) {
            throw new AppException(ErrorCode.FACILITY_ACCESS_DENIED);
        }

        record.setStatus(SealingStatus.UNSEALED);
        record.setUnsealedAt(LocalDateTime.now());
        record.setUnsealedBy(unsealedByUser);
        record.setUnsealReason(request.getReason());
        if (request.getNotes() != null && !request.getNotes().isBlank()) {
            record.setNotes((record.getNotes() != null ? record.getNotes() + "\n" : "") + "Ghi chú mở niêm phong: " + request.getNotes());
        }
        record = sealingRecordRepository.save(record);

        // Khôi phục trạng thái kho
        StorageUnit unit = record.getUnit();
        RentalContract contract = record.getContract();
        LocalDate today = LocalDate.now();

        if (contract != null && contract.getEndDate() != null && !today.isAfter(contract.getEndDate())) {
            unit.setStatus(UnitStatus.OCCUPIED);
            contract.setStatus(RentalContractStatus.ACTIVE);
        } else {
            unit.setStatus(UnitStatus.AVAILABLE);
            if (contract != null) {
                contract.setStatus(RentalContractStatus.EXPIRED);
            }
        }
        storageUnitRepository.save(unit);
        if (contract != null) {
            rentalContractRepository.save(contract);
        }

        // Gửi email thông báo mở niêm phong
        User customer = contract != null ? contract.getCustomer() : null;
        if (customer != null && customer.getEmail() != null) {
            try {
                emailService.sendUnsealingNoticeEmail(
                        customer.getEmail(),
                        customer.getFullName() != null ? customer.getFullName() : customer.getUsername(),
                        contract.getContractCode(),
                        unit.getUnitCode(),
                        record.getProtocolNumber(),
                        unsealedByUser.getFullName() != null ? unsealedByUser.getFullName() : unsealedByUser.getUsername(),
                        record.getUnsealReason()
                );
            } catch (Exception e) {
                log.warn("Failed to send unsealing notice email: {}", e.getMessage());
            }

            notificationLogRepository.save(NotificationLog.builder()
                    .recipient(customer)
                    .recipientEmail(customer.getEmail())
                    .recipientName(customer.getFullName() != null ? customer.getFullName() : customer.getUsername())
                    .facility(facility)
                    .channel(NotificationChannel.EMAIL)
                    .notificationType(NotificationType.UNSEALING_NOTICE)
                    .referenceType("SealingRecord")
                    .referenceId(record.getId())
                    .title("Thông báo mở niêm phong kho " + unit.getUnitCode())
                    .content("Kho đã được mở niêm phong. Lý do: " + record.getUnsealReason())
                    .status("SENT")
                    .build());
        }

        // Audit Logging
        activityLogService.record(
                facility != null ? facility.getId() : null,
                ActivityAction.OVERDUE_UNIT_LOCKED,
                "SealingRecord",
                record.getId(),
                "Mở niêm phong kho " + unit.getUnitCode() + " thành công. Lý do: " + record.getUnsealReason(),
                UnitStatus.OVERDUE_LOCKED.name(),
                unit.getStatus().name()
        );

        return toResponse(record);
    }

    @Override
    @Transactional(readOnly = true)
    public SealingRecordResponse getById(UUID sealingId) {
        SealingRecord record = sealingRecordRepository.findById(sealingId)
                .orElseThrow(() -> new AppException(ErrorCode.SEALING_RECORD_NOT_FOUND));

        if (record.getFacility() == null) {
            throw new AppException(ErrorCode.FACILITY_ACCESS_DENIED);
        }
        facilityAccessGuard.checkFacilityAccess(record.getFacility().getId());
        return toResponse(record);
    }

    @Override
    @Transactional(readOnly = true)
    public SealingRecordResponse getActiveSealingByContractId(UUID contractId) {
        SealingRecord record = sealingRecordRepository
                .findFirstByContractIdAndStatusOrderByCreatedAtDesc(contractId, SealingStatus.SEALED)
                .orElseThrow(() -> new AppException(ErrorCode.SEALING_RECORD_NOT_FOUND));

        if (record.getFacility() == null) {
            throw new AppException(ErrorCode.FACILITY_ACCESS_DENIED);
        }
        if ("CUSTOMER".equalsIgnoreCase(requestContext.currentUserRole())) {
            UUID currentUserId = requestContext.currentUserId();
            if (record.getContract() == null || record.getContract().getCustomer() == null
                    || currentUserId == null || !currentUserId.equals(record.getContract().getCustomer().getId())) {
                throw new AppException(ErrorCode.FACILITY_ACCESS_DENIED);
            }
        } else {
            facilityAccessGuard.checkFacilityAccess(record.getFacility().getId());
        }
        return toResponse(record);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<SealingRecordResponse> getAll(UUID facilityId, SealingStatus status, int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));

        UUID effectiveFacilityId = facilityId;
        if (facilityAccessGuard.isFacilityScoped()) {
            effectiveFacilityId = facilityAccessGuard.scopedFacilityIdOrNull();
        }
        final UUID queryFacilityId = effectiveFacilityId;

        Specification<SealingRecord> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (queryFacilityId != null) {
                predicates.add(cb.equal(root.get("facility").get("id"), queryFacilityId));
            }
            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };

        Page<SealingRecord> pageResult = sealingRecordRepository.findAll(spec, pageable);
        return PageResponse.from(pageResult.map(this::toResponse));
    }

    private boolean isFacilityOperator(User user, Facility facility) {
        String roleName = user.getRole() != null ? user.getRole().getName() : null;
        return facility != null && user.getFacility() != null
                && facility.getId().equals(user.getFacility().getId())
                && ("FACILITY_MANAGER".equalsIgnoreCase(roleName) || "STAFF".equalsIgnoreCase(roleName));
    }

    private SealingRecordResponse toResponse(SealingRecord r) {
        UUID unitId = r.getUnit() != null ? r.getUnit().getId() : null;
        String unitCode = r.getUnit() != null ? r.getUnit().getUnitCode() : null;
        UUID performerId = r.getPerformedBy() != null ? r.getPerformedBy().getId() : null;
        String performerName = r.getPerformedBy() != null ? r.getPerformedBy().getFullName() : null;

        return SealingRecordResponse.builder()
                .id(r.getId())
                .protocolNumber(r.getProtocolNumber())
                .contractId(r.getContract() != null ? r.getContract().getId() : null)
                .contractCode(r.getContract() != null ? r.getContract().getContractCode() : null)
                .storageUnitId(unitId)
                .unitId(unitId)
                .unitCode(unitCode)
                .facilityId(r.getFacility() != null ? r.getFacility().getId() : null)
                .facilityName(r.getFacility() != null ? r.getFacility().getName() : null)
                .customerId(r.getContract() != null && r.getContract().getCustomer() != null ? r.getContract().getCustomer().getId() : null)
                .customerName(r.getContract() != null && r.getContract().getCustomer() != null ? r.getContract().getCustomer().getFullName() : null)
                .customerEmail(r.getContract() != null && r.getContract().getCustomer() != null ? r.getContract().getCustomer().getEmail() : null)
                .customerPhone(r.getContract() != null && r.getContract().getCustomer() != null ? r.getContract().getCustomer().getPhone() : null)
                .sealedById(performerId)
                .sealedByName(performerName)
                .performedById(performerId)
                .performedByName(performerName)
                .witnessId(r.getWitness() != null ? r.getWitness().getId() : null)
                .witnessName(r.getWitness() != null ? r.getWitness().getFullName() : null)
                .sealTagNumber(r.getSealTagNumber())
                .reason(r.getReason())
                .overdueDays(r.getOverdueDays())
                .totalDebtAmount(r.getTotalDebtAmount())
                .inventorySummary(r.getInventorySummary())
                .notes(r.getNotes())
                .evidenceUrls(r.getEvidenceUrls())
                .status(r.getStatus())
                .sealedAt(r.getSealedAt())
                .unsealedAt(r.getUnsealedAt())
                .unsealedById(r.getUnsealedBy() != null ? r.getUnsealedBy().getId() : null)
                .unsealedByName(r.getUnsealedBy() != null ? r.getUnsealedBy().getFullName() : null)
                .unsealReason(r.getUnsealReason())
                .createdAt(r.getCreatedAt())
                .build();
    }
}

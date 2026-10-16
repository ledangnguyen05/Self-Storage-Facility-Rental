package com.boxora.service.impl;

import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.RefundCreateRequest;
import com.boxora.dto.request.RefundProcessRequest;
import com.boxora.dto.request.RefundReviewRequest;
import com.boxora.dto.response.RefundRequestResponse;
import com.boxora.entity.*;
import com.boxora.enums.*;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.repository.*;
import com.boxora.security.FacilityAccessGuard;
import com.boxora.security.RequestContext;
import com.boxora.service.ActivityLogService;
import com.boxora.service.EmailService;
import com.boxora.service.RefundService;
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
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class RefundServiceImpl implements RefundService {

    private final RefundRequestRepository refundRequestRepository;
    private final BookingRepository bookingRepository;
    private final RentalContractRepository rentalContractRepository;
    private final UserRepository userRepository;
    private final NotificationLogRepository notificationLogRepository;
    private final EmailService emailService;
    private final ActivityLogService activityLogService;
    private final FacilityAccessGuard facilityAccessGuard;
    private final RequestContext requestContext;

    @Override
    @Transactional
    public RefundRequestResponse createRefundRequest(RefundCreateRequest request) {
        if (request.getBookingId() == null && request.getContractId() == null) {
            throw new AppException(ErrorCode.REFUND_TARGET_REQUIRED);
        }

        Booking booking = null;
        RentalContract contract = null;
        Facility facility = null;
        User customer = null;

        if (request.getContractId() != null) {
            contract = rentalContractRepository.findById(request.getContractId())
                    .orElseThrow(() -> new AppException(ErrorCode.CONTRACT_NOT_FOUND));
            facility = contract.getFacility();
            customer = contract.getCustomer();
            if (contract.getBooking() != null) {
                booking = contract.getBooking();
            }
        } else {
            booking = bookingRepository.findById(request.getBookingId())
                    .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));
            customer = booking.getCustomer();
            if (booking.getStorageUnit() != null) {
                facility = booking.getStorageUnit().getFacility();
            }
        }

        UUID currentUserId = requestContext.currentUserId();
        String currentRole = requestContext.currentUserRole();
        if ("CUSTOMER".equalsIgnoreCase(currentRole)
                && (customer == null || !customer.getId().equals(currentUserId))) {
            throw new AppException(ErrorCode.FORBIDDEN);
        }

        if (booking != null && refundRequestRepository.existsByBooking_IdAndStatusIn(
                booking.getId(), List.of(RefundStatus.PENDING_REVIEW, RefundStatus.APPROVED))) {
            throw new AppException(ErrorCode.INVALID_REFUND_AMOUNT, "Đơn này đã có yêu cầu hoàn tiền đang được xử lý");
        }

        // A customer may request a refund, but never chooses its financial result.
        // The recorded deposit is the upper bound until an authorized reviewer applies deductions.
        BigDecimal paidDeposit = booking != null && booking.getDepositPaid() != null
                ? booking.getDepositPaid() : BigDecimal.ZERO;
        if (paidDeposit.compareTo(BigDecimal.ZERO) <= 0) {
            throw new AppException(ErrorCode.INVALID_REFUND_AMOUNT, "Chưa có tiền cọc đã xác nhận để hoàn");
        }
        BigDecimal requestedAmount = paidDeposit;
        BigDecimal deductionAmount = BigDecimal.ZERO;
        BigDecimal finalRefundAmount = requestedAmount;

        if (facility != null && facilityAccessGuard.isFacilityScoped()) {
            facilityAccessGuard.checkFacilityAccess(facility.getId());
        }

        User requestedByUser = currentUserId != null
                ? userRepository.findById(currentUserId).orElse(null)
                : customer;
        if (requestedByUser == null) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }

        String requestCode = "REF-" + System.currentTimeMillis() + "-" + VNPayUtil.randomAlphaNumeric(4).toUpperCase();

        RefundRequest refund = RefundRequest.builder()
                .requestCode(requestCode)
                .customer(customer)
                .facility(facility)
                .booking(booking)
                .contract(contract)
                .requestedAmount(requestedAmount)
                .deductionAmount(deductionAmount)
                .finalRefundAmount(finalRefundAmount)
                .bankName(request.getBankName().trim())
                .bankAccountNumber(request.getBankAccountNumber().trim())
                .bankAccountName(request.getBankAccountName().trim())
                .reason(request.getReason().trim())
                .status(RefundStatus.PENDING_REVIEW)
                .requestedBy(requestedByUser)
                .build();

        refund = refundRequestRepository.save(refund);

        activityLogService.record(
                facility != null ? facility.getId() : null,
                ActivityAction.REFUND_REQUEST_CREATE,
                "RefundRequest",
                refund.getId(),
                "Khởi tạo yêu cầu hoàn tiền " + refund.getRequestCode() + " với số tiền thực nhận " + finalRefundAmount,
                null,
                RefundStatus.PENDING_REVIEW.name()
        );

        return toResponse(refund);
    }

    @Override
    @Transactional
    public RefundRequestResponse reviewRefundRequest(UUID refundId, RefundReviewRequest request) {
        RefundRequest refund = refundRequestRepository.findById(refundId)
                .orElseThrow(() -> new AppException(ErrorCode.REFUND_REQUEST_NOT_FOUND));

        if (refund.getStatus() != RefundStatus.PENDING_REVIEW) {
            throw new AppException(ErrorCode.REFUND_ALREADY_REVIEWED);
        }

        if (refund.getFacility() != null && facilityAccessGuard.isFacilityScoped()) {
            facilityAccessGuard.checkFacilityAccess(refund.getFacility().getId());
        }

        UUID currentUserId = requestContext.currentUserId();
        User reviewer = currentUserId != null
                ? userRepository.findById(currentUserId).orElse(null)
                : null;
        if (reviewer == null) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }

        boolean isApprove = "APPROVE".equalsIgnoreCase(request.getAction());
        RefundStatus nextStatus = isApprove ? RefundStatus.APPROVED : RefundStatus.REJECTED;

        refund.setStatus(nextStatus);
        refund.setReviewedBy(reviewer);
        refund.setReviewedAt(LocalDateTime.now());
        if (isApprove) {
            refund.setReviewNote(request.getReviewNote());
        } else {
            refund.setRejectionReason(request.getRejectionReason() != null ? request.getRejectionReason() : request.getReviewNote());
        }

        refund = refundRequestRepository.save(refund);

        // Gửi email thông báo trạng thái
        User customer = refund.getCustomer();
        if (customer != null && customer.getEmail() != null) {
            try {
                emailService.sendRefundStatusEmail(
                        customer.getEmail(),
                        customer.getFullName() != null ? customer.getFullName() : customer.getUsername(),
                        refund.getRequestCode(),
                        nextStatus.name(),
                        refund.getFinalRefundAmount(),
                        refund.getBankName(),
                        maskAccountNumber(refund.getBankAccountNumber()),
                        null,
                        isApprove ? refund.getReviewNote() : refund.getRejectionReason()
                );
            } catch (Exception e) {
                log.warn("Failed to send refund status email: {}", e.getMessage());
            }

            notificationLogRepository.save(NotificationLog.builder()
                    .recipient(customer)
                    .recipientEmail(customer.getEmail())
                    .recipientName(customer.getFullName() != null ? customer.getFullName() : customer.getUsername())
                    .facility(refund.getFacility())
                    .channel(NotificationChannel.EMAIL)
                    .notificationType(NotificationType.REFUND_STATUS)
                    .referenceType("RefundRequest")
                    .referenceId(refund.getId())
                    .title("Cập nhật trạng thái yêu cầu hoàn tiền " + refund.getRequestCode())
                    .content("Yêu cầu hoàn tiền " + refund.getRequestCode() + " đã được " + (isApprove ? "phê duyệt" : "từ chối"))
                    .status("SENT")
                    .build());
        }

        activityLogService.record(
                refund.getFacility() != null ? refund.getFacility().getId() : null,
                ActivityAction.REFUND_APPROVE,
                "RefundRequest",
                refund.getId(),
                "Phê duyệt yêu cầu hoàn tiền " + refund.getRequestCode() + " thành trạng thái " + nextStatus,
                RefundStatus.PENDING_REVIEW.name(),
                nextStatus.name()
        );

        return toResponse(refund);
    }

    @Override
    @Transactional
    public RefundRequestResponse processRefund(UUID refundId, RefundProcessRequest request) {
        RefundRequest refund = refundRequestRepository.findById(refundId)
                .orElseThrow(() -> new AppException(ErrorCode.REFUND_REQUEST_NOT_FOUND));

        if (refund.getStatus() == RefundStatus.PROCESSED) {
            throw new AppException(ErrorCode.REFUND_ALREADY_PROCESSED);
        }

        if (refund.getStatus() != RefundStatus.APPROVED) {
            throw new AppException(ErrorCode.REFUND_NOT_APPROVED);
        }

        if (refund.getFacility() != null && facilityAccessGuard.isFacilityScoped()) {
            facilityAccessGuard.checkFacilityAccess(refund.getFacility().getId());
        }

        UUID currentUserId = requestContext.currentUserId();
        User processor = currentUserId != null
                ? userRepository.findById(currentUserId).orElse(null)
                : null;
        if (processor == null) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }

        refund.setStatus(RefundStatus.PROCESSED);
        refund.setProcessedBy(processor);
        refund.setProcessedAt(LocalDateTime.now());
        refund.setTransactionReference(request.getTransactionReference().trim());
        refund.setProcessNotes(request.getProcessNotes());

        refund = refundRequestRepository.save(refund);

        // Gửi email thông báo chi trả hoàn tất
        User customer = refund.getCustomer();
        if (customer != null && customer.getEmail() != null) {
            try {
                emailService.sendRefundStatusEmail(
                        customer.getEmail(),
                        customer.getFullName() != null ? customer.getFullName() : customer.getUsername(),
                        refund.getRequestCode(),
                        RefundStatus.PROCESSED.name(),
                        refund.getFinalRefundAmount(),
                        refund.getBankName(),
                        maskAccountNumber(refund.getBankAccountNumber()),
                        refund.getTransactionReference(),
                        refund.getProcessNotes()
                );
            } catch (Exception e) {
                log.warn("Failed to send refund processed email: {}", e.getMessage());
            }

            notificationLogRepository.save(NotificationLog.builder()
                    .recipient(customer)
                    .recipientEmail(customer.getEmail())
                    .recipientName(customer.getFullName() != null ? customer.getFullName() : customer.getUsername())
                    .facility(refund.getFacility())
                    .channel(NotificationChannel.EMAIL)
                    .notificationType(NotificationType.REFUND_STATUS)
                    .referenceType("RefundRequest")
                    .referenceId(refund.getId())
                    .title("Chi trả tiền hoàn tất: " + refund.getRequestCode())
                    .content("Khoản tiền hoàn " + refund.getFinalRefundAmount() + " VND đã được chi trả thành công. Mã GD: " + refund.getTransactionReference())
                    .status("SENT")
                    .build());
        }

        activityLogService.record(
                refund.getFacility() != null ? refund.getFacility().getId() : null,
                ActivityAction.REFUND_PROCESSED,
                "RefundRequest",
                refund.getId(),
                "Thực hiện chi trả thành công yêu cầu hoàn tiền " + refund.getRequestCode() + " - Mã GD: " + refund.getTransactionReference(),
                RefundStatus.APPROVED.name(),
                RefundStatus.PROCESSED.name()
        );

        return toResponse(refund);
    }

    @Override
    @Transactional(readOnly = true)
    public RefundRequestResponse getById(UUID refundId) {
        RefundRequest refund = refundRequestRepository.findById(refundId)
                .orElseThrow(() -> new AppException(ErrorCode.REFUND_REQUEST_NOT_FOUND));

        if (refund.getFacility() != null && facilityAccessGuard.isFacilityScoped()) {
            facilityAccessGuard.checkFacilityAccess(refund.getFacility().getId());
        }
        if ("CUSTOMER".equalsIgnoreCase(requestContext.currentUserRole())) {
            UUID currentUserId = requestContext.currentUserId();
            if (currentUserId != null && !currentUserId.equals(refund.getCustomer().getId())) {
                throw new AppException(ErrorCode.FORBIDDEN);
            }
        }
        return toResponse(refund);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<RefundRequestResponse> getAll(UUID facilityId, UUID customerId, RefundStatus status, int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));

        UUID effectiveFacilityId = facilityId;
        if (facilityAccessGuard.isFacilityScoped()) {
            effectiveFacilityId = facilityAccessGuard.scopedFacilityIdOrNull();
        }

        UUID effectiveCustomerId = customerId;
        if ("CUSTOMER".equalsIgnoreCase(requestContext.currentUserRole())) {
            effectiveCustomerId = requestContext.currentUserId();
        }

        final UUID queryFacilityId = effectiveFacilityId;
        final UUID queryCustomerId = effectiveCustomerId;

        Specification<RefundRequest> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (queryFacilityId != null) {
                predicates.add(cb.equal(root.get("facility").get("id"), queryFacilityId));
            }
            if (queryCustomerId != null) {
                predicates.add(cb.equal(root.get("customer").get("id"), queryCustomerId));
            }
            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };

        Page<RefundRequest> pageResult = refundRequestRepository.findAll(spec, pageable);
        return PageResponse.from(pageResult.map(this::toResponse));
    }

    private RefundRequestResponse toResponse(RefundRequest r) {
        return RefundRequestResponse.builder()
                .id(r.getId())
                .requestCode(r.getRequestCode())
                .customerId(r.getCustomer() != null ? r.getCustomer().getId() : null)
                .customerName(r.getCustomer() != null ? r.getCustomer().getFullName() : null)
                .customerEmail(r.getCustomer() != null ? r.getCustomer().getEmail() : null)
                .customerPhone(r.getCustomer() != null ? r.getCustomer().getPhone() : null)
                .facilityId(r.getFacility() != null ? r.getFacility().getId() : null)
                .facilityName(r.getFacility() != null ? r.getFacility().getName() : null)
                .bookingId(r.getBooking() != null ? r.getBooking().getId() : null)
                .bookingCode(r.getBooking() != null ? r.getBooking().getBookingCode() : null)
                .contractId(r.getContract() != null ? r.getContract().getId() : null)
                .contractCode(r.getContract() != null ? r.getContract().getContractCode() : null)
                .requestedAmount(r.getRequestedAmount())
                .deductionAmount(r.getDeductionAmount())
                .finalRefundAmount(r.getFinalRefundAmount())
                .bankName(r.getBankName())
                .bankAccountNumber(maskAccountNumber(r.getBankAccountNumber()))
                .bankAccountName(r.getBankAccountName())
                .reason(r.getReason())
                .status(r.getStatus())
                .requestedById(r.getRequestedBy() != null ? r.getRequestedBy().getId() : null)
                .requestedByName(r.getRequestedBy() != null ? r.getRequestedBy().getFullName() : null)
                .createdAt(r.getCreatedAt())
                .reviewedById(r.getReviewedBy() != null ? r.getReviewedBy().getId() : null)
                .reviewedByName(r.getReviewedBy() != null ? r.getReviewedBy().getFullName() : null)
                .reviewedAt(r.getReviewedAt())
                .reviewNote(r.getReviewNote())
                .rejectionReason(r.getRejectionReason())
                .processedById(r.getProcessedBy() != null ? r.getProcessedBy().getId() : null)
                .processedByName(r.getProcessedBy() != null ? r.getProcessedBy().getFullName() : null)
                .processedAt(r.getProcessedAt())
                .transactionReference(r.getTransactionReference())
                .processNotes(r.getProcessNotes())
                .build();
    }

    private String maskAccountNumber(String accountNumber) {
        if (accountNumber == null || accountNumber.length() <= 4) return "****";
        return "****" + accountNumber.substring(accountNumber.length() - 4);
    }
}

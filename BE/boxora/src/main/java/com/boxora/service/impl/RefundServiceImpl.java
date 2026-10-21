package com.boxora.service.impl;

import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.*;
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
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.Map;
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
    private final PaymentRepository paymentRepository;
    private final EmailService emailService;
    private final ActivityLogService activityLogService;
    private final FacilityAccessGuard facilityAccessGuard;
    private final RequestContext requestContext;
    private final FacilityPolicyRepository facilityPolicyRepository;
    private final com.boxora.service.FileStorageService fileStorageService;

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
        // Scope before any other check, so staff of another facility learn nothing about the booking.
        if (facility == null) {
            throw new AppException(ErrorCode.REFUND_TARGET_REQUIRED, "Không xác định được cơ sở của đơn cần hoàn tiền.");
        }
        if (facilityAccessGuard.isFacilityScoped()) {
            facilityAccessGuard.checkFacilityAccess(facility.getId());
        }

        if (booking != null && refundRequestRepository.existsByBooking_IdAndStatusIn(
                booking.getId(), List.of(
                        RefundStatus.PENDING_REVIEW,
                        RefundStatus.APPROVED,
                        RefundStatus.PROCESSING_TRANSFER,
                        RefundStatus.AWAITING_CUSTOMER_CONFIRMATION,
                        RefundStatus.RECONCILED
                ))) {
            throw new AppException(ErrorCode.INVALID_REFUND_AMOUNT, "Đơn này đã có yêu cầu hoàn tiền đang được xử lý");
        }

        BigDecimal paidDeposit = booking != null && booking.getDepositPaid() != null
                ? booking.getDepositPaid() : BigDecimal.ZERO;
        if (paidDeposit.compareTo(BigDecimal.ZERO) <= 0) {
            throw new AppException(ErrorCode.INVALID_REFUND_AMOUNT, "Chưa có tiền cọc đã xác nhận để hoàn");
        }
        BigDecimal requestedAmount = paidDeposit;
        BigDecimal deductionAmount = BigDecimal.ZERO;
        BigDecimal finalRefundAmount = requestedAmount;

        validateBankFields(request.getBankName(), request.getBankAccountNumber(), request.getBankAccountName(), false);

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
                .bankName(trimToNull(request.getBankName()))
                .bankAccountNumber(normalizeAccountNumber(request.getBankAccountNumber()))
                .bankAccountName(trimToNull(request.getBankAccountName()))
                .bankInfoUpdatedAt(request.getBankAccountNumber() != null && !request.getBankAccountNumber().isBlank() ? LocalDateTime.now() : null)
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
                "Khởi tạo yêu cầu hoàn tiền " + refund.getRequestCode() + " với số tiền " + vnd(finalRefundAmount),
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
        assertStaffAccess(refund);

        if (refund.getStatus() != RefundStatus.PENDING_REVIEW) {
            throw new AppException(ErrorCode.REFUND_ALREADY_REVIEWED);
        }

        UUID currentUserId = requestContext.currentUserId();
        User reviewer = currentUserId != null
                ? userRepository.findById(currentUserId).orElse(null)
                : null;
        if (reviewer == null) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }

        boolean isApprove = "APPROVE".equalsIgnoreCase(request.getAction());
        if (!isApprove && (request.getRejectionReason() == null || request.getRejectionReason().isBlank())
                && (request.getReviewNote() == null || request.getReviewNote().isBlank())) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Vui lòng nhập lý do từ chối để thông báo cho khách hàng.");
        }
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
                (isApprove ? "Phê duyệt" : "Từ chối") + " yêu cầu hoàn tiền " + refund.getRequestCode(),
                RefundStatus.PENDING_REVIEW.name(),
                nextStatus.name()
        );

        return toResponse(refund);
    }

    @Override
    @Transactional
    public RefundRequestResponse startTransfer(UUID refundId, RefundTransferRequest request) {
        RefundRequest refund = refundRequestRepository.findById(refundId)
                .orElseThrow(() -> new AppException(ErrorCode.REFUND_REQUEST_NOT_FOUND));
        assertStaffAccess(refund);

        if (refund.getStatus() != RefundStatus.APPROVED) {
            throw new AppException(ErrorCode.REFUND_NOT_APPROVED, "Yêu cầu hoàn tiền phải được duyệt trước khi bắt đầu chuyển tiền.");
        }
        requireBankInfo(refund);

        UUID currentUserId = requestContext.currentUserId();
        User initiator = currentUserId != null
                ? userRepository.findById(currentUserId).orElse(null)
                : null;
        if (initiator == null) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }

        refund.setStatus(RefundStatus.PROCESSING_TRANSFER);
        refund.setTransferInitiatedBy(initiator);
        refund.setTransferInitiatedAt(LocalDateTime.now());
        refund.setTransferReference(request.getTransferReference().trim());
        if (request.getTransferNotes() != null && !request.getTransferNotes().isBlank()) {
            refund.setProcessNotes(request.getTransferNotes().trim());
        }
        if (request.getTransferEvidenceUrl() != null && !request.getTransferEvidenceUrl().isBlank()) {
            refund.setTransferEvidenceUrl(validateEvidenceUrl(request.getTransferEvidenceUrl()));
        }

        refund = refundRequestRepository.save(refund);

        activityLogService.record(
                refund.getFacility() != null ? refund.getFacility().getId() : null,
                ActivityAction.REFUND_PROCESS,
                "RefundRequest",
                refund.getId(),
                "Bắt đầu chuyển tiền hoàn " + refund.getRequestCode() + " - Mã UNC/Ref: " + refund.getTransferReference(),
                RefundStatus.APPROVED.name(),
                RefundStatus.PROCESSING_TRANSFER.name()
        );

        return toResponse(refund);
    }

    @Override
    @Transactional
    public RefundRequestResponse processRefund(UUID refundId, RefundProcessRequest request) {
        RefundRequest refund = refundRequestRepository.findById(refundId)
                .orElseThrow(() -> new AppException(ErrorCode.REFUND_REQUEST_NOT_FOUND));
        assertStaffAccess(refund);

        if (refund.getStatus() == RefundStatus.PROCESSED || refund.getStatus() == RefundStatus.COMPLETED) {
            throw new AppException(ErrorCode.REFUND_ALREADY_PROCESSED);
        }

        if (refund.getStatus() != RefundStatus.APPROVED && refund.getStatus() != RefundStatus.PROCESSING_TRANSFER) {
            throw new AppException(ErrorCode.REFUND_NOT_APPROVED, "Yêu cầu phải được duyệt hoặc đang chuyển khoản mới có thể xác nhận đã chuyển tiền.");
        }
        requireBankInfo(refund);

        UUID currentUserId = requestContext.currentUserId();
        User processor = currentUserId != null
                ? userRepository.findById(currentUserId).orElse(null)
                : null;
        if (processor == null) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }

        RefundStatus oldStatus = refund.getStatus();
        // Sau khi kế toán/staff chuyển tiền và cung cấp mã giao dịch thực tế, chuyển sang AWAITING_CUSTOMER_CONFIRMATION
        refund.setStatus(RefundStatus.AWAITING_CUSTOMER_CONFIRMATION);
        refund.setProcessedBy(processor);
        refund.setProcessedAt(LocalDateTime.now());
        refund.setTransactionReference(request.getTransactionReference().trim());
        refund.setProcessNotes(request.getProcessNotes());

        refund = refundRequestRepository.save(refund);

        // Tạo hoặc cập nhật bản ghi Payment hoàn tiền thực tế với mã giao dịch ngân hàng thật
        if (refund.getBooking() != null && refund.getFinalRefundAmount().compareTo(BigDecimal.ZERO) > 0) {
            String txnRef = refund.getTransactionReference();
            Payment refundPayment = paymentRepository.findByTransactionId(txnRef).orElse(null);
            if (refundPayment == null) {
                refundPayment = Payment.builder()
                        .transactionId(txnRef)
                        .booking(refund.getBooking())
                        .contract(refund.getContract())
                        .amount(refund.getFinalRefundAmount())
                        .paymentType(PaymentType.DEPOSIT)
                        .status(PaymentStatus.REFUNDED)
                        .paymentMethod("BANK_TRANSFER")
                        .paymentTime(LocalDateTime.now())
                        .confirmedByStaff(processor)
                        .confirmedAt(LocalDateTime.now())
                        .paymentNotes("Hoàn tiền theo yêu cầu " + refund.getRequestCode()
                                + (request.getProcessNotes() != null && !request.getProcessNotes().isBlank() ? ". " + request.getProcessNotes().trim() : ""))
                        .build();
            } else {
                refundPayment.setStatus(PaymentStatus.REFUNDED);
                refundPayment.setAmount(refund.getFinalRefundAmount());
                refundPayment.setConfirmedByStaff(processor);
                refundPayment.setConfirmedAt(LocalDateTime.now());
            }
            paymentRepository.save(refundPayment);
        }

        User customer = refund.getCustomer();
        if (customer != null && customer.getEmail() != null) {
            try {
                emailService.sendRefundStatusEmail(
                        customer.getEmail(),
                        customer.getFullName() != null ? customer.getFullName() : customer.getUsername(),
                        refund.getRequestCode(),
                        RefundStatus.AWAITING_CUSTOMER_CONFIRMATION.name(),
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
                    .content("Khoản tiền hoàn " + vnd(refund.getFinalRefundAmount()) + " đã được chi trả qua ngân hàng. Mã GD: " + refund.getTransactionReference() + ". Quý khách vui lòng kiểm tra tài khoản và xác nhận.")
                    .status("SENT")
                    .build());
        }

        activityLogService.record(
                refund.getFacility() != null ? refund.getFacility().getId() : null,
                ActivityAction.REFUND_PROCESSED,
                "RefundRequest",
                refund.getId(),
                "Thực hiện chi trả thành công yêu cầu hoàn tiền " + refund.getRequestCode() + " - Mã GD: " + refund.getTransactionReference(),
                oldStatus.name(),
                RefundStatus.AWAITING_CUSTOMER_CONFIRMATION.name()
        );

        return toResponse(refund);
    }

    @Override
    @Transactional
    public RefundRequestResponse confirmCustomerReceived(UUID refundId, RefundCustomerConfirmRequest request) {
        RefundRequest refund = refundRequestRepository.findById(refundId)
                .orElseThrow(() -> new AppException(ErrorCode.REFUND_REQUEST_NOT_FOUND));

        // The customer confirms their own refund; staff may record it on the customer's behalf, but only for a
        // refund of the facility they are assigned to.
        boolean byCustomer = "CUSTOMER".equalsIgnoreCase(requestContext.currentUserRole());
        if (byCustomer) {
            UUID currentUserId = requestContext.currentUserId();
            if (currentUserId == null || refund.getCustomer() == null || !refund.getCustomer().getId().equals(currentUserId)) {
                throw new AppException(ErrorCode.FORBIDDEN, "Bạn chỉ có thể xác nhận nhận tiền cho yêu cầu hoàn của chính mình");
            }
        } else {
            assertStaffAccess(refund);
        }

        if (refund.getStatus() != RefundStatus.AWAITING_CUSTOMER_CONFIRMATION
                && refund.getStatus() != RefundStatus.PROCESSED) {
            throw new AppException(ErrorCode.REFUND_INVALID_STATUS_TRANSITION,
                    "Chỉ có thể xác nhận đã nhận tiền sau khi Boxora chuyển khoản hoàn tiền.");
        }

        RefundStatus oldStatus = refund.getStatus();
        refund.setStatus(RefundStatus.RECONCILED);
        refund.setCustomerConfirmedAt(LocalDateTime.now());
        String notes = request != null && request.getConfirmationNotes() != null && !request.getConfirmationNotes().isBlank()
                ? request.getConfirmationNotes().trim() : null;
        if (notes == null && !byCustomer) {
            notes = "Nhân viên ghi nhận thay khách hàng";
        }
        if (notes != null) {
            refund.setCustomerConfirmationNotes(notes);
        }

        refund = refundRequestRepository.save(refund);

        activityLogService.record(
                refund.getFacility() != null ? refund.getFacility().getId() : null,
                ActivityAction.REFUND_CONFIRM,
                "RefundRequest",
                refund.getId(),
                (byCustomer ? "Khách hàng xác nhận đã nhận tiền cho yêu cầu " : "Nhân viên ghi nhận thay khách hàng đã nhận tiền cho yêu cầu ")
                        + refund.getRequestCode(),
                oldStatus.name(),
                RefundStatus.RECONCILED.name()
        );

        return toResponse(refund);
    }

    @Override
    @Transactional
    public RefundRequestResponse reconcileRefund(UUID refundId, RefundReconcileRequest request) {
        RefundRequest refund = refundRequestRepository.findById(refundId)
                .orElseThrow(() -> new AppException(ErrorCode.REFUND_REQUEST_NOT_FOUND));
        assertStaffAccess(refund);

        if (refund.getStatus() != RefundStatus.RECONCILED
                && refund.getStatus() != RefundStatus.AWAITING_CUSTOMER_CONFIRMATION
                && refund.getStatus() != RefundStatus.PROCESSED) {
            throw new AppException(ErrorCode.REFUND_INVALID_STATUS_TRANSITION,
                    "Chỉ đối soát được yêu cầu đã chuyển khoản (chờ khách xác nhận hoặc khách đã xác nhận).");
        }

        UUID currentUserId = requestContext.currentUserId();
        User reconciler = currentUserId != null
                ? userRepository.findById(currentUserId).orElse(null)
                : null;
        if (reconciler == null) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }

        RefundStatus oldStatus = refund.getStatus();
        refund.setStatus(RefundStatus.COMPLETED);
        refund.setReconciledBy(reconciler);
        refund.setReconciledAt(LocalDateTime.now());
        if (request != null && request.getReconciliationNotes() != null) {
            refund.setReconciliationNotes(request.getReconciliationNotes().trim());
        }

        refund = refundRequestRepository.save(refund);

        activityLogService.record(
                refund.getFacility() != null ? refund.getFacility().getId() : null,
                ActivityAction.REFUND_RECONCILE,
                "RefundRequest",
                refund.getId(),
                "Hoàn tất đối soát và đóng hồ sơ hoàn tiền " + refund.getRequestCode(),
                oldStatus.name(),
                RefundStatus.COMPLETED.name()
        );

        return toResponse(refund);
    }

    @Override
    @Transactional(readOnly = true)
    public RefundRequestResponse getById(UUID refundId) {
        RefundRequest refund = refundRequestRepository.findById(refundId)
                .orElseThrow(() -> new AppException(ErrorCode.REFUND_REQUEST_NOT_FOUND));
        assertAccess(refund);
        return toResponse(refund);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<RefundRequestResponse> getAll(UUID facilityId, UUID customerId, String statusCsv, String q, int page, int size) {
        Pageable pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 200), Sort.by(Sort.Direction.DESC, "createdAt"));

        UUID effectiveFacilityId = facilityId;
        if (facilityAccessGuard.isFacilityScoped()) {
            effectiveFacilityId = facilityAccessGuard.scopedFacilityIdOrNull();
        }
        UUID effectiveCustomerId = customerId;
        if ("CUSTOMER".equalsIgnoreCase(requestContext.currentUserRole())) {
            effectiveCustomerId = requestContext.currentUserId();
        }
        List<RefundStatus> statuses = parseStatuses(statusCsv);
        String needle = q != null && !q.isBlank() ? "%" + q.trim().toLowerCase() + "%" : null;

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
            if (!statuses.isEmpty()) {
                predicates.add(root.get("status").in(statuses));
            }
            if (needle != null) {
                var customer = root.join("customer", jakarta.persistence.criteria.JoinType.LEFT);
                var booking = root.join("booking", jakarta.persistence.criteria.JoinType.LEFT);
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("requestCode")), needle),
                        cb.like(cb.lower(cb.coalesce(booking.get("bookingCode"), "")), needle),
                        cb.like(cb.lower(cb.coalesce(customer.get("fullName"), "")), needle),
                        cb.like(cb.lower(cb.coalesce(customer.get("phone"), "")), needle),
                        cb.like(cb.lower(cb.coalesce(customer.get("email"), "")), needle)
                ));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };

        Page<RefundRequest> pageResult = refundRequestRepository.findAll(spec, pageable);
        Map<UUID, Integer> slaCache = new LinkedHashMap<>();
        return PageResponse.from(pageResult.map(r -> toResponse(r, slaCache)));
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Long> getStatusCounts(UUID facilityId) {
        UUID effectiveFacilityId = facilityId;
        if (facilityAccessGuard.isFacilityScoped()) {
            effectiveFacilityId = facilityAccessGuard.scopedFacilityIdOrNull();
        }
        if ("CUSTOMER".equalsIgnoreCase(requestContext.currentUserRole())) {
            throw new AppException(ErrorCode.FORBIDDEN);
        }
        Map<String, Long> counts = new LinkedHashMap<>();
        for (RefundStatus status : RefundStatus.values()) {
            counts.put(status.name(), effectiveFacilityId != null
                    ? refundRequestRepository.countByFacility_IdAndStatus(effectiveFacilityId, status)
                    : refundRequestRepository.countByStatus(status));
        }
        return counts;
    }

    @Override
    @Transactional
    public RefundRequestResponse updateBankAccount(UUID refundId, RefundBankAccountRequest request) {
        RefundRequest refund = refundRequestRepository.findById(refundId)
                .orElseThrow(() -> new AppException(ErrorCode.REFUND_REQUEST_NOT_FOUND));
        assertAccess(refund);
        if (refund.getStatus() != RefundStatus.PENDING_REVIEW && refund.getStatus() != RefundStatus.APPROVED) {
            throw new AppException(ErrorCode.REFUND_BANK_INFO_LOCKED);
        }
        validateBankFields(request.getBankName(), request.getBankAccountNumber(), request.getBankAccountName(), true);

        boolean hadAccount = !isBankInfoMissing(refund);
        refund.setBankName(request.getBankName().trim());
        refund.setBankAccountNumber(normalizeAccountNumber(request.getBankAccountNumber()));
        refund.setBankAccountName(request.getBankAccountName().trim());
        refund.setBankInfoUpdatedAt(LocalDateTime.now());
        refund = refundRequestRepository.save(refund);

        activityLogService.record(
                refund.getFacility() != null ? refund.getFacility().getId() : null,
                ActivityAction.REFUND_REQUEST_CREATE,
                "RefundRequest",
                refund.getId(),
                (hadAccount ? "Cập nhật" : "Bổ sung") + " tài khoản nhận hoàn tiền cho yêu cầu " + refund.getRequestCode()
                        + " (" + refund.getBankName() + " " + maskAccountNumber(refund.getBankAccountNumber()) + ")",
                null,
                refund.getStatus().name()
        );
        return toResponse(refund);
    }

    @Override
    @Transactional
    public RefundRequestResponse attachTransferEvidence(UUID refundId, MultipartFile file) {
        RefundRequest refund = refundRequestRepository.findById(refundId)
                .orElseThrow(() -> new AppException(ErrorCode.REFUND_REQUEST_NOT_FOUND));
        assertStaffAccess(refund);
        if (refund.getStatus() != RefundStatus.APPROVED && refund.getStatus() != RefundStatus.PROCESSING_TRANSFER
                && refund.getStatus() != RefundStatus.AWAITING_CUSTOMER_CONFIRMATION) {
            throw new AppException(ErrorCode.REFUND_INVALID_STATUS_TRANSITION, "Chỉ đính kèm minh chứng cho yêu cầu đã duyệt hoặc đang chuyển khoản.");
        }
        com.boxora.dto.response.FileUploadResponse stored = fileStorageService.storeDocument(file, "refunds");
        refund.setTransferEvidenceUrl(stored.getFileUrl());
        refund = refundRequestRepository.save(refund);
        return toResponse(refund);
    }

    // ------------------------------------------------------------------ helpers

    /** Customer: only their own refund. Staff roles: see {@link #assertStaffAccess}. */
    private void assertAccess(RefundRequest refund) {
        if ("CUSTOMER".equalsIgnoreCase(requestContext.currentUserRole())) {
            UUID currentUserId = requestContext.currentUserId();
            if (currentUserId == null || refund.getCustomer() == null || !currentUserId.equals(refund.getCustomer().getId())) {
                throw new AppException(ErrorCode.FORBIDDEN);
            }
            return;
        }
        assertStaffAccess(refund);
    }

    /**
     * Back-office refund actions (review, transfer, process, evidence, confirm on behalf, reconcile): never a
     * customer, and STAFF / FACILITY_MANAGER only for a refund of their assigned facility (fails closed when the
     * refund has no facility).
     */
    private void assertStaffAccess(RefundRequest refund) {
        if ("CUSTOMER".equalsIgnoreCase(requestContext.currentUserRole())) {
            throw new AppException(ErrorCode.FORBIDDEN);
        }
        if (facilityAccessGuard.isFacilityScoped()) {
            if (refund.getFacility() == null) {
                throw new AppException(ErrorCode.FACILITY_ACCESS_DENIED);
            }
            facilityAccessGuard.checkFacilityAccess(refund.getFacility().getId());
        }
    }

    private static String vnd(BigDecimal amount) {
        return com.boxora.util.VndFormat.format(amount);
    }

    private List<RefundStatus> parseStatuses(String statusCsv) {
        if (statusCsv == null || statusCsv.isBlank()) {
            return List.of();
        }
        List<RefundStatus> statuses = new ArrayList<>();
        for (String raw : statusCsv.split(",")) {
            String value = raw.trim();
            if (value.isEmpty()) {
                continue;
            }
            try {
                statuses.add(RefundStatus.valueOf(value.toUpperCase()));
            } catch (IllegalArgumentException ex) {
                throw new AppException(ErrorCode.REFUND_STATUS_FILTER_INVALID, "Trạng thái lọc yêu cầu hoàn tiền không hợp lệ: " + value);
            }
        }
        return statuses;
    }

    private static final java.util.Set<String> PLACEHOLDERS = java.util.Set.of(
            "", "N/A", "CHỜ_CẬP_NHẬT", "KHACH_HANG", "BANK_TRANSFER", "VNPAY_REFUND", "CASH", "CHUYỂN KHOẢN / VNPAY");

    /** True while no usable account exists: missing values or the placeholders older code stored. */
    static boolean isBankInfoMissing(RefundRequest refund) {
        String number = refund.getBankAccountNumber();
        String name = refund.getBankName();
        return number == null || PLACEHOLDERS.contains(number.trim().toUpperCase()) || !number.matches(".*\\d.*")
                || name == null || PLACEHOLDERS.contains(name.trim().toUpperCase())
                || refund.getBankAccountName() == null || refund.getBankAccountName().isBlank();
    }

    private void requireBankInfo(RefundRequest refund) {
        if (isBankInfoMissing(refund)) {
            throw new AppException(ErrorCode.REFUND_BANK_INFO_REQUIRED,
                    "Khách hàng chưa cung cấp tài khoản nhận hoàn tiền. Hãy liên hệ khách để bổ sung trước khi chuyển khoản.");
        }
    }

    /** All three bank fields together, account number 6-20 digits. {@code required}: the fields may not be empty. */
    private void validateBankFields(String bankName, String accountNumber, String accountName, boolean required) {
        boolean any = notBlank(bankName) || notBlank(accountNumber) || notBlank(accountName);
        if (!required && !any) {
            return;
        }
        if (!notBlank(bankName) || !notBlank(accountNumber) || !notBlank(accountName)) {
            throw new AppException(ErrorCode.REFUND_BANK_INFO_INVALID, "Vui lòng nhập đủ tên ngân hàng, số tài khoản và tên chủ tài khoản.");
        }
        String digits = normalizeAccountNumber(accountNumber);
        if (digits == null || !digits.matches("\\d{6,20}")) {
            throw new AppException(ErrorCode.REFUND_BANK_INFO_INVALID, "Số tài khoản chỉ gồm 6 đến 20 chữ số.");
        }
        if (bankName.trim().length() < 2 || accountName.trim().length() < 2) {
            throw new AppException(ErrorCode.REFUND_BANK_INFO_INVALID, "Tên ngân hàng và tên chủ tài khoản cần ít nhất 2 ký tự.");
        }
    }

    private String validateEvidenceUrl(String url) {
        String value = url.trim();
        if (!value.matches("^/uploads/refunds/[A-Za-z0-9._-]{1,120}$")) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Minh chứng chuyển khoản phải được tải lên hệ thống trước khi gửi.");
        }
        return value;
    }

    private static boolean notBlank(String value) {
        return value != null && !value.isBlank();
    }

    private static String trimToNull(String value) {
        return notBlank(value) ? value.trim() : null;
    }

    private static String normalizeAccountNumber(String value) {
        return notBlank(value) ? value.replaceAll("\\s+", "") : null;
    }

    private RefundRequestResponse toResponse(RefundRequest r) {
        return toResponse(r, new LinkedHashMap<>());
    }

    private RefundRequestResponse toResponse(RefundRequest r, Map<UUID, Integer> slaCache) {
        // Staff who execute the transfer need the real account; customers see it masked.
        boolean mask = "CUSTOMER".equalsIgnoreCase(requestContext.currentUserRole());
        boolean bankMissing = isBankInfoMissing(r);
        Integer slaDays = null;
        if (r.getFacility() != null) {
            slaDays = slaCache.computeIfAbsent(r.getFacility().getId(), facilityId -> facilityPolicyRepository
                    .findByFacility_IdAndIsActiveTrue(facilityId)
                    .map(FacilityPolicy::getDepositRefundSlaDays)
                    .orElse(null));
        }
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
                .unitCode(r.getBooking() != null && r.getBooking().getStorageUnit() != null ? r.getBooking().getStorageUnit().getUnitCode()
                        : r.getContract() != null && r.getContract().getUnit() != null ? r.getContract().getUnit().getUnitCode() : null)
                .contractId(r.getContract() != null ? r.getContract().getId() : null)
                .contractCode(r.getContract() != null ? r.getContract().getContractCode() : null)
                .requestedAmount(r.getRequestedAmount())
                .deductionAmount(r.getDeductionAmount())
                .finalRefundAmount(r.getFinalRefundAmount())
                .bankName(bankMissing ? null : r.getBankName())
                .bankAccountNumber(bankMissing ? null : (mask ? maskAccountNumber(r.getBankAccountNumber()) : r.getBankAccountNumber()))
                .bankAccountName(bankMissing ? null : r.getBankAccountName())
                .bankInfoMissing(bankMissing)
                .bankInfoUpdatedAt(r.getBankInfoUpdatedAt())
                .reason(r.getReason())
                .status(r.getStatus())
                .requestedById(r.getRequestedBy() != null ? r.getRequestedBy().getId() : null)
                .requestedByName(r.getRequestedBy() != null ? r.getRequestedBy().getFullName() : null)
                .createdAt(r.getCreatedAt())
                .updatedAt(r.getUpdatedAt())
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
                .transferInitiatedById(r.getTransferInitiatedBy() != null ? r.getTransferInitiatedBy().getId() : null)
                .transferInitiatedByName(r.getTransferInitiatedBy() != null ? r.getTransferInitiatedBy().getFullName() : null)
                .transferInitiatedAt(r.getTransferInitiatedAt())
                .transferReference(r.getTransferReference())
                .transferEvidenceUrl(r.getTransferEvidenceUrl())
                .customerConfirmedAt(r.getCustomerConfirmedAt())
                .customerConfirmationNotes(r.getCustomerConfirmationNotes())
                .reconciledById(r.getReconciledBy() != null ? r.getReconciledBy().getId() : null)
                .reconciledByName(r.getReconciledBy() != null ? r.getReconciledBy().getFullName() : null)
                .reconciledAt(r.getReconciledAt())
                .reconciliationNotes(r.getReconciliationNotes())
                .refundSlaDays(slaDays)
                .build();
    }

    private String maskAccountNumber(String accountNumber) {
        if (accountNumber == null || accountNumber.length() <= 4) return "****";
        return "****" + accountNumber.substring(accountNumber.length() - 4);
    }
}

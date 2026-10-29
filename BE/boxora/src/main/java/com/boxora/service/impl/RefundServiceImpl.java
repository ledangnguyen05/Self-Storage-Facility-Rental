package com.boxora.service.impl;

import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.*;
import com.boxora.dto.response.FileUploadResponse;
import com.boxora.dto.response.RefundRequestResponse;
import com.boxora.service.FileStorageService;
import org.springframework.web.multipart.MultipartFile;
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

    @Override
    public FileUploadResponse uploadProofImage(MultipartFile file) {
        return fileStorageService.storeFile(file, "refunds");
    }


    private final RefundRequestRepository refundRequestRepository;
    private final BookingRepository bookingRepository;
    private final RentalContractRepository rentalContractRepository;
    private final StorageUnitRepository storageUnitRepository;
    private final com.boxora.service.StorageUnitLockService storageUnitLockService;
    private final UserRepository userRepository;
    private final NotificationLogRepository notificationLogRepository;
    private final PaymentRepository paymentRepository;
    private final EmailService emailService;
    private final ActivityLogService activityLogService;
    private final FacilityAccessGuard facilityAccessGuard;
    private final RequestContext requestContext;
    private final FileStorageService fileStorageService;

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
                "Khởi tạo yêu cầu hoàn tiền " + refund.getRequestCode() + " với số tiền " + finalRefundAmount,
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
    public RefundRequestResponse startTransfer(UUID refundId, RefundTransferRequest request) {
        RefundRequest refund = refundRequestRepository.findById(refundId)
                .orElseThrow(() -> new AppException(ErrorCode.REFUND_REQUEST_NOT_FOUND));

        if (refund.getStatus() != RefundStatus.APPROVED) {
            throw new AppException(ErrorCode.REFUND_NOT_APPROVED, "Yêu cầu hoàn tiền phải ở trạng thái APPROVED mới được bắt đầu chuyển tiền");
        }

        if (refund.getFacility() != null && facilityAccessGuard.isFacilityScoped()) {
            facilityAccessGuard.checkFacilityAccess(refund.getFacility().getId());
        }

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

        if (refund.getStatus() == RefundStatus.PROCESSED || refund.getStatus() == RefundStatus.COMPLETED) {
            throw new AppException(ErrorCode.REFUND_ALREADY_PROCESSED);
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

        if (refund.getStatus() == RefundStatus.PENDING_REVIEW) {
            refund.setReviewedBy(processor);
            refund.setReviewedAt(LocalDateTime.now());
            refund.setReviewNote("Quản lý cơ sở đối soát và thực hiện chi trả hoàn tiền trực tiếp");
        } else if (refund.getStatus() != RefundStatus.APPROVED && refund.getStatus() != RefundStatus.PROCESSING_TRANSFER) {
            throw new AppException(ErrorCode.REFUND_NOT_APPROVED, "Yêu cầu hoàn tiền không ở trạng thái hợp lệ để chi trả");
        }

        RefundStatus oldStatus = refund.getStatus();
        // Sau khi kế toán/staff chuyển tiền và cung cấp mã giao dịch thực tế, chuyển sang AWAITING_CUSTOMER_CONFIRMATION
        refund.setStatus(RefundStatus.AWAITING_CUSTOMER_CONFIRMATION);
        refund.setProcessedBy(processor);
        refund.setProcessedAt(LocalDateTime.now());
        refund.setTransactionReference(request.getTransactionReference().trim());
        refund.setProcessNotes(request.getProcessNotes());
        if (request.getTransferProofUrl() != null && !request.getTransferProofUrl().isBlank()) {
            refund.setTransferProofUrl(request.getTransferProofUrl().trim());
        }

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
                        .paymentNotes(request.getProcessNotes())
                        .build();
            } else {
                refundPayment.setStatus(PaymentStatus.REFUNDED);
                refundPayment.setAmount(refund.getFinalRefundAmount());
                refundPayment.setConfirmedByStaff(processor);
                refundPayment.setConfirmedAt(LocalDateTime.now());
            }
            paymentRepository.save(refundPayment);
        }

        Booking linkedBooking = refund.getBooking();
        if (linkedBooking != null) {
            String logMsg = String.format("[%s] Quản lý cơ sở (%s) đã hoàn tất chuyển tiền hoàn cọc %s VNĐ vào STK %s (%s). Mã GD: %s\n",
                    LocalDateTime.now().format(java.time.format.DateTimeFormatter.ofPattern("HH:mm dd/MM/yyyy")),
                    processor.getFullName() != null ? processor.getFullName() : processor.getUsername(),
                    refund.getFinalRefundAmount() != null ? refund.getFinalRefundAmount().toPlainString() : "0",
                    refund.getBankAccountNumber(), refund.getBankName(), refund.getTransactionReference());
            linkedBooking.setStepTransitionHistory((linkedBooking.getStepTransitionHistory() != null ? linkedBooking.getStepTransitionHistory() : "") + logMsg);
            linkedBooking.setPaymentStatus("REFUNDED");
            linkedBooking.setStatus(BookingStatus.CANCELLED);
            linkedBooking.setHoldExpiresAt(null);
            linkedBooking.setPaymentExpiresAt(null);
            linkedBooking.setAccessPin(null);
            linkedBooking.setQrAccessToken("REVOKED_REFUNDED");
            bookingRepository.save(linkedBooking);
        }

        // Giải phóng ô kho vật lý và chấm dứt hợp đồng liên kết nếu có
        releaseUnitAndContractIfAny(refund, linkedBooking);

        User customer = refund.getCustomer();
        if (customer == null && refund.getBooking() != null) {
            customer = refund.getBooking().getCustomer();
        }

        String customerEmail = customer != null ? customer.getEmail() : null;
        String primaryEmail = (request.getRecipientEmail() != null && !request.getRecipientEmail().isBlank())
                ? request.getRecipientEmail().trim()
                : customerEmail;

        String customerName = customer != null && customer.getFullName() != null
                ? customer.getFullName()
                : (customer != null ? customer.getUsername() : "Quý khách");

        String bookingCode = refund.getBooking() != null ? refund.getBooking().getBookingCode() : null;
        String facilityName = refund.getFacility() != null ? refund.getFacility().getName()
                : (refund.getBooking() != null && refund.getBooking().getFacility() != null
                        ? refund.getBooking().getFacility().getName() : "Hệ thống Boxora");

        if (primaryEmail != null && !primaryEmail.isBlank()) {
            try {
                if (bookingCode != null && !bookingCode.isBlank()) {
                    emailService.sendBookingCancellationRefundSuccessEmail(
                            primaryEmail,
                            customerName,
                            bookingCode,
                            refund.getRequestCode(),
                            facilityName,
                            refund.getFinalRefundAmount(),
                            refund.getBankName(),
                            refund.getBankAccountNumber(),
                            refund.getBankAccountName(),
                            refund.getTransactionReference(),
                            refund.getTransferProofUrl(),
                            refund.getProcessNotes()
                    );
                    if (customerEmail != null && !customerEmail.isBlank() && !customerEmail.equalsIgnoreCase(primaryEmail)) {
                        emailService.sendBookingCancellationRefundSuccessEmail(
                                customerEmail,
                                customerName,
                                bookingCode,
                                refund.getRequestCode(),
                                facilityName,
                                refund.getFinalRefundAmount(),
                                refund.getBankName(),
                                refund.getBankAccountNumber(),
                                refund.getBankAccountName(),
                                refund.getTransactionReference(),
                                refund.getTransferProofUrl(),
                                refund.getProcessNotes()
                        );
                    }
                } else {
                    emailService.sendRefundStatusEmail(
                            primaryEmail,
                            customerName,
                            refund.getRequestCode(),
                            RefundStatus.AWAITING_CUSTOMER_CONFIRMATION.name(),
                            refund.getFinalRefundAmount(),
                            refund.getBankName(),
                            maskAccountNumber(refund.getBankAccountNumber()),
                            refund.getTransactionReference(),
                            refund.getProcessNotes()
                    );
                }
            } catch (Exception e) {
                log.warn("Failed to send refund processed email: {}", e.getMessage());
            }

            if (customer != null) {
                notificationLogRepository.save(NotificationLog.builder()
                        .recipient(customer)
                        .recipientEmail(primaryEmail)
                        .recipientName(customerName)
                        .facility(refund.getFacility())
                        .channel(NotificationChannel.IN_APP)
                        .notificationType(NotificationType.REFUND_PAYOUT_COMPLETED)
                        .referenceType("RefundRequest")
                        .referenceId(refund.getId())
                        .title("✓ Đã hoàn tiền đơn hủy #" + (bookingCode != null ? bookingCode : refund.getRequestCode()))
                        .content("Quản lý cơ sở " + facilityName + " đã hoàn tất chuyển khoản số tiền " + refund.getFinalRefundAmount() + " VNĐ vào tài khoản ngân hàng của quý khách. Mã GD: " + refund.getTransactionReference())
                        .status("SENT")
                        .build());
            }
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

        if (refund.getStatus() != RefundStatus.AWAITING_CUSTOMER_CONFIRMATION
                && refund.getStatus() != RefundStatus.PROCESSED) {
            throw new AppException(ErrorCode.REFUND_INVALID_STATUS_TRANSITION,
                    "Chỉ có thể xác nhận nhận tiền khi yêu cầu đang ở trạng thái AWAITING_CUSTOMER_CONFIRMATION hoặc PROCESSED");
        }

        UUID currentUserId = requestContext.currentUserId();
        String currentRole = requestContext.currentUserRole();
        if ("CUSTOMER".equalsIgnoreCase(currentRole)
                && (refund.getCustomer() == null || !refund.getCustomer().getId().equals(currentUserId))) {
            throw new AppException(ErrorCode.FORBIDDEN, "Bạn chỉ có thể xác nhận nhận tiền cho yêu cầu hoàn của chính mình");
        }

        RefundStatus oldStatus = refund.getStatus();
        refund.setStatus(RefundStatus.RECONCILED);
        refund.setCustomerConfirmedAt(LocalDateTime.now());
        if (request != null && request.getConfirmationNotes() != null) {
            refund.setCustomerConfirmationNotes(request.getConfirmationNotes().trim());
        }

        refund = refundRequestRepository.save(refund);

        releaseUnitAndContractIfAny(refund, refund.getBooking());

        activityLogService.record(
                refund.getFacility() != null ? refund.getFacility().getId() : null,
                ActivityAction.REFUND_CONFIRM,
                "RefundRequest",
                refund.getId(),
                "Khách hàng xác nhận đã nhận tiền cho yêu cầu " + refund.getRequestCode(),
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

        if (refund.getStatus() != RefundStatus.RECONCILED
                && refund.getStatus() != RefundStatus.AWAITING_CUSTOMER_CONFIRMATION
                && refund.getStatus() != RefundStatus.PROCESSED) {
            throw new AppException(ErrorCode.REFUND_INVALID_STATUS_TRANSITION,
                    "Yêu cầu hoàn tiền phải ở trạng thái RECONCILED hoặc PROCESSED mới có thể hoàn tất đối soát");
        }

        if (refund.getFacility() != null && facilityAccessGuard.isFacilityScoped()) {
            facilityAccessGuard.checkFacilityAccess(refund.getFacility().getId());
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

        releaseUnitAndContractIfAny(refund, refund.getBooking());

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
        boolean isPrivileged = requestContext.hasAnyRole("FACILITY_MANAGER", "STAFF", "BUSINESS_MANAGER", "ADMIN")
                || (requestContext.currentUserId() != null && r.getCustomer() != null && requestContext.currentUserId().equals(r.getCustomer().getId()));
        String bankAccountNum = isPrivileged ? r.getBankAccountNumber() : maskAccountNumber(r.getBankAccountNumber());

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
                .bankAccountNumber(bankAccountNum)
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
                .transferProofUrl(r.getTransferProofUrl())
                .transferInitiatedById(r.getTransferInitiatedBy() != null ? r.getTransferInitiatedBy().getId() : null)
                .transferInitiatedByName(r.getTransferInitiatedBy() != null ? r.getTransferInitiatedBy().getFullName() : null)
                .transferInitiatedAt(r.getTransferInitiatedAt())
                .transferReference(r.getTransferReference())
                .customerConfirmedAt(r.getCustomerConfirmedAt())
                .customerConfirmationNotes(r.getCustomerConfirmationNotes())
                .reconciledById(r.getReconciledBy() != null ? r.getReconciledBy().getId() : null)
                .reconciledByName(r.getReconciledBy() != null ? r.getReconciledBy().getFullName() : null)
                .reconciledAt(r.getReconciledAt())
                .reconciliationNotes(r.getReconciliationNotes())
                .build();
    }

    private void releaseUnitAndContractIfAny(RefundRequest refund, Booking linkedBooking) {
        if (refund == null) return;

        // 1. Tìm StorageUnit vật lý từ Booking hoặc Hợp đồng
        StorageUnit unitToRelease = null;
        if (linkedBooking != null && linkedBooking.getStorageUnit() != null) {
            unitToRelease = linkedBooking.getStorageUnit();
        } else if (refund.getContract() != null && refund.getContract().getUnit() != null) {
            unitToRelease = refund.getContract().getUnit();
        } else if (linkedBooking != null) {
            RentalContract contract = rentalContractRepository.findByBookingId(linkedBooking.getId()).orElse(null);
            if (contract != null && contract.getUnit() != null) {
                unitToRelease = contract.getUnit();
            }
        }

        // 2. Nếu tìm thấy StorageUnit, chuyển trạng thái về AVAILABLE và giải phóng khóa Redis/Memory
        if (unitToRelease != null) {
            UnitStatus oldUnitStatus = unitToRelease.getStatus();
            unitToRelease.setStatus(UnitStatus.AVAILABLE);
            storageUnitRepository.save(unitToRelease);
            try {
                storageUnitLockService.releaseLock(unitToRelease.getId());
            } catch (Exception ex) {
                log.warn("Notice: releaseLock error for unit {}: {}", unitToRelease.getId(), ex.getMessage());
            }

            UUID facId = unitToRelease.getFacility() != null ? unitToRelease.getFacility().getId()
                    : (refund.getFacility() != null ? refund.getFacility().getId() : null);

            activityLogService.record(
                    facId,
                    ActivityAction.STORAGE_UNIT_RELEASE,
                    "StorageUnit",
                    unitToRelease.getId(),
                    String.format("Giải phóng ngăn kho %s về trạng thái AVAILABLE sau khi chi trả hoàn tiền thành công cho đơn %s (Mã hoàn: %s)",
                            unitToRelease.getUnitCode(),
                            linkedBooking != null ? linkedBooking.getBookingCode() : "N/A",
                            refund.getRequestCode()),
                    oldUnitStatus != null ? oldUnitStatus.name() : null,
                    UnitStatus.AVAILABLE.name()
            );
        }

        // 3. Chấm dứt hợp đồng liên kết nếu chưa kết thúc
        RentalContract contractToTerminate = refund.getContract();
        if (contractToTerminate == null && linkedBooking != null) {
            contractToTerminate = rentalContractRepository.findByBookingId(linkedBooking.getId()).orElse(null);
        }
        if (contractToTerminate != null
                && contractToTerminate.getStatus() != RentalContractStatus.TERMINATED
                && contractToTerminate.getStatus() != RentalContractStatus.CANCELLED) {
            contractToTerminate.setStatus(RentalContractStatus.TERMINATED);
            rentalContractRepository.save(contractToTerminate);
        }
    }

    private String maskAccountNumber(String accountNumber) {
        if (accountNumber == null || accountNumber.length() <= 4) return "****";
        return "****" + accountNumber.substring(accountNumber.length() - 4);
    }
}

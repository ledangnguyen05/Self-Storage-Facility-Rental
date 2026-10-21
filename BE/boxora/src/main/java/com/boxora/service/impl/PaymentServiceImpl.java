package com.boxora.service.impl;

import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.PaymentCreateRequest;
import com.boxora.dto.response.ContractOutstandingResponse;
import com.boxora.dto.response.PaymentResponse;
import com.boxora.dto.response.VNPayIpnResponse;
import com.boxora.dto.response.VNPayPaymentResponse;
import com.boxora.entity.Booking;
import com.boxora.entity.Facility;
import com.boxora.entity.Payment;
import com.boxora.entity.RefundRequest;
import com.boxora.entity.RentalContract;
import com.boxora.entity.StorageUnit;
import com.boxora.entity.User;
import com.boxora.enums.ActivityAction;
import com.boxora.enums.BookingStatus;
import com.boxora.enums.PaymentStatus;
import com.boxora.enums.PaymentType;
import com.boxora.enums.RefundStatus;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.mapper.PaymentMapper;
import com.boxora.repository.BookingRepository;
import com.boxora.repository.PaymentRepository;
import com.boxora.repository.RefundRequestRepository;
import com.boxora.repository.RentalContractRepository;
import com.boxora.security.FacilityAccessGuard;
import com.boxora.security.RequestContext;
import com.boxora.service.ActivityLogService;
import com.boxora.service.ContractBillingService;
import com.boxora.service.ContractRenewalService;
import com.boxora.service.ContractSigningService;
import com.boxora.service.EmailService;
import com.boxora.service.PaymentService;
import com.boxora.service.StorageUnitLockService;
import com.boxora.service.VNPayService;
import com.boxora.util.VNPayUtil;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.NumberFormat;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * VNPay payments. Every amount is computed on the server:
 * <ul>
 *   <li>BOOKING_PAYMENT - first month + deposit of the booking (PricingService amounts stored on the booking)
 *       minus what was already paid; allowed for PENDING_PAYMENT bookings in their payment window and for
 *       CONFIRMED in-person holds that are not paid yet and not handed over.</li>
 *   <li>RENTAL_FEE - outstanding rent / overdue settlement of a contract ({@link ContractBillingService}).</li>
 *   <li>RENEWAL_FEE - created by the renewal flow ({@link ContractRenewalService}).</li>
 * </ul>
 * DEPOSIT and EXTRA_CHARGE are collected at the counter (handover manual payments), never online.
 */
@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class PaymentServiceImpl implements PaymentService {

    private static final DateTimeFormatter VNP_DATE_FORMAT = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");
    private static final Set<String> SORTABLE = Set.of("paymentTime", "amount", "createdAt", "status", "paymentType");
    private static final BigDecimal AMOUNT_TOLERANCE = BigDecimal.valueOf(1000);

    private final PaymentRepository paymentRepository;
    private final BookingRepository bookingRepository;
    private final PaymentMapper paymentMapper;
    private final VNPayService vnPayService;
    private final ActivityLogService activityLogService;
    private final RequestContext requestContext;
    private final FacilityAccessGuard facilityAccessGuard;
    private final ObjectProvider<ContractRenewalService> contractRenewalServiceProvider;
    private final ObjectProvider<ContractSigningService> contractSigningServiceProvider;
    private final ObjectProvider<ContractBillingService> contractBillingServiceProvider;
    private final ObjectProvider<EmailService> emailServiceProvider;
    private final StorageUnitLockService storageUnitLockService;
    private final RentalContractRepository rentalContractRepository;
    private final RefundRequestRepository refundRequestRepository;

    // =====================================================================================
    // Create
    // =====================================================================================

    @Override
    public VNPayPaymentResponse createVNPayPayment(PaymentCreateRequest request, HttpServletRequest httpRequest) {
        if (request.getBookingId() == null) {
            throw new AppException(ErrorCode.PAYMENT_TARGET_REQUIRED);
        }
        PaymentType type = request.getPaymentType() != null ? request.getPaymentType() : PaymentType.BOOKING_PAYMENT;
        if (type != PaymentType.BOOKING_PAYMENT) {
            throw new AppException(ErrorCode.PAYMENT_TYPE_NOT_ALLOWED, type == PaymentType.RENEWAL_FEE
                    ? "Phí gia hạn được thanh toán từ yêu cầu gia hạn trong mục Kho của tôi."
                    : type == PaymentType.RENTAL_FEE
                    ? "Tiền thuê được thanh toán từ mục Công nợ của hợp đồng trong cổng khách hàng."
                    : "Tiền cọc bổ sung và phụ phí được thu tại quầy của cơ sở.");
        }

        Booking booking = bookingRepository.findById(request.getBookingId())
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));
        assertBookingAccess(booking);

        BigDecimal amount = bookingPaymentDue(booking);
        if (request.getAmount() != null && request.getAmount().signum() > 0
                && request.getAmount().subtract(amount).abs().compareTo(AMOUNT_TOLERANCE) > 0) {
            log.warn("Booking {} payment amount changed: client={}, server={}", booking.getBookingCode(), request.getAmount(), amount);
            throw new AppException(ErrorCode.PAYMENT_AMOUNT_MISMATCH, "Số tiền cần thanh toán hiện là " + vnd(amount)
                    + ". Vui lòng tải lại trang và thử lại.");
        }

        expirePendingPayments(paymentRepository.findAllByBooking_IdAndStatusAndPaymentType(
                booking.getId(), PaymentStatus.PENDING, PaymentType.BOOKING_PAYMENT));

        String orderInfo = "Thanh toan dat kho " + booking.getBookingCode();
        Payment payment = Payment.builder()
                .transactionId(newTxnRef())
                .booking(booking)
                .contract(rentalContractRepository.findByBookingId(booking.getId()).orElse(null))
                .amount(amount)
                .paymentType(PaymentType.BOOKING_PAYMENT)
                .status(PaymentStatus.PENDING)
                .paymentMethod("VNPAY")
                .paymentTime(LocalDateTime.now())
                .build();
        payment = paymentRepository.save(payment);

        activityLogService.record(
                facilityIdOf(booking),
                ActivityAction.PAYMENT_INITIATED,
                "PAYMENT",
                payment.getId(),
                "Khởi tạo thanh toán VNPay cho đơn " + booking.getBookingCode() + ", số tiền " + vnd(amount),
                null,
                payment.getId()
        );

        String paymentUrl = buildPaymentUrl(payment, orderInfo, httpRequest);
        return VNPayPaymentResponse.builder()
                .paymentUrl(paymentUrl)
                .transactionId(payment.getTransactionId())
                .paymentId(payment.getId())
                .bookingId(booking.getId())
                .contractId(payment.getContract() != null ? payment.getContract().getId() : null)
                .amount(payment.getAmount())
                .orderInfo(orderInfo)
                .build();
    }

    /** Amount the customer still has to pay online for the booking's initial payment (first month + deposit). */
    BigDecimal bookingPaymentDue(Booking booking) {
        Instant now = Instant.now();
        BookingStatus status = booking.getStatus();
        if (status == BookingStatus.PENDING_PAYMENT || status == BookingStatus.PENDING_APPROVAL) {
            if (booking.getPaymentExpiresAt() == null || !booking.getPaymentExpiresAt().isAfter(now)) {
                throw new AppException(ErrorCode.BOOKING_PAYMENT_EXPIRED);
            }
        } else if (status == BookingStatus.CONFIRMED) {
            if (booking.getHandoverTime() != null) {
                throw new AppException(ErrorCode.PAYMENT_BOOKING_NOT_PAYABLE, "Kho đã được bàn giao. Các khoản tiếp theo được thanh toán theo hợp đồng.");
            }
            if ("PAID".equalsIgnoreCase(booking.getPaymentStatus())) {
                throw new AppException(ErrorCode.PAYMENT_ALREADY_PROCESSED, "Đơn đặt kho đã được thanh toán khoản ban đầu.");
            }
            if (booking.getHoldExpiresAt() != null && !booking.getHoldExpiresAt().isAfter(now)) {
                throw new AppException(ErrorCode.BOOKING_PAYMENT_EXPIRED, "Thời gian giữ chỗ của đơn đã kết thúc nên không thể thanh toán trực tuyến.");
            }
        } else {
            throw new AppException(ErrorCode.PAYMENT_BOOKING_NOT_PAYABLE);
        }

        BigDecimal initial = initialPaymentAmount(booking);
        BigDecimal paid = paymentRepository.findAllByBooking_Id(booking.getId()).stream()
                .filter(p -> p.getStatus() == PaymentStatus.PAID && p.getAmount() != null)
                .filter(p -> p.getPaymentType() == PaymentType.BOOKING_PAYMENT || p.getPaymentType() == PaymentType.DEPOSIT
                        || p.getPaymentType() == PaymentType.RENTAL_FEE)
                .map(Payment::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal due = initial.subtract(paid).setScale(0, RoundingMode.HALF_UP);
        if (due.signum() <= 0) {
            throw new AppException(ErrorCode.PAYMENT_ALREADY_PROCESSED, "Đơn đặt kho đã được thanh toán khoản ban đầu.");
        }
        return due;
    }

    /** Same formula as the pricing quote: first month of the discounted total + deposit. */
    static BigDecimal initialPaymentAmount(Booking booking) {
        BigDecimal deposit = booking.getDepositAmount() != null ? booking.getDepositAmount() : BigDecimal.ZERO;
        BigDecimal firstMonth = booking.getTotalRentalFee() != null && booking.getRentalMonths() != null && booking.getRentalMonths() > 0
                ? booking.getTotalRentalFee().divide(BigDecimal.valueOf(booking.getRentalMonths()), 2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;
        return firstMonth.add(deposit);
    }

    @Override
    public VNPayPaymentResponse createOutstandingPayment(UUID contractId, Integer upcomingMonths, HttpServletRequest httpRequest) {
        ContractBillingService billing = contractBillingServiceProvider.getObject();
        RentalContract contract = rentalContractRepository.findById(contractId)
                .orElseThrow(() -> new AppException(ErrorCode.CONTRACT_NOT_FOUND));
        billing.assertContractAccess(contract);

        ContractOutstandingResponse outstanding = billing.computeOutstanding(contract, java.time.LocalDate.now());
        if (!outstanding.isCanPayOnline()) {
            throw new AppException(ErrorCode.PAYMENT_NOT_DUE, outstanding.getBlockedReason());
        }
        int extra = upcomingMonths != null ? upcomingMonths : 0;
        if (extra < 0 || extra > outstanding.getRemainingTermMonths()) {
            throw new AppException(ErrorCode.INVALID_REQUEST, String.format(
                    "Có thể trả trước tối đa %d tháng còn lại của hợp đồng.", outstanding.getRemainingTermMonths()));
        }
        BigDecimal amount = outstanding.getTotalDueNow()
                .add(outstanding.getMonthlyRent().multiply(BigDecimal.valueOf(extra)))
                .setScale(0, RoundingMode.HALF_UP);
        if (amount.signum() <= 0) {
            throw new AppException(ErrorCode.PAYMENT_NOT_DUE);
        }

        expirePendingPayments(paymentRepository.findAllByContract_IdAndStatusAndPaymentType(
                contract.getId(), PaymentStatus.PENDING, PaymentType.RENTAL_FEE));

        String orderInfo = (outstanding.getOverdueDays() > 0 ? "Thanh toan cong no qua han hop dong " : "Thanh toan tien thue hop dong ")
                + (contract.getContractCode() != null ? contract.getContractCode() : contract.getId());
        return createContractPayment(contract, contract.getBooking(), PaymentType.RENTAL_FEE, amount, null,
                outstanding.getLateFee(), outstanding.getOverdueRent(), outstanding.getExtensionDays(), orderInfo, httpRequest);
    }

    @Override
    @Transactional
    public VNPayPaymentResponse createContractPayment(
            RentalContract contract, PaymentType type, BigDecimal amount,
            Integer renewalMonths, String orderInfo, HttpServletRequest httpRequest) {
        return createContractPayment(contract, null, type, amount, renewalMonths, BigDecimal.ZERO, BigDecimal.ZERO, 0, orderInfo, httpRequest);
    }

    @Override
    @Transactional
    public VNPayPaymentResponse createContractPayment(
            RentalContract contract, Booking booking, PaymentType type, BigDecimal amount, Integer renewalMonths,
            BigDecimal lateFeeAmount, BigDecimal overdueRentAmount, int extensionDays,
            String orderInfo, HttpServletRequest httpRequest) {
        if (amount == null || amount.signum() <= 0) {
            throw new AppException(ErrorCode.PAYMENT_AMOUNT_INVALID);
        }
        if (orderInfo == null || orderInfo.isBlank()) {
            orderInfo = "Thanh toan hop dong " + (contract.getContractCode() != null ? contract.getContractCode() : contract.getId());
        }

        Payment payment = Payment.builder()
                .transactionId(newTxnRef())
                .contract(contract)
                .booking(booking)
                .amount(amount.setScale(0, RoundingMode.HALF_UP))
                .paymentType(type)
                .renewalMonths(renewalMonths)
                .lateFeeAmount(lateFeeAmount != null ? lateFeeAmount : BigDecimal.ZERO)
                .overdueRentAmount(overdueRentAmount != null ? overdueRentAmount : BigDecimal.ZERO)
                .extensionDays(Math.max(0, extensionDays))
                .status(PaymentStatus.PENDING)
                .paymentMethod("VNPAY")
                .paymentTime(LocalDateTime.now())
                .build();
        payment = paymentRepository.save(payment);

        UUID facilityId = contract.getFacility() != null ? contract.getFacility().getId() : null;
        activityLogService.record(
                facilityId,
                ActivityAction.PAYMENT_INITIATED,
                "PAYMENT",
                payment.getId(),
                "Khởi tạo thanh toán VNPay " + paymentTypeLabel(type) + " cho hợp đồng " + contract.getContractCode() + ", số tiền " + vnd(payment.getAmount()),
                null,
                payment.getId()
        );

        String paymentUrl = buildPaymentUrl(payment, orderInfo, httpRequest);
        return VNPayPaymentResponse.builder()
                .paymentUrl(paymentUrl)
                .transactionId(payment.getTransactionId())
                .paymentId(payment.getId())
                .bookingId(booking != null ? booking.getId() : null)
                .contractId(contract.getId())
                .amount(payment.getAmount())
                .orderInfo(orderInfo)
                .build();
    }

    private String buildPaymentUrl(Payment payment, String orderInfo, HttpServletRequest httpRequest) {
        String ipAddress = null;
        if (httpRequest != null) {
            ipAddress = httpRequest.getHeader("X-Forwarded-For");
            if (ipAddress == null || ipAddress.isBlank()) {
                ipAddress = httpRequest.getRemoteAddr();
            }
        }
        if (ipAddress == null || ipAddress.isBlank()) {
            ipAddress = requestContext.currentIpAddress();
        }
        try {
            return vnPayService.createPaymentUrl(payment.getTransactionId(), payment.getAmount(), orderInfo, VNPayUtil.normalizeIp(ipAddress));
        } catch (AppException e) {
            throw e;
        } catch (Exception e) {
            log.error("Cannot build VNPay URL for {}: {}", payment.getTransactionId(), e.getMessage());
            throw new AppException(ErrorCode.PAYMENT_GATEWAY_UNAVAILABLE);
        }
    }

    private void expirePendingPayments(List<Payment> pending) {
        for (Payment old : pending) {
            old.setStatus(PaymentStatus.EXPIRED);
            paymentRepository.save(old);
        }
    }

    /**
     * A VNPay link expires 15 minutes after it was created (vnp_ExpireDate). A payment still PENDING an hour later
     * was abandoned: it is marked EXPIRED so the portal stops listing it as "waiting for payment". A late gateway
     * callback for it is still applied (EXPIRED is not a settled state).
     */
    @org.springframework.scheduling.annotation.Scheduled(fixedDelay = 600_000L, initialDelay = 120_000L)
    public void expireAbandonedOnlinePayments() {
        List<Payment> stale = paymentRepository.findAllByStatusAndPaymentMethodAndPaymentTimeBefore(
                PaymentStatus.PENDING, "VNPAY", LocalDateTime.now().minusHours(1));
        for (Payment payment : stale) {
            payment.setStatus(PaymentStatus.EXPIRED);
            paymentRepository.save(payment);
        }
        if (!stale.isEmpty()) {
            log.info("[PAYMENT_EXPIRE] Marked {} abandoned VNPay payment(s) as EXPIRED", stale.size());
        }
    }

    // =====================================================================================
    // VNPay callbacks
    // =====================================================================================

    @Override
    public PaymentResponse processVNPayReturn(Map<String, String> params) {
        if (!vnPayService.verifySignature(params)) {
            log.warn("VNPay return callback signature invalid: {}", params);
            throw new AppException(ErrorCode.INVALID_PAYMENT_SIGNATURE);
        }

        String txnRef = params.get("vnp_TxnRef");
        Payment payment = paymentRepository.findByTransactionId(txnRef)
                .orElseThrow(() -> new AppException(ErrorCode.PAYMENT_NOT_FOUND));

        if (!amountMatches(payment, params.get("vnp_Amount"))) {
            throw new AppException(ErrorCode.PAYMENT_AMOUNT_MISMATCH);
        }

        // Idempotent: the IPN may already have settled this payment.
        if (payment.getStatus() == PaymentStatus.PAID || payment.getStatus() == PaymentStatus.REFUND_PENDING
                || payment.getStatus() == PaymentStatus.REFUNDED) {
            log.info("Payment with txnRef={} already settled ({}).", txnRef, payment.getStatus());
            return paymentMapper.toResponse(payment);
        }

        settle(payment, params, false);
        payment = paymentRepository.save(payment);
        return paymentMapper.toResponse(payment);
    }

    @Override
    public VNPayIpnResponse processVNPayIPN(Map<String, String> params) {
        if (!vnPayService.verifySignature(params)) {
            log.warn("VNPay IPN checksum verification failed for params: {}", params);
            return VNPayIpnResponse.invalidSignature();
        }

        String txnRef = params.get("vnp_TxnRef");
        Optional<Payment> optPayment = paymentRepository.findByTransactionId(txnRef);
        if (optPayment.isEmpty()) {
            log.warn("VNPay IPN order not found: txnRef={}", txnRef);
            return VNPayIpnResponse.orderNotFound();
        }
        Payment payment = optPayment.get();

        if (!amountMatches(payment, params.get("vnp_Amount"))) {
            log.warn("VNPay IPN amount mismatch for txnRef={}. DB={}, VNPay={}", txnRef, payment.getAmount(), params.get("vnp_Amount"));
            return VNPayIpnResponse.invalidAmount();
        }
        if (payment.getStatus() == PaymentStatus.PAID || payment.getStatus() == PaymentStatus.REFUND_PENDING
                || payment.getStatus() == PaymentStatus.REFUNDED) {
            return VNPayIpnResponse.alreadyConfirmed();
        }

        settle(payment, params, true);
        paymentRepository.save(payment);
        return VNPayIpnResponse.success();
    }

    private boolean amountMatches(Payment payment, String amountStr) {
        if (amountStr == null || amountStr.isBlank()) {
            return true;
        }
        try {
            BigDecimal vnpAmount = new BigDecimal(amountStr).divide(BigDecimal.valueOf(100));
            return payment.getAmount().compareTo(vnpAmount) == 0;
        } catch (NumberFormatException e) {
            return false;
        }
    }

    /** Applies the gateway result to the payment and to what it pays for. */
    private void settle(Payment payment, Map<String, String> params, boolean fromIpn) {
        String responseCode = params.get("vnp_ResponseCode");
        String transactionStatus = params.get("vnp_TransactionStatus");
        String payDateStr = params.get("vnp_PayDate");
        if (payDateStr != null && payDateStr.length() == 14) {
            try {
                payment.setPaymentTime(LocalDateTime.parse(payDateStr, VNP_DATE_FORMAT));
            } catch (Exception e) {
                payment.setPaymentTime(LocalDateTime.now());
            }
        }
        boolean isSuccess = "00".equals(responseCode) && ("00".equals(transactionStatus) || transactionStatus == null);
        String txnRef = payment.getTransactionId();
        UUID facilityId = extractFacilityId(payment);
        payment.setGatewayResponseCode(truncate(responseCode, 10));
        payment.setGatewayTransactionStatus(truncate(transactionStatus, 10));

        if (!isSuccess) {
            payment.setStatus(PaymentStatus.FAILED);
            String reason = com.boxora.util.VNPayResponseCodes.failureReason(responseCode, transactionStatus);
            String description = "Thanh toán VNPay không thành công cho giao dịch " + txnRef
                    + (reason != null ? ": " + reason : " (mã " + responseCode + ").");
            if (fromIpn) {
                activityLogService.recordSystem(facilityId, ActivityAction.PAYMENT_FAILED, "PAYMENT", payment.getId(), description);
            } else {
                activityLogService.record(facilityId, ActivityAction.PAYMENT_FAILED, "PAYMENT", payment.getId(), description,
                        PaymentStatus.PENDING, PaymentStatus.FAILED);
            }
            return;
        }

        payment.setStatus(PaymentStatus.PAID);
        switch (payment.getPaymentType()) {
            case BOOKING_PAYMENT, DEPOSIT -> applyBookingPayment(payment);
            case RENTAL_FEE -> {
                paymentRepository.save(payment);
                contractBillingServiceProvider.getObject().applyRentalPayment(payment);
            }
            case RENEWAL_FEE -> {
                paymentRepository.save(payment);
                ContractRenewalService renewalService = contractRenewalServiceProvider.getIfAvailable();
                if (renewalService != null) {
                    renewalService.handleRenewalPaid(payment);
                }
            }
            default -> log.info("Payment {} of type {} recorded without side effects", txnRef, payment.getPaymentType());
        }

        if (payment.getStatus() == PaymentStatus.PAID) {
            String description = "Thanh toán VNPay thành công " + vnd(payment.getAmount()) + " cho " + describeTarget(payment) + ", mã GD " + txnRef;
            if (fromIpn) {
                activityLogService.recordSystem(facilityId, ActivityAction.PAYMENT_CONFIRMED, "PAYMENT", payment.getId(), description);
            } else {
                activityLogService.record(facilityId, ActivityAction.PAYMENT_CONFIRMED, "PAYMENT", payment.getId(), description,
                        PaymentStatus.PENDING, PaymentStatus.PAID);
            }
            sendReceipt(payment);
        }
    }

    /**
     * Initial payment of a booking. A payment that arrives after the booking was cancelled / expired is
     * kept as REFUND_PENDING and a refund request is opened so the money can be returned.
     */
    private void applyBookingPayment(Payment payment) {
        Booking booking = payment.getBooking();
        if (booking == null) {
            return;
        }
        booking = bookingRepository.findByIdForUpdate(booking.getId()).orElse(booking);

        if (booking.getStatus() == BookingStatus.CANCELLED || booking.getStatus() == BookingStatus.COMPLETED) {
            log.warn("[PAYMENT_EXPIRED] Payment {} received after booking {} was {}. Flagged for refund.",
                    payment.getTransactionId(), booking.getBookingCode(), booking.getStatus());
            payment.setStatus(PaymentStatus.REFUND_PENDING);
            paymentRepository.save(payment);
            openLatePaymentRefund(payment, booking);
            return;
        }

        boolean wasPending = booking.getStatus() == BookingStatus.PENDING_PAYMENT || booking.getStatus() == BookingStatus.PENDING_APPROVAL;
        if (wasPending) {
            booking.setStatus(BookingStatus.CONFIRMED);
            booking.setPaymentExpiresAt(null);
            booking.setHoldExpiresAt(null);
        }
        BigDecimal currentDeposit = booking.getDepositPaid() != null ? booking.getDepositPaid() : BigDecimal.ZERO;
        if (payment.getPaymentType() == PaymentType.BOOKING_PAYMENT) {
            BigDecimal required = booking.getDepositAmount() != null ? booking.getDepositAmount() : BigDecimal.ZERO;
            booking.setDepositPaid(currentDeposit.max(required));
            booking.setPaymentStatus("PAID");
        } else {
            booking.setDepositPaid(currentDeposit.add(payment.getAmount()));
            booking.setPaymentStatus("PARTIALLY_PAID");
        }
        if (wasPending && booking.getStorageUnit() != null) {
            storageUnitLockService.releaseLock(booking.getStorageUnit().getId());
        }
        // PIN / QR are issued only at the physical check-in (BR-RULE-005), never at payment time.
        bookingRepository.save(booking);

        ContractSigningService contractSigningService = contractSigningServiceProvider.getIfAvailable();
        if (contractSigningService != null) {
            try {
                contractSigningService.ensureContractForBooking(booking);
            } catch (Exception ex) {
                log.warn("Cannot ensure contract for booking {}: {}", booking.getBookingCode(), ex.getMessage());
            }
        }
        ContractBillingService billing = contractBillingServiceProvider.getIfAvailable();
        if (billing != null) {
            billing.syncContractDeposit(booking);
        }
    }

    private void openLatePaymentRefund(Payment payment, Booking booking) {
        Facility facility = booking.getStorageUnit() != null ? booking.getStorageUnit().getFacility() : null;
        User customer = booking.getCustomer();
        if (facility == null || customer == null) {
            log.warn("Cannot open refund for late payment {}: missing facility or customer", payment.getTransactionId());
            return;
        }
        String marker = "giao dịch " + payment.getTransactionId();
        boolean exists = refundRequestRepository.findByBookingId(booking.getId()).stream()
                .anyMatch(r -> r.getReason() != null && r.getReason().contains(marker));
        if (exists) {
            return;
        }
        RefundRequest refund = RefundRequest.builder()
                .requestCode("REF-" + System.currentTimeMillis() + "-" + VNPayUtil.randomAlphaNumeric(4).toUpperCase())
                .customer(customer)
                .facility(facility)
                .booking(booking)
                .contract(rentalContractRepository.findByBookingId(booking.getId()).orElse(null))
                .requestedAmount(payment.getAmount())
                .deductionAmount(BigDecimal.ZERO)
                .finalRefundAmount(payment.getAmount())
                .reason("Hoàn tiền " + marker + " (VNPay) được thanh toán sau khi đơn " + booking.getBookingCode() + " đã hủy hoặc hết hạn giữ chỗ")
                .status(RefundStatus.PENDING_REVIEW)
                .requestedBy(customer)
                .build();
        refund = refundRequestRepository.save(refund);
        activityLogService.recordSystem(facility.getId(), ActivityAction.REFUND_REQUEST_CREATE, "RefundRequest", refund.getId(),
                "Tự động mở yêu cầu hoàn tiền " + refund.getRequestCode() + " cho khoản thanh toán đến sau khi đơn "
                        + booking.getBookingCode() + " đã hủy");
    }

    private void sendReceipt(Payment payment) {
        try {
            User customer = payment.getBooking() != null ? payment.getBooking().getCustomer()
                    : payment.getContract() != null ? payment.getContract().getCustomer() : null;
            EmailService emailService = emailServiceProvider.getIfAvailable();
            if (customer == null || customer.getEmail() == null || emailService == null) {
                return;
            }
            emailService.sendPaymentSuccessEmail(customer.getEmail(),
                    customer.getFullName() != null ? customer.getFullName() : customer.getUsername(),
                    payment.getTransactionId(), payment.getAmount(), describeTarget(payment));
        } catch (Exception e) {
            log.warn("Payment receipt email for {} not sent: {}", payment.getTransactionId(), e.getMessage());
        }
    }

    // =====================================================================================
    // Read
    // =====================================================================================

    @Override
    @Transactional(readOnly = true)
    public PaymentResponse getById(UUID id) {
        Payment payment = paymentRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.PAYMENT_NOT_FOUND));
        assertPaymentAccess(payment);
        return paymentMapper.toResponse(payment);
    }

    @Override
    @Transactional(readOnly = true)
    public PaymentResponse getByTransactionId(String transactionId) {
        Payment payment = paymentRepository.findByTransactionId(transactionId)
                .orElseThrow(() -> new AppException(ErrorCode.PAYMENT_NOT_FOUND));
        assertPaymentAccess(payment);
        return paymentMapper.toResponse(payment);
    }

    @Override
    @Transactional(readOnly = true)
    public List<PaymentResponse> getByBookingId(UUID bookingId) {
        if (bookingId == null) {
            throw new AppException(ErrorCode.BOOKING_NOT_FOUND);
        }
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));
        assertBookingAccess(booking);
        return paymentRepository.findAllByBooking_Id(bookingId).stream().map(paymentMapper::toResponse).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<PaymentResponse> getMyPayments() {
        UUID currentUserId = requestContext.currentUserId();
        if (currentUserId == null) {
            return List.of();
        }
        Specification<Payment> spec = (root, query, cb) -> {
            query.orderBy(cb.desc(cb.coalesce(root.get("paymentTime"), root.get("createdAt"))));
            Join<Payment, Booking> bookingJoin = root.join("booking", JoinType.LEFT);
            Join<Payment, RentalContract> contractJoin = root.join("contract", JoinType.LEFT);
            return cb.or(
                    cb.equal(bookingJoin.get("customer").get("id"), currentUserId),
                    cb.equal(contractJoin.get("customer").get("id"), currentUserId)
            );
        };
        return paymentRepository.findAll(spec).stream().map(paymentMapper::toResponse).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<PaymentResponse> getAll(
            UUID bookingId, UUID facilityId, UUID customerId, PaymentStatus status, PaymentType paymentType,
            LocalDateTime fromDate, LocalDateTime toDate, int page, int size, String sortBy, String sortDir) {
        String sortField = sortBy != null && SORTABLE.contains(sortBy) ? sortBy : "paymentTime";
        Sort sort = "asc".equalsIgnoreCase(sortDir) ? Sort.by(sortField).ascending() : Sort.by(sortField).descending();
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 500), sort);

        UUID scopedFacilityId = facilityId;
        if (facilityAccessGuard.isFacilityScoped()) {
            scopedFacilityId = facilityAccessGuard.scopedFacilityIdOrNull();
        }
        UUID effectiveCustomerId = customerId;
        if ("CUSTOMER".equalsIgnoreCase(requestContext.currentUserRole())) {
            effectiveCustomerId = requestContext.currentUserId();
        }
        final UUID queryFacilityId = scopedFacilityId;
        final UUID queryCustomerId = effectiveCustomerId;

        Specification<Payment> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            Join<Payment, Booking> bookingJoin = root.join("booking", JoinType.LEFT);
            Join<Booking, StorageUnit> suJoin = bookingJoin.join("storageUnit", JoinType.LEFT);
            Join<Payment, RentalContract> contractJoin = root.join("contract", JoinType.LEFT);
            if (queryFacilityId != null) {
                predicates.add(cb.or(
                        cb.equal(suJoin.get("facility").get("id"), queryFacilityId),
                        cb.equal(contractJoin.get("facility").get("id"), queryFacilityId)
                ));
            }
            if (queryCustomerId != null) {
                predicates.add(cb.or(
                        cb.equal(bookingJoin.get("customer").get("id"), queryCustomerId),
                        cb.equal(contractJoin.get("customer").get("id"), queryCustomerId)
                ));
            }
            if (bookingId != null) {
                predicates.add(cb.equal(root.get("booking").get("id"), bookingId));
            }
            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            if (paymentType != null) {
                predicates.add(cb.equal(root.get("paymentType"), paymentType));
            }
            if (fromDate != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("paymentTime"), fromDate));
            }
            if (toDate != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("paymentTime"), toDate));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };

        Page<Payment> result = paymentRepository.findAll(spec, pageable);
        return PageResponse.from(result.map(paymentMapper::toResponse));
    }

    // =====================================================================================
    // Helpers
    // =====================================================================================

    private void assertBookingAccess(Booking booking) {
        if ("CUSTOMER".equalsIgnoreCase(requestContext.currentUserRole())) {
            UUID currentUserId = requestContext.currentUserId();
            if (currentUserId == null || booking.getCustomer() == null || !currentUserId.equals(booking.getCustomer().getId())) {
                throw new AppException(ErrorCode.FORBIDDEN);
            }
            return;
        }
        if (facilityAccessGuard.isFacilityScoped()) {
            UUID facilityId = facilityIdOf(booking);
            if (facilityId != null) {
                facilityAccessGuard.checkFacilityAccess(facilityId);
            }
        }
    }

    private void assertPaymentAccess(Payment payment) {
        if ("CUSTOMER".equalsIgnoreCase(requestContext.currentUserRole())) {
            UUID currentUserId = requestContext.currentUserId();
            User owner = payment.getBooking() != null ? payment.getBooking().getCustomer()
                    : payment.getContract() != null ? payment.getContract().getCustomer() : null;
            if (currentUserId == null || owner == null || !currentUserId.equals(owner.getId())) {
                throw new AppException(ErrorCode.FORBIDDEN);
            }
            return;
        }
        if (facilityAccessGuard.isFacilityScoped()) {
            UUID facilityId = extractFacilityId(payment);
            if (facilityId != null) {
                facilityAccessGuard.checkFacilityAccess(facilityId);
            }
        }
    }

    private UUID facilityIdOf(Booking booking) {
        return booking.getStorageUnit() != null && booking.getStorageUnit().getFacility() != null
                ? booking.getStorageUnit().getFacility().getId() : null;
    }

    private UUID extractFacilityId(Payment payment) {
        if (payment == null) return null;
        if (payment.getContract() != null && payment.getContract().getFacility() != null) {
            return payment.getContract().getFacility().getId();
        }
        if (payment.getBooking() != null) {
            return facilityIdOf(payment.getBooking());
        }
        return null;
    }

    private String describeTarget(Payment payment) {
        if (payment.getPaymentType() == PaymentType.RENEWAL_FEE && payment.getContract() != null) {
            return "phí gia hạn hợp đồng " + payment.getContract().getContractCode();
        }
        if (payment.getPaymentType() == PaymentType.RENTAL_FEE && payment.getContract() != null) {
            return "tiền thuê hợp đồng " + payment.getContract().getContractCode();
        }
        if (payment.getBooking() != null) {
            return "đơn đặt kho " + payment.getBooking().getBookingCode();
        }
        return payment.getContract() != null ? "hợp đồng " + payment.getContract().getContractCode() : "giao dịch " + payment.getTransactionId();
    }

    private static String truncate(String value, int max) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.length() > max ? trimmed.substring(0, max) : trimmed;
    }

    private static String newTxnRef() {
        return "BOX" + System.currentTimeMillis() + VNPayUtil.randomAlphaNumeric(6);
    }

    private static String vnd(BigDecimal amount) {
        return com.boxora.util.VndFormat.format(amount);
    }

    private static String paymentTypeLabel(PaymentType type) {
        if (type == null) {
            return "";
        }
        return switch (type) {
            case BOOKING_PAYMENT -> "khoản đặt kho";
            case DEPOSIT -> "tiền cọc";
            case RENTAL_FEE -> "tiền thuê";
            case RENEWAL_FEE -> "phí gia hạn";
            case EXTRA_CHARGE -> "phụ phí";
        };
    }
}

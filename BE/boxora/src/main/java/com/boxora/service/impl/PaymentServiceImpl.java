package com.boxora.service.impl;

import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.PaymentCreateRequest;
import com.boxora.dto.response.PaymentResponse;
import com.boxora.dto.response.VNPayIpnResponse;
import com.boxora.dto.response.VNPayPaymentResponse;
import com.boxora.entity.Booking;
import com.boxora.entity.Payment;
import com.boxora.entity.RentalContract;
import com.boxora.entity.StorageUnit;
import com.boxora.enums.ActivityAction;
import com.boxora.enums.BookingStatus;
import com.boxora.enums.PaymentStatus;
import com.boxora.enums.PaymentType;
import com.boxora.enums.UnitStatus;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.mapper.PaymentMapper;
import com.boxora.repository.BookingRepository;
import com.boxora.repository.PaymentRepository;
import com.boxora.repository.RentalContractRepository;
import com.boxora.repository.StorageUnitRepository;
import com.boxora.security.RequestContext;
import com.boxora.service.ActivityLogService;
import com.boxora.service.ContractRenewalService;
import com.boxora.service.PaymentService;
import com.boxora.service.VNPayService;
import com.boxora.entity.StorageUnit;
import com.boxora.util.VNPayUtil;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import jakarta.servlet.http.HttpServletRequest;
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
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class PaymentServiceImpl implements PaymentService {

    private static final DateTimeFormatter VNP_DATE_FORMAT = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");
    private static final java.security.SecureRandom SECURE_RANDOM = new java.security.SecureRandom();

    private final PaymentRepository paymentRepository;
    private final BookingRepository bookingRepository;
    private final StorageUnitRepository storageUnitRepository;
    private final PaymentMapper paymentMapper;
    private final VNPayService vnPayService;
    private final ActivityLogService activityLogService;
    private final RequestContext requestContext;
    private final com.boxora.security.FacilityAccessGuard facilityAccessGuard;
    private final org.springframework.beans.factory.ObjectProvider<com.boxora.service.ContractRenewalService> contractRenewalServiceProvider;
    private final org.springframework.beans.factory.ObjectProvider<com.boxora.service.ContractSigningService> contractSigningServiceProvider;
    private final com.boxora.service.StorageUnitLockService storageUnitLockService;
    private final com.boxora.repository.RefundRequestRepository refundRequestRepository;

    private UUID extractFacilityId(Payment payment) {
        if (payment == null) return null;
        if (payment.getContract() != null && payment.getContract().getFacility() != null) {
            return payment.getContract().getFacility().getId();
        }
        if (payment.getBooking() != null && payment.getBooking().getStorageUnit() != null && payment.getBooking().getStorageUnit().getFacility() != null) {
            return payment.getBooking().getStorageUnit().getFacility().getId();
        }
        return null;
    }

    public record BookingPaymentSummary(
            BigDecimal requiredDeposit,
            BigDecimal requiredFirstMonthRent,
            BigDecimal requiredTotalInitial,
            BigDecimal effectiveDepositPaid,
            BigDecimal effectiveRentPaid,
            BigDecimal depositRemaining,
            BigDecimal rentRemaining,
            BigDecimal totalInitialRemaining,
            boolean hasAnyConfirmedPayment,
            boolean isFullyPaid,
            String resolvedPaymentStatus,
            boolean hasPendingRefund,
            String refundConfirmationLevel
    ) {}

    private boolean isMutatedOriginalIncomingPayment(Payment p) {
        if (p == null) return false;
        if ("VNPAY".equalsIgnoreCase(p.getPaymentMethod()) || "CASH".equalsIgnoreCase(p.getPaymentMethod())) {
            return true;
        }
        if (p.getReceiptVoucherCode() != null || p.getCollectedByStaff() != null) {
            return true;
        }
        String txId = p.getTransactionId();
        if (txId != null) {
            String upper = txId.trim().toUpperCase();
            if (upper.startsWith("BOX") || upper.startsWith("CASH-") || upper.startsWith("BANK-")) {
                return true;
            }
        }
        return false;
    }

    private boolean hasActiveOrCompletedRefundRequest(Booking booking) {
        if (booking == null || booking.getId() == null || refundRequestRepository == null) {
            return false;
        }
        return refundRequestRepository.existsByBooking_IdAndStatusIn(
                booking.getId(),
                List.of(
                        com.boxora.enums.RefundStatus.PENDING_REVIEW,
                        com.boxora.enums.RefundStatus.APPROVED,
                        com.boxora.enums.RefundStatus.PROCESSING_TRANSFER,
                        com.boxora.enums.RefundStatus.AWAITING_CUSTOMER_CONFIRMATION,
                        com.boxora.enums.RefundStatus.RECONCILED,
                        com.boxora.enums.RefundStatus.PROCESSED,
                        com.boxora.enums.RefundStatus.COMPLETED
                )
        );
    }

    private boolean isRefundBankReconciled(Booking booking) {
        if (booking == null || booking.getId() == null || refundRequestRepository == null) {
            return false;
        }
        return refundRequestRepository.existsByBooking_IdAndStatusIn(
                booking.getId(),
                List.of(
                        com.boxora.enums.RefundStatus.RECONCILED,
                        com.boxora.enums.RefundStatus.COMPLETED
                )
        );
    }

    public BookingPaymentSummary calculateBookingPaymentSummary(Booking booking, List<Payment> payments) {
        StorageUnit unit = booking.getStorageUnit();
        BigDecimal requiredDeposit = booking.getDepositAmount() != null && booking.getDepositAmount().compareTo(BigDecimal.ZERO) > 0
                ? booking.getDepositAmount()
                : (unit != null && unit.getUnitType() != null && unit.getUnitType().getDepositAmount() != null
                        ? unit.getUnitType().getDepositAmount()
                        : BigDecimal.ZERO);

        BigDecimal requiredFirstMonthRent = booking.getTotalRentalFee() != null && booking.getRentalMonths() != null && booking.getRentalMonths() > 0
                ? booking.getTotalRentalFee().divide(BigDecimal.valueOf(booking.getRentalMonths()), 2, java.math.RoundingMode.HALF_UP)
                : (booking.getTotalRentalFee() != null && booking.getTotalRentalFee().compareTo(BigDecimal.ZERO) > 0
                        ? booking.getTotalRentalFee()
                        : BigDecimal.ZERO);

        BigDecimal requiredTotalInitial = requiredDeposit.add(requiredFirstMonthRent);

        BigDecimal paidDepositFromTx = BigDecimal.ZERO;
        BigDecimal paidRentFromTx = BigDecimal.ZERO;
        BigDecimal paidBookingFromTx = BigDecimal.ZERO;
        BigDecimal refundedDepositFromTx = BigDecimal.ZERO;
        BigDecimal refundedRentFromTx = BigDecimal.ZERO;
        BigDecimal refundedBookingFromTx = BigDecimal.ZERO;

        boolean hasRefundPendingTx = false;
        boolean hasRefundedOrRefundPendingDepositTx = false;
        List<Payment> refundedPayments = new ArrayList<>();

        if (payments != null) {
            for (Payment p : payments) {
                if (p == null || p.getAmount() == null || p.getAmount().compareTo(BigDecimal.ZERO) <= 0) {
                    continue;
                }
                // Ignore payments belonging to another booking
                if (booking.getId() != null && p.getBooking() != null && p.getBooking().getId() != null
                        && !booking.getId().equals(p.getBooking().getId())) {
                    continue;
                }
                PaymentType pt = p.getPaymentType();
                // Only include initial booking payment obligations (exclude RENEWAL_FEE or unrelated obligations)
                if (pt != PaymentType.DEPOSIT && pt != PaymentType.RENTAL_FEE && pt != PaymentType.BOOKING_PAYMENT) {
                    continue;
                }

                PaymentStatus st = p.getStatus();
                if (st == PaymentStatus.PAID) {
                    if (pt == PaymentType.DEPOSIT) {
                        paidDepositFromTx = paidDepositFromTx.add(p.getAmount());
                    } else if (pt == PaymentType.RENTAL_FEE) {
                        paidRentFromTx = paidRentFromTx.add(p.getAmount());
                    } else if (pt == PaymentType.BOOKING_PAYMENT) {
                        paidBookingFromTx = paidBookingFromTx.add(p.getAmount());
                    }
                } else if (st == PaymentStatus.REFUND_PENDING) {
                    // REFUND_PENDING is a pending refund/reconciliation item, NOT yet transferred out.
                    // Never add to PAID and never subtract from held money like REFUNDED.
                    hasRefundPendingTx = true;
                    if (pt == PaymentType.DEPOSIT || pt == PaymentType.BOOKING_PAYMENT) {
                        hasRefundedOrRefundPendingDepositTx = true;
                    }
                } else if (st == PaymentStatus.REFUNDED) {
                    refundedPayments.add(p);
                    if (pt == PaymentType.DEPOSIT || pt == PaymentType.BOOKING_PAYMENT) {
                        hasRefundedOrRefundPendingDepositTx = true;
                    }
                }
            }
        }

        // Prevent double-deduction if the system both mutated an original incoming Payment to REFUNDED
        // and created a separate new refund Payment(status = REFUNDED).
        List<Payment> mutatedOriginals = new ArrayList<>();
        List<Payment> dedicatedRefunds = new ArrayList<>();
        for (Payment rp : refundedPayments) {
            if (isMutatedOriginalIncomingPayment(rp)) {
                mutatedOriginals.add(rp);
            } else {
                dedicatedRefunds.add(rp);
            }
        }

        List<Payment> effectiveRefundsToDeduct;
        if (!mutatedOriginals.isEmpty() && !dedicatedRefunds.isEmpty()) {
            for (Payment orig : mutatedOriginals) {
                PaymentType pt = orig.getPaymentType();
                if (pt == PaymentType.DEPOSIT && paidDepositFromTx.compareTo(requiredDeposit) < 0) {
                    BigDecimal restore = orig.getAmount().min(requiredDeposit.subtract(paidDepositFromTx).max(BigDecimal.ZERO));
                    paidDepositFromTx = paidDepositFromTx.add(restore);
                } else if (pt == PaymentType.RENTAL_FEE && paidRentFromTx.compareTo(requiredFirstMonthRent) < 0) {
                    BigDecimal restore = orig.getAmount().min(requiredFirstMonthRent.subtract(paidRentFromTx).max(BigDecimal.ZERO));
                    paidRentFromTx = paidRentFromTx.add(restore);
                } else if (pt == PaymentType.BOOKING_PAYMENT && paidBookingFromTx.compareTo(requiredTotalInitial) < 0) {
                    BigDecimal restore = orig.getAmount().min(requiredTotalInitial.subtract(paidBookingFromTx).max(BigDecimal.ZERO));
                    paidBookingFromTx = paidBookingFromTx.add(restore);
                }
            }
            effectiveRefundsToDeduct = dedicatedRefunds;
        } else {
            effectiveRefundsToDeduct = refundedPayments;
        }

        Set<String> seenRefundDeduplicationKeys = new HashSet<>();
        for (Payment rp : effectiveRefundsToDeduct) {
            String txKey = rp.getTransactionId() != null ? rp.getTransactionId().trim() : "";
            String refKey = rp.getReferenceCode() != null ? rp.getReferenceCode().trim() : "";
            String dedupKey = rp.getPaymentType() + "|" + rp.getAmount().stripTrailingZeros().toPlainString() + "|" + txKey + "|" + refKey;
            if (!seenRefundDeduplicationKeys.add(dedupKey)) {
                continue;
            }
            if (rp.getPaymentType() == PaymentType.DEPOSIT) {
                refundedDepositFromTx = refundedDepositFromTx.add(rp.getAmount());
            } else if (rp.getPaymentType() == PaymentType.RENTAL_FEE) {
                refundedRentFromTx = refundedRentFromTx.add(rp.getAmount());
            } else if (rp.getPaymentType() == PaymentType.BOOKING_PAYMENT) {
                refundedBookingFromTx = refundedBookingFromTx.add(rp.getAmount());
            }
        }

        boolean isBookingCancelledOrRefunded = booking.getStatus() == BookingStatus.CANCELLED
                || "REFUNDED".equalsIgnoreCase(booking.getPaymentStatus());

        BigDecimal bookingDepositField = booking.getDepositPaid() != null && booking.getDepositPaid().compareTo(BigDecimal.ZERO) > 0
                ? booking.getDepositPaid()
                : BigDecimal.ZERO;

        // Allow fallback to booking.depositPaid for valid legacy/in-person confirmed bookings (even if a subsequent
        // VNPay attempt FAILED or EXPIRED), while blocking fallback when deposit is REFUNDED/REFUND_PENDING or booking is PENDING_PAYMENT/CANCELLED/UNPAID/REFUNDED.
        boolean canFallbackToBookingDepositField = !isBookingCancelledOrRefunded
                && booking.getStatus() != BookingStatus.PENDING_PAYMENT
                && !hasRefundedOrRefundPendingDepositTx
                && !"UNPAID".equalsIgnoreCase(booking.getPaymentStatus());

        BigDecimal baseDepositPaid = (paidDepositFromTx.compareTo(BigDecimal.ZERO) == 0 && paidBookingFromTx.compareTo(BigDecimal.ZERO) == 0)
                ? (canFallbackToBookingDepositField ? bookingDepositField : BigDecimal.ZERO)
                : paidDepositFromTx;

        // Allocate BOOKING_PAYMENT without double-counting already paid DEPOSIT or RENTAL_FEE
        BigDecimal unpaidDepositBeforeBookingTx = requiredDeposit.subtract(baseDepositPaid).max(BigDecimal.ZERO);
        BigDecimal allocatedToDeposit = paidBookingFromTx.min(unpaidDepositBeforeBookingTx);
        BigDecimal remainingBookingTx = paidBookingFromTx.subtract(allocatedToDeposit).max(BigDecimal.ZERO);

        BigDecimal grossDepositPaid = isBookingCancelledOrRefunded ? BigDecimal.ZERO : baseDepositPaid.add(allocatedToDeposit);
        BigDecimal grossRentPaid = isBookingCancelledOrRefunded ? BigDecimal.ZERO : paidRentFromTx.add(remainingBookingTx);

        // Subtract only confirmed REFUNDED amounts (full or partial refunds)
        BigDecimal deductDeposit = refundedDepositFromTx.min(grossDepositPaid);
        BigDecimal excessDepositRefund = refundedDepositFromTx.subtract(deductDeposit).max(BigDecimal.ZERO);
        BigDecimal afterDepositRefund = grossDepositPaid.subtract(deductDeposit).max(BigDecimal.ZERO);
        BigDecimal afterRentRefund = grossRentPaid.subtract(refundedRentFromTx).subtract(excessDepositRefund).max(BigDecimal.ZERO);

        BigDecimal deductBookingFromDeposit = refundedBookingFromTx.min(afterDepositRefund);
        BigDecimal remBookingRefund = refundedBookingFromTx.subtract(deductBookingFromDeposit).max(BigDecimal.ZERO);

        BigDecimal effectiveDepositPaid = afterDepositRefund.subtract(deductBookingFromDeposit).max(BigDecimal.ZERO);
        BigDecimal effectiveRentPaid = afterRentRefund.subtract(remBookingRefund).max(BigDecimal.ZERO);

        BigDecimal depositRemaining = requiredDeposit.subtract(effectiveDepositPaid).max(BigDecimal.ZERO);
        BigDecimal rentRemaining = requiredFirstMonthRent.subtract(effectiveRentPaid).max(BigDecimal.ZERO);
        BigDecimal totalInitialRemaining = depositRemaining.add(rentRemaining);

        boolean hasAnyConfirmedPayment = effectiveDepositPaid.compareTo(BigDecimal.ZERO) > 0
                || effectiveRentPaid.compareTo(BigDecimal.ZERO) > 0;

        boolean isFullyPaid = !isBookingCancelledOrRefunded && (requiredTotalInitial.compareTo(BigDecimal.ZERO) > 0
                ? (depositRemaining.compareTo(BigDecimal.ZERO) == 0 && rentRemaining.compareTo(BigDecimal.ZERO) == 0)
                : (paidBookingFromTx.subtract(refundedBookingFromTx).compareTo(BigDecimal.ZERO) > 0));

        String resolvedPaymentStatus = isFullyPaid
                ? "PAID"
                : (hasAnyConfirmedPayment ? "PARTIALLY_PAID" : "UNPAID");

        boolean hasActiveRefundReq = hasActiveOrCompletedRefundRequest(booking);
        boolean hasPendingRefund = hasRefundPendingTx || hasActiveRefundReq;

        boolean hasRecordedRefundTx = !effectiveRefundsToDeduct.isEmpty();
        String refundConfirmationLevel;
        if (hasRecordedRefundTx) {
            // Reflect exact confirmation level: Payment(REFUNDED) created by staff in processRefund is a staff-recorded transfer
            // and is only bank-reconciled once RefundRequest reaches RECONCILED/COMPLETED.
            refundConfirmationLevel = isRefundBankReconciled(booking)
                    ? "BANK_RECONCILED"
                    : "STAFF_RECORDED_TRANSFER_UNVERIFIED_BANK";
        } else if (hasPendingRefund) {
            refundConfirmationLevel = "REFUND_PENDING_RECONCILIATION";
        } else {
            refundConfirmationLevel = "NONE";
        }

        return new BookingPaymentSummary(
                requiredDeposit,
                requiredFirstMonthRent,
                requiredTotalInitial,
                effectiveDepositPaid,
                effectiveRentPaid,
                depositRemaining,
                rentRemaining,
                totalInitialRemaining,
                hasAnyConfirmedPayment,
                isFullyPaid,
                resolvedPaymentStatus,
                hasPendingRefund,
                refundConfirmationLevel
        );
    }

    private void reconcileBookingAfterConfirmedPayment(Booking booking, Payment currentConfirmedPayment) {
        List<Payment> bookingPayments = new ArrayList<>(paymentRepository.findAllByBooking_Id(booking.getId()));
        boolean containsCurrent = bookingPayments.stream()
                .anyMatch(p -> (p.getId() != null && p.getId().equals(currentConfirmedPayment.getId()))
                        || (p.getTransactionId() != null && p.getTransactionId().equals(currentConfirmedPayment.getTransactionId())));
        if (!containsCurrent) {
            bookingPayments.add(currentConfirmedPayment);
        }

        BookingPaymentSummary summary = calculateBookingPaymentSummary(booking, bookingPayments);

        if (booking.getStatus() == BookingStatus.PENDING_PAYMENT || booking.getStatus() == BookingStatus.PENDING_APPROVAL) {
            booking.setStatus(BookingStatus.CONFIRMED);
            booking.setPaymentExpiresAt(null);
            booking.setHoldExpiresAt(null);
            if (booking.getStorageUnit() != null) {
                storageUnitLockService.releaseLock(booking.getStorageUnit().getId());
            }
        } else if (currentConfirmedPayment.getPaymentType() == PaymentType.DEPOSIT
                || currentConfirmedPayment.getPaymentType() == PaymentType.BOOKING_PAYMENT
                || currentConfirmedPayment.getPaymentType() == PaymentType.RENTAL_FEE) {
            booking.setHoldExpiresAt(null);
            booking.setPaymentExpiresAt(null);
        }

        if (summary.requiredDeposit().compareTo(BigDecimal.ZERO) > 0) {
            booking.setDepositPaid(summary.effectiveDepositPaid().min(summary.requiredDeposit()));
        } else if (currentConfirmedPayment.getPaymentType() == PaymentType.DEPOSIT) {
            booking.setDepositPaid(summary.effectiveDepositPaid());
        } else if (currentConfirmedPayment.getPaymentType() == PaymentType.BOOKING_PAYMENT
                && (booking.getDepositPaid() == null || booking.getDepositPaid().compareTo(BigDecimal.ZERO) == 0)) {
            booking.setDepositPaid(currentConfirmedPayment.getAmount());
        }

        booking.setPaymentStatus(summary.resolvedPaymentStatus());
    }

    private void cancelUnpaidBookingAfterPaymentFailure(Booking paymentBooking, String transactionRef) {
        if (paymentBooking == null || paymentBooking.getId() == null) {
            return;
        }

        Booking booking = bookingRepository.findByIdForUpdate(paymentBooking.getId()).orElse(null);
        if (booking == null
                || (booking.getStatus() != BookingStatus.PENDING_PAYMENT
                && booking.getStatus() != BookingStatus.PENDING_APPROVAL)) {
            return;
        }

        if (paymentRepository.existsByBooking_IdAndStatus(booking.getId(), PaymentStatus.PAID)
                || paymentRepository.existsByBooking_IdAndStatus(booking.getId(), PaymentStatus.PENDING)) {
            return;
        }

        booking.setStatus(BookingStatus.CANCELLED);
        booking.setCancellationReason("Hệ thống tự hủy do thanh toán thất bại hoặc bị hủy");
        booking.setCancelledAt(LocalDateTime.now());
        booking.setPaymentExpiresAt(null);
        booking.setHoldExpiresAt(null);
        booking.setPaymentStatus("UNPAID");
        booking.setAccessPin(null);
        booking.setQrAccessToken("REVOKED_AUTO_CANCEL");
        bookingRepository.save(booking);

        StorageUnit unit = booking.getStorageUnit();
        if (unit != null) {
            StorageUnit lockedUnit = storageUnitRepository.findWithDetailsByIdForUpdate(unit.getId()).orElse(null);
            if (lockedUnit != null) {
                boolean hasOtherActive = bookingRepository.existsByStorageUnit_IdAndStatusInAndIdNot(
                        lockedUnit.getId(),
                        List.of(BookingStatus.ACTIVE, BookingStatus.CONFIRMED,
                                BookingStatus.PENDING_PAYMENT, BookingStatus.PENDING_APPROVAL),
                        booking.getId());
                if (!hasOtherActive) {
                    if (lockedUnit.getStatus() == UnitStatus.RESERVED) {
                        lockedUnit.setStatus(UnitStatus.AVAILABLE);
                        storageUnitRepository.save(lockedUnit);
                    }
                    storageUnitLockService.releaseLock(lockedUnit.getId());
                }
            }
        }

        UUID facilityId = unit != null && unit.getFacility() != null ? unit.getFacility().getId() : null;
        activityLogService.recordSystem(
                facilityId,
                ActivityAction.RESERVATION_EXPIRE,
                "Booking",
                booking.getId(),
                String.format("Tự hủy đơn %s ngay sau khi giao dịch %s thất bại hoặc bị hủy; kho được trả về trạng thái trống.",
                        booking.getBookingCode(), transactionRef));
    }
    @Override
    public VNPayPaymentResponse createVNPayPayment(PaymentCreateRequest request, HttpServletRequest httpRequest) {
        Booking booking = bookingRepository.findById(request.getBookingId())
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        if (request.getPaymentType() == PaymentType.BOOKING_PAYMENT) {
            if (booking.getStatus() != BookingStatus.PENDING_PAYMENT && booking.getStatus() != BookingStatus.PENDING_APPROVAL) {
                throw new AppException(ErrorCode.PAYMENT_ALREADY_PROCESSED);
            }
            if (booking.getPaymentExpiresAt() == null || !booking.getPaymentExpiresAt().isAfter(java.time.Instant.now())) {
                throw new AppException(ErrorCode.BOOKING_PAYMENT_EXPIRED);
            }
            BigDecimal monthlyFee = booking.getTotalRentalFee() != null && booking.getRentalMonths() != null && booking.getRentalMonths() > 0
                    ? booking.getTotalRentalFee().divide(BigDecimal.valueOf(booking.getRentalMonths()), 2, java.math.RoundingMode.HALF_UP)
                    : BigDecimal.ZERO;
            BigDecimal expectedAmount = monthlyFee.add(booking.getDepositAmount() != null ? booking.getDepositAmount() : BigDecimal.ZERO);
            BigDecimal totalExpected = (booking.getTotalRentalFee() != null ? booking.getTotalRentalFee() : BigDecimal.ZERO)
                    .add(booking.getDepositAmount() != null ? booking.getDepositAmount() : BigDecimal.ZERO);
            if (request.getAmount() != null
                    && request.getAmount().compareTo(expectedAmount) != 0
                    && request.getAmount().compareTo(totalExpected) != 0
                    && request.getAmount().compareTo(booking.getDepositAmount() != null ? booking.getDepositAmount() : BigDecimal.ZERO) != 0
                    && request.getAmount().compareTo(BigDecimal.valueOf(1000)) < 0) {
                throw new AppException(ErrorCode.PAYMENT_AMOUNT_MISMATCH);
            }
        }

        // Generate unique transaction reference (e.g. BOX + timestamp + 6 random chars)
        String txnRef = "BOX" + System.currentTimeMillis() + VNPayUtil.randomAlphaNumeric(6);

        // Determine client IP
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
        ipAddress = VNPayUtil.normalizeIp(ipAddress);

        String orderInfo = request.getOrderInfo();
        if (orderInfo == null || orderInfo.isBlank()) {
            orderInfo = "Thanh toan don dat cho " + booking.getBookingCode();
        }

        // Create PENDING payment entity
        Payment payment = Payment.builder()
                .transactionId(txnRef)
                .booking(booking)
                .amount(request.getAmount())
                .paymentType(request.getPaymentType())
                .status(PaymentStatus.PENDING)
                .paymentMethod("VNPAY")
                .paymentTime(LocalDateTime.now())
                .build();

        payment = paymentRepository.save(payment);

        UUID facilityId = (booking.getStorageUnit() != null && booking.getStorageUnit().getFacility() != null)
                ? booking.getStorageUnit().getFacility().getId() : null;
        activityLogService.record(
                facilityId,
                ActivityAction.PAYMENT_INITIATED,
                "PAYMENT",
                payment.getId(),
                "Khoi tao giao dich thanh toan VNPAY cho booking " + booking.getBookingCode() + ", so tien: " + request.getAmount(),
                null,
                payment.getId()
        );

        // Generate VNPay checkout URL
        String paymentUrl = vnPayService.createPaymentUrl(txnRef, request.getAmount(), orderInfo, ipAddress);

        return VNPayPaymentResponse.builder()
                .paymentUrl(paymentUrl)
                .transactionId(txnRef)
                .paymentId(payment.getId())
                .bookingId(booking.getId())
                .amount(payment.getAmount())
                .orderInfo(orderInfo)
                .build();
    }

    @Override
    public PaymentResponse processVNPayReturn(Map<String, String> params) {
        // 1. Verify digital signature
        boolean isValid = vnPayService.verifySignature(params);
        if (!isValid) {
            log.warn("VNPay return callback signature invalid: {}", params);
            throw new AppException(ErrorCode.INVALID_PAYMENT_SIGNATURE);
        }

        String txnRef = params.get("vnp_TxnRef");
        Payment payment = paymentRepository.findByTransactionId(txnRef)
                .orElseThrow(() -> new AppException(ErrorCode.PAYMENT_NOT_FOUND));

        String amountStr = params.get("vnp_Amount");
        if (amountStr != null && !amountStr.isBlank()) {
            try {
                BigDecimal vnpAmount = new BigDecimal(amountStr).divide(BigDecimal.valueOf(100));
                if (payment.getAmount().compareTo(vnpAmount) != 0) {
                    throw new AppException(ErrorCode.PAYMENT_AMOUNT_MISMATCH);
                }
            } catch (NumberFormatException e) {
                throw new AppException(ErrorCode.PAYMENT_AMOUNT_MISMATCH);
            }
        }

        // 2. Idempotency check: if already confirmed as PAID, return existing
        if (payment.getStatus() == PaymentStatus.PAID) {
            log.info("Payment with txnRef={} has already been marked as PAID.", txnRef);
            return paymentMapper.toResponse(payment);
        }

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

        if (isSuccess) {
            payment.setStatus(PaymentStatus.PAID);

            // Update Booking status & deposit amount if applicable
            Booking booking = payment.getBooking();
            if (booking != null) {
                if (payment.getPaymentType() == PaymentType.BOOKING_PAYMENT
                        && (booking.getStatus() == BookingStatus.PENDING_PAYMENT || booking.getStatus() == BookingStatus.PENDING_APPROVAL)) {
                    booking.setDepositPaid(booking.getDepositAmount());
                    booking.setStatus(BookingStatus.CONFIRMED);
                    booking.setPaymentExpiresAt(null);
                    if (booking.getAccessPin() == null) {
                        booking.setAccessPin(String.format("%06d", SECURE_RANDOM.nextInt(1000000)));
                        booking.setQrAccessToken("QR-" + java.util.UUID.randomUUID().toString().substring(0, 8).toUpperCase());
                        booking.setPinUpdatedAt(LocalDateTime.now());
                    }
                    if (booking.getStorageUnit() != null) {
                        storageUnitLockService.releaseLock(booking.getStorageUnit().getId());
                    }
                } else if (payment.getPaymentType() == PaymentType.DEPOSIT) {
                    BigDecimal currentDeposit = booking.getDepositPaid() != null ? booking.getDepositPaid() : BigDecimal.ZERO;
                    booking.setDepositPaid(currentDeposit.add(payment.getAmount()));
                }
                if (payment.getPaymentType() != PaymentType.BOOKING_PAYMENT
                        && (booking.getStatus() == BookingStatus.PENDING_PAYMENT || booking.getStatus() == BookingStatus.PENDING_APPROVAL)) {
                    booking.setStatus(BookingStatus.CONFIRMED);
                    booking.setPaymentExpiresAt(null);
                    if (booking.getAccessPin() == null) {
                        booking.setAccessPin(String.format("%06d", SECURE_RANDOM.nextInt(1000000)));
                        booking.setQrAccessToken("QR-" + java.util.UUID.randomUUID().toString().substring(0, 8).toUpperCase());
                        booking.setPinUpdatedAt(LocalDateTime.now());
                    }
                    if (booking.getStorageUnit() != null) {
                        storageUnitLockService.releaseLock(booking.getStorageUnit().getId());
                    }
                }
                bookingRepository.save(booking);

                com.boxora.service.ContractSigningService contractSigningService = contractSigningServiceProvider.getIfAvailable();
                if (contractSigningService != null) {
                    try {
                        contractSigningService.ensureContractForBooking(booking);
                    } catch (Exception ex) {
                        log.warn("Khong the tu dong khoi tao hop dong DocuSeal cho booking {}: {}", booking.getBookingCode(), ex.getMessage());
                    }
                }
            }

            if (payment.getPaymentType() == PaymentType.RENEWAL_FEE) {
                ContractRenewalService renewalService = contractRenewalServiceProvider.getIfAvailable();
                if (renewalService != null) {
                    renewalService.handleRenewalPaid(payment);
                }
            }

            String targetDesc = payment.getBooking() != null
                    ? "booking " + payment.getBooking().getBookingCode()
                    : "hop dong " + (payment.getContract() != null ? payment.getContract().getId() : "N/A");

            UUID facilityId = extractFacilityId(payment);
            activityLogService.record(
                    facilityId,
                    ActivityAction.PAYMENT_CONFIRMED,
                    "PAYMENT",
                    payment.getId(),
                    "Thanh toan VNPAY thanh cong cho " + targetDesc + ", ma GD: " + txnRef,
                    PaymentStatus.PENDING,
                    PaymentStatus.PAID
            );
        } else {
            payment.setStatus(PaymentStatus.FAILED);

            String targetDesc = payment.getBooking() != null
                    ? "booking " + payment.getBooking().getBookingCode()
                    : "hop dong " + (payment.getContract() != null ? payment.getContract().getId() : "N/A");

            UUID facilityId = extractFacilityId(payment);
            activityLogService.record(
                    facilityId,
                    ActivityAction.PAYMENT_FAILED,
                    "PAYMENT",
                    payment.getId(),
                    "Thanh toan VNPAY that bai hoac bi huy cho " + targetDesc + ", responseCode: " + responseCode,
                    PaymentStatus.PENDING,
                    PaymentStatus.FAILED
            );
            payment = paymentRepository.save(payment);
            cancelUnpaidBookingAfterPaymentFailure(payment.getBooking(), txnRef);
            return paymentMapper.toResponse(payment);
        }

        payment = paymentRepository.save(payment);
        return paymentMapper.toResponse(payment);
    }

    @Override
    public VNPayIpnResponse processVNPayIPN(Map<String, String> params) {
        // 1. Verify Checksum
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

        // 2. Check Amount
        String amountStr = params.get("vnp_Amount");
        if (amountStr != null && !amountStr.isBlank()) {
            try {
                BigDecimal vnpAmount = new BigDecimal(amountStr).divide(BigDecimal.valueOf(100));
                if (payment.getAmount().compareTo(vnpAmount) != 0) {
                    log.warn("VNPay IPN amount mismatch for txnRef={}. DB={}, VNPay={}",
                            txnRef, payment.getAmount(), vnpAmount);
                    return VNPayIpnResponse.invalidAmount();
                }
            } catch (Exception e) {
                log.error("Failed to parse VNPay IPN amount: {}", amountStr, e);
                return VNPayIpnResponse.invalidAmount();
            }
        }

        // 3. Check if already confirmed
        if (payment.getStatus() == PaymentStatus.PAID) {
            return VNPayIpnResponse.alreadyConfirmed();
        }

        // 4. Update status
        String responseCode = params.get("vnp_ResponseCode");
        String transactionStatus = params.get("vnp_TransactionStatus");
        boolean isSuccess = "00".equals(responseCode) && ("00".equals(transactionStatus) || transactionStatus == null);

        String payDateStr = params.get("vnp_PayDate");
        if (payDateStr != null && payDateStr.length() == 14) {
            try {
                payment.setPaymentTime(LocalDateTime.parse(payDateStr, VNP_DATE_FORMAT));
            } catch (Exception e) {
                payment.setPaymentTime(LocalDateTime.now());
            }
        }

        if (isSuccess) {
            payment.setStatus(PaymentStatus.PAID);

            Booking booking = payment.getBooking();
            if (booking != null) {
                if (payment.getPaymentType() == PaymentType.BOOKING_PAYMENT
                        && (booking.getStatus() == BookingStatus.PENDING_PAYMENT || booking.getStatus() == BookingStatus.PENDING_APPROVAL)) {
                    booking.setDepositPaid(booking.getDepositAmount());
                    booking.setStatus(BookingStatus.CONFIRMED);
                    booking.setPaymentExpiresAt(null);
                    if (booking.getAccessPin() == null) {
                        booking.setAccessPin(String.format("%06d", SECURE_RANDOM.nextInt(1000000)));
                        booking.setQrAccessToken("QR-" + java.util.UUID.randomUUID().toString().substring(0, 8).toUpperCase());
                        booking.setPinUpdatedAt(LocalDateTime.now());
                    }
                    if (booking.getStorageUnit() != null) {
                        storageUnitLockService.releaseLock(booking.getStorageUnit().getId());
                    }
                } else if (payment.getPaymentType() == PaymentType.DEPOSIT) {
                    BigDecimal currentDeposit = booking.getDepositPaid() != null ? booking.getDepositPaid() : BigDecimal.ZERO;
                    booking.setDepositPaid(currentDeposit.add(payment.getAmount()));
                }
                if (payment.getPaymentType() != PaymentType.BOOKING_PAYMENT
                        && (booking.getStatus() == BookingStatus.PENDING_PAYMENT || booking.getStatus() == BookingStatus.PENDING_APPROVAL)) {
                    booking.setStatus(BookingStatus.CONFIRMED);
                    booking.setPaymentExpiresAt(null);
                    if (booking.getAccessPin() == null) {
                        booking.setAccessPin(String.format("%06d", SECURE_RANDOM.nextInt(1000000)));
                        booking.setQrAccessToken("QR-" + java.util.UUID.randomUUID().toString().substring(0, 8).toUpperCase());
                        booking.setPinUpdatedAt(LocalDateTime.now());
                    }
                    if (booking.getStorageUnit() != null) {
                        storageUnitLockService.releaseLock(booking.getStorageUnit().getId());
                    }
                }
                bookingRepository.save(booking);

                com.boxora.service.ContractSigningService contractSigningService = contractSigningServiceProvider.getIfAvailable();
                if (contractSigningService != null) {
                    try {
                        contractSigningService.ensureContractForBooking(booking);
                    } catch (Exception ex) {
                        log.warn("Khong the tu dong khoi tao hop dong DocuSeal cho booking qua IPN {}: {}", booking.getBookingCode(), ex.getMessage());
                    }
                }
            }

            if (payment.getPaymentType() == PaymentType.RENEWAL_FEE) {
                ContractRenewalService renewalService = contractRenewalServiceProvider.getIfAvailable();
                if (renewalService != null) {
                    renewalService.handleRenewalPaid(payment);
                }
            }

            UUID facilityId = extractFacilityId(payment);
            activityLogService.recordSystem(
                    facilityId,
                    ActivityAction.PAYMENT_CONFIRMED,
                    "PAYMENT",
                    payment.getId(),
                    "IPN VNPAY xac nhan thanh cong cho txnRef=" + txnRef
            );
        } else {
            payment.setStatus(PaymentStatus.FAILED);

            UUID facilityId = extractFacilityId(payment);
            activityLogService.recordSystem(
                    facilityId,
                    ActivityAction.PAYMENT_FAILED,
                    "PAYMENT",
                    payment.getId(),
                    "IPN VNPAY xac nhan that bai cho txnRef=" + txnRef + ", responseCode=" + responseCode
            );
            payment = paymentRepository.save(payment);
            cancelUnpaidBookingAfterPaymentFailure(payment.getBooking(), txnRef);
            return VNPayIpnResponse.success();
        }

        paymentRepository.save(payment);
        return VNPayIpnResponse.success();
    }

    @Override
    @Transactional(readOnly = true)
    public PaymentResponse getById(UUID id) {
        Payment payment = paymentRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.PAYMENT_NOT_FOUND));
        return paymentMapper.toResponse(payment);
    }

    @Override
    @Transactional(readOnly = true)
    public PaymentResponse getByTransactionId(String transactionId) {
        Payment payment = paymentRepository.findByTransactionId(transactionId)
                .orElseThrow(() -> new AppException(ErrorCode.PAYMENT_NOT_FOUND));
        return paymentMapper.toResponse(payment);
    }

    @Override
    @Transactional(readOnly = true)
    public List<PaymentResponse> getByBookingId(UUID bookingId) {
        List<Payment> payments = paymentRepository.findAllByBooking_Id(bookingId);
        return payments.stream().map(paymentMapper::toResponse).toList();
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
            UUID bookingId,
            UUID facilityId,
            UUID customerId,
            PaymentStatus status,
            PaymentType paymentType,
            LocalDateTime fromDate,
            LocalDateTime toDate,
            int page,
            int size,
            String sortBy,
            String sortDir
    ) {
        Sort sort = sortDir.equalsIgnoreCase("asc") ? Sort.by(sortBy).ascending() : Sort.by(sortBy).descending();
        Pageable pageable = PageRequest.of(page, size, sort);

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

    @Override
    @Transactional
    public VNPayPaymentResponse createContractPayment(
            RentalContract contract, PaymentType type, BigDecimal amount,
            Integer renewalMonths, String orderInfo, HttpServletRequest httpRequest) {

        String txnRef = "BOX" + System.currentTimeMillis() + VNPayUtil.randomAlphaNumeric(6);

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
        ipAddress = VNPayUtil.normalizeIp(ipAddress);

        if (orderInfo == null || orderInfo.isBlank()) {
            orderInfo = "Thanh toan phi gia han hop dong " + (contract.getContractCode() != null ? contract.getContractCode() : contract.getId());
        }

        Payment payment = Payment.builder()
                .transactionId(txnRef)
                .contract(contract)
                .amount(amount)
                .paymentType(type)
                .renewalMonths(renewalMonths)
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
                "Khoi tao thanh toan phi gia han hop dong " + contract.getId() + ", so tien: " + amount,
                null,
                payment.getId()
        );

        String paymentUrl = vnPayService.createPaymentUrl(txnRef, amount, orderInfo, ipAddress);

        return VNPayPaymentResponse.builder()
                .paymentUrl(paymentUrl)
                .transactionId(txnRef)
                .paymentId(payment.getId())
                .contractId(contract.getId())
                .amount(payment.getAmount())
                .orderInfo(orderInfo)
                .build();
    }
}

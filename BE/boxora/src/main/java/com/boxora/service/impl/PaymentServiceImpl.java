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
import com.boxora.entity.User;
import com.boxora.enums.ActivityAction;
import com.boxora.enums.BookingStatus;
import com.boxora.enums.PaymentStatus;
import com.boxora.enums.PaymentType;
import com.boxora.enums.RentalContractStatus;
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
import com.boxora.service.EmailService;
import com.boxora.service.PaymentService;
import com.boxora.service.VNPayService;
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
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class PaymentServiceImpl implements PaymentService {

    private static final DateTimeFormatter VNP_DATE_FORMAT = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");
    private static final java.security.SecureRandom SECURE_RANDOM = new java.security.SecureRandom();

    private final PaymentRepository paymentRepository;
    private final RentalContractRepository rentalContractRepository;
    private final BookingRepository bookingRepository;
    private final PaymentMapper paymentMapper;
    private final VNPayService vnPayService;
    private final ActivityLogService activityLogService;
    private final RequestContext requestContext;
    private final com.boxora.security.FacilityAccessGuard facilityAccessGuard;
    private final org.springframework.beans.factory.ObjectProvider<com.boxora.service.ContractRenewalService> contractRenewalServiceProvider;
    private final org.springframework.beans.factory.ObjectProvider<com.boxora.service.ContractSigningService> contractSigningServiceProvider;
    private final com.boxora.service.StorageUnitLockService storageUnitLockService;
    private final com.boxora.repository.RefundRequestRepository refundRequestRepository;
    private final com.boxora.repository.StorageUnitRepository storageUnitRepository;
    private final com.boxora.config.DocuSealConfig docuSealConfig;
    private final org.springframework.beans.factory.ObjectProvider<com.boxora.service.EmailService> emailServiceProvider;
    private final com.boxora.repository.HandoverRecordRepository handoverRecordRepository;
    private final com.boxora.repository.NotificationLogRepository notificationLogRepository;

    private UUID extractFacilityId(Payment payment) {
        if (payment == null) return null;
        if (payment.getContract() != null && payment.getContract().getFacility() != null) {
            return payment.getContract().getFacility().getId();
        }
        if (payment.getBooking() != null && payment.getBooking().getStorageUnit() != null && payment.getBooking().getStorageUnit().getFacility() != null) {
            return payment.getBooking().getStorageUnit().getFacility().getId();
        }
        if (payment.getBooking() != null && payment.getBooking().getFacility() != null) {
            return payment.getBooking().getFacility().getId();
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

    private boolean isContractValidAndMatchingBookingSnapshot(RentalContract contract, Booking booking) {
        if (contract == null || booking == null) {
            return false;
        }
        if (contract.getStatus() == RentalContractStatus.SUPERSEDED
                || contract.getStatus() == RentalContractStatus.CANCELLED
                || contract.getStatus() == RentalContractStatus.TERMINATED
                || contract.getSignedAt() == null) {
            return false;
        }

        UUID bookingFacilityId = booking.getFacility() != null
                ? booking.getFacility().getId()
                : (booking.getStorageUnit() != null && booking.getStorageUnit().getFacility() != null
                        ? booking.getStorageUnit().getFacility().getId()
                        : null);
        UUID contractFacilityId = contract.getFacility() != null
                ? contract.getFacility().getId()
                : (contract.getUnit() != null && contract.getUnit().getFacility() != null
                        ? contract.getUnit().getFacility().getId()
                        : null);
        if (bookingFacilityId != null && contractFacilityId != null && !bookingFacilityId.equals(contractFacilityId)) {
            return false;
        }

        if (booking.getStorageUnit() != null && contract.getUnit() != null
                && booking.getStorageUnit().getId() != null && contract.getUnit().getId() != null
                && !booking.getStorageUnit().getId().equals(contract.getUnit().getId())) {
            return false;
        }

        if (booking.getStartDate() != null && contract.getStartDate() != null
                && !booking.getStartDate().equals(contract.getStartDate())) {
            return false;
        }
        if (booking.getEndDate() != null && contract.getEndDate() != null
                && !booking.getEndDate().equals(contract.getEndDate())) {
            return false;
        }

        if (booking.getTotalRentalFee() != null
                && booking.getRentalMonths() != null
                && booking.getRentalMonths() > 0
                && contract.getMonthlyFee() != null) {
            BigDecimal expectedMonthly = booking.getTotalRentalFee()
                    .divide(BigDecimal.valueOf(booking.getRentalMonths()), 2, RoundingMode.HALF_UP);
            if (contract.getMonthlyFee().subtract(expectedMonthly).abs().compareTo(BigDecimal.valueOf(10)) > 0) {
                return false;
            }
        }

        if (booking.getDepositAmount() != null && booking.getDepositAmount().compareTo(BigDecimal.ZERO) > 0
                && contract.getDepositHeld() != null && contract.getDepositHeld().compareTo(BigDecimal.ZERO) > 0) {
            if (contract.getDepositHeld().subtract(booking.getDepositAmount()).abs().compareTo(BigDecimal.valueOf(10)) > 0) {
                return false;
            }
        }

        return true;
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

        if (booking.getStatus() == BookingStatus.PENDING_PAYMENT || booking.getStatus() == BookingStatus.PENDING_APPROVAL || booking.getStatus() == BookingStatus.PENDING_SIGNATURE || booking.getStatus() == BookingStatus.SIGNED_PENDING_PAYMENT) {
            if (booking.getStorageUnit() == null) {
                boolean contractSigned = Boolean.TRUE.equals(booking.getContractSigned());
                if (!contractSigned) {
                    Optional<RentalContract> contractOpt = rentalContractRepository.findByBookingId(booking.getId());
                    if (contractOpt.isPresent() && isContractValidAndMatchingBookingSnapshot(contractOpt.get(), booking)) {
                        contractSigned = true;
                    }
                }
                // Nếu khách hàng đã ký hợp đồng hợp lệ khớp snapshot hiện tại thì đơn chuyển sang PAID_AND_SIGNED, ngược lại là PAID_PENDING_ASSIGNMENT
                booking.setStatus(contractSigned ? BookingStatus.PAID_AND_SIGNED : BookingStatus.PAID_PENDING_ASSIGNMENT);
            } else {
                booking.setStatus(BookingStatus.CONFIRMED);
            }
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
        booking = bookingRepository.findByIdForUpdate(booking.getId()).orElse(booking);

        if ("CUSTOMER".equalsIgnoreCase(requestContext.currentUserRole()) && requestContext.currentUserId() != null) {
            UUID currentUserId = requestContext.currentUserId();
            if (booking.getCustomer() != null && booking.getCustomer().getId() != null
                    && !currentUserId.equals(booking.getCustomer().getId())) {
                throw new AppException(ErrorCode.FORBIDDEN);
            }
        }

        if (request.getPaymentType() == PaymentType.RETURN_COMPENSATION) {
            com.boxora.entity.HandoverRecord record = handoverRecordRepository != null
                    ? handoverRecordRepository.findTopByBooking_IdAndRecordTypeOrderByRecordedAtDesc(booking.getId(), "RETURN").orElse(null)
                    : null;
            if (record == null) {
                throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Không tìm thấy hồ sơ trả kho cho đơn này.");
            }
            if (!Boolean.TRUE.equals(record.getSettlementConfirmed())) {
                throw new AppException(ErrorCode.INVALID_REQUEST, "Quyết toán trả kho chưa được nhân viên xác nhận chốt số liệu.");
            }
            if (!"AGREED".equalsIgnoreCase(record.getCustomerDecision())) {
                throw new AppException(ErrorCode.INVALID_REQUEST, "Khách hàng chưa xác nhận đồng ý với kết quả quyết toán trả kho.");
            }
            if (record.getDisputeReason() != null && record.getDisputeResolvedAt() == null) {
                throw new AppException(ErrorCode.INVALID_REQUEST, "Hồ sơ đang trong trạng thái khiếu nại chưa được Facility Manager giải quyết.");
            }
            if ("PAID".equalsIgnoreCase(record.getAdditionalPaymentStatus())) {
                throw new AppException(ErrorCode.PAYMENT_ALREADY_PROCESSED, "Khoản bồi thường trả kho đã được thanh toán trước đó.");
            }
            BigDecimal authoritativeAmount = record.getAdditionalAmountDue();
            if (authoritativeAmount == null || authoritativeAmount.compareTo(BigDecimal.ZERO) <= 0) {
                throw new AppException(ErrorCode.INVALID_REQUEST, "Hồ sơ không có khoản tiền bồi thường cần thanh toán.");
            }

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
                orderInfo = "Thanh toan boi thuong tra kho " + booking.getBookingCode();
            }

            LocalDateTime recentCutoff = LocalDateTime.now().minusMinutes(15);
            List<Payment> existingPayments = paymentRepository.findAllByBooking_Id(booking.getId());
            Payment reusablePending = null;
            for (Payment p : existingPayments) {
                if (p != null && p.getStatus() == PaymentStatus.PENDING && "VNPAY".equalsIgnoreCase(p.getPaymentMethod())) {
                    if (reusablePending == null
                            && p.getPaymentType() == PaymentType.RETURN_COMPENSATION
                            && p.getAmount() != null
                            && p.getAmount().compareTo(authoritativeAmount) == 0
                            && p.getPaymentTime() != null
                            && p.getPaymentTime().isAfter(recentCutoff)) {
                        reusablePending = p;
                    } else if (p.getPaymentType() == PaymentType.RETURN_COMPENSATION) {
                        p.setStatus(PaymentStatus.EXPIRED);
                        paymentRepository.save(p);
                    }
                }
            }

            if (reusablePending != null) {
                String existingUrl = (request.getReturnUrl() != null && !request.getReturnUrl().isBlank())
                        ? vnPayService.createPaymentUrl(reusablePending.getTransactionId(), authoritativeAmount, orderInfo, ipAddress, request.getReturnUrl())
                        : vnPayService.createPaymentUrl(reusablePending.getTransactionId(), authoritativeAmount, orderInfo, ipAddress);
                return VNPayPaymentResponse.builder()
                        .paymentUrl(existingUrl)
                        .transactionId(reusablePending.getTransactionId())
                        .paymentId(reusablePending.getId())
                        .bookingId(booking.getId())
                        .amount(authoritativeAmount)
                        .orderInfo(orderInfo)
                        .build();
            }

            String txnRef = "BOX" + System.currentTimeMillis() + VNPayUtil.randomAlphaNumeric(6);
            String paymentUrl = (request.getReturnUrl() != null && !request.getReturnUrl().isBlank())
                    ? vnPayService.createPaymentUrl(txnRef, authoritativeAmount, orderInfo, ipAddress, request.getReturnUrl())
                    : vnPayService.createPaymentUrl(txnRef, authoritativeAmount, orderInfo, ipAddress);

            Payment payment = Payment.builder()
                    .booking(booking)
                    .paymentType(PaymentType.RETURN_COMPENSATION)
                    .paymentMethod("VNPAY")
                    .amount(authoritativeAmount)
                    .status(PaymentStatus.PENDING)
                    .transactionId(txnRef)
                    .paymentTime(LocalDateTime.now())
                    .build();

            Payment saved = paymentRepository.save(payment);

            return VNPayPaymentResponse.builder()
                    .paymentUrl(paymentUrl)
                    .transactionId(txnRef)
                    .paymentId(saved.getId())
                    .bookingId(booking.getId())
                    .amount(authoritativeAmount)
                    .orderInfo(orderInfo)
                    .build();
        }

        if (booking.getStatus() == BookingStatus.CANCELLED
                || booking.getStatus() == BookingStatus.COMPLETED
                || booking.getStatus() == BookingStatus.OVERDUE
                || "REFUNDED".equalsIgnoreCase(booking.getPaymentStatus())) {
            throw new AppException(ErrorCode.INVALID_REQUEST);
        }

        List<Payment> existingPayments = paymentRepository.findAllByBooking_Id(booking.getId());
        BookingPaymentSummary summary = calculateBookingPaymentSummary(booking, existingPayments);

        // Do not allow continuing payment if the booking is awaiting refund or in an active refund flow
        if (summary.hasPendingRefund()) {
            throw new AppException(ErrorCode.INVALID_REQUEST);
        }

        if (summary.isFullyPaid() || ("PAID".equalsIgnoreCase(booking.getPaymentStatus()) && summary.totalInitialRemaining().compareTo(BigDecimal.ZERO) == 0 && summary.requiredTotalInitial().compareTo(BigDecimal.ZERO) > 0)) {
            throw new AppException(ErrorCode.PAYMENT_ALREADY_PROCESSED);
        }

        PaymentType effectivePaymentType = request.getPaymentType();
        BigDecimal authoritativeAmount;

        if (request.getPaymentType() == PaymentType.BOOKING_PAYMENT) {

            boolean isPayableStatus = booking.getStatus() == BookingStatus.PENDING_PAYMENT
                    || booking.getStatus() == BookingStatus.PENDING_CONTACT
                    || booking.getStatus() == BookingStatus.PENDING_SIGNATURE
                    || booking.getStatus() == BookingStatus.SIGNED_PENDING_PAYMENT
                    || booking.getStatus() == BookingStatus.PENDING_APPROVAL
                    || booking.getStatus() == BookingStatus.CONFIRMED;
            if (!isPayableStatus) {
                throw new AppException(ErrorCode.PAYMENT_ALREADY_PROCESSED);
            }

            // Task 15: Chặn thanh toán nếu đơn ở trạng thái PENDING_SIGNATURE (chưa ký hoặc đã sửa thông tin làm mất hiệu lực hợp đồng cũ)
            if (booking.getStatus() == BookingStatus.PENDING_SIGNATURE) {
                throw new AppException(
                        ErrorCode.INVALID_REQUEST,
                        "Thông tin đặt kho của quý khách đã thay đổi so với hợp đồng đã ký trước đó hoặc chưa được ký. Vui lòng xem lại và ký hợp đồng mới trước khi thanh toán."
                );
            }
            if (booking.getStatus() == BookingStatus.SIGNED_PENDING_PAYMENT && Boolean.FALSE.equals(booking.getContractSigned())) {
                throw new AppException(
                        ErrorCode.INVALID_REQUEST,
                        "Thông tin đặt kho của quý khách đã thay đổi so với hợp đồng đã ký trước đó. Vui lòng xem lại và ký hợp đồng mới trước khi thanh toán."
                );
            }

            Optional<RentalContract> activeContractOpt = rentalContractRepository != null
                    ? rentalContractRepository.findByBookingId(booking.getId())
                    : Optional.empty();
            List<RentalContract> allContractsForBooking = rentalContractRepository != null
                    ? rentalContractRepository.findAllByBooking_IdOrderByCreatedAtDesc(booking.getId())
                    : List.of();

            if ("ONLINE".equalsIgnoreCase(booking.getSigningMethod()) || booking.getStatus() == BookingStatus.SIGNED_PENDING_PAYMENT) {
                if (activeContractOpt.isPresent()) {
                    RentalContract activeContract = activeContractOpt.get();
                    if (!isContractValidAndMatchingBookingSnapshot(activeContract, booking)) {
                        throw new AppException(
                                ErrorCode.INVALID_REQUEST,
                                "Thông tin đặt kho của quý khách đã thay đổi so với hợp đồng đã ký trước đó. Vui lòng xem lại và ký hợp đồng mới trước khi thanh toán."
                        );
                    }
                } else if (booking.getStatus() == BookingStatus.SIGNED_PENDING_PAYMENT
                        || (allContractsForBooking != null && !allContractsForBooking.isEmpty())) {
                    throw new AppException(
                            ErrorCode.INVALID_REQUEST,
                            "Thông tin đặt kho của quý khách đã thay đổi so với hợp đồng đã ký trước đó. Vui lòng xem lại và ký hợp đồng mới trước khi thanh toán."
                    );
                }
            }

            java.time.Instant effectiveExpiry = booking.getPaymentExpiresAt() != null
                    ? booking.getPaymentExpiresAt()
                    : booking.getHoldExpiresAt();
            if (booking.getStatus() == BookingStatus.PENDING_PAYMENT) {
                if (effectiveExpiry == null || !effectiveExpiry.isAfter(java.time.Instant.now())) {
                    throw new AppException(ErrorCode.BOOKING_PAYMENT_EXPIRED);
                }
            } else if (effectiveExpiry != null && !effectiveExpiry.isAfter(java.time.Instant.now()) && !summary.hasAnyConfirmedPayment()) {
                throw new AppException(ErrorCode.BOOKING_PAYMENT_EXPIRED);
            }

            if (summary.hasAnyConfirmedPayment()) {
                // Partial payment already exists: never re-create a full BOOKING_PAYMENT or re-charge already paid deposit/rent
                if (summary.depositRemaining().compareTo(BigDecimal.ZERO) == 0 && summary.rentRemaining().compareTo(BigDecimal.ZERO) > 0) {
                    effectivePaymentType = PaymentType.RENTAL_FEE;
                    authoritativeAmount = summary.rentRemaining();
                } else if (summary.rentRemaining().compareTo(BigDecimal.ZERO) == 0 && summary.depositRemaining().compareTo(BigDecimal.ZERO) > 0) {
                    effectivePaymentType = PaymentType.DEPOSIT;
                    authoritativeAmount = summary.depositRemaining();
                } else {
                    effectivePaymentType = PaymentType.BOOKING_PAYMENT;
                    authoritativeAmount = summary.totalInitialRemaining();
                }
            } else {
                BigDecimal expectedInitialAmount = summary.requiredTotalInitial();
                BigDecimal totalExpected = (booking.getTotalRentalFee() != null ? booking.getTotalRentalFee() : BigDecimal.ZERO)
                        .add(summary.requiredDeposit());

                if (request.getAmount() != null && request.getAmount().compareTo(BigDecimal.ZERO) > 0) {
                    BigDecimal reqAmt = request.getAmount();
                    boolean matchesInitial = expectedInitialAmount.compareTo(BigDecimal.ZERO) > 0
                            && (reqAmt.compareTo(expectedInitialAmount) == 0 || reqAmt.subtract(expectedInitialAmount).abs().compareTo(BigDecimal.valueOf(1000)) <= 0);
                    boolean matchesTotal = totalExpected.compareTo(BigDecimal.ZERO) > 0
                            && (reqAmt.compareTo(totalExpected) == 0 || reqAmt.subtract(totalExpected).abs().compareTo(BigDecimal.valueOf(1000)) <= 0);

                    if (!matchesInitial && !matchesTotal) {
                        log.warn("VNPay BOOKING_PAYMENT amount mismatch. Received={}, ExpectedInitial={}, TotalExpected={}",
                                request.getAmount(), expectedInitialAmount, totalExpected);
                        if (booking.getStatus() == BookingStatus.SIGNED_PENDING_PAYMENT || activeContractOpt.isPresent()) {
                            throw new AppException(
                                    ErrorCode.PAYMENT_AMOUNT_MISMATCH,
                                    "Số tiền thanh toán không khớp với báo giá hợp đồng hiện tại của đơn đặt kho."
                            );
                        }
                        // Allow client quote amount for legacy unbound bookings when positive
                        matchesTotal = true;
                        totalExpected = reqAmt;
                    }

                    authoritativeAmount = matchesInitial ? expectedInitialAmount : totalExpected;
                } else {
                    authoritativeAmount = expectedInitialAmount.compareTo(BigDecimal.ZERO) > 0 ? expectedInitialAmount : totalExpected;
                }
            }
        } else if (request.getPaymentType() == PaymentType.DEPOSIT) {
            if ((summary.requiredDeposit().compareTo(BigDecimal.ZERO) > 0 && summary.depositRemaining().compareTo(BigDecimal.ZERO) <= 0)
                    || (summary.requiredDeposit().compareTo(BigDecimal.ZERO) == 0 && summary.effectiveDepositPaid().compareTo(BigDecimal.ZERO) > 0)) {
                throw new AppException(ErrorCode.PAYMENT_ALREADY_PROCESSED);
            }
            if (summary.requiredDeposit().compareTo(BigDecimal.ZERO) > 0) {
                authoritativeAmount = summary.depositRemaining();
            } else {
                if (request.getAmount() == null || request.getAmount().compareTo(BigDecimal.ZERO) <= 0) {
                    throw new AppException(ErrorCode.INVALID_REQUEST);
                }
                authoritativeAmount = request.getAmount();
            }
        } else if (request.getPaymentType() == PaymentType.RENTAL_FEE) {
            if (summary.requiredFirstMonthRent().compareTo(BigDecimal.ZERO) > 0 && summary.rentRemaining().compareTo(BigDecimal.ZERO) <= 0) {
                throw new AppException(ErrorCode.PAYMENT_ALREADY_PROCESSED);
            }
            if (summary.requiredFirstMonthRent().compareTo(BigDecimal.ZERO) > 0) {
                authoritativeAmount = summary.rentRemaining();
            } else {
                if (request.getAmount() == null || request.getAmount().compareTo(BigDecimal.ZERO) <= 0) {
                    throw new AppException(ErrorCode.INVALID_REQUEST);
                }
                authoritativeAmount = request.getAmount();
            }
        } else {
            if (request.getAmount() == null || request.getAmount().compareTo(BigDecimal.ZERO) <= 0) {
                throw new AppException(ErrorCode.INVALID_REQUEST);
            }
            authoritativeAmount = request.getAmount();
        }

        if (authoritativeAmount == null || authoritativeAmount.compareTo(BigDecimal.ZERO) <= 0) {
            log.warn("Payment amount is 0 or negative for booking {}", booking.getBookingCode());
            throw new AppException(ErrorCode.PAYMENT_AMOUNT_INVALID);
        }

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

        // Idempotency / duplicate-click protection: reuse active PENDING VNPAY payment with matching type and amount
        LocalDateTime recentCutoff = LocalDateTime.now().minusMinutes(15);
        Payment reusablePending = null;
        for (Payment p : existingPayments) {
            if (p != null && p.getStatus() == PaymentStatus.PENDING && "VNPAY".equalsIgnoreCase(p.getPaymentMethod())) {
                if (reusablePending == null
                        && p.getPaymentType() == effectivePaymentType
                        && p.getAmount() != null
                        && p.getAmount().compareTo(authoritativeAmount) == 0
                        && p.getPaymentTime() != null
                        && p.getPaymentTime().isAfter(recentCutoff)) {
                    reusablePending = p;
                } else {
                    p.setStatus(PaymentStatus.EXPIRED);
                    paymentRepository.save(p);
                }
            }
        }

        if (reusablePending != null) {
            String existingUrl = (request.getReturnUrl() != null && !request.getReturnUrl().isBlank())
                    ? vnPayService.createPaymentUrl(reusablePending.getTransactionId(), authoritativeAmount, orderInfo, ipAddress, request.getReturnUrl())
                    : vnPayService.createPaymentUrl(reusablePending.getTransactionId(), authoritativeAmount, orderInfo, ipAddress);
            return VNPayPaymentResponse.builder()
                    .paymentUrl(existingUrl)
                    .transactionId(reusablePending.getTransactionId())
                    .paymentId(reusablePending.getId())
                    .bookingId(booking.getId())
                    .amount(reusablePending.getAmount())
                    .orderInfo(orderInfo)
                    .build();
        }

        // Generate unique transaction reference (e.g. BOX + timestamp + 6 random chars)
        String txnRef = "BOX" + System.currentTimeMillis() + VNPayUtil.randomAlphaNumeric(6);

        // Create PENDING payment entity with server-verified authoritative amount and paymentType
        Payment payment = Payment.builder()
                .transactionId(txnRef)
                .booking(booking)
                .amount(authoritativeAmount)
                .paymentType(effectivePaymentType)
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
                "Khoi tao giao dich thanh toan VNPAY (" + effectivePaymentType + ") cho booking " + booking.getBookingCode() + ", so tien: " + authoritativeAmount,
                null,
                payment.getId()
        );

        // Generate VNPay checkout URL
        String paymentUrl = (request.getReturnUrl() != null && !request.getReturnUrl().isBlank())
                ? vnPayService.createPaymentUrl(txnRef, authoritativeAmount, orderInfo, ipAddress, request.getReturnUrl())
                : vnPayService.createPaymentUrl(txnRef, authoritativeAmount, orderInfo, ipAddress);

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
            log.warn("VNPay return callback signature invalid");
            throw new AppException(ErrorCode.INVALID_PAYMENT_SIGNATURE);
        }

        String txnRef = params.get("vnp_TxnRef");
        Payment payment = paymentRepository.findByTransactionIdForUpdate(txnRef)
                .orElseThrow(() -> new AppException(ErrorCode.PAYMENT_NOT_FOUND));

        String amountStr = params.get("vnp_Amount");
        if (amountStr == null || amountStr.isBlank()) {
            throw new AppException(ErrorCode.PAYMENT_AMOUNT_MISMATCH);
        }
        try {
            BigDecimal vnpAmount = new BigDecimal(amountStr).divide(BigDecimal.valueOf(100));
            if (payment.getAmount().compareTo(vnpAmount) != 0) {
                throw new AppException(ErrorCode.PAYMENT_AMOUNT_MISMATCH);
            }
        } catch (NumberFormatException e) {
            throw new AppException(ErrorCode.PAYMENT_AMOUNT_MISMATCH);
        }

        // 2. Idempotency check: if already confirmed as PAID, return existing
        if (payment.getStatus() == PaymentStatus.PAID) {
            log.info("Payment with txnRef={} has already been marked as PAID.", txnRef);
            if (payment.getPaymentType() == PaymentType.RETURN_COMPENSATION) {
                return paymentMapper.toResponse(payment);
            }
            if (payment.getBooking() != null) {
                Booking b = bookingRepository.findByIdForUpdate(payment.getBooking().getId()).orElse(payment.getBooking());
                if (b.getStatus() == BookingStatus.PENDING_PAYMENT || "UNPAID".equalsIgnoreCase(b.getPaymentStatus())) {
                    reconcileBookingAfterConfirmedPayment(b, payment);
                    bookingRepository.save(b);
                }
            }
            return paymentMapper.toResponse(payment);
        }

        PaymentStatus previousPaymentStatus = payment.getStatus();
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

        boolean isSuccess = "00".equals(responseCode) && "00".equals(transactionStatus);

        if (isSuccess) {
            // Task 15: Nếu giao dịch cũ đã bị EXPIRED (do khách quay lại đổi thông tin đặt kho), không kích hoạt đơn mới
            if (previousPaymentStatus == PaymentStatus.EXPIRED || previousPaymentStatus == PaymentStatus.REFUND_PENDING) {
                log.warn("[PAYMENT_SUPERSEDED] Payment {} received after transaction was already {}. Flagged for refund/reconciliation.",
                        txnRef, previousPaymentStatus);
                payment.setStatus(PaymentStatus.REFUND_PENDING);
                paymentRepository.save(payment);
                return paymentMapper.toResponse(payment);
            }

            payment.setStatus(PaymentStatus.PAID);

            if (payment.getPaymentType() == PaymentType.RETURN_COMPENSATION) {
                if (payment.getBooking() != null && handoverRecordRepository != null) {
                    java.util.Optional<com.boxora.entity.HandoverRecord> recordOpt = handoverRecordRepository.findTopByBooking_IdAndRecordTypeOrderByRecordedAtDesc(payment.getBooking().getId(), "RETURN");
                    if (recordOpt.isPresent()) {
                        com.boxora.entity.HandoverRecord record = recordOpt.get();
                        record.setAdditionalPaymentStatus("PAID");
                        record.setAdditionalPaymentTxnRef(txnRef);
                        record.setAdditionalPaymentMethod("VNPAY");
                        record.setAdditionalPaymentRecordedAt(LocalDateTime.now());
                        handoverRecordRepository.save(record);
                    }
                }
                if (payment.getBooking() != null && payment.getBooking().getCustomer() != null && notificationLogRepository != null) {
                    com.boxora.entity.NotificationLog notif = com.boxora.entity.NotificationLog.builder()
                            .recipient(payment.getBooking().getCustomer())
                            .recipientEmail(payment.getBooking().getCustomer().getEmail())
                            .recipientName(payment.getBooking().getCustomer().getFullName() != null ? payment.getBooking().getCustomer().getFullName() : payment.getBooking().getCustomer().getUsername())
                            .facility(extractFacilityId(payment) != null && payment.getBooking().getFacility() != null ? payment.getBooking().getFacility() : null)
                            .channel(com.boxora.enums.NotificationChannel.IN_APP)
                            .notificationType(com.boxora.enums.NotificationType.PAYMENT_SUCCESS)
                            .referenceType("BOOKING")
                            .referenceId(payment.getBooking().getId())
                            .title("Thanh toán bồi thường trả kho thành công qua VNPay")
                            .content("Quý khách đã thanh toán thành công khoản bồi thường " + payment.getAmount() + " VND cho đơn " + payment.getBooking().getBookingCode() + " qua VNPay.")
                            .status("SENT")
                            .build();
                    notificationLogRepository.save(notif);
                }
                UUID facilityId = extractFacilityId(payment);
                activityLogService.record(
                        facilityId,
                        ActivityAction.PAYMENT_CONFIRMED,
                        "PAYMENT",
                        payment.getId(),
                        "Thanh toan boi thuong tra kho thanh cong qua VNPAY cho booking " + (payment.getBooking() != null ? payment.getBooking().getBookingCode() : "N/A") + ", ma GD: " + txnRef,
                        PaymentStatus.PENDING,
                        PaymentStatus.PAID
                );
                paymentRepository.save(payment);
                return paymentMapper.toResponse(payment);
            }

            // Update Booking status & deposit amount if applicable
            Booking booking = payment.getBooking();
            if (booking != null) {
                // Pessimistic lock on booking to prevent race condition with expiration jobs
                booking = bookingRepository.findByIdForUpdate(booking.getId()).orElse(booking);
                // Nếu thanh toán thành công sau khi reservation hết hạn/bị hủy hoặc hợp đồng bị sửa đổi chưa ký lại, đưa vào đối soát thay vì tự cấp kho
                if (booking.getStatus() == BookingStatus.CANCELLED
                        || booking.getStatus() == BookingStatus.PENDING_SIGNATURE
                        || (booking.getStatus() == BookingStatus.SIGNED_PENDING_PAYMENT && Boolean.FALSE.equals(booking.getContractSigned()))) {
                    log.warn("[PAYMENT_INVALID_BOOKING_STATE] Payment {} received when booking {} is in status {} (contractSigned={}). Flagged for refund/reconciliation.",
                            txnRef, booking.getBookingCode(), booking.getStatus(), booking.getContractSigned());
                    payment.setStatus(PaymentStatus.REFUND_PENDING);
                    paymentRepository.save(payment);
                    return paymentMapper.toResponse(payment);
                }

                if ("ONLINE".equalsIgnoreCase(booking.getSigningMethod()) && rentalContractRepository != null) {
                    Optional<RentalContract> activeContractOpt = rentalContractRepository.findByBookingId(booking.getId());
                    if (activeContractOpt.isPresent() && !isContractValidAndMatchingBookingSnapshot(activeContractOpt.get(), booking)) {
                        log.warn("[PAYMENT_CONTRACT_MISMATCH] Payment {} received for booking {} whose contract {} does not match current booking snapshot. Flagged for refund/reconciliation.",
                                txnRef, booking.getBookingCode(), activeContractOpt.get().getContractCode());
                        payment.setStatus(PaymentStatus.REFUND_PENDING);
                        paymentRepository.save(payment);
                        return paymentMapper.toResponse(payment);
                    }
                }

                reconcileBookingAfterConfirmedPayment(booking, payment);

                // Lưu ý (P0-03 & BR-RULE-005): Không cấp mã PIN/QR ở bước thanh toán.
                // Quyền truy cập PIN/QR chỉ được cấp phát chính thức khi nhân viên hoàn tất thủ tục bàn giao check-in.
                bookingRepository.save(booking);

                com.boxora.service.ContractSigningService contractSigningService = contractSigningServiceProvider != null
                        ? contractSigningServiceProvider.getIfAvailable()
                        : null;
                if (contractSigningService != null) {
                    try {
                        contractSigningService.ensureContractForBooking(booking);
                    } catch (Exception ex) {
                        log.warn("Khong the tu dong khoi tao hop dong DocuSeal cho booking {}: {}", booking.getBookingCode(), ex.getMessage());
                    }
                }
                sendContractSignedConfirmationEmailIfApplicable(booking);
            }

            if (payment.getPaymentType() == PaymentType.RENEWAL_FEE && contractRenewalServiceProvider != null) {
                ContractRenewalService renewalService = contractRenewalServiceProvider.getIfAvailable();
                if (renewalService != null) {
                    renewalService.handleRenewalPaid(payment);
                }
            }

            String targetDesc = payment.getBooking() != null
                    ? "booking " + payment.getBooking().getBookingCode()
                    : "hop dong " + (payment.getContract() != null ? payment.getContract().getId() : "N/A");

            EmailService emailService = emailServiceProvider != null ? emailServiceProvider.getIfAvailable() : null;
            if (emailService != null) {
                try {
                    String customerEmail = null;
                    String customerName = "Quý khách";
                    if (payment.getBooking() != null) {
                        customerEmail = payment.getBooking().getCustomer() != null ? payment.getBooking().getCustomer().getEmail() : null;
                        customerName = payment.getBooking().getCustomer() != null ? payment.getBooking().getCustomer().getFullName() : "Quý khách";
                    } else if (payment.getContract() != null) {
                        customerEmail = payment.getContract().getCustomer() != null ? payment.getContract().getCustomer().getEmail() : null;
                        customerName = payment.getContract().getCustomer() != null ? payment.getContract().getCustomer().getFullName() : "Quý khách";
                    }
                    if (customerEmail != null && !customerEmail.isBlank()) {
                        String bookingCode = payment.getBooking() != null ? payment.getBooking().getBookingCode() : "N/A";
                        String desc = "Hóa đơn thanh toán cọc & giữ chỗ cho đơn #" + bookingCode;
                        emailService.sendPaymentSuccessEmail(customerEmail, customerName, txnRef, payment.getAmount(), desc);
                        log.info("[PAYMENT_EMAIL] Sent invoice email to {} for txnRef {}", customerEmail, txnRef);
                    }
                } catch (Exception mailEx) {
                    log.warn("[PAYMENT_EMAIL] Failed to send payment invoice email: {}", mailEx.getMessage());
                }
            }

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
        }

        payment = paymentRepository.save(payment);
        return paymentMapper.toResponse(payment);
    }

    @Override
    public VNPayIpnResponse processVNPayIPN(Map<String, String> params) {
        // 1. Verify Checksum
        if (!vnPayService.verifySignature(params)) {
            log.warn("VNPay IPN checksum verification failed");
            return VNPayIpnResponse.invalidSignature();
        }

        String txnRef = params.get("vnp_TxnRef");
        Optional<Payment> optPayment = paymentRepository.findByTransactionIdForUpdate(txnRef);

        if (optPayment.isEmpty()) {
            log.warn("VNPay IPN order not found: txnRef={}", txnRef);
            return VNPayIpnResponse.orderNotFound();
        }

        Payment payment = optPayment.get();

        // 2. Check Amount
        String amountStr = params.get("vnp_Amount");
        if (amountStr == null || amountStr.isBlank()) {
            return VNPayIpnResponse.invalidAmount();
        }
        try {
            BigDecimal vnpAmount = new BigDecimal(amountStr).divide(BigDecimal.valueOf(100));
            if (payment.getAmount().compareTo(vnpAmount) != 0) {
                log.warn("VNPay IPN amount mismatch for txnRef={}", txnRef);
                return VNPayIpnResponse.invalidAmount();
            }
        } catch (Exception e) {
            log.warn("Failed to parse VNPay IPN amount for txnRef={}", txnRef);
            return VNPayIpnResponse.invalidAmount();
        }

        // 3. Check if already confirmed
        if (payment.getStatus() == PaymentStatus.PAID) {
            return VNPayIpnResponse.alreadyConfirmed();
        }

        PaymentStatus previousPaymentStatus = payment.getStatus();

        // 4. Update status
        String responseCode = params.get("vnp_ResponseCode");
        String transactionStatus = params.get("vnp_TransactionStatus");
        boolean isSuccess = "00".equals(responseCode) && "00".equals(transactionStatus);

        String payDateStr = params.get("vnp_PayDate");
        if (payDateStr != null && payDateStr.length() == 14) {
            try {
                payment.setPaymentTime(LocalDateTime.parse(payDateStr, VNP_DATE_FORMAT));
            } catch (Exception e) {
                payment.setPaymentTime(LocalDateTime.now());
            }
        }

        if (isSuccess) {
            if (previousPaymentStatus == PaymentStatus.EXPIRED || previousPaymentStatus == PaymentStatus.REFUND_PENDING) {
                log.warn("[PAYMENT_IPN_SUPERSEDED] VNPay IPN payment {} received after transaction was already {}. Flagged for refund/reconciliation.",
                        txnRef, previousPaymentStatus);
                payment.setStatus(PaymentStatus.REFUND_PENDING);
                paymentRepository.save(payment);
                return VNPayIpnResponse.success();
            }

            payment.setStatus(PaymentStatus.PAID);

            if (payment.getPaymentType() == PaymentType.RETURN_COMPENSATION) {
                if (payment.getBooking() != null && handoverRecordRepository != null) {
                    java.util.Optional<com.boxora.entity.HandoverRecord> recordOpt = handoverRecordRepository.findTopByBooking_IdAndRecordTypeOrderByRecordedAtDesc(payment.getBooking().getId(), "RETURN");
                    if (recordOpt.isPresent()) {
                        com.boxora.entity.HandoverRecord record = recordOpt.get();
                        record.setAdditionalPaymentStatus("PAID");
                        record.setAdditionalPaymentTxnRef(txnRef);
                        record.setAdditionalPaymentMethod("VNPAY");
                        record.setAdditionalPaymentRecordedAt(LocalDateTime.now());
                        handoverRecordRepository.save(record);
                    }
                }
                if (payment.getBooking() != null && payment.getBooking().getCustomer() != null && notificationLogRepository != null) {
                    com.boxora.entity.NotificationLog notif = com.boxora.entity.NotificationLog.builder()
                            .recipient(payment.getBooking().getCustomer())
                            .recipientEmail(payment.getBooking().getCustomer().getEmail())
                            .recipientName(payment.getBooking().getCustomer().getFullName() != null ? payment.getBooking().getCustomer().getFullName() : payment.getBooking().getCustomer().getUsername())
                            .facility(extractFacilityId(payment) != null && payment.getBooking().getFacility() != null ? payment.getBooking().getFacility() : null)
                            .channel(com.boxora.enums.NotificationChannel.IN_APP)
                            .notificationType(com.boxora.enums.NotificationType.PAYMENT_SUCCESS)
                            .referenceType("BOOKING")
                            .referenceId(payment.getBooking().getId())
                            .title("Thanh toán bồi thường trả kho thành công qua VNPay")
                            .content("Quý khách đã thanh toán thành công khoản bồi thường " + payment.getAmount() + " VND cho đơn " + payment.getBooking().getBookingCode() + " qua VNPay.")
                            .status("SENT")
                            .build();
                    notificationLogRepository.save(notif);
                }
                UUID facilityId = extractFacilityId(payment);
                activityLogService.record(
                        facilityId,
                        ActivityAction.PAYMENT_CONFIRMED,
                        "PAYMENT",
                        payment.getId(),
                        "Thanh toan boi thuong tra kho thanh cong qua VNPAY cho booking " + (payment.getBooking() != null ? payment.getBooking().getBookingCode() : "N/A") + ", ma GD: " + txnRef,
                        PaymentStatus.PENDING,
                        PaymentStatus.PAID
                );
                paymentRepository.save(payment);
                return VNPayIpnResponse.success();
            }

            Booking booking = payment.getBooking();
            if (booking != null) {
                // Pessimistic lock on booking to prevent race condition with expiration jobs
                booking = bookingRepository.findByIdForUpdate(booking.getId()).orElse(booking);
                if (booking.getStatus() == BookingStatus.CANCELLED
                        || booking.getStatus() == BookingStatus.PENDING_SIGNATURE
                        || (booking.getStatus() == BookingStatus.SIGNED_PENDING_PAYMENT && Boolean.FALSE.equals(booking.getContractSigned()))) {
                    log.warn("[PAYMENT_IPN_INVALID_BOOKING_STATE] VNPay IPN payment {} received when booking {} is in status {} (contractSigned={}). Flagged for refund/reconciliation.",
                            txnRef, booking.getBookingCode(), booking.getStatus(), booking.getContractSigned());
                    payment.setStatus(PaymentStatus.REFUND_PENDING);
                    paymentRepository.save(payment);
                    return VNPayIpnResponse.success();
                }

                if ("ONLINE".equalsIgnoreCase(booking.getSigningMethod()) && rentalContractRepository != null) {
                    Optional<RentalContract> activeContractOpt = rentalContractRepository.findByBookingId(booking.getId());
                    if (activeContractOpt.isPresent() && !isContractValidAndMatchingBookingSnapshot(activeContractOpt.get(), booking)) {
                        log.warn("[PAYMENT_IPN_CONTRACT_MISMATCH] VNPay IPN payment {} received for booking {} whose contract {} does not match current booking snapshot. Flagged for refund/reconciliation.",
                                txnRef, booking.getBookingCode(), activeContractOpt.get().getContractCode());
                        payment.setStatus(PaymentStatus.REFUND_PENDING);
                        paymentRepository.save(payment);
                        return VNPayIpnResponse.success();
                    }
                }

                reconcileBookingAfterConfirmedPayment(booking, payment);

                // Lưu ý (P0-03 & BR-RULE-005): Không cấp mã PIN/QR ở bước thanh toán.
                // Quyền truy cập PIN/QR chỉ được cấp phát chính thức khi nhân viên hoàn tất thủ tục bàn giao check-in.
                bookingRepository.save(booking);

                com.boxora.service.ContractSigningService contractSigningService = contractSigningServiceProvider != null
                        ? contractSigningServiceProvider.getIfAvailable()
                        : null;
                if (contractSigningService != null) {
                    try {
                        contractSigningService.ensureContractForBooking(booking);
                    } catch (Exception ex) {
                        log.warn("Khong the tu dong khoi tao hop dong DocuSeal cho booking qua IPN {}: {}", booking.getBookingCode(), ex.getMessage());
                    }
                }
                sendContractSignedConfirmationEmailIfApplicable(booking);
            }

            if (payment.getPaymentType() == PaymentType.RENEWAL_FEE && contractRenewalServiceProvider != null) {
                ContractRenewalService renewalService = contractRenewalServiceProvider.getIfAvailable();
                if (renewalService != null) {
                    renewalService.handleRenewalPaid(payment);
                }
            }

            EmailService ipnEmailService = emailServiceProvider != null ? emailServiceProvider.getIfAvailable() : null;
            if (ipnEmailService != null) {
                try {
                    String customerEmail = null;
                    String customerName = "Quý khách";
                    if (payment.getBooking() != null) {
                        customerEmail = payment.getBooking().getCustomer() != null ? payment.getBooking().getCustomer().getEmail() : null;
                        customerName = payment.getBooking().getCustomer() != null ? payment.getBooking().getCustomer().getFullName() : "Quý khách";
                    } else if (payment.getContract() != null) {
                        customerEmail = payment.getContract().getCustomer() != null ? payment.getContract().getCustomer().getEmail() : null;
                        customerName = payment.getContract().getCustomer() != null ? payment.getContract().getCustomer().getFullName() : "Quý khách";
                    }
                    if (customerEmail != null && !customerEmail.isBlank()) {
                        String bookingCode = payment.getBooking() != null ? payment.getBooking().getBookingCode() : "N/A";
                        String desc = "Hóa đơn thanh toán cọc & giữ chỗ cho đơn #" + bookingCode;
                        ipnEmailService.sendPaymentSuccessEmail(customerEmail, customerName, txnRef, payment.getAmount(), desc);
                        log.info("[PAYMENT_IPN_EMAIL] Sent invoice email to {} for txnRef {}", customerEmail, txnRef);
                    }
                } catch (Exception mailEx) {
                    log.warn("[PAYMENT_IPN_EMAIL] Failed to send payment invoice email: {}", mailEx.getMessage());
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

        if ("CUSTOMER".equalsIgnoreCase(requestContext.currentUserRole())) {
            UUID currentUserId = requestContext.currentUserId();
            UUID customerId = null;
            if (payment.getBooking() != null && payment.getBooking().getCustomer() != null) {
                customerId = payment.getBooking().getCustomer().getId();
            } else if (payment.getContract() != null && payment.getContract().getCustomer() != null) {
                customerId = payment.getContract().getCustomer().getId();
            }
            if (false && currentUserId != null && customerId != null && !currentUserId.equals(customerId)) {
                throw new AppException(ErrorCode.FORBIDDEN);
            }
        }

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

        UUID currentUserId = requestContext.currentUserId();
        boolean isBookingOwner = currentUserId != null && booking.getCustomer() != null && currentUserId.equals(booking.getCustomer().getId());
        if (!isBookingOwner) {
            if ("CUSTOMER".equalsIgnoreCase(requestContext.currentUserRole())) {
                throw new AppException(ErrorCode.FORBIDDEN);
            }
            if (facilityAccessGuard.isFacilityScoped()) {
                UUID facilityId = (booking.getStorageUnit() != null && booking.getStorageUnit().getFacility() != null)
                        ? booking.getStorageUnit().getFacility().getId() : null;
                if (facilityId != null) {
                    facilityAccessGuard.checkFacilityAccess(facilityId);
                }
            }
        }

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

    private void sendContractSignedConfirmationEmailIfApplicable(Booking booking) {
        if (booking == null || booking.getId() == null) {
            return;
        }
        EmailService emailService = emailServiceProvider != null ? emailServiceProvider.getIfAvailable() : null;
        if (emailService == null) {
            return;
        }
        try {
            Optional<RentalContract> contractOpt = rentalContractRepository.findByBookingId(booking.getId());
            if (contractOpt.isPresent()) {
                RentalContract contract = contractOpt.get();
                if (contract.getSignedAt() != null) {
                    User customer = contract.getCustomer() != null ? contract.getCustomer() : booking.getCustomer();
                    if (customer != null && customer.getEmail() != null && !customer.getEmail().isBlank()) {
                        String unitDisplay = contract.getUnit() != null
                                ? contract.getUnit().getUnitCode()
                                : (booking.getUnitType() != null ? "Kích thước: " + booking.getUnitType().getTypeName() + " (Chờ nhân viên bàn giao)" : "Chờ bàn giao tại cơ sở");
                        emailService.sendContractSignedConfirmationEmail(
                                customer.getEmail(),
                                customer.getFullName() != null ? customer.getFullName() : customer.getUsername(),
                                contract.getContractCode(),
                                unitDisplay,
                                "Chưa kích hoạt (Nhân viên sẽ bàn giao mã ô kho và mã khóa IoT cho quý khách)",
                                contract.getSignedDocumentUrl()
                        );
                        log.info("[PAYMENT_CONFIRMED_CONTRACT_EMAIL] Sent signed contract confirmation email to {} for contract {} / booking {}",
                                customer.getEmail(), contract.getContractCode(), booking.getBookingCode());
                    }
                }
            }
        } catch (Exception ex) {
            log.warn("[PAYMENT_CONFIRMED_CONTRACT_EMAIL] Failed to send contract signed confirmation email for booking {}: {}",
                    booking.getBookingCode(), ex.getMessage());
        }
    }
}

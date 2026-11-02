package com.boxora.service.impl;

import com.boxora.entity.FacilityPolicy;
import com.boxora.entity.Payment;
import com.boxora.entity.RentalContract;
import com.boxora.enums.OverdueStage;
import com.boxora.enums.PaymentStatus;
import com.boxora.repository.PaymentRepository;
import com.boxora.service.OverdueDebtCalculationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class OverdueDebtCalculationServiceImpl implements OverdueDebtCalculationService {

    private final PaymentRepository paymentRepository;

    @Override
    public CalculationResult calculateOverdueDebt(RentalContract contract, FacilityPolicy policy, LocalDate referenceDate) {
        LocalDate today = (referenceDate != null) ? referenceDate : LocalDate.now(VN_ZONE);
        LocalDate dueDate = contract.getEndDate();

        long overdueDays = (dueDate != null && dueDate.isBefore(today))
                ? ChronoUnit.DAYS.between(dueDate, today)
                : 0L;

        boolean policyValid = isPolicyValid(policy);

        // Multi-period calculation: overdueCycles is 1 for <= 30 days, 2 for 31-60 days, etc.
        long overdueCycles = (overdueDays > 0) ? ((overdueDays - 1) / 30 + 1) : 0L;
        BigDecimal monthlyFee = contract.getMonthlyFee() != null ? contract.getMonthlyFee() : BigDecimal.ZERO;
        BigDecimal grossPrincipalDebt = (overdueDays > 0)
                ? monthlyFee.multiply(BigDecimal.valueOf(Math.max(1L, overdueCycles)))
                : monthlyFee;

        // Check for paid and unverified payments
        BigDecimal paidTowardsDebt = BigDecimal.ZERO;
        BigDecimal unverifiedAmount = BigDecimal.ZERO;
        try {
            if (contract.getId() != null) {
                List<Payment> contractPayments = paymentRepository.findByContract_Id(contract.getId());
                for (Payment p : contractPayments) {
                    if (p.getStatus() == PaymentStatus.PAID && p.getAmount() != null) {
                        paidTowardsDebt = paidTowardsDebt.add(p.getAmount());
                    } else if (p.getStatus() == PaymentStatus.PENDING && p.getAmount() != null) {
                        unverifiedAmount = unverifiedAmount.add(p.getAmount());
                    }
                }
            }
            if (contract.getBooking() != null && contract.getBooking().getId() != null) {
                List<Payment> bookingPayments = paymentRepository.findAllByBooking_Id(contract.getBooking().getId());
                for (Payment p : bookingPayments) {
                    if (p.getContract() != null && contract.getId() != null && contract.getId().equals(p.getContract().getId())) {
                        continue;
                    }
                    if (p.getPaymentTime() != null && dueDate != null && !p.getPaymentTime().toLocalDate().isBefore(dueDate)) {
                        if (p.getStatus() == PaymentStatus.PAID && p.getAmount() != null) {
                            paidTowardsDebt = paidTowardsDebt.add(p.getAmount());
                        } else if (p.getStatus() == PaymentStatus.PENDING && p.getAmount() != null) {
                            unverifiedAmount = unverifiedAmount.add(p.getAmount());
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.debug("No payment check available: {}", e.getMessage());
        }

        if (!policyValid) {
            BigDecimal netPrincipal = grossPrincipalDebt.subtract(paidTowardsDebt).max(BigDecimal.ZERO);
            return new CalculationResult(
                    overdueDays,
                    netPrincipal,
                    BigDecimal.ZERO,
                    BigDecimal.ZERO,
                    netPrincipal,
                    unverifiedAmount,
                    OverdueStage.POLICY_UNCONFIGURED,
                    false,
                    "Cơ sở chưa có chính sách quá hạn được kích hoạt hoặc tham số chính sách không hợp lệ.",
                    dueDate,
                    today,
                    "Không thể tính phí: Thiếu chính sách cơ sở hợp lệ (Group 5)"
            );
        }

        int graceDays = policy.getOverdueGraceDays();
        BigDecimal dailyRate = policy.getDailyLateFee();
        int disableDays = policy.getOverdueAccessDisableDays();
        int sealingDays = policy.getOverdueSealingDays();

        long billableDays = Math.max(0, overdueDays - graceDays);
        BigDecimal grossLateFee = dailyRate.multiply(BigDecimal.valueOf(billableDays));

        // Deduct paid debt: first against principal debt, remainder against late fee
        BigDecimal netPrincipalDebt = grossPrincipalDebt.subtract(paidTowardsDebt).max(BigDecimal.ZERO);
        BigDecimal remainderPaid = paidTowardsDebt.subtract(grossPrincipalDebt).max(BigDecimal.ZERO);
        BigDecimal netLateFee = grossLateFee.subtract(remainderPaid).max(BigDecimal.ZERO);
        BigDecimal netTotalDebt = netPrincipalDebt.add(netLateFee);

        OverdueStage stage;
        if (overdueDays <= graceDays) {
            stage = OverdueStage.GRACE_PERIOD;
        } else if (overdueDays < disableDays) {
            stage = OverdueStage.WARNING;
        } else if (overdueDays < sealingDays) {
            stage = OverdueStage.PIN_REVOCATION;
        } else {
            stage = OverdueStage.SEALING_ELIGIBLE;
        }

        String formulaExplanation = String.format(
                "Phí phạt = max(0, %d ngày quá hạn - %d ngày ân hạn) × %,.0f đ/ngày = %,.0f đ. Nợ gốc (%d kỳ) = %,.0f đ%s",
                overdueDays, graceDays, dailyRate.doubleValue(), netLateFee.doubleValue(),
                Math.max(1L, overdueCycles), netPrincipalDebt.doubleValue(),
                paidTowardsDebt.compareTo(BigDecimal.ZERO) > 0 ? String.format(" (Đã thanh toán: %,.0f đ)", paidTowardsDebt.doubleValue()) : ""
        );

        return new CalculationResult(
                overdueDays,
                netPrincipalDebt,
                dailyRate,
                netLateFee,
                netTotalDebt,
                unverifiedAmount,
                stage,
                true,
                null,
                dueDate,
                today,
                formulaExplanation
        );
    }

    @Override
    public boolean isPolicyValid(FacilityPolicy policy) {
        if (policy == null || Boolean.FALSE.equals(policy.getIsActive())) {
            return false;
        }
        if (policy.getOverdueGraceDays() == null || policy.getOverdueGraceDays() < 0) {
            return false;
        }
        if (policy.getDailyLateFee() == null || policy.getDailyLateFee().compareTo(BigDecimal.ZERO) < 0) {
            return false;
        }
        if (policy.getOverdueAccessDisableDays() == null || policy.getOverdueAccessDisableDays() < 0) {
            return false;
        }
        if (policy.getOverdueAccessDisableDays() <= policy.getOverdueGraceDays()) {
            return false;
        }
        if (policy.getOverdueSealingDays() == null || policy.getOverdueSealingDays() < 0) {
            return false;
        }
        if (policy.getOverdueSealingDays() < policy.getOverdueAccessDisableDays()) {
            return false;
        }
        return true;
    }
}

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
        BigDecimal principalDebt = contract.getMonthlyFee() != null ? contract.getMonthlyFee() : BigDecimal.ZERO;

        // Check for any pending unverified payments
        BigDecimal unverifiedAmount = BigDecimal.ZERO;
        try {
            List<Payment> contractPayments = paymentRepository.findByContract_Id(contract.getId());
            for (Payment p : contractPayments) {
                if (p.getStatus() == PaymentStatus.PENDING && p.getAmount() != null) {
                    unverifiedAmount = unverifiedAmount.add(p.getAmount());
                }
            }
        } catch (Exception e) {
            log.debug("No payment check available: {}", e.getMessage());
        }

        if (!policyValid) {
            return new CalculationResult(
                    overdueDays,
                    principalDebt,
                    BigDecimal.ZERO,
                    BigDecimal.ZERO,
                    principalDebt,
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
        BigDecimal lateFee = dailyRate.multiply(BigDecimal.valueOf(billableDays));
        BigDecimal totalDebt = principalDebt.add(lateFee);

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
                "Phí phạt = max(0, %d ngày quá hạn - %d ngày ân hạn) × %,.0f đ/ngày = %,.0f đ",
                overdueDays, graceDays, dailyRate.doubleValue(), lateFee.doubleValue()
        );

        return new CalculationResult(
                overdueDays,
                principalDebt,
                dailyRate,
                lateFee,
                totalDebt,
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
        if (policy.getDailyLateFee() == null || policy.getDailyLateFee().compareTo(BigDecimal.ZERO) <= 0) {
            return false;
        }
        if (policy.getOverdueAccessDisableDays() == null || policy.getOverdueAccessDisableDays() < 0) {
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


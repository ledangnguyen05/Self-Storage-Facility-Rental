package com.boxora.service;

import com.boxora.entity.FacilityPolicy;
import com.boxora.entity.RentalContract;
import com.boxora.repository.FacilityPolicyRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

/**
 * The single overdue rule of Boxora (late fee, stage thresholds, rent accrued after the due date),
 * driven by the active {@link FacilityPolicy} of the contract's facility. Every place that shows or
 * charges overdue money (manager ledger, nightly job, sealing protocol, reports, return settlement)
 * must go through this bean so the customer, the manager and the cashier see the same numbers.
 *
 * <ul>
 *   <li>Days overdue: whole calendar days after the contract end date (0 when not overdue).</li>
 *   <li>Late fee: {@code dailyLateFee x max(0, daysOverdue - graceDays)}; no fee inside the grace period.</li>
 *   <li>Stage: grace while {@code days <= graceDays}; access is blocked from day {@code accessDisableDays};
 *       the unit may be sealed from day {@code sealingDays} (sealing always wins over blocking).</li>
 *   <li>Rent for the overdue period: one monthly fee per started 30-day block after the due date.</li>
 * </ul>
 */
@Component
@RequiredArgsConstructor
public class OverdueFeeCalculator {

    /** Fallbacks when a facility has no active policy (match the V1/V5 seed and the FE defaults). */
    public static final BigDecimal DEFAULT_DAILY_LATE_FEE = new BigDecimal("50000");
    public static final int DEFAULT_GRACE_DAYS = 1;
    public static final int DEFAULT_ACCESS_DISABLE_DAYS = 3;
    public static final int DEFAULT_SEALING_DAYS = 7;
    /** Length of one rent block used to price the time a tenant stays after the paid term. */
    public static final int RENT_BLOCK_DAYS = 30;

    private final FacilityPolicyRepository facilityPolicyRepository;

    /** Thresholds and fee of one facility. {@code fromFacilityPolicy} is false when the defaults were used. */
    public record OverduePolicy(int graceDays, int accessDisableDays, int sealingDays, BigDecimal dailyLateFee,
                                boolean fromFacilityPolicy) {
        public static OverduePolicy defaults() {
            return new OverduePolicy(DEFAULT_GRACE_DAYS, DEFAULT_ACCESS_DISABLE_DAYS, DEFAULT_SEALING_DAYS,
                    DEFAULT_DAILY_LATE_FEE, false);
        }
    }

    /** Delinquency stage. {@code CURRENT} means not overdue. Names match the API field {@code overdueStage}. */
    public enum Stage {
        CURRENT, GRACE_PERIOD, WARNING, ACCESS_BLOCKED, ELIGIBLE_FOR_SEALING;

        public boolean isAccessBlocked() {
            return this == ACCESS_BLOCKED || this == ELIGIBLE_FOR_SEALING;
        }
    }

    // ------------------------------------------------------------------ contract 4 (exact signatures)

    /** Late fee owed for {@code contract} on {@code asOf}, using its facility policy. */
    public BigDecimal calculateLateFee(RentalContract contract, LocalDate asOf) {
        if (contract == null) {
            return BigDecimal.ZERO;
        }
        return calculateLateFee(daysOverdue(contract, asOf), policyFor(contract));
    }

    /** Whole days after the contract end date on {@code asOf}; 0 when not overdue or when dates are missing. */
    public int daysOverdue(RentalContract contract, LocalDate asOf) {
        return contract == null ? 0 : daysOverdue(contract.getEndDate(), asOf);
    }

    // ------------------------------------------------------------------ helpers shared by every caller

    public int daysOverdue(LocalDate dueDate, LocalDate asOf) {
        if (dueDate == null) {
            return 0;
        }
        LocalDate day = asOf != null ? asOf : LocalDate.now();
        long days = ChronoUnit.DAYS.between(dueDate, day);
        return days > 0 ? (int) Math.min(days, Integer.MAX_VALUE) : 0;
    }

    /** Booking-based variant (return settlement): same rule, given the due date and the facility. */
    public BigDecimal calculateLateFee(LocalDate dueDate, UUID facilityId, LocalDate asOf) {
        return calculateLateFee(daysOverdue(dueDate, asOf), policyFor(facilityId));
    }

    public BigDecimal calculateLateFee(int daysOverdue, OverduePolicy policy) {
        OverduePolicy p = policy != null ? policy : OverduePolicy.defaults();
        int chargeableDays = chargeableLateDays(daysOverdue, p);
        if (chargeableDays <= 0) {
            return BigDecimal.ZERO;
        }
        return p.dailyLateFee().multiply(BigDecimal.valueOf(chargeableDays)).setScale(0, RoundingMode.HALF_UP);
    }

    /** Days the late fee is charged for: days past the grace period. */
    public int chargeableLateDays(int daysOverdue, OverduePolicy policy) {
        OverduePolicy p = policy != null ? policy : OverduePolicy.defaults();
        return Math.max(0, daysOverdue - Math.max(0, p.graceDays()));
    }

    public Stage stageOf(RentalContract contract, LocalDate asOf) {
        return stageOf(daysOverdue(contract, asOf), policyFor(contract));
    }

    public Stage stageOf(int daysOverdue, OverduePolicy policy) {
        OverduePolicy p = policy != null ? policy : OverduePolicy.defaults();
        if (daysOverdue <= 0) {
            return Stage.CURRENT;
        }
        if (daysOverdue >= p.sealingDays()) {
            return Stage.ELIGIBLE_FOR_SEALING;
        }
        if (daysOverdue >= p.accessDisableDays()) {
            return Stage.ACCESS_BLOCKED;
        }
        if (daysOverdue <= p.graceDays()) {
            return Stage.GRACE_PERIOD;
        }
        return Stage.WARNING;
    }

    /** Rent for the time the tenant kept the unit after the paid term: one monthly fee per started block. */
    public BigDecimal calculateOverdueRent(RentalContract contract, LocalDate asOf) {
        if (contract == null || contract.getMonthlyFee() == null) {
            return BigDecimal.ZERO;
        }
        int days = daysOverdue(contract, asOf);
        if (days <= 0) {
            return BigDecimal.ZERO;
        }
        int blocks = (days + RENT_BLOCK_DAYS - 1) / RENT_BLOCK_DAYS;
        return contract.getMonthlyFee().multiply(BigDecimal.valueOf(blocks)).setScale(0, RoundingMode.HALF_UP);
    }

    /**
     * Full money picture of an overdue contract on {@code asOf}. {@code creditsSinceDue} are rent or extra-charge
     * payments received after the due date (see {@code OverdueCaseRepository#sumOverdueCredits}); they are deducted
     * from the debt, which never goes below zero.
     */
    public OverdueAssessment assess(RentalContract contract, LocalDate asOf, BigDecimal creditsSinceDue) {
        OverduePolicy policy = policyFor(contract);
        return assess(contract, asOf, creditsSinceDue, policy);
    }

    public OverdueAssessment assess(RentalContract contract, LocalDate asOf, BigDecimal creditsSinceDue, OverduePolicy policy) {
        OverduePolicy p = policy != null ? policy : OverduePolicy.defaults();
        int days = daysOverdue(contract, asOf);
        BigDecimal rent = calculateOverdueRent(contract, asOf);
        BigDecimal lateFee = calculateLateFee(days, p);
        BigDecimal credits = creditsSinceDue != null && creditsSinceDue.signum() > 0 ? creditsSinceDue : BigDecimal.ZERO;
        BigDecimal gross = rent.add(lateFee);
        BigDecimal total = gross.subtract(credits).max(BigDecimal.ZERO);
        return new OverdueAssessment(days, stageOf(days, p), p, chargeableLateDays(days, p), rent, lateFee, credits, total);
    }

    /** Result of {@link #assess}. {@code totalDebt = max(0, overdueRent + lateFee - credits)}. */
    public record OverdueAssessment(int daysOverdue, Stage stage, OverduePolicy policy, int chargeableLateDays,
                                    BigDecimal overdueRent, BigDecimal lateFee, BigDecimal credits,
                                    BigDecimal totalDebt) {
    }

    public OverduePolicy policyFor(RentalContract contract) {
        return policyFor(contract != null && contract.getFacility() != null ? contract.getFacility().getId() : null);
    }

    public OverduePolicy policyFor(UUID facilityId) {
        if (facilityId == null) {
            return OverduePolicy.defaults();
        }
        return facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(facilityId)
                .map(OverdueFeeCalculator::fromPolicy)
                .orElseGet(OverduePolicy::defaults);
    }

    public static OverduePolicy fromPolicy(FacilityPolicy policy) {
        if (policy == null) {
            return OverduePolicy.defaults();
        }
        int grace = nonNegative(policy.getOverdueGraceDays(), DEFAULT_GRACE_DAYS);
        int access = nonNegative(policy.getOverdueAccessDisableDays(), DEFAULT_ACCESS_DISABLE_DAYS);
        int sealing = nonNegative(policy.getOverdueSealingDays(), DEFAULT_SEALING_DAYS);
        BigDecimal fee = policy.getDailyLateFee() != null && policy.getDailyLateFee().signum() >= 0
                ? policy.getDailyLateFee() : DEFAULT_DAILY_LATE_FEE;
        return new OverduePolicy(grace, access, sealing, fee, true);
    }

    private static int nonNegative(Integer value, int fallback) {
        return value != null && value >= 0 ? value : fallback;
    }
}

package com.boxora.service;

import com.boxora.entity.FacilityPolicy;
import com.boxora.entity.RentalContract;
import com.boxora.enums.OverdueStage;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;

public interface OverdueDebtCalculationService {

    ZoneId VN_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    CalculationResult calculateOverdueDebt(RentalContract contract, FacilityPolicy policy, LocalDate referenceDate);

    boolean isPolicyValid(FacilityPolicy policy);

    record CalculationResult(
            long overdueDays,
            BigDecimal principalDebt,
            BigDecimal dailyLateFee,
            BigDecimal lateFee,
            BigDecimal totalDebt,
            BigDecimal unverifiedAmount,
            OverdueStage stage,
            boolean isPolicyValid,
            String policyWarning,
            LocalDate dueDate,
            LocalDate asOfDate,
            String feeFormulaExplanation
    ) {}
}


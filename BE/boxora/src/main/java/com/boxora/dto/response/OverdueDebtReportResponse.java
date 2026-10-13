package com.boxora.dto.response;

import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OverdueDebtReportResponse {
    private LocalDate asOfDate;
    private long totalOverdueCount;
    private BigDecimal totalDebtAmount;
    private BigDecimal totalUnpaidRent;
    private BigDecimal totalLateFees;

    private long gracePeriodCount;
    private long warningCount;
    private long accessBlockedCount;
    private long eligibleForSealingCount;

    private BigDecimal aging1To3DaysDebt;
    private BigDecimal aging4To7DaysDebt;
    private BigDecimal aging8To14DaysDebt;
    private BigDecimal aging15PlusDaysDebt;

    private List<OverdueDebtItemResponse> items;
    private List<FacilityOverdueDebtResponse> byFacility;
}

package com.boxora.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DebtBreakdownResponse {
    private BigDecimal gracePeriodAmount;
    private long gracePeriodCount;
    private BigDecimal warningAmount;
    private long warningCount;
    private BigDecimal accessBlockedAmount;
    private long accessBlockedCount;
    private BigDecimal eligibleForSealingAmount;
    private long eligibleForSealingCount;
    private BigDecimal totalDebt;
    private long totalCount;
}

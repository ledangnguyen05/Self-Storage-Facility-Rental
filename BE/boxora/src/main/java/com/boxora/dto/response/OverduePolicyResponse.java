package com.boxora.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/** Overdue thresholds the backend enforces for a facility (from its active policy, or the defaults). */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OverduePolicyResponse {
    private int graceDays;
    private int accessDisableDays;
    private int sealingDays;
    private BigDecimal dailyLateFee;
    /** True when the facility has no active policy and the system defaults apply. */
    private boolean defaultPolicy;
}

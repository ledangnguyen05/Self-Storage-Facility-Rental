package com.boxora.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/** Overdue ledger of one facility (or every facility the caller may see), with stage counts and totals. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OverdueLedgerResponse {

    private LocalDate asOfDate;
    /** Facility the ledger is scoped to; null when it spans every facility. */
    private UUID facilityId;
    /** Policy of {@code facilityId}; null when several facilities are listed (each row carries its own). */
    private OverduePolicyResponse policy;

    private long totalOverdueCount;
    private BigDecimal totalDebtAmount;
    private BigDecimal totalUnpaidRent;
    private BigDecimal totalLateFees;
    private BigDecimal totalPaidSinceDue;

    private long gracePeriodCount;
    private long warningCount;
    private long accessBlockedCount;
    private long eligibleForSealingCount;
    /** Rows whose access is actually locked (PIN revoked or unit locked), whatever the stage. */
    private long accessLockedCount;
    private long sealedCount;

    @Builder.Default
    private List<OverdueLedgerItemResponse> items = new ArrayList<>();
}

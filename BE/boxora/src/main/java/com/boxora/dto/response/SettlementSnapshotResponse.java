package com.boxora.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SettlementSnapshotResponse {
    private UUID id;
    private Integer settlementVersion;
    private BigDecimal depositAmount;
    private BigDecimal doorFee;
    private BigDecimal cleaningFee;
    private BigDecimal wallStructureFee;
    private BigDecimal smartLockFee;
    private String smartLockIssueType;
    private BigDecimal lostCardFee;
    private BigDecimal overdueDebt;
    private BigDecimal totalDeductions;
    private BigDecimal refundAmount;
    private BigDecimal additionalAmountDue;
    private UUID confirmedById;
    private String confirmedByName;
    private LocalDateTime confirmedAt;
    private String notes;
    private String customerDecision;
    private LocalDateTime customerDecisionAt;
    private LocalDateTime createdAt;
}

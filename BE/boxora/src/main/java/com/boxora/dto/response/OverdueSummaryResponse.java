package com.boxora.dto.response;

import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OverdueSummaryResponse {
    private LocalDate asOfDate;
    private long totalOverdueContracts;
    private BigDecimal totalOverdueDebt;
    private BigDecimal totalPrincipalDebt;
    private BigDecimal totalLateFees;
    private BigDecimal unverifiedPaymentsAmount;
    private long unverifiedPaymentsCount;

    // 5 groups
    private long graceCount;               // Nhóm 1: Ân hạn nhắc cước
    private long warningCount;             // Nhóm 2: Cảnh báo
    private long pinThresholdCount;        // Nhóm 3: Đạt ngưỡng thu hồi PIN
    private long sealingThresholdCount;    // Nhóm 4: Đủ điều kiện niêm phong
    private long policyUnconfiguredCount;  // Nhóm 5: Thiếu chính sách

    // Workflow actions pending
    private long pendingPinRevocationsCount;
    private long pendingSealingApprovalsCount;
}


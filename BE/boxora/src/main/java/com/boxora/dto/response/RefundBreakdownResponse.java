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
public class RefundBreakdownResponse {
    private BigDecimal completedRefundAmount;
    private long completedRefundCount;
    private BigDecimal pendingReviewAmount;
    private long pendingReviewCount;
    private BigDecimal processingTransferAmount;
    private long processingTransferCount;
    private BigDecimal rejectedRefundAmount;
    private long rejectedRefundCount;
    private BigDecimal totalRequestedAmount;
    private long totalRefundRequests;
}

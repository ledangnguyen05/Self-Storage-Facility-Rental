package com.boxora.dto.response;

import lombok.*;

import java.math.BigDecimal;

/** Tổng hợp doanh thu toàn hệ thống (hoặc một cơ sở khi lọc). Ý nghĩa các trường xem {@link FacilityRevenueResponse}. */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SystemRevenueSummaryResponse {
    private BigDecimal totalRevenue;
    private BigDecimal collectedAmount;
    private BigDecimal refundedAmount;
    private BigDecimal pendingRefundAmount;
    private BigDecimal depositRevenue;
    private BigDecimal rentalFeeRevenue;
    private BigDecimal renewalFeeRevenue;
    private BigDecimal extraChargeRevenue;
    private Long paymentCount;
}

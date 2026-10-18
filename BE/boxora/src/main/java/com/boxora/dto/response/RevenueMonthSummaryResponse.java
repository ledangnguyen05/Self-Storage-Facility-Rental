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
public class RevenueMonthSummaryResponse {
    /** Null only when a paid payment has no payment timestamp. */
    private String month;
    private BigDecimal totalRevenue;
    private BigDecimal rentalFeeRevenue;
    private BigDecimal depositRevenue;
    private BigDecimal renewalFeeRevenue;
    private BigDecimal extraChargeRevenue;
    private BigDecimal bookingPaymentRevenue;
    private Long paymentCount;
}

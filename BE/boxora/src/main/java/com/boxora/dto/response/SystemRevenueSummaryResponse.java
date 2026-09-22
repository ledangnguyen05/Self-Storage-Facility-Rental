package com.boxora.dto.response;

import lombok.*;

import java.math.BigDecimal;

@Data
@AllArgsConstructor
@Builder
public class SystemRevenueSummaryResponse {
    private BigDecimal totalRevenue;
    private BigDecimal depositRevenue;
    private BigDecimal rentalFeeRevenue;
    private BigDecimal renewalFeeRevenue;
    private BigDecimal extraChargeRevenue;
    private Long paymentCount;
}
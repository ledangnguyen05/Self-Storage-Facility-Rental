package com.boxora.dto.response;

import lombok.*;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FacilityRevenueResponse {
    private UUID facilityId;
    private String facilityName;
    private BigDecimal totalRevenue;
    private BigDecimal depositRevenue;
    private BigDecimal rentalFeeRevenue;
    private BigDecimal renewalFeeRevenue;
    private BigDecimal extraChargeRevenue;
    private Long paymentCount;

    public BigDecimal getNetRevenue() {
        return totalRevenue != null ? totalRevenue : BigDecimal.ZERO;
    }

    public BigDecimal getTotalCollected() {
        BigDecimal rev = totalRevenue != null ? totalRevenue : BigDecimal.ZERO;
        BigDecimal dep = depositRevenue != null ? depositRevenue : BigDecimal.ZERO;
        return rev.add(dep);
    }
}
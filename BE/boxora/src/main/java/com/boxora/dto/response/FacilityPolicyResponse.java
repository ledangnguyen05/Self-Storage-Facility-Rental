package com.boxora.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FacilityPolicyResponse {
    private UUID id;
    private UUID facilityId;
    private String facilityName;
    private Double depositPercentage;
    private BigDecimal dailyLateFee;
    private Integer cancellationRefundDays;
    private BigDecimal miniPrice;
    private BigDecimal standardPrice;
    private BigDecimal climatePrice;
    private Integer discount3Months;
    private Integer discount6Months;
    private Integer discount12Months;
    private Integer gracePeriodDays;
}

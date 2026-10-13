package com.boxora.dto.response;

import lombok.*;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@AllArgsConstructor
@Builder
public class FacilityPolicyResponse {
    private UUID id;
    private UUID facilityId;
    private String facilityName;
    private Double depositPercentage;

    private Integer renewalWindowDays;

    private Integer cancellationFullRefundHours;
    private Integer cancellationPartialRefundHours;
    private Double cancellationPartialRefundPercent;

    private Integer returnNoticeDays;
    private Integer depositRefundSlaDays;

    private BigDecimal dailyLateFee;
    private Integer overdueGraceDays;
    private Integer overdueAccessDisableDays;
    private Integer overdueSealingDays;

    private Integer minimumRentalMonths;
}
package com.boxora.dto.response;

import lombok.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Data
@AllArgsConstructor
@Builder
public class FacilityPolicyResponse {
    private UUID id;
    private UUID facilityId;
    private String facilityName;
    private Boolean isActive;
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
    private Integer minimumRentalDays;
    private Double cancellationAfter48hRefundPercent;

    private BigDecimal discount3MonthPercent;
    private BigDecimal discount6MonthPercent;
    private BigDecimal discount12MonthPercent;

    private List<FacilityPolicyPriceResponse> prices;
}
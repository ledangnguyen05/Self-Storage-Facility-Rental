package com.boxora.dto.request;

import jakarta.validation.constraints.*;
import jakarta.validation.Valid;
import lombok.*;

import java.math.BigDecimal;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FacilityPolicyUpdateRequest {

    private Boolean isActive;

    @DecimalMin(value = "0.0") @DecimalMax(value = "100.0")
    private Double depositPercentage;

    @Min(0)
    private Integer renewalWindowDays;

    @Min(0)
    private Integer cancellationFullRefundHours;

    @Min(0)
    private Integer cancellationPartialRefundHours;

    @DecimalMin(value = "0.0") @DecimalMax(value = "100.0")
    private Double cancellationPartialRefundPercent;

    @Min(0)
    private Integer returnNoticeDays;

    @Min(0)
    private Integer depositRefundSlaDays;

    @DecimalMin(value = "0.0")
    private BigDecimal dailyLateFee;

    @Min(0)
    private Integer overdueGraceDays;

    @Min(0)
    private Integer overdueAccessDisableDays;

    @Min(0)
    private Integer overdueSealingDays;

    @Min(1)
    private Integer minimumRentalMonths;

    @Valid
    private List<FacilityPolicyPriceRequest> prices;
}
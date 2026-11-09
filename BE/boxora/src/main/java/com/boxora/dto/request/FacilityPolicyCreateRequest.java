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
public class FacilityPolicyCreateRequest {

    @NotNull(message = "Facility id is required")
    private java.util.UUID facilityId;

    private Boolean isActive;

    @NotNull @DecimalMin(value = "0.0")
    private Double depositPercentage;

    @Min(0)
    private Integer renewalWindowDays;


    @NotNull @Min(0)
    private Integer cancellationFullRefundHours;

    @NotNull @Min(0)
    private Integer cancellationPartialRefundHours;

    @NotNull @DecimalMin(value = "0.0")
    private Double cancellationPartialRefundPercent;

    @Min(0)
    private Integer returnNoticeDays;

    @NotNull @Min(0)
    private Integer depositRefundSlaDays;

    @NotNull @DecimalMin(value = "0.0")
    private BigDecimal dailyLateFee;

    @NotNull @Min(0)
    private Integer overdueGraceDays;

    @NotNull @Min(0)
    private Integer overdueAccessDisableDays;

    @NotNull @Min(0)
    private Integer overdueSealingDays;

    @Min(1)
    private Integer minimumRentalMonths;

    @Min(1)
    private Integer minimumRentalDays;

    @DecimalMin(value = "0.0") @DecimalMax(value = "100.0")
    private Double cancellationAfter48hRefundPercent;

    @DecimalMin(value = "0.0") @DecimalMax(value = "100.0")
    private BigDecimal discount3MonthPercent;

    @DecimalMin(value = "0.0") @DecimalMax(value = "100.0")
    private BigDecimal discount6MonthPercent;

    @DecimalMin(value = "0.0") @DecimalMax(value = "100.0")
    private BigDecimal discount12MonthPercent;

    @Valid
    private List<FacilityPolicyPriceRequest> prices;
}
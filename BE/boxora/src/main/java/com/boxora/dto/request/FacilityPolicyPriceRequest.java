package com.boxora.dto.request;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import lombok.*;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FacilityPolicyPriceRequest {

    @NotNull
    private UUID unitTypeId;

    @NotNull
    @PositiveOrZero
    private BigDecimal monthlyPrice;

    @DecimalMin("0.0")
    @DecimalMax("100.0")
    private Double discount3MonthPercent;

    @DecimalMin("0.0")
    @DecimalMax("100.0")
    private Double discount6MonthPercent;

    @DecimalMin("0.0")
    @DecimalMax("100.0")
    private Double discount12MonthPercent;
}

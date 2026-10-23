package com.boxora.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PricingQuoteRequest {

    @NotNull(message = "storageUnitId is required")
    private UUID storageUnitId;

    @NotNull(message = "rentalMonths is required")
    @Min(value = 1, message = "rentalMonths must be at least 1")
    private Integer rentalMonths;

    private String discountCode;

    private LocalDate startDate;
}

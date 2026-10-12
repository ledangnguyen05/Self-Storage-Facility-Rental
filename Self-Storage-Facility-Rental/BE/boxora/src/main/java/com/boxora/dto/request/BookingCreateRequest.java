package com.boxora.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
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
public class BookingCreateRequest {
    @NotNull(message = "Storage unit ID is required")
    private UUID storageUnitId;

    @NotNull(message = "Customer ID is required")
    private UUID customerId;

    @NotNull(message = "Start date is required")
    private LocalDate startDate;

    @NotNull(message = "Rental duration in months is required")
    @Min(value = 1, message = "Rental duration must be at least one month")
    @Max(value = 12, message = "Rental duration must not exceed twelve months")
    private Integer rentalMonths;

}

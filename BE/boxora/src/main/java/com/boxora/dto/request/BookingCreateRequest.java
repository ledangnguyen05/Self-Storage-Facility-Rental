package com.boxora.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BookingCreateRequest {
    @NotNull(message = "Storage unit ID is required")
    private UUID storageUnitId;

    private UUID customerId;

    @NotNull(message = "Start date is required")
    private LocalDate startDate;

    @NotNull(message = "Rental duration in months is required")
    private Integer rentalMonths;

    private BigDecimal totalRentalFee;

    private BigDecimal depositPaid;

    private String signingMethod;

    private String discountCode;
}

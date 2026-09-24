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
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ContractCreateRequest {

    private String contractCode;

    @NotNull(message = "Customer ID is required")
    private UUID customerId;

    @NotNull(message = "Storage unit ID is required")
    private UUID unitId;

    @NotNull(message = "Facility ID is required")
    private UUID facilityId;

    private UUID bookingId;

    @NotNull(message = "Start date is required")
    private LocalDate startDate;

    @NotNull(message = "End date is required")
    private LocalDate endDate;

    @NotNull(message = "Monthly fee is required")
    private BigDecimal monthlyFee;

    private BigDecimal depositHeld;
}

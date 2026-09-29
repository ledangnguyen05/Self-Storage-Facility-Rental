package com.boxora.dto.request;

import jakarta.validation.constraints.NotNull;
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
public class HandoverRequest {
    @NotNull(message = "Booking ID is required")
    private UUID bookingId;

    private UUID staffId;

    private String recordType; // "CHECK_IN" or "RETURN"

    private String idCardNumber;

    private String rfidCardNumber;

    private String accessPin;

    private BigDecimal depositSettled;

    private BigDecimal deductionAmount;

    private String unitCondition;

    private String notes;
}

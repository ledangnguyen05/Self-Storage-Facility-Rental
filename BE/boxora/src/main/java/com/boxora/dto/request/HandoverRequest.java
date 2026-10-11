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

    /** Xác nhận đã đối chiếu CCCD/hộ chiếu gốc tại quầy */
    private Boolean identityVerified;

    /** Xác nhận đã thu/đối soát tiền thuê tháng đầu */
    private Boolean firstMonthRentConfirmed;

    /** Xác nhận hợp đồng điện tử đã được ký hoàn tất */
    private Boolean contractConfirmed;

    private String rfidCardNumber;

    private String accessPin;

    private BigDecimal depositSettled;

    private BigDecimal deductionAmount;

    private String unitCondition;

    private String notes;
}

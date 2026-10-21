package com.boxora.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CustomerDebtResponse {
    private UUID id;
    private UUID customerId;
    private String customerName;
    private String customerPhone;
    private UUID bookingId;
    private String bookingCode;
    private String unitCode;
    private UUID facilityId;
    private String facilityName;
    private UUID handoverRecordId;
    private BigDecimal amount;
    private String reason;
    /** OPEN, COLLECTED or WRITTEN_OFF */
    private String status;
    private String createdByName;
    private LocalDateTime createdAt;
    private String resolvedByName;
    private LocalDateTime resolvedAt;
    private String resolutionNote;
}

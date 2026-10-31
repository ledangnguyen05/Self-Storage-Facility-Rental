package com.boxora.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PolicyConfirmationResponse {
    private UUID confirmationId;
    private UUID bookingId;
    private UUID customerId;
    private String policyVersion;
    private LocalDateTime confirmedAt;
    private String status;
    private String message;
}

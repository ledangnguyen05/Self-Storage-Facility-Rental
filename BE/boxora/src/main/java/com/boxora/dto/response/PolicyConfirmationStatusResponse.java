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
public class PolicyConfirmationStatusResponse {
    private UUID bookingId;
    private Boolean policyConfirmed;
    private String policyVersion;
    private String currentActivePolicyVersion;
    private LocalDateTime confirmedAt;
    private String status;
    private Boolean isLatestPolicy;
}

package com.boxora.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LockoutResponse {
    private UUID contractId;
    private String contractCode;
    private UUID bookingId;
    private String unitCode;
    private String status; // SUCCESS, PENDING, FAILED
    private String message;
    private String reason;
    private LocalDateTime lockedAt;
    private boolean pinRevoked;
}

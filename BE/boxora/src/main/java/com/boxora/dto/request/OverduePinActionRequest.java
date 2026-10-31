package com.boxora.dto.request;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OverduePinActionRequest {
    private String reason;
    private Boolean simulateOffline; // For testing OFFLINE device failure
}

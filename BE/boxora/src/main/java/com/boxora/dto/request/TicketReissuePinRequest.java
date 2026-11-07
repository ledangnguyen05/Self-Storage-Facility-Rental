package com.boxora.dto.request;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TicketReissuePinRequest {
    private String reason;
}

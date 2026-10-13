package com.boxora.dto.response;

import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BookingPinResponse {
    private UUID bookingId;
    private String bookingCode;
    private String unitCode;
    private String pin;
    private String qrAccessToken;
    private LocalDateTime pinUpdatedAt;
}

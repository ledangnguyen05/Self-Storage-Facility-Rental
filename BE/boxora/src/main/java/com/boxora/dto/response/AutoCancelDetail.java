package com.boxora.dto.response;

import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AutoCancelDetail {

    private UUID bookingId;
    private String bookingCode;
    private String customerEmail;
    private String unitCode;
    private LocalDateTime createdAt;
    private String reason;
}


package com.boxora.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class IdentityVerifyRequest {

    private UUID bookingId;

    private String idCardType; // CCCD or PASSPORT

    @NotBlank(message = "Số CCCD hoặc Passport không được để trống")
    private String idCardNumber;

    private String notes;
}

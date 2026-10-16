package com.boxora.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.time.LocalDate;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PaperContractCreateRequest {

    @NotNull(message = "Booking ID is required")
    private UUID bookingId;

    private String contractCode;

    private LocalDate signedDate;

    private String paperContractUrl;

    private String paperOriginalLocation;

    private String notes;
}

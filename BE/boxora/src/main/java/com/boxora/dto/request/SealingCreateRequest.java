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
public class SealingCreateRequest {

    @NotNull(message = "contractId is required")
    private UUID contractId;

    @NotBlank(message = "sealTagNumber is required")
    private String sealTagNumber;

    @NotNull(message = "witnessId is required")
    private UUID witnessId;

    @NotBlank(message = "reason is required")
    private String reason;

    private String inventorySummary;

    private String notes;

    private String evidenceUrls;
}

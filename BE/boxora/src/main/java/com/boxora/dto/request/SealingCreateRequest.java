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

    private UUID contractId;

    private UUID unitId;

    private String sealTagNumber;

    private UUID witnessId;

    private String reason;

    private String inventorySummary;

    private String notes;

    private String evidenceUrls;
}

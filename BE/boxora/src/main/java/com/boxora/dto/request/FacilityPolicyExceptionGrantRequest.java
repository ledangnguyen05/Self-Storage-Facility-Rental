package com.boxora.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class FacilityPolicyExceptionGrantRequest {

    @NotNull
    private UUID facilityManagerId;

    @NotNull
    private Boolean granted;
}

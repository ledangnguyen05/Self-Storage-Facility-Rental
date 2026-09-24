package com.boxora.dto.request;

import com.boxora.enums.MasterKeyOverrideCategory;
import com.boxora.enums.OverrideSeverity;
import jakarta.validation.constraints.*;
import lombok.*;

import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MasterKeyOverrideRequest {

    @NotNull(message = "Facility id is required")
    private UUID facilityId;

    @NotNull(message = "Override category is required")
    private MasterKeyOverrideCategory category;

    @NotNull(message = "Override severity is required")
    private OverrideSeverity severity;

    @NotNull(message = "Witness staff id is required")
    private UUID witnessUserId;

    @NotBlank(message = "Witness password is required to verify identity for the two-person rule")
    private String witnessPassword;

    @NotBlank(message = "Reason is required")
    @Size(max = 500, message = "Reason must not exceed 500 characters")
    private String reason;

    @Size(max = 100, message = "Document reference must not exceed 100 characters")
    private String documentReference;

    // optional - what the override was used to access (e.g., STORAGE_UNIT)
    private String resourceType;
    private UUID resourceId;
}
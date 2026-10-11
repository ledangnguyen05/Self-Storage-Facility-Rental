package com.boxora.dto.response;

import com.boxora.enums.MasterKeyOverrideCategory;
import com.boxora.enums.OverrideSeverity;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MasterKeyOverrideResponse {
    private UUID id;

    private UUID facilityId;
    private String facilityName;

    private UUID performedById;
    private String performedByName;

    private UUID witnessId;
    private String witnessName;

    private MasterKeyOverrideCategory category;
    private OverrideSeverity severity;

    private String reason;
    private String documentReference;
    private String resourceType;
    private UUID resourceId;

    private LocalDateTime createdAt;
}
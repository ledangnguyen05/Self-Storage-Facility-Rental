package com.boxora.dto.response;

import com.boxora.enums.SealingStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Phản hồi thông tin biên bản niêm phong kho lưu trữ (BR-RULE-012)")
public class SealingRecordResponse {

    private UUID id;

    // Unit
    private UUID storageUnitId;
    private String unitCode;

    // Contract
    private UUID contractId;
    private String contractCode;

    // Facility
    private UUID facilityId;
    private String facilityName;

    // Sealing info
    private String sealTagNumber;
    private String reason;
    private LocalDateTime sealedAt;

    private UUID sealedById;
    private String sealedByName;

    private UUID witnessId;
    private String witnessName;

    private SealingStatus status;

    // Unseal info
    private LocalDateTime unsealedAt;
    private UUID unsealedById;
    private String unsealedByName;
    private String unsealReason;

    private String photoEvidenceUrl;
    private String notes;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}

package com.boxora.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OverdueSealingWorkflowRequest {

    @NotBlank(message = "Hành động quy trình niêm phong không được để trống")
    private String action; // REQUEST, APPROVE, REJECT, COMPLETE

    private String reason;
    private String rejectionReason;

    // Fields for COMPLETE action
    private String sealTagNumber;
    private UUID witnessId;
    private String photoEvidenceUrl;
    private String notes;

    private List<AssetItemDto> inventoryItems;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class AssetItemDto {
        private String itemName;
        private Integer quantity;
        private String conditionStatus;
        private BigDecimal estimatedValue;
        private String notes;
    }
}


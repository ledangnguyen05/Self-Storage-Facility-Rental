package com.boxora.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
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

    private List<@Valid AssetItemDto> inventoryItems;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class AssetItemDto {
        private String itemName;

        @Min(value = 1, message = "Số lượng tài sản phải lớn hơn hoặc bằng 1")
        private Integer quantity;

        private String conditionStatus;

        @DecimalMin(value = "0.0", message = "Giá trị ước tính của tài sản phải lớn hơn hoặc bằng 0")
        private BigDecimal estimatedValue;

        private String notes;
    }
}


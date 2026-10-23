package com.boxora.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Yêu cầu mở niêm phong kho sau khi khách đã giải quyết thanh toán (BR-RULE-012)")
public class UnsealRequest {

    @NotBlank(message = "Unseal reason is mandatory under BR-RULE-012")
    @Schema(description = "Lý do mở niêm phong (ví dụ: Khách hàng đã thanh toán đầy đủ nợ và phí niêm phong)",
            example = "Khách hàng đã thanh toán đầy đủ tiền thuê quá hạn và phí phạt ngày 07/10/2026")
    private String unsealReason;

    @NotNull(message = "Witness user ID is mandatory")
    @Schema(description = "ID của nhân viên / nhân chứng chứng kiến mở niêm phong",
            example = "3fa85f64-5717-4562-b3fc-2c963f66afa6")
    private UUID witnessId;

    @Schema(description = "Ảnh bằng chứng tem niêm phong đã được gỡ",
            example = "https://boxora-storage.s3.ap-southeast-1.amazonaws.com/evidence/unseal-evidence-01.jpg")
    private String photoEvidenceUrl;

    @Schema(description = "Ghi chú bổ sung", example = "Kho đã mở khóa, khách đã vào kiểm tra tài sản nguyên vẹn.")
    private String notes;
}

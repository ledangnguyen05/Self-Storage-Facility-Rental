package com.boxora.dto.request;

import com.boxora.enums.ShiftSwapStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Yêu cầu phê duyệt hoặc từ chối đơn đổi ca trực")
public class ShiftSwapReviewRequest {

    @NotNull(message = "Status is mandatory (APPROVED or REJECTED)")
    @Schema(description = "Trạng thái phê duyệt (APPROVED hoặc REJECTED)", example = "APPROVED")
    private ShiftSwapStatus status;

    @Schema(description = "Ý kiến hoặc ghi chú của Quản lý cơ sở", example = "Đồng ý phê duyệt, nhân sự thay thế bảo đảm chuyên môn")
    private String managerNotes;
}

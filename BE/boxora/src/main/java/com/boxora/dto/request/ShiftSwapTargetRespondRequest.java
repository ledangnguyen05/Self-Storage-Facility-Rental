package com.boxora.dto.request;

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
@Schema(description = "Yêu cầu phản hồi chấp nhận hoặc từ chối đổi ca từ nhân sự tiếp nhận")
public class ShiftSwapTargetRespondRequest {

    @NotNull(message = "Trường accept không được để trống")
    @Schema(description = "true nếu đồng ý tiếp nhận ca, false nếu từ chối", example = "true")
    private Boolean accept;

    @Schema(description = "Ghi chú hoặc lời nhắn từ nhân sự tiếp nhận", example = "Tôi đồng ý trực thay ca này")
    private String notes;
}

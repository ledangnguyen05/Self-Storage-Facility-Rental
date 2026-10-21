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
@Schema(description = "Yêu cầu đổi ca trực nhân sự")
public class ShiftSwapCreateRequest {

    @NotNull(message = "Assignment ID is mandatory")
    @Schema(description = "ID ca trực hiện tại của người yêu cầu đổi", example = "3fa85f64-5717-4562-b3fc-2c963f66afa6")
    private UUID assignmentId;

    @NotNull(message = "Target staff ID is mandatory")
    @Schema(description = "ID nhân viên được yêu cầu nhận ca thay thế", example = "3fa85f64-5717-4562-b3fc-2c963f66afa6")
    private UUID targetStaffId;

    @Schema(description = "ID ca trực của nhân viên nhận (nếu hoán đổi 2 ca cụ thể)", example = "3fa85f64-5717-4562-b3fc-2c963f66afa6")
    private UUID targetAssignmentId;

    @NotBlank(message = "Reason is mandatory")
    @Schema(description = "Lý do xin đổi ca", example = "Có việc gia đình đột xuất, đã thỏa thuận nhờ đồng nghiệp trực thay")
    private String reason;
}

package com.boxora.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
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
@Schema(description = "Yêu cầu quản lý điều phối nhân sự tiếp nhận bàn giao ca")
public class ShiftHandoverDispatchRequest {

    @NotNull(message = "Incoming staff ID is mandatory")
    @Schema(description = "ID nhân sự được phân công tiếp nhận", example = "3fa85f64-5717-4562-b3fc-2c963f66afa6")
    private UUID incomingStaffId;

    @Schema(description = "ID ca trực phân công của nhân sự tiếp nhận (nếu có)", example = "3fa85f64-5717-4562-b3fc-2c963f66afa6")
    private UUID incomingAssignmentId;

    @Schema(description = "Ghi chú điều phối của Quản lý", example = "Điều động nhân sự thay thế do ca trực trước có việc khẩn cấp")
    private String notes;
}

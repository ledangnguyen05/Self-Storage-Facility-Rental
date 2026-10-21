package com.boxora.dto.request;

import com.boxora.enums.StaffAssignmentStatus;
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
@Schema(description = "Yêu cầu cập nhật nhanh trạng thái ca trực (Check-in, Hoàn thành, Vắng mặt)")
public class StaffAssignmentStatusUpdateRequest {

    @NotNull(message = "Vui lòng chọn trạng thái ca trực")
    @Schema(description = "Trạng thái ca trực (ASSIGNED, CHECKED_IN, COMPLETED, ABSENT)", example = "CHECKED_IN")
    private StaffAssignmentStatus status;

    @Schema(description = "Ghi chú bổ sung khi cập nhật trạng thái", example = "Điểm danh ca sáng đúng giờ")
    private String notes;
}

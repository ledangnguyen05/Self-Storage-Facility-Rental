package com.boxora.dto.request;

import com.boxora.enums.StaffAssignmentStatus;
import com.boxora.enums.StaffShift;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Yêu cầu cập nhật phân công ca trực nhân viên")
public class StaffAssignmentUpdateRequest {

    @Schema(description = "Ca trực thay đổi (MORNING, AFTERNOON, NIGHT, FULL_DAY)", example = "AFTERNOON")
    private StaffShift shift;

    @Schema(description = "Giờ bắt đầu ca", example = "06:00:00")
    private java.time.LocalTime startTime;

    @Schema(description = "Giờ kết thúc ca", example = "14:00:00")
    private java.time.LocalTime endTime;

    @Size(max = 50, message = "Assigned zone must not exceed 50 characters")
    @Schema(description = "Khu vực trực được giao cập nhật", example = "Zone B - Floor 2")
    private String assignedZone;

    @Size(max = 50, message = "Role in shift must not exceed 50 characters")
    @Schema(description = "Vai trò trong ca", example = "PRIMARY_STAFF")
    private String roleInShift;

    @Schema(description = "Trạng thái ca trực (ASSIGNED, CHECKED_IN, COMPLETED, ABSENT)", example = "CHECKED_IN")
    private StaffAssignmentStatus status;

    @Schema(description = "Ghi chú công việc", example = "Đổi ca trực hỗ trợ kiểm kho đột xuất")
    private String notes;
}

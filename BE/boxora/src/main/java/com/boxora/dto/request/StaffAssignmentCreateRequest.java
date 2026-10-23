package com.boxora.dto.request;

import com.boxora.enums.StaffShift;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Yêu cầu tạo phân công ca trực nhân viên")
public class StaffAssignmentCreateRequest {

    @NotNull(message = "Staff ID is mandatory")
    @Schema(description = "ID của nhân viên (phải có vai trò STAFF)", example = "3fa85f64-5717-4562-b3fc-2c963f66afa6")
    private UUID staffId;

    @NotNull(message = "Facility ID is mandatory")
    @Schema(description = "ID cơ sở kho được phân công", example = "3fa85f64-5717-4562-b3fc-2c963f66afa6")
    private UUID facilityId;

    @NotNull(message = "Assigned date is mandatory")
    @Schema(description = "Ngày phân công ca trực (yyyy-MM-dd)", example = "2026-10-10")
    private LocalDate assignedDate;

    @NotNull(message = "Shift is mandatory")
    @Schema(description = "Ca trực (MORNING, AFTERNOON, NIGHT, FULL_DAY)", example = "MORNING")
    private StaffShift shift;

    @Size(max = 50, message = "Assigned zone must not exceed 50 characters")
    @Schema(description = "Khu vực trực được giao (ví dụ: Zone A - Floor 1)", example = "Zone A - Floor 1")
    private String assignedZone;

    @Size(max = 50, message = "Role in shift must not exceed 50 characters")
    @Schema(description = "Vai trò trong ca (PRIMARY_STAFF, BACKUP_STAFF, SUPERVISOR)", example = "PRIMARY_STAFF")
    @Builder.Default
    private String roleInShift = "PRIMARY_STAFF";

    @Schema(description = "Giờ bắt đầu ca trực (nếu tùy chỉnh)", example = "06:00:00")
    private java.time.LocalTime startTime;

    @Schema(description = "Giờ kết thúc ca trực (hỗ trợ ca qua đêm)", example = "14:00:00")
    private java.time.LocalTime endTime;

    @Schema(description = "Ghi chú công việc trong ca trực", example = "Trực quầy đón tiếp khách check-in và kiểm tra an ninh")
    private String notes;
}

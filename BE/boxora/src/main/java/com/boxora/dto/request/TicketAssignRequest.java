package com.boxora.dto.request;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TicketAssignRequest {
    @NotNull(message = "Vui lòng chọn nhân viên phụ trách")
    @JsonAlias("assignedStaffId")
    private UUID staffId;

    /** Mức ưu tiên mới (LOW, MEDIUM, HIGH, URGENT). Bỏ trống để giữ nguyên. */
    private String priority;

    /** Chỉ đạo của quản lý cho nhân viên, được ghi vào nhật ký xử lý của phiếu. */
    @Size(max = 1000, message = "Ghi chú phân công tối đa 1000 ký tự")
    private String notes;
}

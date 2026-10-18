package com.boxora.dto.request;

import com.boxora.enums.StaffShift;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Yêu cầu tạo biên bản bàn giao ca trực")
public class ShiftHandoverCreateRequest {

    @NotNull(message = "Facility ID is mandatory")
    @Schema(description = "ID cơ sở kho", example = "3fa85f64-5717-4562-b3fc-2c963f66afa6")
    private UUID facilityId;

    @NotNull(message = "Handover date is mandatory")
    @Schema(description = "Ngày bàn giao (yyyy-MM-dd)", example = "2026-10-18")
    private LocalDate handoverDate;

    @NotNull(message = "Shift is mandatory")
    @Schema(description = "Ca làm việc của người giao", example = "MORNING")
    private StaffShift shift;

    @Schema(description = "ID nhân sự nhận ca trực", example = "3fa85f64-5717-4562-b3fc-2c963f66afa6")
    private UUID incomingStaffId;

    @Schema(description = "ID phân công ca của người giao", example = "3fa85f64-5717-4562-b3fc-2c963f66afa6")
    private UUID outgoingAssignmentId;

    @Schema(description = "ID phân công ca của người nhận", example = "3fa85f64-5717-4562-b3fc-2c963f66afa6")
    private UUID incomingAssignmentId;

    @Schema(description = "Công việc tồn đọng cần ca sau theo dõi", example = "Khách đặt kho BX-88229 hẹn 15:00 đến nhận chìa; theo dõi pin SmartLock B104")
    private String pendingTasks;

    @Schema(description = "Số lượng ticket sự cố đang mở", example = "1")
    @Builder.Default
    private Integer pendingTicketsCount = 0;

    @Schema(description = "Số lượng đơn đặt chỗ / lịch hẹn chưa xử lý", example = "2")
    @Builder.Default
    private Integer unresolvedBookingsCount = 0;

    @Schema(description = "Tiền mặt tồn quỹ tại ngăn kéo thu ngân", example = "1500000.00")
    @Builder.Default
    private BigDecimal cashInDrawer = BigDecimal.ZERO;

    @Schema(description = "Tình trạng thiết bị cơ sở (camera, cảm biến, cửa từ, PCCC)", example = "Cửa từ hoạt động ổn định, điều hòa duy trì 24 độ C")
    private String facilityStatusNote;

    @NotNull(message = "Checklist completion status is mandatory")
    @Schema(description = "Xác nhận đã kiểm tra an toàn và checklist bàn giao", example = "true")
    @Builder.Default
    private Boolean checklistCompleted = false;

    @Schema(description = "Ghi chú bổ sung", example = "Bàn giao chìa khóa vạn năng cho ca chiều")
    private String notes;
}

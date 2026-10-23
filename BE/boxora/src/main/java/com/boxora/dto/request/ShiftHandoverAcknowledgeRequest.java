package com.boxora.dto.request;

import com.boxora.enums.ShiftHandoverStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Yêu cầu tiếp nhận hoặc phản hồi biên bản bàn giao ca")
public class ShiftHandoverAcknowledgeRequest {

    @NotNull(message = "Status is mandatory (ACKNOWLEDGED, REJECTED, or DISCREPANCY)")
    @Schema(description = "Trạng thái xác nhận (ACKNOWLEDGED, REJECTED, hoặc DISCREPANCY)", example = "ACKNOWLEDGED")
    private ShiftHandoverStatus status;

    @Schema(description = "Tiền mặt người nhận thực đếm tại quầy", example = "1500000.00")
    private BigDecimal cashCounted;

    @Schema(description = "Chênh lệch tiền quỹ phát hiện khi tiếp nhận", example = "0.00")
    private BigDecimal cashDiscrepancy;

    @Schema(description = "Ghi chú giải trình chênh lệch khi tiếp nhận", example = "Phát hiện thừa 20,000 đ so với số tiền người giao khai báo")
    private String cashDiscrepancyReason;

    @Schema(description = "Ghi chú của người tiếp nhận ca", example = "Đã kiểm tra đủ tiền mặt quỹ và chìa khóa quầy, tiếp nhận bàn giao thành công")
    private String notes;
}

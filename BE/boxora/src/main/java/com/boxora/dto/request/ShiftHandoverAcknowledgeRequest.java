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

    @NotNull(message = "Status is mandatory (ACKNOWLEDGED or REJECTED)")
    @Schema(description = "Trạng thái xác nhận (ACKNOWLEDGED hoặc REJECTED)", example = "ACKNOWLEDGED")
    private ShiftHandoverStatus status;

    @Schema(description = "Ghi chú của người tiếp nhận ca", example = "Đã kiểm tra đủ tiền mặt quỹ và chìa khóa quầy, tiếp nhận bàn giao thành công")
    private String notes;
}

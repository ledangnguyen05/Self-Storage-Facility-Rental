package com.boxora.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Yêu cầu kết thúc ca làm việc (Check-out)")
public class StaffCheckOutRequest {

    @Schema(description = "Ghi chú bàn giao hoặc hoàn tất công việc cuối ca", example = "Hoàn thành kiểm tra buồng kho, bàn giao chìa khóa cho ca tiếp theo")
    private String notes;
}

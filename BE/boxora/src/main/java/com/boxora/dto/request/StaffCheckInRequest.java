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
@Schema(description = "Yêu cầu điểm danh xác nhận vào ca trực (Check-in)")
public class StaffCheckInRequest {

    @Schema(description = "Ghi chú điểm danh khi vào ca (nếu có)", example = "Đã có mặt tại quầy tiếp đón đúng giờ")
    private String notes;
}

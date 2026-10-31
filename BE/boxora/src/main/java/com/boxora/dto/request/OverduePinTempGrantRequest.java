package com.boxora.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OverduePinTempGrantRequest {
    @Min(value = 1, message = "Thời gian cấp quyền tạm thời tối thiểu là 1 giờ")
    @Builder.Default
    private int hours = 24;

    @NotBlank(message = "Lý do cấp quyền tạm thời không được để trống")
    private String reason;
}

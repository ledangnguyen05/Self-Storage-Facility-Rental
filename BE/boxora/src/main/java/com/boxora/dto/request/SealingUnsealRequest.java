package com.boxora.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SealingUnsealRequest {

    @NotBlank(message = "Lý do mở niêm phong là bắt buộc")
    private String reason;

    private String notes;
}

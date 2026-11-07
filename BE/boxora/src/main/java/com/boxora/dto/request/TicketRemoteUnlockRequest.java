package com.boxora.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TicketRemoteUnlockRequest {
    @NotBlank(message = "Lý do mở khóa từ xa khẩn cấp không được để trống")
    private String reason;
}

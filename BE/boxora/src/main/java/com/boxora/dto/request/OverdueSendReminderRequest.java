package com.boxora.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OverdueSendReminderRequest {
    @NotBlank(message = "Kênh gửi thông báo không được để trống")
    private String channel; // SMS, EMAIL, CALL, MULTI

    @NotBlank(message = "Loại mẫu thông báo không được để trống")
    private String templateType; // REMINDER, WARNING, LOCKOUT_NOTICE, SEAL_WARNING

    private String content; // Custom override content or auto-generated
    private String notes;
}

package com.boxora.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ResetPasswordRequest {

    @NotBlank(message = "Token is required")
    private String token;

    @NotBlank(message = "New password is required")
    @Size(min = 5, message = "Mật khẩu phải ít nhất 5 ký tự")
    private String newPassword;

    @NotBlank(message = "Xác nhận mật khẩu")
    private String confirmPassword;
}
package com.boxora.dto.request;

import com.boxora.validation.PlainText;
import com.boxora.validation.ValidEmail;
import jakarta.validation.constraints.*;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RegisterRequest {

    /**
     * Optional hint only. The server always produces a unique username (taken names get a numeric suffix),
     * so a username collision is never surfaced to the visitor.
     */
    @Size(max = 60, message = "Tên đăng nhập quá dài")
    @PlainText
    private String username;

    @NotBlank(message = "Vui lòng nhập email")
    @ValidEmail
    @Size(max = 255, message = "Email tối đa 255 ký tự")
    private String email;

    @NotBlank(message = "Vui lòng nhập mật khẩu")
    @Size(min = 5, max = 72, message = "Mật khẩu cần từ 5 đến 72 ký tự")
    private String password;

    @NotBlank(message = "Vui lòng nhập họ và tên")
    @Size(min = 3, max = 30, message = "Họ và tên cần từ 3 đến 30 ký tự")
    @PlainText(message = "Họ và tên không được chứa ký tự < hoặc >")
    private String fullName;

    @NotBlank(message = "Vui lòng nhập số điện thoại")
    @Pattern(
        regexp = "^(0|\\+84)(3|5|7|8|9)[0-9]{8}$",
        message = "Số điện thoại Việt Nam chưa hợp lệ (ví dụ 0912345678)"
    )
    private String phone;

    private String captchaId;

    private String captchaCode;
}

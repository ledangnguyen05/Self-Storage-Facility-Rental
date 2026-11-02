package com.boxora.dto.request;

import jakarta.validation.constraints.*;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RegisterRequest {

    @NotBlank(message = "Tên đăng nhập là bắt buộc")
    @Size(min = 3, max = 30, message = "Tên đăng nhập không được vượt quá 30 ký tự")
    private String username;

    @NotBlank(message = "Email là bắt buộc")
    @Email(message = "Email không được vượt quá 30 ký tự")
    private String email;

    @NotBlank(message = "Mật khẩu là bắt buộc")
    @Size(min = 5, message = "Mật khẩu phải ít nhất 5 ký tự")
    private String password;

    @NotBlank(message = "Họ tên là bắt buộc")
    @Size(max = 30, message = "Họ tên không được vượt quá 30 ký tự")
    private String fullName;

    @NotBlank(message = "Số điện thoại là bắt buộc")
    @Pattern(
        regexp = "^(0|\\+84)(3|5|7|8|9)[0-9]{8}$",
        message = "Phone must be a valid Vietnamese phone number"
    )
    private String phone;

    private String captchaId;

    private String captchaCode;
}
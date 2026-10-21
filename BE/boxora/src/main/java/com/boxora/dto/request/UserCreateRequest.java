package com.boxora.dto.request;

import com.boxora.validation.PlainText;
import com.boxora.validation.ValidEmail;
import jakarta.validation.constraints.*;
import lombok.*;

import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserCreateRequest {

    @NotBlank(message = "Vui lòng nhập tên đăng nhập")
    @Size(min = 3, max = 30, message = "Tên đăng nhập cần từ 3 đến 30 ký tự")
    @PlainText(message = "Tên đăng nhập không được chứa ký tự < hoặc >")
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
    // Admin assigns role when creating a user
    // If null, service will default to "customer"
    private UUID roleId;

    // Assigned facility. Required for STAFF / FACILITY_MANAGER (an unassigned account cannot see any data).
    private UUID facilityId;
}

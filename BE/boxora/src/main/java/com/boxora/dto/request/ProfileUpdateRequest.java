package com.boxora.dto.request;

import com.boxora.validation.PlainText;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class ProfileUpdateRequest {

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
}

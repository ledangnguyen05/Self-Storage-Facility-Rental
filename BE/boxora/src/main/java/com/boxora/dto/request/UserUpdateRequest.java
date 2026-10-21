package com.boxora.dto.request;

import com.boxora.validation.PlainText;
import jakarta.validation.constraints.*;
import lombok.*;

import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserUpdateRequest {

    @Size(min = 3, max = 30, message = "Tên đăng nhập cần từ 3 đến 30 ký tự")
    @PlainText(message = "Tên đăng nhập không được chứa ký tự < hoặc >")
    private String username;

    @Size(min = 3, max = 30, message = "Họ và tên cần từ 3 đến 30 ký tự")
    @PlainText(message = "Họ và tên không được chứa ký tự < hoặc >")
    private String fullName;

    private Boolean isActive;

    /** Optional: only validated (and applied) when present, so partial updates do not have to resend it. */
    @Pattern(
        regexp = "^((0|\\+84)(3|5|7|8|9)[0-9]{8})?$",
        message = "Số điện thoại Việt Nam chưa hợp lệ (ví dụ 0912345678)"
    )
    private String phone;

    // Only admin can change role
    private UUID roleId;

    // Assigned facility (applicable for STAFF / FACILITY_MANAGER)
    private UUID facilityId;
}

package com.boxora.dto.request;

import jakarta.validation.constraints.*;
import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RoleCreateRequest {
    @NotBlank(message = "Vui lòng nhập tên vai trò")
    @Size(min = 2, max = 50, message = "Tên vai trò cần từ 2 đến 50 ký tự")
    private String name;

    @Size(max = 255, message = "Mô tả tối đa 255 ký tự")
    private String description;
}

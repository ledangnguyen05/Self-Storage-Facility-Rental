package com.boxora.dto.request;

import jakarta.validation.constraints.*;
import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PermissionCreateRequest {

    @NotBlank(message = "Vui lòng nhập tên quyền")
    @Size(min = 2, max = 100, message = "Tên quyền cần từ 2 đến 100 ký tự")
    private String name;

    @NotBlank(message = "Vui lòng nhập nhóm quyền")
    @Size(min = 2, max = 100, message = "Nhóm quyền cần từ 2 đến 100 ký tự")
    private String permissionGroup;

    @Size(max = 255, message = "Mô tả tối đa 255 ký tự")
    private String description;
}

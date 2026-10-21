package com.boxora.dto.request;

import jakarta.validation.constraints.*;
import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RolePermissionUpdateRequest {

    @Size(max = 255, message = "Ghi chú tối đa 255 ký tự")
    private String description;

    private Boolean isActive;
}

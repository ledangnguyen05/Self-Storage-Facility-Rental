package com.boxora.dto.request;

import jakarta.validation.constraints.*;
import lombok.*;

import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RolePermissionCreateRequest {

    @NotNull(message = "Role id is required")
    private UUID roleId;

    @NotNull(message = "Permission id is required")
    private UUID permissionId;

    @Size(max = 255, message = "Description must not exceed 255 characters")
    private String description;
}

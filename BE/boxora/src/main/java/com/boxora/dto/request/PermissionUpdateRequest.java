package com.boxora.dto.request;

import jakarta.validation.constraints.*;
import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PermissionUpdateRequest {

    @NotNull(message = "Permission name is required")
    @Size(min = 2, max = 100, message = "Permission name must be between 2 and 100 characters")
    private String name;

    @NotNull(message = "Permission group is required")
    @Size(min = 2, max = 100, message = "Permission group must be between 2 and 100 characters")
    private String permissionGroup;

    @Size(max = 255, message = "Description must not exceed 255 characters")
    private String description;

    private Boolean isActive;
}

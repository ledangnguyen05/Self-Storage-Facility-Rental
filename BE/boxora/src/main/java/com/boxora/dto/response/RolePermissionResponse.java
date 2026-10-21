package com.boxora.dto.response;

import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RolePermissionResponse {
    private UUID id;

    private UUID roleId;
    private String roleName;

    private UUID permissionId;
    private String permissionName;
    private String permissionGroup;

    /** Boxed so Jackson serialises the property as `isActive` (a primitive `isActive` would become `active`). */
    private Boolean isActive;
    private String description;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}

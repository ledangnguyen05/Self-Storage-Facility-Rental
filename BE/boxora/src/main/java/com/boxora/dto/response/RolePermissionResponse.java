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

    private boolean isActive;
    private String description;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}

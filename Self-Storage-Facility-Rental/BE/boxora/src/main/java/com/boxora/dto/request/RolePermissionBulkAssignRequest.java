package com.boxora.dto.request;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.util.List;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RolePermissionBulkAssignRequest {

    @NotNull(message = "Role id is required")
    private UUID roleId;

    @NotEmpty(message = "Permission ids list cannot be empty")
    private List<UUID> permissionIds;
}

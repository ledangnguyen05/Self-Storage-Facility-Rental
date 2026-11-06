package com.boxora.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RolePermissionBulkAssignRequest {

    @NotNull(message = "Role id is required")
    private UUID roleId;

    @Builder.Default
    private List<UUID> permissionIds = new ArrayList<>();

    @Builder.Default
    private List<String> permissionCodes = new ArrayList<>();
}


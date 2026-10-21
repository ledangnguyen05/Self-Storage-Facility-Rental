package com.boxora.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.util.List;
import java.util.UUID;

/**
 * Replaces the permission set of a role: the listed permissions become active, every other permission of
 * the role is revoked. An empty list is valid and removes all permissions of the role.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RolePermissionBulkAssignRequest {

    @NotNull(message = "Vui lòng chọn vai trò")
    private UUID roleId;

    @NotNull(message = "Danh sách quyền không được để trống (dùng danh sách rỗng để gỡ toàn bộ quyền)")
    private List<UUID> permissionIds;
}

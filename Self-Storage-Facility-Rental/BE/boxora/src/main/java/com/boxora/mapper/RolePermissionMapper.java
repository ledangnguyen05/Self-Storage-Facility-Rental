package com.boxora.mapper;

import com.boxora.dto.request.RolePermissionUpdateRequest;
import com.boxora.dto.response.RolePermissionResponse;
import com.boxora.entity.RolePermission;
import org.mapstruct.*;

@Mapper(
        componentModel = "spring",
        nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE
)
public interface RolePermissionMapper {

    @Mapping(source = "role.id", target = "roleId")
    @Mapping(source = "role.name", target = "roleName")
    @Mapping(source = "permission.id", target = "permissionId")
    @Mapping(source = "permission.name", target = "permissionName")
    @Mapping(source = "permission.permissionGroup", target = "permissionGroup")
    RolePermissionResponse toResponse(RolePermission entity);

    // role and permission are resolved and set explicitly in the service (they come from
    // roleId/permissionId lookups, not straight field copies), so only description/isActive
    // are safe to patch here.
    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    void updateEntityFromRequest(RolePermissionUpdateRequest request, @MappingTarget RolePermission rolePermission);
}

package com.boxora.repository;

import com.boxora.entity.RolePermission;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.UUID;

public interface RolePermissionRepositoryCustom {

    Page<RolePermission> findAllWithFilters(
            UUID roleId,
            UUID permissionId,
            String search,
            Boolean isActive,
            Pageable pageable
    );

    List<RolePermission> findAllActiveByRoleId(UUID roleId);
}

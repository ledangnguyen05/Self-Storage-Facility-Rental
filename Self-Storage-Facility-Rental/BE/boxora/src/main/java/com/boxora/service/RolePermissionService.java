package com.boxora.service;

import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.RolePermissionBulkAssignRequest;
import com.boxora.dto.request.RolePermissionCreateRequest;
import com.boxora.dto.request.RolePermissionUpdateRequest;
import com.boxora.dto.response.RolePermissionResponse;

import java.util.*;

public interface RolePermissionService {
    RolePermissionResponse getById(UUID id);
    RolePermissionResponse create(RolePermissionCreateRequest request);
    RolePermissionResponse update(UUID id, RolePermissionUpdateRequest request);
    void delete(UUID id);
    PageResponse<RolePermissionResponse> getAll(
            UUID roleId, UUID permissionId, String search, Boolean isActive,
            int page, int size, String sortBy, String sortDir);

    // convenience for authorization checks / role-permission-matrix screens
    List<RolePermissionResponse> getByRoleId(UUID roleId);

    List<RolePermissionResponse> bulkAssign(RolePermissionBulkAssignRequest request);
}

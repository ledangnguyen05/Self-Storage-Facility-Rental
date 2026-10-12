package com.boxora.controller;

import com.boxora.common.response.ApiResponse;
import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.RolePermissionBulkAssignRequest;
import com.boxora.dto.request.RolePermissionCreateRequest;
import com.boxora.dto.request.RolePermissionUpdateRequest;
import com.boxora.dto.response.RolePermissionResponse;
import com.boxora.service.RolePermissionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/role-permissions")
@RequiredArgsConstructor
@Slf4j
public class RolePermissionController {
    private final RolePermissionService rolePermissionService;

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<RolePermissionResponse>> getById(@PathVariable UUID id) {
        RolePermissionResponse response = rolePermissionService.getById(id);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<RolePermissionResponse>> create
            (@Valid @RequestBody RolePermissionCreateRequest request) {
        RolePermissionResponse response = rolePermissionService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED).
                body(ApiResponse.success("Assigned permission to role successfully", response));
    }

    @PostMapping("/bulk-assign")
    public ResponseEntity<ApiResponse<List<RolePermissionResponse>>> bulkAssign(
            @Valid @RequestBody RolePermissionBulkAssignRequest request) {
        log.info("Bulk assigning permissions to role: {}", request.getRoleId());
        List<RolePermissionResponse> response = rolePermissionService.bulkAssign(request);
        return ResponseEntity.ok(ApiResponse.success("Assigned permissions to role successfully", response));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<RolePermissionResponse>> update
            (@PathVariable UUID id, @Valid @RequestBody RolePermissionUpdateRequest request) {
        RolePermissionResponse response = rolePermissionService.update(id, request);
        return ResponseEntity.ok(ApiResponse.success("Updated role-permission successfully.", response));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable UUID id) {
        rolePermissionService.delete(id);
        return ResponseEntity.ok(ApiResponse.success("Revoked permission from role successfully.", null));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<PageResponse<RolePermissionResponse>>> getAll(
            @RequestParam(required = false) UUID roleId,
            @RequestParam(required = false) UUID permissionId,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Boolean isActive,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir
    ) {
        PageResponse<RolePermissionResponse> response = rolePermissionService.getAll(
                roleId, permissionId, search, isActive, page, size, sortBy, sortDir);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/by-role/{roleId}")
    public ResponseEntity<ApiResponse<List<RolePermissionResponse>>> getByRoleId(@PathVariable UUID roleId) {
        List<RolePermissionResponse> response = rolePermissionService.getByRoleId(roleId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}

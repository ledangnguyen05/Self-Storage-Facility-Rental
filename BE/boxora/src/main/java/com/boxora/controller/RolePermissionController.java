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
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/role-permissions")
@RequiredArgsConstructor
@Slf4j
// Changing what a role may do is an administrator-only operation; reading the mapping is also open to
// business managers (same as /roles and /permissions). Everything else, including CUSTOMER tokens, gets 403.
@PreAuthorize("hasRole('ADMIN')")
public class RolePermissionController {
    private final RolePermissionService rolePermissionService;

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'BUSINESS_MANAGER')")
    public ResponseEntity<ApiResponse<RolePermissionResponse>> getById(@PathVariable UUID id) {
        RolePermissionResponse response = rolePermissionService.getById(id);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<RolePermissionResponse>> create
            (@Valid @RequestBody RolePermissionCreateRequest request) {
        RolePermissionResponse response = rolePermissionService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED).
                body(ApiResponse.success("Đã gán quyền cho vai trò", response));
    }

    /** Replaces the whole permission set of the role (permissions not listed are revoked; an empty list revokes all). */
    @PostMapping("/bulk-assign")
    public ResponseEntity<ApiResponse<List<RolePermissionResponse>>> bulkAssign(
            @Valid @RequestBody RolePermissionBulkAssignRequest request) {
        log.info("Replacing permission set of role {} ({} permissions)", request.getRoleId(),
                request.getPermissionIds() == null ? 0 : request.getPermissionIds().size());
        List<RolePermissionResponse> response = rolePermissionService.bulkAssign(request);
        return ResponseEntity.ok(ApiResponse.success("Đã lưu phân quyền của vai trò", response));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<RolePermissionResponse>> update
            (@PathVariable UUID id, @Valid @RequestBody RolePermissionUpdateRequest request) {
        RolePermissionResponse response = rolePermissionService.update(id, request);
        return ResponseEntity.ok(ApiResponse.success("Đã cập nhật phân quyền", response));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable UUID id) {
        rolePermissionService.delete(id);
        return ResponseEntity.ok(ApiResponse.success("Đã thu hồi quyền khỏi vai trò", null));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'BUSINESS_MANAGER')")
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
    @PreAuthorize("hasAnyRole('ADMIN', 'BUSINESS_MANAGER')")
    public ResponseEntity<ApiResponse<List<RolePermissionResponse>>> getByRoleId(@PathVariable UUID roleId) {
        List<RolePermissionResponse> response = rolePermissionService.getByRoleId(roleId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}

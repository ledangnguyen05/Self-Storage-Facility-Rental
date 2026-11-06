package com.boxora.controller;

import com.boxora.common.response.ApiResponse;
import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.RoleCreateRequest;
import com.boxora.dto.request.RoleUpdateRequest;
import com.boxora.dto.response.RoleResponse;
import com.boxora.dto.request.RolePermissionBulkAssignRequest;
import com.boxora.dto.response.RolePermissionResponse;
import com.boxora.service.RolePermissionService;
import com.boxora.service.RoleService;
import jakarta.validation.Valid;
import lombok.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/roles")
@RequiredArgsConstructor
@Slf4j
public class RoleController {
    private final RoleService roleService;
    private final RolePermissionService rolePermissionService;

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_VIEW') or hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<RoleResponse>> getById(@PathVariable UUID id){
        log.info("Get role by id : {}",id);
        RoleResponse response=roleService.getById(id);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('ROLE_CREATE') or hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<RoleResponse>> create
            (@Valid @RequestBody RoleCreateRequest request){
        log.info("Creating new role : {}", request.getName());
        RoleResponse response= roleService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED).
                body(ApiResponse.success("Tạo vai trò thành công",response));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_UPDATE') or hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<RoleResponse>> update
            (@PathVariable UUID id,@Valid @RequestBody RoleUpdateRequest request){
        log.info("Updating role : {}", request.getName());
        RoleResponse response=roleService.update(id,request);
        return ResponseEntity.ok(ApiResponse.success("Cập nhật vai trò thành công", response));
    }

    @PutMapping("/{roleId}/permissions")
    @PreAuthorize("hasAuthority('ROLE_PERMISSION_ASSIGN') or hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<List<RolePermissionResponse>>> updatePermissions(
            @PathVariable UUID roleId,
            @RequestBody RolePermissionBulkAssignRequest request) {
        log.info("Updating permissions for role ID: {}", roleId);
        if (request == null) {
            request = new RolePermissionBulkAssignRequest();
        }
        request.setRoleId(roleId);
        List<RolePermissionResponse> response = rolePermissionService.bulkAssign(request);
        return ResponseEntity.ok(ApiResponse.success("Cập nhật quyền cho vai trò thành công", response));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_DELETE') or hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable UUID id){
        log.info("Deleting role with id : {}",id);
        roleService.delete(id);
        return ResponseEntity.ok(ApiResponse.success("Xóa vai trò thành công",null));
    }

    @GetMapping
    @PreAuthorize("hasAuthority('ROLE_VIEW') or hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<PageResponse<RoleResponse>>> getAll(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Boolean isActive,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir
    ){
        log.info("Get all roles - page: {}, size: {}, search: {}", page,size,search);
        PageResponse<RoleResponse> response=roleService.getAll(search,isActive,page,size,sortBy,sortDir);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

}

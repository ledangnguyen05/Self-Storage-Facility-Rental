package com.boxora.controller;

import com.boxora.common.response.ApiResponse;
import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.PermissionCreateRequest;
import com.boxora.dto.request.PermissionUpdateRequest;
import com.boxora.dto.response.PermissionResponse;
import com.boxora.service.PermissionService;
import jakarta.validation.Valid;
import lombok.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/permissions")
@RequiredArgsConstructor
@Slf4j
public class PermissionController {
    private final PermissionService permissionService;

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<PermissionResponse>> getById(@PathVariable UUID id) {
        PermissionResponse response = permissionService.getById(id);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<PermissionResponse>> create
            (@Valid @RequestBody PermissionCreateRequest request) {
        PermissionResponse response = permissionService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED).
                body(ApiResponse.success("Created permission successfully", response));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<PermissionResponse>> update
            (@PathVariable UUID id, @Valid @RequestBody PermissionUpdateRequest request) {
        PermissionResponse response = permissionService.update(id, request);
        return ResponseEntity.ok(ApiResponse.success("Updated permission successfully.", response));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable UUID id) {
        permissionService.delete(id);
        return ResponseEntity.ok(ApiResponse.success("Deleted permission successfully.", null));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<PageResponse<PermissionResponse>>> getAll(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Boolean isActive,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir
    ) {
        PageResponse<PermissionResponse> response = permissionService.getAll(search, isActive, page, size, sortBy, sortDir);
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}

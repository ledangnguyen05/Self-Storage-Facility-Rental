package com.boxora.controller;

import com.boxora.common.response.ApiResponse;
import com.boxora.dto.request.StorageUnitCreateRequest;
import com.boxora.dto.request.StorageUnitUpdateRequest;
import com.boxora.dto.response.StorageUnitResponse;
import com.boxora.service.StorageUnitService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/storage-units")
@RequiredArgsConstructor
public class StorageUnitController {

    private final StorageUnitService storageUnitService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<StorageUnitResponse>>> getUnits(
            @RequestParam(required = false) UUID facilityId,
            @RequestParam(required = false) String floorLevel,
            @RequestParam(required = false) String status
    ) {
        return ResponseEntity.ok(ApiResponse.success(storageUnitService.getUnits(facilityId, floorLevel, status)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<StorageUnitResponse>> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(storageUnitService.getById(id)));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('STORAGE_UNIT_CREATE')")
    public ResponseEntity<ApiResponse<StorageUnitResponse>> createUnit(@Valid @RequestBody StorageUnitCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Storage unit created successfully", storageUnitService.createUnit(request)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('STORAGE_UNIT_UPDATE')")
    public ResponseEntity<ApiResponse<StorageUnitResponse>> updateUnit(
            @PathVariable UUID id,
            @Valid @RequestBody StorageUnitUpdateRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success("Storage unit updated successfully", storageUnitService.updateUnit(id, request)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('STORAGE_UNIT_DELETE')")
    public ResponseEntity<ApiResponse<Void>> deleteUnit(@PathVariable UUID id) {
        storageUnitService.deleteUnit(id);
        return ResponseEntity.ok(ApiResponse.success("Storage unit deleted successfully", null));
    }

    @PatchMapping("/{id}/toggle-maintenance")
    @PreAuthorize("hasAuthority('STORAGE_UNIT_UPDATE')")
    public ResponseEntity<ApiResponse<StorageUnitResponse>> toggleMaintenance(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success("Unit maintenance toggled successfully", storageUnitService.toggleMaintenance(id)));
    }
}

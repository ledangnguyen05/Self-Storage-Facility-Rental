package com.boxora.controller;

import com.boxora.common.response.ApiResponse;
import com.boxora.dto.request.StorageUnitCreateRequest;
import com.boxora.dto.request.StorageUnitUpdateRequest;
import com.boxora.dto.request.ToggleMaintenanceRequest;
import com.boxora.dto.response.StorageUnitResponse;
import com.boxora.dto.response.UnitAvailabilityResponse;
import com.boxora.service.StorageUnitService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import com.boxora.dto.response.FileUploadResponse;
import com.boxora.service.CloudflareR2Service;
import org.springframework.web.multipart.MultipartFile;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/storage-units")
@RequiredArgsConstructor
public class StorageUnitController {

    private final StorageUnitService storageUnitService;
    private final CloudflareR2Service cloudflareR2Service;

    @PostMapping("/upload-image")
    @PreAuthorize("hasAnyAuthority('STORAGE_UNIT_CREATE', 'STORAGE_UNIT_UPDATE') or hasAnyRole('FACILITY_MANAGER', 'BUSINESS_MANAGER', 'ADMIN')")
    public ResponseEntity<ApiResponse<FileUploadResponse>> uploadUnitImage(@RequestParam("file") MultipartFile file) {
        FileUploadResponse response = cloudflareR2Service.uploadUnitImage(file);
        return ResponseEntity.ok(ApiResponse.success("Tải ảnh ngăn kho lên Cloudflare R2 thành công", response));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<StorageUnitResponse>>> getUnits(
            @RequestParam(required = false) UUID facilityId,
            @RequestParam(required = false) String floorLevel,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Boolean forAssignment
    ) {
        return ResponseEntity.ok(ApiResponse.success(storageUnitService.getUnits(facilityId, floorLevel, status, forAssignment)));
    }

    @GetMapping("/availability")
    public ResponseEntity<ApiResponse<UnitAvailabilityResponse>> getUnitAvailability(
            @RequestParam UUID facilityId,
            @RequestParam UUID unitTypeId
    ) {
        return ResponseEntity.ok(ApiResponse.success(storageUnitService.getUnitAvailability(facilityId, unitTypeId)));
    }

    @GetMapping("/availability/facility/{facilityId}")
    public ResponseEntity<ApiResponse<List<UnitAvailabilityResponse>>> getFacilityAvailability(
            @PathVariable UUID facilityId
    ) {
        return ResponseEntity.ok(ApiResponse.success(storageUnitService.getFacilityAvailability(facilityId)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<StorageUnitResponse>> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(storageUnitService.getById(id)));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('STORAGE_UNIT_CREATE')")
    public ResponseEntity<ApiResponse<StorageUnitResponse>> createUnit(@Valid @RequestBody StorageUnitCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Tạo ngăn kho thành công", storageUnitService.createUnit(request)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('STORAGE_UNIT_UPDATE') or hasAnyRole('FACILITY_STAFF', 'STAFF', 'FACILITY_MANAGER', 'BUSINESS_MANAGER', 'ADMIN')")
    public ResponseEntity<ApiResponse<StorageUnitResponse>> updateUnit(
            @PathVariable UUID id,
            @Valid @RequestBody StorageUnitUpdateRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success("Cập nhật thông tin ngăn kho thành công", storageUnitService.updateUnit(id, request)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('STORAGE_UNIT_DELETE')")
    public ResponseEntity<ApiResponse<Void>> deleteUnit(@PathVariable UUID id) {
        storageUnitService.deleteUnit(id);
        return ResponseEntity.ok(ApiResponse.success("Xóa ngăn kho thành công", null));
    }

    @PatchMapping("/{id}/toggle-maintenance")
    @PreAuthorize("hasAuthority('STORAGE_UNIT_UPDATE') or hasAnyRole('FACILITY_STAFF', 'STAFF', 'FACILITY_MANAGER', 'BUSINESS_MANAGER', 'ADMIN')")
    public ResponseEntity<ApiResponse<StorageUnitResponse>> toggleMaintenance(
            @PathVariable UUID id,
            @RequestBody(required = false) ToggleMaintenanceRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success("Cập nhật trạng thái bảo trì ngăn kho thành công", storageUnitService.toggleMaintenance(id, request)));
    }
}

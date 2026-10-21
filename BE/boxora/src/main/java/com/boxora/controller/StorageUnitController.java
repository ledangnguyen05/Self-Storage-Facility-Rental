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

    /**
     * Công khai nhưng không lộ dữ liệu khách: người gọi không thuộc nội bộ chỉ nhận bản rút gọn.
     * {@code scope=public} dành cho trang "Thuê kho": mọi kho của các cơ sở đang hoạt động (kể cả kho đã thuê, hiển thị
     * "Đã có người thuê"), không bị giới hạn theo cơ sở của nhân viên đang đăng nhập.
     */
    @GetMapping
    public ResponseEntity<ApiResponse<List<StorageUnitResponse>>> getUnits(
            @RequestParam(required = false) UUID facilityId,
            @RequestParam(required = false) String floorLevel,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String scope
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                storageUnitService.getUnits(facilityId, floorLevel, status, "public".equalsIgnoreCase(scope))));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<StorageUnitResponse>> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(storageUnitService.getById(id)));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('STORAGE_UNIT_CREATE') or hasAnyRole('ADMIN', 'BUSINESS_MANAGER', 'FACILITY_MANAGER')")
    public ResponseEntity<ApiResponse<StorageUnitResponse>> createUnit(@Valid @RequestBody StorageUnitCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Đã tạo kho mới", storageUnitService.createUnit(request)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('STORAGE_UNIT_UPDATE') or hasAnyRole('ADMIN', 'BUSINESS_MANAGER', 'FACILITY_MANAGER')")
    public ResponseEntity<ApiResponse<StorageUnitResponse>> updateUnit(
            @PathVariable UUID id,
            @Valid @RequestBody StorageUnitUpdateRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success("Đã cập nhật kho", storageUnitService.updateUnit(id, request)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('STORAGE_UNIT_DELETE') or hasAnyRole('ADMIN', 'BUSINESS_MANAGER', 'FACILITY_MANAGER')")
    public ResponseEntity<ApiResponse<Void>> deleteUnit(@PathVariable UUID id) {
        storageUnitService.deleteUnit(id);
        return ResponseEntity.ok(ApiResponse.success("Đã xóa kho", null));
    }

    @PatchMapping("/{id}/toggle-maintenance")
    @PreAuthorize("hasAuthority('STORAGE_UNIT_UPDATE') or hasAnyRole('ADMIN', 'BUSINESS_MANAGER', 'FACILITY_MANAGER', 'STAFF')")
    public ResponseEntity<ApiResponse<StorageUnitResponse>> toggleMaintenance(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success("Đã cập nhật trạng thái bảo trì của kho", storageUnitService.toggleMaintenance(id)));
    }
}

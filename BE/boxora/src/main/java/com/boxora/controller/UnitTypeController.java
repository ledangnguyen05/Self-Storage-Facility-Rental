package com.boxora.controller;

import com.boxora.common.response.ApiResponse;
import com.boxora.dto.request.UnitTypeCreateRequest;
import com.boxora.dto.request.UnitTypePriceAdjustmentRequest;
import com.boxora.dto.request.UnitTypeUpdateRequest;
import com.boxora.dto.response.StorageUnitPriceHistoryResponse;
import com.boxora.dto.response.UnitTypeResponse;
import com.boxora.service.UnitTypeService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
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
@RequestMapping("/api/v1/unit-types")
@Tag(name = "Unit Type", description = "API quản lý danh mục loại kho và lịch sử giá niêm yết (BR-RULE-011)")
@RequiredArgsConstructor
@Slf4j
public class UnitTypeController {

    private final UnitTypeService unitTypeService;

    @GetMapping
    @Operation(summary = "Lấy danh sách tất cả loại kho lưu trữ (kèm số lượng kho hiện hữu)")
    public ResponseEntity<ApiResponse<List<UnitTypeResponse>>> getAllUnitTypes() {
        List<UnitTypeResponse> list = unitTypeService.getAll();
        return ResponseEntity.ok(ApiResponse.success(list));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Xem chi tiết một loại kho lưu trữ")
    public ResponseEntity<ApiResponse<UnitTypeResponse>> getById(@PathVariable UUID id) {
        UnitTypeResponse response = unitTypeService.getById(id);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Tạo mới loại kho lưu trữ và ghi nhận giá niêm yết ban đầu")
    public ResponseEntity<ApiResponse<UnitTypeResponse>> createUnitType(
            @Valid @RequestBody UnitTypeCreateRequest request
    ) {
        UnitTypeResponse response = unitTypeService.createUnitType(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Unit type created successfully", response));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Cập nhật thông tin loại kho (nếu đổi giá phải kèm lý do theo BR-RULE-011)")
    public ResponseEntity<ApiResponse<UnitTypeResponse>> updateUnitType(
            @PathVariable UUID id,
            @Valid @RequestBody UnitTypeUpdateRequest request
    ) {
        UnitTypeResponse response = unitTypeService.updateUnitType(id, request);
        return ResponseEntity.ok(ApiResponse.success("Unit type updated successfully", response));
    }

    @PostMapping("/{id}/price-adjustment")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Điều chỉnh giá niêm yết loại kho theo BR-RULE-011 (bắt buộc lý do và lưu lịch sử)")
    public ResponseEntity<ApiResponse<UnitTypeResponse>> adjustPrice(
            @PathVariable UUID id,
            @Valid @RequestBody UnitTypePriceAdjustmentRequest request
    ) {
        UnitTypeResponse response = unitTypeService.adjustPrice(id, request);
        return ResponseEntity.ok(ApiResponse.success("Unit type price adjusted successfully under BR-RULE-011", response));
    }

    @GetMapping("/{id}/price-history")
    @PreAuthorize("hasAnyRole('ADMIN', 'BUSINESS_MANAGER', 'FACILITY_MANAGER', 'STAFF')")
    @Operation(summary = "Xem lịch sử biến động giá của một loại kho")
    public ResponseEntity<ApiResponse<List<StorageUnitPriceHistoryResponse>>> getPriceHistory(
            @PathVariable UUID id
    ) {
        List<StorageUnitPriceHistoryResponse> response = unitTypeService.getPriceHistory(id);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Xóa loại kho (chỉ xóa khi không có kho nào đang thuộc loại này)")
    public ResponseEntity<ApiResponse<Void>> deleteUnitType(@PathVariable UUID id) {
        unitTypeService.deleteUnitType(id);
        return ResponseEntity.ok(ApiResponse.success("Unit type deleted successfully", null));
    }
}


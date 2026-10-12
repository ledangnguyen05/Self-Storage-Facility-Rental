package com.boxora.controller;

import com.boxora.common.response.ApiResponse;
import com.boxora.dto.request.UnitTypeCreateRequest;
import com.boxora.dto.request.UnitTypeUpdateRequest;
import com.boxora.dto.response.PriceHistoryResponse;
import com.boxora.dto.response.UnitTypeResponse;
import com.boxora.service.UnitTypeService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/unit-types")
@RequiredArgsConstructor
@Tag(name = "Unit Types & Pricing", description = "Quản lý danh mục loại kho và lịch sử điều chỉnh giá (BR-RULE-011)")
public class UnitTypeController {

    private final UnitTypeService unitTypeService;

    @GetMapping
    @Operation(summary = "Lấy danh sách tất cả loại kho")
    public ResponseEntity<ApiResponse<List<UnitTypeResponse>>> getAll() {
        return ResponseEntity.ok(ApiResponse.success(unitTypeService.getAllUnitTypes()));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Lấy thông tin chi tiết một loại kho")
    public ResponseEntity<ApiResponse<UnitTypeResponse>> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(unitTypeService.getUnitTypeById(id)));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'BUSINESS_MANAGER')")
    @Operation(summary = "Tạo mới loại kho kèm biểu giá cơ sở ban đầu")
    public ResponseEntity<ApiResponse<UnitTypeResponse>> create(
            @Valid @RequestBody UnitTypeCreateRequest request,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        String email = userDetails != null ? userDetails.getUsername() : null;
        UnitTypeResponse response = unitTypeService.createUnitType(request, email);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Loại kho đã được tạo thành công", response));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'BUSINESS_MANAGER')")
    @Operation(summary = "Cập nhật loại kho và ghi nhận lịch sử giá theo quy chuẩn BR-RULE-011")
    public ResponseEntity<ApiResponse<UnitTypeResponse>> update(
            @PathVariable UUID id,
            @Valid @RequestBody UnitTypeUpdateRequest request,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        String email = userDetails != null ? userDetails.getUsername() : null;
        UnitTypeResponse response = unitTypeService.updateUnitType(id, request, email);
        return ResponseEntity.ok(ApiResponse.success("Cập nhật loại kho và biểu giá thành công (BR-RULE-011)", response));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'BUSINESS_MANAGER')")
    @Operation(summary = "Xóa loại kho nếu chưa có kho nào liên kết")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable UUID id) {
        unitTypeService.deleteUnitType(id);
        return ResponseEntity.ok(ApiResponse.success("Đã xóa loại kho thành công", null));
    }

    @GetMapping("/{id}/price-history")
    @PreAuthorize("hasAnyRole('ADMIN', 'BUSINESS_MANAGER', 'FACILITY_MANAGER') or hasAuthority('UNIT_TYPE_VIEW')")
    @Operation(summary = "Xem lịch sử thay đổi biểu giá của một loại kho (BR-RULE-011)")
    public ResponseEntity<ApiResponse<List<PriceHistoryResponse>>> getPriceHistory(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(unitTypeService.getPriceHistoriesByUnitType(id)));
    }

    @GetMapping("/price-histories")
    @PreAuthorize("hasAnyRole('ADMIN', 'BUSINESS_MANAGER', 'FACILITY_MANAGER')")
    @Operation(summary = "Xem toàn bộ lịch sử thay đổi giá trên toàn hệ thống (BR-RULE-011)")
    public ResponseEntity<ApiResponse<List<PriceHistoryResponse>>> getAllPriceHistories() {
        return ResponseEntity.ok(ApiResponse.success(unitTypeService.getAllPriceHistories()));
    }
}

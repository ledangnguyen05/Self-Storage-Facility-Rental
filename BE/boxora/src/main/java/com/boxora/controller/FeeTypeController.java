package com.boxora.controller;

import com.boxora.common.response.ApiResponse;
import com.boxora.dto.request.FeeTypeCreateRequest;
import com.boxora.dto.request.FeeTypeUpdateRequest;
import com.boxora.dto.response.FeeTypeResponse;
import com.boxora.enums.FeeCategory;
import com.boxora.service.FeeTypeService;
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
@RequestMapping("/api/v1/fee-types")
@Tag(name = "Fee Types", description = "API quản lý danh mục biểu phí và phụ phí dịch vụ kho (Fee Types)")
@RequiredArgsConstructor
@Slf4j
public class FeeTypeController {

    private final FeeTypeService feeTypeService;

    @GetMapping
    @Operation(summary = "Lấy danh sách các loại biểu phí (hỗ trợ lọc theo danh mục hoặc trạng thái hoạt động)")
    public ResponseEntity<ApiResponse<List<FeeTypeResponse>>> getAllFeeTypes(
            @RequestParam(required = false) FeeCategory category,
            @RequestParam(required = false, defaultValue = "false") Boolean activeOnly
    ) {
        List<FeeTypeResponse> list = feeTypeService.getAllFeeTypes(category, activeOnly);
        return ResponseEntity.ok(ApiResponse.success(list));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Xem chi tiết một loại phí theo ID")
    public ResponseEntity<ApiResponse<FeeTypeResponse>> getFeeTypeById(@PathVariable UUID id) {
        FeeTypeResponse response = feeTypeService.getFeeTypeById(id);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/by-code/{code}")
    @Operation(summary = "Tìm loại phí theo mã code")
    public ResponseEntity<ApiResponse<FeeTypeResponse>> getFeeTypeByCode(@PathVariable String code) {
        FeeTypeResponse response = feeTypeService.getFeeTypeByCode(code);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'BUSINESS_MANAGER')")
    @Operation(summary = "Tạo mới một loại biểu phí (ADMIN, BUSINESS_MANAGER)")
    public ResponseEntity<ApiResponse<FeeTypeResponse>> createFeeType(
            @Valid @RequestBody FeeTypeCreateRequest request
    ) {
        FeeTypeResponse response = feeTypeService.createFeeType(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Tạo loại phí thành công", response));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'BUSINESS_MANAGER')")
    @Operation(summary = "Cập nhật loại biểu phí (ADMIN, BUSINESS_MANAGER)")
    public ResponseEntity<ApiResponse<FeeTypeResponse>> updateFeeType(
            @PathVariable UUID id,
            @Valid @RequestBody FeeTypeUpdateRequest request
    ) {
        FeeTypeResponse response = feeTypeService.updateFeeType(id, request);
        return ResponseEntity.ok(ApiResponse.success("Cập nhật loại phí thành công", response));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'BUSINESS_MANAGER')")
    @Operation(summary = "Vô hiệu hóa loại biểu phí (ADMIN, BUSINESS_MANAGER)")
    public ResponseEntity<ApiResponse<Void>> deleteFeeType(@PathVariable UUID id) {
        feeTypeService.deleteFeeType(id);
        return ResponseEntity.ok(ApiResponse.success("Đã vô hiệu hóa loại phí thành công", null));
    }
}


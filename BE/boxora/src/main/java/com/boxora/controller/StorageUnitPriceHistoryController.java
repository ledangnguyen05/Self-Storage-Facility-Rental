package com.boxora.controller;

import com.boxora.common.response.ApiResponse;
import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.StorageUnitPriceAdjustmentRequest;
import com.boxora.dto.response.StorageUnitPriceHistoryResponse;
import com.boxora.service.StorageUnitPriceHistoryService;
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
@RequestMapping("/api/v1")
@Tag(name = "Price History", description = "API quản lý lịch sử và điều chỉnh đơn giá kho lưu trữ (BR-RULE-011)")
@RequiredArgsConstructor
@Slf4j
public class StorageUnitPriceHistoryController {

    private final StorageUnitPriceHistoryService storageUnitPriceHistoryService;

    @PostMapping("/storage-units/{unitId}/price-adjustment")
    @PreAuthorize("hasAnyRole('ADMIN', 'BUSINESS_MANAGER', 'FACILITY_MANAGER')")
    @Operation(summary = "Điều chỉnh đơn giá kho theo BR-RULE-011 (bắt buộc lý do, lưu lịch sử và bảo lưu giá hợp đồng cũ)")
    public ResponseEntity<ApiResponse<StorageUnitPriceHistoryResponse>> adjustUnitPrice(
            @PathVariable UUID unitId,
            @Valid @RequestBody StorageUnitPriceAdjustmentRequest request
    ) {
        StorageUnitPriceHistoryResponse response = storageUnitPriceHistoryService.adjustUnitPrice(unitId, request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Unit price adjusted successfully under BR-RULE-011", response));
    }

    @GetMapping("/storage-units/{unitId}/price-history")
    @PreAuthorize("hasAnyRole('ADMIN', 'BUSINESS_MANAGER', 'FACILITY_MANAGER', 'STAFF')")
    @Operation(summary = "Xem lịch sử thay đổi đơn giá của một kho lưu trữ")
    public ResponseEntity<ApiResponse<List<StorageUnitPriceHistoryResponse>>> getPriceHistoryByUnit(
            @PathVariable UUID unitId
    ) {
        List<StorageUnitPriceHistoryResponse> response = storageUnitPriceHistoryService.getPriceHistoryByUnit(unitId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/price-histories")
    @PreAuthorize("hasAnyRole('ADMIN', 'BUSINESS_MANAGER', 'FACILITY_MANAGER')")
    @Operation(summary = "Tra cứu toàn bộ lịch sử biến động giá (phân trang, lọc theo cơ sở/kho)")
    public ResponseEntity<ApiResponse<PageResponse<StorageUnitPriceHistoryResponse>>> getAllPriceHistories(
            @RequestParam(required = false) UUID facilityId,
            @RequestParam(required = false) UUID unitId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "effectiveFrom") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir
    ) {
        PageResponse<StorageUnitPriceHistoryResponse> response =
                storageUnitPriceHistoryService.getAllPriceHistories(facilityId, unitId, page, size, sortBy, sortDir);
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}


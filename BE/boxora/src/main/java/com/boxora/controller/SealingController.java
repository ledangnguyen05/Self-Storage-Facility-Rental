package com.boxora.controller;

import com.boxora.common.response.ApiResponse;
import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.SealingCreateRequest;
import com.boxora.dto.request.SealingUnsealRequest;
import com.boxora.dto.response.SealingRecordResponse;
import com.boxora.enums.SealingStatus;
import com.boxora.service.SealingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("api/v1/sealing")
@Tag(name = "Sealing", description = "Biên bản niêm phong kho quá hạn và gỡ niêm phong")
@RequiredArgsConstructor
public class SealingController {

    private final SealingService sealingService;

    @PostMapping({"", "seal"})
    @PreAuthorize("hasAnyRole('ADMIN', 'BUSINESS_MANAGER', 'FACILITY_MANAGER', 'STAFF')")
    @Operation(summary = "Lập biên bản niêm phong (từ mốc niêm phong của chính sách cơ sở, có người chứng kiến cùng cơ sở)")
    public ResponseEntity<ApiResponse<SealingRecordResponse>> createSealing(
            @Valid @RequestBody SealingCreateRequest request) {
        SealingRecordResponse response = sealingService.createSealing(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Đã lập biên bản niêm phong " + response.getProtocolNumber(), response));
    }

    @PostMapping("{id}/unseal")
    @PreAuthorize("hasAnyRole('ADMIN', 'BUSINESS_MANAGER', 'FACILITY_MANAGER')")
    @Operation(summary = "Gỡ niêm phong kho và mở lại quyền truy cập của khách")
    public ResponseEntity<ApiResponse<SealingRecordResponse>> unseal(
            @PathVariable UUID id,
            @Valid @RequestBody SealingUnsealRequest request) {
        SealingRecordResponse response = sealingService.unseal(id, request);
        return ResponseEntity.ok(ApiResponse.success("Đã gỡ niêm phong kho", response));
    }

    @GetMapping("{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'BUSINESS_MANAGER', 'FACILITY_MANAGER', 'STAFF')")
    @Operation(summary = "Chi tiết biên bản niêm phong")
    public ResponseEntity<ApiResponse<SealingRecordResponse>> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(sealingService.getById(id)));
    }

    @GetMapping("contract/{contractId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'BUSINESS_MANAGER', 'FACILITY_MANAGER', 'STAFF', 'CUSTOMER')")
    @Operation(summary = "Biên bản niêm phong đang áp dụng của hợp đồng (data = null khi không có)")
    public ResponseEntity<ApiResponse<SealingRecordResponse>> getActiveSealingByContractId(@PathVariable UUID contractId) {
        return ResponseEntity.ok(ApiResponse.success(sealingService.getActiveSealingByContractId(contractId)));
    }

    @GetMapping("unit/{unitId}/active")
    @PreAuthorize("hasAnyRole('ADMIN', 'BUSINESS_MANAGER', 'FACILITY_MANAGER', 'STAFF')")
    @Operation(summary = "Biên bản niêm phong đang áp dụng của kho (data = null khi không có)")
    public ResponseEntity<ApiResponse<SealingRecordResponse>> getActiveSealingByUnitId(@PathVariable UUID unitId) {
        return ResponseEntity.ok(ApiResponse.success(sealingService.getActiveSealingByUnitId(unitId)));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'BUSINESS_MANAGER', 'FACILITY_MANAGER', 'STAFF')")
    @Operation(summary = "Danh sách biên bản niêm phong theo cơ sở và trạng thái")
    public ResponseEntity<ApiResponse<PageResponse<SealingRecordResponse>>> getAll(
            @RequestParam(required = false) UUID facilityId,
            @RequestParam(required = false) SealingStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(ApiResponse.success(sealingService.getAll(facilityId, status, page, size)));
    }
}

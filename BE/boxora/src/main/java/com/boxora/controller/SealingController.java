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
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("api/v1/sealing")
@Tag(name = "Sealing & Overdue Lock", description = "API lập biên bản niêm phong kho và quản lý khóa cưỡng chế khi nợ quá hạn")
@RequiredArgsConstructor
@Slf4j
public class SealingController {

    private final SealingService sealingService;

    @PostMapping({"", "seal"})
    @PreAuthorize("hasAuthority('OVERDUE_PROCESS') or hasAnyRole('ADMIN', 'FACILITY_MANAGER', 'STAFF')")
    @Operation(summary = "Lập biên bản niêm phong kho và chuyển trạng thái OVERDUE_LOCKED")
    public ResponseEntity<ApiResponse<SealingRecordResponse>> createSealing(
            @Valid @RequestBody SealingCreateRequest request) {
        SealingRecordResponse response = sealingService.createSealing(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Lập biên bản niêm phong kho thành công", response));
    }

    @PostMapping("{id}/unseal")
    @PreAuthorize("hasAuthority('OVERDUE_PROCESS') or hasAnyRole('ADMIN', 'FACILITY_MANAGER')")
    @Operation(summary = "Mở niêm phong kho sau khi xử lý nợ hoặc quyết định của BGĐ")
    public ResponseEntity<ApiResponse<SealingRecordResponse>> unseal(
            @PathVariable UUID id,
            @Valid @RequestBody SealingUnsealRequest request) {
        SealingRecordResponse response = sealingService.unseal(id, request);
        return ResponseEntity.ok(ApiResponse.success("Mở niêm phong kho thành công", response));
    }

    @GetMapping("{id}")
    @PreAuthorize("hasAuthority('OVERDUE_VIEW') or hasAnyRole('ADMIN', 'FACILITY_MANAGER', 'STAFF', 'BUSINESS_MANAGER')")
    @Operation(summary = "Lấy chi tiết biên bản niêm phong theo ID")
    public ResponseEntity<ApiResponse<SealingRecordResponse>> getById(@PathVariable UUID id) {
        SealingRecordResponse response = sealingService.getById(id);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("contract/{contractId}")
    @PreAuthorize("hasAuthority('OVERDUE_VIEW') or hasAnyRole('CUSTOMER', 'ADMIN', 'FACILITY_MANAGER', 'STAFF')")
    @Operation(summary = "Lấy biên bản niêm phong đang áp dụng của một hợp đồng")
    public ResponseEntity<ApiResponse<SealingRecordResponse>> getActiveSealingByContractId(
            @PathVariable UUID contractId) {
        SealingRecordResponse response = sealingService.getActiveSealingByContractId(contractId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping
    @PreAuthorize("hasAuthority('OVERDUE_VIEW') or hasAnyRole('ADMIN', 'FACILITY_MANAGER', 'STAFF', 'BUSINESS_MANAGER')")
    @Operation(summary = "Lấy danh sách biên bản niêm phong phân trang theo bộ lọc")
    public ResponseEntity<ApiResponse<PageResponse<SealingRecordResponse>>> getAll(
            @RequestParam(required = false) UUID facilityId,
            @RequestParam(required = false) SealingStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        PageResponse<SealingRecordResponse> response = sealingService.getAll(facilityId, status, page, size);
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}

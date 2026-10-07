package com.boxora.controller;

import com.boxora.common.response.ApiResponse;
import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.UnsealRequest;
import com.boxora.dto.response.OverdueContractDetail;
import com.boxora.dto.response.OverdueProcessResult;
import com.boxora.dto.response.SealingRecordResponse;
import com.boxora.enums.SealingStatus;
import com.boxora.service.OverdueProcessingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
@Tag(name = "Overdue & Sealing", description = "API quản lý hợp đồng quá hạn (+1 phạt 5%, +3 khóa PIN, +7 niêm phong BR-RULE-012)")
@RequiredArgsConstructor
@Slf4j
public class OverdueProcessingController {

    private final OverdueProcessingService overdueProcessingService;

    @PostMapping("/cron/overdue-process")
    @PreAuthorize("hasAnyRole('ADMIN', 'BUSINESS_MANAGER', 'FACILITY_MANAGER')")
    @Operation(summary = "Kích hoạt quét và xử lý quá hạn thủ công (+1 phạt 5%, +3 khóa PIN, +7 niêm phong)")
    public ResponseEntity<ApiResponse<OverdueProcessResult>> triggerOverdueProcess(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate referenceDate
    ) {
        OverdueProcessResult result = overdueProcessingService.processOverdueContracts(referenceDate);
        return ResponseEntity.ok(ApiResponse.success("Processed overdue contracts successfully", result));
    }

    @GetMapping("/overdue/contracts")
    @PreAuthorize("hasAnyRole('ADMIN', 'BUSINESS_MANAGER', 'FACILITY_MANAGER', 'STAFF')")
    @Operation(summary = "Danh sách tổng quan các hợp đồng đang bị quá hạn hiện tại kèm mốc xử lý")
    public ResponseEntity<ApiResponse<List<OverdueContractDetail>>> getOverdueContracts() {
        List<OverdueContractDetail> list = overdueProcessingService.getOverdueContractsSummary();
        return ResponseEntity.ok(ApiResponse.success(list));
    }

    @GetMapping("/sealing-records")
    @PreAuthorize("hasAnyRole('ADMIN', 'BUSINESS_MANAGER', 'FACILITY_MANAGER', 'STAFF')")
    @Operation(summary = "Danh sách biên bản niêm phong kho lưu trữ (BR-RULE-012)")
    public ResponseEntity<ApiResponse<PageResponse<SealingRecordResponse>>> getAllSealingRecords(
            @RequestParam(required = false) UUID facilityId,
            @RequestParam(required = false) SealingStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        PageResponse<SealingRecordResponse> response =
                overdueProcessingService.getAllSealingRecords(facilityId, status, page, size);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/sealing-records/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'BUSINESS_MANAGER', 'FACILITY_MANAGER', 'STAFF')")
    @Operation(summary = "Xem chi tiết một biên bản niêm phong kho")
    public ResponseEntity<ApiResponse<SealingRecordResponse>> getSealingRecordById(
            @PathVariable UUID id
    ) {
        SealingRecordResponse response = overdueProcessingService.getSealingRecordById(id);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping("/sealing-records/{id}/unseal")
    @PreAuthorize("hasAnyRole('ADMIN', 'BUSINESS_MANAGER', 'FACILITY_MANAGER')")
    @Operation(summary = "Mở niêm phong kho sau khi khách đã thanh toán công nợ và phí quá hạn (BR-RULE-012)")
    public ResponseEntity<ApiResponse<SealingRecordResponse>> unsealUnit(
            @PathVariable UUID id,
            @Valid @RequestBody UnsealRequest request
    ) {
        SealingRecordResponse response = overdueProcessingService.unsealUnit(id, request);
        return ResponseEntity.ok(ApiResponse.success("Unit unsealed successfully", response));
    }
}

package com.boxora.controller;

import com.boxora.common.response.ApiResponse;
import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.ShiftHandoverAcknowledgeRequest;
import com.boxora.dto.request.ShiftHandoverCreateRequest;
import com.boxora.dto.response.ShiftHandoverResponse;
import com.boxora.enums.ShiftHandoverStatus;
import com.boxora.service.ShiftHandoverService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/shift-handovers")
@Tag(name = "Shift Handover", description = "API quản lý biên bản bàn giao ca trực, công việc tồn đọng và đối soát tiền quỹ")
@RequiredArgsConstructor
@Slf4j
public class ShiftHandoverController {

    private final ShiftHandoverService shiftHandoverService;

    @PostMapping
    @PreAuthorize("hasAnyRole('STAFF', 'FACILITY_MANAGER')")
    @Operation(summary = "Lập biên bản bàn giao ca trực mới")
    public ResponseEntity<ApiResponse<ShiftHandoverResponse>> createHandover(
            @Valid @RequestBody ShiftHandoverCreateRequest request
    ) {
        ShiftHandoverResponse response = shiftHandoverService.createHandover(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Biên bản bàn giao ca đã được lưu thành công", response));
    }

    @PatchMapping("/{id}/acknowledge")
    @PreAuthorize("hasAnyRole('STAFF', 'FACILITY_MANAGER')")
    @Operation(summary = "Tiếp nhận và xác nhận biên bản bàn giao ca từ ca trước")
    public ResponseEntity<ApiResponse<ShiftHandoverResponse>> acknowledgeHandover(
            @PathVariable UUID id,
            @Valid @RequestBody ShiftHandoverAcknowledgeRequest request
    ) {
        ShiftHandoverResponse response = shiftHandoverService.acknowledgeHandover(id, request);
        return ResponseEntity.ok(ApiResponse.success("Đã xác nhận tiếp nhận bàn giao ca", response));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('STAFF', 'FACILITY_MANAGER', 'BUSINESS_MANAGER', 'ADMIN')")
    @Operation(summary = "Xem chi tiết một biên bản bàn giao ca")
    public ResponseEntity<ApiResponse<ShiftHandoverResponse>> getById(@PathVariable UUID id) {
        ShiftHandoverResponse response = shiftHandoverService.getById(id);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('STAFF', 'FACILITY_MANAGER', 'BUSINESS_MANAGER', 'ADMIN')")
    @Operation(summary = "Danh sách biên bản bàn giao ca có lọc và phân trang")
    public ResponseEntity<ApiResponse<PageResponse<ShiftHandoverResponse>>> getHandovers(
            @RequestParam(required = false) UUID facilityId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) ShiftHandoverStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        PageResponse<ShiftHandoverResponse> response = shiftHandoverService.getHandovers(facilityId, date, status, page, size);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/recent")
    @PreAuthorize("hasAnyRole('STAFF', 'FACILITY_MANAGER', 'BUSINESS_MANAGER', 'ADMIN')")
    @Operation(summary = "Xem 10 biên bản bàn giao ca gần nhất của cơ sở")
    public ResponseEntity<ApiResponse<List<ShiftHandoverResponse>>> getRecentFacilityHandovers(
            @RequestParam(required = false) UUID facilityId
    ) {
        List<ShiftHandoverResponse> response = shiftHandoverService.getRecentFacilityHandovers(facilityId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}

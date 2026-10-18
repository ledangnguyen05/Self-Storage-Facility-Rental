package com.boxora.controller;

import com.boxora.common.response.ApiResponse;
import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.ShiftSwapCreateRequest;
import com.boxora.dto.request.ShiftSwapReviewRequest;
import com.boxora.dto.response.ShiftSwapResponse;
import com.boxora.enums.ShiftSwapStatus;
import com.boxora.service.ShiftSwapService;
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
@RequestMapping("/api/v1/shift-swaps")
@Tag(name = "Shift Swap", description = "API quản lý quy trình yêu cầu và phê duyệt đổi ca trực nhân sự")
@RequiredArgsConstructor
@Slf4j
public class ShiftSwapController {

    private final ShiftSwapService shiftSwapService;

    @PostMapping
    @PreAuthorize("hasAnyRole('STAFF', 'FACILITY_MANAGER', 'BUSINESS_MANAGER', 'ADMIN')")
    @Operation(summary = "Tạo mới yêu cầu đổi ca trực")
    public ResponseEntity<ApiResponse<ShiftSwapResponse>> createSwapRequest(
            @Valid @RequestBody ShiftSwapCreateRequest request
    ) {
        ShiftSwapResponse response = shiftSwapService.createSwapRequest(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Yêu cầu đổi ca đã được gửi thành công", response));
    }

    @PatchMapping("/{id}/review")
    @PreAuthorize("hasAnyRole('FACILITY_MANAGER', 'BUSINESS_MANAGER', 'ADMIN')")
    @Operation(summary = "Quản lý phê duyệt hoặc từ chối đơn đổi ca trực")
    public ResponseEntity<ApiResponse<ShiftSwapResponse>> reviewSwapRequest(
            @PathVariable UUID id,
            @Valid @RequestBody ShiftSwapReviewRequest request
    ) {
        ShiftSwapResponse response = shiftSwapService.reviewSwapRequest(id, request);
        return ResponseEntity.ok(ApiResponse.success("Đã cập nhật kết quả xử lý đổi ca", response));
    }

    @PatchMapping("/{id}/cancel")
    @PreAuthorize("hasAnyRole('STAFF', 'FACILITY_MANAGER', 'ADMIN')")
    @Operation(summary = "Hủy yêu cầu đổi ca trực đang chờ duyệt")
    public ResponseEntity<ApiResponse<ShiftSwapResponse>> cancelSwapRequest(@PathVariable UUID id) {
        ShiftSwapResponse response = shiftSwapService.cancelSwapRequest(id);
        return ResponseEntity.ok(ApiResponse.success("Đã hủy yêu cầu đổi ca", response));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('STAFF', 'FACILITY_MANAGER', 'BUSINESS_MANAGER', 'ADMIN')")
    @Operation(summary = "Xem chi tiết một yêu cầu đổi ca trực")
    public ResponseEntity<ApiResponse<ShiftSwapResponse>> getById(@PathVariable UUID id) {
        ShiftSwapResponse response = shiftSwapService.getById(id);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('FACILITY_MANAGER', 'BUSINESS_MANAGER', 'ADMIN')")
    @Operation(summary = "Danh sách yêu cầu đổi ca trực có lọc và phân trang")
    public ResponseEntity<ApiResponse<PageResponse<ShiftSwapResponse>>> getSwapRequests(
            @RequestParam(required = false) UUID facilityId,
            @RequestParam(required = false) ShiftSwapStatus status,
            @RequestParam(required = false) UUID staffId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        PageResponse<ShiftSwapResponse> response = shiftSwapService.getSwapRequests(facilityId, status, staffId, page, size);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/my-requests")
    @PreAuthorize("hasAnyRole('STAFF', 'FACILITY_MANAGER', 'ADMIN')")
    @Operation(summary = "Danh sách yêu cầu đổi ca của nhân viên hiện tại")
    public ResponseEntity<ApiResponse<List<ShiftSwapResponse>>> getMySwapRequests() {
        List<ShiftSwapResponse> response = shiftSwapService.getMySwapRequests();
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}

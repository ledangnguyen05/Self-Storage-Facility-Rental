package com.boxora.controller;

import com.boxora.common.response.ApiResponse;
import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.RefundCreateRequest;
import com.boxora.dto.request.RefundProcessRequest;
import com.boxora.dto.request.RefundReviewRequest;
import com.boxora.dto.response.RefundRequestResponse;
import com.boxora.enums.RefundStatus;
import com.boxora.service.RefundService;
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
@RequestMapping("api/v1/refunds")
@Tag(name = "Refunds", description = "API quản lý quy trình hoàn tiền cọc/thừa: PENDING_REVIEW -> APPROVED -> PROCESSED")
@RequiredArgsConstructor
@Slf4j
public class RefundController {

    private final RefundService refundService;

    @PostMapping
    @PreAuthorize("hasAuthority('REFUND_VIEW') or hasAnyRole('CUSTOMER', 'ADMIN', 'FACILITY_MANAGER', 'STAFF')")
    @Operation(summary = "Khởi tạo yêu cầu hoàn tiền mới (PENDING_REVIEW)")
    public ResponseEntity<ApiResponse<RefundRequestResponse>> createRefund(
            @Valid @RequestBody RefundCreateRequest request) {
        RefundRequestResponse response = refundService.createRefundRequest(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Khởi tạo yêu cầu hoàn tiền thành công", response));
    }

    @PutMapping("{id}/review")
    @PreAuthorize("hasAuthority('REFUND_APPROVE') or hasAnyRole('ADMIN', 'FACILITY_MANAGER', 'BUSINESS_MANAGER')")
    @Operation(summary = "Phê duyệt hoặc từ chối yêu cầu hoàn tiền (PENDING_REVIEW -> APPROVED / REJECTED)")
    public ResponseEntity<ApiResponse<RefundRequestResponse>> reviewRefund(
            @PathVariable UUID id,
            @Valid @RequestBody RefundReviewRequest request) {
        RefundRequestResponse response = refundService.reviewRefundRequest(id, request);
        return ResponseEntity.ok(ApiResponse.success("Xem xét yêu cầu hoàn tiền thành công", response));
    }

    @PutMapping("{id}/process")
    @PreAuthorize("hasAuthority('REFUND_APPROVE') or hasAnyRole('ADMIN', 'FACILITY_MANAGER', 'STAFF')")
    @Operation(summary = "Thực hiện chi trả và hoàn tất yêu cầu hoàn tiền (APPROVED -> PROCESSED)")
    public ResponseEntity<ApiResponse<RefundRequestResponse>> processRefund(
            @PathVariable UUID id,
            @Valid @RequestBody RefundProcessRequest request) {
        RefundRequestResponse response = refundService.processRefund(id, request);
        return ResponseEntity.ok(ApiResponse.success("Chi trả hoàn tiền thành công", response));
    }

    @GetMapping("{id}")
    @PreAuthorize("hasAuthority('REFUND_VIEW') or hasAnyRole('CUSTOMER', 'ADMIN', 'FACILITY_MANAGER', 'STAFF', 'BUSINESS_MANAGER')")
    @Operation(summary = "Lấy chi tiết yêu cầu hoàn tiền theo ID")
    public ResponseEntity<ApiResponse<RefundRequestResponse>> getById(@PathVariable UUID id) {
        RefundRequestResponse response = refundService.getById(id);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping
    @PreAuthorize("hasAuthority('REFUND_VIEW') or hasAnyRole('CUSTOMER', 'ADMIN', 'FACILITY_MANAGER', 'STAFF', 'BUSINESS_MANAGER')")
    @Operation(summary = "Lấy danh sách yêu cầu hoàn tiền phân trang theo bộ lọc")
    public ResponseEntity<ApiResponse<PageResponse<RefundRequestResponse>>> getAll(
            @RequestParam(required = false) UUID facilityId,
            @RequestParam(required = false) UUID customerId,
            @RequestParam(required = false) RefundStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        PageResponse<RefundRequestResponse> response = refundService.getAll(facilityId, customerId, status, page, size);
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}

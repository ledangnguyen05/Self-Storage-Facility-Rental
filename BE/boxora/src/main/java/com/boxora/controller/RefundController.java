package com.boxora.controller;

import com.boxora.common.response.ApiResponse;
import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.*;
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
@Tag(name = "Refunds", description = "API quản lý quy trình hoàn tiền cọc/thừa: PENDING_REVIEW -> APPROVED -> PROCESSING_TRANSFER -> AWAITING_CUSTOMER_CONFIRMATION -> RECONCILED -> COMPLETED")
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

    @PutMapping("{id}/start-transfer")
    @PreAuthorize("hasAuthority('REFUND_APPROVE') or hasAnyRole('ADMIN', 'FACILITY_MANAGER', 'STAFF')")
    @Operation(summary = "Bắt đầu chuyển khoản hoàn tiền (APPROVED -> PROCESSING_TRANSFER)")
    public ResponseEntity<ApiResponse<RefundRequestResponse>> startTransfer(
            @PathVariable UUID id,
            @Valid @RequestBody RefundTransferRequest request) {
        RefundRequestResponse response = refundService.startTransfer(id, request);
        return ResponseEntity.ok(ApiResponse.success("Bắt đầu xử lý chuyển tiền hoàn", response));
    }

    @PutMapping("{id}/process")
    @PreAuthorize("hasAuthority('REFUND_APPROVE') or hasAnyRole('ADMIN', 'FACILITY_MANAGER', 'STAFF')")
    @Operation(summary = "Xác nhận chuyển tiền với mã đối soát (APPROVED/PROCESSING_TRANSFER -> AWAITING_CUSTOMER_CONFIRMATION)")
    public ResponseEntity<ApiResponse<RefundRequestResponse>> processRefund(
            @PathVariable UUID id,
            @Valid @RequestBody RefundProcessRequest request) {
        RefundRequestResponse response = refundService.processRefund(id, request);
        return ResponseEntity.ok(ApiResponse.success("Chi trả hoàn tiền thành công, chờ khách hàng xác nhận", response));
    }

    @PutMapping("{id}/confirm-received")
    @PreAuthorize("hasRole('CUSTOMER') or hasAnyRole('ADMIN', 'FACILITY_MANAGER', 'STAFF')")
    @Operation(summary = "Khách hàng xác nhận đã nhận được tiền hoàn (AWAITING_CUSTOMER_CONFIRMATION -> RECONCILED)")
    public ResponseEntity<ApiResponse<RefundRequestResponse>> confirmReceived(
            @PathVariable UUID id,
            @RequestBody(required = false) RefundCustomerConfirmRequest request) {
        RefundRequestResponse response = refundService.confirmCustomerReceived(id, request != null ? request : new RefundCustomerConfirmRequest());
        return ResponseEntity.ok(ApiResponse.success("Xác nhận đã nhận tiền thành công", response));
    }

    @PutMapping("{id}/reconcile")
    @PreAuthorize("hasAuthority('REFUND_APPROVE') or hasAnyRole('ADMIN', 'FACILITY_MANAGER', 'BUSINESS_MANAGER')")
    @Operation(summary = "Kế toán / Quản lý đối soát và hoàn tất hồ sơ (RECONCILED -> COMPLETED)")
    public ResponseEntity<ApiResponse<RefundRequestResponse>> reconcileRefund(
            @PathVariable UUID id,
            @RequestBody(required = false) RefundReconcileRequest request) {
        RefundRequestResponse response = refundService.reconcileRefund(id, request != null ? request : new RefundReconcileRequest());
        return ResponseEntity.ok(ApiResponse.success("Hoàn tất đối soát và đóng hồ sơ hoàn tiền", response));
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

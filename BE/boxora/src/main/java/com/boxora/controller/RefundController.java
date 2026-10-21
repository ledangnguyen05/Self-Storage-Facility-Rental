package com.boxora.controller;

import com.boxora.common.response.ApiResponse;
import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.*;
import com.boxora.dto.response.RefundRequestResponse;
import com.boxora.service.RefundService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("api/v1/refunds")
@Tag(name = "Refunds", description = "Quy trình hoàn tiền: PENDING_REVIEW -> APPROVED -> PROCESSING_TRANSFER -> AWAITING_CUSTOMER_CONFIRMATION -> RECONCILED -> COMPLETED (REJECTED khi bị từ chối)")
@RequiredArgsConstructor
@Slf4j
public class RefundController {

    private final RefundService refundService;

    @PostMapping
    @PreAuthorize("hasAuthority('REFUND_VIEW') or hasAnyRole('CUSTOMER', 'ADMIN', 'FACILITY_MANAGER', 'STAFF')")
    @Operation(summary = "Khởi tạo yêu cầu hoàn tiền mới (PENDING_REVIEW); số tiền do máy chủ tính từ tiền cọc đã thu")
    public ResponseEntity<ApiResponse<RefundRequestResponse>> createRefund(
            @Valid @RequestBody RefundCreateRequest request) {
        RefundRequestResponse response = refundService.createRefundRequest(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Đã tạo yêu cầu hoàn tiền", response));
    }

    @PutMapping("{id}/review")
    @PreAuthorize("hasAuthority('REFUND_APPROVE') or hasAnyRole('ADMIN', 'FACILITY_MANAGER', 'BUSINESS_MANAGER')")
    @Operation(summary = "Duyệt hoặc từ chối yêu cầu hoàn tiền (action = APPROVE | REJECT)")
    public ResponseEntity<ApiResponse<RefundRequestResponse>> reviewRefund(
            @PathVariable UUID id,
            @Valid @RequestBody RefundReviewRequest request) {
        RefundRequestResponse response = refundService.reviewRefundRequest(id, request);
        return ResponseEntity.ok(ApiResponse.success(
                "APPROVE".equalsIgnoreCase(request.getAction()) ? "Đã duyệt yêu cầu hoàn tiền" : "Đã từ chối yêu cầu hoàn tiền", response));
    }

    @PutMapping("{id}/bank-account")
    @PreAuthorize("hasAnyRole('CUSTOMER', 'ADMIN', 'BUSINESS_MANAGER', 'FACILITY_MANAGER', 'STAFF')")
    @Operation(summary = "Cung cấp / cập nhật tài khoản nhận hoàn tiền (trước khi chuyển khoản)")
    public ResponseEntity<ApiResponse<RefundRequestResponse>> updateBankAccount(
            @PathVariable UUID id,
            @Valid @RequestBody RefundBankAccountRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Đã lưu tài khoản nhận hoàn tiền", refundService.updateBankAccount(id, request)));
    }

    @PutMapping("{id}/start-transfer")
    @PreAuthorize("hasAuthority('REFUND_APPROVE') or hasAnyRole('ADMIN', 'BUSINESS_MANAGER', 'FACILITY_MANAGER', 'STAFF')")
    @Operation(summary = "Bắt đầu chuyển khoản hoàn tiền với mã ủy nhiệm chi (APPROVED -> PROCESSING_TRANSFER)")
    public ResponseEntity<ApiResponse<RefundRequestResponse>> startTransfer(
            @PathVariable UUID id,
            @Valid @RequestBody RefundTransferRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Đã ghi nhận lệnh chuyển khoản hoàn tiền", refundService.startTransfer(id, request)));
    }

    @PostMapping(value = "{id}/transfer-evidence", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAuthority('REFUND_APPROVE') or hasAnyRole('ADMIN', 'BUSINESS_MANAGER', 'FACILITY_MANAGER', 'STAFF')")
    @Operation(summary = "Tải lên ảnh hoặc PDF minh chứng chuyển khoản hoàn tiền")
    public ResponseEntity<ApiResponse<RefundRequestResponse>> uploadTransferEvidence(
            @PathVariable UUID id,
            @RequestParam("file") MultipartFile file) {
        return ResponseEntity.ok(ApiResponse.success("Đã lưu minh chứng chuyển khoản", refundService.attachTransferEvidence(id, file)));
    }

    @PutMapping("{id}/process")
    @PreAuthorize("hasAuthority('REFUND_APPROVE') or hasAnyRole('ADMIN', 'BUSINESS_MANAGER', 'FACILITY_MANAGER', 'STAFF')")
    @Operation(summary = "Xác nhận đã chuyển tiền với mã giao dịch ngân hàng (-> AWAITING_CUSTOMER_CONFIRMATION)")
    public ResponseEntity<ApiResponse<RefundRequestResponse>> processRefund(
            @PathVariable UUID id,
            @Valid @RequestBody RefundProcessRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Đã xác nhận chuyển tiền, chờ khách hàng xác nhận", refundService.processRefund(id, request)));
    }

    @PutMapping("{id}/confirm-received")
    @PreAuthorize("hasAnyRole('CUSTOMER', 'ADMIN', 'BUSINESS_MANAGER', 'FACILITY_MANAGER', 'STAFF')")
    @Operation(summary = "Khách hàng xác nhận đã nhận được tiền hoàn (AWAITING_CUSTOMER_CONFIRMATION -> RECONCILED)")
    public ResponseEntity<ApiResponse<RefundRequestResponse>> confirmReceived(
            @PathVariable UUID id,
            @Valid @RequestBody(required = false) RefundCustomerConfirmRequest request) {
        RefundRequestResponse response = refundService.confirmCustomerReceived(id, request != null ? request : new RefundCustomerConfirmRequest());
        return ResponseEntity.ok(ApiResponse.success("Đã xác nhận nhận tiền hoàn", response));
    }

    @PutMapping("{id}/reconcile")
    @PreAuthorize("hasAuthority('REFUND_APPROVE') or hasAnyRole('ADMIN', 'FACILITY_MANAGER', 'BUSINESS_MANAGER')")
    @Operation(summary = "Kế toán / quản lý đối soát và đóng hồ sơ hoàn tiền (-> COMPLETED)")
    public ResponseEntity<ApiResponse<RefundRequestResponse>> reconcileRefund(
            @PathVariable UUID id,
            @Valid @RequestBody(required = false) RefundReconcileRequest request) {
        RefundRequestResponse response = refundService.reconcileRefund(id, request != null ? request : new RefundReconcileRequest());
        return ResponseEntity.ok(ApiResponse.success("Đã đối soát và đóng hồ sơ hoàn tiền", response));
    }

    @GetMapping("stats")
    @PreAuthorize("hasAuthority('REFUND_VIEW') or hasAnyRole('ADMIN', 'BUSINESS_MANAGER', 'FACILITY_MANAGER', 'STAFF')")
    @Operation(summary = "Số yêu cầu hoàn tiền theo trạng thái (theo cơ sở được phân công hoặc facilityId)")
    public ResponseEntity<ApiResponse<Map<String, Long>>> getStats(@RequestParam(required = false) UUID facilityId) {
        return ResponseEntity.ok(ApiResponse.success(refundService.getStatusCounts(facilityId)));
    }

    @GetMapping("{id}")
    @PreAuthorize("hasAuthority('REFUND_VIEW') or hasAnyRole('CUSTOMER', 'ADMIN', 'FACILITY_MANAGER', 'STAFF', 'BUSINESS_MANAGER')")
    @Operation(summary = "Lấy chi tiết yêu cầu hoàn tiền theo ID")
    public ResponseEntity<ApiResponse<RefundRequestResponse>> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(refundService.getById(id)));
    }

    @GetMapping
    @PreAuthorize("hasAuthority('REFUND_VIEW') or hasAnyRole('CUSTOMER', 'ADMIN', 'FACILITY_MANAGER', 'STAFF', 'BUSINESS_MANAGER')")
    @Operation(summary = "Danh sách yêu cầu hoàn tiền phân trang (khách hàng: của mình; nhân viên / quản lý cơ sở: cơ sở được phân công)")
    public ResponseEntity<ApiResponse<PageResponse<RefundRequestResponse>>> getAll(
            @RequestParam(required = false) UUID facilityId,
            @RequestParam(required = false) UUID customerId,
            @Parameter(description = "Một hoặc nhiều trạng thái, phân tách bằng dấu phẩy")
            @RequestParam(required = false) String status,
            @Parameter(description = "Tìm theo mã yêu cầu, mã đơn, tên / điện thoại / email khách")
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(ApiResponse.success(refundService.getAll(facilityId, customerId, status, q, page, size)));
    }
}

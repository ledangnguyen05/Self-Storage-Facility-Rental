package com.boxora.controller;

import com.boxora.common.response.ApiResponse;
import com.boxora.dto.request.HandoverRequest;
import com.boxora.dto.response.HandoverPrerequisitesResponse;
import com.boxora.dto.response.HandoverResponse;
import com.boxora.dto.response.ReturnSettlementPreviewResponse;
import com.boxora.dto.response.ReturnSettlementResponse;
import com.boxora.service.HandoverService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/handovers")
@Tag(name = "Handover & Check-in", description = "API quản lý bàn giao kho, kiểm tra 4 điều kiện check-in (BR-RULE-005/006) và nghiệm thu trả kho, quyết toán hoàn cọc (BR-RULE-013/014/015)")
@RequiredArgsConstructor
public class HandoverController {

    private final HandoverService handoverService;

    @GetMapping("/booking/{bookingId}/prerequisites")
    @PreAuthorize("hasAnyRole('STAFF', 'FACILITY_MANAGER', 'ADMIN')")
    @Operation(summary = "Đối soát 4 điều kiện tiên quyết trước khi check-in bàn giao (BR-RULE-005: Cọc + Tiền thuê tháng đầu + Ký hợp đồng + Đối soát CCCD)")
    public ResponseEntity<ApiResponse<HandoverPrerequisitesResponse>> getCheckInPrerequisites(@PathVariable UUID bookingId) {
        HandoverPrerequisitesResponse response = handoverService.getCheckInPrerequisites(bookingId);
        return ResponseEntity.ok(ApiResponse.success("Kiểm tra 4 điều kiện bàn giao thành công", response));
    }

    @PostMapping("/check-in")
    @PreAuthorize("hasAnyRole('STAFF', 'ADMIN')")
    @Operation(summary = "Thực hiện check-in bàn giao kho vật lý (BR-RULE-005/006: yêu cầu đủ 4 điều kiện, cấp PIN SmartLock và chuyển trạng thái kho sang OCCUPIED)")
    public ResponseEntity<ApiResponse<HandoverResponse>> checkIn(@Valid @RequestBody HandoverRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Check-in bàn giao kho thành công và kích hoạt mã khóa SmartLock", handoverService.checkIn(request)));
    }

    @GetMapping("/booking/{bookingId}/return-preview")
    @PreAuthorize("hasAnyRole('STAFF', 'FACILITY_MANAGER', 'ADMIN', 'CUSTOMER')")
    @Operation(summary = "Xem trước quyết toán tiền cọc, hạn thuê và 5 tiêu chí thẩm định trả kho (BR-RULE-013/014/015)")
    public ResponseEntity<ApiResponse<ReturnSettlementPreviewResponse>> getReturnSettlementPreview(@PathVariable UUID bookingId) {
        ReturnSettlementPreviewResponse response = handoverService.getReturnSettlementPreview(bookingId);
        return ResponseEntity.ok(ApiResponse.success("Xem trước thông tin quyết toán cọc và thẩm định trả kho thành công", response));
    }

    @PostMapping("/checkout-request/{bookingId}")
    @PreAuthorize("hasAnyRole('STAFF', 'FACILITY_MANAGER', 'ADMIN', 'CUSTOMER')")
    @Operation(summary = "Hành động 1 Trả kho: Khách hàng yêu cầu trả kho")
    public ResponseEntity<ApiResponse<HandoverResponse>> requestCheckout(
            @PathVariable UUID bookingId,
            @RequestParam(required = false) String notes) {
        return ResponseEntity.ok(ApiResponse.success("Yêu cầu trả kho đã được tiếp nhận thành công",
                handoverService.requestCheckout(bookingId, notes)));
    }

    @PostMapping("/inspection")
    @PreAuthorize("hasAnyRole('STAFF', 'ADMIN')")
    @Operation(summary = "Hành động 2 Trả kho: Nhân viên kiểm tra hiện trường, lưu ảnh & ghi nhận hư hỏng")
    public ResponseEntity<ApiResponse<HandoverResponse>> performInspection(@Valid @RequestBody HandoverRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Biên bản kiểm tra hiện trường đã được ghi nhận thành công",
                handoverService.performInspection(request)));
    }

    @PostMapping("/return")
    @PreAuthorize("hasAnyRole('STAFF', 'ADMIN')")
    @Operation(summary = "Xử lý trả kho và hoàn cọc (BR-RULE-013/014/015)")
    public ResponseEntity<ApiResponse<HandoverResponse>> processReturn(@Valid @RequestBody HandoverRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Nghiệm thu hoàn trả kho và quyết toán cọc thành công", handoverService.processReturn(request)));
    }

    @PostMapping("/return-settlement")
    @PreAuthorize("hasAnyRole('STAFF', 'ADMIN')")
    @Operation(summary = "Nghiệm thu hiện trường trả kho và quyết toán hoàn cọc chi tiết theo BR-RULE-013/014/015")
    public ResponseEntity<ApiResponse<ReturnSettlementResponse>> processReturnSettlement(@Valid @RequestBody HandoverRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Nghiệm thu hiện trường và quyết toán cọc chi tiết thành công", handoverService.processReturnSettlement(request)));
    }

    @GetMapping("/booking/{bookingId}")
    @PreAuthorize("hasAnyRole('STAFF', 'FACILITY_MANAGER', 'ADMIN', 'CUSTOMER')")
    @Operation(summary = "Lấy lịch sử các biên bản bàn giao của đơn đặt kho")
    public ResponseEntity<ApiResponse<List<HandoverResponse>>> getByBookingId(@PathVariable UUID bookingId) {
        return ResponseEntity.ok(ApiResponse.success(handoverService.getByBookingId(bookingId)));
    }

    @PostMapping("/booking/{bookingId}/send-pin-email")
    @PreAuthorize("hasAnyRole('STAFF', 'ADMIN')")
    @Operation(summary = "Gửi mã PIN và thông tin bàn giao đến email khách hàng")
    public ResponseEntity<ApiResponse<Void>> sendPinEmail(
            @PathVariable UUID bookingId,
            @RequestParam(required = false) String customEmail) {
        handoverService.sendHandoverPinEmail(bookingId, customEmail);
        return ResponseEntity.ok(ApiResponse.success("Đã gửi mã PIN và thông tin bàn giao đến email khách hàng thành công", null));
    }

    @PostMapping("/booking/{bookingId}/send-web-notification")
    @PreAuthorize("hasAnyRole('STAFF', 'ADMIN')")
    @Operation(summary = "Bắn thông báo web đến tài khoản khách hàng")
    public ResponseEntity<ApiResponse<com.boxora.dto.response.NotificationLogResponse>> sendWebNotification(
            @PathVariable UUID bookingId) {
        return ResponseEntity.ok(ApiResponse.success("Đã bắn thông báo web thành công",
                handoverService.sendHandoverWebNotification(bookingId)));
    }

    // =========================================================================
    // QUY TRÌNH CHECK-IN ĐỐI SOÁT 4 ĐIỀU KIỆN & NGHIỆM THU HIỆN TRƯỜNG
    // =========================================================================

    @PostMapping(value = "/booking/{bookingId}/upload-document", consumes = org.springframework.http.MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('STAFF', 'FACILITY_MANAGER', 'ADMIN')")
    @Operation(summary = "Tải lên tệp hợp đồng giấy scan hoặc chứng từ chuyển khoản (PDF, JPG, JPEG, PNG, WEBP, tối đa 10MB)")
    public ResponseEntity<ApiResponse<com.boxora.dto.response.FileUploadResponse>> uploadHandoverDocument(
            @PathVariable UUID bookingId,
            @RequestParam("file") org.springframework.web.multipart.MultipartFile file,
            @RequestParam(value = "documentType", required = false, defaultValue = "PAPER_CONTRACT") String documentType) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Tải lên tài liệu thành công",
                        handoverService.uploadHandoverDocument(bookingId, file, documentType)));
    }

    @GetMapping("/booking/{bookingId}/documents/view")
    @PreAuthorize("hasAnyRole('CUSTOMER', 'STAFF', 'FACILITY_MANAGER', 'BUSINESS_MANAGER', 'ADMIN')")
    @Operation(summary = "Xem / tải tài liệu hợp đồng giấy hoặc chứng từ thanh toán có kiểm tra phân quyền theo cơ sở và chủ sở hữu")
    public ResponseEntity<org.springframework.core.io.Resource> viewAuthorizedDocument(
            @PathVariable UUID bookingId,
            @RequestParam("fileUrl") String fileUrl) {
        java.nio.file.Path path = handoverService.getAuthorizedHandoverDocumentPath(bookingId, fileUrl);
        try {
            org.springframework.core.io.Resource resource = new org.springframework.core.io.UrlResource(path.toUri());
            String filename = path.getFileName().toString().toLowerCase();
            org.springframework.http.MediaType contentType = org.springframework.http.MediaType.APPLICATION_OCTET_STREAM;
            if (filename.endsWith(".pdf")) {
                contentType = org.springframework.http.MediaType.APPLICATION_PDF;
            } else if (filename.endsWith(".jpg") || filename.endsWith(".jpeg")) {
                contentType = org.springframework.http.MediaType.IMAGE_JPEG;
            } else if (filename.endsWith(".png")) {
                contentType = org.springframework.http.MediaType.IMAGE_PNG;
            } else if (filename.endsWith(".webp")) {
                contentType = org.springframework.http.MediaType.parseMediaType("image/webp");
            }
            return ResponseEntity.ok()
                    .contentType(contentType)
                    .body(resource);
        } catch (java.net.MalformedURLException e) {
            throw new com.boxora.exception.AppException(com.boxora.exception.ErrorCode.RESOURCE_NOT_FOUND);
        }
    }

    @PostMapping("/contracts/paper")
    @PreAuthorize("hasAnyRole('STAFF', 'FACILITY_MANAGER', 'ADMIN')")
    @Operation(summary = "Điều kiện 1: Khởi tạo hoặc tải lên hồ sơ scan hợp đồng giấy tại kho")
    public ResponseEntity<ApiResponse<com.boxora.dto.response.RentalContractResponse>> createOrUploadPaperContract(
            @Valid @RequestBody com.boxora.dto.request.PaperContractCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Khởi tạo / Tải lên hợp đồng giấy thành công",
                        handoverService.createOrUploadPaperContract(request)));
    }

    @PostMapping("/contracts/paper/verify")
    @PreAuthorize("hasAnyRole('STAFF', 'FACILITY_MANAGER', 'ADMIN')")
    @Operation(summary = "Điều kiện 1: Nhân viên đối chiếu chữ ký và xác nhận hợp đồng giấy")
    public ResponseEntity<ApiResponse<com.boxora.dto.response.RentalContractResponse>> verifyPaperContract(
            @RequestParam UUID bookingId,
            @RequestParam(required = false) String notes) {
        return ResponseEntity.ok(ApiResponse.success("Xác minh hợp đồng giấy thành công",
                handoverService.verifyPaperContract(bookingId, notes)));
    }

    @PostMapping("/payments/manual")
    @PreAuthorize("hasAnyRole('STAFF', 'FACILITY_MANAGER', 'ADMIN')")
    @Operation(summary = "Điều kiện 2 & 3: Ghi nhận thu tiền mặt (phiếu thu) hoặc thông tin chuyển khoản ngân hàng")
    public ResponseEntity<ApiResponse<com.boxora.dto.response.PaymentResponse>> recordManualPayment(
            @Valid @RequestBody com.boxora.dto.request.ManualPaymentRecordRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Ghi nhận giao dịch thanh toán thành công",
                        handoverService.recordManualPayment(request)));
    }

    @PostMapping("/payments/{paymentId}/confirm-bank-transfer")
    @PreAuthorize("hasAnyRole('STAFF', 'FACILITY_MANAGER', 'ADMIN')")
    @Operation(summary = "Điều kiện 2 & 3: Nhân viên có thẩm quyền xác nhận tiền chuyển khoản đã vào tài khoản")
    public ResponseEntity<ApiResponse<com.boxora.dto.response.PaymentResponse>> confirmBankTransferPayment(
            @PathVariable UUID paymentId,
            @RequestParam(required = false) String notes) {
        return ResponseEntity.ok(ApiResponse.success("Xác nhận tiền chuyển khoản đã vào tài khoản thành công",
                handoverService.confirmBankTransferPayment(paymentId, notes)));
    }

    @PostMapping("/booking/{bookingId}/verify-identity")
    @PreAuthorize("hasAnyRole('STAFF', 'FACILITY_MANAGER', 'ADMIN')")
    @Operation(summary = "Điều kiện 4: Nhân viên tại quầy xác nhận đã đối chiếu giấy tờ tùy thân CCCD/Passport gốc")
    public ResponseEntity<ApiResponse<HandoverPrerequisitesResponse>> verifyIdentity(
            @PathVariable UUID bookingId,
            @Valid @RequestBody com.boxora.dto.request.IdentityVerifyRequest request) {
        request.setBookingId(bookingId);
        return ResponseEntity.ok(ApiResponse.success("Xác minh giấy tờ tùy thân gốc thành công",
                handoverService.verifyIdentity(request)));
    }

    @PostMapping("/booking/{bookingId}/complete-step-1")
    @PreAuthorize("hasAnyRole('STAFF', 'FACILITY_MANAGER', 'ADMIN')")
    @Operation(summary = "Hoàn tất Bước 1: Kiểm tra đủ 4 điều kiện đối soát và chuyển sang Bước 2 Nghiệm thu hiện trường")
    public ResponseEntity<ApiResponse<Void>> completeCheckInStep1(@PathVariable UUID bookingId) {
        handoverService.completeCheckInStep1(bookingId);
        return ResponseEntity.ok(ApiResponse.success("Đã hoàn tất Bước 1 đối soát, chuyển sang Nghiệm thu hiện trường thành công", null));
    }

    @PostMapping("/check-in-inspection")
    @PreAuthorize("hasAnyRole('STAFF', 'FACILITY_MANAGER', 'ADMIN')")
    @Operation(summary = "Bước 2: Lưu biên bản nghiệm thu 5 tiêu chuẩn hiện trường và ảnh kiểm định")
    public ResponseEntity<ApiResponse<HandoverResponse>> recordCheckInInspection(
            @Valid @RequestBody com.boxora.dto.request.CheckInInspectionRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Ghi nhận biên bản nghiệm thu hiện trường thành công",
                handoverService.recordCheckInInspection(request)));
    }
}

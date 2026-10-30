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

import com.boxora.dto.response.PaymentResponse;
import com.boxora.dto.response.ReturnCaseResponse;
import org.springframework.format.annotation.DateTimeFormat;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/handovers")
@Tag(name = "Handover & Check-in", description = "API quản lý bàn giao kho, kiểm tra 4 điều kiện check-in (BR-RULE-005/006) và nghiệm thu trả kho, quyết toán hoàn cọc (BR-RULE-013/014/015)")
@RequiredArgsConstructor
public class HandoverController {

    private final HandoverService handoverService;

    @GetMapping("/booking/{bookingId}/prerequisites")
    @PreAuthorize("hasAuthority('HANDOVER_VIEW') or hasAnyRole('ADMIN', 'BUSINESS_MANAGER')")
    @Operation(summary = "Get persisted check-in prerequisites")
    public ResponseEntity<ApiResponse<HandoverPrerequisitesResponse>> getCheckInPrerequisites(@PathVariable UUID bookingId) {
        return ResponseEntity.ok(ApiResponse.success(handoverService.getCheckInPrerequisites(bookingId)));
    }

    @PostMapping("/check-in")
    @PreAuthorize("(hasAuthority('HANDOVER_CREATE') or hasAnyRole('STAFF', 'FACILITY_MANAGER', 'FACILITY_STAFF')) and !hasAnyRole('ADMIN', 'BUSINESS_MANAGER')")
    @Operation(summary = "Thực hiện check-in bàn giao kho vật lý và cấp mã PIN SmartLock")
    public ResponseEntity<ApiResponse<HandoverResponse>> checkIn(@Valid @RequestBody HandoverRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Bàn giao nhận kho và cấp mã PIN truy cập thành công", handoverService.checkIn(request)));
    }

    @GetMapping("/booking/{bookingId}/return-preview")
    @PreAuthorize("hasAuthority('HANDOVER_VIEW') or hasAnyRole('ADMIN', 'BUSINESS_MANAGER', 'CUSTOMER')")
    @Operation(summary = "Xem trước quyết toán tiền cọc, hạn thuê và 5 tiêu chí thẩm định trả kho (BR-RULE-013/014/015)")
    public ResponseEntity<ApiResponse<ReturnSettlementPreviewResponse>> getReturnSettlementPreview(@PathVariable UUID bookingId) {
        ReturnSettlementPreviewResponse response = handoverService.getReturnSettlementPreview(bookingId);
        return ResponseEntity.ok(ApiResponse.success("Xem trước thông tin quyết toán cọc và thẩm định trả kho thành công", response));
    }

    @PostMapping("/checkout-request/{bookingId}")
    @PreAuthorize("hasAuthority('HANDOVER_CREATE') or hasRole('CUSTOMER')")
    @Operation(summary = "Hành động 1 Trả kho: Khách hàng yêu cầu trả kho")
    public ResponseEntity<ApiResponse<HandoverResponse>> requestCheckout(
            @PathVariable UUID bookingId,
            @RequestParam(required = false) String notes) {
        return ResponseEntity.ok(ApiResponse.success("Yêu cầu trả kho đã được tiếp nhận thành công",
                handoverService.requestCheckout(bookingId, notes)));
    }

    @PostMapping("/inspection")
    @PreAuthorize("hasAuthority('HANDOVER_CREATE')")
    @Operation(summary = "Hành động 2 Trả kho: Nhân viên kiểm tra hiện trường, lưu ảnh & ghi nhận hư hỏng")
    public ResponseEntity<ApiResponse<HandoverResponse>> performInspection(@Valid @RequestBody HandoverRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Biên bản kiểm tra hiện trường đã được ghi nhận thành công",
                handoverService.performInspection(request)));
    }

    @PostMapping("/return")
    @PreAuthorize("hasAuthority('HANDOVER_CREATE')")
    @Operation(summary = "Xử lý trả kho và hoàn cọc (BR-RULE-013/014/015)")
    public ResponseEntity<ApiResponse<HandoverResponse>> processReturn(@Valid @RequestBody HandoverRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Nghiệm thu hoàn trả kho và quyết toán cọc thành công", handoverService.processReturn(request)));
    }

    @PostMapping("/return-settlement")
    @PreAuthorize("hasAuthority('HANDOVER_CREATE')")
    @Operation(summary = "Nghiệm thu hiện trường trả kho và quyết toán hoàn cọc chi tiết theo BR-RULE-013/014/015")
    public ResponseEntity<ApiResponse<ReturnSettlementResponse>> processReturnSettlement(@Valid @RequestBody HandoverRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Nghiệm thu hiện trường và quyết toán cọc chi tiết thành công", handoverService.processReturnSettlement(request)));
    }

    @GetMapping("/booking/{bookingId}")
    @PreAuthorize("hasAuthority('HANDOVER_VIEW') or hasAnyRole('ADMIN', 'BUSINESS_MANAGER', 'CUSTOMER')")
    @Operation(summary = "Lấy lịch sử các biên bản bàn giao của đơn đặt kho")
    public ResponseEntity<ApiResponse<List<HandoverResponse>>> getByBookingId(@PathVariable UUID bookingId) {
        return ResponseEntity.ok(ApiResponse.success(handoverService.getByBookingId(bookingId)));
    }

    @PostMapping("/booking/{bookingId}/send-pin-email")
    @PreAuthorize("hasAuthority('HANDOVER_CREATE') and !hasAnyRole('ADMIN', 'BUSINESS_MANAGER')")
    @Operation(summary = "Gửi mã PIN và thông tin bàn giao đến email khách hàng")
    public ResponseEntity<ApiResponse<Void>> sendPinEmail(
            @PathVariable UUID bookingId,
            @RequestParam(required = false) String customEmail) {
        handoverService.sendHandoverPinEmail(bookingId, customEmail);
        return ResponseEntity.ok(ApiResponse.success("Đã gửi mã PIN và thông tin bàn giao đến email khách hàng thành công", null));
    }

    @PostMapping("/booking/{bookingId}/send-web-notification")
    @PreAuthorize("hasAuthority('HANDOVER_CREATE') and !hasAnyRole('ADMIN', 'BUSINESS_MANAGER')")
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
    @PreAuthorize("hasAuthority('HANDOVER_CREATE') or hasAnyRole('FACILITY_STAFF', 'STAFF', 'FACILITY_MANAGER', 'BUSINESS_MANAGER', 'ADMIN')")
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
    @PreAuthorize("hasAuthority('HANDOVER_VIEW') or hasRole('CUSTOMER') or hasRole('FACILITY_STAFF') or hasRole('STAFF') or hasRole('FACILITY_MANAGER') or hasRole('BUSINESS_MANAGER') or hasRole('ADMIN')")
    @Operation(summary = "Xem / tải tài liệu hợp đồng giấy hoặc chứng từ thanh toán có kiểm tra phân quyền theo cơ sở và chủ sở hữu")
    public ResponseEntity<?> viewAuthorizedDocument(
            @PathVariable UUID bookingId,
            @RequestParam("fileUrl") String fileUrl) {
        if (fileUrl != null && (fileUrl.startsWith("http://") || fileUrl.startsWith("https://"))) {
            return ResponseEntity.status(HttpStatus.FOUND)
                    .location(java.net.URI.create(fileUrl))
                    .build();
        }
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
    @PreAuthorize("(hasAuthority('HANDOVER_CREATE') or hasAuthority('CONTRACT_CREATE')) and !hasAnyRole('ADMIN', 'BUSINESS_MANAGER')")
    @Operation(summary = "Điều kiện 1: Khởi tạo hoặc tải lên hồ sơ scan hợp đồng giấy tại kho")
    public ResponseEntity<ApiResponse<com.boxora.dto.response.RentalContractResponse>> createOrUploadPaperContract(
            @Valid @RequestBody com.boxora.dto.request.PaperContractCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Khởi tạo / Tải lên hợp đồng giấy thành công",
                        handoverService.createOrUploadPaperContract(request)));
    }

    @PostMapping("/contracts/paper/verify")
    @PreAuthorize("(hasAuthority('HANDOVER_CREATE') or hasAuthority('CONTRACT_CREATE')) and !hasAnyRole('ADMIN', 'BUSINESS_MANAGER')")
    @Operation(summary = "Điều kiện 1: Nhân viên đối chiếu chữ ký và xác nhận hợp đồng giấy")
    public ResponseEntity<ApiResponse<com.boxora.dto.response.RentalContractResponse>> verifyPaperContract(
            @RequestParam UUID bookingId,
            @RequestParam(required = false) String notes) {
        return ResponseEntity.ok(ApiResponse.success("Xác minh hợp đồng giấy thành công",
                handoverService.verifyPaperContract(bookingId, notes)));
    }

    @PostMapping("/payments/manual")
    @PreAuthorize("hasAuthority('PAYMENT_CREATE') and !hasAnyRole('ADMIN', 'BUSINESS_MANAGER')")
    @Operation(summary = "Điều kiện 2 & 3: Ghi nhận thu tiền mặt (phiếu thu) hoặc thông tin chuyển khoản ngân hàng")
    public ResponseEntity<ApiResponse<com.boxora.dto.response.PaymentResponse>> recordManualPayment(
            @Valid @RequestBody com.boxora.dto.request.ManualPaymentRecordRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Ghi nhận giao dịch thanh toán thành công",
                        handoverService.recordManualPayment(request)));
    }

    @PostMapping("/payments/{paymentId}/confirm-bank-transfer")
    @PreAuthorize("hasAuthority('PAYMENT_CREATE') and !hasAnyRole('ADMIN', 'BUSINESS_MANAGER')")
    @Operation(summary = "Điều kiện 2 & 3: Nhân viên có thẩm quyền xác nhận tiền chuyển khoản đã vào tài khoản")
    public ResponseEntity<ApiResponse<com.boxora.dto.response.PaymentResponse>> confirmBankTransferPayment(
            @PathVariable UUID paymentId,
            @RequestParam(required = false) String notes) {
        return ResponseEntity.ok(ApiResponse.success("Xác nhận tiền chuyển khoản đã vào tài khoản thành công",
                handoverService.confirmBankTransferPayment(paymentId, notes)));
    }

    @PostMapping("/booking/{bookingId}/verify-identity")
    @PreAuthorize("(hasAuthority('HANDOVER_CREATE') or hasAnyRole('STAFF', 'FACILITY_STAFF', 'FACILITY_MANAGER')) and !hasAnyRole('ADMIN', 'BUSINESS_MANAGER')")
    @Operation(summary = "Điều kiện 4: Nhân viên tại quầy xác nhận đã đối chiếu giấy tờ tùy thân CCCD/Passport gốc")
    public ResponseEntity<ApiResponse<HandoverPrerequisitesResponse>> verifyIdentity(
            @PathVariable UUID bookingId,
            @Valid @RequestBody com.boxora.dto.request.IdentityVerifyRequest request) {
        request.setBookingId(bookingId);
        return ResponseEntity.ok(ApiResponse.success("Xác minh giấy tờ tùy thân gốc thành công",
                handoverService.verifyIdentity(request)));
    }

    @PostMapping("/booking/{bookingId}/assign-unit")
    @PreAuthorize("(hasAuthority('HANDOVER_CREATE') or hasAnyRole('STAFF', 'FACILITY_STAFF', 'FACILITY_MANAGER')) and !hasAnyRole('ADMIN', 'BUSINESS_MANAGER')")
    @Operation(summary = "Bước 2: Chọn và gán vị trí ô kho vật lý cho đơn đặt kho")
    public ResponseEntity<ApiResponse<HandoverPrerequisitesResponse>> assignUnit(
            @PathVariable UUID bookingId,
            @RequestParam String unitCode) {
        return ResponseEntity.ok(ApiResponse.success("Gán ô kho vật lý thành công",
                handoverService.assignUnitToBooking(bookingId, unitCode)));
    }

    @PostMapping("/booking/{bookingId}/complete-step-1")
    @PreAuthorize("(hasAuthority('HANDOVER_CREATE') or hasAnyRole('STAFF', 'FACILITY_STAFF', 'FACILITY_MANAGER')) and !hasAnyRole('ADMIN', 'BUSINESS_MANAGER')")
    @Operation(summary = "Hoàn tất Bước 1: Kiểm tra đủ 4 điều kiện đối soát và chuyển sang Bước 2 Nghiệm thu hiện trường")
    public ResponseEntity<ApiResponse<Void>> completeCheckInStep1(@PathVariable UUID bookingId) {
        handoverService.completeCheckInStep1(bookingId);
        return ResponseEntity.ok(ApiResponse.success("Đã hoàn tất Bước 1 đối soát, chuyển sang Nghiệm thu hiện trường thành công", null));
    }

    @PostMapping("/check-in-inspection")
    @PreAuthorize("(hasAuthority('HANDOVER_CREATE') or hasAnyRole('STAFF', 'FACILITY_STAFF', 'FACILITY_MANAGER')) and !hasAnyRole('ADMIN', 'BUSINESS_MANAGER')")
    @Operation(summary = "Bước 2: Lưu biên bản nghiệm thu 5 tiêu chuẩn hiện trường và ảnh kiểm định")
    public ResponseEntity<ApiResponse<HandoverResponse>> recordCheckInInspection(
            @Valid @RequestBody com.boxora.dto.request.CheckInInspectionRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Ghi nhận biên bản nghiệm thu hiện trường thành công",
                handoverService.recordCheckInInspection(request)));
    }

    // =========================================================================
    // QUY TRÌNH TOÀN DIỆN: NGHIỆM THU HIỆN TRƯỜNG & TRẢ KHO (WAREHOUSE RETURN)
    // =========================================================================

    @GetMapping("/returns")
    @PreAuthorize("hasAuthority('HANDOVER_VIEW') or hasAnyRole('STAFF', 'FACILITY_STAFF', 'FACILITY_MANAGER', 'BUSINESS_MANAGER', 'ADMIN')")
    @Operation(summary = "Danh sách hồ sơ trả kho với tìm kiếm và lọc đa tiêu chí")
    public ResponseEntity<ApiResponse<List<ReturnCaseResponse>>> getReturnCases(
            @RequestParam(required = false) String facilityId,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateTo) {
        UUID parsedFacilityId = null;
        if (facilityId != null && !facilityId.isBlank() && !"ALL".equalsIgnoreCase(facilityId)
                && !"undefined".equalsIgnoreCase(facilityId) && !"null".equalsIgnoreCase(facilityId)) {
            try {
                parsedFacilityId = UUID.fromString(facilityId.trim());
            } catch (IllegalArgumentException ignored) {}
        }
        return ResponseEntity.ok(ApiResponse.success(
                handoverService.getReturnCases(parsedFacilityId, search, status, dateFrom, dateTo)));
    }

    @GetMapping("/returns/{bookingId}")
    @PreAuthorize("hasAuthority('HANDOVER_VIEW') or hasRole('CUSTOMER') or hasAnyRole('STAFF', 'FACILITY_STAFF', 'FACILITY_MANAGER', 'BUSINESS_MANAGER', 'ADMIN')")
    @Operation(summary = "Chi tiết hồ sơ trả kho và lịch sử xử lý")
    public ResponseEntity<ApiResponse<ReturnCaseResponse>> getReturnCaseDetail(
            @PathVariable UUID bookingId) {
        return ResponseEntity.ok(ApiResponse.success(
                handoverService.getReturnCaseDetail(bookingId)));
    }

    @PostMapping("/returns/{bookingId}/schedule")
    @PreAuthorize("hasAuthority('HANDOVER_CREATE') or hasAnyRole('STAFF', 'FACILITY_STAFF', 'FACILITY_MANAGER', 'ADMIN')")
    @Operation(summary = "Xác nhận hoặc đổi lịch hẹn nghiệm thu hiện trường")
    public ResponseEntity<ApiResponse<HandoverResponse>> scheduleInspection(
            @PathVariable UUID bookingId,
            @RequestParam(required = false) String scheduledAt,
            @RequestParam(required = false) String notes) {
        LocalDateTime parsedDateTime = parseFlexibleDateTime(scheduledAt);
        return ResponseEntity.ok(ApiResponse.success("Xác nhận lịch nghiệm thu hiện trường thành công",
                handoverService.scheduleInspection(bookingId, parsedDateTime, notes)));
    }

    private LocalDateTime parseFlexibleDateTime(String input) {
        if (input == null || input.isBlank()) {
            return LocalDateTime.now();
        }
        String trimmed = input.trim();
        List<java.time.format.DateTimeFormatter> formatters = List.of(
                java.time.format.DateTimeFormatter.ISO_DATE_TIME,
                java.time.format.DateTimeFormatter.ofPattern("HH:mm dd/MM/yyyy"),
                java.time.format.DateTimeFormatter.ofPattern("HH:mm:ss dd/MM/yyyy"),
                java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm"),
                java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss"),
                java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"),
                java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")
        );
        for (java.time.format.DateTimeFormatter fmt : formatters) {
            try {
                return LocalDateTime.parse(trimmed, fmt);
            } catch (Exception ignored) {}
        }
        try {
            return LocalDate.parse(trimmed, java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy")).atStartOfDay();
        } catch (Exception ignored) {}
        try {
            return LocalDate.parse(trimmed, java.time.format.DateTimeFormatter.ISO_DATE).atStartOfDay();
        } catch (Exception ignored) {}
        return LocalDateTime.now();
    }

    @PostMapping("/returns/{bookingId}/start-inspection")
    @PreAuthorize("hasAuthority('HANDOVER_CREATE') or hasAnyRole('STAFF', 'FACILITY_STAFF', 'FACILITY_MANAGER', 'ADMIN')")
    @Operation(summary = "Bắt đầu nghiệm thu hiện trường")
    public ResponseEntity<ApiResponse<HandoverResponse>> startInspection(
            @PathVariable UUID bookingId) {
        return ResponseEntity.ok(ApiResponse.success("Bắt đầu nghiệm thu hiện trường thành công",
                handoverService.startInspection(bookingId)));
    }

    @PostMapping("/returns/inspection")
    @PreAuthorize("hasAuthority('HANDOVER_CREATE') or hasAnyRole('STAFF', 'FACILITY_STAFF', 'FACILITY_MANAGER', 'ADMIN')")
    @Operation(summary = "Lưu biên bản kiểm định 7 tiêu chí hiện trường (hỗ trợ lưu nháp hoặc chốt biên bản)")
    public ResponseEntity<ApiResponse<HandoverResponse>> saveInspection(
            @Valid @RequestBody HandoverRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Lưu biên bản kiểm định hiện trường thành công",
                handoverService.saveInspection(request)));
    }

    @PostMapping("/returns/{bookingId}/calculate-settlement")
    @PreAuthorize("hasAuthority('HANDOVER_VIEW') or hasRole('CUSTOMER') or hasAnyRole('STAFF', 'FACILITY_STAFF', 'FACILITY_MANAGER', 'ADMIN')")
    @Operation(summary = "Tính toán đối soát quyết toán tiền cọc, công nợ và chi phí hư hại")
    public ResponseEntity<ApiResponse<ReturnSettlementResponse>> calculateSettlement(
            @PathVariable UUID bookingId,
            @RequestBody(required = false) HandoverRequest request) {
        if (request == null) {
            request = new HandoverRequest();
        }
        request.setBookingId(bookingId);
        return ResponseEntity.ok(ApiResponse.success("Tính toán quyết toán cọc thành công",
                handoverService.calculateSettlement(bookingId, request)));
    }

    @PostMapping("/returns/{bookingId}/submit-approval")
    @PreAuthorize("hasAuthority('HANDOVER_CREATE') or hasAnyRole('STAFF', 'FACILITY_STAFF', 'FACILITY_MANAGER', 'ADMIN')")
    @Operation(summary = "Trình cấp quản lý phê duyệt các khoản khấu trừ bồi thường")
    public ResponseEntity<ApiResponse<HandoverResponse>> submitDeductionsForApproval(
            @PathVariable UUID bookingId,
            @RequestParam(required = false) String notes) {
        return ResponseEntity.ok(ApiResponse.success("Trình phê duyệt quyết toán khấu trừ thành công",
                handoverService.submitDeductionsForApproval(bookingId, notes)));
    }

    @PostMapping("/returns/{bookingId}/approve-settlement")
    @PreAuthorize("hasAuthority('HANDOVER_APPROVE') or hasAnyRole('FACILITY_MANAGER', 'BUSINESS_MANAGER', 'ADMIN')")
    @Operation(summary = "Quản lý cơ sở / Ban quản lý phê duyệt hoặc từ chối quyết toán khấu trừ")
    public ResponseEntity<ApiResponse<ReturnSettlementResponse>> approveSettlement(
            @PathVariable UUID bookingId,
            @RequestBody(required = false) HandoverRequest request) {
        if (request == null) {
            request = new HandoverRequest();
        }
        request.setBookingId(bookingId);
        return ResponseEntity.ok(ApiResponse.success("Xử lý phê duyệt quyết toán khấu trừ thành công",
                handoverService.approveSettlement(bookingId, request)));
    }

    @PostMapping("/returns/{bookingId}/dispute")
    @PreAuthorize("hasAuthority('HANDOVER_CREATE') or hasRole('CUSTOMER') or hasAnyRole('STAFF', 'FACILITY_STAFF', 'FACILITY_MANAGER', 'ADMIN')")
    @Operation(summary = "Ghi nhận khiếu nại / tranh chấp từ khách hàng đối với số tiền bồi thường")
    public ResponseEntity<ApiResponse<HandoverResponse>> recordCustomerDispute(
            @PathVariable UUID bookingId,
            @RequestParam String disputeReason) {
        return ResponseEntity.ok(ApiResponse.success("Ghi nhận khiếu nại tranh chấp thành công",
                handoverService.recordCustomerDispute(bookingId, disputeReason)));
    }

    @PostMapping("/returns/{bookingId}/collect-additional-payment")
    @PreAuthorize("hasAuthority('PAYMENT_CREATE') or hasAnyRole('STAFF', 'FACILITY_STAFF', 'FACILITY_MANAGER', 'ADMIN')")
    @Operation(summary = "Thu khoản bồi thường bổ sung khi chi phí vượt quá tiền cọc")
    public ResponseEntity<ApiResponse<PaymentResponse>> collectAdditionalPayment(
            @PathVariable UUID bookingId,
            @RequestBody(required = false) HandoverRequest request) {
        if (request == null) {
            request = new HandoverRequest();
        }
        request.setBookingId(bookingId);
        return ResponseEntity.ok(ApiResponse.success("Thu khoản bồi thường bổ sung thành công",
                handoverService.collectAdditionalPayment(bookingId, request)));
    }

    @PostMapping("/returns/{bookingId}/execute-refund")
    @PreAuthorize("hasAuthority('HANDOVER_CREATE') or hasAnyRole('FACILITY_MANAGER', 'ADMIN', 'STAFF', 'FACILITY_STAFF')")
    @Operation(summary = "Thực hiện lệnh hoàn trả tiền cọc cho khách hàng")
    public ResponseEntity<ApiResponse<ReturnSettlementResponse>> executeRefund(
            @PathVariable UUID bookingId,
            @RequestBody(required = false) HandoverRequest request) {
        if (request == null) {
            request = new HandoverRequest();
        }
        request.setBookingId(bookingId);
        return ResponseEntity.ok(ApiResponse.success("Lệnh hoàn trả tiền cọc đã được thực hiện thành công",
                handoverService.executeRefund(bookingId, request)));
    }

    @PostMapping("/returns/{bookingId}/confirm-physical-return")
    @PreAuthorize("hasAuthority('HANDOVER_CREATE') or hasAnyRole('STAFF', 'FACILITY_STAFF', 'FACILITY_MANAGER', 'ADMIN')")
    @Operation(summary = "Xác nhận nhận lại kho vật lý & đồ đạc đã dọn sạch")
    public ResponseEntity<ApiResponse<HandoverResponse>> confirmPhysicalReturn(
            @PathVariable UUID bookingId,
            @RequestBody(required = false) HandoverRequest request) {
        if (request == null) {
            request = new HandoverRequest();
        }
        request.setBookingId(bookingId);
        return ResponseEntity.ok(ApiResponse.success("Xác nhận nhận lại kho vật lý thành công",
                handoverService.confirmPhysicalReturn(bookingId, request)));
    }

    @PostMapping("/returns/{bookingId}/revoke-access")
    @PreAuthorize("hasAuthority('HANDOVER_CREATE') or hasAnyRole('STAFF', 'FACILITY_STAFF', 'FACILITY_MANAGER', 'ADMIN')")
    @Operation(summary = "Thu hồi mã PIN SmartLock và quyền truy cập kho của khách hàng")
    public ResponseEntity<ApiResponse<HandoverResponse>> revokeAccess(
            @PathVariable UUID bookingId) {
        return ResponseEntity.ok(ApiResponse.success("Thu hồi quyền truy cập kho thành công",
                handoverService.revokeAccess(bookingId)));
    }

    @PostMapping("/returns/{bookingId}/complete")
    @PreAuthorize("hasAuthority('HANDOVER_CREATE') or hasAnyRole('FACILITY_MANAGER', 'ADMIN', 'STAFF', 'FACILITY_STAFF')")
    @Operation(summary = "Hoàn tất toàn bộ hồ sơ trả kho, thanh lý hợp đồng và chuyển trạng thái kho")
    public ResponseEntity<ApiResponse<ReturnSettlementResponse>> completeReturn(
            @PathVariable UUID bookingId) {
        return ResponseEntity.ok(ApiResponse.success("Hoàn tất toàn bộ hồ sơ trả kho thành công",
                handoverService.completeReturn(bookingId)));
    }

    @PostMapping("/returns/{bookingId}/confirm-settlement")
    @PreAuthorize("hasAuthority('HANDOVER_CREATE') or hasAnyRole('STAFF', 'FACILITY_STAFF', 'FACILITY_MANAGER')")
    @Operation(summary = "Task 16.1: Nhân viên xác nhận đã kiểm tra & tính phí đối soát gửi cho khách hàng")
    public ResponseEntity<ApiResponse<ReturnSettlementResponse>> confirmSettlement(
            @PathVariable UUID bookingId,
            @RequestBody(required = false) com.boxora.dto.request.SettlementConfirmRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Xác nhận đã kiểm tra và tính phí quyết toán thành công",
                handoverService.confirmSettlementCalculation(bookingId, request != null ? request : new com.boxora.dto.request.SettlementConfirmRequest())));
    }

    @PostMapping("/returns/{bookingId}/customer-decision")
    @PreAuthorize("hasRole('CUSTOMER') or hasAuthority('HANDOVER_VIEW')")
    @Operation(summary = "Task 16.3 & 16.4: Khách hàng đồng ý hoặc khiếu nại kết quả quyết toán")
    public ResponseEntity<ApiResponse<ReturnSettlementResponse>> handleCustomerDecision(
            @PathVariable UUID bookingId,
            @Valid @RequestBody com.boxora.dto.request.CustomerDecisionRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Ghi nhận phản hồi quyết toán từ khách hàng thành công",
                handoverService.handleCustomerDecision(bookingId, request)));
    }

    @PostMapping("/returns/{bookingId}/cancel-dispute")
    @PreAuthorize("hasRole('CUSTOMER') or hasAuthority('HANDOVER_VIEW')")
    @Operation(summary = "Khách hàng hủy yêu cầu khiếu nại kết quả quyết toán")
    public ResponseEntity<ApiResponse<ReturnSettlementResponse>> cancelDispute(
            @PathVariable UUID bookingId) {
        return ResponseEntity.ok(ApiResponse.success("Đã hủy yêu cầu khiếu nại thành công",
                handoverService.cancelDispute(bookingId)));
    }

    @PostMapping("/returns/{bookingId}/resolve-dispute")
    @PreAuthorize("hasAuthority('HANDOVER_APPROVE') or hasRole('FACILITY_MANAGER')")
    @Operation(summary = "Task 16.3: Quản lý cơ sở (FACILITY_MANAGER) giải quyết khiếu nại quyết toán")
    public ResponseEntity<ApiResponse<ReturnSettlementResponse>> resolveDispute(
            @PathVariable UUID bookingId,
            @Valid @RequestBody com.boxora.dto.request.DisputeResolveRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Giải quyết khiếu nại quyết toán thành công",
                handoverService.resolveDispute(bookingId, request)));
    }

    @PostMapping("/returns/{bookingId}/payout")
    @PreAuthorize("hasAuthority('REFUND_APPROVE') or hasAnyRole('FACILITY_MANAGER', 'BUSINESS_MANAGER', 'ADMIN')")
    @Operation(summary = "Task 16.4: Kế toán / Quản lý kinh doanh (BUSINESS_MANAGER/ADMIN) xác nhận giải ngân hoàn tiền")
    public ResponseEntity<ApiResponse<ReturnSettlementResponse>> executePayout(
            @PathVariable UUID bookingId,
            @Valid @RequestBody com.boxora.dto.request.ReturnPayoutRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Xác nhận giải ngân hoàn tiền thành công",
                handoverService.executePayout(bookingId, request)));
    }
}
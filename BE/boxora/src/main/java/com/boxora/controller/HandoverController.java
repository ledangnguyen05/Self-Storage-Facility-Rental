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
@Tag(name = "Handover & Check-in", description = "API quáº£n lĂ½ bĂ n giao kho, kiá»ƒm tra 4 Ä‘iá»u kiá»‡n check-in (BR-RULE-005/006) vĂ  nghiá»‡m thu tráº£ kho, quyáº¿t toĂ¡n hoĂ n cá»c (BR-RULE-013/014/015)")
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
    @Operation(summary = "Thá»±c hiá»‡n check-in bĂ n giao kho váº­t lĂ½ vĂ  cáº¥p mĂ£ PIN SmartLock")
    public ResponseEntity<ApiResponse<HandoverResponse>> checkIn(@Valid @RequestBody HandoverRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("BĂ n giao nháº­n kho vĂ  cáº¥p mĂ£ PIN truy cáº­p thĂ nh cĂ´ng", handoverService.checkIn(request)));
    }

    @GetMapping("/booking/{bookingId}/return-preview")
    @PreAuthorize("hasAuthority('HANDOVER_VIEW') or hasAnyRole('ADMIN', 'BUSINESS_MANAGER', 'CUSTOMER')")
    @Operation(summary = "Xem trÆ°á»›c quyáº¿t toĂ¡n tiá»n cá»c, háº¡n thuĂª vĂ  5 tiĂªu chĂ­ tháº©m Ä‘á»‹nh tráº£ kho (BR-RULE-013/014/015)")
    public ResponseEntity<ApiResponse<ReturnSettlementPreviewResponse>> getReturnSettlementPreview(@PathVariable UUID bookingId) {
        ReturnSettlementPreviewResponse response = handoverService.getReturnSettlementPreview(bookingId);
        return ResponseEntity.ok(ApiResponse.success("Xem trÆ°á»›c thĂ´ng tin quyáº¿t toĂ¡n cá»c vĂ  tháº©m Ä‘á»‹nh tráº£ kho thĂ nh cĂ´ng", response));
    }

    @PostMapping("/checkout-request/{bookingId}")
    @PreAuthorize("hasAuthority('HANDOVER_CREATE') or hasRole('CUSTOMER')")
    @Operation(summary = "HĂ nh Ä‘á»™ng 1 Tráº£ kho: KhĂ¡ch hĂ ng yĂªu cáº§u tráº£ kho")
    public ResponseEntity<ApiResponse<HandoverResponse>> requestCheckout(
            @PathVariable UUID bookingId,
            @RequestParam(required = false) String notes) {
        return ResponseEntity.ok(ApiResponse.success("YĂªu cáº§u tráº£ kho Ä‘Ă£ Ä‘Æ°á»£c tiáº¿p nháº­n thĂ nh cĂ´ng",
                handoverService.requestCheckout(bookingId, notes)));
    }

    @PostMapping("/inspection")
    @PreAuthorize("hasAuthority('HANDOVER_CREATE')")
    @Operation(summary = "HĂ nh Ä‘á»™ng 2 Tráº£ kho: NhĂ¢n viĂªn kiá»ƒm tra hiá»‡n trÆ°á»ng, lÆ°u áº£nh & ghi nháº­n hÆ° há»ng")
    public ResponseEntity<ApiResponse<HandoverResponse>> performInspection(@Valid @RequestBody HandoverRequest request) {
        return ResponseEntity.ok(ApiResponse.success("BiĂªn báº£n kiá»ƒm tra hiá»‡n trÆ°á»ng Ä‘Ă£ Ä‘Æ°á»£c ghi nháº­n thĂ nh cĂ´ng",
                handoverService.performInspection(request)));
    }

    @PostMapping("/return")
    @PreAuthorize("hasAuthority('HANDOVER_CREATE')")
    @Operation(summary = "Xá»­ lĂ½ tráº£ kho vĂ  hoĂ n cá»c (BR-RULE-013/014/015)")
    public ResponseEntity<ApiResponse<HandoverResponse>> processReturn(@Valid @RequestBody HandoverRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Nghiá»‡m thu hoĂ n tráº£ kho vĂ  quyáº¿t toĂ¡n cá»c thĂ nh cĂ´ng", handoverService.processReturn(request)));
    }

    @PostMapping("/return-settlement")
    @PreAuthorize("hasAuthority('HANDOVER_CREATE')")
    @Operation(summary = "Nghiá»‡m thu hiá»‡n trÆ°á»ng tráº£ kho vĂ  quyáº¿t toĂ¡n hoĂ n cá»c chi tiáº¿t theo BR-RULE-013/014/015")
    public ResponseEntity<ApiResponse<ReturnSettlementResponse>> processReturnSettlement(@Valid @RequestBody HandoverRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Nghiá»‡m thu hiá»‡n trÆ°á»ng vĂ  quyáº¿t toĂ¡n cá»c chi tiáº¿t thĂ nh cĂ´ng", handoverService.processReturnSettlement(request)));
    }

    @GetMapping("/booking/{bookingId}")
    @PreAuthorize("hasAuthority('HANDOVER_VIEW') or hasAnyRole('ADMIN', 'BUSINESS_MANAGER', 'CUSTOMER')")
    @Operation(summary = "Láº¥y lá»‹ch sá»­ cĂ¡c biĂªn báº£n bĂ n giao cá»§a Ä‘Æ¡n Ä‘áº·t kho")
    public ResponseEntity<ApiResponse<List<HandoverResponse>>> getByBookingId(@PathVariable UUID bookingId) {
        return ResponseEntity.ok(ApiResponse.success(handoverService.getByBookingId(bookingId)));
    }

    @PostMapping("/booking/{bookingId}/send-pin-email")
    @PreAuthorize("hasAuthority('HANDOVER_CREATE') and !hasAnyRole('ADMIN', 'BUSINESS_MANAGER')")
    @Operation(summary = "Gá»­i mĂ£ PIN vĂ  thĂ´ng tin bĂ n giao Ä‘áº¿n email khĂ¡ch hĂ ng")
    public ResponseEntity<ApiResponse<Void>> sendPinEmail(
            @PathVariable UUID bookingId,
            @RequestParam(required = false) String customEmail) {
        handoverService.sendHandoverPinEmail(bookingId, customEmail);
        return ResponseEntity.ok(ApiResponse.success("ÄĂ£ gá»­i mĂ£ PIN vĂ  thĂ´ng tin bĂ n giao Ä‘áº¿n email khĂ¡ch hĂ ng thĂ nh cĂ´ng", null));
    }

    @PostMapping("/booking/{bookingId}/send-web-notification")
    @PreAuthorize("hasAuthority('HANDOVER_CREATE') and !hasAnyRole('ADMIN', 'BUSINESS_MANAGER')")
    @Operation(summary = "Báº¯n thĂ´ng bĂ¡o web Ä‘áº¿n tĂ i khoáº£n khĂ¡ch hĂ ng")
    public ResponseEntity<ApiResponse<com.boxora.dto.response.NotificationLogResponse>> sendWebNotification(
            @PathVariable UUID bookingId) {
        return ResponseEntity.ok(ApiResponse.success("ÄĂ£ báº¯n thĂ´ng bĂ¡o web thĂ nh cĂ´ng",
                handoverService.sendHandoverWebNotification(bookingId)));
    }

    // =========================================================================
    // QUY TRĂŒNH CHECK-IN Äá»I SOĂT 4 ÄIá»€U KIá»†N & NGHIá»†M THU HIá»†N TRÆ¯á»œNG
    // =========================================================================

    @PostMapping(value = "/booking/{bookingId}/upload-document", consumes = org.springframework.http.MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAuthority('HANDOVER_CREATE') and !hasAnyRole('ADMIN', 'BUSINESS_MANAGER')")
    @Operation(summary = "Táº£i lĂªn tá»‡p há»£p Ä‘á»“ng giáº¥y scan hoáº·c chá»©ng tá»« chuyá»ƒn khoáº£n (PDF, JPG, JPEG, PNG, WEBP, tá»‘i Ä‘a 10MB)")
    public ResponseEntity<ApiResponse<com.boxora.dto.response.FileUploadResponse>> uploadHandoverDocument(
            @PathVariable UUID bookingId,
            @RequestParam("file") org.springframework.web.multipart.MultipartFile file,
            @RequestParam(value = "documentType", required = false, defaultValue = "PAPER_CONTRACT") String documentType) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Táº£i lĂªn tĂ i liá»‡u thĂ nh cĂ´ng",
                        handoverService.uploadHandoverDocument(bookingId, file, documentType)));
    }

    @GetMapping("/booking/{bookingId}/documents/view")
    @PreAuthorize("hasAuthority('HANDOVER_VIEW') or hasRole('CUSTOMER') or hasRole('FACILITY_STAFF') or hasRole('STAFF') or hasRole('FACILITY_MANAGER') or hasRole('BUSINESS_MANAGER') or hasRole('ADMIN')")
    @Operation(summary = "Xem / táº£i tĂ i liá»‡u há»£p Ä‘á»“ng giáº¥y hoáº·c chá»©ng tá»« thanh toĂ¡n cĂ³ kiá»ƒm tra phĂ¢n quyá»n theo cÆ¡ sá»Ÿ vĂ  chá»§ sá»Ÿ há»¯u")
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
    @Operation(summary = "Äiá»u kiá»‡n 1: Khá»Ÿi táº¡o hoáº·c táº£i lĂªn há»“ sÆ¡ scan há»£p Ä‘á»“ng giáº¥y táº¡i kho")
    public ResponseEntity<ApiResponse<com.boxora.dto.response.RentalContractResponse>> createOrUploadPaperContract(
            @Valid @RequestBody com.boxora.dto.request.PaperContractCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Khá»Ÿi táº¡o / Táº£i lĂªn há»£p Ä‘á»“ng giáº¥y thĂ nh cĂ´ng",
                        handoverService.createOrUploadPaperContract(request)));
    }

    @PostMapping("/contracts/paper/verify")
    @PreAuthorize("(hasAuthority('HANDOVER_CREATE') or hasAuthority('CONTRACT_CREATE')) and !hasAnyRole('ADMIN', 'BUSINESS_MANAGER')")
    @Operation(summary = "Äiá»u kiá»‡n 1: NhĂ¢n viĂªn Ä‘á»‘i chiáº¿u chá»¯ kĂ½ vĂ  xĂ¡c nháº­n há»£p Ä‘á»“ng giáº¥y")
    public ResponseEntity<ApiResponse<com.boxora.dto.response.RentalContractResponse>> verifyPaperContract(
            @RequestParam UUID bookingId,
            @RequestParam(required = false) String notes) {
        return ResponseEntity.ok(ApiResponse.success("XĂ¡c minh há»£p Ä‘á»“ng giáº¥y thĂ nh cĂ´ng",
                handoverService.verifyPaperContract(bookingId, notes)));
    }

    @PostMapping("/payments/manual")
    @PreAuthorize("hasAuthority('PAYMENT_CREATE') and !hasAnyRole('ADMIN', 'BUSINESS_MANAGER')")
    @Operation(summary = "Äiá»u kiá»‡n 2 & 3: Ghi nháº­n thu tiá»n máº·t (phiáº¿u thu) hoáº·c thĂ´ng tin chuyá»ƒn khoáº£n ngĂ¢n hĂ ng")
    public ResponseEntity<ApiResponse<com.boxora.dto.response.PaymentResponse>> recordManualPayment(
            @Valid @RequestBody com.boxora.dto.request.ManualPaymentRecordRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Ghi nháº­n giao dá»‹ch thanh toĂ¡n thĂ nh cĂ´ng",
                        handoverService.recordManualPayment(request)));
    }

    @PostMapping("/payments/{paymentId}/confirm-bank-transfer")
    @PreAuthorize("hasAuthority('PAYMENT_CREATE') and !hasAnyRole('ADMIN', 'BUSINESS_MANAGER')")
    @Operation(summary = "Äiá»u kiá»‡n 2 & 3: NhĂ¢n viĂªn cĂ³ tháº©m quyá»n xĂ¡c nháº­n tiá»n chuyá»ƒn khoáº£n Ä‘Ă£ vĂ o tĂ i khoáº£n")
    public ResponseEntity<ApiResponse<com.boxora.dto.response.PaymentResponse>> confirmBankTransferPayment(
            @PathVariable UUID paymentId,
            @RequestParam(required = false) String notes) {
        return ResponseEntity.ok(ApiResponse.success("XĂ¡c nháº­n tiá»n chuyá»ƒn khoáº£n Ä‘Ă£ vĂ o tĂ i khoáº£n thĂ nh cĂ´ng",
                handoverService.confirmBankTransferPayment(paymentId, notes)));
    }

    @PostMapping("/booking/{bookingId}/verify-identity")
    @PreAuthorize("(hasAuthority('HANDOVER_CREATE') or hasAnyRole('STAFF', 'FACILITY_STAFF', 'FACILITY_MANAGER')) and !hasAnyRole('ADMIN', 'BUSINESS_MANAGER')")
    @Operation(summary = "Äiá»u kiá»‡n 4: NhĂ¢n viĂªn táº¡i quáº§y xĂ¡c nháº­n Ä‘Ă£ Ä‘á»‘i chiáº¿u giáº¥y tá» tĂ¹y thĂ¢n CCCD/Passport gá»‘c")
    public ResponseEntity<ApiResponse<HandoverPrerequisitesResponse>> verifyIdentity(
            @PathVariable UUID bookingId,
            @Valid @RequestBody com.boxora.dto.request.IdentityVerifyRequest request) {
        request.setBookingId(bookingId);
        return ResponseEntity.ok(ApiResponse.success("XĂ¡c minh giáº¥y tá» tĂ¹y thĂ¢n gá»‘c thĂ nh cĂ´ng",
                handoverService.verifyIdentity(request)));
    }

    @PostMapping("/booking/{bookingId}/assign-unit")
    @PreAuthorize("(hasAuthority('HANDOVER_CREATE') or hasAnyRole('STAFF', 'FACILITY_STAFF', 'FACILITY_MANAGER')) and !hasAnyRole('ADMIN', 'BUSINESS_MANAGER')")
    @Operation(summary = "BÆ°á»›c 2: Chá»n vĂ  gĂ¡n vá»‹ trĂ­ Ă´ kho váº­t lĂ½ cho Ä‘Æ¡n Ä‘áº·t kho")
    public ResponseEntity<ApiResponse<HandoverPrerequisitesResponse>> assignUnit(
            @PathVariable UUID bookingId,
            @RequestParam String unitCode) {
        return ResponseEntity.ok(ApiResponse.success("GĂ¡n Ă´ kho váº­t lĂ½ thĂ nh cĂ´ng",
                handoverService.assignUnitToBooking(bookingId, unitCode)));
    }

    @PostMapping("/booking/{bookingId}/complete-step-1")
    @PreAuthorize("(hasAuthority('HANDOVER_CREATE') or hasAnyRole('STAFF', 'FACILITY_STAFF', 'FACILITY_MANAGER')) and !hasAnyRole('ADMIN', 'BUSINESS_MANAGER')")
    @Operation(summary = "HoĂ n táº¥t BÆ°á»›c 1: Kiá»ƒm tra Ä‘á»§ 4 Ä‘iá»u kiá»‡n Ä‘á»‘i soĂ¡t vĂ  chuyá»ƒn sang BÆ°á»›c 2 Nghiá»‡m thu hiá»‡n trÆ°á»ng")
    public ResponseEntity<ApiResponse<Void>> completeCheckInStep1(@PathVariable UUID bookingId) {
        handoverService.completeCheckInStep1(bookingId);
        return ResponseEntity.ok(ApiResponse.success("ÄĂ£ hoĂ n táº¥t BÆ°á»›c 1 Ä‘á»‘i soĂ¡t, chuyá»ƒn sang Nghiá»‡m thu hiá»‡n trÆ°á»ng thĂ nh cĂ´ng", null));
    }

    @PostMapping("/check-in-inspection")
    @PreAuthorize("(hasAuthority('HANDOVER_CREATE') or hasAnyRole('STAFF', 'FACILITY_STAFF', 'FACILITY_MANAGER')) and !hasAnyRole('ADMIN', 'BUSINESS_MANAGER')")
    @Operation(summary = "BÆ°á»›c 2: LÆ°u biĂªn báº£n nghiá»‡m thu 5 tiĂªu chuáº©n hiá»‡n trÆ°á»ng vĂ  áº£nh kiá»ƒm Ä‘á»‹nh")
    public ResponseEntity<ApiResponse<HandoverResponse>> recordCheckInInspection(
            @Valid @RequestBody com.boxora.dto.request.CheckInInspectionRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Ghi nháº­n biĂªn báº£n nghiá»‡m thu hiá»‡n trÆ°á»ng thĂ nh cĂ´ng",
                handoverService.recordCheckInInspection(request)));
    }

    // =========================================================================
    // QUY TRĂŒNH TOĂ€N DIá»†N: NGHIá»†M THU HIá»†N TRÆ¯á»œNG & TRáº¢ KHO (WAREHOUSE RETURN)
    // =========================================================================

    @GetMapping("/returns")
    @PreAuthorize("hasAuthority('HANDOVER_VIEW') or hasAnyRole('STAFF', 'FACILITY_STAFF', 'FACILITY_MANAGER', 'BUSINESS_MANAGER', 'ADMIN')")
    @Operation(summary = "Danh sĂ¡ch há»“ sÆ¡ tráº£ kho vá»›i tĂ¬m kiáº¿m vĂ  lá»c Ä‘a tiĂªu chĂ­")
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
    @Operation(summary = "Chi tiáº¿t há»“ sÆ¡ tráº£ kho vĂ  lá»‹ch sá»­ xá»­ lĂ½")
    public ResponseEntity<ApiResponse<ReturnCaseResponse>> getReturnCaseDetail(
            @PathVariable UUID bookingId) {
        return ResponseEntity.ok(ApiResponse.success(
                handoverService.getReturnCaseDetail(bookingId)));
    }

    @PostMapping("/returns/{bookingId}/schedule")
    @PreAuthorize("hasAuthority('HANDOVER_CREATE') or hasAnyRole('STAFF', 'FACILITY_STAFF', 'FACILITY_MANAGER', 'ADMIN')")
    @Operation(summary = "XĂ¡c nháº­n hoáº·c Ä‘á»•i lá»‹ch háº¹n nghiá»‡m thu hiá»‡n trÆ°á»ng")
    public ResponseEntity<ApiResponse<HandoverResponse>> scheduleInspection(
            @PathVariable UUID bookingId,
            @RequestParam(required = false) String scheduledAt,
            @RequestParam(required = false) String notes) {
        LocalDateTime parsedDateTime = parseFlexibleDateTime(scheduledAt);
        return ResponseEntity.ok(ApiResponse.success("XĂ¡c nháº­n lá»‹ch nghiá»‡m thu hiá»‡n trÆ°á»ng thĂ nh cĂ´ng",
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
    @Operation(summary = "Báº¯t Ä‘áº§u nghiá»‡m thu hiá»‡n trÆ°á»ng")
    public ResponseEntity<ApiResponse<HandoverResponse>> startInspection(
            @PathVariable UUID bookingId) {
        return ResponseEntity.ok(ApiResponse.success("Báº¯t Ä‘áº§u nghiá»‡m thu hiá»‡n trÆ°á»ng thĂ nh cĂ´ng",
                handoverService.startInspection(bookingId)));
    }

    @PostMapping("/returns/inspection")
    @PreAuthorize("hasAuthority('HANDOVER_CREATE') or hasAnyRole('STAFF', 'FACILITY_STAFF', 'FACILITY_MANAGER', 'ADMIN')")
    @Operation(summary = "LÆ°u biĂªn báº£n kiá»ƒm Ä‘á»‹nh 7 tiĂªu chĂ­ hiá»‡n trÆ°á»ng (há»— trá»£ lÆ°u nhĂ¡p hoáº·c chá»‘t biĂªn báº£n)")
    public ResponseEntity<ApiResponse<HandoverResponse>> saveInspection(
            @Valid @RequestBody HandoverRequest request) {
        return ResponseEntity.ok(ApiResponse.success("LÆ°u biĂªn báº£n kiá»ƒm Ä‘á»‹nh hiá»‡n trÆ°á»ng thĂ nh cĂ´ng",
                handoverService.saveInspection(request)));
    }

    @PostMapping("/returns/{bookingId}/calculate-settlement")
    @PreAuthorize("hasAuthority('HANDOVER_VIEW') or hasRole('CUSTOMER') or hasAnyRole('STAFF', 'FACILITY_STAFF', 'FACILITY_MANAGER', 'ADMIN')")
    @Operation(summary = "TĂ­nh toĂ¡n Ä‘á»‘i soĂ¡t quyáº¿t toĂ¡n tiá»n cá»c, cĂ´ng ná»£ vĂ  chi phĂ­ hÆ° háº¡i")
    public ResponseEntity<ApiResponse<ReturnSettlementResponse>> calculateSettlement(
            @PathVariable UUID bookingId,
            @RequestBody(required = false) HandoverRequest request) {
        return ResponseEntity.ok(ApiResponse.success("TĂ­nh toĂ¡n quyáº¿t toĂ¡n cá»c thĂ nh cĂ´ng",
                handoverService.calculateSettlement(bookingId, request)));
    }

    @PostMapping("/returns/{bookingId}/submit-approval")
    @PreAuthorize("hasAuthority('HANDOVER_CREATE') or hasAnyRole('STAFF', 'FACILITY_STAFF', 'FACILITY_MANAGER', 'ADMIN')")
    @Operation(summary = "TrĂ¬nh cáº¥p quáº£n lĂ½ phĂª duyá»‡t cĂ¡c khoáº£n kháº¥u trá»« bá»“i thÆ°á»ng")
    public ResponseEntity<ApiResponse<HandoverResponse>> submitDeductionsForApproval(
            @PathVariable UUID bookingId,
            @RequestParam(required = false) String notes) {
        return ResponseEntity.ok(ApiResponse.success("TrĂ¬nh phĂª duyá»‡t quyáº¿t toĂ¡n kháº¥u trá»« thĂ nh cĂ´ng",
                handoverService.submitDeductionsForApproval(bookingId, notes)));
    }

    @PostMapping("/returns/{bookingId}/approve-settlement")
    @PreAuthorize("hasAuthority('HANDOVER_APPROVE') or hasAnyRole('FACILITY_MANAGER', 'BUSINESS_MANAGER', 'ADMIN')")
    @Operation(summary = "Quáº£n lĂ½ cÆ¡ sá»Ÿ / Ban quáº£n lĂ½ phĂª duyá»‡t hoáº·c tá»« chá»‘i quyáº¿t toĂ¡n kháº¥u trá»«")
    public ResponseEntity<ApiResponse<ReturnSettlementResponse>> approveSettlement(
            @PathVariable UUID bookingId,
            @Valid @RequestBody HandoverRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Xá»­ lĂ½ phĂª duyá»‡t quyáº¿t toĂ¡n kháº¥u trá»« thĂ nh cĂ´ng",
                handoverService.approveSettlement(bookingId, request)));
    }

    @PostMapping("/returns/{bookingId}/dispute")
    @PreAuthorize("hasAuthority('HANDOVER_CREATE') or hasRole('CUSTOMER') or hasAnyRole('STAFF', 'FACILITY_STAFF', 'FACILITY_MANAGER', 'ADMIN')")
    @Operation(summary = "Ghi nháº­n khiáº¿u náº¡i / tranh cháº¥p tá»« khĂ¡ch hĂ ng Ä‘á»‘i vá»›i sá»‘ tiá»n bá»“i thÆ°á»ng")
    public ResponseEntity<ApiResponse<HandoverResponse>> recordCustomerDispute(
            @PathVariable UUID bookingId,
            @RequestParam String disputeReason) {
        return ResponseEntity.ok(ApiResponse.success("Ghi nháº­n khiáº¿u náº¡i tranh cháº¥p thĂ nh cĂ´ng",
                handoverService.recordCustomerDispute(bookingId, disputeReason)));
    }

    @PostMapping("/returns/{bookingId}/collect-additional-payment")
    @PreAuthorize("hasAuthority('PAYMENT_CREATE') or hasAnyRole('STAFF', 'FACILITY_STAFF', 'FACILITY_MANAGER', 'ADMIN')")
    @Operation(summary = "Thu khoáº£n bá»“i thÆ°á»ng bá»• sung khi chi phĂ­ vÆ°á»£t quĂ¡ tiá»n cá»c")
    public ResponseEntity<ApiResponse<PaymentResponse>> collectAdditionalPayment(
            @PathVariable UUID bookingId,
            @Valid @RequestBody HandoverRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Thu khoáº£n bá»“i thÆ°á»ng bá»• sung thĂ nh cĂ´ng",
                handoverService.collectAdditionalPayment(bookingId, request)));
    }

    @PostMapping("/returns/{bookingId}/execute-refund")
    @PreAuthorize("hasAuthority('HANDOVER_CREATE') or hasAnyRole('FACILITY_MANAGER', 'ADMIN', 'STAFF', 'FACILITY_STAFF')")
    @Operation(summary = "Thá»±c hiá»‡n lá»‡nh hoĂ n tráº£ tiá»n cá»c cho khĂ¡ch hĂ ng")
    public ResponseEntity<ApiResponse<ReturnSettlementResponse>> executeRefund(
            @PathVariable UUID bookingId,
            @Valid @RequestBody HandoverRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Lá»‡nh hoĂ n tráº£ tiá»n cá»c Ä‘Ă£ Ä‘Æ°á»£c thá»±c hiá»‡n thĂ nh cĂ´ng",
                handoverService.executeRefund(bookingId, request)));
    }

    @PostMapping("/returns/{bookingId}/confirm-physical-return")
    @PreAuthorize("hasAuthority('HANDOVER_CREATE') or hasAnyRole('STAFF', 'FACILITY_STAFF', 'FACILITY_MANAGER', 'ADMIN')")
    @Operation(summary = "XĂ¡c nháº­n nháº­n láº¡i kho váº­t lĂ½ & Ä‘á»“ Ä‘áº¡c Ä‘Ă£ dá»n sáº¡ch")
    public ResponseEntity<ApiResponse<HandoverResponse>> confirmPhysicalReturn(
            @PathVariable UUID bookingId,
            @Valid @RequestBody HandoverRequest request) {
        return ResponseEntity.ok(ApiResponse.success("XĂ¡c nháº­n nháº­n láº¡i kho váº­t lĂ½ thĂ nh cĂ´ng",
                handoverService.confirmPhysicalReturn(bookingId, request)));
    }

    @PostMapping("/returns/{bookingId}/revoke-access")
    @PreAuthorize("hasAuthority('HANDOVER_CREATE') or hasAnyRole('STAFF', 'FACILITY_STAFF', 'FACILITY_MANAGER', 'ADMIN')")
    @Operation(summary = "Thu há»“i mĂ£ PIN SmartLock vĂ  quyá»n truy cáº­p kho cá»§a khĂ¡ch hĂ ng")
    public ResponseEntity<ApiResponse<HandoverResponse>> revokeAccess(
            @PathVariable UUID bookingId) {
        return ResponseEntity.ok(ApiResponse.success("Thu há»“i quyá»n truy cáº­p kho thĂ nh cĂ´ng",
                handoverService.revokeAccess(bookingId)));
    }

    @PostMapping("/returns/{bookingId}/complete")
    @PreAuthorize("hasAuthority('HANDOVER_CREATE') or hasAnyRole('FACILITY_MANAGER', 'ADMIN', 'STAFF', 'FACILITY_STAFF')")
    @Operation(summary = "HoĂ n táº¥t toĂ n bá»™ há»“ sÆ¡ tráº£ kho, thanh lĂ½ há»£p Ä‘á»“ng vĂ  chuyá»ƒn tráº¡ng thĂ¡i kho")
    public ResponseEntity<ApiResponse<ReturnSettlementResponse>> completeReturn(
            @PathVariable UUID bookingId) {
        return ResponseEntity.ok(ApiResponse.success("HoĂ n táº¥t toĂ n bá»™ há»“ sÆ¡ tráº£ kho thĂ nh cĂ´ng",
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
    @PreAuthorize("hasAuthority('REFUND_APPROVE') or hasAnyRole('BUSINESS_MANAGER', 'ADMIN')")
    @Operation(summary = "Task 16.4: Kế toán / Quản lý kinh doanh (BUSINESS_MANAGER/ADMIN) xác nhận giải ngân hoàn tiền")
    public ResponseEntity<ApiResponse<ReturnSettlementResponse>> executePayout(
            @PathVariable UUID bookingId,
            @Valid @RequestBody com.boxora.dto.request.ReturnPayoutRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Xác nhận giải ngân hoàn tiền thành công",
                handoverService.executePayout(bookingId, request)));
    }
}
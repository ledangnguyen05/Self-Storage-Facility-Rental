package com.boxora.controller;

import com.boxora.common.response.ApiResponse;
import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.AccessRestoreRequest;
import com.boxora.dto.request.LockoutRequest;
import com.boxora.dto.request.SealingUnsealRequest;
import com.boxora.dto.request.UnsealRequest;
import com.boxora.dto.response.AccessRestorationResponse;
import com.boxora.dto.response.LockoutResponse;
import com.boxora.dto.response.OverdueLedgerResponse;
import com.boxora.dto.response.OverdueProcessResult;
import com.boxora.dto.response.OverdueReminderResponse;
import com.boxora.dto.response.SealingRecordResponse;
import com.boxora.enums.SealingStatus;
import com.boxora.service.OverdueProcessingService;
import com.boxora.service.SealingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
@Tag(name = "Overdue", description = "Sổ nợ quá hạn, khóa / mở khóa truy cập, nhắc nợ và xử lý quá hạn theo chính sách từng cơ sở")
@RequiredArgsConstructor
public class OverdueProcessingController {

    private final OverdueProcessingService overdueProcessingService;
    private final SealingService sealingService;

    @PostMapping("/cron/overdue-process")
    @PreAuthorize("hasAnyRole('ADMIN', 'BUSINESS_MANAGER', 'FACILITY_MANAGER')")
    @Operation(summary = "Chạy xử lý quá hạn ngay (quản lý cơ sở: chỉ cơ sở của mình và ngày hôm nay)")
    public ResponseEntity<ApiResponse<OverdueProcessResult>> triggerOverdueProcess(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate referenceDate,
            @RequestParam(required = false) UUID facilityId
    ) {
        OverdueProcessResult result = overdueProcessingService.processOverdueContracts(referenceDate, facilityId);
        return ResponseEntity.ok(ApiResponse.success("Đã xử lý quá hạn", result));
    }

    @GetMapping("/overdue/ledger")
    @PreAuthorize("hasAnyRole('ADMIN', 'BUSINESS_MANAGER', 'FACILITY_MANAGER', 'STAFF')")
    @Operation(summary = "Sổ nợ quá hạn theo cơ sở: số ngày, giai đoạn, tiền thuê kỳ quá hạn, phí trễ hạn, trạng thái khóa và niêm phong")
    public ResponseEntity<ApiResponse<OverdueLedgerResponse>> getLedger(@RequestParam(required = false) UUID facilityId) {
        return ResponseEntity.ok(ApiResponse.success(overdueProcessingService.getOverdueLedger(facilityId)));
    }

    @PostMapping("/overdue/contracts/{contractId}/lockout")
    @PreAuthorize("hasAnyRole('ADMIN', 'BUSINESS_MANAGER', 'FACILITY_MANAGER')")
    @Operation(summary = "Khóa truy cập (thu hồi PIN/QR, khóa kho) - chỉ từ mốc khóa truy cập của chính sách cơ sở")
    public ResponseEntity<ApiResponse<LockoutResponse>> lockoutContract(
            @PathVariable UUID contractId,
            @Valid @RequestBody(required = false) LockoutRequest request
    ) {
        LockoutResponse response = overdueProcessingService.lockoutContract(contractId,
                request != null ? request.getReason() : null,
                request != null && Boolean.TRUE.equals(request.getOverrideAccessHold()));
        return ResponseEntity.ok(ApiResponse.success(response.getMessage(), response));
    }

    @PostMapping("/overdue/contracts/{contractId}/restore-access")
    @PreAuthorize("hasAnyRole('ADMIN', 'BUSINESS_MANAGER', 'FACILITY_MANAGER')")
    @Operation(summary = "Mở khóa truy cập: cấp lại PIN/QR, kho về đang thuê; còn nợ thì chỉ giữ quyền truy cập đến ngày đã chọn")
    public ResponseEntity<ApiResponse<AccessRestorationResponse>> restoreAccess(
            @PathVariable UUID contractId,
            @Valid @RequestBody AccessRestoreRequest request
    ) {
        AccessRestorationResponse response = overdueProcessingService.restoreAccess(contractId, request.getReason(), request.getHoldUntil());
        return ResponseEntity.ok(ApiResponse.success(response.getMessage(), response));
    }

    @PostMapping("/overdue/contracts/{contractId}/reminders")
    @PreAuthorize("hasAnyRole('ADMIN', 'BUSINESS_MANAGER', 'FACILITY_MANAGER')")
    @Operation(summary = "Gửi email nhắc nợ quá hạn (trả về thành công chỉ khi máy chủ email đã nhận thư)")
    public ResponseEntity<ApiResponse<OverdueReminderResponse>> sendReminder(@PathVariable UUID contractId) {
        OverdueReminderResponse response = overdueProcessingService.sendReminder(contractId);
        return ResponseEntity.ok(ApiResponse.success("Đã gửi email nhắc nợ tới " + response.getSentTo(), response));
    }

    // ----------------------------------------------------------------------------------------------------
    // Legacy /sealing-records paths: same behaviour as /sealing (one implementation, SealingService).
    // ----------------------------------------------------------------------------------------------------

    @GetMapping("/sealing-records")
    @PreAuthorize("hasAnyRole('ADMIN', 'BUSINESS_MANAGER', 'FACILITY_MANAGER', 'STAFF')")
    @Operation(summary = "Danh sách biên bản niêm phong (giống GET /sealing)")
    public ResponseEntity<ApiResponse<PageResponse<SealingRecordResponse>>> getAllSealingRecords(
            @RequestParam(required = false) UUID facilityId,
            @RequestParam(required = false) SealingStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return ResponseEntity.ok(ApiResponse.success(sealingService.getAll(facilityId, status, page, size)));
    }

    @GetMapping("/sealing-records/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'BUSINESS_MANAGER', 'FACILITY_MANAGER', 'STAFF')")
    @Operation(summary = "Chi tiết biên bản niêm phong (giống GET /sealing/{id})")
    public ResponseEntity<ApiResponse<SealingRecordResponse>> getSealingRecordById(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(sealingService.getById(id)));
    }

    @PostMapping("/sealing-records/{id}/unseal")
    @PreAuthorize("hasAnyRole('ADMIN', 'BUSINESS_MANAGER', 'FACILITY_MANAGER')")
    @Operation(summary = "Gỡ niêm phong (giống POST /sealing/{id}/unseal)")
    public ResponseEntity<ApiResponse<SealingRecordResponse>> unsealUnit(
            @PathVariable UUID id,
            @Valid @RequestBody UnsealRequest request
    ) {
        SealingUnsealRequest unseal = SealingUnsealRequest.builder()
                .reason(request.getUnsealReason())
                .notes(request.getNotes())
                .build();
        SealingRecordResponse response = sealingService.unseal(id, unseal);
        return ResponseEntity.ok(ApiResponse.success("Đã gỡ niêm phong kho", response));
    }
}

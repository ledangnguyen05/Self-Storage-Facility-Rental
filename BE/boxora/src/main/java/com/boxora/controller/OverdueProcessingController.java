package com.boxora.controller;

import com.boxora.common.response.ApiResponse;
import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.*;
import com.boxora.dto.response.*;
import com.boxora.enums.SealingStatus;
import com.boxora.service.OverdueManagementService;
import com.boxora.service.OverdueProcessingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
@Tag(name = "Overdue & Sealing", description = "Overdue reporting, Boxora credential revocation, and witnessed on-site sealing records")
@RequiredArgsConstructor
@Slf4j
public class OverdueProcessingController {

    private final OverdueProcessingService overdueProcessingService;
    private final OverdueManagementService overdueManagementService;

    @PostMapping("/cron/overdue-process")
    @PreAuthorize("hasAnyAuthority('OVERDUE_PROCESS', 'ROLE_ADMIN', 'ROLE_BUSINESS_MANAGER')")
    @Operation(summary = "Run overdue processing; reports sealing eligibility without performing physical sealing")
    public ResponseEntity<ApiResponse<OverdueProcessResult>> triggerOverdueProcess(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate referenceDate
    ) {
        OverdueProcessResult result = overdueProcessingService.processOverdueContracts(referenceDate);
        return ResponseEntity.ok(ApiResponse.success("Processed overdue contracts successfully", result));
    }

    @GetMapping("/overdue/summary")
    @PreAuthorize("hasAnyAuthority('OVERDUE_VIEW', 'ROLE_ADMIN', 'ROLE_BUSINESS_MANAGER', 'ROLE_FACILITY_MANAGER', 'ROLE_STAFF')")
    @Operation(summary = "Dashboard KPI tổng hợp công nợ và các nhóm quá hạn")
    public ResponseEntity<ApiResponse<OverdueSummaryResponse>> getOverdueSummary(
            @RequestParam(required = false) UUID facilityId
    ) {
        OverdueSummaryResponse summary = overdueManagementService.getOverdueSummary(facilityId);
        return ResponseEntity.ok(ApiResponse.success(summary));
    }

    @GetMapping("/overdue/contracts")
    @PreAuthorize("hasAnyAuthority('OVERDUE_VIEW', 'ROLE_ADMIN', 'ROLE_BUSINESS_MANAGER', 'ROLE_FACILITY_MANAGER', 'ROLE_STAFF')")
    @Operation(summary = "Danh sách hợp đồng quá hạn kèm bộ lọc nâng cao và phân trang")
    public ResponseEntity<ApiResponse<PageResponse<OverdueContractItemResponse>>> getOverdueContracts(
            @RequestParam(required = false) UUID facilityId,
            @RequestParam(required = false, defaultValue = "ALL") String stage,
            @RequestParam(required = false) Integer minDays,
            @RequestParam(required = false) Integer maxDays,
            @RequestParam(required = false, defaultValue = "ALL") String pinStatus,
            @RequestParam(required = false, defaultValue = "ALL") String sealingStatus,
            @RequestParam(required = false) String searchTerm,
            @RequestParam(required = false) Boolean isDemo,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        PageResponse<OverdueContractItemResponse> response = overdueManagementService.getOverdueContracts(
                facilityId, stage, minDays, maxDays, pinStatus, sealingStatus, searchTerm, isDemo, page, size
        );
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/overdue/contracts/{contractId}")
    @PreAuthorize("hasAnyAuthority('OVERDUE_VIEW', 'ROLE_ADMIN', 'ROLE_BUSINESS_MANAGER', 'ROLE_FACILITY_MANAGER', 'ROLE_STAFF')")
    @Operation(summary = "Xem hồ sơ chi tiết một hợp đồng quá hạn (Công nợ, SmartLock, Niêm phong, Audit)")
    public ResponseEntity<ApiResponse<OverdueContractDetailResponse>> getOverdueContractDetail(
            @PathVariable UUID contractId
    ) {
        OverdueContractDetailResponse response = overdueManagementService.getOverdueContractDetail(contractId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping("/overdue/contracts/{contractId}/remind")
    @PreAuthorize("hasAnyAuthority('OVERDUE_PROCESS', 'ROLE_ADMIN', 'ROLE_FACILITY_MANAGER', 'ROLE_STAFF')")
    @Operation(summary = "Gửi thông báo nhắc nợ cước đa kênh (SMS, EMAIL, CALL) và lưu vết")
    public ResponseEntity<ApiResponse<String>> sendReminder(
            @PathVariable UUID contractId,
            @Valid @RequestBody OverdueSendReminderRequest request
    ) {
        overdueManagementService.sendReminder(contractId, request);
        return ResponseEntity.ok(ApiResponse.success("Đã gửi thông báo nhắc cước thành công"));
    }

    @PostMapping("/overdue/contracts/{contractId}/pin-revocation/request")
    @PreAuthorize("hasAnyAuthority('OVERDUE_PROCESS', 'ACCESS_CREDENTIAL_REVOKE', 'ROLE_ADMIN', 'ROLE_FACILITY_MANAGER', 'ROLE_STAFF')")
    @Operation(summary = "Tạo yêu cầu thu hồi PIN/QR SmartLock")
    public ResponseEntity<ApiResponse<OverdueContractDetailResponse.PinRevocationDto>> requestPinRevocation(
            @PathVariable UUID contractId,
            @RequestBody(required = false) OverduePinActionRequest request
    ) {
        var response = overdueManagementService.requestPinRevocation(contractId, request);
        return ResponseEntity.ok(ApiResponse.success("Đã tạo yêu cầu thu hồi PIN thành công", response));
    }

    @PostMapping("/overdue/contracts/{contractId}/pin-revocation/execute")
    @PreAuthorize("hasAnyAuthority('OVERDUE_PROCESS', 'ACCESS_CREDENTIAL_REVOKE', 'ROLE_ADMIN', 'ROLE_FACILITY_MANAGER')")
    @Operation(summary = "Thực hiện thu hồi PIN/QR SmartLock qua IoT Gateway (hỗ trợ Mock Adapter và mô phỏng Offline)")
    public ResponseEntity<ApiResponse<OverdueContractDetailResponse.PinRevocationDto>> executePinRevocation(
            @PathVariable UUID contractId,
            @RequestBody(required = false) OverduePinActionRequest request
    ) {
        var response = overdueManagementService.executePinRevocation(contractId, request);
        return ResponseEntity.ok(ApiResponse.success("Thực hiện thu hồi PIN hoàn tất", response));
    }

    @PostMapping("/overdue/contracts/{contractId}/pin-temp-grant")
    @PreAuthorize("hasAnyAuthority('OVERDUE_PROCESS', 'ACCESS_CREDENTIAL_REVOKE', 'ROLE_ADMIN', 'ROLE_FACILITY_MANAGER')")
    @Operation(summary = "Cấp quyền truy cập tạm thời cho khách hàng có lý do chính đáng")
    public ResponseEntity<ApiResponse<String>> grantTemporaryPin(
            @PathVariable UUID contractId,
            @Valid @RequestBody OverduePinTempGrantRequest request
    ) {
        overdueManagementService.grantTemporaryPin(contractId, request);
        return ResponseEntity.ok(ApiResponse.success("Đã cấp mã PIN tạm thời thành công"));
    }

    @PostMapping("/overdue/contracts/{contractId}/sealing")
    @PreAuthorize("hasAnyAuthority('SEALING_CREATE', 'OVERDUE_PROCESS', 'ROLE_ADMIN', 'ROLE_FACILITY_MANAGER', 'ROLE_STAFF')")
    @Operation(summary = "Quy trình niêm phong kho: REQUEST, APPROVE, REJECT, COMPLETE (kèm bảng kiểm kê tài sản)")
    public ResponseEntity<ApiResponse<String>> processSealingWorkflow(
            @PathVariable UUID contractId,
            @Valid @RequestBody OverdueSealingWorkflowRequest request
    ) {
        overdueManagementService.processSealingWorkflow(contractId, request);
        return ResponseEntity.ok(ApiResponse.success("Đã cập nhật quy trình niêm phong thành công"));
    }

    @GetMapping("/overdue/export/csv")
    @PreAuthorize("hasAnyAuthority('OVERDUE_VIEW', 'ROLE_ADMIN', 'ROLE_BUSINESS_MANAGER', 'ROLE_FACILITY_MANAGER')")
    @Operation(summary = "Xuất file CSV danh sách nợ cước quá hạn")
    public ResponseEntity<byte[]> exportOverdueCsv(
            @RequestParam(required = false) UUID facilityId,
            @RequestParam(required = false, defaultValue = "ALL") String stage,
            @RequestParam(required = false) String searchTerm
    ) {
        byte[] csvData = overdueManagementService.exportOverdueCsv(facilityId, stage, searchTerm);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"overdue-debts-" + LocalDate.now() + ".csv\"")
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .body(csvData);
    }

    // --- Legacy / Backwards-compatibility Endpoints ---

    @GetMapping("/sealing-records")
    @PreAuthorize("hasAuthority('OVERDUE_VIEW')")
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
    @PreAuthorize("hasAuthority('OVERDUE_VIEW')")
    @Operation(summary = "Xem chi tiết một biên bản niêm phong kho")
    public ResponseEntity<ApiResponse<SealingRecordResponse>> getSealingRecordById(
            @PathVariable UUID id
    ) {
        SealingRecordResponse response = overdueProcessingService.getSealingRecordById(id);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping("/sealing-records/{id}/unseal")
    @PreAuthorize("hasAuthority('OVERDUE_PROCESS')")
    @Operation(summary = "Mở niêm phong kho sau khi khách đã thanh toán công nợ và phí quá hạn (BR-RULE-012)")
    public ResponseEntity<ApiResponse<SealingRecordResponse>> unsealUnit(
            @PathVariable UUID id,
            @Valid @RequestBody UnsealRequest request
    ) {
        SealingRecordResponse response = overdueProcessingService.unsealUnit(id, request);
        return ResponseEntity.ok(ApiResponse.success("Unit unsealed successfully", response));
    }

    @PostMapping("/overdue/contracts/{contractId}/lockout")
    @PreAuthorize("hasAuthority('OVERDUE_PROCESS')")
    @Operation(summary = "Revoke stored PIN/QR credentials for a contract that reached its facility threshold")
    public ResponseEntity<ApiResponse<com.boxora.dto.response.LockoutResponse>> lockoutContract(
            @PathVariable UUID contractId,
            @RequestBody(required = false) com.boxora.dto.request.LockoutRequest request
    ) {
        String reason = (request != null && request.getReason() != null) ? request.getReason() : "Quá hạn thanh toán cước thuê";
        com.boxora.dto.response.LockoutResponse response = overdueProcessingService.lockoutContract(contractId, reason);
        return ResponseEntity.ok(ApiResponse.success("PIN/QR credentials were revoked in Boxora; physical lock state is unverified", response));
    }
}

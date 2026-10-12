package com.boxora.controller;

import com.boxora.common.response.ApiResponse;
import com.boxora.common.response.PageResponse;
import com.boxora.dto.response.NotificationLogResponse;
import com.boxora.dto.response.RenewalReminderScanResponse;
import com.boxora.enums.NotificationType;
import com.boxora.service.NotificationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("api/v1/notifications")
@Tag(name = "Notifications & Reminders", description = "API quản lý lịch sử thông báo và nhắc nhở gia hạn hợp đồng")
@RequiredArgsConstructor
@Slf4j
public class NotificationController {

    private final NotificationService notificationService;

    @PostMapping("renewal-reminders/scan")
    @PreAuthorize("hasAuthority('RENEWAL_VIEW') or hasAnyRole('ADMIN', 'FACILITY_MANAGER')")
    @Operation(summary = "Kích hoạt quét toàn hệ thống và gửi email nhắc gia hạn mốc -7 và -3 ngày")
    public ResponseEntity<ApiResponse<RenewalReminderScanResponse>> triggerScan() {
        RenewalReminderScanResponse response = notificationService.scanAndSendRenewalReminders();
        return ResponseEntity.ok(ApiResponse.success("Quét và gửi thông báo nhắc gia hạn thành công", response));
    }

    @PostMapping("contracts/{contractId}/send-renewal-reminder")
    @PreAuthorize("hasAuthority('RENEWAL_VIEW') or hasAnyRole('ADMIN', 'FACILITY_MANAGER', 'STAFF')")
    @Operation(summary = "Gửi thông báo nhắc gia hạn trực tiếp cho một hợp đồng")
    public ResponseEntity<ApiResponse<Void>> sendSingleReminder(@PathVariable UUID contractId) {
        notificationService.sendSingleContractRenewalReminder(contractId);
        return ResponseEntity.ok(ApiResponse.success("Đã gửi thông báo nhắc gia hạn hợp đồng", null));
    }

    @GetMapping("{id}")
    @PreAuthorize("hasAnyRole('CUSTOMER', 'ADMIN', 'FACILITY_MANAGER', 'STAFF', 'BUSINESS_MANAGER')")
    @Operation(summary = "Lấy chi tiết bản ghi thông báo theo ID")
    public ResponseEntity<ApiResponse<NotificationLogResponse>> getById(@PathVariable UUID id) {
        NotificationLogResponse response = notificationService.getById(id);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('CUSTOMER', 'ADMIN', 'FACILITY_MANAGER', 'STAFF', 'BUSINESS_MANAGER')")
    @Operation(summary = "Lấy danh sách lịch sử thông báo phân trang")
    public ResponseEntity<ApiResponse<PageResponse<NotificationLogResponse>>> getLogs(
            @RequestParam(required = false) UUID recipientId,
            @RequestParam(required = false) UUID facilityId,
            @RequestParam(required = false) NotificationType type,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        PageResponse<NotificationLogResponse> response = notificationService.getLogs(recipientId, facilityId, type, page, size);
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}

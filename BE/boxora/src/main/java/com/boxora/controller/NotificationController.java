package com.boxora.controller;

import com.boxora.common.response.ApiResponse;
import com.boxora.common.response.PageResponse;
import com.boxora.dto.response.NotificationLogResponse;
import com.boxora.dto.response.RenewalReminderScanResponse;
import com.boxora.enums.NotificationType;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.service.NotificationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("api/v1/notifications")
@Tag(name = "Notifications & Reminders", description = "API quản lý lịch sử thông báo, thông báo của tài khoản đang đăng nhập (đã đọc / chưa đọc) và nhắc nhở gia hạn hợp đồng")
@RequiredArgsConstructor
@Slf4j
public class NotificationController {

    private static final String ANY_SIGNED_IN_ROLE = "hasAnyRole('CUSTOMER', 'ADMIN', 'FACILITY_MANAGER', 'STAFF', 'BUSINESS_MANAGER')";

    private final NotificationService notificationService;

    @PostMapping("renewal-reminders/scan")
    @PreAuthorize("hasAuthority('RENEWAL_VIEW') or hasAnyRole('ADMIN', 'FACILITY_MANAGER')")
    @Operation(summary = "Kích hoạt quét toàn hệ thống và gửi email nhắc gia hạn mốc -7 và -3 ngày (chỉ đếm email gửi thành công)")
    public ResponseEntity<ApiResponse<RenewalReminderScanResponse>> triggerScan() {
        RenewalReminderScanResponse response = notificationService.scanAndSendRenewalReminders();
        return ResponseEntity.ok(ApiResponse.success("Quét và gửi thông báo nhắc gia hạn thành công", response));
    }

    @PostMapping("contracts/{contractId}/send-renewal-reminder")
    @PreAuthorize("hasAuthority('RENEWAL_VIEW') or hasAnyRole('ADMIN', 'FACILITY_MANAGER', 'STAFF')")
    @Operation(summary = "Gửi email nhắc gia hạn trực tiếp cho một hợp đồng. Chỉ báo thành công khi máy chủ email nhận thư")
    public ResponseEntity<ApiResponse<NotificationLogResponse>> sendSingleReminder(@PathVariable UUID contractId) {
        NotificationLogResponse response = notificationService.sendSingleContractRenewalReminder(contractId);
        if (!"SENT".equals(response.getStatus())) {
            throw new AppException(ErrorCode.EMAIL_SEND_FAILED,
                    response.getErrorMessage() != null ? response.getErrorMessage() : ErrorCode.EMAIL_SEND_FAILED.getMessage());
        }
        return ResponseEntity.ok(ApiResponse.success("Đã gửi email nhắc gia hạn hợp đồng", response));
    }

    @GetMapping("mine")
    @PreAuthorize(ANY_SIGNED_IN_ROLE)
    @Operation(summary = "Thông báo gửi tới tài khoản đang đăng nhập (mới nhất trước), kèm trạng thái đã đọc")
    public ResponseEntity<ApiResponse<PageResponse<NotificationLogResponse>>> getMine(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(ApiResponse.success(notificationService.getMine(page, size)));
    }

    @GetMapping("mine/unread-count")
    @PreAuthorize(ANY_SIGNED_IN_ROLE)
    @Operation(summary = "Số thông báo chưa đọc của tài khoản đang đăng nhập")
    public ResponseEntity<ApiResponse<Map<String, Long>>> getMyUnreadCount() {
        return ResponseEntity.ok(ApiResponse.success(Map.of("unread", notificationService.countMyUnread())));
    }

    @PostMapping("mine/read-all")
    @PreAuthorize(ANY_SIGNED_IN_ROLE)
    @Operation(summary = "Đánh dấu đã đọc tất cả thông báo của tài khoản đang đăng nhập")
    public ResponseEntity<ApiResponse<Map<String, Integer>>> markAllRead() {
        return ResponseEntity.ok(ApiResponse.success("Đã đánh dấu đã đọc tất cả thông báo", Map.of("updated", notificationService.markAllRead())));
    }

    @PostMapping("{id}/read")
    @PreAuthorize(ANY_SIGNED_IN_ROLE)
    @Operation(summary = "Đánh dấu đã đọc một thông báo của chính mình")
    public ResponseEntity<ApiResponse<NotificationLogResponse>> markRead(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(notificationService.markRead(id)));
    }

    @GetMapping("{id}")
    @PreAuthorize(ANY_SIGNED_IN_ROLE)
    @Operation(summary = "Lấy chi tiết bản ghi thông báo theo ID (khách chỉ xem thông báo của mình)")
    public ResponseEntity<ApiResponse<NotificationLogResponse>> getById(@PathVariable UUID id) {
        NotificationLogResponse response = notificationService.getById(id);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    private static NotificationType parseType(String type) {
        if (type == null || type.isBlank()) {
            return null;
        }
        try {
            return NotificationType.valueOf(type.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Loại thông báo không hợp lệ: " + type);
        }
    }

    @GetMapping
    @PreAuthorize(ANY_SIGNED_IN_ROLE)
    @Operation(summary = "Lấy danh sách lịch sử thông báo phân trang (khách chỉ thấy của mình, nhân viên và quản lý cơ sở thấy trong phạm vi cơ sở)")
    public ResponseEntity<ApiResponse<PageResponse<NotificationLogResponse>>> getLogs(
            @RequestParam(required = false) UUID recipientId,
            @RequestParam(required = false) UUID facilityId,
            @RequestParam(required = false) String type,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        PageResponse<NotificationLogResponse> response = notificationService.getLogs(recipientId, facilityId, parseType(type), page, size);
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}

package com.boxora.controller;

import com.boxora.common.response.ApiResponse;
import com.boxora.common.response.PageResponse;
import com.boxora.dto.response.ActivityLogResponse;
import com.boxora.enums.*;
import com.boxora.security.FacilityAccessGuard;
import com.boxora.service.ActivityLogService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.UUID;

@RestController
@RequestMapping("api/v1/activity-logs")
@Tag(name = "Activity Log", description = "API tra cứu nhật ký đăng nhập và thao tác dữ liệu")
@PreAuthorize("hasAnyRole('ADMIN', 'BUSINESS_MANAGER', 'FACILITY_MANAGER')")
@Slf4j
public class ActivityLogController {

    private final ActivityLogService activityLogService;
    private final FacilityAccessGuard facilityAccessGuard;

    public ActivityLogController(ActivityLogService activityLogService, FacilityAccessGuard facilityAccessGuard) {
        this.activityLogService = activityLogService;
        this.facilityAccessGuard = facilityAccessGuard;
    }

    @GetMapping("{id}")
    @Operation(summary = "Lấy chi tiết một bản ghi log")
    public ResponseEntity<ApiResponse<ActivityLogResponse>> getById(@PathVariable UUID id) {
        ActivityLogResponse response = activityLogService.getById(id);
        if (facilityAccessGuard.isFacilityScoped() && response.getFacilityId() != null) {
            facilityAccessGuard.checkFacilityAccess(response.getFacilityId());
        }
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping
    @Operation(summary = "Tra cứu toàn bộ activity log (đăng nhập + thao tác dữ liệu)")
    public ResponseEntity<ApiResponse<PageResponse<ActivityLogResponse>>> getAll(
            @RequestParam(required = false) UUID userId,
            @RequestParam(required = false) UUID facilityId,
            @RequestParam(required = false) ActivityLogType logType,
            @RequestParam(required = false) ActivityAction action,
            @RequestParam(required = false) ActivityLogStatus status,
            @RequestParam(required = false) Boolean isCriticalOnly,
            @RequestParam(required = false) String resourceType,
            @RequestParam(required = false) UUID resourceId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir
    ) {
        UUID effectiveFacilityId = facilityId;
        if (facilityAccessGuard.isFacilityScoped()) {
            effectiveFacilityId = facilityAccessGuard.scopedFacilityIdOrNull();
        }

        PageResponse<ActivityLogResponse> response = activityLogService.getAll(
                userId, effectiveFacilityId, logType, action, status, isCriticalOnly,
                resourceType, resourceId, fromDate, toDate, search, page, size, sortBy, sortDir);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/login-history")
    @Operation(summary = "Tra cứu riêng lịch sử đăng nhập")
    public ResponseEntity<ApiResponse<PageResponse<ActivityLogResponse>>> getLoginHistory(
            @RequestParam(required = false) UUID userId,
            @RequestParam(required = false) UUID facilityId,
            @RequestParam(required = false) ActivityLogStatus status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir
    ) {
        UUID effectiveFacilityId = facilityId;
        if (facilityAccessGuard.isFacilityScoped()) {
            effectiveFacilityId = facilityAccessGuard.scopedFacilityIdOrNull();
        }

        PageResponse<ActivityLogResponse> response = activityLogService.getLoginHistory(
                userId, effectiveFacilityId, status, fromDate, toDate, page, size, sortBy, sortDir);
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
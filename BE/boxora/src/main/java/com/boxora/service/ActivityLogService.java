package com.boxora.service;

import com.boxora.common.response.PageResponse;
import com.boxora.dto.response.ActivityLogResponse;
import com.boxora.enums.ActivityAction;
import com.boxora.enums.ActivityLogStatus;
import com.boxora.enums.ActivityLogType;

import java.time.LocalDate;
import java.util.UUID;

public interface ActivityLogService {

    void recordLogin(UUID userId, String emailAttempted, boolean success, String failureReason);

    void recordLogout(UUID userId);

    /** Ghi log cho hành động của user đang đăng nhập — userId/IP tự lấy từ RequestContext. */
    void record(ActivityAction action, String resourceType, UUID resourceId,
                String description, Object oldValue, Object newValue);

    /** Ghi log với userId được chỉ định rõ (dùng khi vừa tạo user hoặc đã biết rõ userId). */
    void record(UUID userId, ActivityAction action, String resourceType, UUID resourceId,
                String description, Object oldValue, Object newValue);

    /** Dùng cho scheduled job / system action — không có user, không có HTTP request. */
    void recordSystem(ActivityAction action, String resourceType, UUID resourceId, String description);

    ActivityLogResponse getById(UUID id);

    PageResponse<ActivityLogResponse> getAll(
            UUID userId, ActivityLogType logType, ActivityAction action, ActivityLogStatus status,
            Boolean criticalOnly, LocalDate fromDate, LocalDate toDate, String search,
            int page, int size, String sortBy, String sortDir);

    PageResponse<ActivityLogResponse> getLoginHistory(
            UUID userId, ActivityLogStatus status, LocalDate fromDate, LocalDate toDate,
            int page, int size, String sortBy, String sortDir);
}
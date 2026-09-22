package com.boxora.service.impl;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.boxora.common.response.PageResponse;
import com.boxora.dto.response.ActivityLogResponse;
import com.boxora.entity.ActivityLog;
import com.boxora.entity.User;
import com.boxora.enums.ActivityAction;
import com.boxora.enums.ActivityLogStatus;
import com.boxora.enums.ActivityLogType;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.mapper.ActivityLogMapper;
import com.boxora.repository.ActivityLogRepository;
import com.boxora.repository.UserRepository;
import com.boxora.repository.spec.ActivityLogSpecification;
import com.boxora.security.RequestContext;
import com.boxora.service.ActivityLogService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ActivityLogServiceImpl implements ActivityLogService {

    private final ActivityLogRepository activityLogRepository;
    private final UserRepository userRepository;
    private final ActivityLogMapper activityLogMapper;
    private final RequestContext requestContext;
    private final ObjectMapper objectMapper;


    // REQUIRES_NEW: ghi log không được rollback theo transaction nghiệp vụ bao quanh nó
    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordLogin(UUID userId, String emailAttempted, boolean success, String failureReason) {
        User user = userId != null ? userRepository.findById(userId).orElse(null) : null;
        ActivityAction action = success ? ActivityAction.LOGIN_SUCCESS : ActivityAction.LOGIN_FAILED;

        ActivityLog entry = ActivityLog.builder()
                .user(user)
                .logType(action.category())
                .action(action)
                .emailAttempted(emailAttempted)
                .description(success ? "User login successful" : failureReason)
                .status(success ? ActivityLogStatus.SUCCESS : ActivityLogStatus.FAILED)
                .ipAddress(requestContext.currentIpAddress())
                .userAgent(requestContext.currentUserAgent())
                .build();

        activityLogRepository.save(entry);
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordLogout(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        ActivityLog entry = ActivityLog.builder()
                .user(user)
                .logType(ActivityAction.LOGOUT.category())
                .action(ActivityAction.LOGOUT)
                .description("User logged out")
                .status(ActivityLogStatus.SUCCESS)
                .ipAddress(requestContext.currentIpAddress())
                .userAgent(requestContext.currentUserAgent())
                .build();

        activityLogRepository.save(entry);
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(ActivityAction action, String resourceType, UUID resourceId,
                       String description, Object oldValue, Object newValue) {
        record(null, action, resourceType, resourceId, description, oldValue, newValue);
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(UUID userId, ActivityAction action, String resourceType, UUID resourceId,
                       String description, Object oldValue, Object newValue) {
        UUID effectiveUserId = userId != null ? userId : requestContext.currentUserId();
        User user = effectiveUserId != null ? userRepository.findById(effectiveUserId).orElse(null) : null;

        ActivityLog entry = ActivityLog.builder()
                .user(user)
                .logType(action.category())
                .action(action)
                .resourceType(resourceType)
                .resourceId(resourceId)
                .description(description)
                .oldValue(toJson(oldValue))
                .newValue(toJson(newValue))
                .status(ActivityLogStatus.SUCCESS)
                .ipAddress(requestContext.currentIpAddress())
                .userAgent(requestContext.currentUserAgent())
                .build();

        activityLogRepository.save(entry);
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordSystem(ActivityAction action, String resourceType, UUID resourceId, String description) {
        ActivityLog entry = ActivityLog.builder()
                .user(null)
                .logType(action.category())
                .action(action)
                .resourceType(resourceType)
                .resourceId(resourceId)
                .description(description)
                .status(ActivityLogStatus.SUCCESS)
                .build();

        activityLogRepository.save(entry);
    }

    @Override
    @Transactional(readOnly = true)
    public ActivityLogResponse getById(UUID id) {
        ActivityLog entry = activityLogRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.ACTIVITY_LOG_NOT_FOUND));
        return activityLogMapper.toResponse(entry);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<ActivityLogResponse> getAll(
            UUID userId, ActivityLogType logType, ActivityAction action, ActivityLogStatus status,
            Boolean criticalOnly, LocalDate fromDate, LocalDate toDate, String search,
            int page, int size, String sortBy, String sortDir) {

        return query(userId, logType, action, status, criticalOnly, fromDate, toDate, search,
                page, size, sortBy, sortDir);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<ActivityLogResponse> getLoginHistory(
            UUID userId, ActivityLogStatus status, LocalDate fromDate, LocalDate toDate,
            int page, int size, String sortBy, String sortDir) {
        return query(userId, ActivityLogType.LOGIN, null, status, null, fromDate, toDate, null,
                page, size, sortBy, sortDir);
    }

    private PageResponse<ActivityLogResponse> query(
            UUID userId, ActivityLogType logType, ActivityAction action, ActivityLogStatus status,
            Boolean criticalOnly, LocalDate fromDate, LocalDate toDate, String search,
            int page, int size, String sortBy, String sortDir) {
        LocalDateTime from = fromDate != null ? fromDate.atStartOfDay() : null;
        LocalDateTime to = toDate != null ? toDate.atTime(LocalTime.MAX) : null;

        Sort sort = sortDir.equalsIgnoreCase("desc")
                ? Sort.by(sortBy).descending()
                : Sort.by(sortBy).ascending();
        Pageable pageable = PageRequest.of(page, size, sort);

        // Only build the critical-action list when the caller actually asked for it -
        // otherwise pass null so the specification skips the IN(...) clause entirely.
        List<ActivityAction> criticalActions =
                Boolean.TRUE.equals(criticalOnly) ? ActivityAction.criticalActions() : null;

        Specification<ActivityLog> spec = ActivityLogSpecification.build(
                userId, logType, action, status, criticalActions, from, to, search);

        Page<ActivityLogResponse> result = activityLogRepository
                .findAll(spec, pageable)
                .map(activityLogMapper::toResponse);
        return PageResponse.from(result);
    }

    private String toJson(Object value) {
        if (value == null) return null;
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            log.warn("Failed to serialize activity log value", e);
            return String.valueOf(value);
        }
    }
}
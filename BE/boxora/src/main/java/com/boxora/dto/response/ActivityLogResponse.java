package com.boxora.dto.response;

import com.boxora.enums.ActivityAction;
import com.boxora.enums.ActivityLogStatus;
import com.boxora.enums.ActivityLogType;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@AllArgsConstructor
@Builder
public class ActivityLogResponse {
    private UUID id;
    private UUID userId;
    private String userName;
    private String userEmail;

    private ActivityLogType logType;
    private ActivityAction action;
    private boolean critical;
    private String emailAttempted;

    private String resourceType;
    private UUID resourceId;
    private String description;
    private String oldValue;
    private String newValue;

    private UUID facilityId;
    private String facilityName;

    private ActivityLogStatus status;
    private String ipAddress;
    private String userAgent;
    private LocalDateTime createdAt;
}
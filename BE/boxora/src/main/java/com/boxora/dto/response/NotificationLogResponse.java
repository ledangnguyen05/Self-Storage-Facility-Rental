package com.boxora.dto.response;

import com.boxora.enums.NotificationChannel;
import com.boxora.enums.NotificationType;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NotificationLogResponse {

    private UUID id;
    private UUID recipientId;
    private String recipientEmail;
    private String recipientName;

    private UUID facilityId;
    private String facilityName;

    private NotificationChannel channel;
    private NotificationType notificationType;
    private String referenceType;
    private UUID referenceId;

    private String title;
    private String content;
    private String status;
    private LocalDateTime createdAt;
}

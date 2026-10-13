package com.boxora.service;

import com.boxora.common.response.PageResponse;
import com.boxora.dto.response.NotificationLogResponse;
import com.boxora.dto.response.RenewalReminderScanResponse;
import com.boxora.enums.NotificationType;

import java.util.UUID;

public interface NotificationService {

    /** Quét toàn bộ hợp đồng ACTIVE và gửi nhắc nhở gia hạn mốc -7 và -3 ngày (tránh trùng lặp). */
    RenewalReminderScanResponse scanAndSendRenewalReminders();

    /** Gửi nhắc nhở gia hạn thủ công cho một hợp đồng cụ thể. */
    void sendSingleContractRenewalReminder(UUID contractId);

    /** Lấy chi tiết lịch sử thông báo theo ID. */
    NotificationLogResponse getById(UUID id);

    /** Lấy danh sách lịch sử thông báo phân trang theo tiêu chí. */
    PageResponse<NotificationLogResponse> getLogs(UUID recipientId, UUID facilityId, NotificationType type, int page, int size);
}

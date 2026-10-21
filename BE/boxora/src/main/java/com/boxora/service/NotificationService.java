package com.boxora.service;

import com.boxora.common.response.PageResponse;
import com.boxora.dto.response.NotificationLogResponse;
import com.boxora.dto.response.RenewalReminderScanResponse;
import com.boxora.enums.NotificationType;

import java.util.UUID;

public interface NotificationService {

    /** Quét toàn bộ hợp đồng ACTIVE và gửi nhắc nhở gia hạn mốc -7 và -3 ngày (tránh trùng lặp). */
    RenewalReminderScanResponse scanAndSendRenewalReminders();

    /**
     * Gửi nhắc nhở gia hạn thủ công cho một hợp đồng cụ thể. Gửi đồng bộ; bản ghi trả về có status SENT khi máy chủ
     * email nhận thư, FAILED (kèm errorMessage) khi không gửi được.
     */
    NotificationLogResponse sendSingleContractRenewalReminder(UUID contractId);

    /** Lấy chi tiết lịch sử thông báo theo ID. Khách chỉ xem thông báo của mình. */
    NotificationLogResponse getById(UUID id);

    /** Lấy danh sách lịch sử thông báo phân trang theo tiêu chí. */
    PageResponse<NotificationLogResponse> getLogs(UUID recipientId, UUID facilityId, NotificationType type, int page, int size);

    /** Thông báo gửi tới tài khoản đang đăng nhập (chuông thông báo), mới nhất trước. */
    PageResponse<NotificationLogResponse> getMine(int page, int size);

    /** Số thông báo chưa đọc của tài khoản đang đăng nhập. */
    long countMyUnread();

    /** Đánh dấu đã đọc một thông báo của chính mình (gọi lại không đổi thời điểm đọc). */
    NotificationLogResponse markRead(UUID id);

    /** Đánh dấu đã đọc tất cả thông báo của chính mình; trả về số thông báo vừa đổi. */
    int markAllRead();
}

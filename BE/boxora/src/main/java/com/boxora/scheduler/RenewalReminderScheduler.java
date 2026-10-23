package com.boxora.scheduler;

import com.boxora.dto.response.RenewalReminderScanResponse;
import com.boxora.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(name = "app.scheduling.enabled", havingValue = "true", matchIfMissing = true)
public class RenewalReminderScheduler {

    private final NotificationService notificationService;

    /**
     * Tự động chạy quét hợp đồng mỗi ngày lúc 08:00 AM để gửi thông báo nhắc gia hạn -7 ngày và -3 ngày.
     * Cấu hình qua biến môi trường app.scheduling.renewal-reminder-cron.
     */
    @Scheduled(cron = "${app.scheduling.renewal-reminder-cron:0 0 8 * * ?}")
    public void scheduleDailyRenewalReminders() {
        log.info("Starting scheduled daily renewal reminders scan...");
        try {
            RenewalReminderScanResponse response = notificationService.scanAndSendRenewalReminders();
            log.info("Finished scheduled renewal reminders scan: {} contracts checked, {} 7-day sent, {} 3-day sent",
                    response.getScannedContractsCount(),
                    response.getSevenDayRemindersSent(),
                    response.getThreeDayRemindersSent());
        } catch (Exception e) {
            log.error("Error occurred during scheduled renewal reminders scan: {}", e.getMessage(), e);
        }
    }
}

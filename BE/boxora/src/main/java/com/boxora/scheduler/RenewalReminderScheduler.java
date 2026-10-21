package com.boxora.scheduler;

import com.boxora.dto.response.RenewalReminderScanResponse;
import com.boxora.entity.ContractRenewal;
import com.boxora.enums.ContractRenewalStatus;
import com.boxora.enums.PaymentStatus;
import com.boxora.repository.ContractRenewalRepository;
import com.boxora.repository.PaymentRepository;
import com.boxora.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(name = "app.scheduling.enabled", havingValue = "true", matchIfMissing = true)
public class RenewalReminderScheduler {

    private final NotificationService notificationService;
    private final ContractRenewalRepository contractRenewalRepository;
    private final PaymentRepository paymentRepository;

    /** Renewal requests that were neither paid nor signed for this many days are closed automatically. */
    @Value("${app.renewal.stale-days:7}")
    private int staleRenewalDays;

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

    /**
     * Closes renewal requests that stayed unpaid (and unsigned) for {@code app.renewal.stale-days} days, so a
     * forgotten request never blocks a new one. Paid requests are never touched.
     */
    @Scheduled(cron = "${app.scheduling.renewal-cleanup-cron:0 30 2 * * ?}")
    @Transactional
    public void cancelStaleRenewalRequests() {
        try {
            LocalDateTime before = LocalDateTime.now().minusDays(Math.max(1, staleRenewalDays));
            List<ContractRenewal> stale = contractRenewalRepository.findByStatusInAndCreatedAtBefore(
                    List.of(ContractRenewalStatus.PENDING_SIGNATURE, ContractRenewalStatus.PENDING_PAYMENT), before);
            int cancelled = 0;
            for (ContractRenewal renewal : stale) {
                boolean paid = renewal.getPayment() != null && renewal.getPayment().getStatus() == PaymentStatus.PAID;
                if (paid) {
                    continue;
                }
                if (renewal.getPayment() != null && renewal.getPayment().getStatus() == PaymentStatus.PENDING) {
                    renewal.getPayment().setStatus(PaymentStatus.EXPIRED);
                    paymentRepository.save(renewal.getPayment());
                }
                renewal.setStatus(ContractRenewalStatus.CANCELLED);
                renewal.setCancelledAt(LocalDateTime.now());
                renewal.setCancelReason("Hệ thống tự hủy: yêu cầu gia hạn chưa được thanh toán sau " + staleRenewalDays + " ngày");
                contractRenewalRepository.save(renewal);
                cancelled++;
            }
            if (cancelled > 0) {
                log.info("Cancelled {} stale renewal request(s) older than {} days", cancelled, staleRenewalDays);
            }
        } catch (Exception e) {
            log.error("Error while cancelling stale renewal requests: {}", e.getMessage(), e);
        }
    }
}

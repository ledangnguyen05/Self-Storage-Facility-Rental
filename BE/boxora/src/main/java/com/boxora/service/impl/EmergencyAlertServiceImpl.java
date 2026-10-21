package com.boxora.service.impl;

import com.boxora.entity.Facility;
import com.boxora.entity.NotificationLog;
import com.boxora.entity.User;
import com.boxora.enums.MasterKeyOverrideCategory;
import com.boxora.enums.NotificationChannel;
import com.boxora.enums.NotificationType;
import com.boxora.enums.OverrideSeverity;
import com.boxora.repository.FacilityRepository;
import com.boxora.repository.NotificationLogRepository;
import com.boxora.repository.UserRepository;
import com.boxora.service.EmailService;
import com.boxora.service.EmergencyAlertService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

/**
 * Alerts the business managers and admins when a master key is used. Every recipient gets an in-app notification
 * (so the alert is visible in the notification centre even when email is not configured) and an email.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class EmergencyAlertServiceImpl implements EmergencyAlertService {

    private final EmailService emailService;
    private final UserRepository userRepository;
    private final NotificationLogRepository notificationLogRepository;
    private final FacilityRepository facilityRepository;

    // BUSINESS_MANAGER is the seeded system-wide management role in Boxora
    private static final List<String> ALERT_RECIPIENT_ROLES = List.of("BUSINESS_MANAGER", "ADMIN");

    @Override
    public void alertMasterKeyUsed(UUID facilityId, String facilityName,
                                   String performedByName, String witnessName,
                                   MasterKeyOverrideCategory category, OverrideSeverity severity,
                                   String reason, String documentReference) {
        List<User> recipients = userRepository.findAllByRole_NameInAndIsActiveTrue(ALERT_RECIPIENT_ROLES);

        if (recipients.isEmpty()) {
            // Không có ai để cảnh báo vẫn phải log lại - đây là dấu hiệu thiếu cấu hình,
            // không nên để im lặng trôi qua với 1 sự kiện an ninh nghiêm trọng.
            log.warn("[MASTER_KEY_ALERT] No BUSINESS_MANAGER/ADMIN found to notify - "
                    + "facility={}, performedBy={}, witness={}, category={}, severity={}",
                    facilityName, performedByName, witnessName, category, severity);
            return;
        }

        Facility facility = facilityId != null ? facilityRepository.findById(facilityId).orElse(null) : null;
        String title = "Cảnh báo dùng chìa khóa tổng tại " + facilityName;
        String content = String.format("%s dùng chìa khóa tổng (có %s chứng kiến). Tình huống: %s. Mức độ: %s. Lý do: %s.%s",
                performedByName, witnessName, MasterKeyLabels.category(category), MasterKeyLabels.severity(severity),
                stripTrailingPunctuation(reason),
                documentReference != null && !documentReference.isBlank()
                        ? " Tham chiếu: " + stripTrailingPunctuation(documentReference) + "." : "");

        for (User recipient : recipients) {
            boolean emailAccepted = false;
            String emailError = null;
            if (!emailService.isMailConfigured()) {
                emailError = "Hệ thống chưa cấu hình dịch vụ gửi email (SMTP).";
            } else {
                try {
                    emailService.sendMasterKeyAlertEmail(
                            recipient.getEmail(),
                            recipient.getFullName(),
                            facilityName,
                            performedByName,
                            witnessName,
                            category.name(),
                            severity.name(),
                            reason,
                            documentReference
                    );
                    emailAccepted = true;
                } catch (Exception e) {
                    // 1 email lỗi không được chặn việc gửi cho những người còn lại
                    log.error("Failed to send master key alert email to {}", recipient.getEmail(), e);
                    emailError = "Không gửi được email cảnh báo.";
                }
            }

            try {
                notificationLogRepository.save(NotificationLog.builder()
                        .recipient(recipient)
                        .recipientEmail(recipient.getEmail())
                        .recipientName(recipient.getFullName())
                        .facility(facility)
                        .channel(NotificationChannel.IN_APP)
                        .notificationType(NotificationType.MASTER_KEY_ALERT)
                        .referenceType("Facility")
                        .referenceId(facilityId)
                        .title(title)
                        .content(content + (emailAccepted ? "" : " Email cảnh báo chưa được gửi: " + stripTrailingPunctuation(emailError) + "."))
                        .status("SENT")
                        .build());
            } catch (Exception e) {
                log.error("Failed to store master key alert notification for {}", recipient.getEmail(), e);
            }
        }
    }

    /** Trims whitespace and closing punctuation so the sentence template can add its own full stop (no doubled periods). */
    private static String stripTrailingPunctuation(String text) {
        if (text == null) {
            return "";
        }
        String trimmed = text.strip();
        while (!trimmed.isEmpty() && ".;,:".indexOf(trimmed.charAt(trimmed.length() - 1)) >= 0) {
            trimmed = trimmed.substring(0, trimmed.length() - 1).stripTrailing();
        }
        return trimmed;
    }
}

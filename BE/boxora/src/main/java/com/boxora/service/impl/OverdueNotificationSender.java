package com.boxora.service.impl;

import com.boxora.entity.Facility;
import com.boxora.entity.NotificationLog;
import com.boxora.entity.User;
import com.boxora.enums.NotificationChannel;
import com.boxora.enums.NotificationType;
import com.boxora.repository.NotificationLogRepository;
import com.boxora.service.EmailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.util.HtmlUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * Sends the overdue-domain emails (reminder, sealing and unsealing notices) synchronously through
 * {@link EmailService#sendNow} and writes a {@link NotificationLog} with the real outcome (SENT / FAILED),
 * so no API or audit trail claims an email that never left the server.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class OverdueNotificationSender {

    static final DateTimeFormatter VN_DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final Locale VI = Locale.forLanguageTag("vi-VN");

    private final EmailService emailService;
    private final NotificationLogRepository notificationLogRepository;

    /** {@code sent} is true only when the mail server accepted the message. {@code error} is user-facing Vietnamese. */
    public record Outcome(boolean sent, String recipientEmail, String error) {
    }

    public boolean isMailConfigured() {
        return emailService.isMailConfigured();
    }

    public Outcome send(User recipient, Facility facility, NotificationType type, String referenceType, UUID referenceId,
                        String subject, String summary, String html) {
        String email = recipient != null ? recipient.getEmail() : null;
        if (email == null || email.isBlank()) {
            return new Outcome(false, null, "Khách hàng chưa có email trong hồ sơ");
        }
        String name = displayName(recipient);
        if (!emailService.isMailConfigured()) {
            String error = "Máy chủ chưa cấu hình dịch vụ gửi email";
            saveLog(recipient, email, name, facility, type, referenceType, referenceId, subject, summary, "FAILED", error);
            return new Outcome(false, email, error);
        }
        try {
            emailService.sendNow(email, subject, html);
            saveLog(recipient, email, name, facility, type, referenceType, referenceId, subject, summary, "SENT", null);
            return new Outcome(true, email, null);
        } catch (RuntimeException e) {
            log.warn("[OVERDUE_MAIL] Sending '{}' to {} failed: {}", subject, email, e.getMessage());
            String error = "Máy chủ email từ chối hoặc không phản hồi";
            saveLog(recipient, email, name, facility, type, referenceType, referenceId, subject, summary, "FAILED",
                    truncate(e.getMessage() != null ? e.getMessage() : error, 1000));
            return new Outcome(false, email, error);
        }
    }

    /**
     * Tells the tenant about an access change (lockout, restore): always one in-app notification for the bell, plus an email
     * through {@link EmailService#sendNow} when {@code sendEmail} is set, an address exists and mail is configured. Only one
     * log row is written (IN_APP) so the bell does not list the same event twice; a failed email is noted in its text.
     * Never throws: the access change has already happened and must not be rolled back by a notification problem.
     *
     * @return the email outcome ({@code sent} true only when the mail server accepted it)
     */
    public Outcome notifyCustomer(User recipient, Facility facility, NotificationType type, String referenceType,
                                  UUID referenceId, boolean sendEmail, String subject, String title, String summary, String html) {
        if (recipient == null) {
            return new Outcome(false, null, "Hợp đồng không gắn với khách thuê");
        }
        String email = recipient.getEmail() != null && !recipient.getEmail().isBlank() ? recipient.getEmail() : null;
        boolean sent = false;
        String error = null;
        if (sendEmail) {
            if (email == null) {
                error = "Khách hàng chưa có email trong hồ sơ";
            } else if (!emailService.isMailConfigured()) {
                error = "Máy chủ chưa cấu hình dịch vụ gửi email";
            } else {
                try {
                    emailService.sendNow(email, subject, html);
                    sent = true;
                } catch (RuntimeException e) {
                    log.warn("[OVERDUE_MAIL] Sending '{}' to {} failed: {}", subject, email, e.getMessage());
                    error = "Máy chủ email từ chối hoặc không phản hồi";
                }
            }
        }
        String content = summary + (sendEmail && !sent ? " Email thông báo chưa được gửi: " + error + "." : "");
        saveLog(recipient, email != null ? email : "", displayName(recipient), facility, NotificationChannel.IN_APP, type,
                referenceType, referenceId, title, content, "SENT", null);
        return new Outcome(sent, email, error);
    }

    private void saveLog(User recipient, String email, String name, Facility facility, NotificationType type,
                         String referenceType, UUID referenceId, String title, String content, String status, String error) {
        saveLog(recipient, email, name, facility, NotificationChannel.EMAIL, type, referenceType, referenceId, title, content,
                status, error);
    }

    private void saveLog(User recipient, String email, String name, Facility facility, NotificationChannel channel,
                         NotificationType type, String referenceType, UUID referenceId, String title, String content,
                         String status, String error) {
        try {
            notificationLogRepository.save(NotificationLog.builder()
                    .recipient(recipient)
                    .recipientEmail(email)
                    .recipientName(truncate(name, 100))
                    .facility(facility)
                    .channel(channel)
                    .notificationType(type)
                    .referenceType(referenceType)
                    .referenceId(referenceId)
                    .title(truncate(title, 255))
                    .content(content)
                    .status(status)
                    .errorMessage(error)
                    .build());
        } catch (RuntimeException e) {
            log.warn("[OVERDUE_MAIL] Could not write notification log: {}", e.getMessage());
        }
    }

    // ------------------------------------------------------------------ templates

    /** Plain Vietnamese HTML mail: a heading, an intro paragraph, a two-column table and closing lines. */
    public String render(String heading, String intro, List<Map.Entry<String, String>> rows, List<String> closing) {
        StringBuilder sb = new StringBuilder(2048);
        sb.append("<div style=\"font-family:Arial,Helvetica,sans-serif;color:#101828;font-size:14px;line-height:1.6;max-width:600px\">");
        sb.append("<h2 style=\"font-size:18px;margin:0 0 12px\">").append(esc(heading)).append("</h2>");
        sb.append("<p style=\"margin:0 0 16px\">").append(esc(intro)).append("</p>");
        sb.append("<table style=\"border-collapse:collapse;width:100%;margin:0 0 16px\">");
        for (Map.Entry<String, String> row : rows) {
            sb.append("<tr><td style=\"padding:6px 8px;border:1px solid #E4E7EC;color:#475467;width:45%\">")
                    .append(esc(row.getKey()))
                    .append("</td><td style=\"padding:6px 8px;border:1px solid #E4E7EC;font-weight:600\">")
                    .append(esc(row.getValue() != null ? row.getValue() : "—"))
                    .append("</td></tr>");
        }
        sb.append("</table>");
        for (String line : closing) {
            sb.append("<p style=\"margin:0 0 8px\">").append(esc(line)).append("</p>");
        }
        sb.append("<p style=\"margin:16px 0 0;color:#667085;font-size:12px\">Email tự động từ hệ thống Boxora. Vui lòng không trả lời email này.</p>");
        sb.append("</div>");
        return sb.toString();
    }

    public static String money(BigDecimal amount) {
        BigDecimal value = amount != null ? amount : BigDecimal.ZERO;
        return String.format(VI, "%,.0f", value) + " ₫";
    }

    public static String date(LocalDate value) {
        return value != null ? value.format(VN_DATE) : "—";
    }

    public static String displayName(User user) {
        if (user == null) {
            return null;
        }
        if (user.getFullName() != null && !user.getFullName().isBlank()) {
            return user.getFullName();
        }
        return user.getUsername();
    }

    public static String facilityContact(Facility facility) {
        if (facility == null) {
            return "Vui lòng liên hệ quầy tiếp đón của cơ sở để được hỗ trợ.";
        }
        String phone = facility.getContactPhone() != null && !facility.getContactPhone().isBlank()
                ? " qua số " + facility.getContactPhone() : "";
        return "Vui lòng liên hệ " + facility.getName() + phone + " để được hỗ trợ.";
    }

    private static String esc(String value) {
        return value == null ? "" : HtmlUtils.htmlEscape(value, "UTF-8");
    }

    static String truncate(String value, int max) {
        if (value == null) {
            return null;
        }
        return value.length() <= max ? value : value.substring(0, max);
    }
}

package com.boxora.service.impl;

import com.boxora.service.EmailService;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailServiceImpl implements EmailService {

    private final JavaMailSender mailSender;

    @Value("${spring.mail.username}")
    private String fromEmail;

    @Value("${app.frontend-url}")
    private String frontendUrl;


    @Override
    @Async
    public void sendPasswordResetEmail(String toEmail, String fullName, String resetToken) {
        String resetLink = frontendUrl + "/reset-password?token=" + resetToken;
        String subject = "Reset Your Password";
        String content = """
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>Password Reset Request</h2>
                    <p>Hi <strong>%s</strong>,</p>
                    <p>We received a request to reset your password.</p>
                    <p>This link will expire in <strong>15 minutes</strong>.</p>
                    <a href="%s"
                       style="display: inline-block; padding: 12px 24px; margin: 16px 0;
                              background-color: #4F46E5; color: white;
                              text-decoration: none; border-radius: 6px;">
                        Reset Password
                    </a>
                    <p>If you did not request this, please ignore this email.</p>
                    <hr/>
                    <p style="color: #999; font-size: 12px;">Store Hub Platform</p>
                </div>
                """.formatted(fullName, resetLink);

        sendHtmlEmail(toEmail, subject, content);
    }


    @Override
    @Async
    public void sendWelcomeEmail(String toEmail, String fullName) {
        String loginLink = frontendUrl + "/login";
        String subject = "Welcome to Store Hub!";
        String content = """
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>Welcome to Store Hub!</h2>
                    <p>Hi <strong>%s</strong>,</p>
                    <p>Your account has been created successfully.</p>
                    <a href="%s"
                       style="display: inline-block; padding: 12px 24px; margin: 16px 0;
                              background-color: #4F46E5; color: white;
                              text-decoration: none; border-radius: 6px;">
                        Go to boxora platform
                    </a>
                    <hr/>
                    <p style="color: #999; font-size: 12px;">Store Hub Platform</p>
                </div>
                """.formatted(fullName, loginLink);

        sendHtmlEmail(toEmail, subject, content);
    }


    private void sendHtmlEmail(String to, String subject, String htmlContent) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(fromEmail);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(htmlContent, true);
            mailSender.send(message);
            log.info("Email sent to: {}", to);
        } catch (MessagingException e) {
            log.error("Failed to send email to: {}", to, e);
            throw new RuntimeException("Failed to send email", e);
        }
    }

    @Override
    @Async
    public void sendMasterKeyAlertEmail(String toEmail, String recipientName, String facilityName,
                                        String performedByName, String witnessName,
                                        String category, String severity,
                                        String reason, String documentReference) {
        String subject = String.format("[%s] Master Key được sử dụng tại %s", severity, facilityName);
        String docRow = (documentReference != null && !documentReference.isBlank())
                ? """
                  <tr><td style="padding: 6px; border: 1px solid #eee;"><strong>Số hiệu / Văn bản</strong></td>
                      <td style="padding: 6px; border: 1px solid #eee;">%s</td></tr>
                  """.formatted(documentReference)
                : "";

        String severityColor = switch (severity) {
            case "CRITICAL" -> "#DC2626";
            case "HIGH" -> "#EA580C";
            default -> "#2563EB";
        };

        String content = """
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: %s;">⚠ Cảnh báo: Sử dụng Master Key (%s)</h2>
                <p>Xin chào <strong>%s</strong>,</p>
                <p>Hệ thống ghi nhận Master Key vừa được sử dụng tại cơ sở <strong>%s</strong>.</p>
                <table style="width: 100%%; border-collapse: collapse; margin: 16px 0;">
                    <tr><td style="padding: 6px; border: 1px solid #eee;"><strong>Nhóm tình huống (Category)</strong></td>
                        <td style="padding: 6px; border: 1px solid #eee;">%s</td></tr>
                    <tr><td style="padding: 6px; border: 1px solid #eee;"><strong>Mức độ khẩn cấp (Severity)</strong></td>
                        <td style="padding: 6px; border: 1px solid #eee; font-weight: bold; color: %s;">%s</td></tr>
                    <tr><td style="padding: 6px; border: 1px solid #eee;"><strong>Người thực hiện</strong></td>
                        <td style="padding: 6px; border: 1px solid #eee;">%s</td></tr>
                    <tr><td style="padding: 6px; border: 1px solid #eee;"><strong>Người làm chứng (Xác thực 2 người)</strong></td>
                        <td style="padding: 6px; border: 1px solid #eee;">%s</td></tr>
                    <tr><td style="padding: 6px; border: 1px solid #eee;"><strong>Lý do chi tiết</strong></td>
                        <td style="padding: 6px; border: 1px solid #eee;">%s</td></tr>
                    %s
                </table>
                <p>Vui lòng kiểm tra Activity Log trên hệ thống để xem chi tiết đầy đủ nếu cần.</p>
                <hr/>
                <p style="color: #999; font-size: 12px;">Boxora Platform - Automated Security Alert</p>
            </div>
            """.formatted(severityColor, severity, recipientName, facilityName, category,
                          severityColor, severity, performedByName, witnessName, reason, docRow);

        sendHtmlEmail(toEmail, subject, content);
    }
}
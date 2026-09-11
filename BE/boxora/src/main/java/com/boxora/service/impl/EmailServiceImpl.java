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
                    <p style="color: #999; font-size: 12px;">LMS Platform</p>
                </div>
                """.formatted(fullName, resetLink);

        sendHtmlEmail(toEmail, subject, content);
    }


    @Override
    public void sendWelcomeEmail(String toEmail, String fullName) {
        String loginLink = frontendUrl + "/login";
        String subject = "Welcome to LMS!";
        String content = """
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>Welcome to LMS!</h2>
                    <p>Hi <strong>%s</strong>,</p>
                    <p>Your account has been created successfully.</p>
                    <a href="%s"
                       style="display: inline-block; padding: 12px 24px; margin: 16px 0;
                              background-color: #4F46E5; color: white;
                              text-decoration: none; border-radius: 6px;">
                        Start Learning
                    </a>
                    <hr/>
                    <p style="color: #999; font-size: 12px;">LMS Platform</p>
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
}
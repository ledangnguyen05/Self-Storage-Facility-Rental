package com.boxora.service.impl;

import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Properties;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class EmailServiceImplTest {

    @Mock private JavaMailSender mailSender;

    private EmailServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new EmailServiceImpl(mailSender, new MockEnvironment());
        ReflectionTestUtils.setField(service, "mailHost", "smtp.gmail.com");
        ReflectionTestUtils.setField(service, "mailUsername", "");
        ReflectionTestUtils.setField(service, "mailPassword", "");
        ReflectionTestUtils.setField(service, "configuredFrom", "");
        ReflectionTestUtils.setField(service, "smtpAuth", "true");
        ReflectionTestUtils.setField(service, "frontendUrl", "http://localhost:8889/");
    }

    private MimeMessage newMessage() {
        // mail.host: without it JavaMail resolves this machine's canonical host name for the Message-ID (~5 s on Windows).
        Properties properties = new Properties();
        properties.put("mail.host", "boxora.test");
        return new MimeMessage(Session.getInstance(properties));
    }

    @Test
    @DisplayName("Gmail mặc định (auth=true) nhưng chưa có tài khoản -> chưa cấu hình; có đủ thông tin -> đã cấu hình")
    void configuredOnlyWithCredentialsWhenAuthIsRequired() {
        assertFalse(service.isMailConfigured());
        ReflectionTestUtils.setField(service, "mailUsername", "boxora@gmail.com");
        assertFalse(service.isMailConfigured(), "password still missing");
        ReflectionTestUtils.setField(service, "mailPassword", "app-password");
        assertTrue(service.isMailConfigured());
    }

    @Test
    @DisplayName("Bộ bắt mail cục bộ (Mailpit: auth=false) được coi là đã cấu hình dù không có username")
    void localMailCatcherNeedsNoCredentials() {
        ReflectionTestUtils.setField(service, "mailHost", "localhost");
        ReflectionTestUtils.setField(service, "smtpAuth", "false");
        assertTrue(service.isMailConfigured());
        ReflectionTestUtils.setField(service, "mailHost", "");
        assertFalse(service.isMailConfigured());
    }

    @Test
    @DisplayName("sendNow khi chưa cấu hình -> EMAIL_SEND_FAILED, không cố gửi")
    void sendNowRefusesWhenNotConfigured() {
        AppException ex = assertThrows(AppException.class, () -> service.sendNow("a@b.vn", "Chủ đề", "<p>x</p>"));
        assertEquals(ErrorCode.EMAIL_SEND_FAILED, ex.getErrorCode());
        verifyNoInteractions(mailSender);
    }

    @Test
    @DisplayName("sendNow: SMTP từ chối -> EMAIL_SEND_FAILED (không trả thành công giả)")
    void sendNowReportsSmtpFailure() {
        ReflectionTestUtils.setField(service, "mailHost", "localhost");
        ReflectionTestUtils.setField(service, "smtpAuth", "false");
        when(mailSender.createMimeMessage()).thenReturn(newMessage());
        doThrow(new MailSendException("Connection refused")).when(mailSender).send(any(MimeMessage.class));

        AppException ex = assertThrows(AppException.class, () -> service.sendNow("a@b.vn", "Chủ đề", "<p>x</p>"));

        assertEquals(ErrorCode.EMAIL_SEND_FAILED, ex.getErrorCode());
        assertEquals(503, ex.getErrorCode().getHttpStatus().value());
    }

    @Test
    @DisplayName("Email đặt lại mật khẩu: tiếng Việt, thương hiệu Boxora, liên kết tuyệt đối tới /reset-password?token=")
    void passwordResetMailIsVietnameseAndBranded() throws Exception {
        ReflectionTestUtils.setField(service, "mailHost", "localhost");
        ReflectionTestUtils.setField(service, "smtpAuth", "false");
        MimeMessage message = newMessage();
        when(mailSender.createMimeMessage()).thenReturn(message);

        service.sendPasswordResetEmail("khach@example.com", "Nguyễn <b>Văn</b> A", "abc.def-ghi_123");

        ArgumentCaptor<MimeMessage> sent = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender).send(sent.capture());
        MimeMessage mime = sent.getValue();
        assertTrue(mime.getSubject().contains("Boxora"));
        assertTrue(mime.getSubject().contains("Đặt lại mật khẩu"));
        assertEquals("khach@example.com", mime.getAllRecipients()[0].toString());
        assertTrue(mime.getFrom()[0].toString().contains("Boxora"), mime.getFrom()[0].toString());

        mime.saveChanges();
        String html = extractHtml(mime);
        assertTrue(html.contains("http://localhost:8889/reset-password?token=abc.def-ghi_123"), html);
        assertFalse(html.contains("Store Hub"));
        assertFalse(html.contains("Reset Your Password"));
        assertTrue(html.contains("15 phút"));
        assertFalse(html.contains("<b>Văn</b>"), "user supplied name must be HTML-escaped");
    }

    @Test
    @DisplayName("Email chào mừng chạy nền: lỗi gửi chỉ được ghi log, không làm hỏng đăng ký")
    void welcomeMailFailureIsSwallowed() {
        // not configured -> sendNow throws internally, welcome mail must not propagate it
        assertDoesNotThrow(() -> service.sendWelcomeEmail("a@b.vn", "Nguyen"));
        verifyNoInteractions(mailSender);
    }

    @Test
    @DisplayName("Email đặt lại mật khẩu chạy nền: gửi thật khi đã cấu hình; lỗi SMTP chỉ ghi log, không ném ra request")
    void asyncPasswordResetMailDeliversAndSwallowsFailures() throws Exception {
        ReflectionTestUtils.setField(service, "mailHost", "localhost");
        ReflectionTestUtils.setField(service, "smtpAuth", "false");
        when(mailSender.createMimeMessage()).thenReturn(newMessage()).thenReturn(newMessage());

        service.sendPasswordResetEmailAsync("khach@example.com", "Nguyễn Văn A", "tok.en-1");
        verify(mailSender).send(any(MimeMessage.class));

        doThrow(new MailSendException("Connection refused")).when(mailSender).send(any(MimeMessage.class));
        assertDoesNotThrow(() -> service.sendPasswordResetEmailAsync("khach@example.com", "Nguyễn Văn A", "tok.en-2"));
    }

    private static String extractHtml(MimeMessage message) throws Exception {
        Object content = message.getContent();
        if (content instanceof String text) {
            return text;
        }
        if (content instanceof jakarta.mail.Multipart multipart) {
            StringBuilder all = new StringBuilder();
            collect(multipart, all);
            return all.toString();
        }
        return String.valueOf(content);
    }

    private static void collect(jakarta.mail.Multipart multipart, StringBuilder out) throws Exception {
        for (int i = 0; i < multipart.getCount(); i++) {
            jakarta.mail.BodyPart part = multipart.getBodyPart(i);
            Object content = part.getContent();
            if (content instanceof String text) {
                out.append(text);
            } else if (content instanceof jakarta.mail.Multipart nested) {
                collect(nested, out);
            }
        }
    }
}

package com.boxora.service;

import com.boxora.service.impl.EmailServiceImpl;
import jakarta.mail.BodyPart;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import jakarta.mail.internet.MimeMultipart;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Properties;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("Task 18: Professional HTML Email Service & Security Tests")
class EmailServiceTest {

    @Mock
    private JavaMailSender mailSender;

    @InjectMocks
    private EmailServiceImpl emailService;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(emailService, "fromEmail", "no-reply@boxora.com");
        ReflectionTestUtils.setField(emailService, "frontendUrl", "https://boxora.vn");

        lenient().when(mailSender.createMimeMessage()).thenAnswer(inv -> new MimeMessage(Session.getInstance(new Properties())));
    }

    private String extractHtml(jakarta.mail.Part part) throws Exception {
        if (part == null) return "";
        if (part instanceof MimeMessage m) {
            m.saveChanges();
        }
        if (part.isMimeType("text/html")) {
            return (String) part.getContent();
        }
        Object content = part.getContent();
        if (content instanceof jakarta.mail.Multipart mp) {
            for (int i = 0; i < mp.getCount(); i++) {
                String res = extractHtml(mp.getBodyPart(i));
                if (!res.isBlank()) {
                    return res;
                }
            }
        }
        return "";
    }

    private String extractPlainText(jakarta.mail.Part part) throws Exception {
        if (part == null) return "";
        if (part instanceof MimeMessage m) {
            m.saveChanges();
        }
        if (part.isMimeType("text/plain")) {
            return (String) part.getContent();
        }
        Object content = part.getContent();
        if (content instanceof jakarta.mail.Multipart mp) {
            for (int i = 0; i < mp.getCount(); i++) {
                String res = extractPlainText(mp.getBodyPart(i));
                if (!res.isBlank()) {
                    return res;
                }
            }
        }
        return "";
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 1. Handover Pin Email
    // ─────────────────────────────────────────────────────────────────────────
    @Test
    @DisplayName("Email bàn giao kho: Hiển thị đúng thông tin booking, vị trí kho và mã PIN")
    void testSendHandoverPinEmail_CorrectBookingInfoAndPin() throws Exception {
        emailService.sendHandoverPinEmail(
                "khachhang@boxora.vn",
                "Nguyễn Văn An",
                "A-102",
                "BK-2026-001",
                "987654",
                "Boxora Tân Bình"
        );

        ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender, times(1)).send(captor.capture());

        MimeMessage msg = captor.getValue();
        assertThat(msg.getSubject()).contains("A-102").contains("Ghi nhận bàn giao");

        String html = extractHtml(msg);
        assertThat(html).contains("Nguyễn Văn An");
        assertThat(html).contains("A-102");
        assertThat(html).contains("BK-2026-001");
        assertThat(html).contains("Boxora Tân Bình");
        assertThat(html).contains("987654");
        assertThat(html).contains("chưa được đồng bộ hoặc xác nhận với khóa SmartLock vật lý");
        assertThat(html).contains("BOXORA");

        String text = extractPlainText(msg);
        assertThat(text).contains("BK-2026-001");
        assertThat(text).contains("987654");
        assertThat(text).contains("chưa được đồng bộ hoặc xác nhận với khóa SmartLock vật lý");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Payment Success Email
    // ─────────────────────────────────────────────────────────────────────────
    @Test
    @DisplayName("Email thanh toán: Hiển thị trạng thái PAID xác nhận và định dạng tiền VND")
    void testSendPaymentSuccessEmail_ConfirmedPaidStatusAndFormattedAmount() throws Exception {
        emailService.sendPaymentSuccessEmail(
                "customer@boxora.vn",
                "Trần Thị Bích",
                "TXN-889922",
                new BigDecimal("1500000"),
                "Thanh toán tiền thuê kho tháng 03/2026"
        );

        ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender, times(1)).send(captor.capture());

        MimeMessage msg = captor.getValue();
        assertThat(msg.getSubject()).contains("TXN-889922").contains("Biên lai xác nhận thanh toán");

        String html = extractHtml(msg);
        assertThat(html).contains("Trần Thị Bích");
        assertThat(html).contains("TXN-889922");
        assertThat(html).contains("1.500.000 VND");
        assertThat(html).contains("ĐÃ THANH TOÁN (PAID)");
        assertThat(html).contains("Thanh toán tiền thuê kho tháng 03/2026");
    }

    // ─────────────────────────────────────────────────────────────────────────
    @Test
    void overdueNoticeShowsUnreconciledBalanceInsteadOfZero() throws Exception {
        emailService.sendOverdueNoticeEmail("customer@boxora.vn", "Customer", "RC-1", "A-1", 4, null, "WARNING");

        ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender).send(captor.capture());
        String html = extractHtml(captor.getValue());

        assertThat(html).contains("Chưa đối soát");
        assertThat(html).doesNotContain("0 VND");
    }
    // 3. Contract Signed Confirmation Email
    // ─────────────────────────────────────────────────────────────────────────
    @Test
    @DisplayName("Email hợp đồng ký thành công (đã check-in): Hiển thị mã HĐ, kho, mã PIN, trạng thái ACTIVE và nút xem văn bản")
    void testSendContractSignedConfirmationEmail_CorrectStatusAndContractCode() throws Exception {
        emailService.sendContractSignedConfirmationEmail(
                "customer@boxora.vn",
                "Lê Hoàng Cường",
                "HD-2026-99",
                "B-205",
                "123456",
                "https://boxora.vn/api/v1/contracts/download/sample.pdf"
        );

        ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender, times(1)).send(captor.capture());

        MimeMessage msg = captor.getValue();
        assertThat(msg.getSubject()).contains("HD-2026-99").contains("đã có hiệu lực");

        String html = extractHtml(msg);
        assertThat(html).contains("Lê Hoàng Cường");
        assertThat(html).contains("HD-2026-99");
        assertThat(html).contains("B-205");
        assertThat(html).contains("123456");
        assertThat(html).contains("Đã kích hoạt (ACTIVE)");
        assertThat(html).contains("TRẠNG THÁI MÃ PIN MỞ KHO");
        assertThat(html).contains("https://boxora.vn/api/v1/contracts/download/sample.pdf");
        assertThat(html).contains("Xem Văn Bản Hợp Đồng Đã Ký");
    }

    @Test
    @DisplayName("Email hợp đồng ký thành công (chưa check-in): Hiển thị trạng thái Chờ hoàn tất thủ tục và không lộ mã PIN giả")
    void testSendContractSignedConfirmationEmail_PendingCheckin_DoesNotDisplayActiveOrFakePin() throws Exception {
        emailService.sendContractSignedConfirmationEmail(
                "customer@boxora.vn",
                "Lê Hoàng Cường",
                "HD-2026-99",
                "B-205",
                "Chưa kích hoạt - Cấp sau khi hoàn tất check-in tại cơ sở",
                "https://boxora.vn/api/v1/contracts/download/sample.pdf"
        );

        ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender, times(1)).send(captor.capture());

        MimeMessage msg = captor.getValue();
        assertThat(msg.getSubject()).contains("HD-2026-99").contains("Xác nhận ký hợp đồng thuê kho");

        String html = extractHtml(msg);
        assertThat(html).contains("Lê Hoàng Cường");
        assertThat(html).contains("HD-2026-99");
        assertThat(html).contains("B-205");
        assertThat(html).contains("TRẠNG THÁI MÃ PIN MỞ KHO");
        assertThat(html).contains("Đã ký điện tử (Chờ hoàn tất thủ tục nhận kho)");
        assertThat(html).doesNotContain("Đã kích hoạt (ACTIVE)");
        assertThat(html).contains("Chưa kích hoạt (Chỉ cấp phát sau khi hoàn tất đối soát đủ 4 điều kiện check-in và bàn giao tại cơ sở)");
        assertThat(html).contains("Mã PIN SmartLock sẽ được kích hoạt và cấp phát chính thức sau khi quý khách đến cơ sở Boxora");
        assertThat(html).contains("https://boxora.vn/api/v1/contracts/download/sample.pdf");
        assertThat(html).contains("Xem Văn Bản Hợp Đồng Đã Ký");

        String text = extractPlainText(msg);
        assertThat(text).contains("TRẠNG THÁI MÃ PIN MỞ KHO");
        assertThat(text).contains("Đã ký điện tử (Chờ hoàn tất thủ tục nhận kho)");
        assertThat(text).doesNotContain("ACTIVE");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. Renewal Reminder Email
    // ─────────────────────────────────────────────────────────────────────────
    @Test
    @DisplayName("Email nhắc hạn hợp đồng: Phân biệt mức độ khẩn cấp (<= 3 ngày vs 7 ngày)")
    void testSendRenewalReminderEmail_CorrectUrgencyAndDate() throws Exception {
        // Test urgent case (<= 3 days)
        emailService.sendRenewalReminderEmail(
                "customer@boxora.vn",
                "Phạm Minh Đạt",
                "HD-2026-03",
                "C-301",
                LocalDate.of(2026, 4, 30),
                2,
                new BigDecimal("2400000")
        );

        ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender, times(1)).send(captor.capture());

        MimeMessage msgUrgent = captor.getValue();
        assertThat(msgUrgent.getSubject()).contains("KHẨN CẤP").contains("2 ngày");

        String htmlUrgent = extractHtml(msgUrgent);
        assertThat(htmlUrgent).contains("Phạm Minh Đạt");
        assertThat(htmlUrgent).contains("HD-2026-03");
        assertThat(htmlUrgent).contains("30/04/2026");
        assertThat(htmlUrgent).contains("2 ngày");
        assertThat(htmlUrgent).contains("2.400.000 VND/tháng");
        assertThat(htmlUrgent).contains("Gia Hạn Hợp Đồng Ngay");

        // Test normal reminder case (7 days)
        reset(mailSender);
        when(mailSender.createMimeMessage()).thenAnswer(inv -> new MimeMessage(Session.getInstance(new Properties())));

        emailService.sendRenewalReminderEmail(
                "customer@boxora.vn",
                "Phạm Minh Đạt",
                "HD-2026-03",
                "C-301",
                LocalDate.of(2026, 5, 5),
                7,
                new BigDecimal("2400000")
        );

        verify(mailSender, times(1)).send(captor.capture());
        MimeMessage msgNormal = captor.getValue();
        assertThat(msgNormal.getSubject()).doesNotContain("KHẨN CẤP").contains("Nhắc nhở");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. Refund Status Email: Pending vs Completed vs Rejected
    // ─────────────────────────────────────────────────────────────────────────
    @Test
    @DisplayName("Email hoàn tiền: Phân biệt rõ ràng giữa pending transfer và completed")
    void testSendRefundStatusEmail_PendingVsCompleted() throws Exception {
        // Pending transfer
        emailService.sendRefundStatusEmail(
                "customer@boxora.vn",
                "Đỗ Thu Thảo",
                "REF-9001",
                "PROCESSING_TRANSFER",
                new BigDecimal("500000"),
                "Vietcombank",
                "0123456789",
                "FT2604001",
                "Hoàn tiền cọc sau nghiệm thu kho"
        );

        ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender, times(1)).send(captor.capture());

        MimeMessage msgPending = captor.getValue();
        assertThat(msgPending.getSubject()).contains("Đang thực hiện lệnh chuyển khoản");
        String htmlPending = extractHtml(msgPending);
        assertThat(htmlPending).contains("Đang thực hiện lệnh chuyển khoản ngân hàng");
        assertThat(htmlPending).contains("500.000 VND");
        assertThat(htmlPending).contains("Vietcombank");
        assertThat(htmlPending).contains("0123456789");
        assertThat(htmlPending).doesNotContain("Chi trả và đối soát hoàn tất");

        // Completed
        reset(mailSender);
        when(mailSender.createMimeMessage()).thenAnswer(inv -> new MimeMessage(Session.getInstance(new Properties())));

        emailService.sendRefundStatusEmail(
                "customer@boxora.vn",
                "Đỗ Thu Thảo",
                "REF-9001",
                "COMPLETED",
                new BigDecimal("500000"),
                "Vietcombank",
                "0123456789",
                "FT2604001",
                "Hoàn tiền cọc sau nghiệm thu kho"
        );

        verify(mailSender, times(1)).send(captor.capture());
        MimeMessage msgCompleted = captor.getValue();
        assertThat(msgCompleted.getSubject()).contains("Chi trả và đối soát hoàn tất");
        String htmlCompleted = extractHtml(msgCompleted);
        assertThat(htmlCompleted).contains("Chi trả và đối soát hoàn tất");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 6. Security: HTML Injection Prevention (Escaping)
    // ─────────────────────────────────────────────────────────────────────────
    @Test
    @DisplayName("Bảo mật HTML Injection: Ký tự đặc biệt trong dữ liệu người dùng được escape an toàn")
    void testHtmlEscaping_SpecialCharactersSanitized() throws Exception {
        String maliciousName = "<script>alert('xss')</script> & <b>\"Hacked\"</b>";
        String maliciousDesc = "Malicious <img src=x onerror=alert(1)> description";

        emailService.sendPaymentSuccessEmail(
                "test@boxora.vn",
                maliciousName,
                "TXN-<test>",
                new BigDecimal("100000"),
                maliciousDesc
        );

        ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender, times(1)).send(captor.capture());

        String html = extractHtml(captor.getValue());

        // Verify that raw dangerous tags are NOT present
        assertThat(html).doesNotContain("<script>");
        assertThat(html).doesNotContain("alert('xss')</script>");
        assertThat(html).doesNotContain("<img src=x onerror=alert(1)>");

        // Verify that escaped representations ARE present
        assertThat(html).contains("&lt;script&gt;");
        assertThat(html).contains("&amp;");
        assertThat(html).contains("&quot;Hacked&quot;");
        assertThat(html).contains("&lt;img src=x onerror=alert(1)&gt;");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 7. Null Safety for Optional Fields
    // ─────────────────────────────────────────────────────────────────────────
    @Test
    @DisplayName("Khả năng chống lỗi Null: Các trường null không làm crash hệ thống")
    void testNullAndOptionalFields_DoNotThrow() {
        assertThatCode(() -> {
            emailService.sendPasswordResetEmail("user@boxora.vn", null, null);
            emailService.sendWelcomeEmail("user@boxora.vn", null);
            emailService.sendContractSigningOtp("user@boxora.vn", null);
            emailService.sendContractSignedConfirmationEmail("user@boxora.vn", null, null, null, null, null);
            emailService.sendPaymentSuccessEmail("user@boxora.vn", null, null, null, null);
            emailService.sendOverdueNoticeEmail("user@boxora.vn", null, null, null, 0, null, null);
            emailService.sendSealingNoticeEmail("user@boxora.vn", null, null, null, null, null, 0, null, null);
            emailService.sendUnsealingNoticeEmail("user@boxora.vn", null, null, null, null, null, null);
            emailService.sendRefundStatusEmail("user@boxora.vn", null, null, null, null, null, null, null, null);
            emailService.sendRenewalReminderEmail("user@boxora.vn", null, null, null, null, 0, null);
            emailService.sendHandoverPinEmail("user@boxora.vn", null, null, null, null, null);
            emailService.sendMasterKeyAlertEmail("admin@boxora.vn", null, null, null, null, null, null, null, null);
        }).doesNotThrowAnyException();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 8. No Fake Hotline or Fake Domains
    // ─────────────────────────────────────────────────────────────────────────
    @Test
    @DisplayName("Tính trung thực thương hiệu: Không tạo hotline giả hoặc domain không có thật")
    void testNoFakeHotlineOrFakeDomain() throws Exception {
        emailService.sendWelcomeEmail("test@boxora.vn", "Nguyễn Khách Hàng");

        ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender, times(1)).send(captor.capture());

        String html = extractHtml(captor.getValue());

        // Ensure no fabricated hotline numbers or fake domains
        assertThat(html).doesNotContain("1900");
        assertThat(html).doesNotContain("0909");
        assertThat(html).doesNotContain("0988");
        assertThat(html).doesNotContain("example.com");
        assertThat(html).doesNotContain("fakeboxora");

        // Verify valid branding signature
        assertThat(html).contains("BOXORA SMART SELF-STORAGE PLATFORM");
        assertThat(html).contains("© 2026 Boxora");
    }

    @Test
    @DisplayName("An toàn cấu hình SMTP: Khi fromEmail rỗng/không hợp lệ, an toàn bỏ qua không gửi với domain giả no-reply@boxora.com")
    void testSendEmail_UnconfiguredSender_DoesNotDispatchFakeSender() {
        ReflectionTestUtils.setField(emailService, "fromEmail", "");
        emailService.sendWelcomeEmail("test@boxora.vn", "Nguyễn Khách Hàng");
        verify(mailSender, never()).send(any(MimeMessage.class));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 9. Contract Signing OTP Email
    // ─────────────────────────────────────────────────────────────────────────
    @Test
    @DisplayName("Email OTP ký hợp đồng: Hiển thị mã nổi bật, thời hạn 5 phút và cảnh báo bảo mật")
    void testContractSigningOtp_IncludesOtpAndWarning() throws Exception {
        emailService.sendContractSigningOtp("signer@boxora.vn", "825103");

        ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender, times(1)).send(captor.capture());

        String html = extractHtml(captor.getValue());
        assertThat(html).contains("825103");
        assertThat(html).contains("5 PHÚT");
        assertThat(html).containsIgnoringCase("Mã xác thực ký số");
        assertThat(html).contains("Tuyệt đối không chia sẻ mã này cho bất kỳ ai");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 10. Master Key Alert Email
    // ─────────────────────────────────────────────────────────────────────────
    @Test
    @DisplayName("Email cảnh báo Master Key: Phân màu mức độ khẩn cấp và hiển thị đủ thông tin 2 nhân sự")
    void testMasterKeyAlertEmail_SeverityColorAndDetails() throws Exception {
        emailService.sendMasterKeyAlertEmail(
                "manager@boxora.vn",
                "Quản Lý Nguyễn",
                "Boxora Tân Bình",
                "Kỹ thuật viên Trần",
                "Bảo vệ Lê",
                "CỨU HỘ KHẨN CẤP",
                "CRITICAL",
                "Xử lý chập điện buồng điều hòa tầng 2",
                "BB-2026-CH01"
        );

        ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender, times(1)).send(captor.capture());

        MimeMessage msg = captor.getValue();
        assertThat(msg.getSubject()).contains("[CRITICAL]").contains("Boxora Tân Bình");

        String html = extractHtml(msg);
        assertThat(html).contains("Quản Lý Nguyễn");
        assertThat(html).contains("Boxora Tân Bình");
        assertThat(html).contains("Kỹ thuật viên Trần");
        assertThat(html).contains("Bảo vệ Lê");
        assertThat(html).contains("CỨU HỘ KHẨN CẤP");
        assertThat(html).contains("BB-2026-CH01");
        assertThat(html).contains("#b91c1c"); // Critical red color
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 11. Sealing & Unsealing Notices
    // ─────────────────────────────────────────────────────────────────────────
    @Test
    @DisplayName("Email niêm phong và mở niêm phong: Thể hiện đúng thông tin số kẹp chì và biên bản")
    void testSealingAndUnsealingNotices() throws Exception {
        // Sealing
        emailService.sendSealingNoticeEmail(
                "debtor@boxora.vn",
                "Nguyễn Văn Nợ",
                "HD-OVERDUE-01",
                "D-401",
                "BB-NP-008",
                "SEAL-998822",
                16,
                new BigDecimal("4200000"),
                "Quá hạn 16 ngày chưa thanh toán"
        );

        ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender, times(1)).send(captor.capture());

        String htmlSeal = extractHtml(captor.getValue());
        assertThat(htmlSeal).contains("BB-NP-008");
        assertThat(htmlSeal).contains("SEAL-998822");
        assertThat(htmlSeal).contains("4.200.000 VND");
        assertThat(htmlSeal).contains("15 ngày");
        assertThat(htmlSeal).containsIgnoringCase("PIN/QR đã bị thu hồi trong Boxora");
        assertThat(htmlSeal).containsIgnoringCase("trạng thái khóa vật lý chưa được xác minh");

        // Unsealing
        reset(mailSender);
        when(mailSender.createMimeMessage()).thenAnswer(inv -> new MimeMessage(Session.getInstance(new Properties())));

        emailService.sendUnsealingNoticeEmail(
                "debtor@boxora.vn",
                "Nguyễn Văn Nợ",
                "HD-OVERDUE-01",
                "D-401",
                "BB-NP-008",
                "Quản lý Trần",
                "Đã tất toán toàn bộ công nợ"
        );

        verify(mailSender, times(1)).send(captor.capture());
        String htmlUnseal = extractHtml(captor.getValue());
        assertThat(htmlUnseal).contains("Mở Niêm Phong Kho Thành Công");
        assertThat(htmlUnseal).contains("Quản lý Trần");
        assertThat(htmlUnseal).contains("Đã tất toán toàn bộ công nợ");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 12. Password Reset Email
    // ─────────────────────────────────────────────────────────────────────────
    @Test
    @DisplayName("Email đặt lại mật khẩu: Hiển thị liên kết đặt lại và cảnh báo 15 phút")
    void testSendPasswordResetEmail() throws Exception {
        emailService.sendPasswordResetEmail(
                "reset@boxora.vn",
                "Vũ Minh Tuấn",
                "secret-reset-token-xyz"
        );

        ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender, times(1)).send(captor.capture());

        String html = extractHtml(captor.getValue());
        assertThat(html).contains("Vũ Minh Tuấn");
        assertThat(html).contains("15 phút");
        assertThat(html).contains("https://boxora.vn/reset-password?token=secret-reset-token-xyz");
        assertThat(html).contains("Đặt Lại Mật Khẩu Ngay");
    }

    @Test
    @DisplayName("Email đặt lại mật khẩu: Khi frontendUrl rỗng/không hợp lệ, không sinh link gãy href='/reset-password'")
    void testSendPasswordResetEmail_EmptyFrontendUrl_DoesNotRenderBrokenLink() throws Exception {
        ReflectionTestUtils.setField(emailService, "frontendUrl", "");

        emailService.sendPasswordResetEmail(
                "reset@boxora.vn",
                "Vũ Minh Tuấn",
                "secret-reset-token-xyz"
        );

        ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender, times(1)).send(captor.capture());

        String html = extractHtml(captor.getValue());
        assertThat(html).contains("Vũ Minh Tuấn");
        assertThat(html).doesNotContain("href=\"/reset-password");
        assertThat(html).doesNotContain("Đặt Lại Mật Khẩu Ngay");
        assertThat(html).contains("Cổng web chưa được cấu hình địa chỉ ứng dụng trực tiếp");

        String text = extractPlainText(msgOrCaptor(captor.getValue()));
        assertThat(text).doesNotContain("https:///reset-password");
        assertThat(text).contains("Cổng web chưa cấu hình liên kết trực tiếp");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 13. Booking Cancellation & Rejection Email
    // ─────────────────────────────────────────────────────────────────────────
    @Test
    @DisplayName("Email từ chối đặt kho bởi nhân viên: Hiển thị badge từ chối, lý do và hotline hỗ trợ")
    void testSendBookingCancellationEmail_StaffRejected_DisplaysRejectionNoticeAndHotline() throws Exception {
        emailService.sendBookingCancellationEmail(
                "khach@boxora.vn",
                "Trần Văn Bình",
                "BX-2026-8888",
                "Boxora Thủ Đức",
                "TD-C208",
                "Loại hàng hóa không phù hợp với quy chuẩn phòng cháy",
                true,
                BigDecimal.ZERO
        );

        ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender, times(1)).send(captor.capture());

        MimeMessage message = captor.getValue();
        assertThat(message.getSubject()).contains("Thông báo từ chối đơn đặt giữ chỗ BX-2026-8888");

        String html = extractHtml(message);
        assertThat(html).contains("Trần Văn Bình");
        assertThat(html).contains("ĐƠN ĐÃ TỪ CHỐI");
        assertThat(html).contains("BX-2026-8888");
        assertThat(html).contains("Boxora Thủ Đức");
        assertThat(html).contains("TD-C208");
        assertThat(html).contains("Loại hàng hóa không phù hợp với quy chuẩn phòng cháy");
        assertThat(html).contains("1900-BOXORA");

        String plainText = extractPlainText(message);
        assertThat(plainText).contains("THÔNG BÁO TỪ CHỐI ĐƠN ĐẶT GIỮ CHỖ");
        assertThat(plainText).contains("BX-2026-8888");
        assertThat(plainText).contains("Boxora Thủ Đức");
    }

    @Test
    @DisplayName("Email hủy đặt kho bởi khách hàng có hoàn tiền: Hiển thị thông tin hoàn tiền cọc")
    void testSendBookingCancellationEmail_CustomerCancelled_WithRefund_DisplaysRefundDetails() throws Exception {
        emailService.sendBookingCancellationEmail(
                "khach@boxora.vn",
                "Lê Thị Thảo",
                "BX-2026-9999",
                "Boxora Bình Thạnh",
                "BT-A101",
                "Thay đổi kế hoạch chuyển nhà",
                false,
                new BigDecimal("500000.00")
        );

        ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender, times(1)).send(captor.capture());

        MimeMessage message = captor.getValue();
        assertThat(message.getSubject()).contains("Xác nhận hủy đơn đặt kho BX-2026-9999");

        String html = extractHtml(message);
        assertThat(html).contains("Lê Thị Thảo");
        assertThat(html).contains("ĐÃ HỦY ĐƠN");
        assertThat(html).contains("BX-2026-9999");
        assertThat(html).contains("500.000");
        assertThat(html).contains("Thay đổi kế hoạch chuyển nhà");

        String plainText = extractPlainText(message);
        assertThat(plainText).contains("XÁC NHẬN HỦY ĐƠN ĐẶT KHO THEO YÊU CẦU");
        assertThat(plainText).contains("BX-2026-9999");
    }

    private MimeMessage msgOrCaptor(MimeMessage msg) {
        return msg;
    }
}


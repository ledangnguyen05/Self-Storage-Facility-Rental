package com.boxora.service.impl;

import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.service.EmailService;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.util.HtmlUtils;

import java.io.UnsupportedEncodingException;
import java.math.BigDecimal;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailServiceImpl implements EmailService {

    private static final String BRAND_NAME = "Boxora";
    private static final String ACCENT = "#0866F5";
    private static final Locale VI = Locale.forLanguageTag("vi-VN");

    private final JavaMailSender mailSender;
    private final Environment environment;

    @Value("${spring.mail.host:}")
    private String mailHost;

    @Value("${spring.mail.username:}")
    private String mailUsername;

    @Value("${spring.mail.password:}")
    private String mailPassword;

    /** Explicit From address; falls back to the SMTP username, then to a local no-reply address. */
    @Value("${app.mail.from:}")
    private String configuredFrom;

    @Value("${spring.mail.properties.mail.smtp.auth:true}")
    private String smtpAuth;

    @Value("${app.frontend-url:http://localhost:5173}")
    private String frontendUrl;

    // =====================================================================
    // Public contract: configuration check + synchronous send
    // =====================================================================

    /**
     * True when an SMTP host is set and, if the server requires authentication, credentials are present.
     * A local catcher such as Mailpit (auth=false) counts as configured without a username.
     */
    @Override
    public boolean isMailConfigured() {
        if (mailHost == null || mailHost.isBlank()) {
            return false;
        }
        boolean authRequired = !"false".equalsIgnoreCase(smtpAuth == null ? "true" : smtpAuth.trim());
        return !authRequired || (!isBlank(mailUsername) && !isBlank(mailPassword));
    }

    /**
     * Sends one HTML mail synchronously.
     *
     * @throws AppException EMAIL_SEND_FAILED when mail is not configured or the SMTP server rejects the message
     */
    @Override
    public void sendNow(String to, String subject, String htmlContent) {
        if (isBlank(to)) {
            throw new AppException(ErrorCode.EMAIL_SEND_FAILED, "Không có địa chỉ email người nhận.");
        }
        if (!isMailConfigured()) {
            throw new AppException(ErrorCode.EMAIL_SEND_FAILED,
                    "Hệ thống chưa cấu hình dịch vụ gửi email (MAIL_USERNAME / MAIL_PASSWORD) nên chưa thể gửi thư. Vui lòng liên hệ quản trị viên.");
        }
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(new InternetAddress(fromAddress(), BRAND_NAME, "UTF-8"));
            helper.setTo(to.trim());
            helper.setSubject(subject);
            helper.setText(htmlContent, true);
            mailSender.send(message);
            log.info("Email sent to: {}", to);
        } catch (MessagingException | MailException | UnsupportedEncodingException e) {
            log.error("Failed to send email to {}: {}", to, e.getMessage());
            throw new AppException(ErrorCode.EMAIL_SEND_FAILED);
        }
    }

    /** Fire-and-forget variant for best-effort mails: failures are logged, never thrown to the caller. */
    private void sendQuietly(String to, String subject, String htmlContent) {
        try {
            sendNow(to, subject, htmlContent);
        } catch (AppException e) {
            log.warn("Email '{}' to {} was not delivered: {}", subject, to, e.getMessage());
        }
    }

    // =====================================================================
    // Account mails
    // =====================================================================

    /**
     * Synchronous: callers that can report a delivery failure to the visitor (without leaking anything by doing
     * so) use this one; forgot-password uses {@link #sendPasswordResetEmailAsync}.
     */
    @Override
    public void sendPasswordResetEmail(String toEmail, String fullName, String resetToken) {
        String resetLink = baseUrl() + "/reset-password?token=" + URLEncoder.encode(resetToken, StandardCharsets.UTF_8);
        String subject = "[Boxora] Đặt lại mật khẩu tài khoản";
        String body = """
                <h2 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#101828;">Đặt lại mật khẩu</h2>
                <p style="margin:0 0 12px;">Xin chào <strong>%s</strong>,</p>
                <p style="margin:0 0 12px;">Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản Boxora của bạn.
                Liên kết dưới đây có hiệu lực trong <strong>15 phút</strong> và chỉ dùng được một lần.</p>
                %s
                <p style="margin:0 0 12px;color:#475467;font-size:13px;">Nếu nút không hoạt động, hãy sao chép liên kết sau vào trình duyệt:<br/>
                <a href="%s" style="color:%s;word-break:break-all;">%s</a></p>
                <p style="margin:16px 0 0;color:#475467;font-size:13px;">Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này. Mật khẩu hiện tại của bạn vẫn được giữ nguyên.</p>
                """.formatted(esc(displayName(fullName)), button("Đặt lại mật khẩu", resetLink), esc(resetLink), ACCENT, esc(resetLink));

        if (!isMailConfigured() && environment.acceptsProfiles(org.springframework.core.env.Profiles.of("dev"))) {
            // Local development convenience only; the caller still receives the "mail not configured" error.
            log.warn("[DEV] Mail is not configured. Password reset link for {}: {}", toEmail, resetLink);
        }
        sendNow(toEmail, subject, layout(body));
    }

    @Override
    @Async
    public void sendPasswordResetEmailAsync(String toEmail, String fullName, String resetToken) {
        try {
            sendPasswordResetEmail(toEmail, fullName, resetToken);
        } catch (AppException e) {
            // The visitor already got the generic answer; the failure is for the operators to see.
            log.error("Password reset email to {} could not be delivered: {}", toEmail, e.getMessage());
        }
    }

    @Override
    @Async
    public void sendWelcomeEmail(String toEmail, String fullName) {
        String loginLink = baseUrl() + "/login";
        String subject = "[Boxora] Chào mừng bạn đến với Boxora";
        String body = """
                <h2 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#101828;">Chào mừng bạn đến với Boxora</h2>
                <p style="margin:0 0 12px;">Xin chào <strong>%s</strong>,</p>
                <p style="margin:0 0 12px;">Tài khoản của bạn đã được tạo thành công. Bạn có thể đăng nhập để tìm kho phù hợp,
                ký hợp đồng và thanh toán trực tuyến.</p>
                %s
                <p style="margin:16px 0 0;color:#475467;font-size:13px;">Nếu bạn không đăng ký tài khoản này, vui lòng bỏ qua email.</p>
                """.formatted(esc(displayName(fullName)), button("Đăng nhập vào Boxora", loginLink));
        sendQuietly(toEmail, subject, layout(body));
    }

    @Override
    public void sendContractSigningOtp(String toEmail, String otp) {
        String body = """
                <h2 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#101828;">Xác thực ký hợp đồng Boxora</h2>
                <p style="margin:0 0 12px;">Mã OTP của bạn là:</p>
                <p style="margin:0 0 16px;font-size:28px;font-weight:600;letter-spacing:8px;font-family:monospace;">%s</p>
                <p style="margin:0 0 12px;">Mã có hiệu lực trong 5 phút. Không chia sẻ mã này với bất kỳ ai.</p>
                <p style="margin:0;color:#475467;font-size:13px;">Nếu bạn không yêu cầu ký hợp đồng, hãy bỏ qua email này.</p>
                """.formatted(esc(otp));
        // The OTP flow reports delivery failures to the customer, so it stays synchronous.
        sendNow(toEmail, "[Boxora] Mã OTP ký hợp đồng", layout(body));
    }

    // =====================================================================
    // Operational mails (best effort, asynchronous)
    // =====================================================================

    @Override
    @Async
    public void sendMasterKeyAlertEmail(String toEmail, String recipientName, String facilityName,
                                        String performedByName, String witnessName,
                                        String category, String severity,
                                        String reason, String documentReference) {
        // Display text is Vietnamese; the raw codes (CRITICAL, LIFE_AND_SAFETY...) only drive the colour below.
        String severityLabel = MasterKeyLabels.severity(severity);
        String categoryLabel = MasterKeyLabels.category(category);
        String subject = String.format("[%s] Sử dụng chìa khóa tổng tại %s", severityLabel, facilityName);
        String docRow = (documentReference != null && !documentReference.isBlank())
                ? """
                  <tr><td style="padding: 6px; border: 1px solid #eee;"><strong>Số hiệu / Văn bản</strong></td>
                      <td style="padding: 6px; border: 1px solid #eee;">%s</td></tr>
                  """.formatted(esc(documentReference))
                : "";

        String severityColor = switch (severity == null ? "" : severity) {
            case "CRITICAL" -> "#DC2626";
            case "HIGH" -> "#EA580C";
            default -> "#2563EB";
        };

        String content = """
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: %s;">⚠ Cảnh báo: Sử dụng chìa khóa tổng (%s)</h2>
                <p>Xin chào <strong>%s</strong>,</p>
                <p>Hệ thống ghi nhận chìa khóa tổng vừa được sử dụng tại cơ sở <strong>%s</strong>.</p>
                <table style="width: 100%%; border-collapse: collapse; margin: 16px 0;">
                    <tr><td style="padding: 6px; border: 1px solid #eee;"><strong>Nhóm tình huống</strong></td>
                        <td style="padding: 6px; border: 1px solid #eee;">%s</td></tr>
                    <tr><td style="padding: 6px; border: 1px solid #eee;"><strong>Mức độ khẩn cấp</strong></td>
                        <td style="padding: 6px; border: 1px solid #eee; font-weight: bold; color: %s;">%s</td></tr>
                    <tr><td style="padding: 6px; border: 1px solid #eee;"><strong>Người thực hiện</strong></td>
                        <td style="padding: 6px; border: 1px solid #eee;">%s</td></tr>
                    <tr><td style="padding: 6px; border: 1px solid #eee;"><strong>Người làm chứng (xác thực 2 người)</strong></td>
                        <td style="padding: 6px; border: 1px solid #eee;">%s</td></tr>
                    <tr><td style="padding: 6px; border: 1px solid #eee;"><strong>Lý do chi tiết</strong></td>
                        <td style="padding: 6px; border: 1px solid #eee;">%s</td></tr>
                    %s
                </table>
                <p>Vui lòng kiểm tra nhật ký hoạt động trên hệ thống để xem chi tiết đầy đủ nếu cần.</p>
                <hr/>
                <p style="color: #999; font-size: 12px;">Boxora - Cảnh báo bảo mật tự động</p>
            </div>
            """.formatted(severityColor, esc(severityLabel), esc(recipientName), esc(facilityName), esc(categoryLabel),
                          severityColor, esc(severityLabel), esc(performedByName), esc(witnessName), esc(reason), docRow);

        sendQuietly(toEmail, subject, content);
    }


    @Override
    @Async
    public void sendContractSignedConfirmationEmail(String toEmail, String fullName, String contractCode, String unitCode, String accessPin, String contractUrl) {
        String subject = "[Boxora] Chúc mừng! Hợp đồng " + contractCode + " đã được ký thành công";
        String docLinkHtml = (contractUrl != null && !contractUrl.isBlank())
                ? """
                  <div style="margin: 16px 0;">
                      <a href="%s" style="display: inline-block; padding: 10px 20px; background-color: #0866F5; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
                          Xem văn bản hợp đồng đã ký
                      </a>
                  </div>
                  """.formatted(esc(contractUrl))
                : "";

        String content = """
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                    <h2 style="color: #10B981; margin-top: 0;">🎉 Hợp đồng đã có hiệu lực</h2>
                    <p>Kính gửi <strong>%s</strong>,</p>
                    <p>Hợp đồng thuê kho <strong>%s</strong> cho vị trí kho <strong>%s</strong> đã được ký thành công và chính thức có hiệu lực.</p>
                    <div style="background-color: #F8FAFC; border-left: 4px solid #10B981; padding: 14px; margin: 18px 0; border-radius: 4px;">
                        <h4 style="margin: 0 0 8px 0; color: #1E293B;">Thông tin quyền truy cập nhận kho:</h4>
                        <p style="margin: 4px 0;">Vị trí kho: <strong>%s</strong></p>
                        <p style="margin: 4px 0;">Mã PIN bảo mật SmartLock: <strong style="font-size: 18px; color: #0866F5; letter-spacing: 2px;">%s</strong></p>
                    </div>
                    %s
                    <p style="color: #64748B; font-size: 13px;">Bạn có thể đổi mã PIN bất kỳ lúc nào trên ứng dụng Boxora sau khi đăng nhập.</p>
                    <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;"/>
                    <p style="color: #94A3B8; font-size: 12px;">Trân trọng, Đội ngũ Boxora Self-Storage</p>
                </div>
                """.formatted(esc(fullName), esc(contractCode), esc(unitCode), esc(unitCode), esc(accessPin), docLinkHtml);
        sendQuietly(toEmail, subject, content);
    }

    @Override
    @Async
    public void sendPaymentSuccessEmail(String toEmail, String fullName, String txnRef, BigDecimal amount, String description) {
        String subject = "[Boxora] Biên lai thanh toán thành công - Mã GD: " + txnRef;
        String content = """
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                    <h2 style="color: #10B981; margin-top: 0;">Xác nhận thanh toán thành công</h2>
                    <p>Xin chào <strong>%s</strong>,</p>
                    <p>Boxora đã nhận được khoản thanh toán của bạn qua cổng VNPay.</p>
                    <table style="width: 100%%; border-collapse: collapse; margin: 16px 0;">
                        <tr><td style="padding: 8px; border-bottom: 1px solid #eee;">Mã giao dịch</td><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">%s</td></tr>
                        <tr><td style="padding: 8px; border-bottom: 1px solid #eee;">Số tiền</td><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold; color: #10B981;">%s</td></tr>
                        <tr><td style="padding: 8px; border-bottom: 1px solid #eee;">Nội dung</td><td style="padding: 8px; border-bottom: 1px solid #eee;">%s</td></tr>
                        <tr><td style="padding: 8px; border-bottom: 1px solid #eee;">Thời gian</td><td style="padding: 8px; border-bottom: 1px solid #eee;">%s</td></tr>
                    </table>
                    <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;"/>
                    <p style="color: #94A3B8; font-size: 12px;">Cảm ơn bạn đã tin tưởng sử dụng dịch vụ tại Boxora.</p>
                </div>
                """.formatted(esc(fullName), esc(txnRef), money(amount, ""), esc(description),
                java.time.LocalDateTime.now().format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss")));
        sendQuietly(toEmail, subject, content);
    }

    @Override
    @Async
    public void sendOverdueNoticeEmail(String toEmail, String fullName, String contractCode, String unitCode, long daysOverdue, BigDecimal totalDebt, String overdueStage) {
        String subject = "[Boxora] Thông báo nợ cước quá hạn hợp đồng thuê kho " + contractCode;
        String stageDesc = switch (overdueStage == null ? "" : overdueStage) {
            case "GRACE_PERIOD" -> "Thời gian gia hạn miễn phạt";
            case "WARNING" -> "Cảnh báo nợ quá hạn - Phát sinh phí phạt trễ";
            case "ACCESS_BLOCKED" -> "Khóa quyền truy cập SmartLock tạm thời";
            case "ELIGIBLE_FOR_SEALING" -> "Nguy cơ niêm phong và xử lý tài sản theo hợp đồng";
            default -> overdueStage == null ? "" : overdueStage;
        };

        String content = """
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #EF4444; border-radius: 8px;">
                    <h2 style="color: #DC2626; margin-top: 0;">Thông báo nợ cước quá hạn</h2>
                    <p>Kính gửi <strong>%s</strong>,</p>
                    <p>Hệ thống Boxora ghi nhận hợp đồng thuê kho <strong>%s</strong> (Vị trí kho: <strong>%s</strong>) đã quá hạn thanh toán.</p>
                    <div style="background-color: #FEF2F2; border-left: 4px solid #DC2626; padding: 14px; margin: 16px 0;">
                        <p style="margin: 4px 0;">Số ngày quá hạn: <strong style="color: #DC2626;">%d ngày</strong></p>
                        <p style="margin: 4px 0;">Giai đoạn hiện tại: <strong>%s</strong></p>
                        <p style="margin: 4px 0;">Tổng công nợ cần thanh toán: <strong style="color: #DC2626; font-size: 18px;">%s</strong></p>
                    </div>
                    <p>Vui lòng đăng nhập ứng dụng Boxora để thanh toán ngay qua cổng VNPay để khôi phục hoặc duy trì quyền truy cập kho.</p>
                    <hr style="border: 0; border-top: 1px solid #fee2e2; margin: 20px 0;"/>
                    <p style="color: #94A3B8; font-size: 12px;">Bộ phận Chăm sóc Khách hàng Boxora</p>
                </div>
                """.formatted(esc(fullName), esc(contractCode), esc(unitCode), daysOverdue, esc(stageDesc), money(totalDebt, ""));
        sendQuietly(toEmail, subject, content);
    }

    @Override
    @Async
    public void sendSealingNoticeEmail(String toEmail, String fullName, String contractCode, String unitCode, String protocolNumber, String sealTagNumber, long overdueDays, BigDecimal totalDebt, String reason) {
        String subject = "[Boxora - KHẨN CẤP] Biên bản niêm phong kho " + unitCode + " do quá hạn thanh toán";
        String content = """
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 2px solid #DC2626; border-radius: 8px;">
                    <h2 style="color: #DC2626; margin-top: 0;">⚠ THÔNG BÁO NIÊM PHONG KHO LƯU TRỮ</h2>
                    <p>Kính gửi <strong>%s</strong>,</p>
                    <p>Do hợp đồng thuê kho <strong>%s</strong> đã quá hạn thanh toán <strong>%d ngày</strong> vượt quá giới hạn cho phép, Ban Quản Lý Boxora đã chính thức tiến hành lập biên bản và niêm phong kho lưu trữ của quý khách.</p>
                    <div style="background-color: #FEF2F2; border-left: 4px solid #DC2626; padding: 14px; margin: 16px 0;">
                        <p style="margin: 4px 0;">Số biên bản: <strong>%s</strong></p>
                        <p style="margin: 4px 0;">Vị trí kho: <strong>%s</strong></p>
                        <p style="margin: 4px 0;">Số seri kẹp chì niêm phong: <strong style="color: #DC2626;">%s</strong></p>
                        <p style="margin: 4px 0;">Lý do niêm phong: <em>%s</em></p>
                        <p style="margin: 4px 0;">Tổng công nợ hiện tại: <strong style="color: #DC2626; font-size: 18px;">%s</strong></p>
                    </div>
                    <p style="color: #B91C1C; font-weight: bold;">Quyền mở cửa SmartLock đã bị khóa cưỡng chế.</p>
                    <p>Quý khách vui lòng thanh toán toàn bộ công nợ trên ứng dụng hoặc liên hệ ngay với Ban Quản Lý cơ sở trong vòng 15 ngày để tiến hành thủ tục mở niêm phong và tránh xử lý thanh lý tài sản theo hợp đồng.</p>
                    <hr style="border: 0; border-top: 1px solid #fee2e2; margin: 20px 0;"/>
                    <p style="color: #94A3B8; font-size: 12px;">Bộ phận An ninh & Pháp lý - Boxora Self-Storage</p>
                </div>
                """.formatted(esc(fullName), esc(contractCode), overdueDays, esc(protocolNumber), esc(unitCode), esc(sealTagNumber), esc(reason), money(totalDebt, ""));
        sendQuietly(toEmail, subject, content);
    }

    @Override
    @Async
    public void sendUnsealingNoticeEmail(String toEmail, String fullName, String contractCode, String unitCode, String protocolNumber, String unsealedByName, String unsealReason) {
        String subject = "[Boxora] Thông báo mở niêm phong kho " + unitCode;
        String content = """
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #10B981; border-radius: 8px;">
                    <h2 style="color: #10B981; margin-top: 0;">✅ THÔNG BÁO MỞ NIÊM PHONG KHO THÀNH CÔNG</h2>
                    <p>Kính gửi <strong>%s</strong>,</p>
                    <p>Kho lưu trữ <strong>%s</strong> (Hợp đồng: <strong>%s</strong>) đã được mở niêm phong thành công.</p>
                    <div style="background-color: #ECFDF5; border-left: 4px solid #10B981; padding: 14px; margin: 16px 0;">
                        <p style="margin: 4px 0;">Số biên bản niêm phong trước: <strong>%s</strong></p>
                        <p style="margin: 4px 0;">Người thực hiện mở: <strong>%s</strong></p>
                        <p style="margin: 4px 0;">Lý do mở: <em>%s</em></p>
                        <p style="margin: 4px 0;">Thời gian: <strong>%s</strong></p>
                    </div>
                    <p>Quyền truy cập kho của quý khách đã được khôi phục trạng thái hoạt động bình thường.</p>
                    <hr style="border: 0; border-top: 1px solid #d1fae5; margin: 20px 0;"/>
                    <p style="color: #94A3B8; font-size: 12px;">Ban Quản Lý Vận Hành Boxora Self-Storage</p>
                </div>
                """.formatted(esc(fullName), esc(unitCode), esc(contractCode), esc(protocolNumber), esc(unsealedByName), esc(unsealReason),
                java.time.LocalDateTime.now().format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss")));
        sendQuietly(toEmail, subject, content);
    }

    @Override
    @Async
    public void sendRefundStatusEmail(String toEmail, String fullName, String requestCode, String status, BigDecimal amount, String bankName, String bankAccount, String transactionReference, String notes) {
        String statusTitle = switch (status == null ? "" : status) {
            case "APPROVED" -> "Đã được phê duyệt";
            case "REJECTED" -> "Bị từ chối";
            case "PROCESSING_TRANSFER" -> "Đang thực hiện lệnh chuyển khoản";
            case "AWAITING_CUSTOMER_CONFIRMATION" -> "Đã chuyển tiền - Chờ quý khách xác nhận";
            case "RECONCILED" -> "Đã nhận tiền - Đang đối soát sổ phụ";
            case "COMPLETED", "PROCESSED" -> "Chi trả và đối soát hoàn tất";
            default -> "Cập nhật trạng thái";
        };
        String subject = "[Boxora] Yêu cầu hoàn tiền " + requestCode + " - " + statusTitle;
        String content = """
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #CBD5E1; border-radius: 8px;">
                    <h2 style="color: #2563EB; margin-top: 0;">Thông báo xử lý yêu cầu hoàn tiền</h2>
                    <p>Kính gửi <strong>%s</strong>,</p>
                    <p>Yêu cầu hoàn tiền mã <strong>%s</strong> của quý khách hiện có trạng thái: <strong style="color: #2563EB;">%s</strong>.</p>
                    <table style="width: 100%%; border-collapse: collapse; margin: 16px 0;">
                        <tr><td style="padding: 6px; border-bottom: 1px solid #eee;">Số tiền hoàn</td><td style="padding: 6px; border-bottom: 1px solid #eee; font-weight: bold; color: #10B981;">%s</td></tr>
                        <tr><td style="padding: 6px; border-bottom: 1px solid #eee;">Ngân hàng thụ hưởng</td><td style="padding: 6px; border-bottom: 1px solid #eee;">%s - STK: %s</td></tr>
                        <tr><td style="padding: 6px; border-bottom: 1px solid #eee;">Mã giao dịch</td><td style="padding: 6px; border-bottom: 1px solid #eee;">%s</td></tr>
                        <tr><td style="padding: 6px; border-bottom: 1px solid #eee;">Ghi chú</td><td style="padding: 6px; border-bottom: 1px solid #eee;">%s</td></tr>
                    </table>
                    <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;"/>
                    <p style="color: #94A3B8; font-size: 12px;">Bộ phận Kế toán & Tài chính Boxora</p>
                </div>
                """.formatted(esc(fullName), esc(requestCode), esc(statusTitle), money(amount, ""), esc(bankName), esc(bankAccount),
                transactionReference != null ? esc(transactionReference) : "Chưa có", notes != null ? esc(notes) : "Không có");
        sendQuietly(toEmail, subject, content);
    }

    @Override
    @Async
    public void sendRenewalReminderEmail(String toEmail, String fullName, String contractCode, String unitCode, java.time.LocalDate endDate, long daysRemaining, BigDecimal monthlyFee) {
        String urgencyColor = daysRemaining <= 3 ? "#DC2626" : "#F59E0B";
        String urgencyTitle = daysRemaining <= 3
                ? "⚠ [KHẨN CẤP] Hợp đồng thuê kho sắp hết hạn sau " + daysRemaining + " ngày"
                : "🔔 Nhắc nhở: Hợp đồng thuê kho sắp hết hạn sau " + daysRemaining + " ngày";
        String subject = "[Boxora] " + urgencyTitle + " - " + contractCode;
        String endDateText = endDate.format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy"));
        String content = """
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid %s; border-radius: 8px;">
                    <h2 style="color: %s; margin-top: 0;">%s</h2>
                    <p>Kính gửi <strong>%s</strong>,</p>
                    <p>Hợp đồng thuê kho <strong>%s</strong> cho kho <strong>%s</strong> sẽ chính thức hết hạn vào ngày <strong style="color: %s;">%s</strong> (còn <strong>%d ngày</strong>).</p>
                    <div style="background-color: #F8FAFC; border-left: 4px solid %s; padding: 14px; margin: 16px 0;">
                        <p style="margin: 4px 0;">Vị trí kho: <strong>%s</strong></p>
                        <p style="margin: 4px 0;">Ngày kết thúc hợp đồng: <strong>%s</strong></p>
                        <p style="margin: 4px 0;">Giá thuê chu kỳ tiếp theo: <strong>%s</strong></p>
                    </div>
                    <p>Để đảm bảo tài sản trong kho được bảo quản liên tục và không bị gián đoạn quyền truy cập SmartLock, quý khách vui lòng truy cập ứng dụng Boxora và chọn <strong>Gia hạn hợp đồng</strong> trước ngày hết hạn.</p>
                    <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;"/>
                    <p style="color: #94A3B8; font-size: 12px;">Đội ngũ Chăm sóc Khách hàng Boxora Self-Storage</p>
                </div>
                """.formatted(
                urgencyColor, urgencyColor, esc(urgencyTitle),
                esc(fullName), esc(contractCode), esc(unitCode), urgencyColor,
                endDateText,
                daysRemaining, urgencyColor, esc(unitCode),
                endDateText,
                money(monthlyFee, "/tháng")
        );
        sendQuietly(toEmail, subject, content);
    }

    @Override
    @Async
    public void sendHandoverPinEmail(String toEmail, String fullName, String unitCode, String bookingCode, String accessPin, String facilityName) {
        String subject = "[Boxora] Thông tin bàn giao kho và mã PIN mở kho " + unitCode;
        String content = """
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                    <h2 style="color: #0284c7; margin-top: 0;">🎉 Bàn giao kho thành công</h2>
                    <p>Kính gửi <strong>%s</strong>,</p>
                    <p>Quá trình nghiệm thu và bàn giao kho cho đơn đặt chỗ <strong>%s</strong> tại cơ sở <strong>%s</strong> đã hoàn tất.</p>
                    <div style="background-color: #F8FAFC; border-left: 4px solid #0284c7; padding: 14px; margin: 18px 0; border-radius: 4px;">
                        <h4 style="margin: 0 0 8px 0; color: #1E293B;">Thông tin truy cập ngăn kho:</h4>
                        <p style="margin: 4px 0;">Vị trí kho: <strong style="font-size: 16px; color: #0f172a;">%s</strong></p>
                        <p style="margin: 4px 0;">Mã PIN bảo mật SmartLock: <strong style="font-size: 22px; color: #0284c7; letter-spacing: 3px;">%s</strong></p>
                    </div>
                    <p style="color: #64748B; font-size: 13px;">Quý khách vui lòng bảo mật mã PIN này. Quý khách có thể xem và quản lý mã PIN trên cổng thông tin Boxora bất cứ lúc nào.</p>
                    <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;"/>
                    <p style="color: #94A3B8; font-size: 12px;">Trân trọng, Đội ngũ Boxora Self-Storage</p>
                </div>
                """.formatted(esc(fullName), esc(bookingCode), esc(facilityName != null ? facilityName : "Boxora"), esc(unitCode), esc(accessPin));
        sendQuietly(toEmail, subject, content);
    }

    // =====================================================================
    // Helpers
    // =====================================================================

    /** Boxora-branded wrapper used by the account mails. */
    private String layout(String bodyHtml) {
        return """
                <div style="background:#F7F8FA;padding:24px 12px;font-family:Inter,Arial,sans-serif;color:#101828;font-size:14px;line-height:1.6;">
                  <div style="max-width:600px;margin:0 auto;background:#FFFFFF;border:1px solid #E4E7EC;border-radius:12px;overflow:hidden;">
                    <div style="padding:18px 28px;border-bottom:1px solid #E4E7EC;">
                      <span style="font-size:18px;font-weight:600;color:%s;">%s</span>
                      <span style="margin-left:8px;font-size:12px;color:#667085;">Kho tự quản thông minh</span>
                    </div>
                    <div style="padding:28px;">%s</div>
                    <div style="padding:14px 28px;background:#F7F8FA;border-top:1px solid #E4E7EC;font-size:12px;color:#667085;">
                      Email này được gửi tự động từ hệ thống Boxora. Vui lòng không trả lời trực tiếp email này.
                    </div>
                  </div>
                </div>
                """.formatted(ACCENT, BRAND_NAME, bodyHtml);
    }

    private String button(String label, String url) {
        return """
                <p style="margin:20px 0;"><a href="%s" style="display:inline-block;padding:11px 22px;background-color:%s;color:#FFFFFF;
                text-decoration:none;border-radius:8px;font-weight:600;">%s</a></p>
                """.formatted(esc(url), ACCENT, esc(label));
    }

    private String fromAddress() {
        if (!isBlank(configuredFrom)) {
            return configuredFrom.trim();
        }
        if (!isBlank(mailUsername) && mailUsername.contains("@")) {
            return mailUsername.trim();
        }
        return "no-reply@boxora.local";
    }

    private String baseUrl() {
        String url = isBlank(frontendUrl) ? "http://localhost:5173" : frontendUrl.trim();
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }

    private static String displayName(String fullName) {
        return isBlank(fullName) ? "bạn" : fullName.trim();
    }

    private static String esc(Object value) {
        // UTF-8: only <, >, &, quotes are escaped; Vietnamese letters stay readable in the source.
        return value == null ? "" : HtmlUtils.htmlEscape(String.valueOf(value), "UTF-8");
    }

    private static String money(BigDecimal amount, String suffix) {
        long value = amount == null ? 0L : amount.longValue();
        return String.format(VI, "%,d VND%s", value, suffix == null ? "" : suffix);
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}

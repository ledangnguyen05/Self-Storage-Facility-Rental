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

    @Override
    public void sendContractSigningOtp(String toEmail, String otp) {
        String content = """
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>Xác thực ký hợp đồng Boxora</h2>
                    <p>Mã OTP của bạn là:</p>
                    <p style="font-size: 28px; font-weight: bold; letter-spacing: 8px;">%s</p>
                    <p>Mã có hiệu lực trong 5 phút. Không chia sẻ mã này với bất kỳ ai.</p>
                    <p>Nếu bạn không yêu cầu ký hợp đồng, hãy bỏ qua email này.</p>
                </div>
                """.formatted(otp);
        sendHtmlEmail(toEmail, "Mã OTP ký hợp đồng Boxora", content);
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


    @Override
    @Async
    public void sendContractSignedConfirmationEmail(String toEmail, String fullName, String contractCode, String unitCode, String accessPin, String contractUrl) {
        String subject = "[Boxora] Chúc mừng! Hợp đồng " + contractCode + " đã được ký thành công";
        String docLinkHtml = (contractUrl != null && !contractUrl.isBlank())
                ? """
                  <div style="margin: 16px 0;">
                      <a href="%s" style="display: inline-block; padding: 10px 20px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
                          Xem văn bản hợp đồng đã ký
                      </a>
                  </div>
                  """.formatted(contractUrl)
                : "";

        String content = """
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                    <h2 style="color: #10B981; margin-top: 0;">🎉 Hợp đồng đã có hiệu lực</h2>
                    <p>Kính gửi <strong>%s</strong>,</p>
                    <p>Hợp đồng thuê kho <strong>%s</strong> cho vị trí kho <strong>%s</strong> đã được ký thành công và chính thức có hiệu lực.</p>
                    <div style="background-color: #F8FAFC; border-left: 4px solid #10B981; padding: 14px; margin: 18px 0; border-radius: 4px;">
                        <h4 style="margin: 0 0 8px 0; color: #1E293B;">Thông tin quyền truy cập nhận kho:</h4>
                        <p style="margin: 4px 0;">Vị trí kho: <strong>%s</strong></p>
                        <p style="margin: 4px 0;">Mã PIN bảo mật SmartLock: <strong style="font-size: 18px; color: #4F46E5; letter-spacing: 2px;">%s</strong></p>
                    </div>
                    %s
                    <p style="color: #64748B; font-size: 13px;">Bạn có thể đổi mã PIN bất kỳ lúc nào trên ứng dụng Boxora sau khi đăng nhập.</p>
                    <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;"/>
                    <p style="color: #94A3B8; font-size: 12px;">Trân trọng, Đội ngũ Boxora Self-Storage</p>
                </div>
                """.formatted(fullName, contractCode, unitCode, unitCode, accessPin, docLinkHtml);
        sendHtmlEmail(toEmail, subject, content);
    }

    @Override
    @Async
    public void sendPaymentSuccessEmail(String toEmail, String fullName, String txnRef, java.math.BigDecimal amount, String description) {
        String subject = "[Boxora] Biên lai thanh toán thành công - Mã GD: " + txnRef;
        String formattedAmount = String.format("%,d VND", amount.longValue());
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
                """.formatted(fullName, txnRef, formattedAmount, description, java.time.LocalDateTime.now().format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss")));
        sendHtmlEmail(toEmail, subject, content);
    }

    @Override
    @Async
    public void sendOverdueNoticeEmail(String toEmail, String fullName, String contractCode, String unitCode, long daysOverdue, java.math.BigDecimal totalDebt, String overdueStage) {
        String subject = "[Boxora] Thông báo nợ cước quá hạn hợp đồng thuê kho " + contractCode;
        String formattedDebt = String.format("%,d VND", totalDebt.longValue());
        String stageDesc = switch (overdueStage) {
            case "GRACE_PERIOD" -> "Thời gian gia hạn miễn phạt (Grace Period)";
            case "WARNING" -> "Cảnh báo nợ quá hạn - Phát sinh phí phạt trễ";
            case "ACCESS_BLOCKED" -> "Khóa quyền truy cập SmartLock tạm thời";
            case "ELIGIBLE_FOR_SEALING" -> "Nguy cơ niêm phong và xử lý tài sản theo hợp đồng";
            default -> overdueStage;
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
                """.formatted(fullName, contractCode, unitCode, daysOverdue, stageDesc, formattedDebt);
        sendHtmlEmail(toEmail, subject, content);
    }

    @Override
    @Async
    public void sendSealingNoticeEmail(String toEmail, String fullName, String contractCode, String unitCode, String protocolNumber, String sealTagNumber, long overdueDays, java.math.BigDecimal totalDebt, String reason) {
        String subject = "[Boxora - KHẨN CẤP] Biên bản niêm phong kho " + unitCode + " do quá hạn thanh toán";
        String formattedDebt = String.format("%,d VND", totalDebt.longValue());
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
                """.formatted(fullName, contractCode, overdueDays, protocolNumber, unitCode, sealTagNumber, reason, formattedDebt);
        sendHtmlEmail(toEmail, subject, content);
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
                """.formatted(fullName, unitCode, contractCode, protocolNumber, unsealedByName, unsealReason, java.time.LocalDateTime.now().format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss")));
        sendHtmlEmail(toEmail, subject, content);
    }

    @Override
    @Async
    public void sendRefundStatusEmail(String toEmail, String fullName, String requestCode, String status, java.math.BigDecimal amount, String bankName, String bankAccount, String transactionReference, String notes) {
        String statusTitle = switch (status) {
            case "APPROVED" -> "Đã được phê duyệt";
            case "REJECTED" -> "Bị từ chối";
            case "PROCESSING_TRANSFER" -> "Đang thực hiện lệnh chuyển khoản";
            case "AWAITING_CUSTOMER_CONFIRMATION" -> "Đã chuyển tiền - Chờ quý khách xác nhận";
            case "RECONCILED" -> "Đã nhận tiền - Đang đối soát sổ phụ";
            case "COMPLETED", "PROCESSED" -> "Chi trả và đối soát hoàn tất";
            default -> "Cập nhật trạng thái";
        };
        String subject = "[Boxora] Yêu cầu hoàn tiền " + requestCode + " - " + statusTitle;
        String formattedAmount = String.format("%,d VND", amount.longValue());
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
                """.formatted(fullName, requestCode, statusTitle, formattedAmount, bankName, bankAccount, transactionReference != null ? transactionReference : "N/A", notes != null ? notes : "Không có");
        sendHtmlEmail(toEmail, subject, content);
    }

    @Override
    @Async
    public void sendRenewalReminderEmail(String toEmail, String fullName, String contractCode, String unitCode, java.time.LocalDate endDate, long daysRemaining, java.math.BigDecimal monthlyFee) {
        String urgencyColor = daysRemaining <= 3 ? "#DC2626" : "#F59E0B";
        String urgencyTitle = daysRemaining <= 3 ? "⚠ [KHẨN CẤP] Hợp đồng thuê kho sắp hết hạn sau " + daysRemaining + " ngày" : "🔔 Nhắc nhở: Hợp đồng thuê kho sắp hết hạn sau 7 ngày";
        String formattedFee = String.format("%,d VND/tháng", monthlyFee.longValue());
        String subject = "[Boxora] " + urgencyTitle + " - " + contractCode;
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
                urgencyColor, urgencyColor, urgencyTitle,
                fullName, contractCode, unitCode, urgencyColor,
                endDate.format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy")),
                daysRemaining, urgencyColor, unitCode,
                endDate.format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy")),
                formattedFee
        );
        sendHtmlEmail(toEmail, subject, content);
    }

    @Override
    @Async
    public void sendHandoverPinEmail(String toEmail, String fullName, String unitCode, String bookingCode, String accessPin, String facilityName) {
        String subject = "[Boxora] Thông tin bàn giao kho và mã PIN mở kho " + unitCode;
        String content = """
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                    <h2 style="color: #0284c7; margin-top: 0;">🎉 Bàn Giao Kho Thành Công</h2>
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
                """.formatted(fullName, bookingCode, facilityName != null ? facilityName : "Boxora Facility", unitCode, accessPin);
        sendHtmlEmail(toEmail, subject, content);
    }
}
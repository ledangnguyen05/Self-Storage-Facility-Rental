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
import org.springframework.web.util.HtmlUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailServiceImpl implements EmailService {

    private final JavaMailSender mailSender;

    @Value("${spring.mail.username}")
    private String fromEmail;

    @Value("${app.frontend-url}")
    private String frontendUrl;

    // ─────────────────────────────────────────────────────────────────────────
    // 1. Password Reset Email
    // ─────────────────────────────────────────────────────────────────────────
    @Override
    @Async
    public void sendPasswordResetEmail(String toEmail, String fullName, String resetToken) {
        String safeName = escape(fullName != null && !fullName.isBlank() ? fullName : "Quý khách");
        String safeToken = escape(resetToken != null ? resetToken : "");
        String resetLink = resolveUrl("/reset-password?token=" + safeToken);

        String subject = "[Boxora] Yêu cầu đặt lại mật khẩu tài khoản";

        String badge = renderBadge("BẢO MẬT TÀI KHOẢN", "#eff6ff", "#1d4ed8");
        String intro = String.format(
                "Hệ thống Boxora nhận được yêu cầu đặt lại mật khẩu cho tài khoản liên kết với địa chỉ email <strong>%s</strong>.",
                escape(toEmail)
        );
        String alert = renderAlertBox(
                "Thời hạn hiệu lực",
                "Liên kết đặt lại mật khẩu này chỉ có hiệu lực trong vòng <strong>15 phút</strong>. Quý khách vui lòng không chia sẻ liên kết này cho bất kỳ ai.",
                "#fef2f2",
                "#b91c1c",
                "#f87171"
        );
        String button = renderButton("Đặt Lại Mật Khẩu Ngay", resetLink, "#0284c7");
        String note = (resetLink != null && !resetLink.isBlank())
                ? renderSecurityNote("Nếu quý khách không thực hiện yêu cầu này, vui lòng bỏ qua email. Mật khẩu hiện tại của quý khách vẫn được bảo vệ an toàn.")
                : renderSecurityNote("Lưu ý: Cổng web chưa được cấu hình địa chỉ ứng dụng trực tiếp. Quý khách vui lòng liên hệ Ban Quản Trị Boxora để được hỗ trợ đặt lại mật khẩu an toàn.");

        String html = buildMasterTemplate(
                "Đặt Lại Mật Khẩu",
                badge,
                "Đặt Lại Mật Khẩu Tài Khoản",
                "Xin chào <strong>" + safeName + "</strong>,",
                intro,
                "",
                alert,
                button,
                note
        );

        String plainTextLink = (resetLink != null && !resetLink.isBlank())
                ? resetLink
                : "(Cổng web chưa cấu hình liên kết trực tiếp. Vui lòng liên hệ Ban Quản Trị Boxora để được hỗ trợ)";

        String plainText = String.format("""
                BOXORA - HỆ THỐNG KHO TỰ QUẢN THÔNG MINH
                ========================================
                ĐẶT LẠI MẬT KHẨU TÀI KHOẢN

                Xin chào %s,

                Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản Boxora của bạn (%s).
                Liên kết này có hiệu lực trong 15 phút:
                %s

                Nếu bạn không gửi yêu cầu này, vui lòng bỏ qua email. Mật khẩu của bạn vẫn an toàn.

                Trân trọng,
                Đội ngũ Boxora Platform
                """, fullName, toEmail, plainTextLink);

        sendHtmlEmail(toEmail, subject, html, plainText);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Welcome Email
    // ─────────────────────────────────────────────────────────────────────────
    @Override
    @Async
    public void sendWelcomeEmail(String toEmail, String fullName) {
        String safeName = escape(fullName != null && !fullName.isBlank() ? fullName : "Quý khách");
        String loginLink = resolveUrl("/login");

        String subject = "[Boxora] Chào mừng bạn đến với Hệ thống Kho Tự Quản Thông Minh Boxora";

        String badge = renderBadge("TÀI KHOẢN MỚI", "#ecfdf5", "#047857");
        String intro = "Tài khoản của quý khách đã được khởi tạo thành công trên nền tảng Boxora Self-Storage.";

        String details = "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"margin: 16px 0; border: 1px solid #f1f5f9; border-radius: 8px; overflow: hidden;\">"
                + renderDetailRow("Email đăng nhập", escape(toEmail))
                + renderDetailRow("Trạng thái", "<span style=\"color: #047857; font-weight: 700;\">Đã kích hoạt</span>")
                + renderDetailRow("Hệ sinh thái dịch vụ", "Kho tự quản SmartLock IoT • Truy cập linh hoạt 24/7 • Hợp đồng ký số")
                + "</table>";

        String button = renderButton("Đăng Nhập Ngay", loginLink, "#0284c7");
        String note = renderSecurityNote(
                "Quý khách có thể bắt đầu lựa chọn cơ sở kho, đặt chỗ trực tuyến và trải nghiệm nhận kho tự động thông qua ứng dụng Boxora."
        );

        String html = buildMasterTemplate(
                "Chào Mừng Thành Viên Mới",
                badge,
                "Chào Mừng Quý Khách Đến Với Boxora",
                "Kính gửi <strong>" + safeName + "</strong>,",
                intro,
                details,
                "",
                button,
                note
        );

        String plainText = String.format("""
                BOXORA - HỆ THỐNG KHO TỰ QUẢN THÔNG MINH
                ========================================
                CHÀO MỪNG QUÝ KHÁCH ĐẾN VỚI BOXORA

                Kính gửi %s,

                Tài khoản của bạn (%s) đã được tạo thành công trên hệ thống Boxora Self-Storage.
                Đăng nhập nền tảng tại: %s

                Trân trọng,
                Đội ngũ Boxora Platform
                """, fullName, toEmail, loginLink);

        sendHtmlEmail(toEmail, subject, html, plainText);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. Contract Signing OTP (Synchronous)
    // ─────────────────────────────────────────────────────────────────────────
    @Override
    public void sendContractSigningOtp(String toEmail, String otp) {
        String safeOtp = escape(otp != null ? otp : "");
        String subject = "[Boxora] Mã OTP xác thực ký hợp đồng điện tử";

        String badge = renderBadge("MÃ XÁC THỰC KÝ SỐ", "#eff6ff", "#1d4ed8");
        String intro = "Quý khách đang thực hiện ký hợp đồng thuê kho trên hệ thống Boxora. Dưới đây là mã xác thực OTP dùng một lần của quý khách:";

        String highlightBox = renderHighlightBox(
                "MÃ OTP XÁC THỰC (HIỆU LỰC 5 PHÚT)",
                safeOtp,
                "#f0f9ff",
                "#0369a1",
                "#bae6fd"
        );

        String alert = renderAlertBox(
                "Lưu ý bảo mật nghiêm ngặt",
                "Mã OTP này có giá trị xác nhận tương đương chữ ký số của quý khách. Tuyệt đối không chia sẻ mã này cho bất kỳ ai, bao gồm cả nhân viên Boxora.",
                "#fffbeb",
                "#b45309",
                "#fde68a"
        );

        String note = renderSecurityNote(
                "Mã có hiệu lực trong vòng 5 phút kể từ thời điểm gửi. Nếu quý khách không thực hiện thao tác này, vui lòng bỏ qua email."
        );

        String html = buildMasterTemplate(
                "Mã OTP Ký Hợp Đồng",
                badge,
                "Xác Thực Ký Hợp Đồng Điện Tử",
                "Kính gửi Quý khách,",
                intro,
                "",
                highlightBox + alert,
                "",
                note
        );

        String plainText = String.format("""
                BOXORA - HỆ THỐNG KHO TỰ QUẢN THÔNG MINH
                ========================================
                MÃ OTP XÁC THỰC KÝ HỢP ĐỒNG ĐIỆN TỬ

                Kính gửi Quý khách,

                Mã OTP xác thực ký hợp đồng của bạn là: %s
                Mã có hiệu lực trong 5 phút. Tuyệt đối không chia sẻ mã này với bất kỳ ai.

                Trân trọng,
                Đội ngũ Boxora Platform
                """, otp);

        sendHtmlEmail(toEmail, subject, html, plainText);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. Master Key Alert Email (Business Manager & Admin Alert)
    // ─────────────────────────────────────────────────────────────────────────
    @Override
    @Async
    public void sendMasterKeyAlertEmail(String toEmail, String recipientName, String facilityName,
                                        String performedByName, String witnessName,
                                        String category, String severity,
                                        String reason, String documentReference) {
        String safeRecipient = escape(recipientName != null ? recipientName : "Cán bộ quản lý");
        String safeFacility = escape(facilityName != null ? facilityName : "Cơ sở chưa xác định");
        String safeSeverity = severity != null ? severity.toUpperCase() : "NORMAL";

        String sevColor = switch (safeSeverity) {
            case "CRITICAL" -> "#b91c1c";
            case "HIGH" -> "#c2410c";
            default -> "#1d4ed8";
        };
        String sevBg = switch (safeSeverity) {
            case "CRITICAL" -> "#fef2f2";
            case "HIGH" -> "#fff7ed";
            default -> "#eff6ff";
        };

        String subject = String.format("[%s] Cảnh báo an ninh: Master Key được sử dụng tại %s", safeSeverity, safeFacility);

        String badge = renderBadge("CẢNH BÁO AN NINH CƠ SỞ - " + safeSeverity, sevBg, sevColor);
        String intro = String.format(
                "Hệ thống giám sát an ninh Boxora ghi nhận sự kiện mở khóa bằng <strong>Master Key</strong> tại cơ sở <strong>%s</strong>.",
                safeFacility
        );

        StringBuilder detailsBuilder = new StringBuilder();
        detailsBuilder.append("<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"margin: 16px 0; border: 1px solid #f1f5f9; border-radius: 8px; overflow: hidden;\">");
        detailsBuilder.append(renderDetailRow("Cơ sở / Chi nhánh", safeFacility));
        detailsBuilder.append(renderDetailRow("Nhóm tình huống (Category)", escape(category)));
        detailsBuilder.append(renderDetailRow("Mức độ khẩn cấp (Severity)", String.format("<span style=\"color: %s; font-weight: 700;\">%s</span>", sevColor, safeSeverity)));
        detailsBuilder.append(renderDetailRow("Người thực hiện", escape(performedByName)));
        detailsBuilder.append(renderDetailRow("Người làm chứng (Quy chuẩn 2 người)", escape(witnessName)));
        detailsBuilder.append(renderDetailRow("Lý do chi tiết", escape(reason)));
        if (documentReference != null && !documentReference.isBlank()) {
            detailsBuilder.append(renderDetailRow("Số hiệu / Văn bản đính kèm", escape(documentReference)));
        }
        detailsBuilder.append("</table>");

        String alert = renderAlertBox(
                "Yêu cầu đối soát an ninh",
                "Hành động này đã được ghi nhận tự động vào Activity Log hệ thống. Cán bộ quản lý vui lòng kiểm tra đối soát quy trình mở khẩn cấp tại cơ sở.",
                sevBg,
                sevColor,
                sevColor
        );

        String note = renderSecurityNote(
                "Thông báo an ninh nội bộ dành riêng cho Quản lý cơ sở và Ban Điều hành Boxora."
        );

        String html = buildMasterTemplate(
                "Cảnh Báo Master Key",
                badge,
                "Cảnh Báo: Sử Dụng Master Key Khẩn Cấp",
                "Kính gửi <strong>" + safeRecipient + "</strong>,",
                intro,
                detailsBuilder.toString(),
                alert,
                "",
                note
        );

        String plainText = String.format("""
                BOXORA - AN NINH CƠ SỞ
                ======================
                CẢNH BÁO: SỬ DỤNG MASTER KEY (%s)

                Kính gửi %s,

                Hệ thống ghi nhận Master Key vừa được sử dụng tại cơ sở %s.
                - Nhóm tình huống: %s
                - Mức độ: %s
                - Người thực hiện: %s
                - Người làm chứng: %s
                - Lý do: %s
                - Văn bản: %s

                Vui lòng kiểm tra Activity Log trên hệ thống quản lý Boxora.
                """, safeSeverity, recipientName, facilityName, category, safeSeverity, performedByName, witnessName, reason, documentReference != null ? documentReference : "Không");

        sendHtmlEmail(toEmail, subject, html, plainText);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. Contract Signed Confirmation Email
    // ─────────────────────────────────────────────────────────────────────────
    @Override
    @Async
    public void sendContractSignedConfirmationEmail(String toEmail, String fullName, String contractCode, String unitCode, String accessPin, String contractUrl) {
        String safeName = escape(fullName != null ? fullName : "Quý khách");
        String safeCode = escape(contractCode != null ? contractCode : "N/A");
        String safeUnit = escape(unitCode != null ? unitCode : "N/A");

        boolean isRealPin = accessPin != null && accessPin.trim().matches("^\\d{4,8}$");
        boolean isCheckedIn = isRealPin;

        String subject = isCheckedIn
                ? String.format("[Boxora] Hợp đồng thuê kho %s đã có hiệu lực", safeCode)
                : String.format("[Boxora] Xác nhận ký hợp đồng thuê kho %s thành công", safeCode);

        String badge = isCheckedIn
                ? renderBadge("HỢP ĐỒNG CÓ HIỆU LỰC", "#ecfdf5", "#047857")
                : renderBadge("ĐÃ KÝ ĐIỆN TỬ", "#eff6ff", "#1d4ed8");

        String intro = isCheckedIn
                ? String.format("Hợp đồng thuê kho <strong>%s</strong> cho vị trí ngăn kho <strong>%s</strong> đã được ký kết thành công và chính thức có hiệu lực pháp lý.", safeCode, safeUnit)
                : String.format("Hợp đồng thuê kho <strong>%s</strong> cho vị trí ngăn kho <strong>%s</strong> đã được ký kết thành công và đang chờ hoàn tất thủ tục bàn giao, nhận kho tại cơ sở.", safeCode, safeUnit);

        String statusDisplay = isCheckedIn
                ? "<span style=\"color: #047857; font-weight: 700;\">Đã kích hoạt (ACTIVE)</span>"
                : "<span style=\"color: #0284c7; font-weight: 700;\">Đã ký điện tử (Chờ hoàn tất thủ tục nhận kho)</span>";

        String details = "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"margin: 16px 0; border: 1px solid #f1f5f9; border-radius: 8px; overflow: hidden;\">"
                + renderDetailRow("Mã hợp đồng", safeCode)
                + renderDetailRow("Vị trí ngăn kho", "<strong>" + safeUnit + "</strong>")
                + renderDetailRow("Trạng thái", statusDisplay)
                + "</table>";

        String pinBoxLabel = "TRẠNG THÁI MÃ PIN MỞ KHO";
        String pinBoxValue;
        String pinBoxBg;
        String pinBoxText;
        String pinBoxBorder;

        if (isCheckedIn) {
            pinBoxValue = accessPin.trim();
            pinBoxBg = "#f0fdf4";
            pinBoxText = "#15803d";
            pinBoxBorder = "#86efac";
        } else {
            pinBoxValue = "Chưa kích hoạt (Chỉ cấp phát sau khi hoàn tất đối soát đủ 4 điều kiện check-in và bàn giao tại cơ sở)";
            pinBoxBg = "#f8fafc";
            pinBoxText = "#475569";
            pinBoxBorder = "#cbd5e1";
        }

        String highlightBox = renderHighlightBox(
                pinBoxLabel,
                pinBoxValue,
                pinBoxBg,
                pinBoxText,
                pinBoxBorder
        );

        String button = renderButton("Xem Văn Bản Hợp Đồng Đã Ký", contractUrl, "#0284c7");

        String note = isCheckedIn
                ? renderSecurityNote("Quý khách có thể đổi mã PIN bất kỳ lúc nào trên ứng dụng Boxora sau khi nhận kho. Vui lòng bảo mật thông tin mã PIN để bảo vệ tài sản lưu trữ.")
                : renderSecurityNote("Lưu ý: Mã PIN SmartLock sẽ được kích hoạt và cấp phát chính thức sau khi quý khách đến cơ sở Boxora và nhân viên đối soát đạt đủ 4 điều kiện check-in theo quy định.");

        String html = buildMasterTemplate(
                "Xác Nhận Hợp Đồng Thuê Kho",
                badge,
                isCheckedIn ? "Hợp Đồng Thuê Kho Đã Kích Hoạt" : "Hợp Đồng Thuê Kho Ký Kết Thành Công",
                "Kính gửi <strong>" + safeName + "</strong>,",
                intro,
                details,
                highlightBox,
                button,
                note
        );

        String plainText = String.format("""
                BOXORA - HỆ THỐNG KHO TỰ QUẢN THÔNG MINH
                ========================================
                %s

                Kính gửi %s,

                Hợp đồng thuê kho %s cho vị trí kho %s:
                - Trạng thái: %s
                - %s: %s
                %s

                Trân trọng,
                Đội ngũ Boxora Self-Storage
                """,
                isCheckedIn ? "HỢP ĐỒNG THUÊ KHO ĐÃ CÓ HIỆU LỰC" : "XÁC NHẬN KÝ HỢP ĐỒNG THUÊ KHO",
                fullName != null ? fullName : "Quý khách",
                contractCode != null ? contractCode : "N/A",
                unitCode != null ? unitCode : "N/A",
                isCheckedIn ? "Đã kích hoạt (ACTIVE)" : "Đã ký điện tử (Chờ hoàn tất thủ tục nhận kho)",
                pinBoxLabel,
                pinBoxValue,
                contractUrl != null && !contractUrl.isBlank() ? "Xem hợp đồng: " + contractUrl : "");

        sendHtmlEmail(toEmail, subject, html, plainText);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 6. Payment Success Email
    // ─────────────────────────────────────────────────────────────────────────
    @Override
    @Async
    public void sendPaymentSuccessEmail(String toEmail, String fullName, String txnRef, BigDecimal amount, String description) {
        String safeName = escape(fullName != null ? fullName : "Quý khách");
        String safeTxn = escape(txnRef != null ? txnRef : "N/A");
        String safeDesc = escape(description != null ? description : "Thanh toán dịch vụ Boxora");
        String formattedAmount = formatVnd(amount);
        String currentTime = formatDateTime(LocalDateTime.now());

        String subject = String.format("[Boxora] Biên lai xác nhận thanh toán thành công - Mã GD: %s", safeTxn);

        String badge = renderBadge("GIAO DỊCH THÀNH CÔNG", "#ecfdf5", "#047857");
        String intro = "Boxora xác nhận đã nhận được khoản thanh toán thành công của quý khách qua cổng thanh toán trực tuyến.";

        String details = "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"margin: 16px 0; border: 1px solid #f1f5f9; border-radius: 8px; overflow: hidden;\">"
                + renderDetailRow("Mã giao dịch (TxnRef)", "<strong>" + safeTxn + "</strong>")
                + renderDetailRow("Số tiền thanh toán", "<span style=\"color: #047857; font-size: 15px; font-weight: 700;\">" + formattedAmount + "</span>")
                + renderDetailRow("Nội dung thanh toán", safeDesc)
                + renderDetailRow("Thời gian ghi nhận", currentTime)
                + renderDetailRow("Trạng thái", "<span style=\"color: #047857; font-weight: 700;\">ĐÃ THANH TOÁN (PAID)</span>")
                + "</table>";

        String note = renderSecurityNote(
                "Đơn đặt giữ chỗ của quý khách đang được chuyển đến nhân viên tại cơ sở để xếp buồng kho thực tế. Ngay sau khi gán kho, hệ thống sẽ gửi email chứa Hợp đồng hoàn chỉnh đã có mã ô kho cụ thể và mã khóa thông minh IoT 24/7 cho quý khách."
        );

        String html = buildMasterTemplate(
                "Biên Lai Thanh Toán",
                badge,
                "Xác Nhận Thanh Toán Thành Công",
                "Kính gửi <strong>" + safeName + "</strong>,",
                intro,
                details,
                "",
                "",
                note
        );

        String plainText = String.format("""
                BOXORA - HỆ THỐNG KHO TỰ QUẢN THÔNG MINH
                ========================================
                XÁC NHẬN THANH TOÁN THÀNH CÔNG

                Kính gửi %s,

                Boxora xác nhận nhận được khoản thanh toán của bạn:
                - Mã giao dịch: %s
                - Số tiền: %s
                - Nội dung: %s
                - Thời gian: %s
                - Trạng thái: ĐÃ THANH TOÁN (PAID)

                Trân trọng,
                Đội ngũ Boxora Platform
                """, fullName, txnRef, formattedAmount, description, currentTime);

        sendHtmlEmail(toEmail, subject, html, plainText);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 7. Overdue Notice Email
    // ─────────────────────────────────────────────────────────────────────────
    @Override
    @Async
    public void sendOverdueNoticeEmail(String toEmail, String fullName, String contractCode, String unitCode, long daysOverdue, BigDecimal totalDebt, String overdueStage) {
        String safeName = escape(fullName != null ? fullName : "Quý khách");
        String safeCode = escape(contractCode != null ? contractCode : "N/A");
        String safeUnit = escape(unitCode != null ? unitCode : "N/A");
        String formattedDebt = totalDebt != null ? formatVnd(totalDebt) : "Chưa đối soát";

        String stageDesc = switch (overdueStage != null ? overdueStage : "") {
            case "GRACE_PERIOD" -> "Thời gian gia hạn miễn phạt (Grace Period)";
            case "WARNING" -> "Cảnh báo nợ quá hạn - Bắt đầu áp dụng phí phạt trễ";
            case "ACCESS_BLOCKED" -> "Đã đến ngưỡng chính sách thu hồi PIN/QR trong Boxora; trạng thái khóa vật lý chưa được xác minh";
            case "ELIGIBLE_FOR_SEALING" -> "Nguy cơ niêm phong và xử lý tài sản theo hợp đồng";
            default -> escape(overdueStage);
        };

        String subject = String.format("[Boxora] Thông báo nợ cước quá hạn hợp đồng thuê kho %s", safeCode);

        String badge = renderBadge("CÔNG NỢ QUÁ HẠN", "#fef2f2", "#b91c1c");
        String intro = String.format(
                "Hệ thống Boxora ghi nhận hợp đồng thuê kho <strong>%s</strong> (Vị trí kho: <strong>%s</strong>) hiện đã quá hạn thanh toán.",
                safeCode, safeUnit
        );

        String highlightBox = renderHighlightBox(
                totalDebt != null ? "TỔNG CÔNG NỢ CẦN THANH TOÁN" : "SỐ DƯ CHƯA ĐỐI SOÁT",
                formattedDebt,
                "#fef2f2",
                "#b91c1c",
                "#fca5a5"
        );

        String details = "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"margin: 16px 0; border: 1px solid #f1f5f9; border-radius: 8px; overflow: hidden;\">"
                + renderDetailRow("Mã hợp đồng", safeCode)
                + renderDetailRow("Vị trí kho", safeUnit)
                + renderDetailRow("Số ngày quá hạn", "<span style=\"color: #b91c1c; font-weight: 700;\">" + daysOverdue + " ngày</span>")
                + renderDetailRow("Giai đoạn xử lý", stageDesc)
                + "</table>";

        String alert = renderAlertBox(
                "Hướng dẫn xử lý",
                "Quý khách vui lòng đăng nhập Boxora để thanh toán hoặc liên hệ cơ sở nhằm xác nhận trạng thái PIN/QR lưu trong hệ thống và quyền truy cập thực tế. Trạng thái khóa vật lý chưa được Boxora xác minh.",
                "#fef2f2",
                "#b91c1c",
                "#f87171"
        );

        String note = renderSecurityNote(
                "Bộ phận Quản lý Khách hàng Boxora • Thông báo tự động từ hệ thống quản lý công nợ."
        );

        String html = buildMasterTemplate(
                "Thông Báo Quá Hạn",
                badge,
                "Thông Báo Nợ Cước Quá Hạn Thuê Kho",
                "Kính gửi <strong>" + safeName + "</strong>,",
                intro,
                details,
                highlightBox + alert,
                "",
                note
        );

        String plainText = String.format("""
                BOXORA - THÔNG BÁO NỢ CƯỚC QUÁ HẠN
                ===================================
                Kính gửi %s,

                Hợp đồng thuê kho %s (Kho %s) đã quá hạn thanh toán:
                - Số ngày quá hạn: %d ngày
                - Giai đoạn: %s
                - Tổng công nợ: %s

                Vui lòng đăng nhập Boxora để thanh toán và khôi phục quyền truy cập kho.

                Trân trọng,
                Bộ phận Quản lý Khách hàng Boxora
                """, fullName, contractCode, unitCode, daysOverdue, stageDesc, formattedDebt);

        sendHtmlEmail(toEmail, subject, html, plainText);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 8. Sealing Notice Email
    // ─────────────────────────────────────────────────────────────────────────
    @Override
    @Async
    public void sendSealingNoticeEmail(String toEmail, String fullName, String contractCode, String unitCode, String protocolNumber, String sealTagNumber, long overdueDays, BigDecimal totalDebt, String reason) {
        String safeName = escape(fullName != null ? fullName : "Quý khách");
        String safeCode = escape(contractCode != null ? contractCode : "N/A");
        String safeUnit = escape(unitCode != null ? unitCode : "N/A");
        String safeProtocol = escape(protocolNumber != null ? protocolNumber : "N/A");
        String safeSeal = escape(sealTagNumber != null ? sealTagNumber : "N/A");
        String safeReason = escape(reason != null ? reason : "Quá hạn thanh toán hợp đồng");
        String formattedDebt = formatVnd(totalDebt);

        String subject = String.format("[Boxora - KHẨN CẤP] Biên bản niêm phong kho %s do quá hạn thanh toán", safeUnit);

        String badge = renderBadge("BIÊN BẢN KHẨN CẤP", "#fef2f2", "#991b1b");
        String intro = String.format(
                "Do hợp đồng thuê kho <strong>%s</strong> đã quá hạn thanh toán <strong>%d ngày</strong> vượt giới hạn quy định, Ban Quản Lý Boxora đã chính thức lập biên bản và tiến hành niêm phong kho lưu trữ <strong>%s</strong>.",
                safeCode, overdueDays, safeUnit
        );

        String details = "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"margin: 16px 0; border: 1px solid #f1f5f9; border-radius: 8px; overflow: hidden;\">"
                + renderDetailRow("Số biên bản niêm phong", "<strong>" + safeProtocol + "</strong>")
                + renderDetailRow("Vị trí kho", "<strong>" + safeUnit + "</strong>")
                + renderDetailRow("Mã hợp đồng", safeCode)
                + renderDetailRow("Số seri kẹp chì niêm phong", "<span style=\"color: #b91c1c; font-weight: 700;\">" + safeSeal + "</span>")
                + renderDetailRow("Lý do niêm phong", safeReason)
                + renderDetailRow("Tổng công nợ hiện tại", "<span style=\"color: #b91c1c; font-weight: 700;\">" + formattedDebt + "</span>")
                + "</table>";

        String alert = renderAlertBox(
                "CẢNH BÁO: PIN/QR ĐÃ BỊ THU HỒI TRONG BOXORA",
                "PIN/QR lưu trong Boxora đã bị thu hồi. Trạng thái khóa vật lý chưa được xác minh. Quý khách vui lòng thanh toán toàn bộ công nợ hoặc liên hệ Ban Quản Lý cơ sở trong vòng <strong>15 ngày</strong> để được hướng dẫn về hồ sơ niêm phong và các điều khoản hợp đồng.",
                "#fef2f2",
                "#991b1b",
                "#ef4444"
        );

        String note = renderSecurityNote(
                "Bộ phận An ninh & Pháp chế • Boxora Self-Storage Management."
        );

        String html = buildMasterTemplate(
                "Biên Bản Niêm Phong Kho",
                badge,
                "Thông Báo Niêm Phong Kho Lưu Trữ",
                "Kính gửi <strong>" + safeName + "</strong>,",
                intro,
                details,
                alert,
                "",
                note
        );

        String plainText = String.format("""
                BOXORA - BIÊN BẢN NIÊM PHONG KHO KHẨN CẤP
                ==========================================
                Kính gửi %s,

                Hợp đồng %s đã quá hạn %d ngày. Ban Quản Lý Boxora đã niêm phong kho %s:
                - Số biên bản: %s
                - Số kẹp chì: %s
                - Lý do: %s
                - Tổng công nợ: %s

                PIN/QR lưu trong Boxora đã bị thu hồi. Trạng thái khóa vật lý chưa được xác minh. Vui lòng thanh toán hoặc liên hệ Ban Quản Lý trong vòng 15 ngày để được hướng dẫn.

                Trân trọng,
                Bộ phận An ninh & Pháp chế Boxora
                """, fullName, contractCode, overdueDays, unitCode, protocolNumber, sealTagNumber, reason, formattedDebt);

        sendHtmlEmail(toEmail, subject, html, plainText);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 9. Unsealing Notice Email
    // ─────────────────────────────────────────────────────────────────────────
    @Override
    @Async
    public void sendUnsealingNoticeEmail(String toEmail, String fullName, String contractCode, String unitCode, String protocolNumber, String unsealedByName, String unsealReason) {
        String safeName = escape(fullName != null ? fullName : "Quý khách");
        String safeCode = escape(contractCode != null ? contractCode : "N/A");
        String safeUnit = escape(unitCode != null ? unitCode : "N/A");
        String safeProtocol = escape(protocolNumber != null ? protocolNumber : "N/A");
        String safeUnsealedBy = escape(unsealedByName != null ? unsealedByName : "Cán bộ quản lý cơ sở");
        String safeReason = escape(unsealReason != null ? unsealReason : "Đã thanh toán công nợ đầy đủ");
        String currentTime = formatDateTime(LocalDateTime.now());

        String subject = String.format("[Boxora] Thông báo mở niêm phong kho %s thành công", safeUnit);

        String badge = renderBadge("MỞ NIÊM PHONG THÀNH CÔNG", "#ecfdf5", "#047857");
        String intro = String.format(
                "Kho lưu trữ <strong>%s</strong> (Hợp đồng: <strong>%s</strong>) đã được mở niêm phong và khôi phục hoạt động bình thường.",
                safeUnit, safeCode
        );

        String details = "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"margin: 16px 0; border: 1px solid #f1f5f9; border-radius: 8px; overflow: hidden;\">"
                + renderDetailRow("Vị trí kho", "<strong>" + safeUnit + "</strong>")
                + renderDetailRow("Mã hợp đồng", safeCode)
                + renderDetailRow("Số biên bản niêm phong trước", safeProtocol)
                + renderDetailRow("Người thực hiện mở", safeUnsealedBy)
                + renderDetailRow("Lý do mở niêm phong", safeReason)
                + renderDetailRow("Thời gian thực hiện", currentTime)
                + "</table>";

        String alert = renderAlertBox(
                "Khôi phục quyền truy cập",
                "Hồ sơ niêm phong đã được cập nhật trong Boxora. Trạng thái khóa vật lý và quyền sử dụng mã PIN chưa được xác minh; vui lòng liên hệ cơ sở trước khi sử dụng kho.",
                "#f0fdf4",
                "#15803d",
                "#86efac"
        );

        String note = renderSecurityNote(
                "Ban Quản Lý Vận Hành Boxora Self-Storage • Chúc quý khách sử dụng dịch vụ thuận lợi."
        );

        String html = buildMasterTemplate(
                "Mở Niêm Phong Kho Thành Công",
                badge,
                "Thông Báo Mở Niêm Phong Kho Thành Công",
                "Kính gửi <strong>" + safeName + "</strong>,",
                intro,
                details,
                alert,
                "",
                note
        );

        String plainText = String.format("""
                BOXORA - THÔNG BÁO MỞ NIÊM PHONG KHO
                =====================================
                Kính gửi %s,

                Kho %s (Hợp đồng %s) đã được mở niêm phong thành công:
                - Biên bản trước: %s
                - Người thực hiện: %s
                - Lý do: %s
                - Thời gian: %s

                Hồ sơ niêm phong đã được cập nhật trong Boxora. Trạng thái khóa vật lý và PIN chưa được xác minh; vui lòng xác nhận với cơ sở trước khi sử dụng kho.

                Trân trọng,
                Ban Quản Lý Vận Hành Boxora
                """, fullName, unitCode, contractCode, protocolNumber, unsealedByName, unsealReason, currentTime);

        sendHtmlEmail(toEmail, subject, html, plainText);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 10. Refund Status Email
    // ─────────────────────────────────────────────────────────────────────────
    @Override
    @Async
    public void sendRefundStatusEmail(String toEmail, String fullName, String requestCode, String status, BigDecimal amount, String bankName, String bankAccount, String transactionReference, String notes) {
        String safeName = escape(fullName != null ? fullName : "Quý khách");
        String safeCode = escape(requestCode != null ? requestCode : "N/A");
        String formattedAmount = formatVnd(amount);
        String safeBank = escape(bankName != null && !bankName.isBlank() ? bankName : "Ngân hàng thụ hưởng");
        String safeAccount = escape(bankAccount != null && !bankAccount.isBlank() ? bankAccount : "N/A");
        String safeTxn = escape(transactionReference != null && !transactionReference.isBlank() ? transactionReference : "Đang xử lý / Chưa có");
        String safeNotes = escape(notes != null && !notes.isBlank() ? notes : "Không có");

        String statusKey = status != null ? status.toUpperCase() : "PENDING";

        String statusTitle;
        String badgeBg;
        String badgeColor;
        String statusAdvice;

        switch (statusKey) {
            case "PENDING_REVIEW" -> {
                statusTitle = "Đang chờ bộ phận tài chính xét duyệt";
                badgeBg = "#fffbeb";
                badgeColor = "#b45309";
                statusAdvice = "Yêu cầu của quý khách đang được bộ phận tài chính đối soát theo quy định hoàn tiền cơ sở.";
            }
            case "APPROVED" -> {
                statusTitle = "Yêu cầu hoàn tiền đã được phê duyệt";
                badgeBg = "#eff6ff";
                badgeColor = "#1d4ed8";
                statusAdvice = "Yêu cầu đã được phê duyệt. Lệnh chuyển khoản sẽ được kế toán thực hiện theo cam kết SLA.";
            }
            case "PROCESSING_TRANSFER" -> {
                statusTitle = "Đang thực hiện lệnh chuyển khoản ngân hàng";
                badgeBg = "#eff6ff";
                badgeColor = "#1d4ed8";
                statusAdvice = "Lệnh chuyển tiền đang được xử lý qua hệ thống ngân hàng. Quý khách vui lòng chờ thông báo xác nhận.";
            }
            case "AWAITING_CUSTOMER_CONFIRMATION" -> {
                statusTitle = "Đã chuyển tiền - Chờ quý khách xác nhận";
                badgeBg = "#e0e7ff";
                badgeColor = "#3730a3";
                statusAdvice = "Tiền đã được chuyển vào tài khoản của quý khách. Vui lòng kiểm tra tài khoản ngân hàng và đăng nhập Boxora xác nhận 'Tôi đã nhận được tiền' để hoàn tất quy trình.";
            }
            case "RECONCILED" -> {
                statusTitle = "Đã nhận tiền - Đang đối soát sổ phụ";
                badgeBg = "#f0fdfa";
                badgeColor = "#0f766e";
                statusAdvice = "Hệ thống ghi nhận quý khách đã xác nhận nhận tiền và đang hoàn tất bước đối soát sổ phụ.";
            }
            case "COMPLETED", "PROCESSED" -> {
                statusTitle = "Chi trả và đối soát hoàn tất";
                badgeBg = "#ecfdf5";
                badgeColor = "#047857";
                statusAdvice = "Toàn bộ quy trình hoàn tiền, thanh lý nghĩa vụ và đối soát tài chính đã hoàn tất thành công.";
            }
            case "REJECTED" -> {
                statusTitle = "Yêu cầu hoàn tiền bị từ chối";
                badgeBg = "#fef2f2";
                badgeColor = "#b91c1c";
                statusAdvice = "Yêu cầu hoàn tiền không đáp ứng các điều kiện chính sách hiện hành. Quý khách vui lòng liên hệ Ban Quản Lý cơ sở để được hỗ trợ chi tiết.";
            }
            default -> {
                statusTitle = escape(status);
                badgeBg = "#f1f5f9";
                badgeColor = "#334155";
                statusAdvice = "Yêu cầu hoàn tiền đang được cập nhật trên hệ thống.";
            }
        }

        String subject = String.format("[Boxora] Yêu cầu hoàn tiền %s - %s", safeCode, statusTitle);

        String badge = renderBadge("HOÀN TIỀN - " + statusKey, badgeBg, badgeColor);
        String intro = String.format(
                "Yêu cầu hoàn tiền mã <strong>%s</strong> của quý khách hiện có trạng thái: <strong style=\"color: %s;\">%s</strong>.",
                safeCode, badgeColor, statusTitle
        );

        String details = "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"margin: 16px 0; border: 1px solid #f1f5f9; border-radius: 8px; overflow: hidden;\">"
                + renderDetailRow("Mã yêu cầu", "<strong>" + safeCode + "</strong>")
                + renderDetailRow("Trạng thái hiện tại", String.format("<span style=\"color: %s; font-weight: 700;\">%s</span>", badgeColor, statusTitle))
                + renderDetailRow("Số tiền hoàn lại", "<span style=\"color: #047857; font-size: 15px; font-weight: 700;\">" + formattedAmount + "</span>")
                + renderDetailRow("Tài khoản thụ hưởng", safeBank + " - STK: " + safeAccount)
                + renderDetailRow("Mã giao dịch ngân hàng", safeTxn)
                + renderDetailRow("Ghi chú", safeNotes)
                + "</table>";

        String alert = renderAlertBox("Thông tin tiến độ", statusAdvice, badgeBg, badgeColor, badgeColor);

        String note = renderSecurityNote(
                "Bộ phận Kế toán & Tài chính Boxora • Mọi thắc mắc xin vui lòng gửi ticket trên cổng hỗ trợ khách hàng."
        );

        String html = buildMasterTemplate(
                "Trạng Thái Hoàn Tiền",
                badge,
                "Thông Báo Xử Lý Yêu Cầu Hoàn Tiền",
                "Kính gửi <strong>" + safeName + "</strong>,",
                intro,
                details,
                alert,
                "",
                note
        );

        String plainText = String.format("""
                BOXORA - THÔNG BÁO HOÀN TIỀN
                ============================
                Kính gửi %s,

                Yêu cầu hoàn tiền %s có trạng thái: %s
                - Số tiền: %s
                - Ngân hàng: %s - STK: %s
                - Mã GD: %s
                - Ghi chú: %s

                %s

                Trân trọng,
                Bộ phận Kế toán & Tài chính Boxora
                """, fullName, requestCode, statusTitle, formattedAmount, bankName, bankAccount, transactionReference != null ? transactionReference : "N/A", notes != null ? notes : "", statusAdvice);

        sendHtmlEmail(toEmail, subject, html, plainText);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 11. Renewal Reminder Email
    // ─────────────────────────────────────────────────────────────────────────
    @Override
    @Async
    public void sendRenewalReminderEmail(String toEmail, String fullName, String contractCode, String unitCode, LocalDate endDate, long daysRemaining, BigDecimal monthlyFee) {
        String safeName = escape(fullName != null ? fullName : "Quý khách");
        String safeCode = escape(contractCode != null ? contractCode : "N/A");
        String safeUnit = escape(unitCode != null ? unitCode : "N/A");
        String formattedFee = formatVnd(monthlyFee) + "/tháng";
        String formattedEndDate = formatDate(endDate);
        String renewLink = resolveUrl("/portal/contracts");

        boolean isUrgent = daysRemaining <= 3;
        String themeColor = isUrgent ? "#b91c1c" : "#0284c7";
        String themeBg = isUrgent ? "#fef2f2" : "#eff6ff";
        String urgencyTitle = isUrgent
                ? "⚠ [KHẨN CẤP] Hợp đồng thuê kho sắp hết hạn sau " + daysRemaining + " ngày"
                : "Nhắc nhở: Hợp đồng thuê kho sắp đến hạn gia hạn";

        String subject = String.format("[Boxora] %s - %s", urgencyTitle, safeCode);

        String badge = renderBadge(isUrgent ? "HẾT HẠN TRONG " + daysRemaining + " NGÀY" : "NHẮC HẾT HẠN HỢP ĐỒNG", themeBg, themeColor);
        String intro = String.format(
                "Hợp đồng thuê kho <strong>%s</strong> cho vị trí ngăn kho <strong>%s</strong> sẽ chính thức kết thúc vào ngày <strong>%s</strong> (còn <strong>%d ngày</strong>).",
                safeCode, safeUnit, formattedEndDate, daysRemaining
        );

        String details = "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"margin: 16px 0; border: 1px solid #f1f5f9; border-radius: 8px; overflow: hidden;\">"
                + renderDetailRow("Mã hợp đồng", safeCode)
                + renderDetailRow("Vị trí ngăn kho", "<strong>" + safeUnit + "</strong>")
                + renderDetailRow("Ngày kết thúc", formattedEndDate)
                + renderDetailRow("Thời gian còn lại", String.format("<span style=\"color: %s; font-weight: 700;\">%d ngày</span>", themeColor, daysRemaining))
                + renderDetailRow("Đơn giá chu kỳ tiếp theo", formattedFee)
                + "</table>";

        String alert = renderAlertBox(
                "Lợi ích gia hạn kịp thời",
                "Gia hạn trước hạn giúp quý khách giữ nguyên vị trí kho đang thuê, bảo vệ tài sản liên tục và tránh việc hệ thống tự động ngắt quyền truy cập SmartLock khi hợp đồng kết thúc.",
                themeBg,
                themeColor,
                themeColor
        );

        String button = renderButton("Gia Hạn Hợp Đồng Ngay", renewLink, "#0284c7");
        String note = renderSecurityNote(
                "Đội ngũ Chăm sóc Khách hàng Boxora Self-Storage • Quý khách có thể thao tác gia hạn hoàn toàn trực tuyến trên ứng dụng."
        );

        String html = buildMasterTemplate(
                "Nhắc Nhở Gia Hạn Hợp Đồng",
                badge,
                urgencyTitle,
                "Kính gửi <strong>" + safeName + "</strong>,",
                intro,
                details,
                alert,
                button,
                note
        );

        String plainText = String.format("""
                BOXORA - NHẮC HẾT HẠN HỢP ĐỒNG
                ===============================
                Kính gửi %s,

                Hợp đồng %s (Kho %s) sẽ hết hạn vào ngày %s (còn %d ngày).
                - Đơn giá chu kỳ tiếp theo: %s
                Gia hạn hợp đồng tại: %s

                Trân trọng,
                Đội ngũ Chăm sóc Khách hàng Boxora
                """, fullName, contractCode, unitCode, formattedEndDate, daysRemaining, formattedFee, renewLink);

        sendHtmlEmail(toEmail, subject, html, plainText);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 12. Handover Pin Email
    // ─────────────────────────────────────────────────────────────────────────
    @Override
    @Async
    public void sendHandoverPinEmail(String toEmail, String fullName, String unitCode, String bookingCode, String accessPin, String facilityName) {
        String safeName = escape(fullName != null ? fullName : "Quý khách");
        String safeUnit = escape(unitCode != null ? unitCode : "N/A");
        String safeBooking = escape(bookingCode != null ? bookingCode : "N/A");
        String safeFacility = escape(facilityName != null && !facilityName.isBlank() ? facilityName : "Boxora Facility");
        String safePin = escape(accessPin != null ? accessPin : "");

        String subject = String.format("[Boxora] Ghi nhận bàn giao & mã PIN phần mềm %s", safeUnit);

        String badge = renderBadge("BÀN GIAO THÀNH CÔNG", "#ecfdf5", "#047857");
        String intro = String.format(
                "Quá trình đối soát và bàn giao kho cho đơn đặt chỗ <strong>%s</strong> tại cơ sở <strong>%s</strong> đã hoàn tất thành công.",
                safeBooking, safeFacility
        );

        String details = "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"margin: 16px 0; border: 1px solid #f1f5f9; border-radius: 8px; overflow: hidden;\">"
                + renderDetailRow("Mã đơn đặt chỗ", "<strong>" + safeBooking + "</strong>")
                + renderDetailRow("Cơ sở lưu trữ", safeFacility)
                + renderDetailRow("Vị trí ngăn kho", "<span style=\"font-size: 15px; font-weight: 700; color: #0f172a;\">" + safeUnit + "</span>")
                + "</table>";

        String highlightBox = "";
        if (!safePin.isBlank()) {
            highlightBox = renderHighlightBox(
                "MÃ PIN PHẦN MỀM (CHƯA ĐỒNG BỘ KHÓA VẬT LÝ)",
                    safePin,
                    "#f0f9ff",
                    "#0284c7",
                    "#7dd3fc"
            );
        }

        String alert = renderAlertBox(
                "Bảo mật thông tin mở kho",
                "Boxora đã ghi nhận biên bản bàn giao và tạo mã PIN trong phần mềm. Mã này chưa được đồng bộ hoặc xác nhận với khóa SmartLock vật lý. Vui lòng chỉ sử dụng sau khi nhân viên xác nhận đã cài đặt mã tại cơ sở.",
                "#f0fdf4",
                "#15803d",
                "#86efac"
        );

        String note = renderSecurityNote(
                "Trân trọng cảm ơn quý khách đã tin tưởng sử dụng dịch vụ của Boxora Self-Storage."
        );

        String html = buildMasterTemplate(
                "Bàn Giao Kho Thành Công",
                badge,
                "Bàn Giao Ngăn Kho Thành Công",
                "Kính gửi <strong>" + safeName + "</strong>,",
                intro,
                details,
                highlightBox + alert,
                "",
                note
        );

        String plainText = String.format("""
                BOXORA - BÀN GIAO KHO THÀNH CÔNG
                =================================
                Kính gửi %s,

                Đơn đặt chỗ %s tại cơ sở %s đã bàn giao thành công.
                - Vị trí kho: %s
                - Mã PIN phần mềm (chưa xác nhận trên khóa vật lý): %s

                Boxora đã ghi nhận bàn giao và tạo mã PIN trong phần mềm. Mã chưa được đồng bộ hoặc xác nhận với khóa SmartLock vật lý. Chỉ sử dụng sau khi nhân viên xác nhận đã cài đặt mã tại cơ sở.

                Trân trọng,
                Đội ngũ Boxora Self-Storage
                """, fullName, bookingCode, facilityName, unitCode, accessPin);

        sendHtmlEmail(toEmail, subject, html, plainText);
    }

    @Override
    @Async
    public void sendHandoverWithContractEmail(String toEmail, String fullName, String unitCode, String bookingCode, String accessPin, String facilityName, String contractCode, String startDate, String endDate, String rentalFee, String contractUrl) {
        String safeName = escape(fullName != null ? fullName : "Quý khách");
        String safeUnit = escape(unitCode != null ? unitCode : "N/A");
        String safeBooking = escape(bookingCode != null ? bookingCode : "N/A");
        String safeFacility = escape(facilityName != null && !facilityName.isBlank() ? facilityName : "Boxora Facility");
        String safePin = escape(accessPin != null ? accessPin : "");
        String safeContract = escape(contractCode != null ? contractCode : "N/A");
        String safeStart = escape(startDate != null ? startDate : "N/A");
        String safeEnd = escape(endDate != null ? endDate : "N/A");
        String safeFee = escape(rentalFee != null ? rentalFee : "0");
        String resolvedUrl = resolveUrl(contractUrl != null && !contractUrl.isBlank() ? contractUrl : "/my-bookings");

        String subject = String.format("[Boxora] Bàn giao ô kho #%s & Hợp đồng thuê hoàn chỉnh - Đơn %s", safeUnit, safeBooking);

        String badge = renderBadge("BÀN GIAO THÀNH CÔNG • ĐÃ GÁN MÃ KHO", "#ecfdf5", "#047857");
        String intro = String.format(
                "Nhân viên Boxora tại cơ sở <strong>%s</strong> đã hoàn tất xếp buồng kho thực tế cho đơn đặt chỗ <strong>%s</strong> của quý khách. Dưới đây là mã định danh ô kho, mã khóa thông minh IoT 24/7 và văn bản Hợp đồng thuê hoàn chỉnh.",
                safeFacility, safeBooking
        );

        String details = "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"margin: 16px 0; border: 1px solid #f1f5f9; border-radius: 8px; overflow: hidden;\">"
                + renderDetailRow("Mã đơn đặt", "<strong>" + safeBooking + "</strong>")
                + renderDetailRow("Cơ sở lưu trữ", safeFacility)
                + renderDetailRow("Buồng kho vật lý chính thức", "<span style=\"font-size: 16px; font-weight: 800; color: #0284c7;\">#" + safeUnit + "</span>")
                + renderDetailRow("Mã hợp đồng thuê", "<strong>" + safeContract + "</strong>")
                + renderDetailRow("Thời hạn thuê", safeStart + " đến " + safeEnd)
                + renderDetailRow("Trạng thái", "<span style=\"color: #047857; font-weight: 700;\">ĐÃ GÁN KHO & ĐÃ KÝ HỢP ĐỒNG ĐIỆN TỬ</span>")
                + "</table>";

        String highlightBox = "";
        if (!safePin.isBlank()) {
            highlightBox = renderHighlightBox(
                "MÃ KHÓA THÔNG MINH IOT (MÃ PIN TRUY CẬP 24/7)",
                    safePin,
                    "#f0fdf4",
                    "#15803d",
                    "#86efac"
            );
        }

        String contractSummary = "<div style=\"background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;\">"
                + "<h4 style=\"margin: 0 0 10px 0; color: #0f172a; font-size: 14px; font-weight: 700;\">Tóm Tắt Hợp Đồng Thuê Kho Tự Quản</h4>"
                + "<p style=\"margin: 0 0 8px 0; color: #334155; font-size: 12px; line-height: 1.6;\">"
                + "• <strong>Bên cho thuê:</strong> Hệ thống kho tự quản thông minh Boxora (" + safeFacility + ")<br/>"
                + "• <strong>Bên thuê:</strong> " + safeName + " (" + escape(toEmail) + ")<br/>"
                + "• <strong>Vị trí kho thuê:</strong> Buồng kho số <strong>#" + safeUnit + "</strong><br/>"
                + "• <strong>Hiệu lực pháp lý:</strong> Đã ký kết trực tuyến qua hệ thống ký số điện tử DocuSeal, có giá trị pháp lý đầy đủ."
                + "</p>"
                + "</div>";

        String button = renderButton("Xem & Tải Hợp Đồng Hoàn Chỉnh", resolvedUrl, "#0284c7");

        String note = renderSecurityNote(
                "Quý khách có thể sử dụng mã PIN trên hoặc mở khóa thông minh qua Portal khách hàng 24/7. Vui lòng bảo mật thông tin mã PIN để bảo vệ tài sản lưu trữ của quý khách."
        );

        String html = buildMasterTemplate(
                "Bàn Giao Kho & Hợp Đồng Hoàn Chỉnh",
                badge,
                "Bàn Giao Buồng Kho & Hợp Đồng Hoàn Chỉnh",
                "Kính gửi <strong>" + safeName + "</strong>,",
                intro,
                details,
                highlightBox + contractSummary,
                button,
                note
        );

        String plainText = String.format("""
                BOXORA - BÀN GIAO KHO & HỢP ĐỒNG HOÀN CHỈNH
                ===========================================
                Kính gửi %s,

                Đơn đặt chỗ %s tại cơ sở %s đã được nhân viên hoàn tất xếp buồng kho thực tế.
                - Mã buồng kho: #%s
                - Mã hợp đồng: %s
                - Mã khóa thông minh IoT: %s
                - Thời hạn thuê: %s đến %s
                - Xem hợp đồng hoàn chỉnh: %s

                Trân trọng,
                Đội ngũ Boxora Self-Storage
                """, safeName, safeBooking, safeFacility, safeUnit, safeContract, safePin, safeStart, safeEnd, resolvedUrl);

        sendHtmlEmail(toEmail, subject, html, plainText);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 14. Booking Cancellation / Rejection Email
    // ─────────────────────────────────────────────────────────────────────────
    @Override
    @Async
    public void sendBookingCancellationEmail(
            String toEmail,
            String fullName,
            String bookingCode,
            String facilityName,
            String unitCode,
            String reason,
            boolean isRejectedByStaff,
            BigDecimal refundAmount
    ) {
        String safeName = escape(fullName != null && !fullName.isBlank() ? fullName : "Quý khách");
        String safeCode = escape(bookingCode != null ? bookingCode : "N/A");
        String safeFacility = escape(facilityName != null ? facilityName : "Hệ thống Boxora");
        String safeUnit = escape(unitCode != null ? unitCode : "Kho tự quản Boxora");
        String safeReason = escape(reason != null && !reason.isBlank() ? reason : "Không có lý do chi tiết");

        String subject = isRejectedByStaff
                ? String.format("[Boxora] Thông báo từ chối đơn đặt giữ chỗ %s", safeCode)
                : String.format("[Boxora] Xác nhận hủy đơn đặt kho %s", safeCode);

        String badge = isRejectedByStaff
                ? renderBadge("ĐƠN ĐÃ TỪ CHỐI", "#fef2f2", "#b91c1c")
                : renderBadge("ĐÃ HỦY ĐƠN", "#f8fafc", "#475569");

        String title = isRejectedByStaff
                ? "Thông Báo Từ Chối Đơn Đặt Giữ Chỗ"
                : "Xác Nhận Hủy Đơn Đặt Kho Theo Yêu Cầu";

        String intro = isRejectedByStaff
                ? String.format("Boxora rất tiếc phải thông báo: Đơn đặt giữ chỗ mã số <strong>%s</strong> tại cơ sở <strong>%s</strong> của Quý khách hiện chưa thể tiếp nhận.", safeCode, safeFacility)
                : String.format("Hệ thống Boxora xác nhận đơn đặt kho mã số <strong>%s</strong> tại cơ sở <strong>%s</strong> đã được hủy thành công theo yêu cầu của Quý khách.", safeCode, safeFacility);

        String statusDisplay = isRejectedByStaff
                ? "<span style=\"color: #b91c1c; font-weight: 700;\">ĐÃ TỪ CHỐI (CANCELLED)</span>"
                : "<span style=\"color: #475569; font-weight: 700;\">ĐÃ HỦY THEO YÊU CẦU</span>";

        StringBuilder detailsBuilder = new StringBuilder("<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"margin: 16px 0; border: 1px solid #f1f5f9; border-radius: 8px; overflow: hidden;\">");
        detailsBuilder.append(renderDetailRow("Mã đơn đặt kho", "<strong>" + safeCode + "</strong>"));
        detailsBuilder.append(renderDetailRow("Cơ sở tiếp đón", safeFacility));
        detailsBuilder.append(renderDetailRow("Quy cách / Kho", safeUnit));
        detailsBuilder.append(renderDetailRow("Trạng thái", statusDisplay));
        detailsBuilder.append(renderDetailRow(isRejectedByStaff ? "Lý do từ chối" : "Lý do hủy đơn", "<span style=\"color: #b91c1c; font-weight: 600;\">" + safeReason + "</span>"));

        if (refundAmount != null && refundAmount.compareTo(BigDecimal.ZERO) > 0) {
            detailsBuilder.append(renderDetailRow("Số tiền hoàn cọc", "<strong style=\"color: #047857;\">" + formatVnd(refundAmount) + "</strong> (Đang xử lý hoàn cọc)"));
        }
        detailsBuilder.append("</table>");

        String alertBox = renderAlertBox(
                isRejectedByStaff ? "Hỗ trợ đặt lại buồng kho" : "Lưu ý sau khi hủy đơn",
                isRejectedByStaff
                        ? "Nếu Quý khách cần hỗ trợ thêm, muốn thay đổi lịch hẹn hoặc chọn quy cách kho khác, vui lòng liên hệ Hotline <strong>1900-BOXORA</strong> hoặc truy cập website Boxora để thực hiện đặt buồng kho mới."
                        : "Toàn bộ mã PIN và quyền truy cập buồng kho (nếu có) đã được thu hồi an toàn. Quý khách có thể xem lại lịch sử đặt kho bất cứ lúc nào trên ứng dụng Boxora.",
                isRejectedByStaff ? "#fffbeb" : "#f8fafc",
                isRejectedByStaff ? "#b45309" : "#475569",
                isRejectedByStaff ? "#f59e0b" : "#cbd5e1"
        );

        String button = renderButton("Xem Thêm Các Kho Khác", resolveUrl("/"), "#0284c7");
        String note = renderSecurityNote("Bộ phận Quản lý Khách hàng Boxora • Thông báo tự động từ hệ thống quản lý đặt kho.");

        String html = buildMasterTemplate(
                title,
                badge,
                title,
                "Kính gửi <strong>" + safeName + "</strong>,",
                intro,
                detailsBuilder.toString(),
                alertBox,
                button,
                note
        );

        String plainText = String.format("""
                BOXORA - HỆ THỐNG KHO TỰ QUẢN THÔNG MINH
                ========================================
                %s

                Kính gửi %s,

                %s
                - Mã đơn: %s
                - Cơ sở: %s
                - Vị trí/Quy cách: %s
                - Lý do: %s
                %s

                Mọi thắc mắc xin vui lòng liên hệ Hotline 1900-BOXORA hoặc truy cập %s.

                Trân trọng,
                Đội ngũ Quản lý Vận hành Boxora Smart Storage
                """,
                title.toUpperCase(),
                fullName != null ? fullName : "Quý khách",
                isRejectedByStaff ? "Đơn đặt kho của Quý khách chưa thể tiếp nhận:" : "Đơn đặt kho đã được hủy thành công:",
                bookingCode != null ? bookingCode : "N/A",
                facilityName != null ? facilityName : "Boxora",
                unitCode != null ? unitCode : "Kho tự quản",
                reason != null ? reason : "Không có lý do chi tiết",
                (refundAmount != null && refundAmount.compareTo(BigDecimal.ZERO) > 0) ? "- Số tiền hoàn cọc: " + formatVnd(refundAmount) : "",
                frontendUrl != null ? frontendUrl : "https://boxora.vn"
        );

        sendHtmlEmail(toEmail, subject, html, plainText);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 15. Check-in Overdue Reminder Email (sau 24h chưa tiếp nhận)
    // ─────────────────────────────────────────────────────────────────────────
    @Override
    @Async
    public void sendCheckinOverdueReminderEmail(
            String toEmail,
            String fullName,
            String bookingCode,
            String facilityName,
            String facilityAddress,
            String facilityPhone,
            String unitCode,
            LocalDateTime checkInDateTime
    ) {
        String safeName = escape(fullName != null && !fullName.isBlank() ? fullName : "Quý khách");
        String safeCode = escape(bookingCode != null ? bookingCode : "N/A");
        String safeFacility = escape(facilityName != null ? facilityName : "Cơ sở Boxora");
        String safeAddress = escape(facilityAddress != null ? facilityAddress : "Theo thông tin cơ sở Boxora đã đăng ký");
        String safePhone = escape(facilityPhone != null ? facilityPhone : "1900-BOXORA");
        String safeUnit = escape(unitCode != null ? unitCode : "Kho tự quản");
        String checkInStr = checkInDateTime != null
                ? checkInDateTime.format(java.time.format.DateTimeFormatter.ofPattern("HH:mm - dd/MM/yyyy"))
                : "Giờ tiếp đón đã đăng ký";

        String subject = String.format("[Boxora - KHẨN CẤP] Nhắc nhở: Quá hạn 24 giờ tiếp nhận buồng kho %s - Đơn %s", safeUnit, safeCode);

        String badge = renderBadge("QUÁ HẠN 24H TIẾP NHẬN", "#fef3c7", "#d97706");
        String title = "Thông Báo Cần Đến Tiếp Nhận Kho Ngay";
        String intro = String.format(
                "Đơn đặt giữ chỗ buồng kho mã số <strong>%s</strong> tại cơ sở <strong>%s</strong> của Quý khách theo hình thức <strong>Ký giấy &amp; thanh toán tại quầy</strong> đã <strong>quá 24 giờ</strong> kể từ thời gian hẹn check-in (<strong>%s</strong>) nhưng hiện tại vẫn chưa hoàn tất thủ tục tiếp nhận.",
                safeCode, safeFacility, checkInStr
        );

        String details = "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"margin: 16px 0; border: 1px solid #f1f5f9; border-radius: 8px; overflow: hidden;\">"
                + renderDetailRow("Mã đơn đặt kho", "<strong>" + safeCode + "</strong>")
                + renderDetailRow("Cơ sở tiếp đón", "<strong>" + safeFacility + "</strong>")
                + renderDetailRow("Địa chỉ cơ sở", safeAddress)
                + renderDetailRow("Buồng kho đăng ký", "<span style=\"color: #0284c7; font-weight: 700;\">" + safeUnit + "</span>")
                + renderDetailRow("Lịch hẹn check-in ban đầu", "<span style=\"color: #d97706; font-weight: 700;\">" + checkInStr + "</span>")
                + renderDetailRow("Trạng thái", "<span style=\"color: #b45309; font-weight: 700;\">CHƯA TIẾP NHẬN - QUÁ HẠN 24 GIỜ</span>")
                + "</table>";

        String alert = renderAlertBox(
                "YÊU CẦU ĐẾN CƠ SỞ HOÀN TẤT THỦ TỤC &amp; CẢNH BÁO HỦY ĐƠN",
                "Quý khách vui lòng nhanh chóng mang theo <strong>CCCD / Hộ chiếu bản gốc</strong> đến cơ sở <strong>" + safeFacility + "</strong> để nhân viên quầy hướng dẫn làm thủ tục ký hợp đồng và nhận kho.<br/><br/>"
                + "<strong style=\"color: #b91c1c;\">LƯU Ý ĐẶC BIỆT:</strong> Sau thêm <strong>24 giờ tiếp theo</strong> (tổng cộng 48 giờ kể từ lịch hẹn check-in ban đầu), nếu Quý khách vẫn chưa đến cơ sở tiếp nhận, hệ thống sẽ mở quyền <strong>HỦY ĐƠN</strong> cho nhân viên và quản lý cơ sở, buồng kho sẽ được <strong>giải phóng lại trên hệ thống</strong> để phục vụ khách hàng khác có nhu cầu.",
                "#fffbeb",
                "#b45309",
                "#f59e0b"
        );

        String note = renderSecurityNote(
                "Mọi thắc mắc hoặc cần hỗ trợ dời lịch hẹn, Quý khách vui lòng liên hệ Hotline: " + safePhone + " • Đội ngũ CSKH Boxora."
        );

        String html = buildMasterTemplate(
                "Cần Đến Nhận Kho Ngay",
                badge,
                title,
                "Kính gửi <strong>" + safeName + "</strong>,",
                intro,
                details,
                alert,
                renderButton("Xem Chi Tiết Đơn Đặt Kho", resolveUrl("/my-bookings"), "#0284c7"),
                note
        );

        String plainText = String.format("""
                BOXORA - THÔNG BÁO CẦN ĐẾN TIẾP NHẬN KHO NGAY
                =============================================
                Kính gửi %s,

                Đơn đặt giữ chỗ %s tại %s đã QUÁ 24 GIỜ kể từ lịch hẹn check-in (%s) nhưng chưa được tiếp nhận.
                - Mã đơn: %s
                - Cơ sở: %s (%s)
                - Buồng kho: %s
                - Hotline cơ sở: %s

                Quý khách vui lòng mang theo CCCD bản gốc đến cơ sở để hoàn tất nhận buồng kho.
                LƯU Ý: Sau thêm 24 giờ nữa (tổng 48 giờ), nếu Quý khách vẫn chưa đến nhận, đơn sẽ bị HỦY và buồng kho sẽ được giải phóng cho khách hàng khác.

                Trân trọng,
                Đội ngũ Boxora Self-Storage
                """, safeName, safeCode, safeFacility, checkInStr, safeCode, safeFacility, safeAddress, safeUnit, safePhone);

        sendHtmlEmail(toEmail, subject, html, plainText);
    }

    @Override
    @Async
    public void sendBookingCancellationRefundSuccessEmail(
            String toEmail,
            String fullName,
            String bookingCode,
            String requestCode,
            String facilityName,
            BigDecimal refundAmount,
            String bankName,
            String bankAccount,
            String bankAccountName,
            String transactionReference,
            String transferProofUrl,
            String processNotes
    ) {
        String safeName = escape(fullName != null && !fullName.isBlank() ? fullName : "Quý khách");
        String safeBookingCode = escape(bookingCode != null ? bookingCode : "N/A");
        String safeRequestCode = escape(requestCode != null ? requestCode : "N/A");
        String safeFacility = escape(facilityName != null ? facilityName : "Hệ thống Boxora");
        String formattedAmount = formatVnd(refundAmount);
        String safeBank = escape(bankName != null && !bankName.isBlank() ? bankName : "Ngân hàng thụ hưởng");
        String safeAccount = escape(bankAccount != null && !bankAccount.isBlank() ? bankAccount : "N/A");
        String safeAccountName = escape(bankAccountName != null && !bankAccountName.isBlank() ? bankAccountName : safeName);
        String safeTxn = escape(transactionReference != null && !transactionReference.isBlank() ? transactionReference : "Đã chuyển khoản thành công");
        String safeNotes = escape(processNotes != null && !processNotes.isBlank() ? processNotes : "Không có ghi chú thêm");

        String subject = String.format("[Boxora] Xác nhận đã hoàn tiền hủy đơn đặt kho #%s - Thành công", safeBookingCode);

        String badge = renderBadge("ĐÃ HOÀN TIỀN THÀNH CÔNG", "#ecfdf5", "#047857");
        String intro = String.format(
                "Quản lý cơ sở <strong>%s</strong> xác nhận đã hoàn tất chuyển khoản chi trả tiền hoàn cho đơn đặt giữ chỗ mã <strong>#%s</strong> của Quý khách.",
                safeFacility, safeBookingCode
        );

        StringBuilder detailsBuilder = new StringBuilder("<table role='presentation' width='100%' cellpadding='0' cellspacing='0' border='0' style='margin: 16px 0; border: 1px solid #f1f5f9; border-radius: 8px; overflow: hidden;'>");
        detailsBuilder.append(renderDetailRow("Mã đơn đặt chỗ", "<strong>#" + safeBookingCode + "</strong>"));
        detailsBuilder.append(renderDetailRow("Mã yêu cầu hoàn tiền", "<strong>#" + safeRequestCode + "</strong>"));
        detailsBuilder.append(renderDetailRow("Cơ sở xử lý", safeFacility));
        detailsBuilder.append(renderDetailRow("Số tiền hoàn trả", "<span style='color: #047857; font-size: 16px; font-weight: 800;'>" + formattedAmount + "</span>"));
        detailsBuilder.append(renderDetailRow("Ngân hàng thụ hưởng", safeBank));
        detailsBuilder.append(renderDetailRow("Số tài khoản nhận", "<span style='font-family: monospace; font-weight: 700;'>" + safeAccount + "</span>"));
        detailsBuilder.append(renderDetailRow("Tên chủ tài khoản", "<strong>" + safeAccountName + "</strong>"));
        detailsBuilder.append(renderDetailRow("Mã giao dịch / UNC", "<strong style='font-family: monospace; color: #1d4ed8;'>" + safeTxn + "</strong>"));
        detailsBuilder.append(renderDetailRow("Trạng thái", "<span style='color: #047857; font-weight: 700;'>✓ ĐÃ CHUYỂN KHOẢN THÀNH CÔNG</span>"));

        if (transferProofUrl != null && !transferProofUrl.isBlank()) {
            String fullProofUrl = transferProofUrl;
            if (transferProofUrl.startsWith("/uploads/")) {
                String baseUrl = (frontendUrl != null && !frontendUrl.isBlank()) ? frontendUrl.trim().replaceAll("/+$", "") : "http://localhost:8080";
                fullProofUrl = baseUrl + transferProofUrl;
            }
            detailsBuilder.append(renderDetailRow("Chứng từ chuyển tiền", "<a href='" + escape(fullProofUrl) + "' target='_blank' style='color: #1d4ed8; font-weight: 600; text-decoration: underline;'>Xem ảnh ủy nhiệm chi chuyển tiền</a>"));
        }

        if (processNotes != null && !processNotes.isBlank()) {
            detailsBuilder.append(renderDetailRow("Ghi chú đối soát", safeNotes));
        }

        detailsBuilder.append("</table>");

        String alertBox = renderAlertBox(
                "Thông báo giải ngân hoàn tất",
                "Khoản tiền hoàn đã được Quản lý cơ sở giải ngân chuyển khoản về tài khoản ngân hàng của Quý khách. Thời gian tài khoản nhận được tiền phụ thuộc vào hệ thống chuyển tiền liên ngân hàng (thông thường từ 1 - 5 phút với Napas247). Quý khách vui lòng kiểm tra biến động số dư tài khoản ngân hàng.",
                "#ecfdf5",
                "#047857",
                "#10b981"
        );

        String note = renderSecurityNote(
                "Ban Quản Lý Cơ Sở " + safeFacility + " • Nếu Quý khách cần hỗ trợ thêm, vui lòng liên hệ hotline cơ sở hoặc gửi ticket trên cổng hỗ trợ khách hàng Boxora."
        );

        String html = buildMasterTemplate(
                "Xác Nhận Hoàn Tiền Hủy Đơn",
                badge,
                "Xác Nhận Đã Chuyển Tiền Hoàn Đơn Hủy Đặt Chỗ",
                "Kính gửi <strong>" + safeName + "</strong>,",
                intro,
                detailsBuilder.toString(),
                alertBox,
                "",
                note
        );

        String plainText = String.format("""
                BOXORA - XÁC NHẬN ĐÃ HOÀN TIỀN HỦY ĐƠN ĐẶT KHO
                ==============================================
                Kính gửi %s,

                Quản lý cơ sở %s xác nhận đã hoàn tất chuyển khoản chi trả tiền hoàn cho đơn đặt giữ chỗ mã #%s của Quý khách.

                Chi tiết hoàn tiền:
                - Mã đơn đặt chỗ: #%s
                - Mã yêu cầu hoàn tiền: #%s
                - Cơ sở xử lý: %s
                - Số tiền hoàn lại: %s
                - Ngân hàng thụ hưởng: %s
                - Số tài khoản nhận: %s
                - Tên chủ tài khoản: %s
                - Mã giao dịch ngân hàng / UNC: %s
                - Ghi chú: %s

                Khoản tiền hoàn đã được giải ngân về tài khoản của Quý khách. Vui lòng kiểm tra biến động số dư tài khoản ngân hàng.

                Trân trọng,
                Ban Quản Lý Cơ Sở %s - Boxora
                """, safeName, safeFacility, safeBookingCode, safeBookingCode, safeRequestCode, safeFacility, formattedAmount, safeBank, safeAccount, safeAccountName, safeTxn, safeNotes, safeFacility);

        sendHtmlEmail(toEmail, subject, html, plainText);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal Helper Methods & Master Layout Generator
    // ─────────────────────────────────────────────────────────────────────────

    private String escape(String input) {
        if (input == null) return "";
        return input.trim()
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }

    private String formatVnd(BigDecimal amount) {
        if (amount == null) return "0 VND";
        return String.format(Locale.GERMANY, "%,d VND", amount.longValue());
    }

    private String formatDate(LocalDate date) {
        if (date == null) return "N/A";
        return date.format(DateTimeFormatter.ofPattern("dd/MM/yyyy"));
    }

    private String formatDateTime(LocalDateTime dateTime) {
        if (dateTime == null) return "N/A";
        return dateTime.format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss"));
    }

    private String resolveUrl(String path) {
        if (path == null || path.isBlank()) {
            return null;
        }
        if (path.startsWith("http://") || path.startsWith("https://")) {
            return path;
        }
        if (frontendUrl == null || frontendUrl.isBlank()) {
            return null;
        }
        String base = frontendUrl.trim().replaceAll("/+$", "");
        if (!base.startsWith("http://") && !base.startsWith("https://")) {
            return null;
        }
        String cleanPath = path.startsWith("/") ? path : "/" + path;
        return base + cleanPath;
    }

    private String renderBadge(String text, String bgHex, String colorHex) {
        return String.format(
                "<span style=\"display: inline-block; padding: 4px 10px; font-size: 11px; font-weight: 700; color: %s; background-color: %s; border-radius: 9999px; letter-spacing: 0.5px; text-transform: uppercase;\">%s</span>",
                colorHex, bgHex, text
        );
    }

    private String renderDetailRow(String label, String valueHtml) {
        return String.format(
                "<tr>"
                        + "<td style=\"padding: 10px 14px; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 13px; font-weight: 500; width: 40%%; vertical-align: top;\">%s</td>"
                        + "<td style=\"padding: 10px 14px; border-bottom: 1px solid #f1f5f9; color: #0f172a; font-size: 13px; font-weight: 600; vertical-align: top;\">%s</td>"
                        + "</tr>",
                label, valueHtml
        );
    }

    private String renderHighlightBox(String label, String value, String bgHex, String textHex, String borderHex) {
        return String.format(
                "<div style=\"background-color: %s; border: 1px solid %s; border-radius: 8px; padding: 14px 18px; margin: 18px 0; text-align: center;\">"
                        + "<div style=\"font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;\">%s</div>"
                        + "<div style=\"font-size: 24px; font-weight: 800; color: %s; letter-spacing: 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace;\">%s</div>"
                        + "</div>",
                bgHex, borderHex, label, textHex, value
        );
    }

    private String renderAlertBox(String title, String content, String bgHex, String textHex, String borderHex) {
        return String.format(
                "<div style=\"background-color: %s; border-left: 4px solid %s; border-radius: 4px; padding: 14px 16px; margin: 16px 0;\">"
                        + "<div style=\"font-size: 13px; font-weight: 700; color: %s; margin-bottom: 4px;\">%s</div>"
                        + "<div style=\"font-size: 13px; color: #334155; line-height: 1.5;\">%s</div>"
                        + "</div>",
                bgHex, borderHex, textHex, title, content
        );
    }

    private String renderButton(String text, String url, String bgHex) {
        if (url == null || url.isBlank() || (!url.startsWith("http://") && !url.startsWith("https://"))) {
            return "";
        }
        return String.format(
                "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"margin: 22px 0;\">"
                        + "<tr>"
                        + "<td align=\"center\" style=\"background-color: %s; border-radius: 8px;\">"
                        + "<a href=\"%s\" target=\"_blank\" style=\"display: inline-block; padding: 12px 26px; font-size: 13px; font-weight: 700; color: #ffffff; text-decoration: none; border-radius: 8px;\">%s</a>"
                        + "</td>"
                        + "</tr>"
                        + "</table>",
                bgHex, escape(url), escape(text)
        );
    }

    private String renderSecurityNote(String text) {
        return String.format(
                "<div style=\"background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 14px; margin-top: 20px; font-size: 12px; color: #64748b; line-height: 1.5;\">"
                        + "%s"
                        + "</div>",
                text
        );
    }

    private String buildMasterTemplate(
            String metaTitle,
            String badgeHtml,
            String title,
            String greetingHtml,
            String introHtml,
            String detailsTableHtml,
            String middleBoxesHtml,
            String actionButtonHtml,
            String footerNoteHtml
    ) {
        return String.format("""
                <!DOCTYPE html>
                <html lang="vi">
                <head>
                  <meta charset="UTF-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  <title>%s</title>
                </head>
                <body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1e293b;">
                  <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f1f5f9; padding: 24px 12px;">
                    <tr>
                      <td align="center">
                        <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
                          <!-- Header -->
                          <tr>
                            <td style="background-color: #0f172a; padding: 24px 32px; text-align: left; border-bottom: 3px solid #0284c7;">
                              <div style="font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: 3px; line-height: 1.2;">
                                BOXORA<span style="color: #0284c7;">.</span>
                              </div>
                              <div style="font-size: 10px; font-weight: 600; color: #94a3b8; letter-spacing: 1.5px; text-transform: uppercase; margin-top: 4px;">
                                Hệ Thống Kho Tự Quản Thông Minh | Smart Self-Storage
                              </div>
                            </td>
                          </tr>
                          <!-- Body -->
                          <tr>
                            <td style="padding: 28px 32px;">
                              %s
                              <h1 style="font-size: 18px; font-weight: 700; color: #0f172a; margin: 12px 0 16px 0; line-height: 1.4;">%s</h1>
                              <p style="font-size: 14px; color: #334155; line-height: 1.6; margin: 0 0 12px 0;">%s</p>
                              <div style="font-size: 14px; color: #334155; line-height: 1.6;">%s</div>
                              %s
                              %s
                              %s
                              %s
                            </td>
                          </tr>
                          <!-- Footer -->
                          <tr>
                            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 32px; text-align: center;">
                              <div style="font-size: 11px; font-weight: 700; color: #475569; letter-spacing: 0.5px; margin-bottom: 4px;">
                                BOXORA SMART SELF-STORAGE PLATFORM
                              </div>
                              <div style="font-size: 11px; color: #64748b; line-height: 1.5;">
                                Nền tảng kho tự quản thông minh • Kiểm soát truy cập SmartLock IoT 24/7
                              </div>
                              <div style="font-size: 10px; color: #94a3b8; margin-top: 8px; line-height: 1.4;">
                                Email này được gửi tự động từ hệ thống quản lý Boxora. Quý khách vui lòng không phản hồi trực tiếp email này.
                              </div>
                              <div style="font-size: 10px; color: #cbd5e1; margin-top: 4px;">
                                © 2026 Boxora. All rights reserved.
                              </div>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </body>
                </html>
                """,
                metaTitle,
                badgeHtml,
                title,
                greetingHtml,
                introHtml,
                detailsTableHtml != null ? detailsTableHtml : "",
                middleBoxesHtml != null ? middleBoxesHtml : "",
                actionButtonHtml != null ? actionButtonHtml : "",
                footerNoteHtml != null ? footerNoteHtml : ""
        );
    }

    private void sendHtmlEmail(String to, String subject, String htmlContent) {
        sendHtmlEmail(to, subject, htmlContent, null);
    }

    private void sendHtmlEmail(String to, String subject, String htmlContent, String plainTextContent) {
        if (to == null || to.isBlank()) {
            log.warn("Recipient email is empty. Skipping email dispatch.");
            return;
        }
        if (fromEmail == null || fromEmail.isBlank() || !fromEmail.contains("@")) {
            log.warn("SMTP sender address is not configured. Skipping email dispatch to: {}", to);
            return;
        }
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(fromEmail.trim());
            helper.setTo(to.trim());
            helper.setSubject(subject);

            if (plainTextContent != null && !plainTextContent.isBlank()) {
                helper.setText(plainTextContent, htmlContent);
            } else {
                helper.setText(htmlContent, true);
            }

            mailSender.send(message);
            log.info("Email sent successfully to: {}", to);
        } catch (MessagingException e) {
            log.error("Failed to send email to: {}", to, e);
            throw new RuntimeException("Failed to send email", e);
        }
    }

    @Override
    @Async
    public void sendSimpleEmail(String toEmail, String subject, String body) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, false, "UTF-8");
            helper.setFrom(fromEmail);
            helper.setTo(toEmail);
            helper.setSubject(subject);
            helper.setText(body, false);
            mailSender.send(message);
            log.info("Simple email sent successfully to: {}", toEmail);
        } catch (Exception ex) {
            log.error("Failed to send simple email to {}: {}", toEmail, ex.getMessage());
        }
    }
}

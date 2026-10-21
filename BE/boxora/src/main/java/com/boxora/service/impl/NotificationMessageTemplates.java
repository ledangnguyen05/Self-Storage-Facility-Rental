package com.boxora.service.impl;

import com.boxora.util.VndFormat;
import org.springframework.web.util.HtmlUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

/** Texts of the renewal reminders. Plain sentences, no emoji. */
final class NotificationMessageTemplates {

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private NotificationMessageTemplates() {
    }

    static String renewalSubject(String contractCode, long daysRemaining) {
        return daysRemaining <= 3
                ? "[Boxora] Khẩn: hợp đồng thuê kho " + contractCode + " hết hạn sau " + Math.max(daysRemaining, 0) + " ngày"
                : "[Boxora] Nhắc gia hạn hợp đồng thuê kho " + contractCode;
    }

    static String renewalTitle(String contractCode, long daysRemaining) {
        return (daysRemaining <= 3 ? "Khẩn: hợp đồng sắp hết hạn " : "Nhắc gia hạn hợp đồng ") + contractCode;
    }

    static String renewalContent(String contractCode, String unitCode, long daysRemaining) {
        return "Hợp đồng thuê kho " + contractCode + " (vị trí: " + unitCode + ") sẽ hết hạn sau "
                + daysRemaining + " ngày. Vui lòng gia hạn trên hệ thống.";
    }

    static String renewalHtml(String customerName, String contractCode, String unitCode, LocalDate endDate,
                              long daysRemaining, BigDecimal monthlyFee) {
        String color = daysRemaining <= 3 ? "#B42318" : "#B54708";
        String endText = endDate != null ? endDate.format(DATE) : "—";
        String fee = monthlyFee != null ? VndFormat.format(monthlyFee) + "/tháng" : "—";
        return """
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                    <h2 style="color: %s; margin-top: 0;">Hợp đồng thuê kho sắp hết hạn</h2>
                    <p>Kính gửi <strong>%s</strong>,</p>
                    <p>Hợp đồng thuê kho <strong>%s</strong> cho kho <strong>%s</strong> sẽ hết hạn vào ngày <strong>%s</strong> (còn <strong>%d ngày</strong>).</p>
                    <div style="background-color: #F8FAFC; border-left: 4px solid %s; padding: 14px; margin: 16px 0;">
                        <p style="margin: 4px 0;">Vị trí kho: <strong>%s</strong></p>
                        <p style="margin: 4px 0;">Ngày kết thúc hợp đồng: <strong>%s</strong></p>
                        <p style="margin: 4px 0;">Giá thuê kỳ tiếp theo: <strong>%s</strong></p>
                    </div>
                    <p>Để không gián đoạn quyền truy cập kho, vui lòng đăng nhập Boxora và chọn <strong>Gia hạn hợp đồng</strong> trước ngày hết hạn.</p>
                    <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;"/>
                    <p style="color: #94A3B8; font-size: 12px;">Đội ngũ chăm sóc khách hàng Boxora</p>
                </div>
                """.formatted(color, esc(customerName), esc(contractCode), esc(unitCode), endText, Math.max(daysRemaining, 0),
                color, esc(unitCode), endText, esc(fee));
    }

    private static String esc(String value) {
        return HtmlUtils.htmlEscape(value == null ? "" : value);
    }
}

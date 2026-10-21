package com.boxora.service.impl;

import org.springframework.web.util.HtmlUtils;

/** Texts of the handover notifications. The in-app text never contains the PIN; only the email does. */
final class HandoverMessageTemplates {

    private HandoverMessageTemplates() {
    }

    static String pinEmailSubject(String unitCode) {
        return "[Boxora] Thông tin bàn giao kho và mã PIN mở kho " + unitCode;
    }

    static String pinEmailHtml(String customerName, String bookingCode, String facilityName, String unitCode, String pin) {
        return """
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                    <h2 style="color: #0284c7; margin-top: 0;">Bàn giao kho thành công</h2>
                    <p>Kính gửi <strong>%s</strong>,</p>
                    <p>Quá trình nghiệm thu và bàn giao kho cho đơn đặt chỗ <strong>%s</strong> tại cơ sở <strong>%s</strong> đã hoàn tất.</p>
                    <div style="background-color: #F8FAFC; border-left: 4px solid #0284c7; padding: 14px; margin: 18px 0; border-radius: 4px;">
                        <h4 style="margin: 0 0 8px 0; color: #1E293B;">Thông tin truy cập kho:</h4>
                        <p style="margin: 4px 0;">Vị trí kho: <strong style="font-size: 16px; color: #0f172a;">%s</strong></p>
                        <p style="margin: 4px 0;">Mã PIN mở khóa: <strong style="font-size: 22px; color: #0284c7; letter-spacing: 3px;">%s</strong></p>
                    </div>
                    <p style="color: #64748B; font-size: 13px;">Vui lòng không chia sẻ mã PIN này. Bạn có thể xem và đổi mã PIN trong mục Mã truy cập trên cổng thông tin Boxora bất cứ lúc nào.</p>
                    <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;"/>
                    <p style="color: #94A3B8; font-size: 12px;">Trân trọng, Đội ngũ Boxora</p>
                </div>
                """.formatted(
                esc(customerName), esc(bookingCode), esc(facilityName), esc(unitCode), esc(pin));
    }

    static String inAppTitle(String unitCode) {
        return "Bàn giao kho " + unitCode;
    }

    /** No PIN here: the customer reads it in "Mã truy cập" (or the handover email). */
    static String inAppContent(String customerName, String unitCode, String facilityName) {
        return "Kính gửi " + customerName + ", kho " + unitCode + " tại " + facilityName
                + " đã được bàn giao và mã PIN đã được cấp. Xem mã trong mục Mã truy cập của bạn.";
    }

    private static String esc(String value) {
        return HtmlUtils.htmlEscape(value == null ? "" : value);
    }
}

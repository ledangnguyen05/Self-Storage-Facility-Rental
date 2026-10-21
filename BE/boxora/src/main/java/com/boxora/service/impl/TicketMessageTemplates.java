package com.boxora.service.impl;

/** Texts of the in-app notifications a customer gets about their support ticket. Plain sentences, no internal codes. */
final class TicketMessageTemplates {

    private static final int MAX_TITLE_IN_TEXT = 80;

    private TicketMessageTemplates() {
    }

    static String takenTitle(String ticketCode) {
        return "Phiếu hỗ trợ " + ticketCode + " đã được tiếp nhận";
    }

    static String takenContent(String handlerName, String ticketTitle, String facilityName) {
        String who = handlerName != null && !handlerName.isBlank() ? handlerName : "Nhân viên cơ sở";
        String where = facilityName != null && !facilityName.isBlank() ? " tại " + facilityName : "";
        return who + " đang xử lý phiếu \"" + shorten(ticketTitle) + "\"" + where
                + ". Bạn sẽ nhận thông báo khi phiếu được xử lý xong.";
    }

    static String resolvedTitle(String ticketCode) {
        return "Phiếu hỗ trợ " + ticketCode + " đã được xử lý";
    }

    static String resolvedContent(String ticketTitle) {
        return "Phiếu \"" + shorten(ticketTitle) + "\" đã được xử lý xong. Hãy mở phiếu để xem kết quả và xác nhận đóng phiếu; "
                + "nếu sự cố chưa được khắc phục, bạn có thể yêu cầu xử lý lại.";
    }

    private static String shorten(String text) {
        String value = text == null ? "" : text.trim();
        return value.length() > MAX_TITLE_IN_TEXT ? value.substring(0, MAX_TITLE_IN_TEXT - 1).trim() + "…" : value;
    }
}

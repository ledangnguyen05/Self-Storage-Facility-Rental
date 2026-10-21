package com.boxora.util;

import java.util.Map;

/**
 * Vietnamese meaning of the VNPay gateway result ({@code vnp_ResponseCode} / {@code vnp_TransactionStatus}), so a
 * failed payment tells the customer why it failed instead of a generic message.
 */
public final class VNPayResponseCodes {

    private static final Map<String, String> RESPONSE_CODES = Map.ofEntries(
            Map.entry("07", "Ngân hàng đã trừ tiền nhưng giao dịch bị nghi ngờ gian lận hoặc bất thường"),
            Map.entry("09", "Thẻ hoặc tài khoản chưa đăng ký dịch vụ Internet Banking tại ngân hàng"),
            Map.entry("10", "Xác thực thông tin thẻ hoặc tài khoản không đúng quá 3 lần"),
            Map.entry("11", "Đã hết thời gian chờ thanh toán"),
            Map.entry("12", "Thẻ hoặc tài khoản đang bị khóa"),
            Map.entry("13", "Mật khẩu xác thực giao dịch (OTP) không đúng"),
            Map.entry("24", "Bạn đã hủy giao dịch"),
            Map.entry("51", "Tài khoản không đủ số dư để thanh toán"),
            Map.entry("65", "Tài khoản đã vượt quá hạn mức giao dịch trong ngày"),
            Map.entry("75", "Ngân hàng thanh toán đang bảo trì"),
            Map.entry("79", "Nhập sai mật khẩu thanh toán quá số lần quy định"),
            Map.entry("99", "Cổng thanh toán báo lỗi không xác định"));

    private static final Map<String, String> TRANSACTION_STATUSES = Map.of(
            "01", "Giao dịch chưa hoàn tất",
            "02", "Giao dịch bị lỗi",
            "04", "Ngân hàng đã trừ tiền nhưng giao dịch chưa thành công tại VNPay",
            "05", "VNPay đang xử lý hoàn tiền cho giao dịch",
            "06", "VNPay đã gửi yêu cầu hoàn tiền sang ngân hàng",
            "07", "Giao dịch bị nghi ngờ gian lận",
            "09", "Giao dịch hoàn trả bị từ chối");

    private VNPayResponseCodes() {
    }

    /** Reason of a failed payment, or null when the gateway reported success (or nothing is known). */
    public static String failureReason(String responseCode, String transactionStatus) {
        if (responseCode != null && !responseCode.isBlank() && !"00".equals(responseCode)) {
            String text = RESPONSE_CODES.getOrDefault(responseCode, "Cổng thanh toán từ chối giao dịch");
            return text + " (mã " + responseCode + ").";
        }
        if (transactionStatus != null && !transactionStatus.isBlank() && !"00".equals(transactionStatus)) {
            String text = TRANSACTION_STATUSES.getOrDefault(transactionStatus, "Giao dịch chưa thành công");
            return text + " (trạng thái " + transactionStatus + ").";
        }
        return null;
    }

    /**
     * True when the customer's bank may have taken the money although the payment is not successful in Boxora
     * (the result page then tells them to keep the receipt and contact support instead of "you were not charged").
     */
    public static boolean mayHaveBeenCharged(String responseCode, String transactionStatus) {
        return "07".equals(responseCode) || "04".equals(transactionStatus) || "07".equals(transactionStatus);
    }
}

package com.boxora.util;

import com.boxora.enums.PaymentType;
import com.boxora.enums.RentalContractStatus;

/**
 * Vietnamese wording of the codes that appear in handover, payment and return messages the backend composes (audit
 * entries, prerequisite lists), so no enum constant is shown to staff. Lower case, ready to sit inside a sentence.
 */
public final class HandoverLabels {

    private HandoverLabels() {
    }

    public static String paymentType(PaymentType type) {
        if (type == null) {
            return "chưa xác định";
        }
        return switch (type) {
            case BOOKING_PAYMENT -> "thanh toán đặt kho";
            case DEPOSIT -> "tiền cọc";
            case RENTAL_FEE -> "tiền thuê";
            case RENEWAL_FEE -> "phí gia hạn";
            case EXTRA_CHARGE -> "phụ phí";
        };
    }

    /** CASH / BANK_TRANSFER / VNPAY...; an unknown method is returned unchanged. */
    public static String paymentMethod(String method) {
        if (method == null || method.isBlank()) {
            return "chưa xác định";
        }
        return switch (method.trim().toUpperCase()) {
            case "CASH" -> "tiền mặt";
            case "BANK_TRANSFER" -> "chuyển khoản";
            case "VNPAY" -> "VNPay";
            case "MOMO" -> "MoMo";
            default -> method.trim();
        };
    }

    public static String contractStatus(RentalContractStatus status) {
        if (status == null) {
            return "chưa xác định";
        }
        return switch (status) {
            case DRAFT -> "bản nháp";
            case PENDING_SIGNATURE -> "chờ ký";
            case PENDING_VERIFICATION -> "chờ xác minh";
            case PENDING_ACTIVATION -> "chờ kích hoạt";
            case ACTIVE -> "đang hiệu lực";
            case OVERDUE -> "quá hạn";
            case OVERDUE_LOCKED -> "khóa do quá hạn";
            case EXPIRED -> "hết hạn";
            case TERMINATED -> "đã chấm dứt";
            case CANCELLED -> "đã hủy";
        };
    }

    /** Review state of a return settlement: PENDING_ACCOUNTING_REVIEW / AUTO_REFUND_APPROVED. */
    public static String refundReviewStatus(String status) {
        if (status == null || status.isBlank()) {
            return "chưa xác định";
        }
        return switch (status.trim().toUpperCase()) {
            case "PENDING_ACCOUNTING_REVIEW" -> "chờ kế toán duyệt";
            case "AUTO_REFUND_APPROVED" -> "tự động duyệt hoàn tiền";
            default -> status.trim();
        };
    }

    /** Outcome of a customer debt: COLLECTED / WRITTEN_OFF. */
    public static String debtStatus(String status) {
        if (status == null || status.isBlank()) {
            return "chưa xác định";
        }
        return switch (status.trim().toUpperCase()) {
            case "OPEN" -> "đang nợ";
            case "COLLECTED" -> "đã thu";
            case "WRITTEN_OFF" -> "đã xóa nợ";
            default -> status.trim();
        };
    }
}

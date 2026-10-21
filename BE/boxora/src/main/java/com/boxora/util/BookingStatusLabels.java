package com.boxora.util;

import com.boxora.enums.BookingStatus;

/**
 * Vietnamese names of booking statuses for messages the backend composes, so an enum constant never reaches a person.
 * The wording matches the web app's status labels.
 */
public final class BookingStatusLabels {

    private BookingStatusLabels() {
    }

    /** "đang thuê", "đã hủy", ... in lower case, ready to sit inside a sentence. */
    public static String of(BookingStatus status) {
        if (status == null) {
            return "chưa xác định";
        }
        return switch (status) {
            case PENDING_APPROVAL -> "chờ duyệt";
            case PENDING_PAYMENT -> "chờ thanh toán";
            case CONFIRMED -> "đã xác nhận";
            case ACTIVE -> "đang thuê";
            case CHECKOUT_REQUESTED -> "yêu cầu trả kho";
            case INSPECTED -> "đã nghiệm thu";
            case COMPLETED -> "hoàn tất";
            case CANCELLED -> "đã hủy";
            case OVERDUE -> "quá hạn";
        };
    }
}

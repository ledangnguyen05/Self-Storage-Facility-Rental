package com.boxora.service;

import java.math.BigDecimal;

/**
 * Giá trị mặc định của chính sách cơ sở khi cơ sở chưa có chính sách đang áp dụng.
 *
 * <p>Đây là nơi DUY NHẤT trong backend khai báo các con số mặc định này; frontend phản chiếu lại trong
 * {@code utils/facilityPolicyDefaults.ts}. Các giá trị khớp với seed V5 và SRS (BR-RULE-001, 002, 003, 004, 012, 015).
 */
public final class FacilityPolicyDefaults {

    private FacilityPolicyDefaults() {
    }

    /** BR-RULE-002: tiền cọc bằng 100% tiền thuê một tháng. */
    public static final double DEPOSIT_PERCENTAGE = 100.0;
    public static final int RENEWAL_WINDOW_DAYS = 3;
    /** BR-RULE-001: thời hạn thuê tối thiểu 1 tháng. */
    public static final int MINIMUM_RENTAL_MONTHS = 1;

    public static final int HOLD_GRACE_HOURS = 24;
    public static final int MAX_HOLD_DAYS = 14;

    /** BR-RULE-004: hủy trước 48 giờ hoàn 100%, từ 24 đến 48 giờ hoàn 50%. */
    public static final int CANCELLATION_FULL_REFUND_HOURS = 48;
    public static final int CANCELLATION_PARTIAL_REFUND_HOURS = 24;
    public static final double CANCELLATION_PARTIAL_REFUND_PERCENT = 50.0;

    public static final int RETURN_NOTICE_DAYS = 0;
    /** BR-RULE-015: hoàn cọc trong tối đa 5 ngày làm việc. */
    public static final int DEPOSIT_REFUND_SLA_DAYS = 5;

    /** Một mức phí quá hạn mặc định cho toàn hệ thống (trước đây có nơi dùng 50.000, nơi dùng 100.000). */
    public static final BigDecimal DAILY_LATE_FEE = new BigDecimal("50000");
    public static final int OVERDUE_GRACE_DAYS = 1;
    /** BR-RULE-012: +3 ngày khóa PIN, +7 ngày niêm phong. */
    public static final int OVERDUE_ACCESS_DISABLE_DAYS = 3;
    public static final int OVERDUE_SEALING_DAYS = 7;
}

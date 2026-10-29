package com.boxora.dto.response;

import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BookingCancellationPreviewResponse {

    private UUID bookingId;
    private String bookingCode;
    private String unitCode;
    private LocalDate startDate;
    private BigDecimal depositPaid;
    private BigDecimal totalRentalFee;

    /**
     * Thời điểm đặt kho làm căn cứ tính chính sách hủy (booking.createdAt).
     */
    private java.time.LocalDateTime bookingDateTime;

    /**
     * Số giờ đã trôi qua kể từ thời điểm đặt kho.
     */
    private long hoursSinceBooking;

    /**
     * Thời điểm nhận kho làm căn cứ tính chính sách (từ expectedCheckInAt hoặc giờ mở cửa ngày bắt đầu thuê).
     */
    private java.time.LocalDateTime checkInDateTime;

    /**
     * Số giờ còn lại trước thời điểm nhận kho.
     * Âm nếu đã qua thời điểm nhận kho.
     */
    private long hoursUntilCheckin;

    /**
     * Nhãn hiển thị thời gian kể từ lúc đặt kho nhẹ nhàng, trung tính cho giao diện người dùng.
     */
    private String timeRemainingLabel;

    /**
     * Mốc hoàn tiền áp dụng:
     * - STAGE_1_FULL_REFUND: Trong vòng 24h kể từ khi đặt kho (Hoàn 100%)
     * - STAGE_2_PARTIAL_REFUND: Trong khoảng 24h - 48h kể từ khi đặt kho (Hoàn 70%)
     * - STAGE_3_OVER_48H_REFUND: Quá 48h kể từ khi đặt kho (Hoàn 50%)
     * - STAGE_PENDING_NO_PAYMENT: Chưa thanh toán cọc
     */
    private String milestoneStage;

    /** Tỷ lệ hoàn tiền: 100.0, 50.0 hoặc 0.0 */
    private double refundPercentage;

    /** Số tiền cọc được hoàn trả dự kiến */
    private BigDecimal refundAmount;

    /** Số tiền phạt / khấu trừ giữ lại */
    private BigDecimal penaltyAmount;

    /** Mô tả chi tiết chính sách hoàn tiền áp dụng */
    private String policyDescription;

    /** Có phát sinh hoàn tiền hay không (refundAmount > 0) */
    private boolean refundable;
}


package com.boxora.dto.response;

import lombok.*;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Doanh thu của một cơ sở trong kỳ báo cáo (cơ sở = null nghĩa là các khoản thanh toán chưa gắn được với cơ sở nào).
 *
 * <p>Quy ước số liệu:
 * <ul>
 *   <li>{@code collectedAmount}: tổng tiền đã thu (payment PAID) trong kỳ;</li>
 *   <li>{@code refundedAmount}: tổng tiền đã hoàn trả khách (payment REFUNDED) trong kỳ;</li>
 *   <li>{@code totalRevenue}: doanh thu thực thu = collectedAmount - refundedAmount;</li>
 *   <li>{@code depositRevenue + rentalFeeRevenue + renewalFeeRevenue + extraChargeRevenue = collectedAmount}.
 *       Khoản BOOKING_PAYMENT (tháng đầu + cọc khi đặt kho) được tách theo tiền cọc của booking;</li>
 *   <li>{@code pendingRefundAmount}: tiền hoàn đang chờ xử lý, chưa trừ vào doanh thu.</li>
 * </ul>
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FacilityRevenueResponse {
    private UUID facilityId;
    private String facilityName;
    private BigDecimal totalRevenue;
    private BigDecimal collectedAmount;
    private BigDecimal refundedAmount;
    private BigDecimal pendingRefundAmount;
    private BigDecimal depositRevenue;
    private BigDecimal rentalFeeRevenue;
    private BigDecimal renewalFeeRevenue;
    private BigDecimal extraChargeRevenue;
    /** Số giao dịch thu tiền (PAID) trong kỳ. */
    private Long paymentCount;
}

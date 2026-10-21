package com.boxora.dto.response;

import lombok.*;

import java.math.BigDecimal;
import java.util.Map;

/** Doanh thu một tháng (theo giờ máy chủ), tính theo thời điểm thanh toán. */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MonthlyRevenueResponse {
    /** Tháng dạng {@code yyyy-MM}. */
    private String month;
    /** Tiền đã thu (PAID) trong tháng. */
    private BigDecimal collectedAmount;
    /** Tiền đã hoàn khách (REFUNDED) trong tháng. */
    private BigDecimal refundedAmount;
    /** collectedAmount - refundedAmount. */
    private BigDecimal netAmount;
    /** Số giao dịch thu tiền trong tháng. */
    private long paymentCount;
    /** Tiền đã thu theo loại thanh toán (khóa là tên {@code PaymentType}, đủ cả 5 loại). */
    private Map<String, BigDecimal> collectedByType;
}

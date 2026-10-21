package com.boxora.dto.response;

import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/** Xu hướng doanh thu theo tháng của kỳ báo cáo được chọn (đã lọc ở máy chủ). */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RevenueTrendResponse {
    private LocalDate fromDate;
    private LocalDate toDate;
    /** Các tháng liên tục theo thứ tự tăng dần, tháng không phát sinh vẫn có mặt với giá trị 0. */
    private List<MonthlyRevenueResponse> months;
    private BigDecimal totalCollected;
    private BigDecimal totalRefunded;
    private BigDecimal totalNet;
    private long totalPaymentCount;
}

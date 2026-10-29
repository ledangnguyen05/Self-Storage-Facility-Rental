package com.boxora.dto.response;

import lombok.*;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SystemRevenueSummaryResponse {
    private BigDecimal totalRevenue; // Legacy field preserved
    private BigDecimal netRevenue; // KPI 1: Tổng doanh thu thuần (không tính cọc, giữ chỗ)
    private BigDecimal totalCashIn; // KPI 2: Tổng tiền thực thu (mọi khoản đã thu)
    private BigDecimal rentalRevenue; // KPI 3: Doanh thu tiền thuê kho (thuê + gia hạn)
    private BigDecimal depositRevenue;
    private BigDecimal rentalFeeRevenue;
    private BigDecimal renewalFeeRevenue;
    private BigDecimal extraChargeRevenue;
    private BigDecimal bookingPaymentRevenue;
    private BigDecimal totalOverdueDebt; // KPI 4: Công nợ phải thu quá hạn
    private BigDecimal depositsHeld; // KPI 5: Tiền cọc đang giữ còn phải quyết toán
    private BigDecimal refundedAmount; // KPI 6: Số tiền hoàn thành công trong kỳ
    private BigDecimal pendingRefundAmount; // KPI 6: Số tiền hoàn đang chờ xử lý
    private Long pendingReconciliationCount; // KPI 6: Số giao dịch chờ đối soát
    private Long paymentCount;

    // 7-parameter constructor for JPQL PaymentRepository.sumSystemRevenue
    public SystemRevenueSummaryResponse(
            BigDecimal totalRevenue,
            BigDecimal depositRevenue,
            BigDecimal rentalFeeRevenue,
            BigDecimal renewalFeeRevenue,
            BigDecimal extraChargeRevenue,
            BigDecimal bookingPaymentRevenue,
            Long paymentCount
    ) {
        this.totalRevenue = totalRevenue;
        this.depositRevenue = depositRevenue;
        this.rentalFeeRevenue = rentalFeeRevenue;
        this.renewalFeeRevenue = renewalFeeRevenue;
        this.extraChargeRevenue = extraChargeRevenue;
        this.bookingPaymentRevenue = bookingPaymentRevenue;
        this.paymentCount = paymentCount;
    }
}

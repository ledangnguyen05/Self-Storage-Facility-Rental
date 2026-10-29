package com.boxora.dto.response;

import lombok.*;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FacilityRevenueResponse {
    private UUID facilityId;
    private String facilityName;
    private BigDecimal totalRevenue;
    private BigDecimal netRevenue;
    private BigDecimal totalCashIn;
    private BigDecimal rentalRevenue;
    private BigDecimal depositRevenue;
    private BigDecimal rentalFeeRevenue;
    private BigDecimal renewalFeeRevenue;
    private BigDecimal extraChargeRevenue;
    private BigDecimal bookingPaymentRevenue;
    private BigDecimal totalOverdueDebt;
    private BigDecimal depositsHeld;
    private BigDecimal refundedAmount;
    private BigDecimal pendingRefundAmount;
    private Long paymentCount;

    // 9-parameter constructor for JPQL PaymentRepository.sumRevenueByFacility
    public FacilityRevenueResponse(
            UUID facilityId,
            String facilityName,
            BigDecimal totalRevenue,
            BigDecimal depositRevenue,
            BigDecimal rentalFeeRevenue,
            BigDecimal renewalFeeRevenue,
            BigDecimal extraChargeRevenue,
            BigDecimal bookingPaymentRevenue,
            Long paymentCount
    ) {
        this.facilityId = facilityId;
        this.facilityName = facilityName;
        this.totalRevenue = totalRevenue;
        this.depositRevenue = depositRevenue;
        this.rentalFeeRevenue = rentalFeeRevenue;
        this.renewalFeeRevenue = renewalFeeRevenue;
        this.extraChargeRevenue = extraChargeRevenue;
        this.bookingPaymentRevenue = bookingPaymentRevenue;
        this.paymentCount = paymentCount;
    }
}

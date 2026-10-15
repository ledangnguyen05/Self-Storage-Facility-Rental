package com.boxora.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PricingQuoteResponse {

    private UUID storageUnitId;
    private String unitCode;
    private String unitTypeName;
    private UUID facilityId;
    private String facilityName;

    private Integer rentalMonths;
    private LocalDate startDate;
    private LocalDate endDate;

    /** Giá thuê niêm yết theo tháng */
    private BigDecimal monthlyRate;

    /** Tổng tiền thuê cơ bản (monthlyRate * rentalMonths) */
    private BigDecimal subtotalRentalFee;

    /** Mã giảm giá và số tiền chiết khấu */
    private String discountCode;
    private Integer discountPercentage;
    private BigDecimal discountAmount;

    /** Tổng tiền thuê sau chiết khấu */
    private BigDecimal totalRentalFee;

    /** Tiền đặt cọc (Quy chuẩn SRS: 1 tháng tiền thuê cơ bản) */
    private BigDecimal depositAmount;

    /** Số tiền thanh toán ban đầu (Tháng đầu + Tiền cọc) */
    private BigDecimal initialPaymentAmount;

    /** Tổng giá trị hợp đồng trọn gói (Thuê cả kỳ + Cọc) */
    private BigDecimal totalContractValue;

    /** Chính sách hoàn tiền cọc SLA (3-5 ngày làm việc) */
    private Integer refundSlaDays;
    private String cancellationPolicy;
}

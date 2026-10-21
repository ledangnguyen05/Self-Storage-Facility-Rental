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

    /** Đơn giá thuê một tháng đã áp dụng (cùng giá với danh sách kho). */
    private BigDecimal monthlyPrice;

    /** Tên cũ của {@link #monthlyPrice}, giữ lại cho các màn hình đang dùng. */
    private BigDecimal monthlyRate;

    /** Nguồn của đơn giá: FACILITY_POLICY (giá riêng của cơ sở), UNIT (giá của kho) hoặc UNIT_TYPE (giá niêm yết chung). */
    private String priceSource;

    /** Tổng tiền thuê cơ bản (monthlyPrice * rentalMonths) */
    private BigDecimal subtotalRentalFee;

    /** Mã giảm giá (hoặc mã chiết khấu kỳ hạn TERM_xx) và số tiền chiết khấu */
    private String discountCode;
    /** Phần trăm chiết khấu làm tròn số nguyên (giữ cho màn hình cũ). */
    private Integer discountPercentage;
    /** Phần trăm chiết khấu chính xác (có thể có số lẻ). */
    private Double discountPercent;
    private BigDecimal discountAmount;

    /** Tổng tiền thuê sau chiết khấu */
    private BigDecimal totalRentalFee;

    /** Tỷ lệ cọc theo chính sách cơ sở (mặc định 100%). */
    private Double depositPercentage;

    /** Tiền đặt cọc = đơn giá tháng x tỷ lệ cọc */
    private BigDecimal depositAmount;

    /** Số tiền thanh toán ban đầu (Tháng đầu + Tiền cọc) */
    private BigDecimal initialPaymentAmount;

    /** Tổng giá trị hợp đồng trọn gói (Thuê cả kỳ + Cọc) */
    private BigDecimal totalContractValue;

    /** Thời hạn hoàn cọc tối đa (ngày) theo chính sách cơ sở */
    private Integer refundSlaDays;
    private String cancellationPolicy;

    /** Số giờ gia hạn sau giờ hẹn nhận kho trước khi booking tự giải phóng */
    private Integer holdGraceHours;

    /** Số ngày tối đa cho phép đặt giữ chỗ trước lịch hẹn */
    private Integer maxHoldDays;
}

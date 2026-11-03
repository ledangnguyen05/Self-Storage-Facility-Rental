package com.boxora.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "facility_policies")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FacilityPolicy extends BaseEntity {

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "facility_id", nullable = false, unique = true)
    private Facility facility;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    //ty lệ tiền cọc so với tiền thuê,
    // nếu thuê 1 tháng 10tr và percent là 100% thì phải cọc 10tr de thue kho
    @Column(name = "deposit_percentage", nullable = false)
    private Double depositPercentage;

    //số ngày trước khi hết hạn thuê mà khách có thể thực hiện renewal
    @Column(name = "renewal_window_days", nullable = false)
    @Builder.Default
    private Integer renewalWindowDays = 3;

    // thời gian thuê tối thiểu
    @Column(name = "minimum_rental_months", nullable = false)
    @Builder.Default
    private Integer minimumRentalMonths = 1;

    // thời gian thuê tối thiểu theo ngày (thay thế minimum_rental_months theo Task 2.2)
    @Column(name = "minimum_rental_days")
    @Builder.Default
    private Integer minimumRentalDays = 30;

    // --- Booking Hold & Reservation Policy ---
    // Số giờ gia hạn sau giờ hẹn nhận kho trước khi booking tự hết hạn giải phóng kho
    @Column(name = "hold_grace_hours", nullable = false)
    @Builder.Default
    private Integer holdGraceHours = 24;

    // Số ngày tối đa cho phép đặt giữ chỗ trước lịch hẹn
    @Column(name = "max_hold_days", nullable = false)
    @Builder.Default
    private Integer maxHoldDays = 14;

    // --- Cancellation ---
    @Column(name = "cancellation_full_refund_hours", nullable = false)
    @Builder.Default
    // số giờ kể từ khi đặt kho mà khách hủy sẽ được hoàn 100% tiền cọc
    private Integer cancellationFullRefundHours = 24;

    @Column(name = "cancellation_partial_refund_hours", nullable = false)
    @Builder.Default
    // số giờ kể từ khi đặt kho mà khách hủy sẽ được hoàn một phần tiền cọc (70%)
    private Integer cancellationPartialRefundHours = 48;

    @Column(name = "cancellation_partial_refund_percent", nullable = false)
    @Builder.Default
    // tỷ lệ hoàn cọc khi hủy trong khoảng 24h - 48h kể từ lúc đặt kho (70%)
    private Double cancellationPartialRefundPercent = 70.0;

    @Column(name = "cancellation_after_48h_refund_percent")
    @Builder.Default
    // tỷ lệ hoàn cọc khi hủy sau 48h kể từ lúc đặt kho (50%)
    private Double cancellationAfter48hRefundPercent = 50.0;

    // --- Unit Return ---
    @Column(name = "return_notice_days", nullable = false)
    @Builder.Default
    private Integer returnNoticeDays = 0; // số ngày khách phải thông báo trước khi trả unit(1 ngăn trong toàn bộ ngăn trong kho)

    @Column(name = "deposit_refund_sla_days", nullable = false)
    @Builder.Default
    // thời hạn tối đa để hoàn tiền cọc cho khách sau khi checkout
    //SLA = Service Level Agreement, tức thời gian tối đa hệ thống/cơ sở cam kết hoàn tiền cho khách.
    private Integer depositRefundSlaDays = 5;

    // --- Overdue ---
    @Column(name = "overdue_grace_days", nullable = false)
    @Builder.Default
    // số ngày cho phép quá hạn checkout mà không bị phạt
    private Integer overdueGraceDays = 1;

    @Column(name = "daily_late_fee", nullable = false, precision = 12, scale = 2)
    // phí phạt 1 ngày khi khách trả kho quá hạn
    private BigDecimal dailyLateFee;

    @Column(name = "overdue_access_disable_days", nullable = false)
    @Builder.Default
    // sau bao nhiêu ngày overdue thì disable access/PIN
    private Integer overdueAccessDisableDays = 3;

    @Column(name = "overdue_sealing_days", nullable = false)
    @Builder.Default
    // sau bao nhiêu ngày overdue thì unit có thể bị niêm phong(sealing)
    private Integer overdueSealingDays = 7;

    @Column(name = "discount_3_month_percent", precision = 5, scale = 2)
    @Builder.Default
    private BigDecimal discount3MonthPercent = BigDecimal.valueOf(5.0);

    @Column(name = "discount_6_month_percent", precision = 5, scale = 2)
    @Builder.Default
    private BigDecimal discount6MonthPercent = BigDecimal.valueOf(10.0);

    @Column(name = "discount_12_month_percent", precision = 5, scale = 2)
    @Builder.Default
    private BigDecimal discount12MonthPercent = BigDecimal.valueOf(15.0);

    @OneToMany(mappedBy = "facilityPolicy", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<FacilityPolicyPrice> prices = new ArrayList<>();

    public int resolveMinimumRentalDays() {
        if (minimumRentalDays != null && minimumRentalDays > 0) {
            return minimumRentalDays;
        }
        if (minimumRentalMonths != null && minimumRentalMonths > 0) {
            return minimumRentalMonths * 30;
        }
        return 30;
    }

    public double resolveAfter48hRefundPercent() {
        if (cancellationAfter48hRefundPercent != null && cancellationAfter48hRefundPercent >= 0) {
            return cancellationAfter48hRefundPercent;
        }
        return 50.0;
    }

    public BigDecimal resolveDiscount3MonthPercent() {
        return discount3MonthPercent != null ? discount3MonthPercent : BigDecimal.valueOf(5.0);
    }

    public BigDecimal resolveDiscount6MonthPercent() {
        return discount6MonthPercent != null ? discount6MonthPercent : BigDecimal.valueOf(10.0);
    }

    public BigDecimal resolveDiscount12MonthPercent() {
        return discount12MonthPercent != null ? discount12MonthPercent : BigDecimal.valueOf(15.0);
    }

    public String getEffectiveVersion() {
        if (getUpdatedAt() != null) {
            return "v" + getUpdatedAt().format(java.time.format.DateTimeFormatter.ofPattern("yyyyMMdd.HHmm"));
        }
        if (getCreatedAt() != null) {
            return "v" + getCreatedAt().format(java.time.format.DateTimeFormatter.ofPattern("yyyyMMdd.HHmm"));
        }
        if (getId() != null) {
            return "v1.0-" + getId().toString().substring(0, 8);
        }
        return "v1.0";
    }
}

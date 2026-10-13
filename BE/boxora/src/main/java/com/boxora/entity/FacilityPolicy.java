package com.boxora.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

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

    // --- Cancellation ---
    @Column(name = "cancellation_full_refund_hours", nullable = false)
    @Builder.Default
    // số giờ trước khi checkin ma khách cancel thuê sẽ trả 100% tiền cọc cho khách
    private Integer cancellationFullRefundHours = 48;

    @Column(name = "cancellation_partial_refund_hours", nullable = false)
    @Builder.Default
    // số giờ trước giờ check-in sẽ được hoàn một phần tiền coc cho khách,
    // phần refund được trả phụ thuộc Double cancellationPartialRefundPercent
    private Integer cancellationPartialRefundHours = 24;

    @Column(name = "cancellation_partial_refund_percent", nullable = false)
    @Builder.Default
    // tỷ lệ refund khi nằm trong trường hợp cancellationPartialRefundHours
    private Double cancellationPartialRefundPercent = 50.0;

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

}
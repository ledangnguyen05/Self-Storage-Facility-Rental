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
public class FacilityPolicy {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "facility_id", nullable = false, unique = true)
    private Facility facility;

    @Column(name = "deposit_percentage", nullable = false)
    private Double depositPercentage; // Ví dụ: 20.0 (tương đương 20%)

    @Column(name = "daily_late_fee", nullable = false, precision = 12, scale = 2)
    private BigDecimal dailyLateFee; // Phí phạt trễ hạn mỗi ngày

    @Column(name = "cancellation_refund_days", nullable = false)
    private Integer cancellationRefundDays; // Số ngày báo trước để được hoàn cọc
}
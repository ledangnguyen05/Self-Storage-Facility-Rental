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

    @Column(name = "deposit_percentage", nullable = false)
    private Double depositPercentage;

    @Column(name = "daily_late_fee", nullable = false, precision = 12, scale = 2)
    private BigDecimal dailyLateFee;

    @Column(name = "cancellation_refund_days", nullable = false)
    private Integer cancellationRefundDays;
}
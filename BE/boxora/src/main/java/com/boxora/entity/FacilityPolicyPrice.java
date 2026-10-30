package com.boxora.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity
@Table(
        name = "facility_policy_prices",
        uniqueConstraints = @UniqueConstraint(columnNames = {"facility_policy_id", "unit_type_id"})
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FacilityPolicyPrice extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "facility_policy_id", nullable = false)
    private FacilityPolicy facilityPolicy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "unit_type_id", nullable = false)
    private UnitType unitType;

    @Column(name = "monthly_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal monthlyPrice;

    @Column(name = "ac_monthly_price", precision = 12, scale = 2)
    private BigDecimal acMonthlyPrice;

    @Column(name = "discount_3_month_percent", nullable = false)
    @Builder.Default
    private Double discount3MonthPercent = 0.0;

    @Column(name = "discount_6_month_percent", nullable = false)
    @Builder.Default
    private Double discount6MonthPercent = 0.0;

    @Column(name = "discount_12_month_percent", nullable = false)
    @Builder.Default
    private Double discount12MonthPercent = 0.0;
}

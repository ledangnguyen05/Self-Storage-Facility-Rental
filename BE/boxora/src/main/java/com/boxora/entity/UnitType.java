package com.boxora.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity
@Table(name = "unit_types")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UnitType extends BaseEntity {

    @Column(name = "type_name", nullable = false, length = 100)
    private String typeName;

    @Column(name = "dimensions", nullable = false, length = 50)
    private String dimensions;

    @Column(name = "area_sqm", nullable = false)
    private Double areaSqm;

    @Column(name = "base_price_per_month", nullable = false, precision = 12, scale = 2)
    private BigDecimal basePricePerMonth;

    @Column(name = "deposit_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal depositAmount;
}
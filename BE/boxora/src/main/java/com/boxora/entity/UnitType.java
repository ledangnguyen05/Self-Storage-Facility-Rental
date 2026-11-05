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

    @Column(name = "ac_price_per_month", precision = 12, scale = 2)
    private BigDecimal acPricePerMonth;

    @Column(name = "deposit_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal depositAmount;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @Column(name = "volume_m3")
    private Double volumeM3;

    @Column(name = "length_m")
    private Double lengthM;

    @Column(name = "width_m")
    private Double widthM;

    @Column(name = "height_m")
    private Double heightM;

    @Column(name = "capacity_boxes")
    private Integer capacityBoxes;

    @Column(name = "image_url", length = 1000)
    private String imageUrl;
}

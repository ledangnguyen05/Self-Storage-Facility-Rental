package com.boxora.entity;

import com.boxora.enums.UnitStatus;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "storage_units")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StorageUnit extends BaseEntity {

    @Column(name = "unit_code", nullable = false, length = 30)
    private String unitCode;

    @Column(name = "floor_level", length = 50)
    private String floorLevel;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    private UnitStatus status;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "facility_id", nullable = false)
    private Facility facility;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "unit_type_id", nullable = false)
    private UnitType unitType;

    @Column(name = "price_per_month", precision = 12, scale = 2)
    private java.math.BigDecimal pricePerMonth;

    public java.math.BigDecimal getEffectiveBasePrice() {
        if (pricePerMonth != null) {
            return pricePerMonth;
        }
        return unitType != null ? unitType.getBasePricePerMonth() : null;
    }
}
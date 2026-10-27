package com.boxora.entity;

import com.boxora.enums.UnitStatus;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "storage_units")
@Getter
@Setter
@Builder
@AllArgsConstructor
public class StorageUnit extends BaseEntity {

    public StorageUnit() {
        super();
    }

    public StorageUnit(String unitCode, String floorLevel, UnitStatus status, Facility facility, UnitType unitType, java.math.BigDecimal pricePerMonth, String imageUrl) {
        super();
        this.unitCode = unitCode;
        this.floorLevel = floorLevel;
        this.status = status;
        this.facility = facility;
        this.unitType = unitType;
        this.pricePerMonth = pricePerMonth;
        this.imageUrl = imageUrl;
    }

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

    @Column(name = "image_url", length = 1000)
    private String imageUrl;

    @Column(name = "maintenance_reason", length = 500)
    private String maintenanceReason;

    @Column(name = "maintenance_by", length = 150)
    private String maintenanceBy;

    @Column(name = "maintenance_at")
    private java.time.LocalDateTime maintenanceAt;

    public java.math.BigDecimal getEffectiveBasePrice() {
        if (pricePerMonth != null) {
            return pricePerMonth;
        }
        return unitType != null ? unitType.getBasePricePerMonth() : null;
    }
}

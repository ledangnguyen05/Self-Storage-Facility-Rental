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
public class StorageUnit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "unit_code", nullable = false, length = 30)
    private String unitCode;

    @Column(name = "floor_level", length = 50)
    private String floorLevel;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private UnitStatus status;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "facility_id", nullable = false)
    private Facility facility;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "unit_type_id", nullable = false)
    private UnitType unitType;
}
package com.boxora.entity;

import com.boxora.enums.FacilityStatus;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalTime;

@Entity
@Table(name = "facilities")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Facility extends BaseEntity {

    @Column(name = "name", nullable = false, length = 150)
    private String name;

    @Column(name = "code", nullable = false, unique = true, length = 30)
    private String code;

    @Column(name = "address", nullable = false, length = 255)
    private String address;

    @Column(name = "city", length = 50)
    private String city;

    @Column(name = "contact_phone", length = 20)
    private String contactPhone;

    @Column(name = "email", length = 150)
    private String email;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "manager_id")
    private User manager;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private FacilityStatus status = FacilityStatus.ACTIVE;

    @Column(name = "open_time", nullable = false)
    @Builder.Default
    private LocalTime openTime = LocalTime.of(8, 0);

    @Column(name = "close_time", nullable = false)
    @Builder.Default
    private LocalTime closeTime = LocalTime.of(20, 0);

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "latitude", precision = 10, scale = 7)
    private BigDecimal latitude;

    @Column(name = "longitude", precision = 10, scale = 7)
    private BigDecimal longitude;

    @Column(name = "layout_config", columnDefinition = "TEXT")
    private String layoutConfig;
}

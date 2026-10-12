package com.boxora.entity;

import com.boxora.enums.FeeCategory;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity
@Table(name = "fee_types")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FeeType extends BaseEntity {

    @Column(name = "code", nullable = false, unique = true, length = 50)
    private String code;

    @Column(name = "name", nullable = false, length = 150)
    private String name;

    @Column(name = "description", length = 255)
    private String description;

    @Column(name = "default_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal defaultAmount;

    @Enumerated(EnumType.STRING)
    @Column(name = "fee_category", nullable = false, length = 50)
    private FeeCategory feeCategory;

    @Column(name = "is_recurring", nullable = false)
    @Builder.Default
    private Boolean isRecurring = false;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;
}


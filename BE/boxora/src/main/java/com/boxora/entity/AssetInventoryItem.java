package com.boxora.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity
@Table(name = "asset_inventory_items")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AssetInventoryItem extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sealing_record_id", nullable = false)
    private SealingRecord sealingRecord;

    @Column(name = "item_name", nullable = false)
    private String itemName;

    @Column(name = "quantity", nullable = false)
    @Builder.Default
    private Integer quantity = 1;

    @Column(name = "condition_status", length = 100)
    private String conditionStatus; // Tốt, Cũ, Hư hỏng nhẹ...

    @Column(name = "estimated_value", precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal estimatedValue = BigDecimal.ZERO;

    @Column(name = "photo_url", length = 500)
    private String photoUrl;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;
}

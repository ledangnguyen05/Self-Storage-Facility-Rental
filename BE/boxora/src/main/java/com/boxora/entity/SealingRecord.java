package com.boxora.entity;

import com.boxora.enums.SealingStatus;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@ToString
@Builder
@Entity
@Table(name = "sealing_records")
public class SealingRecord extends BaseEntity {

    @Column(name = "protocol_number", nullable = false, unique = true, length = 60)
    private String protocolNumber;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contract_id", nullable = false)
    private RentalContract contract;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "unit_id", nullable = false)
    private StorageUnit unit;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "facility_id", nullable = false)
    private Facility facility;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "performed_by_id", nullable = false)
    private User performedBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "witness_id", nullable = false)
    private User witness;

    @Column(name = "seal_tag_number", nullable = false, length = 100)
    private String sealTagNumber;

    @Column(nullable = false, length = 500)
    private String reason;

    @Column(name = "overdue_days", nullable = false)
    @Builder.Default
    private Long overdueDays = 0L;

    @Column(name = "total_debt_amount", nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal totalDebtAmount = BigDecimal.ZERO;

    @Column(name = "inventory_summary", columnDefinition = "TEXT")
    private String inventorySummary;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "evidence_urls", columnDefinition = "TEXT")
    private String evidenceUrls;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    @Builder.Default
    private SealingStatus status = SealingStatus.SEALED;

    @Column(name = "sealed_at", nullable = false)
    private LocalDateTime sealedAt;

    @Column(name = "unsealed_at")
    private LocalDateTime unsealedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "unsealed_by_id")
    private User unsealedBy;

    @Column(name = "unseal_reason", length = 500)
    private String unsealReason;
}

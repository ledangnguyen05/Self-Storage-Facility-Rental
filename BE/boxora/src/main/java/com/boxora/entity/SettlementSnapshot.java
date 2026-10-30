package com.boxora.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "settlement_snapshots")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SettlementSnapshot {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "handover_record_id", nullable = false)
    private HandoverRecord handoverRecord;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "booking_id", nullable = false)
    private Booking booking;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contract_id")
    private RentalContract contract;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "facility_id")
    private Facility facility;

    @Column(name = "settlement_version", nullable = false)
    private Integer settlementVersion;

    @Column(name = "deposit_amount", precision = 12, scale = 2, nullable = false)
    @Builder.Default
    private BigDecimal depositAmount = BigDecimal.ZERO;

    @Column(name = "door_fee", precision = 12, scale = 2, nullable = false)
    @Builder.Default
    private BigDecimal doorFee = BigDecimal.ZERO;

    @Column(name = "cleaning_fee", precision = 12, scale = 2, nullable = false)
    @Builder.Default
    private BigDecimal cleaningFee = BigDecimal.ZERO;

    @Column(name = "wall_structure_fee", precision = 12, scale = 2, nullable = false)
    @Builder.Default
    private BigDecimal wallStructureFee = BigDecimal.ZERO;

    @Column(name = "smart_lock_fee", precision = 12, scale = 2, nullable = false)
    @Builder.Default
    private BigDecimal smartLockFee = BigDecimal.ZERO;

    @Column(name = "smart_lock_issue_type", length = 50)
    private String smartLockIssueType;

    @Column(name = "lost_card_fee", precision = 12, scale = 2, nullable = false)
    @Builder.Default
    private BigDecimal lostCardFee = BigDecimal.ZERO;

    @Column(name = "overdue_debt", precision = 12, scale = 2, nullable = false)
    @Builder.Default
    private BigDecimal overdueDebt = BigDecimal.ZERO;

    @Column(name = "total_deductions", precision = 12, scale = 2, nullable = false)
    @Builder.Default
    private BigDecimal totalDeductions = BigDecimal.ZERO;

    @Column(name = "refund_amount", precision = 12, scale = 2, nullable = false)
    @Builder.Default
    private BigDecimal refundAmount = BigDecimal.ZERO;

    @Column(name = "additional_amount_due", precision = 12, scale = 2, nullable = false)
    @Builder.Default
    private BigDecimal additionalAmountDue = BigDecimal.ZERO;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "confirmed_by_id")
    private User confirmedBy;

    @Column(name = "confirmed_by_name")
    private String confirmedByName;

    @Column(name = "confirmed_at", nullable = false)
    private LocalDateTime confirmedAt;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Column(name = "customer_decision", length = 50)
    @Builder.Default
    private String customerDecision = "PENDING";

    @Column(name = "customer_decision_at")
    private LocalDateTime customerDecisionAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}

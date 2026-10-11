package com.boxora.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "handover_records")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class HandoverRecord extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "booking_id", nullable = false)
    private Booking booking;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "staff_id", nullable = false)
    private User staff;

    @Column(name = "record_type", nullable = false, length = 30)
    private String recordType;

    @Column(name = "unit_condition", columnDefinition = "TEXT")
    private String unitCondition;

    @Column(name = "deposit_settled", precision = 12, scale = 2)
    private BigDecimal depositSettled;

    @Column(name = "deduction_amount", precision = 12, scale = 2)
    private BigDecimal deductionAmount;

    @Column(name = "refund_amount", precision = 12, scale = 2)
    private BigDecimal refundAmount;

    @Column(name = "review_status", length = 50)
    private String reviewStatus;

    @Column(name = "checklist_summary", columnDefinition = "TEXT")
    private String checklistSummary;

    @Column(name = "evidence_photos", columnDefinition = "TEXT")
    private String evidencePhotos;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Column(name = "recorded_at", nullable = false)
    private LocalDateTime recordedAt;
}
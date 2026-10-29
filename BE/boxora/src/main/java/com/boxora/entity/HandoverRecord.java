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
    @JoinColumn(name = "staff_id", nullable = true)
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

    @Column(name = "door_condition_passed")
    private Boolean doorConditionPassed;

    @Column(name = "cleanliness_passed")
    private Boolean cleanlinessPassed;

    @Column(name = "smart_lock_passed")
    private Boolean smartLockPassed;

    @Column(name = "sensor_passed")
    private Boolean sensorPassed;

    @Column(name = "wall_structure_passed")
    private Boolean wallStructurePassed;

    @Column(name = "assets_cleared_passed")
    private Boolean assetsClearedPassed;

    @Column(name = "assets_cleared_notes", columnDefinition = "TEXT")
    private String assetsClearedNotes;

    @Column(name = "door_fee", precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal doorFee = BigDecimal.ZERO;

    @Column(name = "door_notes", columnDefinition = "TEXT")
    private String doorNotes;

    @Column(name = "cleanliness_fee", precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal cleanlinessFee = BigDecimal.ZERO;

    @Column(name = "cleanliness_notes", columnDefinition = "TEXT")
    private String cleanlinessNotes;

    @Column(name = "wall_structure_fee", precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal wallStructureFee = BigDecimal.ZERO;

    @Column(name = "wall_structure_notes", columnDefinition = "TEXT")
    private String wallStructureNotes;

    @Column(name = "smart_lock_fee", precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal smartLockFee = BigDecimal.ZERO;

    @Column(name = "smart_lock_notes", columnDefinition = "TEXT")
    private String smartLockNotes;

    @Column(name = "smart_lock_issue_type", length = 50)
    private String smartLockIssueType;

    @Column(name = "lost_card_fee", precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal lostCardFee = BigDecimal.ZERO;

    @Column(name = "sensor_notes", columnDefinition = "TEXT")
    private String sensorNotes;

    @Column(name = "approved_deductions", precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal approvedDeductions = BigDecimal.ZERO;

    @Column(name = "additional_amount_due", precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal additionalAmountDue = BigDecimal.ZERO;

    @Column(name = "additional_payment_status", length = 50)
    @Builder.Default
    private String additionalPaymentStatus = "NONE";

    @Column(name = "additional_payment_txn_ref", length = 100)
    private String additionalPaymentTxnRef;

    @Column(name = "additional_payment_method", length = 50)
    private String additionalPaymentMethod;

    @Column(name = "additional_payment_recorded_at")
    private LocalDateTime additionalPaymentRecordedAt;

    @Column(name = "refund_method", length = 50)
    private String refundMethod;

    @Column(name = "refund_txn_ref", length = 100)
    private String refundTxnRef;

    @Column(name = "refund_status", length = 50)
    @Builder.Default
    private String refundStatus = "NONE";

    @Column(name = "refund_processed_at")
    private LocalDateTime refundProcessedAt;

    @Column(name = "scheduled_inspection_at")
    private LocalDateTime scheduledInspectionAt;

    @Column(name = "inspection_status", length = 50)
    @Builder.Default
    private String inspectionStatus = "PENDING";

    @Column(name = "approval_status", length = 50)
    @Builder.Default
    private String approvalStatus = "DRAFT";

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approved_by_id")
    private User approvedBy;

    @Column(name = "approved_at")
    private LocalDateTime approvedAt;

    @Column(name = "approval_notes", columnDefinition = "TEXT")
    private String approvalNotes;

    @Column(name = "unit_returned_physically")
    @Builder.Default
    private Boolean unitReturnedPhysically = false;

    @Column(name = "returned_at")
    private LocalDateTime returnedAt;

    @Column(name = "access_revoked")
    @Builder.Default
    private Boolean accessRevoked = false;

    @Column(name = "access_revoked_at")
    private LocalDateTime accessRevokedAt;

    @Column(name = "post_return_unit_status", length = 30)
    private String postReturnUnitStatus;

    @Column(name = "settlement_version")
    @Builder.Default
    private Integer settlementVersion = 1;

    @Column(name = "settlement_confirmed")
    @Builder.Default
    private Boolean settlementConfirmed = false;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "settlement_confirmed_by_id")
    private User settlementConfirmedBy;

    @Column(name = "settlement_confirmed_at")
    private LocalDateTime settlementConfirmedAt;

    @Column(name = "customer_decision", length = 50)
    @Builder.Default
    private String customerDecision = "NONE";

    @Column(name = "customer_decision_at")
    private LocalDateTime customerDecisionAt;

    @Column(name = "dispute_reason", columnDefinition = "TEXT")
    private String disputeReason;

    @Column(name = "dispute_evidence_urls", columnDefinition = "TEXT")
    private String disputeEvidenceUrls;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "dispute_resolved_by_id")
    private User disputeResolvedBy;

    @Column(name = "dispute_resolved_at")
    private LocalDateTime disputeResolvedAt;

    @Column(name = "dispute_resolution_note", columnDefinition = "TEXT")
    private String disputeResolutionNote;

    @Column(name = "bank_name", length = 100)
    private String bankName;

    @Column(name = "bank_account_number", length = 100)
    private String bankAccountNumber;

    @Column(name = "bank_account_name", length = 100)
    private String bankAccountName;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "refund_request_id")
    private RefundRequest refundRequest;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Column(name = "recorded_at", nullable = false)
    private LocalDateTime recordedAt;

    public Boolean getPhysicalHandoverConfirmed() {
        return this.unitReturnedPhysically;
    }

    public void setPhysicalHandoverConfirmed(Boolean confirmed) {
        this.unitReturnedPhysically = confirmed;
    }

    public LocalDateTime getPhysicalHandoverAt() {
        return this.returnedAt;
    }

    public void setPhysicalHandoverAt(LocalDateTime at) {
        this.returnedAt = at;
    }

    public User getPhysicalHandoverBy() {
        return this.approvedBy;
    }

    public void setPhysicalHandoverBy(User staff) {
        this.approvedBy = staff;
    }

    public boolean getChecklistAllPassed() {
        return checklistSummary == null || (!checklistSummary.contains("Không đạt")
                && !checklistSummary.contains("Bẩn")
                && !checklistSummary.contains("Chưa dọn")
                && !checklistSummary.contains("Lỗi")
                && !checklistSummary.contains("Hư hại")
                && !checklistSummary.contains("Còn đồ"));
    }
}

package com.boxora.entity;

import com.boxora.enums.SealingStatus;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Biên bản niêm phong kho lưu trữ do vi phạm hợp đồng hoặc quá hạn thanh toán
 * tuân thủ theo quy tắc BR-RULE-012 (+7 ngày quá hạn).
 */
@Entity
@Table(name = "sealing_records")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SealingRecord extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "storage_unit_id", nullable = false)
    private StorageUnit storageUnit;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contract_id")
    private RentalContract contract;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "facility_id", nullable = false)
    private Facility facility;

    @Column(name = "seal_tag_number", nullable = false, unique = true, length = 50)
    private String sealTagNumber;

    @Column(name = "reason", nullable = false, length = 500)
    private String reason;

    @Column(name = "sealed_at", nullable = false)
    private LocalDateTime sealedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sealed_by_id", nullable = false)
    private User sealedBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "witness_id", nullable = false)
    private User witness;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    @Builder.Default
    private SealingStatus status = SealingStatus.SEALED;

    @Column(name = "unsealed_at")
    private LocalDateTime unsealedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "unsealed_by_id")
    private User unsealedBy;

    @Column(name = "unseal_reason", length = 500)
    private String unsealReason;

    @Column(name = "protocol_number", length = 60)
    private String protocolNumber;

    @Column(name = "overdue_days")
    @Builder.Default
    private Long overdueDays = 0L;

    @Column(name = "total_debt_amount", precision = 15, scale = 2)
    @Builder.Default
    private java.math.BigDecimal totalDebtAmount = java.math.BigDecimal.ZERO;

    @Column(name = "inventory_summary", columnDefinition = "TEXT")
    private String inventorySummary;

    @Column(name = "evidence_urls", columnDefinition = "TEXT")
    private String evidenceUrls;

    @Column(name = "photo_evidence_url", length = 500)
    private String photoEvidenceUrl;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Column(name = "request_status", length = 40)
    @Builder.Default
    private String requestStatus = "COMPLETED";

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "requested_by_id")
    private User requestedBy;

    @Column(name = "requested_at")
    private LocalDateTime requestedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approved_by_id")
    private User approvedBy;

    @Column(name = "approved_at")
    private LocalDateTime approvedAt;

    @Column(name = "rejection_reason", columnDefinition = "TEXT")
    private String rejectionReason;

    // Helper alias methods for backwards compatibility
    public StorageUnit getUnit() {
        return this.storageUnit;
    }

    public void setUnit(StorageUnit unit) {
        this.storageUnit = unit;
    }

    public User getPerformedBy() {
        return this.sealedBy;
    }

    public void setPerformedBy(User user) {
        this.sealedBy = user;
    }

    public static class SealingRecordBuilder {
        public SealingRecordBuilder unit(StorageUnit unit) {
            this.storageUnit = unit;
            return this;
        }

        public SealingRecordBuilder performedBy(User user) {
            this.sealedBy = user;
            return this;
        }
    }
}

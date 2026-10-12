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

    @Column(name = "photo_evidence_url", length = 500)
    private String photoEvidenceUrl;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;
}


package com.boxora.entity;

import com.boxora.enums.RentalContractStatus;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "rental_contracts")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RentalContract extends BaseEntity {

    @Column(name = "contract_code", length = 50)
    private String contractCode;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "customer_id", nullable = false)
    private User customer;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "unit_id", nullable = false)
    private StorageUnit unit;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "facility_id", nullable = false)
    private Facility facility;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "booking_id")
    private Booking booking;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    @Column(name = "monthly_fee", nullable = false, precision = 15, scale = 2)
    private BigDecimal monthlyFee;

    @Column(name = "deposit_held", precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal depositHeld = BigDecimal.ZERO;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    @Builder.Default
    private RentalContractStatus status = RentalContractStatus.PENDING_SIGNATURE;

    @Column(name = "docuseal_submission_id")
    private Long docusealSubmissionId;

    @Column(name = "docuseal_submitter_slug", length = 100)
    private String docusealSubmitterSlug;

    @Column(name = "signed_document_url", length = 500)
    private String signedDocumentUrl;

    @Column(name = "signed_at")
    private LocalDateTime signedAt;

    @Column(name = "signature_data", columnDefinition = "TEXT")
    private String signatureData;

    @Column(name = "signing_method", length = 30)
    @Builder.Default
    private String signingMethod = "ELECTRONIC";

    @Column(name = "paper_contract_url", length = 500)
    private String paperContractUrl;

    @Column(name = "paper_original_location", length = 255)
    private String paperOriginalLocation;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "paper_verified_by_staff_id")
    private User paperVerifiedBy;

    @Column(name = "paper_verified_at")
    private LocalDateTime paperVerifiedAt;

    @Column(name = "paper_notes", columnDefinition = "TEXT")
    private String paperNotes;
}
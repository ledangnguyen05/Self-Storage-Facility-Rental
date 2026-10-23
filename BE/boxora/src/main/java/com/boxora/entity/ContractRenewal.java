package com.boxora.entity;

import com.boxora.enums.ContractRenewalStatus;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "contract_renewals")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ContractRenewal extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contract_id", nullable = false)
    private RentalContract contract;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "payment_id")
    private Payment payment;

    @Column(name = "old_end_date", nullable = false)
    private LocalDate oldEndDate;

    @Column(name = "new_end_date", nullable = false)
    private LocalDate newEndDate;

    @Column(name = "cycle_months", nullable = false)
    private Integer cycleMonths;

    @Column(name = "renewal_fee", nullable = false, precision = 12, scale = 2)
    private BigDecimal renewalFee;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    @Builder.Default
    private ContractRenewalStatus status = ContractRenewalStatus.PENDING_REVIEW;

    @Column(name = "counter_appointment_date")
    private LocalDate counterAppointmentDate;

    @Column(name = "counter_appointment_time", length = 10)
    private String counterAppointmentTime;

    @Column(name = "docuseal_submission_id")
    private Long docusealSubmissionId;

    @Column(name = "docuseal_submitter_slug", length = 100)
    private String docusealSubmitterSlug;

    @Column(name = "signed_document_url", length = 500)
    private String signedDocumentUrl;

    @Column(name = "signed_at")
    private LocalDateTime signedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reviewed_by_id")
    private User reviewedBy;

    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;

    @Column(name = "rejection_reason", columnDefinition = "TEXT")
    private String rejectionReason;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Column(name = "payment_method", length = 30)
    private String paymentMethod;

    @Column(name = "receipt_voucher_code", length = 100)
    private String receiptVoucherCode;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cashier_staff_id")
    private User cashierStaff;

    @Column(name = "paid_at")
    private LocalDateTime paidAt;

    @Column(name = "signature_data", columnDefinition = "TEXT")
    private String signatureData;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_staff_id")
    private User assignedStaff;

    @Column(name = "assigned_staff_at")
    private LocalDateTime assignedStaffAt;

    @Column(name = "identity_verified")
    @Builder.Default
    private Boolean identityVerified = false;

    @Column(name = "identity_doc_type", length = 50)
    private String identityDocType;

    @Column(name = "identity_number", length = 50)
    private String identityNumber;

    @Column(name = "identity_notes", columnDefinition = "TEXT")
    private String identityNotes;

    @Column(name = "unit_audited")
    @Builder.Default
    private Boolean unitAudited = false;

    @Column(name = "unit_audit_notes", columnDefinition = "TEXT")
    private String unitAuditNotes;

    @Column(name = "no_blocking_issues")
    @Builder.Default
    private Boolean noBlockingIssues = false;

    @Column(name = "blocking_notes", columnDefinition = "TEXT")
    private String blockingNotes;

    @Column(name = "terms_confirmed")
    @Builder.Default
    private Boolean termsConfirmed = false;

    @Column(name = "terms_notes", columnDefinition = "TEXT")
    private String termsNotes;

    @Column(name = "payment_confirmed")
    @Builder.Default
    private Boolean paymentConfirmed = false;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "handled_by_id")
    private User handledBy;

    @Column(name = "handled_at")
    private LocalDateTime handledAt;

    @Column(name = "reception_notes", columnDefinition = "TEXT")
    private String receptionNotes;

    @Column(name = "reception_checklist_json", columnDefinition = "TEXT")
    private String receptionChecklistJson;
}
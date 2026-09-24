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
    private ContractRenewalStatus status = ContractRenewalStatus.PENDING_SIGNATURE;

    @Column(name = "docuseal_submission_id")
    private Long docusealSubmissionId;

    @Column(name = "docuseal_submitter_slug", length = 100)
    private String docusealSubmitterSlug;

    @Column(name = "signed_document_url", length = 500)
    private String signedDocumentUrl;

    @Column(name = "signed_at")
    private LocalDateTime signedAt;
}
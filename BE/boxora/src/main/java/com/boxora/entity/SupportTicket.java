package com.boxora.entity;

import com.boxora.enums.TicketCategory;
import com.boxora.enums.TicketStatus;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "support_tickets")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SupportTicket extends BaseEntity {

    @Column(name = "ticket_code", nullable = false, unique = true, length = 50)
    private String ticketCode;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User customer;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "booking_id")
    private Booking booking;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "storage_unit_id")
    private StorageUnit storageUnit;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_staff_id")
    private User createdByStaff;

    @Column(name = "is_staff_recorded")
    @Builder.Default
    private Boolean isStaffRecorded = false;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private TicketCategory category;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    @Builder.Default
    private TicketStatus status = TicketStatus.OPEN;

    @Column(length = 20)
    @Builder.Default
    private String priority = "MEDIUM";

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_staff_id")
    private User assignedStaff;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "facility_id")
    private Facility facility;

    @Column(name = "image_evidence", columnDefinition = "TEXT")
    private String imageEvidence;

    @Column(name = "resolution_note", columnDefinition = "TEXT")
    private String resolutionNote;

    @Column(name = "sla_due_at")
    private java.time.LocalDateTime slaDueAt;

    @Column(name = "resolved_at")
    private java.time.LocalDateTime resolvedAt;

    @Column(name = "closed_at")
    private java.time.LocalDateTime closedAt;

    @Column(name = "bank_name", length = 100)
    private String bankName;

    @Column(name = "bank_account_number", length = 50)
    private String bankAccountNumber;

    @Column(name = "bank_account_name", length = 100)
    private String bankAccountName;

    @Column(name = "refund_amount", precision = 15, scale = 2)
    private java.math.BigDecimal refundAmount;

    @Column(name = "transfer_proof_url", columnDefinition = "TEXT")
    private String transferProofUrl;

    @Column(name = "transfer_transaction_ref", length = 100)
    private String transferTransactionRef;

    @Column(name = "transfer_confirmed_at")
    private java.time.LocalDateTime transferConfirmedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "transfer_confirmed_by_id")
    private User transferConfirmedBy;

    @Column(name = "fm_approved_at")
    private java.time.LocalDateTime fmApprovedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "fm_approved_by_id")
    private User fmApprovedBy;

    @Column(name = "fm_approval_note", columnDefinition = "TEXT")
    private String fmApprovalNote;

    @Column(name = "refund_status", length = 50)
    @Builder.Default
    private String refundStatus = "NONE";

    @Column(name = "rating")
    private Integer rating;

    @Column(name = "customer_feedback", columnDefinition = "TEXT")
    private String customerFeedback;
}
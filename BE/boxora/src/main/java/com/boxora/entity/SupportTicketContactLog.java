package com.boxora.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "support_ticket_contact_logs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SupportTicketContactLog extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ticket_id", nullable = false)
    private SupportTicket ticket;

    @Column(name = "contact_method", nullable = false, length = 50)
    private String contactMethod; // PHONE, EMAIL, INTERNAL_CHAT

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contacted_by", nullable = false)
    private User contactedBy; // The Facility Manager who reached out

    @Column(name = "target_role", nullable = false, length = 50)
    @Builder.Default
    private String targetRole = "BUSINESS_MANAGER";

    @Column(name = "contact_target", nullable = false, length = 255)
    private String contactTarget; // e.g. Phone number or email of BOM

    @Column(name = "summary", nullable = false, columnDefinition = "TEXT")
    private String summary;

    @Column(name = "result", columnDefinition = "TEXT")
    private String result;
}

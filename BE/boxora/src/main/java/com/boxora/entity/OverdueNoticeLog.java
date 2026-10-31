package com.boxora.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "overdue_notice_logs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OverdueNoticeLog extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contract_id", nullable = false)
    private RentalContract contract;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id")
    private User customer;

    @Column(name = "channel", nullable = false, length = 30)
    private String channel; // SMS, EMAIL, CALL, MULTI

    @Column(name = "template_type", nullable = false, length = 50)
    private String templateType; // REMINDER, WARNING, LOCKOUT_NOTICE, SEAL_WARNING

    @Column(name = "content", nullable = false, columnDefinition = "TEXT")
    private String content;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sent_by_id")
    private User sentBy;

    @Column(name = "sent_at", nullable = false)
    @Builder.Default
    private LocalDateTime sentAt = LocalDateTime.now();

    @Column(name = "delivery_status", length = 30)
    @Builder.Default
    private String deliveryStatus = "DELIVERED";

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;
}


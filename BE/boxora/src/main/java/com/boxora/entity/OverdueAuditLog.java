package com.boxora.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "overdue_audit_logs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OverdueAuditLog extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contract_id")
    private RentalContract contract;

    @Column(name = "action", nullable = false, length = 60)
    private String action;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "performed_by_id")
    private User performedBy;

    @Column(name = "performed_by_name", length = 100)
    private String performedByName;

    @Column(name = "performed_by_role", length = 50)
    private String performedByRole;

    @Column(name = "before_state", length = 100)
    private String beforeState;

    @Column(name = "after_state", length = 100)
    private String afterState;

    @Column(name = "details", columnDefinition = "TEXT")
    private String details;
}

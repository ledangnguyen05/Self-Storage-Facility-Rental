package com.boxora.entity;

import com.boxora.enums.ShiftHandoverStatus;
import com.boxora.enums.StaffShift;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "shift_handovers")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ShiftHandover extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "facility_id", nullable = false)
    private Facility facility;

    @Column(name = "handover_date", nullable = false)
    private LocalDate handoverDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "shift", nullable = false, length = 30)
    private StaffShift shift;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "outgoing_staff_id", nullable = false)
    private User outgoingStaff;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "incoming_staff_id")
    private User incomingStaff;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "outgoing_assignment_id")
    private StaffAssignment outgoingAssignment;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "incoming_assignment_id")
    private StaffAssignment incomingAssignment;

    @Column(name = "pending_tasks", columnDefinition = "TEXT")
    private String pendingTasks;

    @Column(name = "pending_tickets_count", nullable = false)
    @Builder.Default
    private Integer pendingTicketsCount = 0;

    @Column(name = "unresolved_bookings_count", nullable = false)
    @Builder.Default
    private Integer unresolvedBookingsCount = 0;

    @Column(name = "cash_in_drawer", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal cashInDrawer = BigDecimal.ZERO;

    @Column(name = "facility_status_note", columnDefinition = "TEXT")
    private String facilityStatusNote;

    @Column(name = "checklist_completed", nullable = false)
    @Builder.Default
    private Boolean checklistCompleted = false;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    @Builder.Default
    private ShiftHandoverStatus status = ShiftHandoverStatus.SUBMITTED;

    @Column(name = "acknowledged_at")
    private LocalDateTime acknowledgedAt;
}

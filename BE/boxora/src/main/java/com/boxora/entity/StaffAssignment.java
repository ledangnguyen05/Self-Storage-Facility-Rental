package com.boxora.entity;

import com.boxora.enums.StaffAssignmentStatus;
import com.boxora.enums.StaffShift;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

@Entity
@Table(name = "staff_assignments")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StaffAssignment extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "staff_id", nullable = false)
    private User staff;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "facility_id", nullable = false)
    private Facility facility;

    @Column(name = "assigned_date", nullable = false)
    private LocalDate assignedDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "shift", nullable = false, length = 30)
    private StaffShift shift;

    @Column(name = "assigned_zone", length = 50)
    private String assignedZone;

    @Column(name = "role_in_shift", nullable = false, length = 50)
    @Builder.Default
    private String roleInShift = "PRIMARY_STAFF";

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    @Builder.Default
    private StaffAssignmentStatus status = StaffAssignmentStatus.ASSIGNED;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_by_id")
    private User assignedBy;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;
}

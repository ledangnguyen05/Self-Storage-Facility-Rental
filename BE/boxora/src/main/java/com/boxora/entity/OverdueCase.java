package com.boxora.entity;

import com.boxora.enums.OverdueCaseStatus;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Persisted state of one overdue episode of a contract: the late fee accrued by the nightly job
 * (computed by {@code OverdueFeeCalculator}), the access lockout / restoration timestamps, the
 * reprieve granted by a manager and the last reminder. One OPEN case per contract at most.
 */
@Entity
@Table(name = "overdue_cases")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OverdueCase extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "contract_id", nullable = false)
    private RentalContract contract;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "facility_id", nullable = false)
    private Facility facility;

    /** Contract end date this episode refers to. */
    @Column(name = "due_date", nullable = false)
    private LocalDate dueDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private OverdueCaseStatus status = OverdueCaseStatus.OPEN;

    @Column(name = "days_overdue", nullable = false)
    @Builder.Default
    private Integer daysOverdue = 0;

    @Column(name = "grace_days", nullable = false)
    @Builder.Default
    private Integer graceDays = 0;

    @Column(name = "daily_late_fee", nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal dailyLateFee = BigDecimal.ZERO;

    @Column(name = "late_fee_amount", nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal lateFeeAmount = BigDecimal.ZERO;

    @Column(name = "overdue_rent_amount", nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal overdueRentAmount = BigDecimal.ZERO;

    @Column(name = "last_assessed_on")
    private LocalDate lastAssessedOn;

    @Column(name = "access_locked_at")
    private LocalDateTime accessLockedAt;

    @Column(name = "access_restored_at")
    private LocalDateTime accessRestoredAt;

    /** The nightly job does not lock access again before this date (manager reprieve). */
    @Column(name = "access_hold_until")
    private LocalDate accessHoldUntil;

    @Column(name = "last_reminder_at")
    private LocalDateTime lastReminderAt;

    /** SENT or FAILED. */
    @Column(name = "last_reminder_status", length = 20)
    private String lastReminderStatus;

    @Column(name = "last_reminder_error", length = 500)
    private String lastReminderError;

    @Column(name = "reminder_count", nullable = false)
    @Builder.Default
    private Integer reminderCount = 0;

    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;

    @Column(name = "resolution_note", length = 500)
    private String resolutionNote;
}

package com.boxora.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "booking_reschedule_histories")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BookingRescheduleHistory extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "booking_id", nullable = false)
    private Booking booking;

    @Column(name = "change_type", nullable = false, length = 50)
    @Builder.Default
    private String changeType = "CHECKIN_RESCHEDULE";

    @Column(name = "previous_appointment_at", nullable = false)
    private LocalDateTime previousAppointmentAt;

    @Column(name = "requested_appointment_at", nullable = false)
    private LocalDateTime requestedAppointmentAt;

    @Column(name = "accepted_appointment_at", nullable = false)
    private LocalDateTime acceptedAppointmentAt;

    @Column(name = "previous_expected_start_date", nullable = false)
    private LocalDate previousExpectedStartDate;

    @Column(name = "previous_expected_end_date", nullable = false)
    private LocalDate previousExpectedEndDate;

    @Column(name = "new_expected_start_date", nullable = false)
    private LocalDate newExpectedStartDate;

    @Column(name = "new_expected_end_date", nullable = false)
    private LocalDate newExpectedEndDate;

    @Column(name = "previous_hold_expires_at")
    private Instant previousHoldExpiresAt;

    @Column(name = "new_hold_expires_at")
    private Instant newHoldExpiresAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "requester_id")
    private User requester;

    @Column(name = "requester_role", length = 50)
    private String requesterRole;

    @Column(name = "request_timestamp", nullable = false)
    @Builder.Default
    private LocalDateTime requestTimestamp = LocalDateTime.now();

    @Column(name = "reason", columnDefinition = "TEXT")
    private String reason;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "processor_id")
    private User processor;

    @Column(name = "processor_role", length = 50)
    private String processorRole;

    @Column(name = "processed_at", nullable = false)
    @Builder.Default
    private LocalDateTime processedAt = LocalDateTime.now();

    @Column(name = "outcome", nullable = false, length = 30)
    @Builder.Default
    private String outcome = "CONFIRMED";

    @Column(name = "rejection_reason", columnDefinition = "TEXT")
    private String rejectionReason;

    @Column(name = "previous_booking_status", nullable = false, length = 30)
    private String previousBookingStatus;

    @Column(name = "resulting_booking_status", nullable = false, length = 30)
    private String resultingBookingStatus;

    @Column(name = "contract_amendment_required", nullable = false)
    @Builder.Default
    private Boolean contractAmendmentRequired = false;

    @Column(name = "contract_amendment_notes", columnDefinition = "TEXT")
    private String contractAmendmentNotes;
}

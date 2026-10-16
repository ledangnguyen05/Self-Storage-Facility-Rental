package com.boxora.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BookingRescheduleHistoryResponse {
    private UUID id;
    private UUID bookingId;
    private String bookingCode;
    private String changeType;

    private LocalDateTime previousAppointmentAt;
    private LocalDateTime requestedAppointmentAt;
    private LocalDateTime acceptedAppointmentAt;

    private LocalDate previousExpectedStartDate;
    private LocalDate previousExpectedEndDate;
    private LocalDate newExpectedStartDate;
    private LocalDate newExpectedEndDate;

    private Instant previousHoldExpiresAt;
    private Instant newHoldExpiresAt;

    private UUID requesterId;
    private String requesterName;
    private String requesterRole;
    private LocalDateTime requestTimestamp;
    private String reason;

    private UUID processorId;
    private String processorName;
    private String processorRole;
    private LocalDateTime processedAt;

    private String outcome;
    private String rejectionReason;

    private String previousBookingStatus;
    private String resultingBookingStatus;

    private Boolean contractAmendmentRequired;
    private String contractAmendmentNotes;
    private LocalDateTime createdAt;
}

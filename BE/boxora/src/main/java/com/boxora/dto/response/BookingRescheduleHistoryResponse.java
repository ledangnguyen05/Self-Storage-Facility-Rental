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

    public static BookingRescheduleHistoryResponseBuilder builder() {
        return new BookingRescheduleHistoryResponseBuilder();
    }

    public static class BookingRescheduleHistoryResponseBuilder {
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

        BookingRescheduleHistoryResponseBuilder() {}

        public BookingRescheduleHistoryResponseBuilder id(UUID id) {
            this.id = id;
            return this;
        }

        public BookingRescheduleHistoryResponseBuilder bookingId(UUID bookingId) {
            this.bookingId = bookingId;
            return this;
        }

        public BookingRescheduleHistoryResponseBuilder bookingCode(String bookingCode) {
            this.bookingCode = bookingCode;
            return this;
        }

        public BookingRescheduleHistoryResponseBuilder changeType(String changeType) {
            this.changeType = changeType;
            return this;
        }

        public BookingRescheduleHistoryResponseBuilder previousAppointmentAt(LocalDateTime previousAppointmentAt) {
            this.previousAppointmentAt = previousAppointmentAt;
            return this;
        }

        public BookingRescheduleHistoryResponseBuilder requestedAppointmentAt(LocalDateTime requestedAppointmentAt) {
            this.requestedAppointmentAt = requestedAppointmentAt;
            return this;
        }

        public BookingRescheduleHistoryResponseBuilder acceptedAppointmentAt(LocalDateTime acceptedAppointmentAt) {
            this.acceptedAppointmentAt = acceptedAppointmentAt;
            return this;
        }

        public BookingRescheduleHistoryResponseBuilder previousExpectedStartDate(LocalDate previousExpectedStartDate) {
            this.previousExpectedStartDate = previousExpectedStartDate;
            return this;
        }

        public BookingRescheduleHistoryResponseBuilder previousExpectedEndDate(LocalDate previousExpectedEndDate) {
            this.previousExpectedEndDate = previousExpectedEndDate;
            return this;
        }

        public BookingRescheduleHistoryResponseBuilder newExpectedStartDate(LocalDate newExpectedStartDate) {
            this.newExpectedStartDate = newExpectedStartDate;
            return this;
        }

        public BookingRescheduleHistoryResponseBuilder newExpectedEndDate(LocalDate newExpectedEndDate) {
            this.newExpectedEndDate = newExpectedEndDate;
            return this;
        }

        public BookingRescheduleHistoryResponseBuilder previousHoldExpiresAt(Instant previousHoldExpiresAt) {
            this.previousHoldExpiresAt = previousHoldExpiresAt;
            return this;
        }

        public BookingRescheduleHistoryResponseBuilder newHoldExpiresAt(Instant newHoldExpiresAt) {
            this.newHoldExpiresAt = newHoldExpiresAt;
            return this;
        }

        public BookingRescheduleHistoryResponseBuilder requesterId(UUID requesterId) {
            this.requesterId = requesterId;
            return this;
        }

        public BookingRescheduleHistoryResponseBuilder requesterName(String requesterName) {
            this.requesterName = requesterName;
            return this;
        }

        public BookingRescheduleHistoryResponseBuilder requesterRole(String requesterRole) {
            this.requesterRole = requesterRole;
            return this;
        }

        public BookingRescheduleHistoryResponseBuilder requestTimestamp(LocalDateTime requestTimestamp) {
            this.requestTimestamp = requestTimestamp;
            return this;
        }

        public BookingRescheduleHistoryResponseBuilder reason(String reason) {
            this.reason = reason;
            return this;
        }

        public BookingRescheduleHistoryResponseBuilder processorId(UUID processorId) {
            this.processorId = processorId;
            return this;
        }

        public BookingRescheduleHistoryResponseBuilder processorName(String processorName) {
            this.processorName = processorName;
            return this;
        }

        public BookingRescheduleHistoryResponseBuilder processorRole(String processorRole) {
            this.processorRole = processorRole;
            return this;
        }

        public BookingRescheduleHistoryResponseBuilder processedAt(LocalDateTime processedAt) {
            this.processedAt = processedAt;
            return this;
        }

        public BookingRescheduleHistoryResponseBuilder outcome(String outcome) {
            this.outcome = outcome;
            return this;
        }

        public BookingRescheduleHistoryResponseBuilder rejectionReason(String rejectionReason) {
            this.rejectionReason = rejectionReason;
            return this;
        }

        public BookingRescheduleHistoryResponseBuilder previousBookingStatus(String previousBookingStatus) {
            this.previousBookingStatus = previousBookingStatus;
            return this;
        }

        public BookingRescheduleHistoryResponseBuilder resultingBookingStatus(String resultingBookingStatus) {
            this.resultingBookingStatus = resultingBookingStatus;
            return this;
        }

        public BookingRescheduleHistoryResponseBuilder contractAmendmentRequired(Boolean contractAmendmentRequired) {
            this.contractAmendmentRequired = contractAmendmentRequired;
            return this;
        }

        public BookingRescheduleHistoryResponseBuilder contractAmendmentNotes(String contractAmendmentNotes) {
            this.contractAmendmentNotes = contractAmendmentNotes;
            return this;
        }

        public BookingRescheduleHistoryResponseBuilder createdAt(LocalDateTime createdAt) {
            this.createdAt = createdAt;
            return this;
        }

        public BookingRescheduleHistoryResponse build() {
            return new BookingRescheduleHistoryResponse(
                    id, bookingId, bookingCode, changeType, previousAppointmentAt, requestedAppointmentAt,
                    acceptedAppointmentAt, previousExpectedStartDate, previousExpectedEndDate,
                    newExpectedStartDate, newExpectedEndDate, previousHoldExpiresAt, newHoldExpiresAt,
                    requesterId, requesterName, requesterRole, requestTimestamp, reason,
                    processorId, processorName, processorRole, processedAt, outcome,
                    rejectionReason, previousBookingStatus, resultingBookingStatus,
                    contractAmendmentRequired, contractAmendmentNotes, createdAt
            );
        }
    }
}

package com.boxora.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class BookingRescheduleEligibilityResponse {
    private UUID bookingId;
    private String bookingCode;
    private String unitCode;
    private String facilityName;
    private boolean eligible;
    private String reasonIfNotEligible;
    private List<String> restrictions;

    private LocalDateTime currentAppointmentAt;
    private LocalDate expectedStartDate;
    private LocalDate expectedEndDate;
    private Integer rentalMonths;

    private BigDecimal monthlyFee;
    private BigDecimal depositAmount;
    private String paymentStatus;

    private String contractStatus;
    private boolean contractSigned;
    private Instant holdExpiresAt;

    private LocalDate allowedMinDate;
    private LocalDate allowedMaxDate;
    private String facilityOpenTime;
    private String facilityCloseTime;

    public static BookingRescheduleEligibilityResponseBuilder builder() {
        return new BookingRescheduleEligibilityResponseBuilder();
    }

    public static class BookingRescheduleEligibilityResponseBuilder {
        private UUID bookingId;
        private String bookingCode;
        private String unitCode;
        private String facilityName;
        private boolean eligible;
        private String reasonIfNotEligible;
        private List<String> restrictions;
        private LocalDateTime currentAppointmentAt;
        private LocalDate expectedStartDate;
        private LocalDate expectedEndDate;
        private Integer rentalMonths;
        private BigDecimal monthlyFee;
        private BigDecimal depositAmount;
        private String paymentStatus;
        private String contractStatus;
        private boolean contractSigned;
        private Instant holdExpiresAt;
        private LocalDate allowedMinDate;
        private LocalDate allowedMaxDate;
        private String facilityOpenTime;
        private String facilityCloseTime;

        BookingRescheduleEligibilityResponseBuilder() {}

        public BookingRescheduleEligibilityResponseBuilder bookingId(UUID bookingId) {
            this.bookingId = bookingId;
            return this;
        }

        public BookingRescheduleEligibilityResponseBuilder bookingCode(String bookingCode) {
            this.bookingCode = bookingCode;
            return this;
        }

        public BookingRescheduleEligibilityResponseBuilder unitCode(String unitCode) {
            this.unitCode = unitCode;
            return this;
        }

        public BookingRescheduleEligibilityResponseBuilder facilityName(String facilityName) {
            this.facilityName = facilityName;
            return this;
        }

        public BookingRescheduleEligibilityResponseBuilder eligible(boolean eligible) {
            this.eligible = eligible;
            return this;
        }

        public BookingRescheduleEligibilityResponseBuilder reasonIfNotEligible(String reasonIfNotEligible) {
            this.reasonIfNotEligible = reasonIfNotEligible;
            return this;
        }

        public BookingRescheduleEligibilityResponseBuilder restrictions(List<String> restrictions) {
            this.restrictions = restrictions;
            return this;
        }

        public BookingRescheduleEligibilityResponseBuilder currentAppointmentAt(LocalDateTime currentAppointmentAt) {
            this.currentAppointmentAt = currentAppointmentAt;
            return this;
        }

        public BookingRescheduleEligibilityResponseBuilder expectedStartDate(LocalDate expectedStartDate) {
            this.expectedStartDate = expectedStartDate;
            return this;
        }

        public BookingRescheduleEligibilityResponseBuilder expectedEndDate(LocalDate expectedEndDate) {
            this.expectedEndDate = expectedEndDate;
            return this;
        }

        public BookingRescheduleEligibilityResponseBuilder rentalMonths(Integer rentalMonths) {
            this.rentalMonths = rentalMonths;
            return this;
        }

        public BookingRescheduleEligibilityResponseBuilder monthlyFee(BigDecimal monthlyFee) {
            this.monthlyFee = monthlyFee;
            return this;
        }

        public BookingRescheduleEligibilityResponseBuilder depositAmount(BigDecimal depositAmount) {
            this.depositAmount = depositAmount;
            return this;
        }

        public BookingRescheduleEligibilityResponseBuilder paymentStatus(String paymentStatus) {
            this.paymentStatus = paymentStatus;
            return this;
        }

        public BookingRescheduleEligibilityResponseBuilder contractStatus(String contractStatus) {
            this.contractStatus = contractStatus;
            return this;
        }

        public BookingRescheduleEligibilityResponseBuilder contractSigned(boolean contractSigned) {
            this.contractSigned = contractSigned;
            return this;
        }

        public BookingRescheduleEligibilityResponseBuilder holdExpiresAt(Instant holdExpiresAt) {
            this.holdExpiresAt = holdExpiresAt;
            return this;
        }

        public BookingRescheduleEligibilityResponseBuilder allowedMinDate(LocalDate allowedMinDate) {
            this.allowedMinDate = allowedMinDate;
            return this;
        }

        public BookingRescheduleEligibilityResponseBuilder allowedMaxDate(LocalDate allowedMaxDate) {
            this.allowedMaxDate = allowedMaxDate;
            return this;
        }

        public BookingRescheduleEligibilityResponseBuilder facilityOpenTime(String facilityOpenTime) {
            this.facilityOpenTime = facilityOpenTime;
            return this;
        }

        public BookingRescheduleEligibilityResponseBuilder facilityCloseTime(String facilityCloseTime) {
            this.facilityCloseTime = facilityCloseTime;
            return this;
        }

        public BookingRescheduleEligibilityResponse build() {
            return new BookingRescheduleEligibilityResponse(
                    bookingId, bookingCode, unitCode, facilityName, eligible, reasonIfNotEligible,
                    restrictions, currentAppointmentAt, expectedStartDate, expectedEndDate,
                    rentalMonths, monthlyFee, depositAmount, paymentStatus, contractStatus,
                    contractSigned, holdExpiresAt, allowedMinDate, allowedMaxDate,
                    facilityOpenTime, facilityCloseTime
            );
        }
    }
}

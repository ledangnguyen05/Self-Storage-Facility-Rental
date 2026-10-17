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
@Builder
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
}

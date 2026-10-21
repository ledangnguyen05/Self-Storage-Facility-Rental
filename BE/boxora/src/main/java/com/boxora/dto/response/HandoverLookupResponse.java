package com.boxora.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Booking summary returned by GET /api/v1/handovers/lookup, used by the front-desk QR scanner and
 * manual code search. Field names mirror BookingResponse so the front end can treat both alike.
 * It never carries the access PIN or QR access token.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class HandoverLookupResponse {
    private UUID id;
    private String bookingCode;
    private UUID customerId;
    private String customerName;
    private String customerPhone;
    private String customerEmail;
    private UUID storageUnitId;
    private String unitCode;
    private String floorLevel;
    private UUID facilityId;
    private String facilityName;
    private LocalDate startDate;
    private LocalDate endDate;
    private Integer rentalMonths;
    private BigDecimal totalRentalFee;
    private BigDecimal depositPaid;
    private BigDecimal depositAmount;
    private String paymentStatus;
    private String status;
    private LocalDateTime expectedCheckInAt;
    private String signingMethod;
    /** true when the unit was already handed over (the booking is ACTIVE or later) */
    private boolean checkedIn;
}

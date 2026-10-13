package com.boxora.dto.response;

import com.boxora.enums.BookingStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BookingResponse {
    private UUID id;
    private String bookingCode;
    private UUID customerId;
    private String customerName;
    private String customerPhone;
    private String customerEmail;
    private UUID storageUnitId;
    private String unitCode;
    private String facilityName;
    private String floorLevel;
    private LocalDate startDate;
    private LocalDate endDate;
    private Integer rentalMonths;
    private BigDecimal totalRentalFee;
    private BigDecimal depositPaid;
    private BigDecimal depositAmount;
    private BigDecimal initialPaymentAmount;
    private Instant paymentExpiresAt;
    private BookingStatus status;
    private String accessPin;
    private String qrAccessToken;
    private LocalDateTime handoverTime;
    private LocalDateTime returnTime;
}

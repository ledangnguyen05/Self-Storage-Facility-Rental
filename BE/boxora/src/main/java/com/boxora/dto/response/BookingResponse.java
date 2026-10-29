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
    private UUID unitTypeId;
    private String unitTypeName;
    private String unitSize;
    private Double areaSqMeters;
    private String dimensions;
    private String unitCode;
    private UUID facilityId;
    private String facilityName;
    private String floorLevel;
    private LocalDate startDate;
    private LocalDateTime expectedArrivalAt;
    private LocalDate endDate;
    private Integer rentalMonths;
    private BigDecimal totalRentalFee;
    private BigDecimal depositPaid;
    private BigDecimal depositAmount;
    private BigDecimal initialPaymentAmount;
    private Instant paymentExpiresAt;
    private Instant holdStartedAt;
    private Instant holdExpiresAt;
    private LocalDateTime expectedCheckInAt;
    private String paymentStatus;
    private Integer holdGraceHours;
    private BookingStatus status;
    private String accessPin;
    private String qrAccessToken;
    private LocalDateTime handoverTime;
    private LocalDateTime returnTime;
    private String signingMethod;
    private UUID assignedStaffId;
    private String assignedStaffName;
    private String staffAssignmentNotes;
    private String identityCardNumber;
    private String identityCardType;
    private UUID contractId;
    private String contractCode;
    private String contractStatus;
    private Boolean contractSigned;
    private LocalDateTime checkinOverdueReminderSentAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}

package com.boxora.entity;

import com.boxora.enums.BookingStatus;
import lombok.*;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.DBRef;
import org.springframework.data.mongodb.core.mapping.Document;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Document(collection = "bookings")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Booking extends BaseEntity {

    @Indexed(unique = true)
    private String bookingCode;

    @DBRef
    private User customer;

    @DBRef
    private StorageUnit storageUnit;

    private LocalDate startDate;

    private LocalDate endDate;

    private Integer rentalMonths;

    private BigDecimal totalRentalFee;

    private BigDecimal depositPaid;

    private BookingStatus status;

    private String accessCode;

    private String accessPin;

    private String qrAccessToken;

    private LocalDateTime pinUpdatedAt;

    private UUID handedOverByStaffId;

    private LocalDateTime handoverTime;

    private LocalDateTime returnTime;
}
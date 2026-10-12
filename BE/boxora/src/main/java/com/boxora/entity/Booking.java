package com.boxora.entity;

import com.boxora.enums.BookingStatus;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "bookings")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Booking extends BaseEntity {

    @Column(name = "booking_code", nullable = false, unique = true, length = 30)
    private String bookingCode;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id", nullable = false)
    private User customer;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "storage_unit_id", nullable = false)
    private StorageUnit storageUnit;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    @Column(name = "rental_months", nullable = false)
    private Integer rentalMonths;

    @Column(name = "total_rental_fee", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalRentalFee;

    @Column(name = "deposit_paid", nullable = false, precision = 12, scale = 2)
    private BigDecimal depositPaid;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    private BookingStatus status;

    @Column(name = "access_code", length = 20)
    private String accessCode;

    @Column(name = "access_pin", length = 255)
    private String accessPin;

    @Column(name = "qr_access_token", length = 255)
    private String qrAccessToken;

    @Column(name = "pin_updated_at")
    private LocalDateTime pinUpdatedAt;

    @Column(name = "handed_over_by_staff_id")
    private UUID handedOverByStaffId;

    @Column(name = "handover_time")
    private LocalDateTime handoverTime;

    @Column(name = "return_time")
    private LocalDateTime returnTime;
}
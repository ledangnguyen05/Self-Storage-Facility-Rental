package com.boxora.entity;

import com.boxora.enums.BookingStatus;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
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
    @JoinColumn(name = "storage_unit_id")
    private StorageUnit storageUnit;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "facility_id")
    private Facility facility;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "unit_type_id")
    private UnitType unitType;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "expected_arrival_at")
    private LocalDateTime expectedArrivalAt;

    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    @Column(name = "rental_months", nullable = false)
    private Integer rentalMonths;

    @Column(name = "total_rental_fee", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalRentalFee;

    @Column(name = "deposit_paid", nullable = false, precision = 12, scale = 2)
    private BigDecimal depositPaid;

    @Column(name = "deposit_amount", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal depositAmount = BigDecimal.ZERO;

    @Column(name = "payment_expires_at")
    private Instant paymentExpiresAt;

    @Column(name = "hold_started_at")
    private Instant holdStartedAt;

    @Column(name = "hold_expires_at")
    private Instant holdExpiresAt;

    @Column(name = "expected_check_in_at")
    private LocalDateTime expectedCheckInAt;

    @Column(name = "payment_status", length = 30)
    @Builder.Default
    private String paymentStatus = "UNPAID";

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

    @Column(name = "contract_signed")
    @Builder.Default
    private Boolean contractSigned = false;

    @Column(name = "signing_method", length = 30)
    @Builder.Default
    private String signingMethod = "ONLINE";

    @Column(name = "staff_assignment_notes", columnDefinition = "TEXT")
    private String staffAssignmentNotes;

    @Column(name = "identity_card_type", length = 30)
    @Builder.Default
    private String identityCardType = "CCCD";

    @Column(name = "identity_card_number", length = 50)
    private String identityCardNumber;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "identity_verified_by_staff_id")
    private User identityVerifiedByStaff;

    @Column(name = "identity_verified_at")
    private LocalDateTime identityVerifiedAt;

    @Column(name = "identity_verification_notes", columnDefinition = "TEXT")
    private String identityVerificationNotes;

    @Column(name = "identity_original_document_seen")
    private Boolean identityOriginalDocumentSeen;

    @Column(name = "step_transition_history", columnDefinition = "TEXT")
    private String stepTransitionHistory;

    @Column(name = "cancellation_reason", length = 500)
    private String cancellationReason;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cancelled_by_id")
    private User cancelledBy;

    @Column(name = "cancelled_at")
    private LocalDateTime cancelledAt;
}

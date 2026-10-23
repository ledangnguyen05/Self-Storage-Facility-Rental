package com.boxora.entity;

import com.boxora.enums.PaymentStatus;
import com.boxora.enums.PaymentType;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "payments")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Payment extends BaseEntity {

    @Column(name = "transaction_id", nullable = false, unique = true, length = 60)
    private String transactionId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "booking_id")
    private Booking booking;

    @Column(name = "amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_type", nullable = false, length = 30)
    private PaymentType paymentType;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    private PaymentStatus status;

    @Column(name = "payment_method", length = 50)
    private String paymentMethod;

    @Column(name = "payment_time", nullable = false)
    private LocalDateTime paymentTime;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contract_id")
    private RentalContract contract; // dùng cho RENEWAL_FEE - booking sẽ null trong trường hợp này

    @Column(name = "renewal_months")
    private Integer renewalMonths; // chỉ set khi paymentType = RENEWAL_FEE, dùng để tính newEndDate lúc webhook confirm

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "collected_by_staff_id")
    private User collectedByStaff;

    @Column(name = "receipt_voucher_code", length = 100)
    private String receiptVoucherCode;

    @Column(name = "reference_code", length = 100)
    private String referenceCode;

    @Column(name = "proof_document_url", length = 500)
    private String proofDocumentUrl;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "confirmed_by_staff_id")
    private User confirmedByStaff;

    @Column(name = "confirmed_at")
    private LocalDateTime confirmedAt;

    @Column(name = "payment_notes", columnDefinition = "TEXT")
    private String paymentNotes;
}
package com.boxora.dto.response;

import com.boxora.enums.PaymentStatus;
import com.boxora.enums.PaymentType;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PaymentResponse {
    private UUID id;
    private String transactionId;

    private UUID bookingId;
    private String bookingCode;

    private UUID contractId;

    private String unitCode;
    private String facilityName;
    private String customerName;

    private BigDecimal amount;
    /**
     * Part of {@code amount} that is security deposit: the whole amount of a DEPOSIT payment, the deposit share of an online
     * BOOKING_PAYMENT (which pays deposit and first month together), 0 otherwise. The cashier ledger uses it to split deposit
     * from rent.
     */
    private BigDecimal depositPortion;
    private PaymentType paymentType;
    private PaymentStatus status;
    private String paymentMethod;

    private LocalDateTime paymentTime;

    private UUID collectedById;
    private String collectedByName;
    private String receiptVoucherCode;
    private String referenceCode;
    private String proofDocumentUrl;
    private UUID confirmedById;
    private String confirmedByName;
    private LocalDateTime confirmedAt;
    private String paymentNotes;

    private String contractCode;
    private BigDecimal lateFeeAmount;
    private BigDecimal overdueRentAmount;
    private Integer extensionDays;
    private Integer renewalMonths;
    private LocalDateTime createdAt;

    /** VNPay result code of the gateway return (00 = success); null for counter payments. */
    private String gatewayResponseCode;
    private String gatewayTransactionStatus;
    /** Vietnamese reason of a FAILED online payment, e.g. "Bạn đã hủy giao dịch (mã 24)." */
    private String failureReason;
    /** True when the bank may have debited the customer although the payment did not succeed. */
    private Boolean mayHaveBeenCharged;
}
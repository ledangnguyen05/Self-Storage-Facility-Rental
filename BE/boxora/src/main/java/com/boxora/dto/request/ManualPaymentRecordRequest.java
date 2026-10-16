package com.boxora.dto.request;

import com.boxora.enums.PaymentType;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.math.BigDecimal;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ManualPaymentRecordRequest {

    @NotNull(message = "Booking ID is required")
    private UUID bookingId;

    @NotNull(message = "Payment obligation type is required (DEPOSIT or RENTAL_FEE)")
    private PaymentType paymentType;

    @NotNull(message = "Payment method is required (CASH or BANK_TRANSFER)")
    private String paymentMethod;

    @NotNull(message = "Amount is required")
    @DecimalMin(value = "1000", message = "Amount must be at least 1,000 VND")
    private BigDecimal amount;

    private String receiptVoucherCode;

    private String referenceCode;

    private String proofDocumentUrl;

    private String notes;
}

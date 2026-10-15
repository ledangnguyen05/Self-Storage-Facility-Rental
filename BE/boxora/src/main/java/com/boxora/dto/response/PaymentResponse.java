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
    private PaymentType paymentType;
    private PaymentStatus status;
    private String paymentMethod;

    private LocalDateTime paymentTime;
}
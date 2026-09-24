package com.boxora.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VNPayPaymentResponse {
    private String paymentUrl;
    private String transactionId;
    private UUID paymentId;
    private UUID bookingId;
    private UUID contractId;
    private BigDecimal amount;
    private String orderInfo;
}

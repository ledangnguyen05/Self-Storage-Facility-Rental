package com.boxora.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PaymentMethodSummaryResponse {
    /** Null/blank or a method unknown to the UI remains unclassified; it is never inferred. */
    private String paymentMethod;
    private Long paymentCount;
    private BigDecimal totalAmount;
    private BigDecimal reconciledAmount;
}

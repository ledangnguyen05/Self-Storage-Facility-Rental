package com.boxora.dto.request;

import com.boxora.enums.PaymentType;
import jakarta.validation.constraints.*;
import lombok.*;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PaymentCreateRequest {

    private UUID bookingId;

    private UUID contractId;

    @NotNull(message = "Payment type is required")
    private PaymentType paymentType;

    @NotNull(message = "Amount is required")
    @DecimalMin(value = "1000", message = "Amount must be at least 1,000 VND")
    private BigDecimal amount;

    @Size(max = 255, message = "Order info must not exceed 255 characters")
    private String orderInfo;
}
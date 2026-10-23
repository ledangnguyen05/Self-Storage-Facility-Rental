package com.boxora.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.math.BigDecimal;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RefundCreateRequest {

    private UUID bookingId;

    private UUID contractId;

    @NotNull(message = "requestedAmount is required")
    @DecimalMin(value = "1000", message = "Số tiền hoàn tối thiểu là 1,000 VND")
    private BigDecimal requestedAmount;

    @Builder.Default
    private BigDecimal deductionAmount = BigDecimal.ZERO;

    @NotBlank(message = "bankName is required")
    private String bankName;

    @NotBlank(message = "bankAccountNumber is required")
    private String bankAccountNumber;

    @NotBlank(message = "bankAccountName is required")
    private String bankAccountName;

    @NotBlank(message = "reason is required")
    private String reason;
}

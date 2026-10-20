package com.boxora.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ContractRenewalCounterPaymentRequest {

    @NotBlank(message = "Phương thức thanh toán không được để trống")
    private String paymentMethod;

    private String receiptVoucherCode;
    private String notes;
}

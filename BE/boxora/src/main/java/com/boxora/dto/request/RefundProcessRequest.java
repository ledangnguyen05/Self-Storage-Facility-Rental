package com.boxora.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RefundProcessRequest {

    @NotBlank(message = "transactionReference is required (mã giao dịch ngân hàng / VNPay)")
    private String transactionReference;

    private String processNotes;
}

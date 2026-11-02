package com.boxora.dto.request;

import jakarta.validation.constraints.DecimalMin;
import lombok.*;

import java.math.BigDecimal;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OverdueSettlementRequest {

    private String paymentMethod; // CASH or BANK_TRANSFER

    private String receiptVoucherCode; // Mã phiếu thu tại quầy

    private String referenceCode; // Mã đối chiếu chuyển khoản

    private String proofDocumentUrl; // Chứng từ ảnh thanh toán

    @DecimalMin(value = "0", message = "Số tiền thanh toán không được âm")
    private BigDecimal amount;

    private String notes;
}

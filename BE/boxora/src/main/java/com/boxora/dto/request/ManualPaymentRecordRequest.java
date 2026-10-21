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

    @NotNull(message = "Thiếu mã đơn đặt kho")
    private UUID bookingId;

    @NotNull(message = "Chọn khoản cần thu: tiền cọc hoặc tiền thuê tháng đầu")
    private PaymentType paymentType;

    @NotNull(message = "Chọn phương thức thu: tiền mặt hoặc chuyển khoản")
    private String paymentMethod;

    @NotNull(message = "Nhập số tiền thu")
    @DecimalMin(value = "1000", message = "Số tiền tối thiểu 1.000 ₫")
    private BigDecimal amount;

    private String receiptVoucherCode;

    private String referenceCode;

    private String proofDocumentUrl;

    private String notes;
}

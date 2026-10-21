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

    @NotNull(message = "Vui lòng chọn đơn đặt kho cần thanh toán")
    private UUID bookingId;

    private UUID contractId;

    /** Only BOOKING_PAYMENT is accepted online; defaults to BOOKING_PAYMENT. */
    private PaymentType paymentType;

    /**
     * Optional amount the customer saw. The server always charges its own computed amount and rejects the
     * request when this differs by more than 1.000 VND (the price changed since the page was loaded).
     */
    @DecimalMin(value = "0", message = "Số tiền không hợp lệ")
    private BigDecimal amount;

    @Size(max = 255, message = "Nội dung thanh toán tối đa 255 ký tự")
    private String orderInfo;
}
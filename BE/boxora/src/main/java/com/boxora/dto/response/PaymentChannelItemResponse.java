package com.boxora.dto.response;

import lombok.*;

import java.math.BigDecimal;

/** Một kênh thanh toán (VNPAY, BANK_TRANSFER, CASH, ... hoặc OTHER khi chưa ghi nhận phương thức). */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PaymentChannelItemResponse {
    private String method;
    private long count;
    private BigDecimal amount;
}

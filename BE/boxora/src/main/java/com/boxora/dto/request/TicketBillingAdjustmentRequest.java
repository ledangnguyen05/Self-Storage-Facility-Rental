package com.boxora.dto.request;

import lombok.*;
import java.math.BigDecimal;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TicketBillingAdjustmentRequest {
    private BigDecimal amount;
    private String note;
    private Boolean isRefund;
}

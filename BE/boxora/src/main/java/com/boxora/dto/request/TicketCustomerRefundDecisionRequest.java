package com.boxora.dto.request;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TicketCustomerRefundDecisionRequest {
    private boolean agreed;
    private String note;
    private String bankName;
    private String bankAccountNumber;
    private String bankAccountName;
}

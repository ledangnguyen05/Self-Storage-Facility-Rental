package com.boxora.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/** Returned only after the reminder email was actually handed to the mail server. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OverdueReminderResponse {
    private UUID contractId;
    private String contractCode;
    private String sentTo;
    private LocalDateTime sentAt;
    private int daysOverdue;
    private BigDecimal totalDebt;
    private int reminderCount;
}

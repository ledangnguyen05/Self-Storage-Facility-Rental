package com.boxora.dto.response;

import lombok.*;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RenewalReminderScanResponse {

    private int scannedContractsCount;
    private int sevenDayRemindersSent;
    private int threeDayRemindersSent;
    private LocalDateTime scanTimestamp;
}

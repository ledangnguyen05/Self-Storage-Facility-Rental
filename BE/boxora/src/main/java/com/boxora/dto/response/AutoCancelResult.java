package com.boxora.dto.response;

import lombok.*;

import java.time.LocalDateTime;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AutoCancelResult {

    private LocalDateTime executedAt;
    private int scannedCount;
    private int cancelledCount;
    private int unitsReleasedCount;
    private List<AutoCancelDetail> cancelledBookings;
}


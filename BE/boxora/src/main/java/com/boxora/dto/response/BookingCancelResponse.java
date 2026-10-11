package com.boxora.dto.response;

import com.boxora.enums.BookingStatus;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BookingCancelResponse {

    private UUID bookingId;
    private String bookingCode;
    private BookingStatus status;
    private String milestoneStage;
    private double refundPercentage;
    private BigDecimal refundAmount;
    private BigDecimal penaltyAmount;
    private String refundTransactionId;
    private boolean unitReleased;
    private LocalDateTime cancelledAt;
    private String cancellationReason;
    private String message;
}


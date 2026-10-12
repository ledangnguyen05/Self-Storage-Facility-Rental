package com.boxora.dto.response;

import com.boxora.enums.RefundStatus;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RefundRequestResponse {

    private UUID id;
    private String requestCode;

    private UUID customerId;
    private String customerName;
    private String customerEmail;
    private String customerPhone;

    private UUID facilityId;
    private String facilityName;

    private UUID bookingId;
    private String bookingCode;

    private UUID contractId;
    private String contractCode;

    private BigDecimal requestedAmount;
    private BigDecimal deductionAmount;
    private BigDecimal finalRefundAmount;

    private String bankName;
    private String bankAccountNumber;
    private String bankAccountName;

    private String reason;
    private RefundStatus status;

    private UUID requestedById;
    private String requestedByName;
    private LocalDateTime createdAt;

    private UUID reviewedById;
    private String reviewedByName;
    private LocalDateTime reviewedAt;
    private String reviewNote;
    private String rejectionReason;

    private UUID processedById;
    private String processedByName;
    private LocalDateTime processedAt;
    private String transactionReference;
    private String processNotes;
}

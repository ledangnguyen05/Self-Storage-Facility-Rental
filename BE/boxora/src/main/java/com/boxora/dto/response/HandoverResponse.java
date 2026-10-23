package com.boxora.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class HandoverResponse {
    private UUID id;
    private UUID bookingId;
    private String bookingCode;
    private String unitCode;
    private String customerName;
    private UUID staffId;
    private String staffName;
    private String recordType;
    private String unitCondition;

    // --- Bổ sung chi tiết quyết toán trả kho (Return & Deposit Settlement) ---
    private BigDecimal depositSettled;
    private BigDecimal deductionAmount;
    private BigDecimal refundAmount;
    private String reviewStatus;
    private Integer depositRefundSlaDays;
    private String refundTransactionId;
    private Boolean checklistAllPassed;
    private String checklistSummary;
    private List<String> evidencePhotos;

    private String notes;
    private LocalDateTime recordedAt;

    // --- Cấp quyền truy cập SmartLock phát hành bởi máy chủ ---
    private String accessPin;
    private String qrAccessToken;
}

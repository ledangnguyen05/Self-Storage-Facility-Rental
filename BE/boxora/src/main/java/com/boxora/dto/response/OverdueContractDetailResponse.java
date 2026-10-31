package com.boxora.dto.response;

import com.boxora.enums.OverduePinStatus;
import com.boxora.enums.OverdueSealingStatus;
import com.boxora.enums.OverdueStage;
import com.boxora.enums.PinRevocationExecutionStatus;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OverdueContractDetailResponse {
    private UUID contractId;
    private String contractCode;
    private UUID bookingId;
    private String bookingCode;
    private UUID unitId;
    private String unitCode;
    private UUID facilityId;
    private String facilityName;
    private UUID customerId;
    private String customerName;
    private String customerPhone;
    private String customerEmail;

    private LocalDate startDate;
    private LocalDate dueDate;
    private long daysOverdue;

    private BigDecimal principalDebt;
    private BigDecimal dailyLateFee;
    private BigDecimal lateFee;
    private BigDecimal totalDebt;
    private BigDecimal unverifiedAmount;
    private BigDecimal depositHeld;

    private OverdueStage stage;
    private String stageLabel;
    private String feeFormulaExplanation;

    private OverduePinStatus pinStatus;
    private OverdueSealingStatus sealingStatus;
    private String smartLockOnlineStatus;
    private Boolean smartLockIsMock;
    private String maskedPin;
    private LocalDateTime smartLockLastUnlockedAt;
    private LocalDateTime tempPinGrantedUntil;
    private String tempPinGrantReason;

    private Boolean isDemo;
    private Boolean hasActivePolicy;
    private String policyWarning;

    // Sub-records
    private List<PaymentHistoryDto> payments;
    private List<NoticeLogDto> reminders;
    private List<PinRevocationDto> pinRequests;
    private SealingDossierDto sealingDossier;
    private List<AuditLogDto> auditLogs;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class PaymentHistoryDto {
        private UUID paymentId;
        private String transactionId;
        private BigDecimal amount;
        private String paymentType;
        private String status;
        private String paymentMethod;
        private LocalDateTime paymentTime;
        private String receiptVoucherCode;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class NoticeLogDto {
        private UUID id;
        private String channel;
        private String templateType;
        private String content;
        private String sentByName;
        private LocalDateTime sentAt;
        private String deliveryStatus;
        private String notes;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class PinRevocationDto {
        private UUID id;
        private String requestCode;
        private String reason;
        private PinRevocationExecutionStatus status;
        private Boolean isMock;
        private String errorMessage;
        private Integer retryCount;
        private String requestedByName;
        private LocalDateTime requestedAt;
        private LocalDateTime executedAt;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class SealingDossierDto {
        private UUID sealingRecordId;
        private String protocolNumber;
        private String sealTagNumber;
        private String status;
        private String requestStatus;
        private String reason;
        private LocalDateTime sealedAt;
        private String sealedByName;
        private String witnessName;
        private String approvedByName;
        private LocalDateTime approvedAt;
        private String rejectionReason;
        private String inventorySummary;
        private String notes;
        private List<AssetInventoryDto> items;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class AssetInventoryDto {
        private UUID id;
        private String itemName;
        private Integer quantity;
        private String conditionStatus;
        private BigDecimal estimatedValue;
        private String notes;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class AuditLogDto {
        private UUID id;
        private String action;
        private String performedByName;
        private String performedByRole;
        private String beforeState;
        private String afterState;
        private String details;
        private LocalDateTime createdAt;
    }
}

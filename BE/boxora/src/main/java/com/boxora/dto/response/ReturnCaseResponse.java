package com.boxora.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReturnCaseResponse {
    private String id;
    private UUID bookingId;
    private String bookingCode;
    private String contractCode;
    private String unitCode;
    private String customerName;
    private String customerPhone;
    private String customerEmail;
    private UUID facilityId;
    private String facilityName;
    private LocalDate requestDate;
    private LocalDate expectedReturnDate;
    private LocalDateTime inspectionDate;
    private String reason;
    private String bankName;
    private String bankAccountNumber;
    private String bankAccountName;
    private BigDecimal depositAmount;
    private BigDecimal outstandingDebt;
    private BigDecimal cleaningFee;
    private BigDecimal damageFee;
    private BigDecimal doorFee;
    private BigDecimal smartLockFee;
    private BigDecimal wallStructureFee;
    private BigDecimal lostCardFee;
    private BigDecimal totalDeduction;
    private BigDecimal approvedDeductions;
    private BigDecimal netRefundAmount;
    private BigDecimal additionalAmountDue;
    private String status;
    private String inspectionStatus;
    private String approvalStatus;
    private String additionalPaymentStatus;
    private String additionalPaymentTxnRef;
    private String refundStatus;
    private String refundTxnRef;
    private LocalDateTime refundProcessedAt;
    private String inspectorName;
    private String approverName;
    private LocalDateTime approvedAt;
    private String approvalNotes;
    private LocalDateTime completedAt;
    private List<String> historyNotes;

    // 7 Checklist Criteria
    private Boolean doorPassed;
    private String doorNotes;
    private BigDecimal doorFeeInput;

    private Boolean cleanlinessPassed;
    private String cleanlinessNotes;
    private BigDecimal cleaningFeeInput;

    private Boolean damagePassed;
    private String damageNotes;
    private BigDecimal damageFeeInput;

    private Boolean smartLockPassed;
    private String smartLockNotes;
    private BigDecimal smartLockFeeInput;
    private String smartLockIssueType;

    private Boolean assetsClearedPassed;
    private String assetsClearedNotes;

    private List<String> photoUrls;

    private Boolean envPassed;
    private String envNotes;

    private Boolean unitReturnedPhysically;
    private LocalDateTime returnedAt;
    private Boolean accessRevoked;
    private LocalDateTime accessRevokedAt;
    private String postReturnUnitStatus;
}

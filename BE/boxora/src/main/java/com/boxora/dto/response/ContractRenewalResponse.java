package com.boxora.dto.response;

import com.boxora.enums.ContractRenewalStatus;
import com.boxora.enums.PaymentStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ContractRenewalResponse {

    private UUID id;
    private UUID contractId;
    private String contractCode;

    private UUID customerId;
    private String customerName;
    private String customerEmail;

    private UUID facilityId;
    private String facilityName;
    private String unitCode;

    private LocalDate oldEndDate;
    private LocalDate newEndDate;
    private Integer cycleMonths;
    private BigDecimal renewalFee;

    private ContractRenewalStatus status;

    private UUID paymentId;
    private PaymentStatus paymentStatus;
    private String paymentMethod;
    private LocalDate counterAppointmentDate;
    private String counterAppointmentTime;
    private String receiptVoucherCode;
    private String cashierStaffName;
    private LocalDateTime paidAt;

    private Long docusealSubmissionId;
    private String docusealSubmitterSlug;
    private String signingUrl;
    private String signedDocumentUrl;
    private LocalDateTime signedAt;
    private String signatureData;

    private UUID reviewedById;
    private String reviewedByName;
    private LocalDateTime reviewedAt;
    private String rejectionReason;
    private String notes;

    private UUID assignedStaffId;
    private String assignedStaffName;
    private String assignedStaffEmail;
    private LocalDateTime assignedStaffAt;

    private Boolean identityVerified;
    private String identityDocType;
    private String identityNumber;
    private String identityNotes;

    private Boolean unitAudited;
    private String unitAuditNotes;

    private Boolean noBlockingIssues;
    private String blockingNotes;

    private Boolean termsConfirmed;
    private String termsNotes;

    private Boolean paymentConfirmed;

    private UUID handledById;
    private String handledByName;
    private LocalDateTime handledAt;

    private String receptionNotes;

    // Quy tắc nghiệp vụ thời điểm check-in (Lịch hẹn tiếp đón)
    private Boolean checkInTimeMet;
    private String checkInTimeStatus; // BEFORE_DATE | BEFORE_TIME | ON_TIME | LATE
    private String checkInTimeMessage;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}

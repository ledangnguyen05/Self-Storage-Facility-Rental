package com.boxora.dto.response;

import com.boxora.enums.RentalContractStatus;
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
public class RentalContractResponse {

    private UUID id;
    private String contractCode;

    private UUID customerId;
    private String customerName;
    private String customerEmail;
    private String customerPhone;

    /** Storage unit UUID (same value as {@code unitId}, kept for the portal contract). */
    private UUID storageUnitId;
    private UUID unitId;
    private String unitCode;

    private UUID facilityId;
    private String facilityName;

    private UUID bookingId;
    private String bookingCode;
    private String bookingStatus;
    private Integer rentalMonths;

    private LocalDate startDate;
    private LocalDate endDate;
    private BigDecimal monthlyFee;
    private BigDecimal depositHeld;
    /** Deposit agreed in the booking (PricingService quote); depositHeld is what was actually collected. */
    private BigDecimal depositAmount;

    private RentalContractStatus status;

    private Long docusealSubmissionId;
    private String docusealSubmitterSlug;
    private String signingUrl;
    private String signedDocumentUrl;
    private LocalDateTime signedAt;
    private String signatureData;

    private String signingMethod;
    private String paperContractUrl;
    private String paperOriginalLocation;
    private UUID paperVerifiedById;
    private String paperVerifiedByName;
    private LocalDateTime paperVerifiedAt;
    private String paperNotes;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    // ---- Renewal eligibility (facility policy renewalWindowDays / overdueGraceDays), filled by the service ----
    /** True when a renewal request is accepted today. */
    private Boolean renewable;
    /** First day a renewal request is accepted. */
    private java.time.LocalDate renewalOpensOn;
    /** Last day a renewal request is accepted (null: no limit while the contract is overdue). */
    private java.time.LocalDate renewalClosesOn;
    /** Why the renewal is not available today (Vietnamese, for the customer). */
    private String renewalBlockedReason;
    private Integer renewalWindowDays;
    /** Open renewal request (PENDING_SIGNATURE / PENDING_PAYMENT), if any. */
    private UUID pendingRenewalId;
    /** True when DocuSeal is not configured and contracts are signed in-app (test environment). */
    private Boolean signingSimulated;
}

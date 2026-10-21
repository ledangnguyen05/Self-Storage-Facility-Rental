package com.boxora.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * One overdue contract in the manager ledger. Money comes from {@code OverdueFeeCalculator}; customer and
 * facility fields are null when the source data has none (never placeholder values).
 * {@code totalDebt = max(0, unpaidRent + totalLateFee - paidSinceDue)}.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.ALWAYS)
public class OverdueLedgerItemResponse {

    private UUID contractId;
    private String contractCode;
    private String contractStatus;

    private UUID bookingId;
    private String bookingCode;
    private String bookingStatus;

    private UUID customerId;
    private String customerName;
    private String customerPhone;
    private String customerEmail;

    private UUID unitId;
    private String unitCode;
    private String unitStatus;

    private UUID facilityId;
    private String facilityName;

    private LocalDate startDate;
    /** Contract end date (rent was paid up to this day). */
    private LocalDate dueDate;
    private int daysOverdue;

    /** Facility policy applied to this row. */
    private int graceDays;
    private int accessDisableDays;
    private int sealingDays;
    private boolean defaultPolicy;

    private BigDecimal monthlyFee;
    /** Rent for the time kept after the due date: one monthly fee per started 30-day block. */
    private BigDecimal unpaidRent;
    private BigDecimal dailyLateFee;
    /** Days the late fee is charged for (days past the grace period). */
    private int chargeableLateDays;
    private BigDecimal totalLateFee;
    /** Rent or extra-charge payments received after the due date, deducted from the debt. */
    private BigDecimal paidSinceDue;
    private BigDecimal totalDebt;

    /** GRACE_PERIOD, WARNING, ACCESS_BLOCKED or ELIGIBLE_FOR_SEALING. */
    private String overdueStage;

    /** The tenant PIN/QR is revoked or the unit is locked for debt. */
    private boolean accessLocked;
    private LocalDateTime accessLockedAt;
    /** Manager reprieve: access stays open and the nightly job does not lock it again before this date. */
    private LocalDate accessHoldUntil;

    private boolean sealed;
    private UUID sealingRecordId;
    private String sealingProtocolNumber;
    private LocalDateTime sealedAt;

    private LocalDateTime lastReminderAt;
    /** SENT or FAILED. */
    private String lastReminderStatus;
    private int reminderCount;
    /** Late fee persisted by the nightly job for this episode (null before the first run). */
    private BigDecimal accruedLateFee;
    private LocalDate lastAssessedOn;

    private boolean canRemind;
    private boolean canLockout;
    private boolean canSeal;
    private boolean canRestoreAccess;
    private boolean canUnseal;
}

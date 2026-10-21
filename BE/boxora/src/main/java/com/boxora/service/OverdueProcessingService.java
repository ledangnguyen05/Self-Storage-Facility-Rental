package com.boxora.service;

import com.boxora.dto.response.AccessRestorationResponse;
import com.boxora.dto.response.LockoutResponse;
import com.boxora.dto.response.OverdueLedgerResponse;
import com.boxora.dto.response.OverdueProcessResult;
import com.boxora.dto.response.OverdueReminderResponse;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Overdue lifecycle of rental contracts, driven by each facility policy through {@link OverdueFeeCalculator}:
 * ledger, nightly assessment (late fee persisted, access lockout, sealing eligibility), manual lockout,
 * access restoration and reminders.
 */
public interface OverdueProcessingService {

    /**
     * Runs the overdue assessment. FACILITY_MANAGER is limited to their facility and to today;
     * ADMIN / BUSINESS_MANAGER may process every facility and pass a simulated reference date.
     */
    OverdueProcessResult processOverdueContracts(LocalDate referenceDate, UUID facilityId);

    /** Facility-scoped overdue ledger (contracts ACTIVE past their end date, OVERDUE, OVERDUE_LOCKED, or EXPIRED but never returned). */
    OverdueLedgerResponse getOverdueLedger(UUID facilityId);

    /** Revokes the PIN/QR and locks the unit. Only from the access-disable day of the facility policy. */
    LockoutResponse lockoutContract(UUID contractId, String reason);

    /**
     * Same as above; {@code overrideAccessHold} is required to lock while a manager-granted access hold is still running
     * (then {@code reason} must be a real written reason).
     */
    LockoutResponse lockoutContract(UUID contractId, String reason, boolean overrideAccessHold);

    /** Manager action "Mở khóa truy cập". */
    AccessRestorationResponse restoreAccess(UUID contractId, String reason, LocalDate holdUntil);

    /** Emails the overdue notice synchronously; succeeds only when the mail server accepted it. */
    OverdueReminderResponse sendReminder(UUID contractId);
}

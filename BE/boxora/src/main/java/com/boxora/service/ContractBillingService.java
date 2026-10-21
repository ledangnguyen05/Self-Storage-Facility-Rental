package com.boxora.service;

import com.boxora.dto.response.ContractOutstandingResponse;
import com.boxora.entity.Booking;
import com.boxora.entity.Payment;
import com.boxora.entity.RentalContract;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Rent billing of a rental contract after check-in: what is owed today (rent of started monthly
 * periods, late fee and overdue rent of an expired contract), what happens when it is paid, and the
 * renewal window. Amounts come from the booking (priced by PricingService), the recorded payments and
 * {@link OverdueFeeCalculator}; nothing is taken from the client.
 */
public interface ContractBillingService {

    /** Outstanding balance of a contract the caller may see (customer: own contract; staff: own facility). */
    ContractOutstandingResponse getOutstanding(UUID contractId);

    /** Outstanding balance without access checks (server-side callers). */
    ContractOutstandingResponse computeOutstanding(RentalContract contract, LocalDate asOf);

    /** Discounted monthly rent of the contract (booking total / months, else the contract monthly fee). */
    BigDecimal monthlyRent(RentalContract contract);

    /** Throws FORBIDDEN / FACILITY_ACCESS_DENIED when the caller may not act on the contract. */
    void assertContractAccess(RentalContract contract);

    /**
     * Applies a PAID RENTAL_FEE payment of a contract: moves the end date by the paid overdue blocks and,
     * when an OVERDUE / OVERDUE_LOCKED contract is fully settled, restores access.
     */
    void applyRentalPayment(Payment payment);

    /**
     * Restores access of a settled overdue contract through {@link AccessRestorationService} after the
     * current transaction commits (so a failure there never rolls back the payment).
     */
    void restoreAccessAfterCommit(RentalContract contract, String reason);

    /** Copies the deposit collected on the booking to its contract (deposit held). */
    void syncContractDeposit(Booking booking);

    /** Renewal window of a contract for today, from the facility policy. */
    RenewalWindow renewalWindow(RentalContract contract, LocalDate asOf);

    record RenewalWindow(boolean renewable, LocalDate opensOn, LocalDate closesOn, int windowDays, String blockedReason) {
    }
}

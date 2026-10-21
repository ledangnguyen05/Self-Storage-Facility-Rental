package com.boxora.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * What a customer owes on a rental contract today, computed on the server from the booking terms
 * (PricingService amounts stored on the booking), the recorded payments and the overdue rule
 * ({@code OverdueFeeCalculator}). The portal shows it and pays exactly {@code totalDueNow}
 * (+ optional upcoming months) through {@code POST /payments/contracts/{id}/outstanding/vnpay}.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ContractOutstandingResponse {

    private UUID contractId;
    private String contractCode;
    private String contractStatus;
    private UUID bookingId;
    private String bookingCode;
    private String unitCode;
    private String facilityName;

    /** First day of the rental term (check-in). */
    private LocalDate termStartDate;
    /** End of the original booked term (renewals are prepaid and not billed here). */
    private LocalDate termEndDate;
    /** Current contract end date (moves with renewals and overdue settlements). */
    private LocalDate contractEndDate;
    private Integer termMonths;

    /** Discounted monthly rent the customer was quoted (booking total / months). */
    private BigDecimal monthlyRent;
    /** Monthly periods started so far (rent is billed at the start of each period). */
    private Integer billedMonths;
    private BigDecimal rentDue;
    private BigDecimal rentPaid;
    /** Rent of started periods not paid yet. */
    private BigDecimal rentOutstanding;
    /** Periods of the term not started yet and not prepaid. */
    private Integer remainingTermMonths;
    private BigDecimal remainingTermRent;
    private LocalDate nextRentDueDate;

    private boolean overdue;
    private int overdueDays;
    /** Late fee from the facility policy (dailyLateFee x days after the grace period). */
    private BigDecimal lateFee;
    /** Rent for the time the unit was kept after the end date (one monthly fee per started 30-day block). */
    private BigDecimal overdueRent;
    /** Days the contract end date moves forward when the overdue settlement is paid. */
    private int extensionDays;
    private LocalDate paidThroughAfterSettlement;

    /** rentOutstanding + lateFee + overdueRent. */
    private BigDecimal totalDueNow;
    private boolean canPayOnline;
    /** Why paying online is not possible (Vietnamese), when canPayOnline is false. */
    private String blockedReason;
    /** Customer-facing explanation (Vietnamese). */
    private String note;

    private List<Item> items;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Item {
        /** RENT_OUTSTANDING, LATE_FEE, OVERDUE_RENT. */
        private String code;
        private String label;
        private BigDecimal amount;
    }
}

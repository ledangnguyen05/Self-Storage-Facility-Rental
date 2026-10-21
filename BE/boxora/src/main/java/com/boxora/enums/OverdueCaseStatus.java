package com.boxora.enums;

/** Lifecycle of one overdue episode of a rental contract. */
public enum OverdueCaseStatus {
    /** The contract is past its end date and the late fee keeps accruing. */
    OPEN,
    /** Settled: the contract was renewed or the debt was paid; access was restored. */
    SETTLED,
    /** Closed without settlement through this flow (contract returned, terminated or cancelled). */
    CLOSED
}

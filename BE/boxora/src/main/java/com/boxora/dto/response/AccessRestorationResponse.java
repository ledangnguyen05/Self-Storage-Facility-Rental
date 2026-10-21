package com.boxora.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.UUID;

/** Outcome of lifting an overdue lockout (manager action, unseal or settled payment). */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AccessRestorationResponse {
    private UUID contractId;
    private String contractCode;
    private String unitCode;
    private String contractStatus;
    private String bookingStatus;
    private String unitStatus;
    /** The tenant can open the unit again (booking ACTIVE with a PIN). */
    private boolean accessRestored;
    /** A new PIN/QR was issued; the tenant sees it in the customer portal. */
    private boolean pinReissued;
    /** Nothing is outstanding any more: the contract is ACTIVE and the overdue episode is settled. */
    private boolean settled;
    /** When the debt is still open: the nightly job will not lock access again before this date. */
    private LocalDate accessHoldUntil;
    /** The unit is still sealed; a manager must remove the seal first. */
    private boolean sealed;
    private String message;
    /** True only when the tenant email was accepted by the mail server; null when no email applies. */
    private Boolean customerNotified;
    /** Vietnamese explanation of how the tenant was told (in-app notification, email outcome). */
    private String notificationMessage;
}

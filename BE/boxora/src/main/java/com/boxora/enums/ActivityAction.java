package com.boxora.enums;

import java.util.Arrays;
import java.util.List;

public enum ActivityAction {
    // Authentication. A routine sign-in is not "critical" (it would drown the filter: most rows are sign-ins);
    // a failed one is, because repeated failures are what an operator looks for.
    LOGIN_SUCCESS(false), LOGIN_FAILED(true), LOGOUT(false),
    PASSWORD_CHANGE(true), PASSWORD_RESET_REQUESTED(false), PASSWORD_RESET_COMPLETED(true),
    REFRESH_TOKEN_REVOKED(false),

    // User / Role / Permission
    USER_CREATE(false), USER_UPDATE(false), USER_DEACTIVATE(true), USER_ACTIVATE(true),
    USER_ASSIGN_ROLE(true), USER_ASSIGN_FACILITY_SCOPE(true),
    ROLE_CREATE(false), ROLE_UPDATE(false), ROLE_DELETE(true),
    PERMISSION_CREATE(false), PERMISSION_UPDATE(false), PERMISSION_DELETE(true),
    ROLE_PERMISSION_ASSIGN(true), ROLE_PERMISSION_REVOKE(true),

    // Facility & Policy
    FACILITY_CREATE(false), FACILITY_UPDATE(false), FACILITY_DEACTIVATE(true),
    UNIT_TYPE_CREATE(false), UNIT_TYPE_UPDATE(false), UNIT_TYPE_DELETE(false),
    PRICE_CREATE(false), PRICE_UPDATE(true),
    FACILITY_POLICY_CREATE(false), FACILITY_POLICY_UPDATE(true),
    FACILITY_POLICY_DELETE(true), FACILITY_POLICY_EXCEPTION(true),
    FEE_CREATE(false), FEE_UPDATE(false), FEE_WAIVE(true),
    DISCOUNT_CREATE(false), DISCOUNT_UPDATE(false), DISCOUNT_ACTIVATE(false), DISCOUNT_DEACTIVATE(false),

    // Storage Unit
    STORAGE_UNIT_CREATE(false), STORAGE_UNIT_UPDATE(false), STORAGE_UNIT_STATUS_CHANGE(true),
    STORAGE_UNIT_ASSIGN(true), STORAGE_UNIT_RELEASE(false),

    // Reservation & Payment
    RESERVATION_CREATE(false), RESERVATION_UPDATE(false), RESERVATION_CANCEL(false), RESERVATION_EXPIRE(false),
    PAYMENT_INITIATED(false), PAYMENT_CONFIRMED(true), PAYMENT_FAILED(false),
    PAYMENT_DUPLICATE_IGNORED(false),
    CONTRACT_CREATE(true), CONTRACT_SIGNED(true),

    // Check-in / Handover / Access
    CHECKIN_RESCHEDULE(true), CHECKIN_VERIFIED(false), HANDOVER_COMPLETE(true),
    ACCESS_CREDENTIAL_ISSUE(true), ACCESS_CREDENTIAL_UPDATE(false), ACCESS_CREDENTIAL_REVOKE(true),
    MASTER_KEY_OVERRIDE(true),

    // Renewal & Overdue
    RENEWAL_REQUEST(false), RENEWAL_PAID(false), CONTRACT_EXTENDED(false),
    OVERDUE_DETECTED(false), OVERDUE_ACCESS_DISABLED(true), OVERDUE_SEALING_APPROVED(true),
    OVERDUE_UNIT_LOCKED(true), OVERDUE_REMINDER_SENT(false),

    // Checkout & Refund
    CHECKOUT_REQUEST(false), CHECKOUT_INSPECTION_COMPLETE(false), DAMAGE_FEE_RECORDED(true),
    REFUND_REQUEST_CREATE(false), REFUND_APPROVE(true), REFUND_PROCESS(true), REFUND_PROCESSED(true),
    REFUND_CONFIRM(false), REFUND_RECONCILE(true),

    // Support & Staff
    SUPPORT_TICKET_CREATE(false), SUPPORT_TICKET_UPDATE(false), SUPPORT_TICKET_ASSIGN(false),
    SUPPORT_TICKET_RESOLVE(false), SUPPORT_TICKET_CLOSE(false), SUPPORT_TICKET_REOPEN(false),
    SUPPORT_TICKET_CONTACT_BOM(true),
    STAFF_ASSIGNMENT_CREATE(false), STAFF_ASSIGNMENT_UPDATE(false), STAFF_ASSIGNMENT_REMOVE(false),

    // Reports
    REPORT_EXPORTED(false);

    private final boolean critical;

    ActivityAction(boolean critical) {
        this.critical = critical;
    }

    public boolean isCritical() {
        return critical;
    }

    /** LOGIN_SUCCESS/LOGIN_FAILED -> LOGIN, LOGOUT -> LOGOUT, everything else -> DATA_ACTION. */
    public ActivityLogType category() {
        return switch (this) {
            case LOGIN_SUCCESS, LOGIN_FAILED -> ActivityLogType.LOGIN;
            case LOGOUT -> ActivityLogType.LOGOUT;
            default -> ActivityLogType.DATA_ACTION;
        };
    }

    public static List<ActivityAction> criticalActions() {
        return Arrays.stream(values()).filter(ActivityAction::isCritical).toList();
    }
}
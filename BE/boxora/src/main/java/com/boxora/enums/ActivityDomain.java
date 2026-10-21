package com.boxora.enums;

import java.util.List;

import static com.boxora.enums.ActivityAction.*;

/**
 * Business areas of the audit log. The admin screen filters "everything that happened in this area" with one
 * parameter ({@code domain}); the area is defined by the {@link ActivityAction}s it contains, so it stays correct
 * whatever free-form resource type a service writes.
 */
public enum ActivityDomain {

    /** Sign-in, sign-out and password events. */
    AUTH(LOGIN_SUCCESS, LOGIN_FAILED, LOGOUT, PASSWORD_CHANGE, PASSWORD_RESET_REQUESTED,
            PASSWORD_RESET_COMPLETED, REFRESH_TOKEN_REVOKED),

    /** Accounts, roles and permissions. */
    ACCOUNT(USER_CREATE, USER_UPDATE, USER_DEACTIVATE, USER_ACTIVATE, USER_ASSIGN_ROLE, USER_ASSIGN_FACILITY_SCOPE,
            ROLE_CREATE, ROLE_UPDATE, ROLE_DELETE, PERMISSION_CREATE, PERMISSION_UPDATE, PERMISSION_DELETE,
            ROLE_PERMISSION_ASSIGN, ROLE_PERMISSION_REVOKE),

    /** Facilities, policies, price lists, fees, discounts and storage units. */
    FACILITY(FACILITY_CREATE, FACILITY_UPDATE, FACILITY_DEACTIVATE, UNIT_TYPE_CREATE, UNIT_TYPE_UPDATE,
            UNIT_TYPE_DELETE, PRICE_CREATE, PRICE_UPDATE, FACILITY_POLICY_CREATE, FACILITY_POLICY_UPDATE,
            FACILITY_POLICY_DELETE, FACILITY_POLICY_EXCEPTION, FEE_CREATE, FEE_UPDATE, FEE_WAIVE, DISCOUNT_CREATE, DISCOUNT_UPDATE, DISCOUNT_ACTIVATE,
            DISCOUNT_DEACTIVATE, STORAGE_UNIT_CREATE, STORAGE_UNIT_UPDATE, STORAGE_UNIT_STATUS_CHANGE,
            STORAGE_UNIT_ASSIGN, STORAGE_UNIT_RELEASE),

    /** Bookings, contracts, check-in, renewals and check-out. */
    BOOKING(RESERVATION_CREATE, RESERVATION_UPDATE, RESERVATION_CANCEL, RESERVATION_EXPIRE, CONTRACT_CREATE,
            CONTRACT_SIGNED, CHECKIN_RESCHEDULE, CHECKIN_VERIFIED, RENEWAL_REQUEST, RENEWAL_PAID, CONTRACT_EXTENDED,
            CHECKOUT_REQUEST, CHECKOUT_INSPECTION_COMPLETE),

    /** Payments, damage fees and refunds. */
    PAYMENT(PAYMENT_INITIATED, PAYMENT_CONFIRMED, PAYMENT_FAILED, PAYMENT_DUPLICATE_IGNORED, DAMAGE_FEE_RECORDED,
            REFUND_REQUEST_CREATE, REFUND_APPROVE, REFUND_PROCESS, REFUND_PROCESSED, REFUND_CONFIRM, REFUND_RECONCILE),

    /** Hand-over, access codes and master-key use. */
    ACCESS(HANDOVER_COMPLETE, ACCESS_CREDENTIAL_ISSUE, ACCESS_CREDENTIAL_UPDATE, ACCESS_CREDENTIAL_REVOKE,
            MASTER_KEY_OVERRIDE),

    /** Overdue detection, lock-out and sealing. */
    OVERDUE(OVERDUE_DETECTED, OVERDUE_ACCESS_DISABLED, OVERDUE_SEALING_APPROVED, OVERDUE_UNIT_LOCKED,
            OVERDUE_REMINDER_SENT),

    /** Support tickets and staff rosters. */
    SUPPORT(SUPPORT_TICKET_CREATE, SUPPORT_TICKET_UPDATE, SUPPORT_TICKET_ASSIGN, SUPPORT_TICKET_RESOLVE,
            SUPPORT_TICKET_CLOSE, SUPPORT_TICKET_REOPEN, SUPPORT_TICKET_CONTACT_BOM, STAFF_ASSIGNMENT_CREATE,
            STAFF_ASSIGNMENT_UPDATE, STAFF_ASSIGNMENT_REMOVE),

    /** Report exports. */
    REPORT(REPORT_EXPORTED);

    private final List<ActivityAction> actions;

    ActivityDomain(ActivityAction... actions) {
        this.actions = List.of(actions);
    }

    public List<ActivityAction> actions() {
        return actions;
    }
}

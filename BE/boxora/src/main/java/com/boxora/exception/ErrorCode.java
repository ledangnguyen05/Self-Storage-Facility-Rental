package com.boxora.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
public enum ErrorCode {

    // ========================= ROLE (100 - 199) =========================
    ROLE_NOT_FOUND(100, "Role not found", HttpStatus.NOT_FOUND),
    ROLE_NAME_EXISTED(101, "Role name already exists", HttpStatus.BAD_REQUEST),
    CANNOT_DELETE_SYSTEM_ROLE(102, "Cannot delete default system role", HttpStatus.FORBIDDEN),
    CANNOT_MODIFY_SYSTEM_ROLE(103, "Cannot modify name of default system role", HttpStatus.FORBIDDEN),
    ROLE_IN_USE(104, "Cannot delete role because it is currently assigned to users", HttpStatus.CONFLICT),
    ROLE_INACTIVE(105, "Role is inactive", HttpStatus.BAD_REQUEST),

    // ========================= USER (200 - 299) =========================
    USER_NOT_FOUND(200, "User not found", HttpStatus.NOT_FOUND),
    USER_ALREADY_EXISTS(201, "Username already exists", HttpStatus.BAD_REQUEST),
    EMAIL_ALREADY_EXISTS(202, "Email already exists", HttpStatus.BAD_REQUEST),
    USER_INACTIVE(203, "User is inactive", HttpStatus.FORBIDDEN),

    // ========================= AUTH (300 - 399) =========================
    INVALID_CREDENTIALS(300, "Invalid email or password", HttpStatus.UNAUTHORIZED),
    UNAUTHORIZED(301, "Authentication is required", HttpStatus.UNAUTHORIZED),
    FORBIDDEN(302, "You do not have permission to access this resource", HttpStatus.FORBIDDEN),

    // ========================= TOKEN (400 - 499) =========================
    INVALID_TOKEN(400, "Invalid refresh token", HttpStatus.UNAUTHORIZED),
    TOKEN_EXPIRED(401, "Token has expired", HttpStatus.UNAUTHORIZED),
    TOKEN_REVOKED(402, "Token has been revoked", HttpStatus.UNAUTHORIZED),
    INVALID_REFRESH_TOKEN(403, "Invalid refresh token", HttpStatus.UNAUTHORIZED),

    // ========================= PASSWORD (500 - 599) =========================
    PASSWORD_MISMATCH(500, "Passwords do not match", HttpStatus.BAD_REQUEST),
    INVALID_OLD_PASSWORD(501, "Current password is incorrect", HttpStatus.BAD_REQUEST),
    NEW_PASSWORD_SAME_AS_OLD(502, "New password must be different from the old password", HttpStatus.BAD_REQUEST),
    INVALID_RESET_TOKEN(503, "Invalid or expired password reset token(refreshToken)", HttpStatus.BAD_REQUEST),

    // ========================= SYSTEM (600 - 699) =========================
    INTERNAL_SERVER_ERROR(600, "Internal server error", HttpStatus.INTERNAL_SERVER_ERROR),
    INVALID_REQUEST(601, "Invalid request", HttpStatus.BAD_REQUEST),

    // ========================= BOOKING & ACCESS (700 - 799) =================
    BOOKING_NOT_FOUND(700, "Booking not found or does not belong to user", HttpStatus.NOT_FOUND),
    BOOKING_NOT_CHECKED_IN(701, "Storage unit has not been checked in yet", HttpStatus.FORBIDDEN),
    INVALID_PIN_FORMAT(702, "PIN must be exactly 6 digits", HttpStatus.BAD_REQUEST),
    UNIT_TYPE_NOT_FOUND(703, "Unit type not found", HttpStatus.NOT_FOUND),
    STORAGE_UNIT_NOT_FOUND(704, "Storage unit not found", HttpStatus.NOT_FOUND),
    INVALID_PRICING_TARGET(705, "Provide either unitTypeId or storageUnitId, but not both or neither", HttpStatus.BAD_REQUEST),
    UNIT_TYPE_PRICE_NOT_CONFIGURED(706, "Unit type monthly price is not configured", HttpStatus.INTERNAL_SERVER_ERROR),
    NO_AVAILABLE_UNIT(707, "No available storage unit found for the selected type and facility", HttpStatus.CONFLICT),

    // ========================= PAYMENT (750 - 799) =========================
    PAYMENT_NOT_FOUND(750, "Payment transaction not found", HttpStatus.NOT_FOUND),
    PAYMENT_ALREADY_PROCESSED(751, "Payment has already been processed", HttpStatus.CONFLICT),
    INVALID_PAYMENT_SIGNATURE(752, "Invalid VNPay payment signature", HttpStatus.BAD_REQUEST),
    PAYMENT_AMOUNT_MISMATCH(753, "Payment amount does not match booking requirement", HttpStatus.BAD_REQUEST),
    PAYMENT_FAILED(754, "Payment transaction failed or was cancelled", HttpStatus.BAD_REQUEST),

    // ========================= ROLE_PERMISSION (800 - 899) =========================
    ROLE_PERMISSION_NOT_FOUND(800, "Role-permission mapping not found", HttpStatus.NOT_FOUND),
    ROLE_PERMISSION_ALREADY_EXISTS(801, "This permission is already assigned to the role", HttpStatus.BAD_REQUEST),

    // ========================= PERMISSION (900 - 999) =========================
    PERMISSION_NOT_FOUND(900, "Permission not found", HttpStatus.NOT_FOUND),
    PERMISSION_NAME_EXISTED(901, "Permission name already exists", HttpStatus.BAD_REQUEST),
    PERMISSION_GROUP_EXISTED(902, "Permission group already exists", HttpStatus.BAD_REQUEST),
    PERMISSION_IN_USE(903, "Cannot delete permission because it is currently assigned to roles", HttpStatus.CONFLICT),
    PERMISSION_INACTIVE(904, "Permission is inactive", HttpStatus.BAD_REQUEST),

    // ========================= FACILITY (1000 - 1099) =========================
    FACILITY_NOT_FOUND(1000, "Facility not found", HttpStatus.NOT_FOUND),
    FACILITY_CODE_EXISTED(1001, "Facility code already exists", HttpStatus.BAD_REQUEST),
    INVALID_MANAGER_TO_ASSIGN(1002,"Invalid manager to assign for this facility",HttpStatus.BAD_REQUEST),
    FACILITY_ACCESS_DENIED(1003, "You do not have access to this facility's data", HttpStatus.FORBIDDEN),

    // ========================= FACILITY_POLICY (1100 - 1199) =========================
    FACILITY_POLICY_NOT_FOUND(1100, "Facility policy not found", HttpStatus.NOT_FOUND),
    FACILITY_POLICY_ALREADY_EXISTS(1101, "This facility already has a policy configured", HttpStatus.BAD_REQUEST),
    FACILITY_POLICY_INVALID_CANCELLATION(1102, "Cancellation full refund hours must be greater than or equal to partial refund hours", HttpStatus.BAD_REQUEST),

    // ========================= SUPPORT_TICKET (1200 - 1299) =========================
    TICKET_NOT_FOUND(1200, "Support ticket not found or does not belong to user", HttpStatus.NOT_FOUND),

    // ========================= ACTIVITY_LOG (1300 - 1399) =========================
    ACTIVITY_LOG_NOT_FOUND(1300, "Activity log entry not found", HttpStatus.NOT_FOUND);
    private final int code;
    private final String message;
    private final HttpStatus httpStatus;

    ErrorCode(int code, String message, HttpStatus httpStatus) {
        this.code = code;
        this.message = message;
        this.httpStatus = httpStatus;
    }
}

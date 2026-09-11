package com.boxora.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
public enum ErrorCode {

    // ========================= ROLE (100 - 199) =========================
    ROLE_NOT_FOUND(100, "Role not found", HttpStatus.NOT_FOUND),
    ROLE_NAME_EXISTED(101, "Role name already exists", HttpStatus.BAD_REQUEST),

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
    INVALID_REQUEST(601, "Invalid request", HttpStatus.BAD_REQUEST);


    private final int code;
    private final String message;
    private final HttpStatus httpStatus;

    ErrorCode(int code, String message, HttpStatus httpStatus) {
        this.code = code;
        this.message = message;
        this.httpStatus = httpStatus;
    }
}
package com.boxora.exception;

import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.sql.SQLException;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    // =========================
    // App Exception
    // =========================

    @ExceptionHandler(AppException.class)
    public ResponseEntity<Map<String, Object>> handleAppException(AppException ex) {

        ErrorCode errorCode = ex.getErrorCode();

        Map<String, Object> response = new LinkedHashMap<>();

        response.put("timestamp", LocalDateTime.now());
        response.put("status", errorCode.getHttpStatus().value());
        response.put("code", errorCode.getCode());
        response.put("error", errorCode.getHttpStatus().getReasonPhrase());
        response.put("message", ex.getMessage() != null && !ex.getMessage().isBlank() ? ex.getMessage() : errorCode.getMessage());

        return ResponseEntity
                .status(errorCode.getHttpStatus())
                .body(response);
    }


    // =========================
    // Validation Exception
    // =========================

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidationException(
            MethodArgumentNotValidException ex) {

        Map<String, String> errors = new LinkedHashMap<>();

        ex.getBindingResult()
                .getFieldErrors()
                .forEach(error ->
                        errors.put(
                                error.getField(),
                                error.getDefaultMessage()
                        )
                );

        Map<String, Object> response = new LinkedHashMap<>();

        response.put("timestamp", LocalDateTime.now());
        response.put("status", 400);
        response.put("code", ErrorCode.INVALID_REQUEST.getCode());
        response.put("error", "Bad Request");
        String detailedErrors = errors.entrySet().stream()
                .map(entry -> entry.getKey() + ": " + entry.getValue())
                .reduce((a, b) -> a + "; " + b)
                .orElse("Vui lòng kiểm tra lại các trường thông tin");
        response.put("message", "Dữ liệu yêu cầu không hợp lệ (" + detailedErrors + ").");
        response.put("errors", errors);

        return ResponseEntity
                .badRequest()
                .body(response);
    }


    // =========================
    // Security Exceptions
    // =========================

    @ExceptionHandler(org.springframework.security.access.AccessDeniedException.class)
    public ResponseEntity<Map<String, Object>> handleAccessDeniedException(
            org.springframework.security.access.AccessDeniedException ex) {

        var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        boolean isAnonymous = auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal());

        ErrorCode errorCode = isAnonymous ? ErrorCode.UNAUTHORIZED : ErrorCode.FORBIDDEN;
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("timestamp", LocalDateTime.now());
        response.put("status", errorCode.getHttpStatus().value());
        response.put("code", errorCode.getCode());
        response.put("error", errorCode.getHttpStatus().getReasonPhrase());
        response.put("message", errorCode.getMessage());

        return ResponseEntity
                .status(errorCode.getHttpStatus())
                .body(response);
    }

    @ExceptionHandler(org.springframework.security.core.AuthenticationException.class)
    public ResponseEntity<Map<String, Object>> handleAuthenticationException(
            org.springframework.security.core.AuthenticationException ex) {

        ErrorCode errorCode = ErrorCode.UNAUTHORIZED;
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("timestamp", LocalDateTime.now());
        response.put("status", errorCode.getHttpStatus().value());
        response.put("code", errorCode.getCode());
        response.put("error", errorCode.getHttpStatus().getReasonPhrase());
        response.put("message", errorCode.getMessage());

        return ResponseEntity
                .status(errorCode.getHttpStatus())
                .body(response);
    }


    // =========================
    // Database & SQL Exceptions (Protect against exposing raw JDBC/SQL table/column details)
    // =========================

    @ExceptionHandler({DataAccessException.class, SQLException.class})
    public ResponseEntity<Map<String, Object>> handleDatabaseException(Exception ex) {
        log.error("Database or SQL operation failed: ", ex);

        ErrorCode errorCode = ErrorCode.INTERNAL_SERVER_ERROR;

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("timestamp", LocalDateTime.now());
        response.put("status", errorCode.getHttpStatus().value());
        response.put("code", errorCode.getCode());
        response.put("error", errorCode.getHttpStatus().getReasonPhrase());
        response.put("message", "Hệ thống đang gặp sự cố khi xử lý dữ liệu. Vui lòng liên hệ quản trị viên hoặc thử lại sau.");

        return ResponseEntity
                .status(errorCode.getHttpStatus())
                .body(response);
    }

    // =========================
    // Unexpected Exception
    // =========================

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleException(Exception ex) {
        log.error("Unhandled server exception: ", ex);

        ErrorCode errorCode = ErrorCode.INTERNAL_SERVER_ERROR;

        Map<String, Object> response = new LinkedHashMap<>();

        response.put("timestamp", LocalDateTime.now());
        response.put("status", errorCode.getHttpStatus().value());
        response.put("code", errorCode.getCode());
        response.put("error", errorCode.getHttpStatus().getReasonPhrase());

        // Sanitize any underlying SQL/database error messages that might leak table/column details
        String rawMsg = ex.getMessage() != null ? ex.getMessage() : errorCode.getMessage();
        String lowerMsg = rawMsg.toLowerCase();
        if (lowerMsg.contains("sql") || lowerMsg.contains("column") || lowerMsg.contains("relation") || lowerMsg.contains("jdbc") || lowerMsg.contains("hibernate")) {
            response.put("message", "Hệ thống đang gặp sự cố khi xử lý dữ liệu. Vui lòng liên hệ quản trị viên hoặc thử lại sau.");
        } else {
            response.put("message", rawMsg);
        }

        return ResponseEntity
                .status(errorCode.getHttpStatus())
                .body(response);
    }
}
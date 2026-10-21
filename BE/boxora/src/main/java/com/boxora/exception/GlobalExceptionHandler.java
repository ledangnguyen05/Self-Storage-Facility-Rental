package com.boxora.exception;

import com.boxora.config.JwtAuthenticationFilter;
import com.boxora.security.ApiAuthenticationEntryPoint;
import com.fasterxml.jackson.databind.exc.InvalidFormatException;
import com.fasterxml.jackson.databind.JsonMappingException;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.InvalidDataAccessApiUsageException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.data.mapping.PropertyReferenceException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.validation.BindException;
import org.springframework.validation.FieldError;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * One place that turns every failure into the same JSON body
 * ({@code timestamp, status, code, error, message[, errors]}) with a Vietnamese message.
 * Client mistakes (bad UUID / enum, malformed JSON, missing parameter, wrong method...) are 4xx, never 500,
 * and unexpected server faults never echo internal exception text to the caller.
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    // =========================
    // App Exception
    // =========================

    @ExceptionHandler(AppException.class)
    public ResponseEntity<Map<String, Object>> handleAppException(AppException ex) {

        ErrorCode errorCode = ex.getErrorCode();

        Map<String, Object> response = body(
                errorCode.getHttpStatus(),
                errorCode.getCode(),
                ex.getMessage() != null && !ex.getMessage().isBlank() ? ex.getMessage() : errorCode.getMessage());

        return ResponseEntity
                .status(errorCode.getHttpStatus())
                .body(response);
    }


    // =========================
    // Validation Exceptions (400)
    // =========================

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidationException(
            MethodArgumentNotValidException ex) {
        return validationResponse(ex.getBindingResult().getFieldErrors());
    }

    /** Binding failures of query / form objects (@ModelAttribute). */
    @ExceptionHandler(BindException.class)
    public ResponseEntity<Map<String, Object>> handleBindException(BindException ex) {
        return validationResponse(ex.getBindingResult().getFieldErrors());
    }

    /** Violations of constraints declared on controller parameters (@Validated + @Min / @Size / ...). */
    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<Map<String, Object>> handleConstraintViolation(ConstraintViolationException ex) {
        Map<String, String> errors = new LinkedHashMap<>();
        for (ConstraintViolation<?> violation : ex.getConstraintViolations()) {
            String path = violation.getPropertyPath() == null ? "" : violation.getPropertyPath().toString();
            String field = path.contains(".") ? path.substring(path.lastIndexOf('.') + 1) : path;
            errors.putIfAbsent(field, violation.getMessage());
        }
        return invalid(errors.values().stream().findFirst().orElse("Dữ liệu không hợp lệ"), errors);
    }

    /** `?facilityId=abc`, `/bookings/<not-a-uuid>`, `?status=BOGUS`. */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<Map<String, Object>> handleTypeMismatch(MethodArgumentTypeMismatchException ex) {
        Class<?> required = ex.getRequiredType();
        String expected = required == null ? "" : describeType(required);
        String message = "Giá trị của tham số '" + ex.getName() + "' không hợp lệ"
                + (expected.isEmpty() ? "." : " (cần " + expected + ").");
        return invalid(message, null);
    }

    /** Malformed JSON, wrong field types, unknown enum constants. */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, Object>> handleUnreadableBody(HttpMessageNotReadableException ex) {
        String message = "Dữ liệu gửi lên không đúng định dạng.";
        Throwable cause = ex.getCause();
        if (cause instanceof InvalidFormatException invalidFormat && !invalidFormat.getPath().isEmpty()) {
            String field = invalidFormat.getPath().stream()
                    .map(JsonMappingException.Reference::getFieldName)
                    .filter(name -> name != null && !name.isBlank())
                    .collect(Collectors.joining("."));
            if (!field.isEmpty()) {
                message = "Giá trị của trường '" + field + "' không hợp lệ.";
            }
        } else if (ex.getMessage() != null && ex.getMessage().startsWith("Required request body is missing")) {
            message = "Thiếu nội dung yêu cầu.";
        }
        return invalid(message, null);
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<Map<String, Object>> handleMissingParameter(MissingServletRequestParameterException ex) {
        return invalid("Thiếu tham số bắt buộc: " + ex.getParameterName() + ".", null);
    }

    @ExceptionHandler(MissingServletRequestPartException.class)
    public ResponseEntity<Map<String, Object>> handleMissingPart(MissingServletRequestPartException ex) {
        return invalid("Thiếu tệp hoặc phần dữ liệu bắt buộc: " + ex.getRequestPartName() + ".", null);
    }

    /** `sortBy=foo` on a derived Spring Data query. */
    @ExceptionHandler(PropertyReferenceException.class)
    public ResponseEntity<Map<String, Object>> handleUnknownProperty(PropertyReferenceException ex) {
        return invalid("Tiêu chí sắp xếp hoặc lọc '" + ex.getPropertyName() + "' không hợp lệ.", null);
    }

    /**
     * `sortBy=foo` on a @Query / Specification endpoint surfaces from Hibernate as an
     * InvalidDataAccessApiUsageException ("Could not resolve attribute 'foo'"): a client mistake, not a server fault.
     */
    @ExceptionHandler(InvalidDataAccessApiUsageException.class)
    public ResponseEntity<Map<String, Object>> handleInvalidDataAccessUsage(InvalidDataAccessApiUsageException ex) {
        for (Throwable cause = ex; cause != null; cause = cause.getCause() == cause ? null : cause.getCause()) {
            String message = cause.getMessage();
            if (cause instanceof PropertyReferenceException
                    || cause.getClass().getSimpleName().equals("UnknownPathException")
                    || (message != null && message.contains("Could not resolve attribute"))) {
                return invalid("Tiêu chí sắp xếp hoặc lọc không hợp lệ.", null);
            }
        }
        return handleException(ex);
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Map<String, Object>> handleUploadTooLarge(MaxUploadSizeExceededException ex) {
        return error(HttpStatus.PAYLOAD_TOO_LARGE, ErrorCode.INVALID_REQUEST.getCode(),
                "Tệp tải lên quá lớn. Vui lòng chọn tệp nhỏ hơn.");
    }


    // =========================
    // Routing / protocol (404, 405, 415)
    // =========================

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<Map<String, Object>> handleMethodNotAllowed(HttpRequestMethodNotSupportedException ex) {
        return error(HttpStatus.METHOD_NOT_ALLOWED, ErrorCode.INVALID_REQUEST.getCode(),
                "Phương thức " + ex.getMethod() + " không được hỗ trợ cho đường dẫn này.");
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<Map<String, Object>> handleUnsupportedMediaType(HttpMediaTypeNotSupportedException ex) {
        return error(HttpStatus.UNSUPPORTED_MEDIA_TYPE, ErrorCode.INVALID_REQUEST.getCode(),
                "Định dạng nội dung gửi lên không được hỗ trợ.");
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<Map<String, Object>> handleNoResource(NoResourceFoundException ex) {
        return error(HttpStatus.NOT_FOUND, ErrorCode.RESOURCE_NOT_FOUND.getCode(), ErrorCode.RESOURCE_NOT_FOUND.getMessage());
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, Object>> handleResponseStatus(ResponseStatusException ex) {
        HttpStatusCode status = ex.getStatusCode();
        String message = status.is4xxClientError()
                ? (ex.getReason() != null && !ex.getReason().isBlank() ? ex.getReason() : ErrorCode.INVALID_REQUEST.getMessage())
                : ErrorCode.INTERNAL_SERVER_ERROR.getMessage();
        return error(status, status.value() == 404 ? ErrorCode.RESOURCE_NOT_FOUND.getCode() : ErrorCode.INVALID_REQUEST.getCode(), message);
    }


    // =========================
    // Persistence conflicts (409)
    // =========================

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, Object>> handleDataIntegrity(DataIntegrityViolationException ex) {
        String detail = rootMessage(ex);
        log.warn("Data integrity violation: {}", detail);
        if (detail != null && detail.toLowerCase().contains("value too long")) {
            return invalid("Một trường nhập vào quá dài. Vui lòng rút gọn nội dung rồi thử lại.", null);
        }
        return error(HttpStatus.CONFLICT, ErrorCode.INVALID_REQUEST.getCode(),
                "Không thể thực hiện vì dữ liệu đã tồn tại hoặc đang được sử dụng ở nơi khác.");
    }

    @ExceptionHandler(OptimisticLockingFailureException.class)
    public ResponseEntity<Map<String, Object>> handleOptimisticLock(OptimisticLockingFailureException ex) {
        return error(HttpStatus.CONFLICT, ErrorCode.INVALID_REQUEST.getCode(),
                "Dữ liệu vừa được người khác thay đổi. Vui lòng tải lại và thử lại.");
    }


    // =========================
    // Security Exceptions
    // =========================

    @ExceptionHandler(org.springframework.security.access.AccessDeniedException.class)
    public ResponseEntity<Map<String, Object>> handleAccessDeniedException(
            org.springframework.security.access.AccessDeniedException ex) {

        if (isAnonymousCaller()) {
            // An endpoint that is open to everyone at the URL level but protected by @PreAuthorize: the caller is
            // not signed in (or sent an expired / invalid token), which is a 401 the web app can act on, not a 403.
            String failure = currentAuthFailure();
            ErrorCode unauthenticated = ApiAuthenticationEntryPoint.errorCodeFor(failure);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .header(HttpHeaders.WWW_AUTHENTICATE, ApiAuthenticationEntryPoint.challengeFor(failure))
                    .body(body(HttpStatus.UNAUTHORIZED, unauthenticated.getCode(), unauthenticated.getMessage()));
        }

        ErrorCode errorCode = ErrorCode.FORBIDDEN;
        return error(errorCode.getHttpStatus(), errorCode.getCode(), errorCode.getMessage());
    }

    @ExceptionHandler(org.springframework.security.core.AuthenticationException.class)
    public ResponseEntity<Map<String, Object>> handleAuthenticationException(
            org.springframework.security.core.AuthenticationException ex) {

        ErrorCode errorCode = ex instanceof org.springframework.security.authentication.BadCredentialsException
                ? ErrorCode.INVALID_CREDENTIALS
                : ErrorCode.UNAUTHORIZED;
        return error(errorCode.getHttpStatus(), errorCode.getCode(), errorCode.getMessage());
    }


    // =========================
    // Unexpected Exception
    // =========================

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleException(Exception ex) {
        // Full details go to the log; the caller only gets a safe, generic message.
        log.error("Unhandled exception", ex);

        ErrorCode errorCode = ErrorCode.INTERNAL_SERVER_ERROR;
        return error(errorCode.getHttpStatus(), errorCode.getCode(), errorCode.getMessage());
    }


    // =========================
    // Helpers
    // =========================

    private static boolean isAnonymousCaller() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication == null
                || authentication instanceof AnonymousAuthenticationToken
                || !authentication.isAuthenticated();
    }

    /** Why the Bearer token of the current request was rejected (see JwtAuthenticationFilter), or null. */
    private static String currentAuthFailure() {
        RequestAttributes attributes = RequestContextHolder.getRequestAttributes();
        if (attributes == null) {
            return null;
        }
        Object failure = attributes.getAttribute(JwtAuthenticationFilter.AUTH_FAILURE_ATTRIBUTE, RequestAttributes.SCOPE_REQUEST);
        return failure instanceof String name ? name : null;
    }

    private ResponseEntity<Map<String, Object>> validationResponse(java.util.List<FieldError> fieldErrors) {
        Map<String, String> errors = new LinkedHashMap<>();
        fieldErrors.forEach(error -> errors.putIfAbsent(error.getField(), error.getDefaultMessage()));
        String message = errors.values().stream()
                .filter(m -> m != null && !m.isBlank())
                .findFirst()
                .orElse("Dữ liệu không hợp lệ");
        return invalid(message, errors);
    }

    private ResponseEntity<Map<String, Object>> invalid(String message, Map<String, String> errors) {
        Map<String, Object> response = body(HttpStatus.BAD_REQUEST, ErrorCode.INVALID_REQUEST.getCode(), message);
        if (errors != null && !errors.isEmpty()) {
            response.put("errors", errors);
        }
        return ResponseEntity.badRequest().body(response);
    }

    private ResponseEntity<Map<String, Object>> error(HttpStatusCode status, int code, String message) {
        return ResponseEntity.status(status).body(body(status, code, message));
    }

    private Map<String, Object> body(HttpStatusCode status, int code, String message) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("timestamp", LocalDateTime.now());
        response.put("status", status.value());
        response.put("code", code);
        response.put("error", status instanceof HttpStatus httpStatus ? httpStatus.getReasonPhrase() : String.valueOf(status.value()));
        response.put("message", message);
        return response;
    }

    private static String describeType(Class<?> type) {
        if (type.isEnum()) {
            return "một trong: " + java.util.Arrays.stream(type.getEnumConstants())
                    .map(Object::toString)
                    .collect(Collectors.joining(", "));
        }
        String name = type.getSimpleName();
        return switch (name) {
            case "UUID" -> "mã định danh UUID hợp lệ";
            case "LocalDate" -> "ngày dạng yyyy-MM-dd";
            case "LocalDateTime" -> "ngày giờ dạng yyyy-MM-ddTHH:mm:ss";
            case "Integer", "Long", "int", "long", "Short", "short" -> "số nguyên";
            case "BigDecimal", "Double", "double", "Float", "float" -> "số";
            case "Boolean", "boolean" -> "true hoặc false";
            default -> "";
        };
    }

    private static String rootMessage(Throwable ex) {
        Throwable root = ex;
        while (root.getCause() != null && root.getCause() != root) {
            root = root.getCause();
        }
        return root.getMessage();
    }
}

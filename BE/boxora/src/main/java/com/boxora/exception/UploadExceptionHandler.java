package com.boxora.exception;

import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Turns the multipart failures of evidence / contract-scan uploads into clear Vietnamese 400 responses.
 * The generic handler would answer them with a 500 and Spring's English message.
 */
@RestControllerAdvice
@Order(Ordered.HIGHEST_PRECEDENCE)
public class UploadExceptionHandler {

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Map<String, Object>> handleTooLarge(MaxUploadSizeExceededException ex) {
        return body(ErrorCode.FILE_TOO_LARGE, ErrorCode.FILE_TOO_LARGE.getMessage());
    }

    @ExceptionHandler(MissingServletRequestPartException.class)
    public ResponseEntity<Map<String, Object>> handleMissingPart(MissingServletRequestPartException ex) {
        return body(ErrorCode.FILE_UPLOAD_EMPTY, ErrorCode.FILE_UPLOAD_EMPTY.getMessage());
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<Map<String, Object>> handleMissingParameter(MissingServletRequestParameterException ex) {
        String message = "file".equals(ex.getParameterName()) || "files".equals(ex.getParameterName())
                ? ErrorCode.FILE_UPLOAD_EMPTY.getMessage()
                : "Thiếu tham số bắt buộc: " + ex.getParameterName();
        return body(ErrorCode.INVALID_REQUEST, message);
    }

    @ExceptionHandler(MultipartException.class)
    public ResponseEntity<Map<String, Object>> handleMultipart(MultipartException ex) {
        return body(ErrorCode.FILE_UPLOAD_FAILED, "Yêu cầu tải tệp không hợp lệ. Hãy chọn lại tệp và thử lại");
    }

    private ResponseEntity<Map<String, Object>> body(ErrorCode code, String message) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("timestamp", LocalDateTime.now());
        response.put("status", 400);
        response.put("code", code.getCode());
        response.put("error", "Bad Request");
        response.put("message", message);
        return ResponseEntity.badRequest().body(response);
    }
}

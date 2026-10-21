package com.boxora.exception;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.InvalidDataAccessApiUsageException;
import org.springframework.http.HttpInputMessage;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import org.springframework.http.HttpMethod;

import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    private static void assertBody(ResponseEntity<Map<String, Object>> response, HttpStatus status, int code) {
        assertEquals(status, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertEquals(status.value(), body.get("status"));
        assertEquals(code, body.get("code"));
        assertNotNull(body.get("timestamp"));
        assertTrue(body.get("message") instanceof String m && !m.isBlank());
    }

    @Test
    @DisplayName("UUID sai trong query/path (?facilityId=abc) -> 400 tiếng Việt, không phải 500")
    void badUuidIs400() {
        MethodArgumentTypeMismatchException ex = new MethodArgumentTypeMismatchException(
                "abc", UUID.class, "facilityId", null, new IllegalArgumentException("Invalid UUID string: abc"));

        ResponseEntity<Map<String, Object>> response = handler.handleTypeMismatch(ex);

        assertBody(response, HttpStatus.BAD_REQUEST, ErrorCode.INVALID_REQUEST.getCode());
        String message = (String) response.getBody().get("message");
        assertTrue(message.contains("facilityId"), message);
        assertFalse(message.contains("Invalid UUID string"), "internal text must not leak");
    }

    private enum Colour { RED, GREEN }

    @Test
    @DisplayName("Giá trị enum sai (?status=BOGUS) -> 400 và liệt kê giá trị hợp lệ")
    void badEnumIs400() {
        MethodArgumentTypeMismatchException ex = new MethodArgumentTypeMismatchException(
                "BOGUS", Colour.class, "status", null, new IllegalArgumentException("No enum constant"));

        ResponseEntity<Map<String, Object>> response = handler.handleTypeMismatch(ex);

        assertBody(response, HttpStatus.BAD_REQUEST, ErrorCode.INVALID_REQUEST.getCode());
        assertTrue(((String) response.getBody().get("message")).contains("RED, GREEN"));
    }

    @Test
    @DisplayName("JSON hỏng -> 400, không lộ 'JSON parse error'")
    void malformedJsonIs400() {
        HttpMessageNotReadableException ex = new HttpMessageNotReadableException(
                "JSON parse error: Unexpected character ('b' (code 98))", mock(HttpInputMessage.class));

        ResponseEntity<Map<String, Object>> response = handler.handleUnreadableBody(ex);

        assertBody(response, HttpStatus.BAD_REQUEST, ErrorCode.INVALID_REQUEST.getCode());
        assertFalse(((String) response.getBody().get("message")).contains("JSON parse error"));
    }

    @Test
    @DisplayName("Thiếu tham số bắt buộc -> 400 nêu tên tham số")
    void missingParameterIs400() {
        ResponseEntity<Map<String, Object>> response =
                handler.handleMissingParameter(new MissingServletRequestParameterException("code", "String"));

        assertBody(response, HttpStatus.BAD_REQUEST, ErrorCode.INVALID_REQUEST.getCode());
        assertTrue(((String) response.getBody().get("message")).contains("code"));
    }

    @Test
    @DisplayName("ConstraintViolationException -> 400 với thông báo của ràng buộc")
    void constraintViolationIs400() {
        ConstraintViolation<?> violation = mock(ConstraintViolation.class);
        jakarta.validation.Path path = mock(jakarta.validation.Path.class);
        when(path.toString()).thenReturn("list.size");
        when(violation.getPropertyPath()).thenReturn(path);
        when(violation.getMessage()).thenReturn("phải nhỏ hơn hoặc bằng 100");

        ResponseEntity<Map<String, Object>> response = handler.handleConstraintViolation(new ConstraintViolationException(Set.of(violation)));

        assertBody(response, HttpStatus.BAD_REQUEST, ErrorCode.INVALID_REQUEST.getCode());
        assertEquals("phải nhỏ hơn hoặc bằng 100", response.getBody().get("message"));
    }

    @Test
    @DisplayName("sortBy=foo trên truy vấn @Query -> 400 (Hibernate báo 'Could not resolve attribute'), lỗi khác vẫn là 500")
    void unknownSortAttributeIs400() {
        RuntimeException hibernate = new RuntimeException("Could not resolve attribute 'nonsense' of 'com.boxora.entity.User'");
        assertBody(handler.handleInvalidDataAccessUsage(new InvalidDataAccessApiUsageException(hibernate.getMessage(), hibernate)),
                HttpStatus.BAD_REQUEST, ErrorCode.INVALID_REQUEST.getCode());
        assertBody(handler.handleInvalidDataAccessUsage(new InvalidDataAccessApiUsageException("something else entirely")),
                HttpStatus.INTERNAL_SERVER_ERROR, ErrorCode.INTERNAL_SERVER_ERROR.getCode());
    }

    @Test
    @DisplayName("Sai phương thức HTTP -> 405; không có đường dẫn -> 404")
    void routingErrors() {
        assertBody(handler.handleMethodNotAllowed(new HttpRequestMethodNotSupportedException("DELETE")),
                HttpStatus.METHOD_NOT_ALLOWED, ErrorCode.INVALID_REQUEST.getCode());
        assertBody(handler.handleNoResource(new NoResourceFoundException(HttpMethod.GET, "/api/v1/nope")),
                HttpStatus.NOT_FOUND, ErrorCode.RESOURCE_NOT_FOUND.getCode());
    }

    @Test
    @DisplayName("ResponseStatusException giữ nguyên mã 4xx")
    void responseStatusKeepsStatus() {
        assertBody(handler.handleResponseStatus(new ResponseStatusException(HttpStatus.NOT_FOUND, "Không có")),
                HttpStatus.NOT_FOUND, ErrorCode.RESOURCE_NOT_FOUND.getCode());
    }

    @Test
    @DisplayName("Vi phạm toàn vẹn dữ liệu -> 409; cột quá dài -> 400")
    void dataIntegrity() {
        assertBody(handler.handleDataIntegrity(new DataIntegrityViolationException("fk violation",
                        new RuntimeException("violates foreign key constraint"))),
                HttpStatus.CONFLICT, ErrorCode.INVALID_REQUEST.getCode());
        assertBody(handler.handleDataIntegrity(new DataIntegrityViolationException("too long",
                        new RuntimeException("ERROR: value too long for type character varying(500)"))),
                HttpStatus.BAD_REQUEST, ErrorCode.INVALID_REQUEST.getCode());
    }

    @Test
    @DisplayName("Lỗi bất ngờ -> 500 với thông báo chung, không lộ nội dung exception")
    void unexpectedErrorDoesNotLeak() {
        ResponseEntity<Map<String, Object>> response =
                handler.handleException(new IllegalStateException("password=hunter2 at com.boxora.Secret"));

        assertBody(response, HttpStatus.INTERNAL_SERVER_ERROR, ErrorCode.INTERNAL_SERVER_ERROR.getCode());
        String message = (String) response.getBody().get("message");
        assertFalse(message.contains("hunter2"));
        assertEquals(ErrorCode.INTERNAL_SERVER_ERROR.getMessage(), message);
    }

    @Test
    @DisplayName("AppException giữ mã, trạng thái và thông báo tiếng Việt")
    void appExceptionIsPreserved() {
        ResponseEntity<Map<String, Object>> response = handler.handleAppException(new AppException(ErrorCode.USER_INACTIVE));

        assertBody(response, HttpStatus.FORBIDDEN, 203);
        assertTrue(((String) response.getBody().get("message")).contains("khóa"));
    }
}

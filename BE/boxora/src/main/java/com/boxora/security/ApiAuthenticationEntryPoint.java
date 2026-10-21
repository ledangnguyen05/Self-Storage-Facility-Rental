package com.boxora.security;

import com.boxora.config.JwtAuthenticationFilter;
import com.boxora.exception.ErrorCode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Answers an unauthenticated call to a protected endpoint with a 401 that tells the web app WHY, so it can
 * react correctly:
 *
 * <ul>
 *   <li>a Bearer token was sent but is expired / invalid: {@code WWW-Authenticate: Bearer error="invalid_token"}
 *       and code 401 ({@code TOKEN_EXPIRED}) or 400 ({@code INVALID_TOKEN}). Only then may the client try the
 *       refresh token;</li>
 *   <li>no token at all: a plain {@code WWW-Authenticate: Bearer} challenge and code 301 ({@code UNAUTHORIZED}):
 *       there is nothing to refresh, the visitor has to sign in.</li>
 * </ul>
 *
 * A business 401 (wrong credentials, bad Google token...) is produced by {@code AppException} and carries
 * neither marker, so clients never replay such a request after a refresh.
 */
@Component
public class ApiAuthenticationEntryPoint implements AuthenticationEntryPoint {

    private final ObjectMapper objectMapper;

    public ApiAuthenticationEntryPoint(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    /** Error code matching the JWT failure recorded by {@link JwtAuthenticationFilter} (null = no token sent). */
    public static ErrorCode errorCodeFor(String failure) {
        if (JwtAuthenticationFilter.FAILURE_EXPIRED.equals(failure)) {
            return ErrorCode.TOKEN_EXPIRED;
        }
        if (failure != null) {
            return ErrorCode.INVALID_TOKEN;
        }
        return ErrorCode.UNAUTHORIZED;
    }

    /** Value of the {@code WWW-Authenticate} header for {@code failure}. */
    public static String challengeFor(String failure) {
        if (failure == null) {
            return "Bearer";
        }
        return "Bearer error=\"invalid_token\", error_description=\""
                + (JwtAuthenticationFilter.FAILURE_EXPIRED.equals(failure) ? "expired" : "invalid") + "\"";
    }

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response,
                         AuthenticationException authException) throws IOException {
        Object failure = request.getAttribute(JwtAuthenticationFilter.AUTH_FAILURE_ATTRIBUTE);
        String failureName = failure instanceof String name ? name : null;
        ErrorCode errorCode = errorCodeFor(failureName);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("timestamp", LocalDateTime.now().toString());
        body.put("status", 401);
        body.put("code", errorCode.getCode());
        body.put("error", "Unauthorized");
        body.put("message", errorCode.getMessage());

        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setHeader(HttpHeaders.WWW_AUTHENTICATE, challengeFor(failureName));
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        objectMapper.writeValue(response.getWriter(), body);
    }
}

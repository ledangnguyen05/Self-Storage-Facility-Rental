package com.boxora.security;

import com.boxora.config.JwtAuthenticationFilter;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.exception.GlobalExceptionHandler;
import com.boxora.service.impl.JwtServiceImpl;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.MalformedJwtException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.InsufficientAuthenticationException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * The web app refreshes its session only when the backend says the ACCESS token was rejected
 * ({@code WWW-Authenticate: Bearer error="invalid_token"}). A business 401/403 must never look like that.
 */
class SessionExpirySignalTest {

    private JwtServiceImpl jwtService;
    private UserDetailsService userDetailsService;
    private JwtAuthenticationFilter filter;
    private final ApiAuthenticationEntryPoint entryPoint = new ApiAuthenticationEntryPoint(new ObjectMapper());

    @BeforeEach
    void setUp() {
        SecurityContextHolder.clearContext();
        RequestContextHolder.resetRequestAttributes();
        jwtService = mock(JwtServiceImpl.class);
        userDetailsService = mock(UserDetailsService.class);
        filter = new JwtAuthenticationFilter(jwtService, userDetailsService);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        RequestContextHolder.resetRequestAttributes();
    }

    private MockHttpServletRequest runFilter(String authorization) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/bookings/my");
        request.setServletPath("/api/v1/bookings/my");
        if (authorization != null) {
            request.addHeader("Authorization", authorization);
        }
        filter.doFilter(request, new MockHttpServletResponse(), new MockFilterChain());
        return request;
    }

    // ---------------------------------------------------------------- filter records WHY

    @Test
    @DisplayName("Access token hết hạn -> ghi nhận 'expired'")
    void expiredTokenIsRecorded() throws Exception {
        when(jwtService.extractEmail(anyString())).thenThrow(new ExpiredJwtException(null, null, "JWT expired"));

        MockHttpServletRequest request = runFilter("Bearer old.token.value");

        assertEquals(JwtAuthenticationFilter.FAILURE_EXPIRED, request.getAttribute(JwtAuthenticationFilter.AUTH_FAILURE_ATTRIBUTE));
        assertNull(SecurityContextHolder.getContext().getAuthentication());
    }

    @Test
    @DisplayName("Token hỏng / sai chữ ký / không phải access token / tài khoản bị khóa -> ghi nhận 'invalid'")
    void invalidTokenIsRecorded() throws Exception {
        when(jwtService.extractEmail("garbage")).thenThrow(new MalformedJwtException("bad"));
        assertEquals(JwtAuthenticationFilter.FAILURE_INVALID,
                runFilter("Bearer garbage").getAttribute(JwtAuthenticationFilter.AUTH_FAILURE_ATTRIBUTE));

        SecurityContextHolder.clearContext();
        when(jwtService.extractEmail("refresh-as-bearer")).thenReturn("user@boxora.vn");
        when(jwtService.isAccessToken("refresh-as-bearer")).thenReturn(false);
        assertEquals(JwtAuthenticationFilter.FAILURE_INVALID,
                runFilter("Bearer refresh-as-bearer").getAttribute(JwtAuthenticationFilter.AUTH_FAILURE_ATTRIBUTE));

        SecurityContextHolder.clearContext();
        when(jwtService.extractEmail("locked-user")).thenReturn("locked@boxora.vn");
        when(jwtService.isAccessToken("locked-user")).thenReturn(true);
        when(jwtService.isTokenValid("locked-user")).thenReturn(true);
        when(userDetailsService.loadUserByUsername("locked@boxora.vn")).thenThrow(new AppException(ErrorCode.USER_INACTIVE));
        assertEquals(JwtAuthenticationFilter.FAILURE_INVALID,
                runFilter("Bearer locked-user").getAttribute(JwtAuthenticationFilter.AUTH_FAILURE_ATTRIBUTE));
    }

    @Test
    @DisplayName("Không gửi token -> không có dấu hiệu 'token bị từ chối' (khách ẩn danh không có gì để làm mới)")
    void noTokenRecordsNothing() throws Exception {
        MockHttpServletRequest request = runFilter(null);
        assertNull(request.getAttribute(JwtAuthenticationFilter.AUTH_FAILURE_ATTRIBUTE));
    }

    @Test
    @DisplayName("Token hợp lệ -> xác thực, không ghi nhận lỗi")
    void validTokenRecordsNothing() throws Exception {
        when(jwtService.extractEmail("ok")).thenReturn("user@boxora.vn");
        when(jwtService.isAccessToken("ok")).thenReturn(true);
        when(jwtService.isTokenValid("ok")).thenReturn(true);
        when(userDetailsService.loadUserByUsername("user@boxora.vn")).thenReturn(
                org.springframework.security.core.userdetails.User.withUsername("user@boxora.vn").password("x").roles("CUSTOMER").build());

        MockHttpServletRequest request = runFilter("Bearer ok");

        assertNull(request.getAttribute(JwtAuthenticationFilter.AUTH_FAILURE_ATTRIBUTE));
        assertNotNull(SecurityContextHolder.getContext().getAuthentication());
    }

    // ---------------------------------------------------------------- entry point

    private MockHttpServletResponse challenge(String failure) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/bookings/my");
        if (failure != null) {
            request.setAttribute(JwtAuthenticationFilter.AUTH_FAILURE_ATTRIBUTE, failure);
        }
        MockHttpServletResponse response = new MockHttpServletResponse();
        entryPoint.commence(request, response, new InsufficientAuthenticationException("no auth"));
        return response;
    }

    @Test
    @DisplayName("401 vì token hết hạn mang dấu hiệu invalid_token + mã 401 -> web app được phép làm mới phiên")
    void expiredTokenChallenge() throws Exception {
        MockHttpServletResponse response = challenge(JwtAuthenticationFilter.FAILURE_EXPIRED);

        assertEquals(401, response.getStatus());
        assertTrue(response.getHeader(HttpHeaders.WWW_AUTHENTICATE).contains("error=\"invalid_token\""));
        assertTrue(response.getHeader(HttpHeaders.WWW_AUTHENTICATE).contains("expired"));
        JsonNode body = new ObjectMapper().readTree(response.getContentAsString());
        assertEquals(ErrorCode.TOKEN_EXPIRED.getCode(), body.get("code").asInt());
        assertEquals(401, body.get("status").asInt());
        assertFalse(body.get("message").asText().isBlank());
    }

    @Test
    @DisplayName("401 vì token không hợp lệ -> invalid_token + mã 400 (INVALID_TOKEN)")
    void invalidTokenChallenge() throws Exception {
        MockHttpServletResponse response = challenge(JwtAuthenticationFilter.FAILURE_INVALID);

        assertTrue(response.getHeader(HttpHeaders.WWW_AUTHENTICATE).contains("invalid_token"));
        assertEquals(ErrorCode.INVALID_TOKEN.getCode(), new ObjectMapper().readTree(response.getContentAsString()).get("code").asInt());
    }

    @Test
    @DisplayName("401 vì chưa đăng nhập: thách thức 'Bearer' trơn, KHÔNG có invalid_token -> web app không làm mới và phát lại")
    void anonymousChallengeIsNotARefreshSignal() throws Exception {
        MockHttpServletResponse response = challenge(null);

        assertEquals(401, response.getStatus());
        assertEquals("Bearer", response.getHeader(HttpHeaders.WWW_AUTHENTICATE));
        assertEquals(ErrorCode.UNAUTHORIZED.getCode(), new ObjectMapper().readTree(response.getContentAsString()).get("code").asInt());
    }

    // ---------------------------------------------------------------- business errors carry no marker

    @Test
    @DisplayName("401/403 nghiệp vụ (AppException) không bao giờ mang dấu hiệu invalid_token")
    void businessErrorsCarryNoRefreshSignal() {
        GlobalExceptionHandler handler = new GlobalExceptionHandler();
        for (ErrorCode code : new ErrorCode[]{ErrorCode.INVALID_CREDENTIALS, ErrorCode.INVALID_GOOGLE_TOKEN,
                ErrorCode.FORBIDDEN, ErrorCode.FACILITY_ACCESS_DENIED}) {
            ResponseEntity<Map<String, Object>> response = handler.handleAppException(new AppException(code));
            assertNull(response.getHeaders().getFirst(HttpHeaders.WWW_AUTHENTICATE), code.name());
        }
    }

    @Test
    @DisplayName("AccessDenied với người đã đăng nhập -> 403 như cũ")
    void accessDeniedForSignedInUserIs403() {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                "user@boxora.vn", "n/a", AuthorityUtils.createAuthorityList("ROLE_CUSTOMER")));

        ResponseEntity<Map<String, Object>> response =
                new GlobalExceptionHandler().handleAccessDeniedException(new AccessDeniedException("no"));

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        assertEquals(ErrorCode.FORBIDDEN.getCode(), response.getBody().get("code"));
        assertNull(response.getHeaders().getFirst(HttpHeaders.WWW_AUTHENTICATE));
    }

    @Test
    @DisplayName("AccessDenied với khách ẩn danh (endpoint mở ở tầng URL nhưng có @PreAuthorize) -> 401 chứ không phải 403")
    void accessDeniedForAnonymousIs401() {
        SecurityContextHolder.getContext().setAuthentication(new AnonymousAuthenticationToken(
                "key", "anonymousUser", AuthorityUtils.createAuthorityList("ROLE_ANONYMOUS")));

        ResponseEntity<Map<String, Object>> response =
                new GlobalExceptionHandler().handleAccessDeniedException(new AccessDeniedException("no"));

        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
        assertEquals(ErrorCode.UNAUTHORIZED.getCode(), response.getBody().get("code"));
        assertEquals("Bearer", response.getHeaders().getFirst(HttpHeaders.WWW_AUTHENTICATE));
    }

    @Test
    @DisplayName("AccessDenied cùng token hết hạn trên endpoint mở -> 401 + invalid_token để web app làm mới phiên")
    void accessDeniedWithExpiredTokenIsARefreshSignal() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setAttribute(JwtAuthenticationFilter.AUTH_FAILURE_ATTRIBUTE, JwtAuthenticationFilter.FAILURE_EXPIRED);
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));

        ResponseEntity<Map<String, Object>> response =
                new GlobalExceptionHandler().handleAccessDeniedException(new AccessDeniedException("no"));

        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
        assertEquals(ErrorCode.TOKEN_EXPIRED.getCode(), response.getBody().get("code"));
        assertTrue(response.getHeaders().getFirst(HttpHeaders.WWW_AUTHENTICATE).contains("invalid_token"));
    }
}

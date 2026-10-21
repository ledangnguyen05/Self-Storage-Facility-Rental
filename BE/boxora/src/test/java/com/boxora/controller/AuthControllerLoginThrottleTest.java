package com.boxora.controller;

import com.boxora.dto.request.ForgotPasswordRequest;
import com.boxora.dto.request.LoginRequest;
import com.boxora.dto.response.AuthResponse;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.security.RateLimiter;
import com.boxora.service.AuthService;
import com.boxora.service.CaptchaService;
import com.boxora.service.EmailService;
import com.boxora.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** Brute-force protection of POST /auth/login and the constant response time of POST /auth/forgot-password. */
class AuthControllerLoginThrottleTest {

    private AuthService authService;
    private AuthController controller;

    @BeforeEach
    void setUp() {
        authService = mock(AuthService.class);
        controller = new AuthController(authService, mock(CaptchaService.class), mock(UserService.class),
                mock(EmailService.class), new RateLimiter(true));
        ReflectionTestUtils.setField(controller, "refreshTokenTtlMillis", 604_800_000L);
        ReflectionTestUtils.setField(controller, "forgotPasswordMinResponseMs", 0L);
    }

    private static MockHttpServletRequest from(String ip) {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/auth/login");
        request.setRemoteAddr(ip);
        return request;
    }

    private static LoginRequest login(String email, String password) {
        return LoginRequest.builder().email(email).password(password).build();
    }

    private void failLogin(String ip, String email) {
        doThrow(new AppException(ErrorCode.INVALID_CREDENTIALS)).when(authService).login(any());
        assertThrows(AppException.class, () -> controller.login(login(email, "wrong"), from(ip)));
    }

    private void stubSuccess() {
        reset(authService);
        when(authService.login(any())).thenReturn(AuthResponse.builder().accessToken("access").refreshToken("refresh").build());
    }

    @Test
    @DisplayName("Sai mật khẩu 5 lần liên tiếp: lần thứ 6 bị 429 (RATE_LIMIT_EXCEEDED), kể cả khi gõ đúng mật khẩu")
    void sixthAttemptIsThrottledEvenWithTheRightPassword() {
        for (int i = 0; i < 5; i++) {
            failLogin("10.0.0.1", "customer@gmail.com");
        }

        stubSuccess();
        AppException ex = assertThrows(AppException.class,
                () -> controller.login(login("customer@gmail.com", "123456"), from("10.0.0.1")));

        assertEquals(ErrorCode.RATE_LIMIT_EXCEEDED, ex.getErrorCode());
        assertEquals(429, ex.getErrorCode().getHttpStatus().value());
        assertEquals(612, ex.getErrorCode().getCode());
        assertTrue(ex.getMessage().contains("15 phút"), ex.getMessage());
        verify(authService, never()).login(any());
    }

    @Test
    @DisplayName("Email viết HOA/thường khác nhau vẫn dùng chung một bộ đếm")
    void emailCaseDoesNotEscapeTheCounter() {
        String[] spellings = {"Customer@Gmail.com", "CUSTOMER@GMAIL.COM", "customer@gmail.com", " customer@gmail.com ", "Customer@gmail.com"};
        for (String spelling : spellings) {
            failLogin("10.0.0.2", spelling);
        }
        stubSuccess();
        assertThrows(AppException.class, () -> controller.login(login("cUSTOMER@gmail.com", "123456"), from("10.0.0.2")));
    }

    @Test
    @DisplayName("Đăng nhập đúng sau vài lần sai (dưới ngưỡng) xóa bộ đếm của tài khoản đó")
    void successResetsTheAccountCounters() {
        for (int i = 0; i < 4; i++) {
            failLogin("10.0.0.3", "ok@boxora.vn");
        }
        stubSuccess();
        assertDoesNotThrow(() -> controller.login(login("ok@boxora.vn", "123456"), from("10.0.0.3")));

        // the counter restarted: four more failures are tolerated again
        for (int i = 0; i < 4; i++) {
            failLogin("10.0.0.3", "ok@boxora.vn");
        }
        stubSuccess();
        assertDoesNotThrow(() -> controller.login(login("ok@boxora.vn", "123456"), from("10.0.0.3")));
    }

    @Test
    @DisplayName("Kẻ tấn công không khóa được người dùng thật ở IP khác: bộ đếm theo (IP + email)")
    void anotherIpIsNotLockedOut() {
        for (int i = 0; i < 5; i++) {
            failLogin("10.0.0.4", "victim@boxora.vn");
        }
        stubSuccess();

        assertDoesNotThrow(() -> controller.login(login("victim@boxora.vn", "123456"), from("10.0.0.99")));
    }

    @Test
    @DisplayName("Một IP dò nhiều email khác nhau cũng bị chặn theo IP")
    void perIpLimitStopsPasswordSprayingAcrossAccounts() {
        for (int i = 0; i < 40; i++) {
            failLogin("10.0.0.5", "user" + i + "@boxora.vn");
        }
        stubSuccess();

        AppException ex = assertThrows(AppException.class,
                () -> controller.login(login("brand.new@boxora.vn", "123456"), from("10.0.0.5")));

        assertEquals(ErrorCode.RATE_LIMIT_EXCEEDED, ex.getErrorCode());
    }

    @Test
    @DisplayName("Dò một email từ nhiều IP: giới hạn theo email chặn sau 30 lần sai")
    void perEmailLimitStopsDistributedGuessing() {
        for (int i = 0; i < 30; i++) {
            failLogin("10.1.0." + i, "target@boxora.vn");
        }
        stubSuccess();

        AppException ex = assertThrows(AppException.class,
                () -> controller.login(login("target@boxora.vn", "123456"), from("10.1.9.9")));

        assertEquals(ErrorCode.RATE_LIMIT_EXCEEDED, ex.getErrorCode());
    }

    @Test
    @DisplayName("Chỉ sai thông tin đăng nhập mới được đếm: tài khoản bị khóa / lỗi hệ thống không tính")
    void onlyBadCredentialsCount() {
        doThrow(new AppException(ErrorCode.USER_INACTIVE)).when(authService).login(any());
        for (int i = 0; i < 10; i++) {
            assertThrows(AppException.class, () -> controller.login(login("locked@boxora.vn", "123456"), from("10.0.0.6")));
        }
        stubSuccess();
        assertDoesNotThrow(() -> controller.login(login("locked@boxora.vn", "123456"), from("10.0.0.6")));
    }

    @Test
    @DisplayName("Đăng nhập thành công đặt cookie refresh token HttpOnly và không trả refresh token trong JSON")
    void successfulLoginSetsCookie() {
        stubSuccess();

        var response = controller.login(login("ok@boxora.vn", "123456"), from("10.0.0.7"));

        assertTrue(response.getHeaders().getFirst("Set-Cookie").contains("refreshToken=refresh"));
        assertTrue(response.getHeaders().getFirst("Set-Cookie").contains("HttpOnly"));
        assertNull(response.getBody().getData().getRefreshToken());
    }

    @Test
    @DisplayName("Quên mật khẩu luôn trả lời sau ít nhất khoảng thời gian tối thiểu (email có/không đăng ký đều như nhau)")
    void forgotPasswordTakesAtLeastTheMinimum() {
        ReflectionTestUtils.setField(controller, "forgotPasswordMinResponseMs", 120L);
        MockHttpServletRequest request = from("10.0.0.8");

        long start = System.nanoTime();
        controller.forgotPassword(ForgotPasswordRequest.builder().email("nobody@example.test").build(), request);
        long elapsedMs = (System.nanoTime() - start) / 1_000_000L;

        assertTrue(elapsedMs >= 110, "responded after only " + elapsedMs + " ms");
        verify(authService).forgotPassword(any());
    }

    @Test
    @DisplayName("padResponseTime không chờ khi đã quá thời gian tối thiểu hoặc khi tắt (0)")
    void padResponseTimeIsNotAPenalty() {
        long start = System.nanoTime();
        AuthController.padResponseTime(System.nanoTime() - 1_000_000_000L, 200);
        AuthController.padResponseTime(System.nanoTime(), 0);
        assertTrue((System.nanoTime() - start) / 1_000_000L < 100);
    }
}

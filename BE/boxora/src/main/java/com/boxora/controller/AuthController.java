package com.boxora.controller;

import com.boxora.common.response.ApiResponse;
import com.boxora.dto.request.*;
import com.boxora.dto.response.AuthResponse;
import com.boxora.dto.response.PublicAuthConfigResponse;
import com.boxora.dto.response.UserResponse;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.security.RateLimiter;
import com.boxora.service.AuthService;
import com.boxora.util.EmailAddresses;
import com.boxora.service.CaptchaService;
import com.boxora.service.EmailService;
import com.boxora.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
@Slf4j
public class AuthController {

    private static final String REFRESH_TOKEN_COOKIE_NAME = "refreshToken";

    /** Registration is throttled per client IP; password-reset requests per IP and per target email. */
    private static final int REGISTER_PER_IP_PER_HOUR = 20;
    private static final int FORGOT_PER_IP_PER_HOUR = 30;
    private static final int FORGOT_PER_EMAIL_PER_HOUR = 5;
    private static final Duration ONE_HOUR = Duration.ofHours(1);

    /** Failed sign-ins are counted in these buckets; see {@link #login}. */
    private static final String LOGIN_FAIL_IP_EMAIL = "login-fail-ip-email";
    private static final String LOGIN_FAIL_IP = "login-fail-ip";
    private static final String LOGIN_FAIL_EMAIL = "login-fail-email";
    private static final Duration LOGIN_FAILURE_WINDOW = Duration.ofMinutes(15);
    private static final String LOGIN_LOCKED_MESSAGE =
            "Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút hoặc dùng \"Quên mật khẩu\".";

    @Value("${app.security.cookie.secure:false}")
    private boolean cookieSecure;

    /** Lax suits same-origin (proxy) deployments; use None (+ secure) when the API is on another site. */
    @Value("${app.security.cookie.same-site:Lax}")
    private String cookieSameSite;

    @Value("${jwt.refresh-token-expiration:604800000}")
    private long refreshTokenTtlMillis;

    @Value("${google.client-id:}")
    private String googleClientId;

    @Value("${app.security.login.max-failures-per-ip-and-email:5}")
    private int maxLoginFailuresPerIpAndEmail = 5;

    @Value("${app.security.login.max-failures-per-ip:40}")
    private int maxLoginFailuresPerIp = 40;

    @Value("${app.security.login.max-failures-per-email:30}")
    private int maxLoginFailuresPerEmail = 30;

    /** Forgot-password never answers faster than this, so latency cannot reveal which addresses exist. */
    @Value("${app.security.forgot-password.min-response-ms:300}")
    private long forgotPasswordMinResponseMs = 300;

    private final AuthService authService;
    private final CaptchaService captchaService;
    private final UserService userService;
    private final EmailService emailService;
    private final RateLimiter rateLimiter;

    /** What the login/register screens need to know before rendering (all values are public by design). */
    @GetMapping("/public-config")
    public ResponseEntity<ApiResponse<PublicAuthConfigResponse>> getPublicConfig() {
        boolean googleEnabled = googleClientId != null && !googleClientId.isBlank();
        PublicAuthConfigResponse config = PublicAuthConfigResponse.builder()
                .googleEnabled(googleEnabled)
                .googleClientId(googleEnabled ? googleClientId.trim() : null)
                .passwordResetAvailable(emailService.isMailConfigured())
                .build();
        return ResponseEntity.ok(ApiResponse.success("Cấu hình đăng nhập", config));
    }

    @GetMapping("/captcha")
    public ResponseEntity<ApiResponse<com.boxora.dto.response.CaptchaResponse>> getCaptcha() {
        com.boxora.dto.response.CaptchaResponse response = captchaService.generateCaptcha();
        return ResponseEntity.ok(ApiResponse.success("Đã tạo mã xác thực", response));
    }

    @PostMapping("/register")
    public ResponseEntity<ApiResponse<AuthResponse>> register(
            @Valid @RequestBody RegisterRequest request,
            HttpServletRequest httpRequest
    ) {
        rateLimiter.check("register-ip", httpRequest.getRemoteAddr(), REGISTER_PER_IP_PER_HOUR, ONE_HOUR);

        AuthResponse response = authService.register(request);
        if (response.getRefreshToken() != null) {
            ResponseCookie cookie = createRefreshTokenCookie(response.getRefreshToken(), refreshTokenMaxAgeSeconds());
            response.setRefreshToken(null);
            return ResponseEntity
                    .status(HttpStatus.CREATED)
                    .header(HttpHeaders.SET_COOKIE, cookie.toString())
                    .body(ApiResponse.success("Đăng ký tài khoản thành công", response));
        }
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(ApiResponse.success("Đăng ký tài khoản thành công", response));
    }

    /**
     * Wrong passwords are counted per (IP + email), per IP and per email; once a bucket is full the next
     * attempt, right password or not, is answered 429 until the 15-minute window slides past. Only failures
     * count, and a successful sign-in clears the account's own buckets, so normal use is never throttled.
     */
    @PostMapping("/login")
    public ResponseEntity<ApiResponse<AuthResponse>> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletRequest httpRequest
    ) {
        String ip = httpRequest.getRemoteAddr();
        String email = EmailAddresses.normalize(request.getEmail());
        String ipAndEmail = ip + "|" + email;

        rateLimiter.assertBelowLimit(LOGIN_FAIL_IP_EMAIL, ipAndEmail, maxLoginFailuresPerIpAndEmail,
                LOGIN_FAILURE_WINDOW, LOGIN_LOCKED_MESSAGE);
        rateLimiter.assertBelowLimit(LOGIN_FAIL_IP, ip, maxLoginFailuresPerIp, LOGIN_FAILURE_WINDOW, LOGIN_LOCKED_MESSAGE);
        rateLimiter.assertBelowLimit(LOGIN_FAIL_EMAIL, email, maxLoginFailuresPerEmail, LOGIN_FAILURE_WINDOW, LOGIN_LOCKED_MESSAGE);

        AuthResponse response;
        try {
            response = authService.login(request);
        } catch (AppException e) {
            if (e.getErrorCode() == ErrorCode.INVALID_CREDENTIALS) {
                rateLimiter.recordHit(LOGIN_FAIL_IP_EMAIL, ipAndEmail, LOGIN_FAILURE_WINDOW);
                rateLimiter.recordHit(LOGIN_FAIL_IP, ip, LOGIN_FAILURE_WINDOW);
                rateLimiter.recordHit(LOGIN_FAIL_EMAIL, email, LOGIN_FAILURE_WINDOW);
            }
            throw e;
        }
        rateLimiter.reset(LOGIN_FAIL_IP_EMAIL, ipAndEmail);
        rateLimiter.reset(LOGIN_FAIL_EMAIL, email);

        String refreshTokenValue = response.getRefreshToken();

        // Put refresh token in secure HttpOnly cookie instead of exposing in JSON body
        ResponseCookie cookie = createRefreshTokenCookie(refreshTokenValue, refreshTokenMaxAgeSeconds());
        response.setRefreshToken(null);

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie.toString())
                .body(ApiResponse.success("Đăng nhập thành công", response));
    }

    @PostMapping("/google")
    public ResponseEntity<ApiResponse<AuthResponse>> googleLogin(
            @Valid @RequestBody GoogleLoginRequest request
    ) {
        AuthResponse response = authService.googleLogin(request);
        String refreshTokenValue = response.getRefreshToken();

        ResponseCookie cookie = createRefreshTokenCookie(refreshTokenValue, refreshTokenMaxAgeSeconds());
        response.setRefreshToken(null);

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie.toString())
                .body(ApiResponse.success("Đăng nhập bằng Google thành công", response));
    }

    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<Void>> logout(
            @CookieValue(name = REFRESH_TOKEN_COOKIE_NAME, required = false) String cookieRefreshToken,
            @RequestBody(required = false) RefreshTokenRequest request
    ) {
        String tokenToRevoke = (cookieRefreshToken != null && !cookieRefreshToken.isBlank())
                ? cookieRefreshToken
                : (request != null ? request.getRefreshToken() : null);

        if (tokenToRevoke != null && !tokenToRevoke.isBlank()) {
            try {
                authService.logout(tokenToRevoke);
            } catch (Exception e) {
                log.warn("Logout token revocation notice: {}", e.getMessage());
            }
        }

        // Expire HttpOnly cookie immediately
        ResponseCookie cleanCookie = createRefreshTokenCookie("", 0);

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cleanCookie.toString())
                .body(ApiResponse.success("Đã đăng xuất", null));
    }

    @PostMapping("/refresh-token")
    public ResponseEntity<ApiResponse<AuthResponse>> refreshToken(
            @CookieValue(name = REFRESH_TOKEN_COOKIE_NAME, required = false) String cookieRefreshToken,
            @RequestBody(required = false) RefreshTokenRequest request
    ) {
        String tokenValue = (cookieRefreshToken != null && !cookieRefreshToken.isBlank())
                ? cookieRefreshToken
                : (request != null ? request.getRefreshToken() : null);

        if (tokenValue == null || tokenValue.isBlank()) {
            throw new AppException(ErrorCode.INVALID_REFRESH_TOKEN);
        }

        RefreshTokenRequest req = RefreshTokenRequest.builder()
                .refreshToken(tokenValue)
                .build();

        AuthResponse response = authService.refreshToken(req);
        String newRefreshToken = response.getRefreshToken();
        response.setRefreshToken(null);

        ResponseEntity.BodyBuilder builder = ResponseEntity.ok();
        // No rotated token means a concurrent refresh (another tab) already rotated it and the browser holds
        // the new cookie: leave the cookie alone instead of overwriting it with a revoked value.
        if (newRefreshToken != null) {
            builder.header(HttpHeaders.SET_COOKIE,
                    createRefreshTokenCookie(newRefreshToken, refreshTokenMaxAgeSeconds()).toString());
        }
        return builder.body(ApiResponse.success("Đã làm mới phiên đăng nhập", response));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<ApiResponse<Void>> forgotPassword(
            @Valid @RequestBody ForgotPasswordRequest request,
            HttpServletRequest httpRequest
    ) {
        rateLimiter.check("forgot-ip", httpRequest.getRemoteAddr(), FORGOT_PER_IP_PER_HOUR, ONE_HOUR);
        rateLimiter.check("forgot-email", EmailAddresses.normalize(request.getEmail()), FORGOT_PER_EMAIL_PER_HOUR, ONE_HOUR);

        long startedAt = System.nanoTime();
        authService.forgotPassword(request);
        padResponseTime(startedAt, forgotPasswordMinResponseMs);
        return ResponseEntity.ok(ApiResponse.success(
                "Nếu email đã đăng ký, liên kết đặt lại mật khẩu đã được gửi", null
        ));
    }

    /**
     * A registered address does a little more work (token, audit row) than an unknown one. Waiting until a fixed
     * minimum has elapsed hides that difference from anyone timing the endpoint.
     */
    static void padResponseTime(long startedAtNanos, long minMillis) {
        if (minMillis <= 0) {
            return;
        }
        long remainingMs = minMillis - (System.nanoTime() - startedAtNanos) / 1_000_000L;
        if (remainingMs > 0) {
            try {
                Thread.sleep(remainingMs);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
    }

    @PostMapping("/reset-password")
    public ResponseEntity<ApiResponse<Void>> resetPassword(
            @Valid @RequestBody ResetPasswordRequest request
    ) {
        authService.resetPassword(request);
        return ResponseEntity.ok(ApiResponse.success("Đã đặt lại mật khẩu", null));
    }

    /** Signed-in users only. All sessions are revoked on success, so the client must sign in again. */
    @PutMapping("/change-password")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Void>> changePassword(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody ChangePasswordRequest request
    ) {
        authService.changePassword(userDetails.getUsername(), request);
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, createRefreshTokenCookie("", 0).toString())
                .body(ApiResponse.success("Đã đổi mật khẩu. Vui lòng đăng nhập lại", null));
    }

    @PutMapping("/profile")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<UserResponse>> updateProfile(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody ProfileUpdateRequest request
    ) {
        UserResponse response = userService.updateOwnProfile(userDetails.getUsername(), request);
        return ResponseEntity.ok(ApiResponse.success("Đã cập nhật hồ sơ", response));
    }

    private long refreshTokenMaxAgeSeconds() {
        return Math.max(60L, refreshTokenTtlMillis / 1000L);
    }

    private ResponseCookie createRefreshTokenCookie(String value, long maxAgeSeconds) {
        String sameSite = (cookieSameSite == null || cookieSameSite.isBlank()) ? "Lax" : cookieSameSite.trim();
        // Browsers reject SameSite=None cookies that are not Secure.
        boolean secure = cookieSecure || "None".equalsIgnoreCase(sameSite);
        return ResponseCookie.from(REFRESH_TOKEN_COOKIE_NAME, value)
                .httpOnly(true)
                .secure(secure)
                .path("/")
                .maxAge(maxAgeSeconds)
                .sameSite(sameSite)
                .build();
    }
}

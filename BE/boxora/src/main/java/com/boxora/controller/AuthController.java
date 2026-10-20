package com.boxora.controller;

import com.boxora.common.response.ApiResponse;
import com.boxora.dto.request.*;
import com.boxora.dto.response.AuthResponse;
import com.boxora.dto.response.UserResponse;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
@Slf4j
public class AuthController {

    private static final String REFRESH_TOKEN_COOKIE_NAME = "refreshToken";
    private static final long REFRESH_TOKEN_MAX_AGE_SECONDS = 7L * 24 * 60 * 60; // 7 days

    @org.springframework.beans.factory.annotation.Value("${app.security.cookie.secure:false}")
    private boolean cookieSecure;

    private final AuthService authService;
    private final com.boxora.service.CaptchaService captchaService;
    private final com.boxora.service.UserService userService;

    @GetMapping("/captcha")
    public ResponseEntity<ApiResponse<com.boxora.dto.response.CaptchaResponse>> getCaptcha() {
        com.boxora.dto.response.CaptchaResponse response = captchaService.generateCaptcha();
        return ResponseEntity.ok(ApiResponse.success("Tạo mã Captcha thành công", response));
    }

    @PostMapping("/register")
    public ResponseEntity<ApiResponse<AuthResponse>> register(
            @Valid @RequestBody RegisterRequest request
    ) {
        AuthResponse response = authService.register(request);
        if (response.getRefreshToken() != null) {
            ResponseCookie cookie = createRefreshTokenCookie(response.getRefreshToken(), REFRESH_TOKEN_MAX_AGE_SECONDS);
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

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<AuthResponse>> login(
            @Valid @RequestBody LoginRequest request
    ) {
        AuthResponse response = authService.login(request);
        String refreshTokenValue = response.getRefreshToken();

        // Put refresh token in secure HttpOnly cookie while also leaving in body as cross-site fallback
        ResponseCookie cookie = createRefreshTokenCookie(refreshTokenValue, REFRESH_TOKEN_MAX_AGE_SECONDS);

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

        ResponseCookie cookie = createRefreshTokenCookie(refreshTokenValue, REFRESH_TOKEN_MAX_AGE_SECONDS);

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie.toString())
                .body(ApiResponse.success("Đăng nhập bằng tài khoản Google thành công", response));
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
                .body(ApiResponse.success("Đăng xuất thành công", null));
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
        String newRefreshToken = response.getRefreshToken() != null ? response.getRefreshToken() : tokenValue;

        ResponseCookie cookie = createRefreshTokenCookie(newRefreshToken, REFRESH_TOKEN_MAX_AGE_SECONDS);
        response.setRefreshToken(null);

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie.toString())
                .body(ApiResponse.success("Làm mới phiên đăng nhập thành công", response));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<ApiResponse<Void>> forgotPassword(
            @Valid @RequestBody ForgotPasswordRequest request
    ) {
        authService.forgotPassword(request);
        return ResponseEntity.ok(ApiResponse.success(
                "Nếu email tồn tại trong hệ thống, liên kết đặt lại mật khẩu đã được gửi đến hòm thư của bạn", null
        ));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<ApiResponse<Void>> resetPassword(
            @Valid @RequestBody ResetPasswordRequest request
    ) {
        authService.resetPassword(request);
        return ResponseEntity.ok(ApiResponse.success("Đặt lại mật khẩu thành công", null));
    }

    @PutMapping("/change-password")
    @org.springframework.security.access.prepost.PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Void>> changePassword(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody ChangePasswordRequest request
    ) {
        if (userDetails == null) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }
        authService.changePassword(userDetails.getUsername(), request);
        return ResponseEntity.ok(ApiResponse.success("Đổi mật khẩu thành công", null));
    }

    @PutMapping("/profile")
    @org.springframework.security.access.prepost.PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<UserResponse>> updateProfile(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody ProfileUpdateRequest request
    ) {
        UserResponse response = userService.updateOwnProfile(userDetails.getUsername(), request);
        return ResponseEntity.ok(ApiResponse.success("Cập nhật hồ sơ tài khoản thành công", response));
    }

    private ResponseCookie createRefreshTokenCookie(String value, long maxAgeSeconds) {
        String sameSiteValue = cookieSecure ? "None" : "Lax";
        return ResponseCookie.from(REFRESH_TOKEN_COOKIE_NAME, value)
                .httpOnly(true)
                .secure(cookieSecure)
                .path("/")
                .maxAge(maxAgeSeconds)
                .sameSite(sameSiteValue)
                .build();
    }
}

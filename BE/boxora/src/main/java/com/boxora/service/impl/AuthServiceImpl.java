package com.boxora.service.impl;

import com.boxora.dto.request.*;
import com.boxora.dto.response.AuthResponse;
import com.boxora.dto.response.UserResponse;
import com.boxora.entity.RefreshToken;
import com.boxora.entity.Role;
import com.boxora.entity.User;
import com.boxora.enums.*;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.mapper.UserMapper;
import com.boxora.util.EmailAddresses;
import com.boxora.repository.RefreshTokenRepository;
import com.boxora.repository.RoleRepository;
import com.boxora.repository.UserRepository;
import com.boxora.service.AuthService;
import com.boxora.service.EmailService;
import com.boxora.service.JwtService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class AuthServiceImpl implements AuthService {

    /** A refresh token rotated this recently is treated as a concurrent refresh (second tab), not as theft. */
    private static final Duration CONCURRENT_REFRESH_GRACE = Duration.ofSeconds(15);

    private static final int USERNAME_MAX_LENGTH = 30;
    private static final int USERNAME_MIN_LENGTH = 3;
    private static final Set<String> GOOGLE_ISSUERS = Set.of("accounts.google.com", "https://accounts.google.com");

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final UserMapper userMapper;
    private final JwtService jwtService;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final EmailService emailService;
    private final com.boxora.service.ActivityLogService activityLogService;
    private final com.boxora.service.CaptchaService captchaService;

    @Value("${google.client-id:}")
    private String googleClientId;

    @Value("${jwt.refresh-token-expiration:604800000}")
    private long refreshTokenTtlMillis;

    /** Devices that may stay signed in at once; signing in on one more ends the oldest session. */
    @Value("${app.security.max-sessions-per-user:5}")
    private int maxSessionsPerUser = 5;

    private final ObjectMapper objectMapper = new ObjectMapper();


    @Override
    public AuthResponse register(RegisterRequest request) {

        captchaService.validate(request.getCaptchaId(), request.getCaptchaCode());

        String email = EmailAddresses.normalize(request.getEmail());
        if (userRepository.existsByEmail(email)) {
            throw new AppException(ErrorCode.EMAIL_ALREADY_EXISTS);
        }

        Role customerRole = roleRepository.findByName("CUSTOMER")
                .orElseThrow(() -> new AppException(ErrorCode.ROLE_NOT_FOUND));

        // The visitor never types a username: a taken name (john@yahoo.com vs john@gmail.com) is not an error,
        // the server derives a unique one.
        User user = User.builder()
                .username(resolveUniqueUsername(request.getUsername(), email))
                .email(email)
                .password(passwordEncoder.encode(request.getPassword()))
                .fullName(request.getFullName().trim())
                .phone(request.getPhone().trim())
                .role(customerRole)
                .isActive(true)
                .build();

        User saved = saveNewUser(user);
        log.info("User registered successfully with id: {}", saved.getId());

        activityLogService.recordForUser(saved.getId(), ActivityAction.USER_CREATE, "User", saved.getId(),
                "Đăng ký tài khoản mới: " + saved.getEmail(), null, saved.getId());

        emailService.sendWelcomeEmail(saved.getEmail(), saved.getFullName());

        UserResponse userResponse = userMapper.toResponse(saved);

        return AuthResponse.builder()
                .user(userResponse)
                .build();
    }


    @Override
    public AuthResponse login(LoginRequest request) {

        String email = EmailAddresses.normalize(request.getEmail());

        // A locked account is reported as locked (code 203) only to someone who knows its password;
        // anyone else just gets the generic bad-credentials answer, so lock status does not leak.
        User existing = userRepository.findByEmail(email).orElse(null);
        if (existing != null && Boolean.FALSE.equals(existing.getIsActive())) {
            boolean passwordMatches = passwordEncoder.matches(request.getPassword(), existing.getPassword());
            activityLogService.recordLogin(existing.getId(), email, false,
                    passwordMatches ? "Tài khoản đã bị khóa" : "Sai email hoặc mật khẩu");
            throw new AppException(passwordMatches ? ErrorCode.USER_INACTIVE : ErrorCode.INVALID_CREDENTIALS);
        }

        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(
                            email,
                            request.getPassword()
                    )
            );
        } catch (AuthenticationException e) {
            User failedUser = existing != null ? existing : userRepository.findByEmail(email).orElse(null);
            activityLogService.recordLogin(failedUser != null ? failedUser.getId() : null,
                    email, false, "Sai email hoặc mật khẩu");
            throw new AppException(ErrorCode.INVALID_CREDENTIALS);
        }

        User user = existing != null ? existing : userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        activityLogService.recordLogin(user.getId(), user.getEmail(), true, null);

        return buildAuthResponse(user);
    }


    @Override
    public void logout(String refreshTokenValue) {

        RefreshToken refreshToken = refreshTokenRepository
                .findByTokenAndTypeAndRevokedFalse(refreshTokenValue, TokenType.REFRESH)
                .orElseThrow(() -> new AppException(ErrorCode.INVALID_REFRESH_TOKEN));

        refreshToken.setRevoked(true);
        refreshToken.setRevokedReason(RefreshTokenRevokeReason.LOGOUT);
        refreshTokenRepository.save(refreshToken);

        if (refreshToken.getUser() != null) {
            activityLogService.recordLogout(refreshToken.getUser().getId());
        }

    }


    /**
     * noRollbackFor: the security actions taken before an AppException (revoking every session after a replay,
     * revoking the sessions of a locked account) must be committed, not rolled back with the exception.
     */
    @Override
    @Transactional(noRollbackFor = AppException.class)
    public AuthResponse refreshToken(RefreshTokenRequest request) {

        // 1. Look up token regardless of revoked status to detect reuse attempts
        RefreshToken storedToken = refreshTokenRepository
                .findByTokenAndType(request.getRefreshToken(), TokenType.REFRESH)
                .orElseThrow(() -> new AppException(ErrorCode.INVALID_REFRESH_TOKEN));

        User user = storedToken.getUser();

        // 2. A revoked token is presented again
        if (Boolean.TRUE.equals(storedToken.getRevoked())) {
            if (storedToken.getRevokedReason() != RefreshTokenRevokeReason.ROTATED) {
                // Signed out, dropped by the session cap, password changed, account locked...: the client simply
                // holds a stale session. That is not theft, so no other device is touched and nothing is audited
                // as an attack; the visitor just has to sign in again.
                throw new AppException(ErrorCode.TOKEN_REVOKED);
            }

            if (isConcurrentRotation(storedToken)) {
                // Two tabs refreshed at the same moment: the second one still carries the token the first one
                // just rotated. Give it a fresh access token; the browser already holds the new cookie.
                if (Boolean.FALSE.equals(user.getIsActive())) {
                    throw new AppException(ErrorCode.USER_INACTIVE);
                }
                return AuthResponse.builder()
                        .accessToken(jwtService.generateAccessToken(user))
                        .user(userMapper.toResponse(user))
                        .build();
            }

            // A token that was already exchanged for a newer one is used again after the grace window: whoever
            // holds it copied it. Every session is dropped so the thief and the owner both have to sign in again.
            log.warn("Security Alert: Replay attack detected! Attempted reuse of rotated refresh token for user: {}",
                    user.getEmail());
            refreshTokenRepository.revokeAllActiveTokens(user, RefreshTokenRevokeReason.REPLAY_DETECTED);
            activityLogService.recordForUser(
                    user.getId(),
                    ActivityAction.REFRESH_TOKEN_REVOKED,
                    "RefreshToken",
                    storedToken.getId(),
                    "Phát hiện dùng lại mã phiên đã thu hồi. Toàn bộ phiên đăng nhập đã bị hủy để bảo vệ tài khoản",
                    null,
                    null
            );
            throw new AppException(ErrorCode.TOKEN_REVOKED);
        }

        // 3. Expiration check
        if (storedToken.getExpiredAt().isBefore(LocalDateTime.now())) {
            storedToken.setRevoked(true);
            storedToken.setRevokedReason(RefreshTokenRevokeReason.EXPIRED);
            refreshTokenRepository.save(storedToken);
            throw new AppException(ErrorCode.TOKEN_EXPIRED);
        }

        // 4. A locked account must not keep minting access tokens from an old session
        if (Boolean.FALSE.equals(user.getIsActive())) {
            refreshTokenRepository.revokeAllActiveTokens(user, RefreshTokenRevokeReason.ACCOUNT_LOCKED);
            throw new AppException(ErrorCode.USER_INACTIVE);
        }

        // 5. Invalidate current token (rotation)
        storedToken.setRevoked(true);
        storedToken.setRevokedReason(RefreshTokenRevokeReason.ROTATED);
        storedToken.setLastUsedAt(LocalDateTime.now());
        refreshTokenRepository.save(storedToken);

        // 6. Issue new access token AND new rotated refresh token
        String newAccessToken = jwtService.generateAccessToken(user);
        String newRefreshToken = jwtService.generateRefreshToken(user);

        RefreshToken newTokenEntity = RefreshToken.builder()
                .user(user)
                .token(newRefreshToken)
                .type(TokenType.REFRESH)
                .expiredAt(refreshTokenExpiry())
                .lastUsedAt(LocalDateTime.now())
                .revoked(false)
                .build();
        refreshTokenRepository.save(newTokenEntity);

        UserResponse userResponse = userMapper.toResponse(user);

        return AuthResponse.builder()
                .accessToken(newAccessToken)
                .refreshToken(newRefreshToken)
                .user(userResponse)
                .build();
    }

    /**
     * True when the rotated token was exchanged moments ago AND the user already holds a newer live refresh token,
     * which is exactly what a second browser tab racing the first one looks like.
     */
    private boolean isConcurrentRotation(RefreshToken rotatedToken) {
        if (rotatedToken.getUser() == null || rotatedToken.getLastUsedAt() == null) {
            return false;
        }
        LocalDateTime rotatedAt = rotatedToken.getLastUsedAt();
        if (rotatedAt.isBefore(LocalDateTime.now().minus(CONCURRENT_REFRESH_GRACE))) {
            return false;
        }
        return refreshTokenRepository.existsByUserAndTypeAndRevokedFalseAndCreatedAtGreaterThanEqual(
                rotatedToken.getUser(), TokenType.REFRESH, rotatedAt.minusSeconds(2));
    }

    /**
     * Whether an address is registered must never be observable: unknown, locked and registered accounts all get
     * the same generic answer in the same time. So the mail is handed to the background mailer once the reset
     * token is committed (SMTP can take seconds) instead of being sent inside the request. The one failure that
     * does not depend on the address, "mail is not configured", is still reported honestly.
     */
    @Override
    public void forgotPassword(ForgotPasswordRequest request) {

        // Independent of the address, so it reveals nothing about which emails are registered.
        if (!emailService.isMailConfigured()) {
            throw new AppException(ErrorCode.EMAIL_SEND_FAILED,
                    "Hệ thống chưa cấu hình dịch vụ gửi email nên chưa thể gửi liên kết đặt lại mật khẩu. Vui lòng liên hệ quản trị viên.");
        }

        userRepository.findByEmail(EmailAddresses.normalize(request.getEmail()))
                .filter(user -> !Boolean.FALSE.equals(user.getIsActive()))
                .ifPresent(user -> {
                    refreshTokenRepository.revokeActiveTokensByType(
                            user, TokenType.RESET_PASSWORD, RefreshTokenRevokeReason.SUPERSEDED);

                    String resetToken = jwtService.generateResetPasswordToken(user);

                    RefreshToken tokenEntity = RefreshToken.builder()
                            .user(user)
                            .token(resetToken)
                            .type(TokenType.RESET_PASSWORD)
                            .expiredAt(LocalDateTime.now().plusMinutes(15))
                            .lastUsedAt(LocalDateTime.now())
                            .revoked(false)
                            .build();

                    refreshTokenRepository.save(tokenEntity);

                    activityLogService.recordForUser(user.getId(), ActivityAction.PASSWORD_RESET_REQUESTED, "User", user.getId(),
                            "Yêu cầu đặt lại mật khẩu cho: " + user.getEmail(), null, null);

                    String recipient = user.getEmail();
                    String recipientName = user.getFullName();
                    runAfterCommit(() -> emailService.sendPasswordResetEmailAsync(recipient, recipientName, resetToken));
                });
    }

    /** Runs {@code task} once the surrounding transaction committed (immediately when there is none). */
    private static void runAfterCommit(Runnable task) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    task.run();
                }
            });
        } else {
            task.run();
        }
    }


    @Override
    public void resetPassword(ResetPasswordRequest request) {

        if (!request.getNewPassword().equals(request.getConfirmPassword())) {
            throw new AppException(ErrorCode.PASSWORD_MISMATCH);
        }

        RefreshToken resetToken = refreshTokenRepository
                .findByTokenAndTypeAndRevokedFalse(request.getToken().trim(), TokenType.RESET_PASSWORD)
                .orElseThrow(() -> new AppException(ErrorCode.INVALID_RESET_TOKEN));

        if (resetToken.getExpiredAt().isBefore(LocalDateTime.now())) {
            resetToken.setRevoked(true);
            resetToken.setRevokedReason(RefreshTokenRevokeReason.EXPIRED);
            refreshTokenRepository.save(resetToken);
            throw new AppException(ErrorCode.INVALID_RESET_TOKEN);
        }

        User user = resetToken.getUser();

        if (passwordEncoder.matches(request.getNewPassword(), user.getPassword())) {
            throw new AppException(ErrorCode.NEW_PASSWORD_SAME_AS_OLD);
        }

        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);

        // Revoke every token (including this reset token) - the user must sign in again
        refreshTokenRepository.revokeAllActiveTokens(user, RefreshTokenRevokeReason.PASSWORD_CHANGED);

        activityLogService.recordForUser(user.getId(), ActivityAction.PASSWORD_RESET_COMPLETED, "User", user.getId(),
                "Đặt lại mật khẩu thành công cho: " + user.getEmail(), null, null);

    }


    @Override
    public void changePassword(String email, ChangePasswordRequest request) {

        if (!request.getNewPassword().equals(request.getConfirmPassword())) {
            throw new AppException(ErrorCode.PASSWORD_MISMATCH);
        }

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        if (!passwordEncoder.matches(request.getOldPassword(), user.getPassword())) {
            throw new AppException(ErrorCode.INVALID_OLD_PASSWORD);
        }

        if (passwordEncoder.matches(request.getNewPassword(), user.getPassword())) {
            throw new AppException(ErrorCode.NEW_PASSWORD_SAME_AS_OLD);
        }

        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);

        // Revoke all tokens - sign in again on every device
        refreshTokenRepository.revokeAllActiveTokens(user, RefreshTokenRevokeReason.PASSWORD_CHANGED);

        activityLogService.recordForUser(user.getId(), ActivityAction.PASSWORD_CHANGE, "User", user.getId(),
                "Đổi mật khẩu thành công cho: " + user.getEmail(), null, null);

    }

    @Override
    public AuthResponse googleLogin(GoogleLoginRequest request) {
        // Fail closed: without a configured OAuth client we cannot tell whose token this is.
        if (googleClientId == null || googleClientId.isBlank()) {
            log.warn("Google sign-in refused: GOOGLE_CLIENT_ID is not configured");
            throw new AppException(ErrorCode.GOOGLE_LOGIN_NOT_CONFIGURED);
        }

        String idToken = request.getIdToken();
        if (idToken == null || idToken.isBlank()) {
            throw new AppException(ErrorCode.INVALID_GOOGLE_TOKEN);
        }

        JsonNode jsonNode = fetchGoogleTokenInfo(idToken.trim());
        verifyGoogleClaims(jsonNode);

        String email = EmailAddresses.normalize(text(jsonNode, "email"));
        String name = text(jsonNode, "name");
        String picture = text(jsonNode, "picture");
        String mode = request.getMode() != null ? request.getMode().trim().toUpperCase(Locale.ROOT) : "LOGIN";

        User user = userRepository.findByEmail(email).orElse(null);

        if (user == null) {
            if (!"REGISTER".equals(mode)) {
                log.info("Google login attempt for unregistered email: {}", email);
                throw new AppException(ErrorCode.GOOGLE_ACCOUNT_NOT_REGISTERED);
            }

            // Auto-register new customer account via Google
            String username = resolveUniqueUsername(null, email);

            String fullName = (name != null && !name.isBlank()) ? name.trim() : username;
            if (fullName.length() > 30) {
                fullName = fullName.substring(0, 30);
            }

            Role customerRole = roleRepository.findByName("CUSTOMER")
                    .orElseThrow(() -> new AppException(ErrorCode.ROLE_NOT_FOUND));

            String randomPassword = passwordEncoder.encode(UUID.randomUUID().toString());

            User newUser = User.builder()
                    .username(username)
                    .email(email)
                    .password(randomPassword)
                    .fullName(fullName)
                    // No placeholder number: the phone stays empty until the customer completes the profile.
                    .phone(null)
                    .avatar(picture != null && picture.length() <= 255 ? picture : null)
                    .role(customerRole)
                    .isActive(true)
                    .build();

            user = saveNewUser(newUser);
            log.info("New user registered via Google OAuth: {} (ID: {})", email, user.getId());

            activityLogService.recordForUser(user.getId(), ActivityAction.USER_CREATE, "User", user.getId(),
                    "Đăng ký tài khoản mới qua Google: " + user.getEmail(), null, user.getId());
            activityLogService.recordLogin(user.getId(), user.getEmail(), true, "Đăng ký và đăng nhập bằng Google");
        } else {
            if (Boolean.FALSE.equals(user.getIsActive())) {
                activityLogService.recordLogin(user.getId(), user.getEmail(), false, "Tài khoản đã bị khóa");
                throw new AppException(ErrorCode.USER_INACTIVE);
            }

            if ((user.getAvatar() == null || user.getAvatar().isBlank()) && picture != null && picture.length() <= 255) {
                user.setAvatar(picture);
                userRepository.save(user);
            }

            activityLogService.recordLogin(user.getId(), user.getEmail(), true, "Đăng nhập bằng Google");
        }

        return buildAuthResponse(user);
    }

    /** Asks Google to validate the ID token (signature, expiry) and returns the claims. */
    JsonNode fetchGoogleTokenInfo(String idToken) {
        try {
            HttpClient client = HttpClient.newBuilder()
                    .connectTimeout(Duration.ofSeconds(10))
                    .build();

            String verifyUrl = "https://oauth2.googleapis.com/tokeninfo?id_token="
                    + URLEncoder.encode(idToken, StandardCharsets.UTF_8);

            HttpRequest httpRequest = HttpRequest.newBuilder()
                    .uri(URI.create(verifyUrl))
                    .GET()
                    .timeout(Duration.ofSeconds(10))
                    .build();

            HttpResponse<String> httpResponse = client.send(httpRequest, HttpResponse.BodyHandlers.ofString());

            if (httpResponse.statusCode() != 200) {
                log.warn("Google token verification failed with status: {}", httpResponse.statusCode());
                throw new AppException(ErrorCode.INVALID_GOOGLE_TOKEN);
            }
            return objectMapper.readTree(httpResponse.body());
        } catch (AppException e) {
            throw e;
        } catch (IOException e) {
            log.error("Could not reach Google to verify the ID token: {}", e.getMessage());
            throw new AppException(ErrorCode.INVALID_GOOGLE_TOKEN,
                    "Không kết nối được tới Google để xác thực. Vui lòng kiểm tra mạng và thử lại.");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new AppException(ErrorCode.INVALID_GOOGLE_TOKEN);
        } catch (Exception e) {
            log.error("Google authentication error: {}", e.getMessage(), e);
            throw new AppException(ErrorCode.INVALID_GOOGLE_TOKEN);
        }
    }

    /** Audience must be OUR client id; issuer must be Google; the email must exist and be verified. */
    void verifyGoogleClaims(JsonNode claims) {
        String aud = text(claims, "aud");
        if (!googleClientId.trim().equals(aud)) {
            log.warn("Google token audience mismatch (got aud: {})", aud);
            throw new AppException(ErrorCode.INVALID_GOOGLE_TOKEN);
        }
        String iss = text(claims, "iss");
        if (iss != null && !GOOGLE_ISSUERS.contains(iss)) {
            log.warn("Google token has an unexpected issuer: {}", iss);
            throw new AppException(ErrorCode.INVALID_GOOGLE_TOKEN);
        }
        String email = text(claims, "email");
        if (email == null || email.isBlank()) {
            throw new AppException(ErrorCode.INVALID_GOOGLE_TOKEN);
        }
        boolean emailVerified = claims.has("email_verified")
                && ("true".equalsIgnoreCase(claims.get("email_verified").asText()) || claims.get("email_verified").asBoolean(false));
        if (!emailVerified) {
            log.warn("Google account email is not verified: {}", email);
            throw new AppException(ErrorCode.INVALID_GOOGLE_TOKEN);
        }
    }

    private static String text(JsonNode node, String field) {
        return node != null && node.hasNonNull(field) ? node.get(field).asText() : null;
    }

    /**
     * Builds a username that is valid (3-30 chars, [a-z0-9_]) and not taken yet: the hint (or the email's local
     * part) is sanitised, then a numeric suffix is added while the name is already in use.
     */
    String resolveUniqueUsername(String hint, String email) {
        String source = (hint != null && !hint.isBlank()) ? hint : (email == null ? "" : email.split("@")[0]);
        String base = source.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9_]", "");
        if (base.length() < USERNAME_MIN_LENGTH) {
            base = ("user" + base);
        }
        // Leave room for a numeric suffix.
        if (base.length() > USERNAME_MAX_LENGTH - 5) {
            base = base.substring(0, USERNAME_MAX_LENGTH - 5);
        }

        String candidate = base;
        int counter = 1;
        while (userRepository.existsByUsername(candidate)) {
            candidate = base + counter++;
            if (counter > 10_000) {
                candidate = "u_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
                break;
            }
        }
        return candidate;
    }

    private LocalDateTime refreshTokenExpiry() {
        return LocalDateTime.now().plus(Duration.ofMillis(Math.max(refreshTokenTtlMillis, 60_000L)));
    }

    private AuthResponse buildAuthResponse(User user) {
        String accessToken = jwtService.generateAccessToken(user);
        String refreshTokenValue = jwtService.generateRefreshToken(user);

        RefreshToken refreshToken = RefreshToken.builder()
                .user(user)
                .token(refreshTokenValue)
                .type(TokenType.REFRESH)
                .expiredAt(refreshTokenExpiry())
                .lastUsedAt(LocalDateTime.now())
                .revoked(false)
                .build();

        refreshTokenRepository.save(refreshToken);
        enforceSessionLimit(user);

        UserResponse userResponse = userMapper.toResponse(user);

        return AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshTokenValue)
                .user(userResponse)
                .build();
    }

    /**
     * Every device keeps its own refresh token, so signing in on a phone does not sign the laptop out. To keep
     * the number of live sessions bounded, the oldest ones beyond {@code maxSessionsPerUser} are ended; their
     * owners just sign in again (a stale session is not reported as theft, see {@link #refreshToken}).
     */
    private void enforceSessionLimit(User user) {
        int limit = Math.max(1, maxSessionsPerUser);
        List<RefreshToken> live = refreshTokenRepository
                .findByUserAndTypeAndRevokedFalseAndExpiredAtAfterOrderByCreatedAtAsc(
                        user, TokenType.REFRESH, LocalDateTime.now());
        int excess = live.size() - limit;
        for (int i = 0; i < excess; i++) {
            RefreshToken oldest = live.get(i);
            oldest.setRevoked(true);
            oldest.setRevokedReason(RefreshTokenRevokeReason.SESSION_LIMIT);
            refreshTokenRepository.save(oldest);
        }
    }

    /**
     * Saves a new account. The unique index on lower(email) is the final guard against two simultaneous sign-ups
     * with the same address, which is reported like any other taken address instead of a generic conflict.
     */
    private User saveNewUser(User user) {
        try {
            return userRepository.saveAndFlush(user);
        } catch (DataIntegrityViolationException e) {
            String detail = e.getMostSpecificCause().getMessage();
            if (detail != null && detail.toLowerCase(Locale.ROOT).contains("email")) {
                throw new AppException(ErrorCode.EMAIL_ALREADY_EXISTS);
            }
            throw e;
        }
    }
}

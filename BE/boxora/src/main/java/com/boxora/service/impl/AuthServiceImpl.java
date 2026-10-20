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
import com.boxora.repository.RefreshTokenRepository;
import com.boxora.repository.RoleRepository;
import com.boxora.repository.UserRepository;
import com.boxora.service.AuthService;
import com.boxora.service.EmailService;
import com.boxora.service.JwtService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class AuthServiceImpl implements AuthService {

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


    @Override
    public AuthResponse register(RegisterRequest request) {

        captchaService.validate(request.getCaptchaId(), request.getCaptchaCode());

        if (userRepository.existsByEmail(request.getEmail())) {
            throw new AppException(ErrorCode.EMAIL_ALREADY_EXISTS);
        }
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new AppException(ErrorCode.USER_ALREADY_EXISTS);
        }

        Role studentRole = roleRepository.findByName("CUSTOMER")
                .orElseThrow(() -> new AppException(ErrorCode.ROLE_NOT_FOUND));

        User user = User.builder()
                .username(request.getUsername())
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .fullName(request.getFullName())
                .phone(request.getPhone())
                .role(studentRole)
                .isActive(true)
                .build();

        User saved = userRepository.save(user);
        log.info("User registered successfully with id: {}", saved.getId());

        activityLogService.recordForUser(saved.getId(), ActivityAction.USER_CREATE, "User", saved.getId(),
                "Dang ky tai khoan moi: " + saved.getEmail(), null, saved.getId());

        emailService.sendWelcomeEmail(saved.getEmail(), saved.getFullName());

        UserResponse userResponse = userMapper.toResponse(saved);

        return AuthResponse.builder()
                .user(userResponse)
                .build();
    }


    @Override
    public AuthResponse login(LoginRequest request) {

        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(
                            request.getEmail(),
                            request.getPassword()
                    )
            );
        } catch (BadCredentialsException e) {
            User failedUser = userRepository.findByEmail(request.getEmail()).orElse(null);
            activityLogService.recordLogin(failedUser != null ? failedUser.getId() : null,
                    request.getEmail(), false, "Invalid email or password");
            throw new AppException(ErrorCode.INVALID_CREDENTIALS);
        }

        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        activityLogService.recordLogin(user.getId(), user.getEmail(), true, null);

        // Revoke old refresh tokens
        refreshTokenRepository.revokeAllUserTokensByType(user, TokenType.REFRESH);

        return buildAuthResponse(user);
    }


    @Override
    public void logout(String refreshTokenValue) {

        RefreshToken refreshToken = refreshTokenRepository
                .findByTokenAndTypeAndRevokedFalse(refreshTokenValue, TokenType.REFRESH)
                .orElseThrow(() -> new AppException(ErrorCode.INVALID_REFRESH_TOKEN));

        refreshToken.setRevoked(true);
        refreshTokenRepository.save(refreshToken);

        if (refreshToken.getUser() != null) {
            activityLogService.recordLogout(refreshToken.getUser().getId());
        }

    }


    @Override
    public AuthResponse refreshToken(RefreshTokenRequest request) {

        // 1. Look up token regardless of revoked status to detect reuse attempts
        RefreshToken storedToken = refreshTokenRepository
                .findByTokenAndType(request.getRefreshToken(), TokenType.REFRESH)
                .orElseThrow(() -> new AppException(ErrorCode.INVALID_REFRESH_TOKEN));

        // 2. Token Reuse Detection: If token is already revoked, potential token theft / replay attack
        if (Boolean.TRUE.equals(storedToken.getRevoked())) {
            log.warn("Security Alert: Replay attack detected! Attempted reuse of revoked refresh token for user: {}",
                    storedToken.getUser() != null ? storedToken.getUser().getEmail() : "unknown");
            if (storedToken.getUser() != null) {
                refreshTokenRepository.revokeAllUserTokensByType(storedToken.getUser(), TokenType.REFRESH);
                activityLogService.recordForUser(
                        storedToken.getUser().getId(),
                        ActivityAction.USER_UPDATE,
                        "RefreshToken",
                        storedToken.getId(),
                        "Phat hien su dung lai refresh token da thu hoi - Huy tat ca phien dang nhap de bao ve tai khoan",
                        null,
                        null
                );
            }
            throw new AppException(ErrorCode.TOKEN_REVOKED);
        }

        // 3. Expiration Check
        if (storedToken.getExpiredAt().isBefore(LocalDateTime.now())) {
            storedToken.setRevoked(true);
            refreshTokenRepository.save(storedToken);
            throw new AppException(ErrorCode.TOKEN_EXPIRED);
        }

        // 4. Invalidate current token (Rotation)
        storedToken.setRevoked(true);
        storedToken.setLastUsedAt(LocalDateTime.now());
        refreshTokenRepository.save(storedToken);

        // 5. Issue new access token AND new rotated refresh token
        User user = storedToken.getUser();
        String newAccessToken = jwtService.generateAccessToken(user);
        String newRefreshToken = jwtService.generateRefreshToken(user);

        RefreshToken newTokenEntity = RefreshToken.builder()
                .user(user)
                .token(newRefreshToken)
                .type(TokenType.REFRESH)
                .expiredAt(LocalDateTime.now().plusDays(7))
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

    @Override
    public void forgotPassword(ForgotPasswordRequest request) {

        // Không throw lỗi nếu email không tồn tại — bảo mật
        userRepository.findByEmail(request.getEmail()).ifPresent(user -> {
            refreshTokenRepository.revokeAllUserTokensByType(user, TokenType.RESET_PASSWORD);

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
            emailService.sendPasswordResetEmail(user.getEmail(), user.getFullName(), resetToken);
            log.info("Password reset email sent to: {}", user.getEmail());

            activityLogService.recordForUser(user.getId(), ActivityAction.PASSWORD_RESET_REQUESTED, "User", user.getId(),
                    "Yeu cau dat lai mat khau cho: " + user.getEmail(), null, null);
        });
    }


    @Override
    public void resetPassword(ResetPasswordRequest request) {

        if (!request.getNewPassword().equals(request.getConfirmPassword())) {
            throw new AppException(ErrorCode.PASSWORD_MISMATCH);
        }

        RefreshToken resetToken = refreshTokenRepository
                .findByTokenAndTypeAndRevokedFalse(request.getToken(), TokenType.RESET_PASSWORD)
                .orElseThrow(() -> new AppException(ErrorCode.INVALID_RESET_TOKEN));

        if (resetToken.getExpiredAt().isBefore(LocalDateTime.now())) {
            resetToken.setRevoked(true);
            refreshTokenRepository.save(resetToken);
            throw new AppException(ErrorCode.INVALID_RESET_TOKEN);
        }

        User user = resetToken.getUser();

        if (passwordEncoder.matches(request.getNewPassword(), user.getPassword())) {
            throw new AppException(ErrorCode.NEW_PASSWORD_SAME_AS_OLD);
        }

        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);

        // Revoke tất cả token — bắt đăng nhập lại
        refreshTokenRepository.revokeAllUserTokens(user);

        activityLogService.recordForUser(user.getId(), ActivityAction.PASSWORD_RESET_COMPLETED, "User", user.getId(),
                "Dat lai mat khau thanh cong cho: " + user.getEmail(), null, null);

    }


    @Override
    public void changePassword(String email, ChangePasswordRequest request) {

        if (!request.getNewPassword().equals(request.getConfirmPassword())) {
            throw new AppException(ErrorCode.PASSWORD_MISMATCH);
        }

        User user = userRepository.findByEmail(email)
                .or(() -> userRepository.findByUsername(email))
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        if (!passwordEncoder.matches(request.getOldPassword(), user.getPassword())) {
            throw new AppException(ErrorCode.INVALID_OLD_PASSWORD);
        }

        if (passwordEncoder.matches(request.getNewPassword(), user.getPassword())) {
            throw new AppException(ErrorCode.NEW_PASSWORD_SAME_AS_OLD);
        }

        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);

        // Revoke tất cả token — bắt đăng nhập lại trên tất cả thiết bị
        refreshTokenRepository.revokeAllUserTokens(user);

        activityLogService.recordForUser(user.getId(), ActivityAction.PASSWORD_CHANGE, "User", user.getId(),
                "Doi mat khau thanh cong cho: " + user.getEmail(), null, null);

    }

    @org.springframework.beans.factory.annotation.Value("${google.client-id:}")
    private String googleClientId;

    private final com.fasterxml.jackson.databind.ObjectMapper objectMapper = new com.fasterxml.jackson.databind.ObjectMapper();

    @Override
    public AuthResponse googleLogin(GoogleLoginRequest request) {
        String idToken = request.getIdToken();
        if (idToken == null || idToken.isBlank()) {
            throw new AppException(ErrorCode.INVALID_GOOGLE_TOKEN);
        }

        try {
            java.net.http.HttpClient client = java.net.http.HttpClient.newBuilder()
                    .connectTimeout(java.time.Duration.ofSeconds(10))
                    .build();

            String verifyUrl = "https://oauth2.googleapis.com/tokeninfo?id_token=" 
                    + java.net.URLEncoder.encode(idToken, java.nio.charset.StandardCharsets.UTF_8);

            java.net.http.HttpRequest httpRequest = java.net.http.HttpRequest.newBuilder()
                    .uri(java.net.URI.create(verifyUrl))
                    .GET()
                    .timeout(java.time.Duration.ofSeconds(10))
                    .build();

            java.net.http.HttpResponse<String> httpResponse = client.send(
                    httpRequest, 
                    java.net.http.HttpResponse.BodyHandlers.ofString()
            );

            if (httpResponse.statusCode() != 200) {
                log.warn("Google token verification failed with status: {}, body: {}", httpResponse.statusCode(), httpResponse.body());
                throw new AppException(ErrorCode.INVALID_GOOGLE_TOKEN);
            }

            com.fasterxml.jackson.databind.JsonNode jsonNode = objectMapper.readTree(httpResponse.body());

            // Optional client-id check if configured
            if (googleClientId != null && !googleClientId.isBlank()) {
                String aud = jsonNode.has("aud") ? jsonNode.get("aud").asText() : "";
                String azp = jsonNode.has("azp") ? jsonNode.get("azp").asText() : "";
                if (!googleClientId.equals(aud) && !googleClientId.equals(azp)) {
                    log.warn("Google token audience mismatch. Expected: {}, Got aud: {}, azp: {}", googleClientId, aud, azp);
                    throw new AppException(ErrorCode.INVALID_GOOGLE_TOKEN);
                }
            }

            String email = jsonNode.has("email") ? jsonNode.get("email").asText() : null;
            if (email == null || email.isBlank()) {
                throw new AppException(ErrorCode.INVALID_GOOGLE_TOKEN);
            }

            boolean emailVerified = jsonNode.has("email_verified") && 
                    ("true".equalsIgnoreCase(jsonNode.get("email_verified").asText()) || jsonNode.get("email_verified").asBoolean(false));
            if (!emailVerified) {
                log.warn("Google account email is not verified: {}", email);
                throw new AppException(ErrorCode.INVALID_GOOGLE_TOKEN);
            }

            String name = jsonNode.has("name") ? jsonNode.get("name").asText() : null;
            String picture = jsonNode.has("picture") ? jsonNode.get("picture").asText() : null;
            String mode = request.getMode() != null ? request.getMode().trim().toUpperCase() : "LOGIN";

            User user = userRepository.findByEmail(email).orElse(null);

            if (user == null) {
                if ("LOGIN".equals(mode)) {
                    log.info("Google login attempt for unregistered email: {}", email);
                    throw new AppException(ErrorCode.GOOGLE_ACCOUNT_NOT_REGISTERED);
                }

                // Auto-register new customer account via Google (mode is REGISTER)
                String baseUsername = email.split("@")[0].replaceAll("[^a-zA-Z0-9_]", "");
                if (baseUsername.length() > 20) {
                    baseUsername = baseUsername.substring(0, 20);
                }
                if (baseUsername.isEmpty()) {
                    baseUsername = "user";
                }

                String finalUsername = baseUsername;
                int counter = 1;
                while (userRepository.existsByUsername(finalUsername)) {
                    finalUsername = baseUsername + (counter++);
                    if (finalUsername.length() > 30) {
                        finalUsername = "u_" + java.util.UUID.randomUUID().toString().substring(0, 8);
                    }
                }

                String fullName = (name != null && !name.isBlank()) ? name : baseUsername;
                if (fullName.length() > 30) {
                    fullName = fullName.substring(0, 30);
                }

                Role customerRole = roleRepository.findByName("CUSTOMER")
                        .orElseThrow(() -> new AppException(ErrorCode.ROLE_NOT_FOUND));

                String randomPassword = passwordEncoder.encode(java.util.UUID.randomUUID().toString());

                User newUser = User.builder()
                        .username(finalUsername)
                        .email(email)
                        .password(randomPassword)
                        .fullName(fullName)
                        .phone("0000000000") // Default placeholder for Google users
                        .avatar(picture)
                        .role(customerRole)
                        .isActive(true)
                        .build();

                user = userRepository.save(newUser);
                log.info("New user registered via Google OAuth: {} (ID: {})", email, user.getId());

                activityLogService.recordForUser(user.getId(), ActivityAction.USER_CREATE, "User", user.getId(),
                        "Dang ky tai khoan moi qua Google OAuth: " + user.getEmail(), null, user.getId());
                activityLogService.recordLogin(user.getId(), user.getEmail(), true, "Google OAuth Register & Login");
            } else {
                if (Boolean.FALSE.equals(user.getIsActive())) {
                    throw new AppException(ErrorCode.USER_INACTIVE);
                }

                if ((user.getAvatar() == null || user.getAvatar().isBlank()) && picture != null) {
                    user.setAvatar(picture);
                    userRepository.save(user);
                }

                activityLogService.recordLogin(user.getId(), user.getEmail(), true, "Google OAuth Login");
            }

            // Revoke old refresh tokens
            refreshTokenRepository.revokeAllUserTokensByType(user, TokenType.REFRESH);

            return buildAuthResponse(user);

        } catch (AppException e) {
            throw e;
        } catch (Exception e) {
            log.error("Google authentication error: {}", e.getMessage(), e);
            throw new AppException(ErrorCode.INVALID_GOOGLE_TOKEN);
        }
    }

    private AuthResponse buildAuthResponse(User user) {
        String accessToken = jwtService.generateAccessToken(user);
        String refreshTokenValue = jwtService.generateRefreshToken(user);

        RefreshToken refreshToken = RefreshToken.builder()
                .user(user)
                .token(refreshTokenValue)
                .type(TokenType.REFRESH)
                .expiredAt(LocalDateTime.now().plusDays(7))
                .lastUsedAt(LocalDateTime.now())
                .revoked(false)
                .build();

        refreshTokenRepository.save(refreshToken);

        UserResponse userResponse = userMapper.toResponse(user);

        return AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshTokenValue)
                .user(userResponse)
                .build();
    }
}
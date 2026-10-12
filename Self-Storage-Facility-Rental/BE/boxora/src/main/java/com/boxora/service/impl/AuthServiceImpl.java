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


    @Override
    public AuthResponse register(RegisterRequest request) {

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

        RefreshToken storedToken = refreshTokenRepository
                .findByTokenAndTypeAndRevokedFalse(request.getRefreshToken(), TokenType.REFRESH)
                .orElseThrow(() -> new AppException(ErrorCode.INVALID_REFRESH_TOKEN));

        if (storedToken.getExpiredAt().isBefore(LocalDateTime.now())) {
            storedToken.setRevoked(true);
            refreshTokenRepository.save(storedToken);
            throw new AppException(ErrorCode.TOKEN_EXPIRED);
        }

        storedToken.setLastUsedAt(LocalDateTime.now());
        refreshTokenRepository.save(storedToken);

        User user = storedToken.getUser();
        String newAccessToken = jwtService.generateAccessToken(user);
        UserResponse userResponse = userMapper.toResponse(user);

        return AuthResponse.builder()
                .accessToken(newAccessToken)
                .refreshToken(request.getRefreshToken())
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
package com.boxora.service.impl;

import com.boxora.dto.request.ForgotPasswordRequest;
import com.boxora.dto.request.GoogleLoginRequest;
import com.boxora.dto.request.LoginRequest;
import com.boxora.dto.request.RefreshTokenRequest;
import com.boxora.dto.request.RegisterRequest;
import com.boxora.dto.response.AuthResponse;
import com.boxora.dto.response.UserResponse;
import com.boxora.entity.RefreshToken;
import com.boxora.entity.Role;
import com.boxora.entity.User;
import com.boxora.enums.ActivityAction;
import com.boxora.enums.RefreshTokenRevokeReason;
import com.boxora.enums.TokenType;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.mapper.UserMapper;
import com.boxora.repository.RefreshTokenRepository;
import com.boxora.repository.RoleRepository;
import com.boxora.repository.UserRepository;
import com.boxora.service.ActivityLogService;
import com.boxora.service.CaptchaService;
import com.boxora.service.EmailService;
import com.boxora.service.JwtService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceImplTest {

    @Mock private UserRepository userRepository;
    @Mock private RoleRepository roleRepository;
    @Mock private RefreshTokenRepository refreshTokenRepository;
    @Mock private UserMapper userMapper;
    @Mock private JwtService jwtService;
    @Mock private AuthenticationManager authenticationManager;
    @Mock private EmailService emailService;
    @Mock private ActivityLogService activityLogService;
    @Mock private CaptchaService captchaService;

    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder(4);

    private AuthServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new AuthServiceImpl(userRepository, roleRepository, refreshTokenRepository, userMapper, jwtService,
                passwordEncoder, authenticationManager, emailService, activityLogService, captchaService);
        ReflectionTestUtils.setField(service, "googleClientId", "client-123.apps.googleusercontent.com");
        ReflectionTestUtils.setField(service, "refreshTokenTtlMillis", 604_800_000L);
    }

    private static Role role(String name) {
        return Role.builder().name(name).isActive(true).build();
    }

    private User user(String email, boolean active, String rawPassword) {
        User u = User.builder()
                .username("someone")
                .email(email)
                .password(passwordEncoder.encode(rawPassword))
                .fullName("Nguyen Van A")
                .phone("0912345678")
                .role(role("CUSTOMER"))
                .isActive(active)
                .build();
        u.setId(UUID.randomUUID());
        return u;
    }

    private RegisterRequest registerRequest(String username, String email) {
        return RegisterRequest.builder()
                .username(username)
                .email(email)
                .password("secret1")
                .fullName("Nguyen Van A")
                .phone("0912345678")
                .captchaId("cid")
                .captchaCode("ABCDE")
                .build();
    }

    // ------------------------------------------------------------------ register

    @Test
    @DisplayName("Đăng ký: tiền tố email đã là username -> tự sinh username khác, không báo lỗi")
    void registerDerivesUniqueUsernameWhenEmailPrefixIsTaken() {
        when(userRepository.existsByEmail("john@yahoo.com")).thenReturn(false);
        when(roleRepository.findByName("CUSTOMER")).thenReturn(Optional.of(role("CUSTOMER")));
        when(userRepository.existsByUsername("john")).thenReturn(true);
        when(userRepository.existsByUsername("john1")).thenReturn(true);
        when(userRepository.existsByUsername("john2")).thenReturn(false);
        when(userRepository.saveAndFlush(any(User.class))).thenAnswer(inv -> {
            User saved = inv.getArgument(0);
            saved.setId(UUID.randomUUID());
            return saved;
        });
        when(userMapper.toResponse(any(User.class))).thenReturn(new UserResponse());

        AuthResponse response = service.register(registerRequest("john", "john@yahoo.com"));

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).saveAndFlush(captor.capture());
        assertEquals("john2", captor.getValue().getUsername());
        assertNotNull(response.getUser());
        verify(captchaService).validate("cid", "ABCDE");
        verify(emailService).sendWelcomeEmail(eq("john@yahoo.com"), anyString());
    }

    @Test
    @DisplayName("Đăng ký: không gửi username vẫn tạo được tài khoản (username lấy từ email, chữ thường, hợp lệ)")
    void registerWithoutUsernameHint() {
        when(userRepository.existsByEmail(anyString())).thenReturn(false);
        when(roleRepository.findByName("CUSTOMER")).thenReturn(Optional.of(role("CUSTOMER")));
        when(userRepository.existsByUsername(anyString())).thenReturn(false);
        when(userRepository.saveAndFlush(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        when(userMapper.toResponse(any(User.class))).thenReturn(new UserResponse());

        service.register(registerRequest(null, "Nguyen.Van-A+tag@gmail.com"));

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).saveAndFlush(captor.capture());
        assertEquals("nguyenvanatag", captor.getValue().getUsername());
    }

    @Test
    @DisplayName("Đăng ký: email đã tồn tại vẫn bị từ chối (EMAIL_ALREADY_EXISTS)")
    void registerRejectsExistingEmail() {
        when(userRepository.existsByEmail("a@b.vn")).thenReturn(true);
        AppException ex = assertThrows(AppException.class, () -> service.register(registerRequest(null, "a@b.vn")));
        assertEquals(ErrorCode.EMAIL_ALREADY_EXISTS, ex.getErrorCode());
        verify(userRepository, never()).saveAndFlush(any());
    }

    @Test
    @DisplayName("Đăng ký: email khác hoa/thường với tài khoản có sẵn vẫn bị từ chối, và email luôn được lưu dạng chữ thường")
    void registerTreatsEmailCaseInsensitively() {
        when(userRepository.existsByEmail("customer@gmail.com")).thenReturn(true);
        AppException ex = assertThrows(AppException.class,
                () -> service.register(registerRequest(null, "  Customer@Gmail.COM ")));
        assertEquals(ErrorCode.EMAIL_ALREADY_EXISTS, ex.getErrorCode());
        verify(userRepository, never()).saveAndFlush(any());

        when(userRepository.existsByEmail("new.person@gmail.com")).thenReturn(false);
        when(roleRepository.findByName("CUSTOMER")).thenReturn(Optional.of(role("CUSTOMER")));
        when(userRepository.existsByUsername(anyString())).thenReturn(false);
        when(userRepository.saveAndFlush(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        when(userMapper.toResponse(any(User.class))).thenReturn(new UserResponse());

        service.register(registerRequest(null, "New.Person@Gmail.com"));

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).saveAndFlush(captor.capture());
        assertEquals("new.person@gmail.com", captor.getValue().getEmail());
    }

    @Test
    @DisplayName("Đăng ký đồng thời cùng một email: chỉ mục duy nhất trên lower(email) được báo như email đã tồn tại")
    void registerRaceOnUniqueEmailIndexIsReportedAsTaken() {
        when(userRepository.existsByEmail(anyString())).thenReturn(false);
        when(roleRepository.findByName("CUSTOMER")).thenReturn(Optional.of(role("CUSTOMER")));
        when(userRepository.existsByUsername(anyString())).thenReturn(false);
        when(userRepository.saveAndFlush(any(User.class))).thenThrow(new org.springframework.dao.DataIntegrityViolationException(
                "could not execute statement",
                new RuntimeException("ERROR: duplicate key value violates unique constraint \"uq_users_email_lower\"")));

        AppException ex = assertThrows(AppException.class, () -> service.register(registerRequest(null, "race@x.vn")));

        assertEquals(ErrorCode.EMAIL_ALREADY_EXISTS, ex.getErrorCode());
    }

    @Test
    @DisplayName("Tên đăng nhập quá ngắn hoặc chỉ có ký tự đặc biệt vẫn cho ra username hợp lệ 3-30 ký tự")
    void usernameAlwaysWithinBounds() {
        when(userRepository.existsByUsername(anyString())).thenReturn(false);
        String shortOne = service.resolveUniqueUsername(null, "a@x.vn");
        String symbols = service.resolveUniqueUsername(null, "...@x.vn");
        String longOne = service.resolveUniqueUsername(null, "a".repeat(80) + "@x.vn");
        for (String name : new String[]{shortOne, symbols, longOne}) {
            assertTrue(name.length() >= 3 && name.length() <= 30, name);
            assertTrue(name.matches("[a-z0-9_]+"), name);
        }
    }

    // ------------------------------------------------------------------ login

    @Test
    @DisplayName("Đăng nhập tài khoản bị khóa với mật khẩu đúng -> USER_INACTIVE (mã 203)")
    void loginLockedAccountReportsLocked() {
        User locked = user("locked@boxora.vn", false, "123456");
        when(userRepository.findByEmail("locked@boxora.vn")).thenReturn(Optional.of(locked));

        AppException ex = assertThrows(AppException.class,
                () -> service.login(LoginRequest.builder().email("locked@boxora.vn").password("123456").build()));

        assertEquals(ErrorCode.USER_INACTIVE, ex.getErrorCode());
        assertEquals(203, ex.getErrorCode().getCode());
        verify(authenticationManager, never()).authenticate(any());
        verify(activityLogService).recordLogin(eq(locked.getId()), eq("locked@boxora.vn"), eq(false), anyString());
    }

    @Test
    @DisplayName("Đăng nhập tài khoản bị khóa với mật khẩu sai -> INVALID_CREDENTIALS (không lộ trạng thái khóa)")
    void loginLockedAccountWrongPasswordDoesNotLeakLockStatus() {
        User locked = user("locked@boxora.vn", false, "123456");
        when(userRepository.findByEmail("locked@boxora.vn")).thenReturn(Optional.of(locked));

        AppException ex = assertThrows(AppException.class,
                () -> service.login(LoginRequest.builder().email("locked@boxora.vn").password("wrong").build()));

        assertEquals(ErrorCode.INVALID_CREDENTIALS, ex.getErrorCode());
    }

    @Test
    @DisplayName("Đăng nhập sai mật khẩu -> INVALID_CREDENTIALS và ghi nhật ký thất bại")
    void loginBadCredentials() {
        User u = user("ok@boxora.vn", true, "123456");
        when(userRepository.findByEmail("ok@boxora.vn")).thenReturn(Optional.of(u));
        when(authenticationManager.authenticate(any())).thenThrow(new BadCredentialsException("bad"));

        AppException ex = assertThrows(AppException.class,
                () -> service.login(LoginRequest.builder().email("ok@boxora.vn").password("nope").build()));

        assertEquals(ErrorCode.INVALID_CREDENTIALS, ex.getErrorCode());
        verify(activityLogService).recordLogin(eq(u.getId()), eq("ok@boxora.vn"), eq(false), anyString());
    }

    @Test
    @DisplayName("Đăng nhập: email gõ HOA/thường tùy ý vẫn tìm đúng tài khoản (chuẩn hóa về chữ thường)")
    void loginIsCaseInsensitiveOnEmail() {
        User u = user("customer@gmail.com", true, "123456");
        when(userRepository.findByEmail("customer@gmail.com")).thenReturn(Optional.of(u));
        when(jwtService.generateAccessToken(u)).thenReturn("access");
        when(jwtService.generateRefreshToken(u)).thenReturn("refresh");
        when(userMapper.toResponse(u)).thenReturn(new UserResponse());

        AuthResponse response = service.login(LoginRequest.builder().email("  CUSTOMER@Gmail.com ").password("123456").build());

        assertEquals("access", response.getAccessToken());
        ArgumentCaptor<org.springframework.security.authentication.UsernamePasswordAuthenticationToken> token =
                ArgumentCaptor.forClass(org.springframework.security.authentication.UsernamePasswordAuthenticationToken.class);
        verify(authenticationManager).authenticate(token.capture());
        assertEquals("customer@gmail.com", token.getValue().getPrincipal());
    }

    @Test
    @DisplayName("Đăng nhập trên thiết bị thứ hai KHÔNG thu hồi phiên của thiết bị đang đăng nhập")
    void secondDeviceLoginKeepsOtherSessions() {
        User u = user("multi@boxora.vn", true, "123456");
        when(userRepository.findByEmail("multi@boxora.vn")).thenReturn(Optional.of(u));
        when(jwtService.generateAccessToken(u)).thenReturn("access");
        when(jwtService.generateRefreshToken(u)).thenReturn("refresh-2");
        when(userMapper.toResponse(u)).thenReturn(new UserResponse());
        RefreshToken firstDevice = storedToken(u, false, LocalDateTime.now().minusHours(2));
        RefreshToken secondDevice = storedToken(u, false, LocalDateTime.now());
        when(refreshTokenRepository.findByUserAndTypeAndRevokedFalseAndExpiredAtAfterOrderByCreatedAtAsc(
                eq(u), eq(TokenType.REFRESH), any())).thenReturn(List.of(firstDevice, secondDevice));

        service.login(LoginRequest.builder().email("multi@boxora.vn").password("123456").build());

        verify(refreshTokenRepository, never()).revokeAllActiveTokens(any(), any());
        verify(refreshTokenRepository, never()).revokeActiveTokensByType(any(), any(), any());
        assertFalse(firstDevice.getRevoked(), "the first device stays signed in");
        assertFalse(secondDevice.getRevoked());
    }

    @Test
    @DisplayName("Quá số thiết bị cho phép: chỉ phiên CŨ NHẤT bị kết thúc (lý do SESSION_LIMIT), không bị coi là bị đánh cắp")
    void sessionLimitEndsOnlyTheOldestSessions() {
        ReflectionTestUtils.setField(service, "maxSessionsPerUser", 2);
        User u = user("many@boxora.vn", true, "123456");
        when(userRepository.findByEmail("many@boxora.vn")).thenReturn(Optional.of(u));
        when(jwtService.generateAccessToken(u)).thenReturn("access");
        when(jwtService.generateRefreshToken(u)).thenReturn("refresh-4");
        when(userMapper.toResponse(u)).thenReturn(new UserResponse());
        RefreshToken d1 = storedToken(u, false, LocalDateTime.now().minusHours(3));
        RefreshToken d2 = storedToken(u, false, LocalDateTime.now().minusHours(2));
        RefreshToken d3 = storedToken(u, false, LocalDateTime.now().minusHours(1));
        RefreshToken d4 = storedToken(u, false, LocalDateTime.now());
        when(refreshTokenRepository.findByUserAndTypeAndRevokedFalseAndExpiredAtAfterOrderByCreatedAtAsc(
                eq(u), eq(TokenType.REFRESH), any())).thenReturn(List.of(d1, d2, d3, d4));

        service.login(LoginRequest.builder().email("many@boxora.vn").password("123456").build());

        assertTrue(d1.getRevoked());
        assertTrue(d2.getRevoked());
        assertEquals(RefreshTokenRevokeReason.SESSION_LIMIT, d1.getRevokedReason());
        assertFalse(d3.getRevoked());
        assertFalse(d4.getRevoked());
    }

    // ------------------------------------------------------------------ Google

    private static com.fasterxml.jackson.databind.JsonNode claims(String json) throws Exception {
        return new ObjectMapper().readTree(json);
    }

    @Test
    @DisplayName("Google: chưa cấu hình GOOGLE_CLIENT_ID -> từ chối ngay (307), không gọi Google")
    void googleRefusedWhenClientIdBlank() {
        ReflectionTestUtils.setField(service, "googleClientId", "");
        AuthServiceImpl spy = Mockito.spy(service);

        AppException ex = assertThrows(AppException.class,
                () -> spy.googleLogin(GoogleLoginRequest.builder().idToken("x").mode("LOGIN").build()));

        assertEquals(ErrorCode.GOOGLE_LOGIN_NOT_CONFIGURED, ex.getErrorCode());
        verify(spy, never()).fetchGoogleTokenInfo(anyString());
    }

    @Test
    @DisplayName("Google: token cấp cho client khác (aud khác) bị từ chối")
    void googleRejectsForeignAudience() throws Exception {
        AuthServiceImpl spy = Mockito.spy(service);
        doReturn(claims("{\"aud\":\"someone-else\",\"email\":\"a@b.vn\",\"email_verified\":\"true\"}"))
                .when(spy).fetchGoogleTokenInfo(anyString());

        AppException ex = assertThrows(AppException.class,
                () -> spy.googleLogin(GoogleLoginRequest.builder().idToken("t").mode("LOGIN").build()));

        assertEquals(ErrorCode.INVALID_GOOGLE_TOKEN, ex.getErrorCode());
        verify(userRepository, never()).saveAndFlush(any());
    }

    @Test
    @DisplayName("Google: email chưa xác minh bị từ chối")
    void googleRejectsUnverifiedEmail() throws Exception {
        AuthServiceImpl spy = Mockito.spy(service);
        doReturn(claims("{\"aud\":\"client-123.apps.googleusercontent.com\",\"email\":\"a@b.vn\",\"email_verified\":\"false\"}"))
                .when(spy).fetchGoogleTokenInfo(anyString());

        AppException ex = assertThrows(AppException.class,
                () -> spy.googleLogin(GoogleLoginRequest.builder().idToken("t").mode("LOGIN").build()));

        assertEquals(ErrorCode.INVALID_GOOGLE_TOKEN, ex.getErrorCode());
    }

    @Test
    @DisplayName("Google: chế độ LOGIN với email chưa đăng ký -> GOOGLE_ACCOUNT_NOT_REGISTERED (306)")
    void googleLoginUnknownAccount() throws Exception {
        AuthServiceImpl spy = Mockito.spy(service);
        doReturn(claims("{\"aud\":\"client-123.apps.googleusercontent.com\",\"iss\":\"https://accounts.google.com\",\"email\":\"new@gmail.com\",\"email_verified\":true}"))
                .when(spy).fetchGoogleTokenInfo(anyString());
        when(userRepository.findByEmail("new@gmail.com")).thenReturn(Optional.empty());

        AppException ex = assertThrows(AppException.class,
                () -> spy.googleLogin(GoogleLoginRequest.builder().idToken("t").mode("LOGIN").build()));

        assertEquals(ErrorCode.GOOGLE_ACCOUNT_NOT_REGISTERED, ex.getErrorCode());
    }

    @Test
    @DisplayName("Google: đăng ký mới không ghi số điện thoại giả, lưu ảnh đại diện")
    void googleRegisterHasNoPlaceholderPhone() throws Exception {
        AuthServiceImpl spy = Mockito.spy(service);
        doReturn(claims("{\"aud\":\"client-123.apps.googleusercontent.com\",\"iss\":\"accounts.google.com\",\"email\":\"new@gmail.com\","
                + "\"email_verified\":true,\"name\":\"Nguyen Van B\",\"picture\":\"https://img.example/p.png\"}"))
                .when(spy).fetchGoogleTokenInfo(anyString());
        when(userRepository.findByEmail("new@gmail.com")).thenReturn(Optional.empty());
        when(userRepository.existsByUsername(anyString())).thenReturn(false);
        when(roleRepository.findByName("CUSTOMER")).thenReturn(Optional.of(role("CUSTOMER")));
        when(userRepository.saveAndFlush(any(User.class))).thenAnswer(inv -> {
            User saved = inv.getArgument(0);
            saved.setId(UUID.randomUUID());
            return saved;
        });
        when(jwtService.generateAccessToken(any())).thenReturn("access");
        when(jwtService.generateRefreshToken(any())).thenReturn("refresh");
        when(userMapper.toResponse(any(User.class))).thenReturn(new UserResponse());

        AuthResponse response = spy.googleLogin(GoogleLoginRequest.builder().idToken("t").mode("REGISTER").build());

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).saveAndFlush(captor.capture());
        assertNull(captor.getValue().getPhone(), "no fake phone number");
        assertEquals("https://img.example/p.png", captor.getValue().getAvatar());
        assertEquals("access", response.getAccessToken());
    }

    // ------------------------------------------------------------------ forgot password

    @Test
    @DisplayName("Quên mật khẩu: chưa cấu hình email -> báo lỗi thật (EMAIL_SEND_FAILED), không giả vờ đã gửi")
    void forgotPasswordFailsHonestlyWithoutMail() {
        when(emailService.isMailConfigured()).thenReturn(false);

        AppException ex = assertThrows(AppException.class,
                () -> service.forgotPassword(ForgotPasswordRequest.builder().email("a@b.vn").build()));

        assertEquals(ErrorCode.EMAIL_SEND_FAILED, ex.getErrorCode());
        verify(userRepository, never()).findByEmail(anyString());
        verify(emailService, never()).sendPasswordResetEmail(anyString(), anyString(), anyString());
    }

    @Test
    @DisplayName("Quên mật khẩu: email lạ -> trả thành công chung, không gửi thư (không lộ email nào đã đăng ký)")
    void forgotPasswordUnknownEmailIsSilent() {
        when(emailService.isMailConfigured()).thenReturn(true);
        when(userRepository.findByEmail("ghost@x.vn")).thenReturn(Optional.empty());

        assertDoesNotThrow(() -> service.forgotPassword(ForgotPasswordRequest.builder().email("ghost@x.vn").build()));

        verify(emailService, never()).sendPasswordResetEmail(anyString(), anyString(), anyString());
    }

    @Test
    @DisplayName("Quên mật khẩu: email đã đăng ký -> thư giao cho bộ gửi nền, request không chờ SMTP (thời gian phản hồi không lộ email)")
    void forgotPasswordHandsTheMailToTheBackgroundMailer() {
        User u = user("real@boxora.vn", true, "123456");
        when(emailService.isMailConfigured()).thenReturn(true);
        when(userRepository.findByEmail("real@boxora.vn")).thenReturn(Optional.of(u));
        when(jwtService.generateResetPasswordToken(u)).thenReturn("reset-token");

        service.forgotPassword(ForgotPasswordRequest.builder().email("real@boxora.vn").build());

        verify(emailService).sendPasswordResetEmailAsync("real@boxora.vn", "Nguyen Van A", "reset-token");
        verify(emailService, never()).sendPasswordResetEmail(anyString(), anyString(), anyString());
        verify(refreshTokenRepository).revokeActiveTokensByType(u, TokenType.RESET_PASSWORD, RefreshTokenRevokeReason.SUPERSEDED);
        ArgumentCaptor<RefreshToken> saved = ArgumentCaptor.forClass(RefreshToken.class);
        verify(refreshTokenRepository).save(saved.capture());
        assertEquals(TokenType.RESET_PASSWORD, saved.getValue().getType());
        assertEquals("reset-token", saved.getValue().getToken());
        verify(activityLogService).recordForUser(eq(u.getId()), eq(ActivityAction.PASSWORD_RESET_REQUESTED),
                anyString(), eq(u.getId()), anyString(), any(), any());
    }

    @Test
    @DisplayName("Quên mật khẩu: email gõ HOA/thường tùy ý vẫn nhận được thư; tài khoản bị khóa im lặng như email lạ")
    void forgotPasswordIsCaseInsensitiveAndSilentForLockedAccounts() {
        User active = user("real@boxora.vn", true, "123456");
        User locked = user("locked@boxora.vn", false, "123456");
        when(emailService.isMailConfigured()).thenReturn(true);
        when(userRepository.findByEmail("real@boxora.vn")).thenReturn(Optional.of(active));
        when(userRepository.findByEmail("locked@boxora.vn")).thenReturn(Optional.of(locked));
        when(jwtService.generateResetPasswordToken(active)).thenReturn("reset-token");

        service.forgotPassword(ForgotPasswordRequest.builder().email(" Real@BOXORA.vn ").build());
        service.forgotPassword(ForgotPasswordRequest.builder().email("locked@boxora.vn").build());

        verify(emailService).sendPasswordResetEmailAsync("real@boxora.vn", "Nguyen Van A", "reset-token");
        verify(emailService, never()).sendPasswordResetEmailAsync(eq("locked@boxora.vn"), anyString(), anyString());
    }

    // ------------------------------------------------------------------ refresh

    private RefreshToken storedToken(User u, boolean revoked, LocalDateTime lastUsedAt) {
        RefreshToken t = RefreshToken.builder()
                .user(u)
                .token("old-refresh")
                .type(TokenType.REFRESH)
                .expiredAt(LocalDateTime.now().plusDays(3))
                .lastUsedAt(lastUsedAt)
                .revoked(revoked)
                .build();
        t.setId(UUID.randomUUID());
        return t;
    }

    @Test
    @DisplayName("Refresh: tài khoản bị khóa không được cấp access token mới và bị thu hồi mọi phiên")
    void refreshRefusesLockedAccount() {
        User locked = user("locked@boxora.vn", false, "123456");
        when(refreshTokenRepository.findByTokenAndType("old-refresh", TokenType.REFRESH))
                .thenReturn(Optional.of(storedToken(locked, false, LocalDateTime.now())));

        AppException ex = assertThrows(AppException.class,
                () -> service.refreshToken(RefreshTokenRequest.builder().refreshToken("old-refresh").build()));

        assertEquals(ErrorCode.USER_INACTIVE, ex.getErrorCode());
        verify(refreshTokenRepository).revokeAllActiveTokens(locked, RefreshTokenRevokeReason.ACCOUNT_LOCKED);
        verify(jwtService, never()).generateAccessToken(any());
    }

    @Test
    @DisplayName("Refresh: token vừa được xoay vòng bởi tab khác (còn token mới hợp lệ) -> chỉ cấp access token, không báo tấn công")
    void refreshGraceForConcurrentRotation() {
        User u = user("ok@boxora.vn", true, "123456");
        RefreshToken rotated = storedToken(u, true, LocalDateTime.now().minusSeconds(3));
        rotated.setRevokedReason(RefreshTokenRevokeReason.ROTATED);
        when(refreshTokenRepository.findByTokenAndType("old-refresh", TokenType.REFRESH)).thenReturn(Optional.of(rotated));
        when(refreshTokenRepository.existsByUserAndTypeAndRevokedFalseAndCreatedAtGreaterThanEqual(eq(u), eq(TokenType.REFRESH), any()))
                .thenReturn(true);
        when(jwtService.generateAccessToken(u)).thenReturn("fresh-access");
        when(userMapper.toResponse(u)).thenReturn(new UserResponse());

        AuthResponse response = service.refreshToken(RefreshTokenRequest.builder().refreshToken("old-refresh").build());

        assertEquals("fresh-access", response.getAccessToken());
        assertNull(response.getRefreshToken(), "the cookie rotated by the other tab must not be overwritten");
        verify(refreshTokenRepository, never()).revokeAllActiveTokens(any(), any());
    }

    @Test
    @DisplayName("Refresh: dùng lại token ĐÃ XOAY VÒNG sau thời gian ân hạn = replay -> thu hồi toàn bộ phiên và ghi cảnh báo")
    void refreshReplayOfRotatedTokenRevokesEverything() {
        User u = user("ok@boxora.vn", true, "123456");
        RefreshToken stolen = storedToken(u, true, LocalDateTime.now().minusMinutes(10));
        stolen.setRevokedReason(RefreshTokenRevokeReason.ROTATED);
        when(refreshTokenRepository.findByTokenAndType("old-refresh", TokenType.REFRESH)).thenReturn(Optional.of(stolen));

        AppException ex = assertThrows(AppException.class,
                () -> service.refreshToken(RefreshTokenRequest.builder().refreshToken("old-refresh").build()));

        assertEquals(ErrorCode.TOKEN_REVOKED, ex.getErrorCode());
        verify(refreshTokenRepository).revokeAllActiveTokens(u, RefreshTokenRevokeReason.REPLAY_DETECTED);
        verify(activityLogService).recordForUser(eq(u.getId()), eq(ActivityAction.REFRESH_TOKEN_REVOKED),
                anyString(), any(), anyString(), any(), any());
    }

    @Test
    @DisplayName("Refresh: phiên đã bị kết thúc vì lý do thường (đăng xuất, quá số thiết bị, đổi mật khẩu) KHÔNG phải tấn công: không đụng tới thiết bị khác")
    void refreshWithOrdinarilyEndedSessionIsNotTheft() {
        User u = user("ok@boxora.vn", true, "123456");
        for (RefreshTokenRevokeReason reason : new RefreshTokenRevokeReason[]{RefreshTokenRevokeReason.LOGOUT,
                RefreshTokenRevokeReason.SESSION_LIMIT, RefreshTokenRevokeReason.PASSWORD_CHANGED,
                RefreshTokenRevokeReason.ACCOUNT_LOCKED, null}) {
            RefreshToken ended = storedToken(u, true, LocalDateTime.now().minusSeconds(2));
            ended.setRevokedReason(reason);
            when(refreshTokenRepository.findByTokenAndType("old-refresh", TokenType.REFRESH)).thenReturn(Optional.of(ended));

            AppException ex = assertThrows(AppException.class,
                    () -> service.refreshToken(RefreshTokenRequest.builder().refreshToken("old-refresh").build()),
                    String.valueOf(reason));

            assertEquals(ErrorCode.TOKEN_REVOKED, ex.getErrorCode());
        }
        verify(refreshTokenRepository, never()).revokeAllActiveTokens(any(), any());
        verify(activityLogService, never()).recordForUser(any(), eq(ActivityAction.REFRESH_TOKEN_REVOKED),
                anyString(), any(), anyString(), any(), any());
    }

    @Test
    @DisplayName("Refresh: xoay vòng bình thường cấp access + refresh token mới")
    void refreshRotatesNormally() {
        User u = user("ok@boxora.vn", true, "123456");
        RefreshToken valid = storedToken(u, false, LocalDateTime.now().minusHours(1));
        when(refreshTokenRepository.findByTokenAndType("old-refresh", TokenType.REFRESH)).thenReturn(Optional.of(valid));
        when(jwtService.generateAccessToken(u)).thenReturn("new-access");
        when(jwtService.generateRefreshToken(u)).thenReturn("new-refresh");
        when(userMapper.toResponse(u)).thenReturn(new UserResponse());

        AuthResponse response = service.refreshToken(RefreshTokenRequest.builder().refreshToken("old-refresh").build());

        assertEquals("new-access", response.getAccessToken());
        assertEquals("new-refresh", response.getRefreshToken());
        assertTrue(valid.getRevoked());
        assertEquals(RefreshTokenRevokeReason.ROTATED, valid.getRevokedReason(), "only rotation marks a token as replayable-theft");
    }

    @Test
    @DisplayName("Đăng xuất: token bị thu hồi với lý do LOGOUT")
    void logoutRecordsTheReason() {
        User u = user("out@boxora.vn", true, "123456");
        RefreshToken live = storedToken(u, false, LocalDateTime.now());
        when(refreshTokenRepository.findByTokenAndTypeAndRevokedFalse("old-refresh", TokenType.REFRESH))
                .thenReturn(Optional.of(live));

        service.logout("old-refresh");

        assertTrue(live.getRevoked());
        assertEquals(RefreshTokenRevokeReason.LOGOUT, live.getRevokedReason());
    }
}

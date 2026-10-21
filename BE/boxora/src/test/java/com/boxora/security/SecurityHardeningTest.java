package com.boxora.security;

import com.boxora.config.JwtAuthenticationFilter;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.service.impl.JwtServiceImpl;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;

import java.time.Duration;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Authorization and fail-closed behaviour of the shared security layer. */
class SecurityHardeningTest {

    // ---------------------------------------------------------------- facility guard

    static class TestRequestContext extends RequestContext {
        String role;
        UUID facilityId;

        TestRequestContext() {
            super(null);
        }

        @Override
        public String currentUserRole() {
            return role;
        }

        @Override
        public UUID currentUserFacilityId() {
            return facilityId;
        }
    }

    @Nested
    class FacilityGuard {
        private TestRequestContext context;
        private FacilityAccessGuard guard;

        @BeforeEach
        void setUp() {
            context = new TestRequestContext();
            guard = new FacilityAccessGuard(context);
        }

        @Test
        @DisplayName("STAFF chưa được phân công cơ sở: không còn được xem dữ liệu toàn hệ thống (403, không phải 'không lọc')")
        void unassignedStaffFailsClosed() {
            context.role = "STAFF";
            context.facilityId = null;

            assertTrue(guard.isFacilityScoped());
            AppException ex = assertThrows(AppException.class, guard::scopedFacilityIdOrNull);
            assertEquals(ErrorCode.FACILITY_ACCESS_DENIED, ex.getErrorCode());
            assertThrows(AppException.class, () -> guard.checkFacilityAccess(UUID.randomUUID()));
        }

        @Test
        @DisplayName("FACILITY_MANAGER chưa được phân công cơ sở cũng bị chặn")
        void unassignedFacilityManagerFailsClosed() {
            context.role = "FACILITY_MANAGER";
            context.facilityId = null;

            assertThrows(AppException.class, guard::scopedFacilityIdOrNull);
        }

        @Test
        @DisplayName("STAFF đã phân công chỉ nhận đúng cơ sở của mình")
        void assignedStaffGetsOwnFacility() {
            UUID facility = UUID.randomUUID();
            context.role = "STAFF";
            context.facilityId = facility;

            assertEquals(facility, guard.scopedFacilityIdOrNull());
        }

        @Test
        @DisplayName("ADMIN, BUSINESS_MANAGER, CUSTOMER và khách ẩn danh không bị lọc theo cơ sở")
        void systemWideRolesAreNotScoped() {
            for (String role : new String[]{"ADMIN", "BUSINESS_MANAGER", "CUSTOMER", null}) {
                context.role = role;
                context.facilityId = null;
                assertFalse(guard.isFacilityScoped(), String.valueOf(role));
                assertNull(guard.scopedFacilityIdOrNull(), String.valueOf(role));
            }
        }
    }

    // ---------------------------------------------------------------- JWT filter

    @Nested
    class JwtFilter {
        private JwtServiceImpl jwtService;
        private UserDetailsService userDetailsService;
        private JwtAuthenticationFilter filter;

        @BeforeEach
        void setUp() {
            SecurityContextHolder.clearContext();
            jwtService = mock(JwtServiceImpl.class);
            userDetailsService = mock(UserDetailsService.class);
            filter = new JwtAuthenticationFilter(jwtService, userDetailsService);
            when(jwtService.extractEmail(anyString())).thenReturn("user@boxora.vn");
            when(jwtService.isAccessToken(anyString())).thenReturn(true);
            when(jwtService.isTokenValid(anyString())).thenReturn(true);
            UserDetails details = User.withUsername("user@boxora.vn").password("x").roles("CUSTOMER").build();
            when(userDetailsService.loadUserByUsername("user@boxora.vn")).thenReturn(details);
        }

        @AfterEach
        void tearDown() {
            SecurityContextHolder.clearContext();
        }

        private boolean authenticates(String path) throws Exception {
            SecurityContextHolder.clearContext();
            MockHttpServletRequest request = new MockHttpServletRequest("PUT", path);
            request.setServletPath(path);
            request.addHeader("Authorization", "Bearer some.valid.token");
            filter.doFilter(request, new MockHttpServletResponse(), new MockFilterChain());
            return SecurityContextHolder.getContext().getAuthentication() != null;
        }

        @Test
        @DisplayName("PUT /auth/profile và /auth/change-password nhận diện được người dùng từ Bearer token (trước đây luôn ẩn danh -> 403/500)")
        void profileAndChangePasswordAreAuthenticated() throws Exception {
            assertTrue(authenticates("/api/v1/auth/profile"));
            assertTrue(authenticates("/api/v1/auth/change-password"));
        }

        @Test
        @DisplayName("Các endpoint auth ẩn danh (login, register, refresh...) vẫn bỏ qua việc đọc JWT")
        void anonymousAuthEndpointsStayPublic() throws Exception {
            for (String path : new String[]{"/api/v1/auth/login", "/api/v1/auth/register", "/api/v1/auth/captcha",
                    "/api/v1/auth/google", "/api/v1/auth/refresh-token", "/api/v1/auth/logout",
                    "/api/v1/auth/forgot-password", "/api/v1/auth/reset-password", "/api/v1/auth/public-config"}) {
                assertFalse(authenticates(path), path);
            }
        }

        @Test
        @DisplayName("Endpoint nghiệp vụ thông thường được xác thực bằng Bearer token")
        void businessEndpointIsAuthenticated() throws Exception {
            assertTrue(authenticates("/api/v1/bookings"));
        }
    }

    // ---------------------------------------------------------------- rate limiter

    @Nested
    class Limiter {
        @Test
        @DisplayName("RateLimiter chặn sau khi vượt số lần cho phép trong cửa sổ, tách riêng từng khóa")
        void blocksAfterLimit() {
            RateLimiter limiter = new RateLimiter(true);
            Duration hour = Duration.ofHours(1);
            for (int i = 0; i < 3; i++) {
                limiter.check("forgot-email", "a@b.vn", 3, hour);
            }
            AppException ex = assertThrows(AppException.class, () -> limiter.check("forgot-email", "a@b.vn", 3, hour));
            assertEquals(ErrorCode.RATE_LIMIT_EXCEEDED, ex.getErrorCode());
            // another key and another bucket are unaffected; the key is case-insensitive
            assertDoesNotThrow(() -> limiter.check("forgot-email", "other@b.vn", 3, hour));
            assertDoesNotThrow(() -> limiter.check("register-ip", "a@b.vn", 3, hour));
            assertThrows(AppException.class, () -> limiter.check("forgot-email", "A@B.VN", 3, hour));
        }

        @Test
        @DisplayName("RateLimiter có thể tắt")
        void canBeDisabled() {
            RateLimiter limiter = new RateLimiter(false);
            for (int i = 0; i < 100; i++) {
                limiter.check("x", "y", 1, Duration.ofMinutes(1));
            }
        }

        @Test
        @DisplayName("Cửa sổ trượt: sau khi hết thời gian cửa sổ lại được phép")
        void windowSlides() throws Exception {
            RateLimiter limiter = new RateLimiter(true);
            Duration shortWindow = Duration.ofMillis(60);
            limiter.check("w", "k", 1, shortWindow);
            assertThrows(AppException.class, () -> limiter.check("w", "k", 1, shortWindow));
            Thread.sleep(120);
            assertDoesNotThrow(() -> limiter.check("w", "k", 1, shortWindow));
        }
    }
}

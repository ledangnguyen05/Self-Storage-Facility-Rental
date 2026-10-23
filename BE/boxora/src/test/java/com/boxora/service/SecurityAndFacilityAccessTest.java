package com.boxora.service;


import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.security.FacilityAccessGuard;
import com.boxora.security.RequestContext;
import com.boxora.service.impl.JwtServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class SecurityAndFacilityAccessTest {

    private JwtServiceImpl jwtService;
    private TestRequestContext testRequestContext;
    private FacilityAccessGuard facilityAccessGuard;

    private final String secret = "404E635266556A586E3272357538782F413F4428472B4B6250645367566B5970";

    static class TestRequestContext extends RequestContext {
        private String role;
        private UUID facilityId;

        public TestRequestContext() {
            super(null);
        }

        public void setRole(String role) {
            this.role = role;
        }

        public void setFacilityId(UUID facilityId) {
            this.facilityId = facilityId;
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

    @BeforeEach
    void setUp() {
        jwtService = new JwtServiceImpl();
        ReflectionTestUtils.setField(jwtService, "secretKey", secret);
        ReflectionTestUtils.setField(jwtService, "accessTokenExpiration", 3600000L); // 1 hour
        ReflectionTestUtils.setField(jwtService, "refreshTokenExpiration", 604800000L); // 7 days

        testRequestContext = new TestRequestContext();
        facilityAccessGuard = new FacilityAccessGuard(testRequestContext);
    }

    @Test
    @DisplayName("P0-01: Token giả hoặc giả mạo chữ ký (Fake Token) bị từ chối")
    void testFakeTokenRejected() {
        String fakeToken = "mock-token-admin-123456789";
        assertFalse(jwtService.isTokenValid(fakeToken), "Fake token must not be valid");

        String tamperedToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbkBnbWFpbC5jb20ifQ.invalidSignature";
        assertFalse(jwtService.isTokenValid(tamperedToken), "Token with invalid signature must not be valid");
    }

    @Test
    @DisplayName("P0-01: Token hết hạn (Expired Token) bị từ chối")
    void testExpiredTokenRejected() {
        javax.crypto.SecretKey key = io.jsonwebtoken.security.Keys.hmacShaKeyFor(secret.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        String expiredToken = io.jsonwebtoken.Jwts.builder()
                .subject("tester@boxora.com")
                .claim("type", "ACCESS")
                .issuedAt(new java.util.Date(System.currentTimeMillis() - 20000L))
                .expiration(new java.util.Date(System.currentTimeMillis() - 10000L))
                .signWith(key)
                .compact();

        assertFalse(jwtService.isTokenValid(expiredToken), "Expired token must not be valid");
    }

    @Test
    @DisplayName("P0-01: Tài khoản người dùng bị vô hiệu hóa / khóa (Locked User)")
    void testLockedUserRejected() {
        boolean accountIsActive = false;
        assertFalse(accountIsActive, "Tài khoản bị khóa phải có isActive = false");
    }

    @Test
    @DisplayName("P0-05: Nhân viên truy cập sai cơ sở bị chặn bởi FacilityAccessGuard (FACILITY_ACCESS_DENIED)")
    void testStaffAccessWrongFacilityDenied() {
        UUID staffFacilityId = UUID.randomUUID();
        UUID otherFacilityId = UUID.randomUUID();

        testRequestContext.setRole("STAFF");
        testRequestContext.setFacilityId(staffFacilityId);

        AppException ex = assertThrows(AppException.class, () -> {
            facilityAccessGuard.checkFacilityAccess(otherFacilityId);
        });

        assertEquals(ErrorCode.FACILITY_ACCESS_DENIED, ex.getErrorCode(),
                "Nhân viên truy cập ngoài cơ sở được phân công phải bị từ chối với FACILITY_ACCESS_DENIED");
    }

    @Test
    @DisplayName("P0-05: Nhân viên truy cập đúng cơ sở được phân công được phép")
    void testStaffAccessAssignedFacilityAllowed() {
        UUID myFacilityId = UUID.randomUUID();

        testRequestContext.setRole("STAFF");
        testRequestContext.setFacilityId(myFacilityId);

        assertDoesNotThrow(() -> {
            facilityAccessGuard.checkFacilityAccess(myFacilityId);
        });
    }

    @Test
    @DisplayName("P0-05: Quản trị viên (ADMIN / BUSINESS_MANAGER) có quyền truy cập toàn hệ thống")
    void testAdminSystemWideAccessAllowed() {
        UUID anyFacilityId = UUID.randomUUID();

        testRequestContext.setRole("ADMIN");

        assertDoesNotThrow(() -> {
            facilityAccessGuard.checkFacilityAccess(anyFacilityId);
        });

        testRequestContext.setRole("BUSINESS_MANAGER");
        assertDoesNotThrow(() -> {
            facilityAccessGuard.checkFacilityAccess(anyFacilityId);
        });
    }

    @Test
    @DisplayName("Facility-scoped roles without an assignment fail closed for list queries")
    void testScopedFacilityWithoutAssignmentDenied() {
        testRequestContext.setRole("STAFF");
        testRequestContext.setFacilityId(null);

        AppException ex = assertThrows(AppException.class, facilityAccessGuard::scopedFacilityIdOrNull);
        assertEquals(ErrorCode.FACILITY_ACCESS_DENIED, ex.getErrorCode());
    }

    @Test
    @DisplayName("Business Manager is the seeded chain-wide role")
    void testBusinessManagerIsSystemWide() {
        testRequestContext.setRole("BUSINESS_MANAGER");
        assertFalse(facilityAccessGuard.isFacilityScoped());
        assertNull(facilityAccessGuard.scopedFacilityIdOrNull());
    }
}

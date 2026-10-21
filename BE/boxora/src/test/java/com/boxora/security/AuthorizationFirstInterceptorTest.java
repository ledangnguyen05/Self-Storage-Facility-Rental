package com.boxora.security;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.method.HandlerMethod;

import java.lang.reflect.Method;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Authorization must be decided before the request body is validated: a caller whose role may not use an
 * endpoint gets 403, never 400 with the DTO's field rules.
 */
class AuthorizationFirstInterceptorTest {

    static class Body {
        @NotBlank(message = "Vui lòng nhập nhóm quyền")
        public String permissionGroup;
    }

    /** Mirrors the real controllers: a write endpoint with a validated body and a role restriction. */
    @PreAuthorize("hasRole('ADMIN')")
    static class AdminOnlyController {
        @PreAuthorize("hasAnyRole('ADMIN', 'BUSINESS_MANAGER')")
        public void create(@Valid Body body) {
        }

        @PreAuthorize("hasAuthority('POLICY_VIEW') or hasAnyRole('STAFF', 'CUSTOMER')")
        public void viewOrRole() {
        }

        @PreAuthorize("isAuthenticated()")
        public void anyUser() {
        }

        @PreAuthorize("permitAll()")
        public void everyone() {
        }

        @PreAuthorize("hasRole('ADMIN') or #id == authentication.name")
        public void dependsOnArguments(String id) {
        }

        @PreAuthorize("@guard.allowed()")
        public void dependsOnBean() {
        }

        public void inheritsClassLevel() {
        }

        public void notAnnotatedEither() {
        }
    }

    private AuthorizationFirstInterceptor interceptor;
    private final AdminOnlyController controller = new AdminOnlyController();

    @SuppressWarnings("unchecked")
    @BeforeEach
    void setUp() {
        SecurityContextHolder.clearContext();
        ObjectProvider<org.springframework.security.access.hierarchicalroles.RoleHierarchy> hierarchy = mock(ObjectProvider.class);
        ObjectProvider<org.springframework.security.config.core.GrantedAuthorityDefaults> defaults = mock(ObjectProvider.class);
        when(hierarchy.getIfAvailable()).thenReturn(null);
        when(defaults.getIfAvailable()).thenReturn(null);
        interceptor = new AuthorizationFirstInterceptor(hierarchy, defaults);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private static void signInAs(String... authorities) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                "user@boxora.vn", "n/a", AuthorityUtils.createAuthorityList(authorities)));
    }

    private boolean allowed(String methodName) throws Exception {
        Method method = java.util.Arrays.stream(AdminOnlyController.class.getMethods())
                .filter(m -> m.getName().equals(methodName)).findFirst().orElseThrow();
        try {
            return interceptor.preHandle(new MockHttpServletRequest(), new MockHttpServletResponse(),
                    new HandlerMethod(controller, method));
        } catch (AccessDeniedException e) {
            return false;
        }
    }

    @Test
    @DisplayName("Vai trò không được phép bị chặn NGAY (403) trước khi nội dung yêu cầu được kiểm tra")
    void deniedRoleIsRejectedBeforeBodyValidation() throws Exception {
        signInAs("ROLE_FACILITY_MANAGER");
        assertThrows(AccessDeniedException.class, () -> {
            Method create = AdminOnlyController.class.getMethod("create", Body.class);
            interceptor.preHandle(new MockHttpServletRequest(), new MockHttpServletResponse(),
                    new HandlerMethod(controller, create));
        });
    }

    @Test
    @DisplayName("Vai trò được phép đi tiếp (kiểm tra @Valid và @PreAuthorize của Spring vẫn chạy sau đó)")
    void allowedRolePasses() throws Exception {
        signInAs("ROLE_ADMIN");
        assertTrue(allowed("create"));
        signInAs("ROLE_BUSINESS_MANAGER");
        assertTrue(allowed("create"));
    }

    @Test
    @DisplayName("Quyền chi tiết (hasAuthority) HOẶC vai trò đều được đánh giá")
    void authorityOrRole() throws Exception {
        signInAs("ROLE_FACILITY_MANAGER");
        assertFalse(allowed("viewOrRole"));
        signInAs("ROLE_FACILITY_MANAGER", "POLICY_VIEW");
        assertTrue(allowed("viewOrRole"));
        signInAs("ROLE_STAFF");
        assertTrue(allowed("viewOrRole"));
    }

    @Test
    @DisplayName("isAuthenticated / permitAll: người đã đăng nhập và khách ẩn danh được xử lý đúng")
    void authenticatedAndPermitAll() throws Exception {
        assertFalse(allowed("anyUser"), "anonymous must not pass isAuthenticated()");
        assertTrue(allowed("everyone"));
        signInAs("ROLE_CUSTOMER");
        assertTrue(allowed("anyUser"));
    }

    @Test
    @DisplayName("Biểu thức phụ thuộc tham số (#id) hoặc bean (@guard) không bị đánh giá sớm - để method security xử lý")
    void argumentAndBeanDependentExpressionsAreLeftToMethodSecurity() throws Exception {
        signInAs("ROLE_CUSTOMER");
        assertTrue(allowed("dependsOnArguments"));
        assertTrue(allowed("dependsOnBean"));
    }

    @Test
    @DisplayName("@PreAuthorize ở cấp lớp được áp dụng cho phương thức không tự khai báo")
    void classLevelAnnotationApplies() throws Exception {
        signInAs("ROLE_STAFF");
        assertFalse(allowed("inheritsClassLevel"));
        signInAs("ROLE_ADMIN");
        assertTrue(allowed("inheritsClassLevel"));
    }

    @Test
    @DisplayName("Handler không phải controller (tài nguyên tĩnh...) luôn đi qua")
    void nonHandlerMethodPasses() throws Exception {
        assertTrue(interceptor.preHandle(new MockHttpServletRequest(), new MockHttpServletResponse(), "resource-handler"));
    }

    @Test
    @DisplayName("Danh sách quyền lấy từ tài khoản đang đăng nhập, không bị lưu đệm giữa các người dùng")
    void decisionFollowsTheCurrentUser() throws Exception {
        signInAs("ROLE_ADMIN");
        assertTrue(allowed("create"));
        signInAs("ROLE_CUSTOMER");
        assertFalse(allowed("create"));
    }
}

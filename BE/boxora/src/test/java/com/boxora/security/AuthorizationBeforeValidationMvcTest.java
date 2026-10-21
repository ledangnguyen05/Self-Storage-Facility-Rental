package com.boxora.security;

import com.boxora.controller.FacilityController;
import com.boxora.controller.FacilityPolicyController;
import com.boxora.controller.PermissionController;
import com.boxora.controller.UserController;
import com.boxora.exception.GlobalExceptionHandler;
import com.boxora.service.FacilityPolicyService;
import com.boxora.service.FacilityService;
import com.boxora.service.PermissionService;
import com.boxora.service.UserService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.Mockito.mock;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The real controllers, the real {@link AuthorizationFirstInterceptor} and the real exception advice: a role that is
 * not allowed gets 403 even when the body is invalid, and an allowed role still gets the validation messages.
 */
class AuthorizationBeforeValidationMvcTest {

    private MockMvc mvc;

    @SuppressWarnings("unchecked")
    @BeforeEach
    void setUp() {
        SecurityContextHolder.clearContext();
        ObjectProvider<org.springframework.security.access.hierarchicalroles.RoleHierarchy> hierarchy = mock(ObjectProvider.class);
        ObjectProvider<org.springframework.security.config.core.GrantedAuthorityDefaults> defaults = mock(ObjectProvider.class);
        mvc = MockMvcBuilders.standaloneSetup(
                        new PermissionController(mock(PermissionService.class)),
                        new FacilityController(mock(FacilityService.class)),
                        new UserController(mock(UserService.class)),
                        new FacilityPolicyController(mock(FacilityPolicyService.class)))
                .addInterceptors(new AuthorizationFirstInterceptor(hierarchy, defaults))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private static void signInAs(String role) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                "user@boxora.vn", "n/a", AuthorityUtils.createAuthorityList("ROLE_" + role)));
    }

    private void post(String url, String body, int expectedStatus) throws Exception {
        mvc.perform(MockMvcRequestBuilders.post(url).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().is(expectedStatus));
    }

    @Test
    @DisplayName("FACILITY_MANAGER gửi POST /permissions với thân yêu cầu thiếu trường -> 403 (không phải 400 'Vui lòng nhập nhóm quyền')")
    void facilityManagerGetsForbiddenNotValidationErrorOnPermissions() throws Exception {
        signInAs("FACILITY_MANAGER");

        mvc.perform(MockMvcRequestBuilders.post("/api/v1/permissions").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"X_Y\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(302))
                .andExpect(jsonPath("$.errors").doesNotExist());
    }

    @Test
    @DisplayName("STAFF gửi POST /facilities với thân yêu cầu thiếu trường -> 403; thân JSON hỏng cũng vậy")
    void staffGetsForbiddenOnFacilityCreate() throws Exception {
        signInAs("STAFF");

        post("/api/v1/facilities", "{\"name\":\"X\",\"code\":\"XX\",\"address\":\"y\"}", 403);
        post("/api/v1/facilities", "{not json", 403);
        post("/api/v1/facilities", "", 403);
    }

    @Test
    @DisplayName("CUSTOMER / FACILITY_MANAGER gửi POST /users và /facility-policies với thân yêu cầu rỗng -> 403")
    void unauthorizedRolesGetForbiddenOnUsersAndPolicies() throws Exception {
        for (String role : new String[]{"CUSTOMER", "FACILITY_MANAGER", "STAFF"}) {
            signInAs(role);
            post("/api/v1/users", "{}", 403);
        }
        signInAs("CUSTOMER");
        post("/api/v1/facility-policies", "{}", 403);
        signInAs("FACILITY_MANAGER");
        post("/api/v1/facility-policies", "{}", 403);
    }

    @Test
    @DisplayName("Vai trò được phép vẫn nhận thông báo kiểm tra dữ liệu (400) khi gửi thân yêu cầu thiếu trường")
    void allowedRoleStillGetsValidationErrors() throws Exception {
        signInAs("ADMIN");

        mvc.perform(MockMvcRequestBuilders.post("/api/v1/permissions").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"X_Y\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors").exists());
        signInAs("BUSINESS_MANAGER");
        post("/api/v1/facilities", "{\"name\":\"X\"}", 400);
    }

    @Test
    @DisplayName("Khách ẩn danh chạm tới endpoint ghi (nếu lọt qua tầng URL) nhận 401, không phải 400")
    void anonymousGets401() throws Exception {
        post("/api/v1/permissions", "{}", 401);
    }
}

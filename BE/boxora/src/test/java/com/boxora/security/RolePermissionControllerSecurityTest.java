package com.boxora.security;

import com.boxora.controller.RolePermissionController;
import com.boxora.dto.request.RolePermissionBulkAssignRequest;
import com.boxora.service.RolePermissionService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;

/** The role-permission API must be ADMIN-only for writes (and not readable by customers / staff). */
@SpringJUnitConfig(RolePermissionControllerSecurityTest.Config.class)
class RolePermissionControllerSecurityTest {

    @Configuration
    @EnableMethodSecurity
    static class Config {
        @Bean
        RolePermissionService rolePermissionService() {
            return mock(RolePermissionService.class);
        }

        @Bean
        RolePermissionController rolePermissionController(RolePermissionService service) {
            return new RolePermissionController(service);
        }
    }

    @Autowired
    private RolePermissionController controller;

    private RolePermissionBulkAssignRequest request() {
        return RolePermissionBulkAssignRequest.builder().roleId(UUID.randomUUID()).permissionIds(List.of()).build();
    }

    @Test
    @WithMockUser(roles = "CUSTOMER")
    @DisplayName("CUSTOMER không thể ghi đè quyền của vai trò (bulk-assign, xóa) hay đọc phân quyền")
    void customerIsForbidden() {
        assertThrows(AccessDeniedException.class, () -> controller.bulkAssign(request()));
        assertThrows(AccessDeniedException.class, () -> controller.delete(UUID.randomUUID()));
        assertThrows(AccessDeniedException.class, () -> controller.getByRoleId(UUID.randomUUID()));
        assertThrows(AccessDeniedException.class,
                () -> controller.getAll(null, null, null, null, 0, 10, "createdAt", "desc"));
    }

    @Test
    @WithMockUser(roles = "STAFF")
    @DisplayName("STAFF cũng không được thay đổi hay đọc phân quyền")
    void staffIsForbidden() {
        assertThrows(AccessDeniedException.class, () -> controller.bulkAssign(request()));
        assertThrows(AccessDeniedException.class, () -> controller.getByRoleId(UUID.randomUUID()));
    }

    @Test
    @WithMockUser(roles = "BUSINESS_MANAGER")
    @DisplayName("BUSINESS_MANAGER chỉ được đọc, không được ghi")
    void businessManagerReadOnly() {
        assertThrows(AccessDeniedException.class, () -> controller.bulkAssign(request()));
        assertDoesNotThrow(() -> controller.getByRoleId(UUID.randomUUID()));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    @DisplayName("ADMIN được phép ghi đè bộ quyền của vai trò")
    void adminAllowed() {
        assertDoesNotThrow(() -> controller.bulkAssign(request()));
    }
}

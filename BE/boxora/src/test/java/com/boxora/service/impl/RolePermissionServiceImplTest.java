package com.boxora.service.impl;

import com.boxora.dto.request.RolePermissionBulkAssignRequest;
import com.boxora.dto.response.RolePermissionResponse;
import com.boxora.entity.Permission;
import com.boxora.entity.Role;
import com.boxora.entity.RolePermission;
import com.boxora.enums.ActivityAction;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.mapper.RolePermissionMapper;
import com.boxora.repository.PermissionRepository;
import com.boxora.repository.RolePermissionRepository;
import com.boxora.repository.RoleRepository;
import com.boxora.service.ActivityLogService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RolePermissionServiceImplTest {

    @Mock private RolePermissionRepository rolePermissionRepository;
    @Mock private RoleRepository roleRepository;
    @Mock private PermissionRepository permissionRepository;
    @Mock private RolePermissionMapper rolePermissionMapper;
    @Mock private ActivityLogService activityLogService;

    private RolePermissionServiceImpl service;
    private Role role;
    private Permission view;
    private Permission create;
    private Permission delete;

    @BeforeEach
    void setUp() {
        service = new RolePermissionServiceImpl(rolePermissionRepository, roleRepository, permissionRepository,
                rolePermissionMapper, activityLogService);
        role = Role.builder().name("STAFF").isActive(true).build();
        role.setId(UUID.randomUUID());
        view = permission("BOOKING_VIEW");
        create = permission("BOOKING_CREATE");
        delete = permission("BOOKING_DELETE");
        when(roleRepository.findById(role.getId())).thenReturn(Optional.of(role));
    }

    private static Permission permission(String name) {
        Permission p = Permission.builder().name(name).permissionGroup("BOOKING").isActive(true).build();
        p.setId(UUID.randomUUID());
        return p;
    }

    private RolePermission link(Permission p, boolean active) {
        RolePermission rp = RolePermission.builder().role(role).permission(p).isActive(active).build();
        rp.setId(UUID.randomUUID());
        return rp;
    }

    private RolePermissionBulkAssignRequest request(Permission... permissions) {
        return RolePermissionBulkAssignRequest.builder()
                .roleId(role.getId())
                .permissionIds(new ArrayList<>(java.util.Arrays.stream(permissions).map(Permission::getId).toList()))
                .build();
    }

    @Test
    @DisplayName("bulk-assign thay thế bộ quyền: quyền không còn trong danh sách bị thu hồi, quyền mới được cấp")
    void replacesPermissionSet() {
        RolePermission viewLink = link(view, true);        // stays
        RolePermission deleteLink = link(delete, true);    // must be revoked
        when(rolePermissionRepository.findAllByRole_Id(role.getId())).thenReturn(List.of(viewLink, deleteLink));
        when(permissionRepository.findAllById(any())).thenReturn(List.of(view, create));
        when(rolePermissionRepository.findAllByRole_IdAndIsActiveTrueAndPermission_IsActiveTrue(role.getId()))
                .thenReturn(List.of(viewLink));
        when(rolePermissionMapper.toResponse(any(RolePermission.class))).thenReturn(new RolePermissionResponse());

        List<RolePermissionResponse> result = service.bulkAssign(request(view, create));

        assertFalse(deleteLink.getIsActive(), "BOOKING_DELETE must be revoked");
        assertTrue(viewLink.getIsActive());

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<RolePermission>> saved = ArgumentCaptor.forClass(List.class);
        verify(rolePermissionRepository).saveAll(saved.capture());
        assertEquals(2, saved.getValue().size(), "one new link + one revoked link are persisted");
        assertTrue(saved.getValue().stream().anyMatch(rp -> rp.getPermission() == create && rp.getIsActive()));
        assertTrue(saved.getValue().contains(deleteLink));

        verify(activityLogService).record(eq(ActivityAction.ROLE_PERMISSION_ASSIGN), anyString(), eq(role.getId()), anyString(), any(), any());
        verify(activityLogService).record(eq(ActivityAction.ROLE_PERMISSION_REVOKE), anyString(), eq(role.getId()), anyString(), any(), any());
        assertEquals(1, result.size());
    }

    @Test
    @DisplayName("bulk-assign với danh sách rỗng gỡ toàn bộ quyền của vai trò")
    void emptyListRevokesEverything() {
        RolePermission viewLink = link(view, true);
        RolePermission createLink = link(create, true);
        when(rolePermissionRepository.findAllByRole_Id(role.getId())).thenReturn(List.of(viewLink, createLink));
        when(rolePermissionRepository.findAllByRole_IdAndIsActiveTrueAndPermission_IsActiveTrue(role.getId()))
                .thenReturn(List.of());

        List<RolePermissionResponse> result = service.bulkAssign(request());

        assertFalse(viewLink.getIsActive());
        assertFalse(createLink.getIsActive());
        assertTrue(result.isEmpty());
        verify(permissionRepository, never()).findAllById(any());
        verify(activityLogService, never()).record(eq(ActivityAction.ROLE_PERMISSION_ASSIGN), anyString(), any(), anyString(), any(), any());
    }

    @Test
    @DisplayName("bulk-assign kích hoạt lại quyền từng bị thu hồi")
    void reactivatesRevokedLink() {
        RolePermission revoked = link(view, false);
        when(rolePermissionRepository.findAllByRole_Id(role.getId())).thenReturn(List.of(revoked));
        when(permissionRepository.findAllById(any())).thenReturn(List.of(view));
        when(rolePermissionRepository.findAllByRole_IdAndIsActiveTrueAndPermission_IsActiveTrue(role.getId()))
                .thenReturn(List.of(revoked));
        when(rolePermissionMapper.toResponse(any(RolePermission.class))).thenReturn(new RolePermissionResponse());

        service.bulkAssign(request(view));

        assertTrue(revoked.getIsActive());
        verify(rolePermissionRepository).saveAll(List.of(revoked));
    }

    @Test
    @DisplayName("bulk-assign với id quyền không tồn tại -> PERMISSION_NOT_FOUND, không thay đổi gì")
    void unknownPermissionIsRejected() {
        when(permissionRepository.findAllById(any())).thenReturn(List.of(view));

        AppException ex = assertThrows(AppException.class, () -> service.bulkAssign(request(view, create)));

        assertEquals(ErrorCode.PERMISSION_NOT_FOUND, ex.getErrorCode());
        verify(rolePermissionRepository, never()).saveAll(any());
    }
}

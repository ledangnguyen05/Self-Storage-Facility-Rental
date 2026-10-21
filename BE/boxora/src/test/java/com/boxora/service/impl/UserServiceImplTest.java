package com.boxora.service.impl;

import com.boxora.dto.request.UserCreateRequest;
import com.boxora.dto.request.UserUpdateRequest;
import com.boxora.dto.response.UserResponse;
import com.boxora.dto.response.UserSummaryResponse;
import com.boxora.entity.Facility;
import com.boxora.entity.Role;
import com.boxora.entity.User;
import com.boxora.enums.RefreshTokenRevokeReason;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.mapper.UserMapper;
import com.boxora.repository.FacilityRepository;
import com.boxora.repository.RefreshTokenRepository;
import com.boxora.repository.RoleRepository;
import com.boxora.repository.UserRepository;
import com.boxora.security.FacilityAccessGuard;
import com.boxora.security.RequestContext;
import com.boxora.service.ActivityLogService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserServiceImplTest {

    @Mock private UserRepository userRepository;
    @Mock private RoleRepository roleRepository;
    @Mock private FacilityRepository facilityRepository;
    @Mock private RefreshTokenRepository refreshTokenRepository;
    @Mock private FacilityAccessGuard facilityAccessGuard;
    @Mock private RequestContext requestContext;
    @Mock private UserMapper userMapper;
    @Mock private ActivityLogService activityLogService;

    private UserServiceImpl service;
    private final UUID adminId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new UserServiceImpl(userRepository, roleRepository, facilityRepository, refreshTokenRepository,
                facilityAccessGuard, requestContext, userMapper, new BCryptPasswordEncoder(4), activityLogService);
    }

    private static Role role(String name) {
        Role r = Role.builder().name(name).isActive(true).build();
        r.setId(UUID.randomUUID());
        return r;
    }

    private static User user(Role role, Facility facility, boolean active) {
        User u = User.builder().username("someone").email("s@boxora.vn").password("x").fullName("Nguyen Van A")
                .phone("0912345678").role(role).facility(facility).isActive(active).build();
        u.setId(UUID.randomUUID());
        return u;
    }

    private UserCreateRequest createRequest(UUID roleId, UUID facilityId) {
        return UserCreateRequest.builder().username("newstaff").email("new@boxora.vn").password("secret1")
                .fullName("Nguyen Van A").phone("0912345678").roleId(roleId).facilityId(facilityId).build();
    }

    @Test
    @DisplayName("Tạo STAFF không chọn cơ sở bị từ chối (tài khoản chưa phân công sẽ không thấy dữ liệu nào)")
    void staffRequiresFacility() {
        Role staff = role("STAFF");
        when(roleRepository.findById(staff.getId())).thenReturn(Optional.of(staff));

        AppException ex = assertThrows(AppException.class, () -> service.create(createRequest(staff.getId(), null)));

        assertEquals(ErrorCode.INVALID_REQUEST, ex.getErrorCode());
        verify(userRepository, never()).saveAndFlush(any());
    }

    @Test
    @DisplayName("Tạo tài khoản: email trùng với tài khoản có sẵn chỉ khác hoa/thường bị từ chối; email được lưu chữ thường")
    void createTreatsEmailCaseInsensitively() {
        Role customer = role("CUSTOMER");
        when(userRepository.existsByEmail("qa+case@example.test")).thenReturn(true);
        UserCreateRequest twin = createRequest(customer.getId(), null);
        twin.setEmail("QA+Case@Example.Test");

        AppException ex = assertThrows(AppException.class, () -> service.create(twin));

        assertEquals(ErrorCode.EMAIL_ALREADY_EXISTS, ex.getErrorCode());
        verify(userRepository, never()).saveAndFlush(any());

        when(userRepository.existsByEmail("fresh@example.test")).thenReturn(false);
        when(roleRepository.findById(customer.getId())).thenReturn(Optional.of(customer));
        when(userRepository.saveAndFlush(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        when(userMapper.toResponse(any(User.class))).thenReturn(new UserResponse());
        UserCreateRequest fresh = createRequest(customer.getId(), null);
        fresh.setEmail("  Fresh@Example.Test ");

        service.create(fresh);

        ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
        verify(userRepository).saveAndFlush(saved.capture());
        assertEquals("fresh@example.test", saved.getValue().getEmail());
    }

    @Test
    @DisplayName("Hai quản trị viên tạo cùng một email cùng lúc: chỉ mục duy nhất lower(email) báo EMAIL_ALREADY_EXISTS, không phải lỗi chung")
    void createRaceOnUniqueEmailIndexIsReportedAsTaken() {
        Role customer = role("CUSTOMER");
        when(roleRepository.findById(customer.getId())).thenReturn(Optional.of(customer));
        when(userRepository.saveAndFlush(any(User.class))).thenThrow(new org.springframework.dao.DataIntegrityViolationException(
                "could not execute statement",
                new RuntimeException("ERROR: duplicate key value violates unique constraint \"uq_users_email_lower\"")));

        AppException ex = assertThrows(AppException.class, () -> service.create(createRequest(customer.getId(), null)));

        assertEquals(ErrorCode.EMAIL_ALREADY_EXISTS, ex.getErrorCode());
    }

    @Test
    @DisplayName("Tạo FACILITY_MANAGER có cơ sở thì thành công")
    void facilityManagerWithFacilityIsCreated() {
        Role fm = role("FACILITY_MANAGER");
        Facility facility = new Facility();
        facility.setId(UUID.randomUUID());
        when(roleRepository.findById(fm.getId())).thenReturn(Optional.of(fm));
        when(facilityRepository.findById(facility.getId())).thenReturn(Optional.of(facility));
        when(userRepository.saveAndFlush(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        when(userMapper.toResponse(any(User.class))).thenReturn(new UserResponse());

        assertDoesNotThrow(() -> service.create(createRequest(fm.getId(), facility.getId())));
        verify(userRepository).saveAndFlush(any(User.class));
    }

    @Test
    @DisplayName("Cập nhật một phần (không gửi số điện thoại) vẫn được, số điện thoại cũ giữ nguyên")
    void updateWithoutPhoneKeepsPhone() {
        Role customer = role("CUSTOMER");
        User target = user(customer, null, true);
        when(userRepository.findById(target.getId())).thenReturn(Optional.of(target));
        when(requestContext.currentUserId()).thenReturn(adminId);
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        when(userMapper.toResponse(any(User.class))).thenReturn(new UserResponse());

        UserUpdateRequest request = UserUpdateRequest.builder().fullName("Tran Van B").build();
        service.update(target.getId(), request);

        assertNull(request.getPhone());
        verify(userMapper).updateEntityFromRequest(request, target);
        assertEquals("0912345678", target.getPhone());
    }

    @Test
    @DisplayName("Admin không thể tự khóa chính mình")
    void cannotLockSelf() {
        User admin = user(role("ADMIN"), null, true);
        admin.setId(adminId);
        when(userRepository.findById(adminId)).thenReturn(Optional.of(admin));
        when(requestContext.currentUserId()).thenReturn(adminId);

        AppException ex = assertThrows(AppException.class, () -> service.toggleActive(adminId));

        assertEquals(ErrorCode.INVALID_REQUEST, ex.getErrorCode());
        assertTrue(admin.getIsActive());
        verify(refreshTokenRepository, never()).revokeAllActiveTokens(any(), any());
    }

    @Test
    @DisplayName("Khóa tài khoản thu hồi ngay toàn bộ phiên đăng nhập của người đó")
    void lockingRevokesSessions() {
        User target = user(role("CUSTOMER"), null, true);
        when(userRepository.findById(target.getId())).thenReturn(Optional.of(target));
        when(requestContext.currentUserId()).thenReturn(adminId);
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        when(userMapper.toResponse(any(User.class))).thenReturn(new UserResponse());

        service.toggleActive(target.getId());

        assertFalse(target.getIsActive());
        verify(refreshTokenRepository).revokeAllActiveTokens(target, RefreshTokenRevokeReason.ACCOUNT_LOCKED);
    }

    @Test
    @DisplayName("Kích hoạt lại tài khoản không thu hồi phiên nào")
    void unlockingDoesNotRevoke() {
        User target = user(role("CUSTOMER"), null, false);
        when(userRepository.findById(target.getId())).thenReturn(Optional.of(target));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        when(userMapper.toResponse(any(User.class))).thenReturn(new UserResponse());

        service.toggleActive(target.getId());

        assertTrue(target.getIsActive());
        verify(refreshTokenRepository, never()).revokeAllActiveTokens(any(), any());
    }

    @Test
    @DisplayName("Thống kê người dùng gộp theo vai trò và trạng thái")
    void summaryAggregatesRows() {
        when(userRepository.countByRoleAndStatus(any(), any(), any(), any(), any())).thenReturn(List.of(
                new Object[]{"STAFF", true, 6L},
                new Object[]{"STAFF", false, 1L},
                new Object[]{"FACILITY_MANAGER", true, 2L}));
        when(facilityAccessGuard.isFacilityScoped()).thenReturn(false);

        UserSummaryResponse summary = service.getSummary(null, null, null, null, null);

        assertEquals(9, summary.getTotal());
        assertEquals(8, summary.getActive());
        assertEquals(1, summary.getInactive());
        assertEquals(7L, summary.getByRole().get("STAFF"));
        assertEquals(2L, summary.getByRole().get("FACILITY_MANAGER"));
    }
}

package com.boxora.service.impl;

import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.UserCreateRequest;
import com.boxora.dto.request.ProfileUpdateRequest;
import com.boxora.dto.request.UserUpdateRequest;
import com.boxora.dto.response.UserResponse;
import com.boxora.dto.response.UserSummaryResponse;
import com.boxora.entity.Facility;
import com.boxora.entity.Role;
import com.boxora.entity.User;
import com.boxora.enums.ActivityAction;
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
import com.boxora.service.UserService;
import com.boxora.util.EmailAddresses;
import com.boxora.util.RoleLabels;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class UserServiceImpl implements UserService {

    /** Roles that belong to one facility. Without an assignment such an account can see no data at all. */
    private static final Set<String> FACILITY_BOUND_ROLES = Set.of("STAFF", "FACILITY_MANAGER");
    /** System-wide roles never carry a facility. */
    private static final Set<String> SYSTEM_WIDE_ROLES = Set.of("ADMIN", "BUSINESS_MANAGER");

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final FacilityRepository facilityRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final FacilityAccessGuard facilityAccessGuard;
    private final RequestContext requestContext;
    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;
    private final com.boxora.service.ActivityLogService activityLogService;


    @Override
    public UserResponse create(UserCreateRequest request) {

        // Addresses are case-insensitive: "Ngoc@Gmail.com" and "ngoc@gmail.com" are the same mailbox.
        String email = EmailAddresses.normalize(request.getEmail());
        if (userRepository.existsByEmail(email)) {
            throw new AppException(ErrorCode.EMAIL_ALREADY_EXISTS);
        }
        if (userRepository.existsByUsername(request.getUsername().trim())) {
            throw new AppException(ErrorCode.USER_ALREADY_EXISTS);
        }

        Role role;
        if (request.getRoleId() != null) {
            role = roleRepository.findById(request.getRoleId())
                    .orElseThrow(() -> new AppException(ErrorCode.ROLE_NOT_FOUND));
        } else {
            role = roleRepository.findByName("CUSTOMER")
                    .orElseThrow(() -> new AppException(ErrorCode.ROLE_NOT_FOUND));
        }

        Facility facility = null;
        if (request.getFacilityId() != null) {
            facility = facilityRepository.findById(request.getFacilityId())
                    .orElseThrow(() -> new AppException(ErrorCode.FACILITY_NOT_FOUND));

            // System-wide roles (ADMIN, BUSINESS_MANAGER) do not belong to a specific facility
            if (isSystemWide(role)) {
                facility = null;
            }
        }
        requireFacilityForFacilityBoundRole(role, facility);

        User user = User.builder()
                .username(request.getUsername().trim())
                .email(email)
                .password(passwordEncoder.encode(request.getPassword()))
                .fullName(request.getFullName().trim())
                .phone(request.getPhone().trim())
                .role(role)
                .facility(facility)
                .isActive(true)
                .build();

        User saved = saveNewUser(user);

        activityLogService.record(
                saved.getFacility() != null ? saved.getFacility().getId() : null,
                ActivityAction.USER_CREATE,
                "User",
                saved.getId(),
                "Tạo mới tài khoản: " + saved.getUsername() + " (" + RoleLabels.of(role.getName()) + ")",
                null,
                saved.getUsername()
        );

        return userMapper.toResponse(saved);
    }


    @Override
    public UserResponse update(UUID id, UserUpdateRequest request) {

        User user = userRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        if (facilityAccessGuard.isFacilityScoped() && user.getFacility() != null) {
            facilityAccessGuard.checkFacilityAccess(user.getFacility().getId());
        }

        boolean isSelf = id.equals(requestContext.currentUserId());
        boolean wasActive = !Boolean.FALSE.equals(user.getIsActive());
        String oldRoleName = user.getRole() != null ? user.getRole().getName() : null;
        UUID oldFacilityId = user.getFacility() != null ? user.getFacility().getId() : null;

        // Check username duplicate — exclude current user
        if (request.getUsername() != null
                && userRepository.existsByUsernameAndIdNot(request.getUsername().trim(), id)) {
            throw new AppException(ErrorCode.USER_ALREADY_EXISTS);
        }

        // A blank phone means "unchanged" (the field is optional on updates)
        if (request.getPhone() != null && request.getPhone().isBlank()) {
            request.setPhone(null);
        }

        // Update role if provided
        if (request.getRoleId() != null) {
            Role role = roleRepository.findById(request.getRoleId())
                    .orElseThrow(() -> new AppException(ErrorCode.ROLE_NOT_FOUND));
            if (isSelf && !role.getId().equals(user.getRole() != null ? user.getRole().getId() : null)) {
                throw new AppException(ErrorCode.INVALID_REQUEST, "Bạn không thể tự đổi vai trò của chính mình.");
            }
            user.setRole(role);
            if (isSystemWide(role)) {
                user.setFacility(null);
            }
        }

        // Update facility if provided
        if (request.getFacilityId() != null) {
            Facility facility = facilityRepository.findById(request.getFacilityId())
                    .orElseThrow(() -> new AppException(ErrorCode.FACILITY_NOT_FOUND));

            if (!isSystemWide(user.getRole())) {
                user.setFacility(facility);
            }
        }

        // Only enforce when this call actually touches role / facility, so legacy unassigned accounts
        // can still be edited (e.g. renamed) until an administrator assigns them.
        if (request.getRoleId() != null || request.getFacilityId() != null) {
            requireFacilityForFacilityBoundRole(user.getRole(), user.getFacility());
        }

        if (Boolean.FALSE.equals(request.getIsActive()) && isSelf) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Bạn không thể tự khóa tài khoản của chính mình.");
        }

        userMapper.updateEntityFromRequest(request, user);
        User updated = userRepository.save(user);

        boolean nowActive = !Boolean.FALSE.equals(updated.getIsActive());
        if (wasActive && !nowActive) {
            // A locked account must lose its sessions immediately.
            refreshTokenRepository.revokeAllActiveTokens(updated, RefreshTokenRevokeReason.ACCOUNT_LOCKED);
        }

        String newRoleName = updated.getRole() != null ? updated.getRole().getName() : null;
        UUID newFacilityId = updated.getFacility() != null ? updated.getFacility().getId() : null;
        UUID logFacilityId = newFacilityId;

        activityLogService.record(
                logFacilityId,
                ActivityAction.USER_UPDATE,
                "User",
                updated.getId(),
                "Cập nhật tài khoản: " + updated.getUsername(),
                null,
                updated.getUsername()
        );
        if (newRoleName != null && !newRoleName.equals(oldRoleName)) {
            activityLogService.record(logFacilityId, ActivityAction.USER_ASSIGN_ROLE, "User", updated.getId(),
                    "Đổi vai trò của " + updated.getUsername() + ": " + RoleLabels.of(oldRoleName) + " → " + RoleLabels.of(newRoleName),
                    oldRoleName, newRoleName);
        }
        if (newFacilityId != null && !newFacilityId.equals(oldFacilityId)) {
            activityLogService.record(newFacilityId, ActivityAction.USER_ASSIGN_FACILITY_SCOPE, "User", updated.getId(),
                    "Gán cơ sở trực thuộc cho " + updated.getUsername(), oldFacilityId, newFacilityId);
        }

        return userMapper.toResponse(updated);
    }

    @Override
    public UserResponse updateOwnProfile(String email, ProfileUpdateRequest request) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        user.setFullName(request.getFullName().trim());
        user.setPhone(request.getPhone().trim());
        User updated = userRepository.save(user);

        activityLogService.record(
                updated.getFacility() != null ? updated.getFacility().getId() : null,
                ActivityAction.USER_UPDATE,
                "User",
                updated.getId(),
                "Cập nhật hồ sơ tài khoản: " + updated.getUsername(),
                null,
                updated.getUsername()
        );

        return userMapper.toResponse(updated);
    }


    @Override
    public void delete(UUID id) {

        User user = userRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        if (id.equals(requestContext.currentUserId())) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Bạn không thể tự xóa tài khoản của chính mình.");
        }

        if (facilityAccessGuard.isFacilityScoped() && user.getFacility() != null) {
            facilityAccessGuard.checkFacilityAccess(user.getFacility().getId());
        }

        activityLogService.record(
                user.getFacility() != null ? user.getFacility().getId() : null,
                ActivityAction.USER_DEACTIVATE,
                "User",
                user.getId(),
                "Xóa tài khoản: " + user.getUsername(),
                null,
                null
        );

        userRepository.delete(user);
        log.info("User deleted successfully with id: {}", id);
    }


    @Override
    @Transactional(readOnly = true)
    public UserResponse getById(UUID id) {

        User user = userRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        if (facilityAccessGuard.isFacilityScoped()) {
            if (user.getFacility() != null) {
                facilityAccessGuard.checkFacilityAccess(user.getFacility().getId());
            } else if (user.getRole() != null && isSystemWide(user.getRole())) {
                throw new AppException(ErrorCode.FACILITY_ACCESS_DENIED);
            }
        }

        return userMapper.toResponse(user);
    }


    @Override
    @Transactional(readOnly = true)
    public PageResponse<UserResponse> findAllWithFilters(
            String search,
            Boolean isActive,
            UUID roleId,
            String role,
            UUID facilityId,
            int page,
            int size,
            String sortBy,
            String sortDir
    ) {

        Sort sort = sortDir.equalsIgnoreCase("desc")
                ? Sort.by(sortBy).descending()
                : Sort.by(sortBy).ascending();

        Pageable pageable = PageRequest.of(page, size, sort);

        Page<UserResponse> result = userRepository
                .findAllWithFilters(blankToNull(search), isActive, roleId, blankToNull(role), effectiveFacilityId(facilityId), pageable)
                .map(userMapper::toResponse);

        return PageResponse.from(result);
    }

    @Override
    @Transactional(readOnly = true)
    public UserSummaryResponse getSummary(String search, Boolean isActive, UUID roleId, String role, UUID facilityId) {
        List<Object[]> rows = userRepository.countByRoleAndStatus(
                blankToNull(search), isActive, roleId, blankToNull(role), effectiveFacilityId(facilityId));

        Map<String, Long> byRole = new LinkedHashMap<>();
        long total = 0;
        long active = 0;
        for (Object[] row : rows) {
            String roleName = row[0] == null ? "UNKNOWN" : String.valueOf(row[0]);
            boolean isRowActive = !Boolean.FALSE.equals(row[1]);
            long count = ((Number) row[2]).longValue();
            total += count;
            if (isRowActive) {
                active += count;
            }
            byRole.merge(roleName, count, Long::sum);
        }

        return UserSummaryResponse.builder()
                .total(total)
                .active(active)
                .inactive(total - active)
                .byRole(byRole)
                .build();
    }

    @Override
    public UserResponse toggleActive(UUID id) {

        User user = userRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        if (facilityAccessGuard.isFacilityScoped() && user.getFacility() != null) {
            facilityAccessGuard.checkFacilityAccess(user.getFacility().getId());
        }

        boolean deactivating = !Boolean.FALSE.equals(user.getIsActive());
        if (deactivating && id.equals(requestContext.currentUserId())) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Bạn không thể tự khóa tài khoản của chính mình.");
        }

        user.setIsActive(!deactivating);
        User updated = userRepository.save(user);

        if (deactivating) {
            // A locked account loses its sessions immediately; the refresh endpoint also refuses locked users.
            refreshTokenRepository.revokeAllActiveTokens(updated, RefreshTokenRevokeReason.ACCOUNT_LOCKED);
        }

        ActivityAction action = updated.getIsActive() ? ActivityAction.USER_ACTIVATE : ActivityAction.USER_DEACTIVATE;
        activityLogService.record(
                updated.getFacility() != null ? updated.getFacility().getId() : null,
                action,
                "User",
                updated.getId(),
                (updated.getIsActive() ? "Kích hoạt" : "Khóa") + " tài khoản: " + updated.getUsername(),
                !updated.getIsActive(),
                updated.getIsActive()
        );

        return userMapper.toResponse(updated);
    }

    /** The unique index on lower(email) is the last guard when two admins create the same address at once. */
    private User saveNewUser(User user) {
        try {
            return userRepository.saveAndFlush(user);
        } catch (DataIntegrityViolationException e) {
            String detail = e.getMostSpecificCause().getMessage();
            if (detail != null && detail.toLowerCase(Locale.ROOT).contains("email")) {
                throw new AppException(ErrorCode.EMAIL_ALREADY_EXISTS);
            }
            if (detail != null && detail.toLowerCase(Locale.ROOT).contains("username")) {
                throw new AppException(ErrorCode.USER_ALREADY_EXISTS);
            }
            throw e;
        }
    }

    /** Facility-scoped viewers (FACILITY_MANAGER) only ever see their own facility; unassigned ones are denied. */
    private UUID effectiveFacilityId(UUID requestedFacilityId) {
        if (facilityAccessGuard.isFacilityScoped()) {
            return facilityAccessGuard.scopedFacilityIdOrNull();
        }
        return requestedFacilityId;
    }

    private static boolean isSystemWide(Role role) {
        return role != null && role.getName() != null && SYSTEM_WIDE_ROLES.contains(role.getName().toUpperCase());
    }

    private static void requireFacilityForFacilityBoundRole(Role role, Facility facility) {
        if (role != null && role.getName() != null
                && FACILITY_BOUND_ROLES.contains(role.getName().toUpperCase())
                && facility == null) {
            throw new AppException(ErrorCode.INVALID_REQUEST,
                    "Vui lòng chọn cơ sở trực thuộc cho nhân viên / quản lý cơ sở. Tài khoản chưa được phân công sẽ không xem được dữ liệu nào.");
        }
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}

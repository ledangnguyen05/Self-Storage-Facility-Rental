package com.boxora.service.impl;

import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.UserCreateRequest;
import com.boxora.dto.request.ProfileUpdateRequest;
import com.boxora.dto.request.UserUpdateRequest;
import com.boxora.dto.response.UserResponse;
import com.boxora.entity.Facility;
import com.boxora.entity.Role;
import com.boxora.entity.User;
import com.boxora.enums.ActivityAction;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.mapper.UserMapper;
import com.boxora.repository.FacilityRepository;
import com.boxora.repository.RefreshTokenRepository;
import com.boxora.repository.RoleRepository;
import com.boxora.repository.UserRepository;
import com.boxora.security.FacilityAccessGuard;
import com.boxora.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class UserServiceImpl implements UserService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final FacilityRepository facilityRepository;
    private final FacilityAccessGuard facilityAccessGuard;
    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;
    private final RefreshTokenRepository refreshTokenRepository;
    private final com.boxora.service.ActivityLogService activityLogService;


    @Override
    public UserResponse create(UserCreateRequest request) {

        if (userRepository.existsByEmail(request.getEmail())) {
            throw new AppException(ErrorCode.EMAIL_ALREADY_EXISTS);
        }

        String username = request.getUsername();
        if (username == null || username.trim().isEmpty()) {
            String base = request.getEmail().split("@")[0].replaceAll("[^a-zA-Z0-9_]", "");
            if (base.length() < 3) {
                base = "user_" + base;
            }
            if (base.length() > 25) {
                base = base.substring(0, 25);
            }
            String candidate = base;
            int counter = 1;
            while (userRepository.existsByUsername(candidate)) {
                candidate = base + (counter++);
                if (candidate.length() > 30) {
                    candidate = "u_" + UUID.randomUUID().toString().substring(0, 8);
                }
            }
            username = candidate;
        } else {
            username = username.trim();
            if (userRepository.existsByUsername(username)) {
                throw new AppException(ErrorCode.USER_ALREADY_EXISTS);
            }
        }

        Role role;
        if (request.getRoleId() != null) {
            role = roleRepository.findById(request.getRoleId())
                    .orElseThrow(() -> new AppException(ErrorCode.ROLE_NOT_FOUND));
        } else if (request.getRoleName() != null && !request.getRoleName().isBlank()) {
            role = roleRepository.findByName(request.getRoleName().trim().toUpperCase())
                    .orElseThrow(() -> new AppException(ErrorCode.ROLE_NOT_FOUND));
        } else {
            role = roleRepository.findByName("CUSTOMER")
                    .orElseThrow(() -> new AppException(ErrorCode.ROLE_NOT_FOUND));
        }

        Facility facility = null;
        boolean isFacilityScopedRole = "STAFF".equalsIgnoreCase(role.getName())
                || "FACILITY_MANAGER".equalsIgnoreCase(role.getName());

        if (isFacilityScopedRole && request.getFacilityId() != null) {
            facility = facilityRepository.findById(request.getFacilityId())
                    .orElseThrow(() -> new AppException(ErrorCode.FACILITY_NOT_FOUND));
        }

        User user = User.builder()
                .username(username)
                .email(request.getEmail().trim())
                .password(passwordEncoder.encode(request.getPassword()))
                .fullName(request.getFullName().trim())
                .phone(request.getPhone().trim())
                .role(role)
                .facility(facility)
                .isActive(true)
                .build();

        User saved = userRepository.save(user);

        activityLogService.record(
                saved.getFacility() != null ? saved.getFacility().getId() : null,
                ActivityAction.USER_CREATE,
                "User",
                saved.getId(),
                "Tao moi tai khoan user: " + saved.getUsername() + " voi vai tro: " + role.getName(),
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

        // Check username duplicate — exclude current user
        if (request.getUsername() != null
                && userRepository.existsByUsernameAndIdNot(request.getUsername(), id)) {
            throw new AppException(ErrorCode.USER_ALREADY_EXISTS);
        }

        // Update role if provided
        if (request.getRoleId() != null) {
            Role role = roleRepository.findById(request.getRoleId())
                    .orElseThrow(() -> new AppException(ErrorCode.ROLE_NOT_FOUND));
            user.setRole(role);
        } else if (request.getRoleName() != null && !request.getRoleName().isBlank()) {
            Role role = roleRepository.findByName(request.getRoleName().trim().toUpperCase())
                    .orElseThrow(() -> new AppException(ErrorCode.ROLE_NOT_FOUND));
            user.setRole(role);
        }

        String currentRoleName = user.getRole() != null ? user.getRole().getName() : "";
        boolean isRoleScoped = "STAFF".equalsIgnoreCase(currentRoleName)
                || "FACILITY_MANAGER".equalsIgnoreCase(currentRoleName);

        if (!isRoleScoped) {
            // Customer, Admin, Business Manager are not scoped to any facility
            user.setFacility(null);
        } else if (request.getFacilityId() != null) {
            Facility facility = facilityRepository.findById(request.getFacilityId())
                    .orElseThrow(() -> new AppException(ErrorCode.FACILITY_NOT_FOUND));
            user.setFacility(facility);
        }

        userMapper.updateEntityFromRequest(request, user);
        User updated = userRepository.save(user);

        activityLogService.record(
                updated.getFacility() != null ? updated.getFacility().getId() : null,
                ActivityAction.USER_UPDATE,
                "User",
                updated.getId(),
                "Cap nhat tai khoan user: " + updated.getUsername(),
                null,
                updated.getUsername()
        );

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
                "Cap nhat ho so tai khoan: " + updated.getUsername(),
                null,
                updated.getUsername()
        );

        return userMapper.toResponse(updated);
    }

    @Override
    public void delete(UUID id) {

        User user = userRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        if (facilityAccessGuard.isFacilityScoped() && user.getFacility() != null) {
            facilityAccessGuard.checkFacilityAccess(user.getFacility().getId());
        }

        activityLogService.record(
                user.getFacility() != null ? user.getFacility().getId() : null,
                ActivityAction.USER_DEACTIVATE,
                "User",
                user.getId(),
                "Xoa tai khoan user: " + user.getUsername(),
                null,
                null
        );

        try {
            refreshTokenRepository.revokeAllUserTokens(user);
        } catch (Exception ex) {
            log.warn("Could not revoke tokens for user {}: {}", user.getUsername(), ex.getMessage());
        }

        try {
            userRepository.delete(user);
            userRepository.flush();
            log.info("User deleted successfully with id: {}", id);
        } catch (Exception ex) {
            log.warn("Hard delete failed for user {} (likely due to FK constraints), falling back to deactivate: {}", user.getUsername(), ex.getMessage());
            user.setIsActive(false);
            userRepository.save(user);
        }
    }

    @Override
    @Transactional(readOnly = true)
    public UserResponse getById(UUID id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        if (facilityAccessGuard.isFacilityScoped()) {
            if (user.getFacility() != null) {
                facilityAccessGuard.checkFacilityAccess(user.getFacility().getId());
            } else if (user.getRole() != null && ("ADMIN".equalsIgnoreCase(user.getRole().getName()) || "BUSINESS_MANAGER".equalsIgnoreCase(user.getRole().getName()))) {
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

        UUID effectiveFacilityId = facilityId;
        if (facilityAccessGuard.isFacilityScoped()) {
            effectiveFacilityId = facilityAccessGuard.scopedFacilityIdOrNull();
        }

        Page<UserResponse> result = userRepository
                .findAllWithFilters(search, isActive, roleId, role, effectiveFacilityId, pageable)
                .map(userMapper::toResponse);

        return PageResponse.from(result);
    }

    @Override
    public UserResponse toggleActive(UUID id) {

        User user = userRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        if (facilityAccessGuard.isFacilityScoped() && user.getFacility() != null) {
            facilityAccessGuard.checkFacilityAccess(user.getFacility().getId());
        }

        user.setIsActive(!user.getIsActive());
        User updated = userRepository.save(user);

        ActivityAction action = updated.getIsActive() ? ActivityAction.USER_ACTIVATE : ActivityAction.USER_DEACTIVATE;
        activityLogService.record(
                updated.getFacility() != null ? updated.getFacility().getId() : null,
                action,
                "User",
                updated.getId(),
                (updated.getIsActive() ? "Kich hoat" : "Khoa") + " tai khoan user: " + updated.getUsername(),
                !updated.getIsActive(),
                updated.getIsActive()
        );

        return userMapper.toResponse(updated);
    }
}

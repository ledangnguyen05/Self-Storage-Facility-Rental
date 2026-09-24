package com.boxora.service.impl;

import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.UserCreateRequest;
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
    private final com.boxora.service.ActivityLogService activityLogService;


    @Override
    public UserResponse create(UserCreateRequest request) {

        if (userRepository.existsByEmail(request.getEmail())) {
            throw new AppException(ErrorCode.EMAIL_ALREADY_EXISTS);
        }
        if (userRepository.existsByUsername(request.getUsername())) {
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
            if ("ADMIN".equalsIgnoreCase(role.getName()) || "BUSINESS_MANAGER".equalsIgnoreCase(role.getName())) {
                facility = null;
            }
        }

        User user = User.builder()
                .username(request.getUsername())
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .fullName(request.getFullName())
                .phone(request.getPhone())
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
                "Tao moi tai khoan user: " + saved.getUsername(),
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
            if ("ADMIN".equalsIgnoreCase(role.getName()) || "BUSINESS_MANAGER".equalsIgnoreCase(role.getName())) {
                user.setFacility(null);
            }
        }

        // Update facility if provided
        if (request.getFacilityId() != null) {
            Facility facility = facilityRepository.findById(request.getFacilityId())
                    .orElseThrow(() -> new AppException(ErrorCode.FACILITY_NOT_FOUND));

            String currentRoleName = user.getRole() != null ? user.getRole().getName() : "";
            if (!"ADMIN".equalsIgnoreCase(currentRoleName) && !"BUSINESS_MANAGER".equalsIgnoreCase(currentRoleName)) {
                user.setFacility(facility);
            }
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
                .findAllWithFilters(search, isActive, roleId, effectiveFacilityId, pageable)
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
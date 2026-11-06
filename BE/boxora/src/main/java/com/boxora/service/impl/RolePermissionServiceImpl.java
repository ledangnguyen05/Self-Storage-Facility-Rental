package com.boxora.service.impl;

import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.RolePermissionBulkAssignRequest;
import com.boxora.dto.request.RolePermissionCreateRequest;
import com.boxora.dto.request.RolePermissionUpdateRequest;
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
import com.boxora.service.RolePermissionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class RolePermissionServiceImpl implements RolePermissionService {

    private final RolePermissionRepository rolePermissionRepository;
    private final RoleRepository roleRepository;
    private final PermissionRepository permissionRepository;
    private final RolePermissionMapper rolePermissionMapper;
    private final com.boxora.service.ActivityLogService activityLogService;

    @Override
    public RolePermissionResponse getById(UUID id) {
        RolePermission rolePermission = rolePermissionRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.ROLE_PERMISSION_NOT_FOUND));
        return rolePermissionMapper.toResponse(rolePermission);
    }

    @Override
    public RolePermissionResponse create(RolePermissionCreateRequest request) {
        Role role = roleRepository.findById(request.getRoleId())
                .orElseThrow(() -> new AppException(ErrorCode.ROLE_NOT_FOUND));

        Permission permission = permissionRepository.findById(request.getPermissionId())
                .orElseThrow(() -> new AppException(ErrorCode.PERMISSION_NOT_FOUND));

        Optional<RolePermission> existingOpt = rolePermissionRepository
                .findByRole_IdAndPermission_Id(role.getId(), permission.getId());

        if (existingOpt.isPresent()) {
            RolePermission existing = existingOpt.get();
            if (Boolean.TRUE.equals(existing.getIsActive())) {
                throw new AppException(ErrorCode.ROLE_PERMISSION_ALREADY_EXISTS);
            }
            existing.setIsActive(true);
            if (request.getDescription() != null) {
                existing.setDescription(request.getDescription());
            }
            RolePermission updated = rolePermissionRepository.save(existing);

            activityLogService.record(
                    ActivityAction.ROLE_PERMISSION_ASSIGN,
                    "RolePermission",
                    updated.getId(),
                    "Kich hoat lai quyen " + permission.getName() + " cho role " + role.getName(),
                    null,
                    role.getName()
            );

            return rolePermissionMapper.toResponse(updated);
        }

        RolePermission rolePermission = RolePermission.builder()
                .role(role)
                .permission(permission)
                .isActive(true)
                .description(request.getDescription())
                .build();

        RolePermission saved = rolePermissionRepository.save(rolePermission);

        activityLogService.record(
                ActivityAction.ROLE_PERMISSION_ASSIGN,
                "RolePermission",
                saved.getId(),
                "Gan quyen " + permission.getName() + " cho role " + role.getName(),
                null,
                role.getName()
        );

        return rolePermissionMapper.toResponse(saved);
    }

    @Override
    public RolePermissionResponse update(UUID id, RolePermissionUpdateRequest request) {
        RolePermission rolePermission = rolePermissionRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.ROLE_PERMISSION_NOT_FOUND));

        rolePermissionMapper.updateEntityFromRequest(request, rolePermission);
        RolePermission updated = rolePermissionRepository.save(rolePermission);
        return rolePermissionMapper.toResponse(updated);
    }

    @Override
    public void delete(UUID id) {
        RolePermission rolePermission = rolePermissionRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.ROLE_PERMISSION_NOT_FOUND));

        activityLogService.record(
                ActivityAction.ROLE_PERMISSION_REVOKE,
                "RolePermission",
                rolePermission.getId(),
                "Thu hoi quyen " + (rolePermission.getPermission() != null ? rolePermission.getPermission().getName() : "")
                        + " khoi role " + (rolePermission.getRole() != null ? rolePermission.getRole().getName() : ""),
                null,
                null
        );

        rolePermissionRepository.deleteById(rolePermission.getId());
    }

    @Override
    public PageResponse<RolePermissionResponse> getAll(
            UUID roleId, UUID permissionId, String search, Boolean isActive,
            int page, int size, String sortBy, String sortDir) {
        Sort sort = sortDir.equalsIgnoreCase("desc")
                ? Sort.by(sortBy).descending()
                : Sort.by(sortBy).ascending();
        Pageable pageable = PageRequest.of(page, size, sort);
        Page<RolePermissionResponse> result = rolePermissionRepository
                .findAllWithFilters(roleId, permissionId, search, isActive, pageable)
                .map(rolePermissionMapper::toResponse);
        return PageResponse.from(result);
    }

    @Override
    public List<RolePermissionResponse> getByRoleId(UUID roleId) {
        if (!roleRepository.existsById(roleId)) {
            throw new AppException(ErrorCode.ROLE_NOT_FOUND);
        }
        return rolePermissionRepository.findAllByRole_IdAndIsActiveTrueAndPermission_IsActiveTrue(roleId)
                .stream()
                .map(rolePermissionMapper::toResponse)
                .toList();
    }

    private static final Set<String> PROTECTED_ADMIN_PERMISSIONS = Set.of(
            "ROLE_PERMISSION_VIEW",
            "ROLE_PERMISSION_ASSIGN",
            "ROLE_PERMISSION_REVOKE",
            "USER_VIEW",
            "ROLE_VIEW",
            "PERMISSION_VIEW"
    );

    @Override
    public List<RolePermissionResponse> bulkAssign(RolePermissionBulkAssignRequest request) {
        Role role = roleRepository.findById(request.getRoleId())
                .orElseThrow(() -> new AppException(ErrorCode.ROLE_NOT_FOUND));

        List<UUID> permissionIds = request.getPermissionIds() != null ? new ArrayList<>(request.getPermissionIds()) : new ArrayList<>();
        Set<UUID> targetPermSet = new HashSet<>(permissionIds);

        // Ho tro nap them cac permission qua ma permissionCodes neu co truyen vao
        if (request.getPermissionCodes() != null && !request.getPermissionCodes().isEmpty()) {
            List<String> cleanCodes = request.getPermissionCodes().stream()
                    .filter(Objects::nonNull)
                    .map(String::trim)
                    .filter(s -> !s.isEmpty())
                    .toList();
            if (!cleanCodes.isEmpty()) {
                List<Permission> matchedByCode = permissionRepository.findAllByNameIn(cleanCodes);
                for (Permission p : matchedByCode) {
                    targetPermSet.add(p.getId());
                }
            }
        }

        // Lay toan bo phan quyen hien tai cua role
        List<RolePermission> allExistingForRole = rolePermissionRepository.findAllByRole_Id(role.getId());
        Map<UUID, RolePermission> existingMap = allExistingForRole.stream()
                .filter(rp -> rp.getPermission() != null && rp.getPermission().getId() != null)
                .collect(Collectors.toMap(rp -> rp.getPermission().getId(), rp -> rp, (a, b) -> a));

        // Bao ve quyen quan tri he thong toi thieu cho ADMIN (Phase 5)
        boolean isAdminRole = "ADMIN".equalsIgnoreCase(role.getName());
        if (isAdminRole) {
            for (RolePermission rp : allExistingForRole) {
                if (rp.getPermission() != null && PROTECTED_ADMIN_PERMISSIONS.contains(rp.getPermission().getName())) {
                    targetPermSet.add(rp.getPermission().getId());
                }
            }
        }

        List<RolePermission> toSave = new ArrayList<>();
        List<String> revokedPermNames = new ArrayList<>();
        List<String> assignedPermNames = new ArrayList<>();

        // 1. Thu hoi cac quyen bi bo tick (deactivate)
        for (RolePermission rp : allExistingForRole) {
            if (rp.getPermission() != null && !targetPermSet.contains(rp.getPermission().getId())) {
                if (Boolean.TRUE.equals(rp.getIsActive())) {
                    rp.setIsActive(false);
                    toSave.add(rp);
                    revokedPermNames.add(rp.getPermission().getName());
                }
            }
        }

        // 2. Kich hoat hoac tao moi cac quyen duoc tick
        if (!targetPermSet.isEmpty()) {
            List<Permission> permissions = permissionRepository.findAllById(targetPermSet);
            for (Permission permission : permissions) {
                RolePermission rp = existingMap.get(permission.getId());
                if (rp != null) {
                    if (!Boolean.TRUE.equals(rp.getIsActive())) {
                        rp.setIsActive(true);
                        toSave.add(rp);
                        assignedPermNames.add(permission.getName());
                    }
                } else {
                    RolePermission newRp = RolePermission.builder()
                            .role(role)
                            .permission(permission)
                            .isActive(true)
                            .build();
                    toSave.add(newRp);
                    assignedPermNames.add(permission.getName());
                }
            }
        }

        if (!toSave.isEmpty()) {
            rolePermissionRepository.saveAll(toSave);
        }

        // Ghi nhat ky kiem toan chi tiet cho tung quyen duoc thu hoi hoac cap phat (Phase 7)
        for (String permName : revokedPermNames) {
            activityLogService.record(
                    ActivityAction.ROLE_PERMISSION_REVOKE,
                    "RolePermission",
                    role.getId(),
                    "Thu hoi quyen " + permName + " khoi vai tro " + role.getName(),
                    true,
                    false
            );
        }
        for (String permName : assignedPermNames) {
            activityLogService.record(
                    ActivityAction.ROLE_PERMISSION_ASSIGN,
                    "RolePermission",
                    role.getId(),
                    "Cap quyen " + permName + " cho vai tro " + role.getName(),
                    false,
                    true
            );
        }

        // Ghi nhat ky tong hop thay doi phan quyen
        activityLogService.record(
                ActivityAction.ROLE_PERMISSION_ASSIGN,
                "RolePermission",
                role.getId(),
                "Cap nhat phan quyen (" + targetPermSet.size() + " quyen hoat dong) cho role " + role.getName()
                        + " (Cap moi: " + assignedPermNames.size() + ", Thu hoi: " + revokedPermNames.size() + ")",
                null,
                targetPermSet.size()
        );

        return rolePermissionRepository.findAllByRole_Id(role.getId()).stream()
                .filter(rp -> Boolean.TRUE.equals(rp.getIsActive()))
                .map(rolePermissionMapper::toResponse)
                .toList();
    }
}
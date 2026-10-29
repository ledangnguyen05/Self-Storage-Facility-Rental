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

    @Override
    public List<RolePermissionResponse> bulkAssign(RolePermissionBulkAssignRequest request) {
        Role role = roleRepository.findById(request.getRoleId())
                .orElseThrow(() -> new AppException(ErrorCode.ROLE_NOT_FOUND));

        List<UUID> permissionIds = request.getPermissionIds() != null ? request.getPermissionIds() : Collections.emptyList();
        Set<UUID> targetPermSet = new HashSet<>(permissionIds);

        // Lay toan bo phan quyen hien tai cua role
        List<RolePermission> allExistingForRole = rolePermissionRepository.findAllByRole_Id(role.getId());
        Map<UUID, RolePermission> existingMap = allExistingForRole.stream()
                .filter(rp -> rp.getPermission() != null && rp.getPermission().getId() != null)
                .collect(Collectors.toMap(rp -> rp.getPermission().getId(), rp -> rp, (a, b) -> a));

        List<RolePermission> toSave = new ArrayList<>();

        // 1. Thu hoi cac quyen bi bo tick (deactivate)
        for (RolePermission rp : allExistingForRole) {
            if (rp.getPermission() != null && !targetPermSet.contains(rp.getPermission().getId())) {
                if (Boolean.TRUE.equals(rp.getIsActive())) {
                    rp.setIsActive(false);
                    toSave.add(rp);
                }
            }
        }

        // 2. Kich hoat hoac tao moi cac quyen duoc tick
        if (!permissionIds.isEmpty()) {
            List<Permission> permissions = permissionRepository.findAllById(permissionIds);
            for (Permission permission : permissions) {
                RolePermission rp = existingMap.get(permission.getId());
                if (rp != null) {
                    if (!Boolean.TRUE.equals(rp.getIsActive())) {
                        rp.setIsActive(true);
                        toSave.add(rp);
                    }
                } else {
                    RolePermission newRp = RolePermission.builder()
                            .role(role)
                            .permission(permission)
                            .isActive(true)
                            .build();
                    toSave.add(newRp);
                }
            }
        }

        if (!toSave.isEmpty()) {
            rolePermissionRepository.saveAll(toSave);
        }

        activityLogService.record(
                ActivityAction.ROLE_PERMISSION_ASSIGN,
                "RolePermission",
                role.getId(),
                "Cap nhat phan quyen (" + targetPermSet.size() + " quyen hoat dong) cho role " + role.getName(),
                null,
                targetPermSet.size()
        );

        return rolePermissionRepository.findAllByRole_Id(role.getId()).stream()
                .filter(rp -> Boolean.TRUE.equals(rp.getIsActive()))
                .map(rolePermissionMapper::toResponse)
                .toList();
    }
}
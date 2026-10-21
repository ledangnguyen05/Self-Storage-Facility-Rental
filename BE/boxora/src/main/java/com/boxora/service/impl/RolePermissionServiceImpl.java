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
                    "Kích hoạt lại quyền " + permission.getName() + " cho vai trò " + role.getName(),
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
                "Gán quyền " + permission.getName() + " cho vai trò " + role.getName(),
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
                "Thu hồi quyền " + (rolePermission.getPermission() != null ? rolePermission.getPermission().getName() : "")
                        + " khỏi vai trò " + (rolePermission.getRole() != null ? rolePermission.getRole().getName() : ""),
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
        return rolePermissionRepository.findAllByRole_Id(roleId)
                .stream()
                .map(rolePermissionMapper::toResponse)
                .toList();
    }

    /**
     * Replace semantics: after the call the role holds exactly {@code permissionIds}. Listed permissions are
     * created or re-activated; every other permission of the role is deactivated (the row is kept for history).
     * An empty list is valid and revokes everything. Returns the role's resulting ACTIVE permissions.
     */
    @Override
    public List<RolePermissionResponse> bulkAssign(RolePermissionBulkAssignRequest request) {
        Role role = roleRepository.findById(request.getRoleId())
                .orElseThrow(() -> new AppException(ErrorCode.ROLE_NOT_FOUND));

        Set<UUID> wantedIds = request.getPermissionIds() == null
                ? new LinkedHashSet<>()
                : request.getPermissionIds().stream().filter(Objects::nonNull).collect(Collectors.toCollection(LinkedHashSet::new));

        List<Permission> permissions = wantedIds.isEmpty() ? List.of() : permissionRepository.findAllById(wantedIds);
        if (permissions.size() != wantedIds.size()) {
            throw new AppException(ErrorCode.PERMISSION_NOT_FOUND);
        }

        Map<UUID, RolePermission> existingByPermission = rolePermissionRepository.findAllByRole_Id(role.getId()).stream()
                .collect(Collectors.toMap(rp -> rp.getPermission().getId(), rp -> rp, (a, b) -> a));

        List<RolePermission> toSave = new ArrayList<>();
        List<String> granted = new ArrayList<>();
        List<String> revoked = new ArrayList<>();

        for (Permission permission : permissions) {
            RolePermission rp = existingByPermission.get(permission.getId());
            if (rp == null) {
                toSave.add(RolePermission.builder().role(role).permission(permission).isActive(true).build());
                granted.add(permission.getName());
            } else if (!Boolean.TRUE.equals(rp.getIsActive())) {
                rp.setIsActive(true);
                toSave.add(rp);
                granted.add(permission.getName());
            }
        }

        for (RolePermission rp : existingByPermission.values()) {
            if (!wantedIds.contains(rp.getPermission().getId()) && Boolean.TRUE.equals(rp.getIsActive())) {
                rp.setIsActive(false);
                toSave.add(rp);
                revoked.add(rp.getPermission().getName());
            }
        }

        if (!toSave.isEmpty()) {
            rolePermissionRepository.saveAll(toSave);
        }

        if (!granted.isEmpty()) {
            activityLogService.record(
                    ActivityAction.ROLE_PERMISSION_ASSIGN,
                    "RolePermission",
                    role.getId(),
                    "Cấp thêm " + granted.size() + " quyền cho vai trò " + role.getName(),
                    null,
                    granted
            );
        }
        if (!revoked.isEmpty()) {
            activityLogService.record(
                    ActivityAction.ROLE_PERMISSION_REVOKE,
                    "RolePermission",
                    role.getId(),
                    "Thu hồi " + revoked.size() + " quyền khỏi vai trò " + role.getName(),
                    revoked,
                    null
            );
        }

        return rolePermissionRepository.findAllByRole_IdAndIsActiveTrueAndPermission_IsActiveTrue(role.getId()).stream()
                .map(rolePermissionMapper::toResponse)
                .toList();
    }
}

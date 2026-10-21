package com.boxora.service.impl;

import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.RoleCreateRequest;
import com.boxora.dto.request.RoleUpdateRequest;
import com.boxora.dto.response.RoleResponse;
import com.boxora.entity.Role;
import com.boxora.enums.ActivityAction;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.mapper.RoleMapper;
import com.boxora.repository.RolePermissionRepository;
import com.boxora.repository.UserRepository;
import com.boxora.repository.RoleRepository;
import com.boxora.service.RoleService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.transaction.annotation.Transactional;
import lombok.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.*;

import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class RoleServiceImpl implements RoleService {

    private static final Set<String> SYSTEM_ROLES = Set.of(
            "ADMIN",
            "FACILITY_MANAGER",
            "BUSINESS_MANAGER",
            "STAFF",
            "CUSTOMER"
    );

    private final RoleRepository roleRepository;
    private final UserRepository userRepository;
    private final RolePermissionRepository rolePermissionRepository;
    private final RoleMapper roleMapper;
    private final com.boxora.service.ActivityLogService activityLogService;

    @Override
    public RoleResponse getById(UUID id){
        Role role = roleRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.ROLE_NOT_FOUND));
        return roleMapper.toResponse(role);
    }

    @Override
    public RoleResponse create(RoleCreateRequest request) {
        String trimmedName = request.getName() != null ? request.getName().trim() : "";
        if(roleRepository.existsByName(trimmedName)){
            throw new AppException(ErrorCode.ROLE_NAME_EXISTED);
        }
        Role role = roleMapper.toEntity(request);
        role.setName(trimmedName);
        Role saved = roleRepository.save(role);

        activityLogService.record(
                ActivityAction.ROLE_CREATE,
                "Role",
                saved.getId(),
                "Tạo mới vai trò: " + saved.getName(),
                null,
                saved.getName()
        );

        return roleMapper.toResponse(saved);
    }

    @Override
    public RoleResponse update(UUID id, RoleUpdateRequest request) {
        Role role = roleRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.ROLE_NOT_FOUND));

        String trimmedName = request.getName() != null ? request.getName().trim() : role.getName();

        if (SYSTEM_ROLES.contains(role.getName().toUpperCase())
                && !role.getName().equalsIgnoreCase(trimmedName)) {
            throw new AppException(ErrorCode.CANNOT_MODIFY_SYSTEM_ROLE);
        }

        if(roleRepository.existsByNameAndIdNot(trimmedName, role.getId())){
            throw new AppException(ErrorCode.ROLE_NAME_EXISTED);
        }

        roleMapper.updateEntityFromRequest(request, role);
        role.setName(trimmedName);
        Role updated = roleRepository.save(role);

        activityLogService.record(
                ActivityAction.ROLE_UPDATE,
                "Role",
                updated.getId(),
                "Cập nhật vai trò: " + updated.getName(),
                null,
                updated.getName()
        );

        return roleMapper.toResponse(updated);
    }

    @Override
    public void delete(UUID id) {
        Role role = roleRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.ROLE_NOT_FOUND));

        if (SYSTEM_ROLES.contains(role.getName().toUpperCase())) {
            throw new AppException(ErrorCode.CANNOT_DELETE_SYSTEM_ROLE);
        }

        if (userRepository.existsByRole_Id(role.getId())) {
            throw new AppException(ErrorCode.ROLE_IN_USE);
        }

        activityLogService.record(
                ActivityAction.ROLE_DELETE,
                "Role",
                role.getId(),
                "Xóa vai trò: " + role.getName(),
                null,
                null
        );

        rolePermissionRepository.deleteAllByRole_Id(role.getId());

        roleRepository.deleteById(role.getId());
    }

    @Override
    public PageResponse<RoleResponse> getAll
            (String search, Boolean isActive, int page, int size, String sortBy, String sortDir) {
        Sort sort = sortDir.equalsIgnoreCase("desc")
                ?Sort.by(sortBy).descending()
                :Sort.by(sortBy).ascending();
        Pageable pageable= PageRequest.of(page,size,sort);
        Page<RoleResponse> result = roleRepository.findAllWithFilters(search,isActive,pageable).
                map(roleMapper::toResponse);
        return PageResponse.from(result);
    }
}

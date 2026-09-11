package com.boxora.service.impl;

import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.RoleCreateRequest;
import com.boxora.dto.request.RoleUpdateRequest;
import com.boxora.dto.response.RoleResponse;
import com.boxora.entity.Role;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.mapper.RoleMapper;
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
@RequiredArgsConstructor  // do not need to create constructor RoleServiceImpl
@Slf4j  // do not need to create constructor      private static final Logger log
@Transactional  /*if a method contains 2 repository.save , Transactional make sure that
either both features save success or both fail, if 1 success and 1 fail then will roll back
and that method will not save in db
*/

public class RoleServiceImpl implements RoleService {

    private final RoleRepository roleRepository;
    private final RoleMapper roleMapper;

    @Override
    public RoleResponse getById(UUID id){
        Role role = roleRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.ROLE_NOT_FOUND));
        return roleMapper.toResponse(role);
    }

    @Override
    public RoleResponse create(RoleCreateRequest request) {
        if(roleRepository.existsByName(request.getName())){
            throw new AppException(ErrorCode.ROLE_NAME_EXISTED);
        }
        Role role=roleMapper.toEntity(request);
        Role saved=roleRepository.save(role);

        return roleMapper.toResponse(saved);
    }

    @Override
    public RoleResponse update(UUID id, RoleUpdateRequest request) {
        Role role = roleRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.ROLE_NOT_FOUND));

        if(roleRepository.existsByNameAndIdNot(request.getName(),role.getId())){
            throw new AppException(ErrorCode.ROLE_NAME_EXISTED);
        }

        roleMapper.updateEntityFromRequest(request, role);
        Role updated=roleRepository.save(role);
        return roleMapper.toResponse(updated);
    }

    @Override
    public void delete(UUID id) {
        Role role = roleRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.ROLE_NOT_FOUND));
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

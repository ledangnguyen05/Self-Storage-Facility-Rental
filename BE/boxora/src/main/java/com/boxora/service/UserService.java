package com.boxora.service;

import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.UserCreateRequest;
import com.boxora.dto.request.UserUpdateRequest;
import com.boxora.dto.response.UserResponse;

import java.util.UUID;

public interface UserService {
    UserResponse create(UserCreateRequest request);
    UserResponse update(UUID id, UserUpdateRequest request);
    void delete(UUID id);
    UserResponse getById(UUID id);
    PageResponse<UserResponse> findAllWithFilters(
            String search,
            Boolean isActive,
            UUID roleId,
            UUID facilityId,
            int page,
            int size,
            String sortBy,
            String sortDir
    );
    UserResponse toggleActive(UUID id);
}

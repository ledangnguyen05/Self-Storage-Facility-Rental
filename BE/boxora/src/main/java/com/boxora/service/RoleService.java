package com.boxora.service;
import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.RoleCreateRequest;
import com.boxora.dto.request.RoleUpdateRequest;
import com.boxora.dto.response.RoleResponse;

import java.util.*;

public interface RoleService {
        RoleResponse getById(UUID id);
        RoleResponse create(RoleCreateRequest request);
        RoleResponse update(UUID id, RoleUpdateRequest request);
        void delete(UUID id);
        PageResponse<RoleResponse> getAll(String search, Boolean isActive, int page, int size, String sortBy, String sortDir);
}

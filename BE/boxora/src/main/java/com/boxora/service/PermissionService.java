package com.boxora.service;

import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.PermissionCreateRequest;
import com.boxora.dto.request.PermissionUpdateRequest;
import com.boxora.dto.response.PermissionResponse;

import java.util.*;

public interface PermissionService {
    PermissionResponse getById(UUID id);
    PermissionResponse create(PermissionCreateRequest request);
    PermissionResponse update(UUID id, PermissionUpdateRequest request);
    void delete(UUID id);
    PageResponse<PermissionResponse> getAll(String search, Boolean isActive, int page, int size, String sortBy, String sortDir);
}

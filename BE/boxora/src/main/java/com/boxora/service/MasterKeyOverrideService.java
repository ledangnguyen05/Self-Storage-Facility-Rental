package com.boxora.service;

import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.MasterKeyOverrideRequest;
import com.boxora.dto.response.MasterKeyOverrideResponse;

import java.util.UUID;

public interface MasterKeyOverrideService {
    MasterKeyOverrideResponse create(MasterKeyOverrideRequest request);
    MasterKeyOverrideResponse getById(UUID id);
    PageResponse<MasterKeyOverrideResponse> getAll(UUID facilityId, int page, int size, String sortBy, String sortDir);
}
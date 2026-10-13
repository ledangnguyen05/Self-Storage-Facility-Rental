package com.boxora.service;

import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.FacilityCreateRequest;
import com.boxora.dto.request.FacilityUpdateRequest;
import com.boxora.dto.response.FacilityResponse;
import com.boxora.enums.FacilityStatus;

import java.util.UUID;

public interface FacilityService {
    FacilityResponse getById(UUID id);
    FacilityResponse create(FacilityCreateRequest request);
    FacilityResponse update(UUID id, FacilityUpdateRequest request);
    void delete(UUID id);
    PageResponse<FacilityResponse> getAll(String search, FacilityStatus status, int page, int size, String sortBy, String sortDir);
}
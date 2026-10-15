package com.boxora.service;

import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.FacilityPolicyCreateRequest;
import com.boxora.dto.request.FacilityPolicyUpdateRequest;
import com.boxora.dto.response.FacilityPolicyResponse;

import java.util.UUID;
import java.util.List;

public interface FacilityPolicyService {
    FacilityPolicyResponse getById(UUID id);
    FacilityPolicyResponse getByFacilityId(UUID facilityId);
    FacilityPolicyResponse create(FacilityPolicyCreateRequest request);
    FacilityPolicyResponse update(UUID id, FacilityPolicyUpdateRequest request);
    void delete(UUID id);
    List<UUID> getExceptionGrants(UUID id);
    void setExceptionGrant(UUID id, UUID facilityManagerId, boolean granted);
    PageResponse<FacilityPolicyResponse> getAll(String search, int page, int size, String sortBy, String sortDir);
}

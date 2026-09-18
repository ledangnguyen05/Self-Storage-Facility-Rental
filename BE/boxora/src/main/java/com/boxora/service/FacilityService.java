package com.boxora.service;

import com.boxora.dto.request.FacilityCreateRequest;
import com.boxora.dto.response.FacilityResponse;

import java.util.List;
import java.util.UUID;

public interface FacilityService {
    List<FacilityResponse> getAllFacilities();
    FacilityResponse getById(UUID id);
    FacilityResponse createFacility(FacilityCreateRequest request);
}

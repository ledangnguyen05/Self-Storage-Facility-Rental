package com.boxora.service;

import com.boxora.dto.request.FacilityPolicyRequest;
import com.boxora.dto.response.FacilityPolicyResponse;

import java.util.UUID;

public interface FacilityPolicyService {
    FacilityPolicyResponse getActivePolicy(UUID facilityId);
    FacilityPolicyResponse updatePolicy(FacilityPolicyRequest request);
}

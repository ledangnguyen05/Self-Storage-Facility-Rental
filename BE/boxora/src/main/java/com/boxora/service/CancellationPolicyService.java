package com.boxora.service;

import com.boxora.dto.request.PolicyConfirmationRequest;
import com.boxora.dto.response.CancellationPolicyDetailResponse;
import com.boxora.dto.response.PolicyConfirmationResponse;
import com.boxora.dto.response.PolicyConfirmationStatusResponse;
import jakarta.servlet.http.HttpServletRequest;

import java.util.UUID;

public interface CancellationPolicyService {

    CancellationPolicyDetailResponse getPolicyDetailByFacilityId(UUID facilityId);

    CancellationPolicyDetailResponse getPolicyDetailByBookingId(UUID bookingId);

    PolicyConfirmationResponse confirmPolicy(PolicyConfirmationRequest request, HttpServletRequest httpRequest);

    PolicyConfirmationStatusResponse getConfirmationStatus(UUID bookingId);
}

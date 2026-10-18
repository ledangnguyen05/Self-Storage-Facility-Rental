package com.boxora.service;

import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.ShiftSwapCreateRequest;
import com.boxora.dto.request.ShiftSwapReviewRequest;
import com.boxora.dto.response.ShiftSwapResponse;
import com.boxora.enums.ShiftSwapStatus;

import java.util.List;
import java.util.UUID;

public interface ShiftSwapService {

    ShiftSwapResponse createSwapRequest(ShiftSwapCreateRequest request);

    ShiftSwapResponse reviewSwapRequest(UUID swapId, ShiftSwapReviewRequest request);

    ShiftSwapResponse cancelSwapRequest(UUID swapId);

    ShiftSwapResponse getById(UUID id);

    PageResponse<ShiftSwapResponse> getSwapRequests(
            UUID facilityId,
            ShiftSwapStatus status,
            UUID staffId,
            int page,
            int size
    );

    List<ShiftSwapResponse> getMySwapRequests();
}

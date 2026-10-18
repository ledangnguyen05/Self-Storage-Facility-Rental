package com.boxora.service;

import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.ShiftHandoverAcknowledgeRequest;
import com.boxora.dto.request.ShiftHandoverCreateRequest;
import com.boxora.dto.response.ShiftHandoverResponse;
import com.boxora.enums.ShiftHandoverStatus;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface ShiftHandoverService {

    ShiftHandoverResponse createHandover(ShiftHandoverCreateRequest request);

    ShiftHandoverResponse acknowledgeHandover(UUID handoverId, ShiftHandoverAcknowledgeRequest request);

    ShiftHandoverResponse getById(UUID id);

    PageResponse<ShiftHandoverResponse> getHandovers(
            UUID facilityId,
            LocalDate date,
            ShiftHandoverStatus status,
            int page,
            int size
    );

    List<ShiftHandoverResponse> getRecentFacilityHandovers(UUID facilityId);
}

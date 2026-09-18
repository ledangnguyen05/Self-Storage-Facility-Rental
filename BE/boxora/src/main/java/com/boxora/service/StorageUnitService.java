package com.boxora.service;

import com.boxora.dto.request.StorageUnitCreateRequest;
import com.boxora.dto.response.StorageUnitResponse;

import java.util.List;
import java.util.UUID;

public interface StorageUnitService {
    List<StorageUnitResponse> getUnits(UUID facilityId, String floorLevel, String status);
    StorageUnitResponse getById(UUID id);
    StorageUnitResponse createUnit(StorageUnitCreateRequest request);
    StorageUnitResponse toggleMaintenance(UUID id);
}

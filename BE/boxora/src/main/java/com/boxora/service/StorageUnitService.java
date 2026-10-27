package com.boxora.service;

import com.boxora.dto.request.StorageUnitCreateRequest;
import com.boxora.dto.request.StorageUnitUpdateRequest;
import com.boxora.dto.request.ToggleMaintenanceRequest;
import com.boxora.dto.response.StorageUnitResponse;

import java.util.List;
import java.util.UUID;

public interface StorageUnitService {
    List<StorageUnitResponse> getUnits(UUID facilityId, String floorLevel, String status);
    StorageUnitResponse getById(UUID id);
    StorageUnitResponse createUnit(StorageUnitCreateRequest request);
    StorageUnitResponse updateUnit(UUID id, StorageUnitUpdateRequest request);
    void deleteUnit(UUID id);
    StorageUnitResponse toggleMaintenance(UUID id);
    StorageUnitResponse toggleMaintenance(UUID id, ToggleMaintenanceRequest request);
}

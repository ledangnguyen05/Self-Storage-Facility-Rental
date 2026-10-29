package com.boxora.service;

import com.boxora.dto.request.StorageUnitCreateRequest;
import com.boxora.dto.request.StorageUnitUpdateRequest;
import com.boxora.dto.request.ToggleMaintenanceRequest;
import com.boxora.dto.response.StorageUnitResponse;
import com.boxora.dto.response.UnitAvailabilityResponse;

import java.util.List;
import java.util.UUID;

public interface StorageUnitService {
    List<StorageUnitResponse> getUnits(UUID facilityId, String floorLevel, String status, Boolean forAssignment);

    default List<StorageUnitResponse> getUnits(UUID facilityId, String floorLevel, String status) {
        return getUnits(facilityId, floorLevel, status, false);
    }

    StorageUnitResponse getById(UUID id);
    StorageUnitResponse createUnit(StorageUnitCreateRequest request);
    StorageUnitResponse updateUnit(UUID id, StorageUnitUpdateRequest request);
    void deleteUnit(UUID id);
    StorageUnitResponse toggleMaintenance(UUID id);
    StorageUnitResponse toggleMaintenance(UUID id, ToggleMaintenanceRequest request);

    long getAvailableUnitsCount(UUID facilityId, UUID unitTypeId);
    long getFacilityAvailableUnitsCount(UUID facilityId);
    UnitAvailabilityResponse getUnitAvailability(UUID facilityId, UUID unitTypeId);
    List<UnitAvailabilityResponse> getFacilityAvailability(UUID facilityId);
}

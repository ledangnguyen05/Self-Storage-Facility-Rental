package com.boxora.service.impl;

import com.boxora.dto.request.StorageUnitCreateRequest;
import com.boxora.dto.response.StorageUnitResponse;
import com.boxora.entity.Facility;
import com.boxora.entity.StorageUnit;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.repository.FacilityRepository;
import com.boxora.repository.StorageUnitRepository;
import com.boxora.service.StorageUnitService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class StorageUnitServiceImpl implements StorageUnitService {

    private final StorageUnitRepository storageUnitRepository;
    private final FacilityRepository facilityRepository;

    @Override
    public List<StorageUnitResponse> getUnits(UUID facilityId, String floorLevel, String status) {
        List<StorageUnit> units;
        if (facilityId != null && floorLevel != null) {
            units = storageUnitRepository.findByFacility_IdAndFloorLevel(facilityId, floorLevel);
        } else if (facilityId != null) {
            units = storageUnitRepository.findByFacility_Id(facilityId);
        } else if (status != null) {
            units = storageUnitRepository.findByStatus(status);
        } else {
            units = storageUnitRepository.findAll();
        }

        if (status != null) {
            units = units.stream().filter(u -> status.equalsIgnoreCase(u.getStatus())).collect(Collectors.toList());
        }

        return units.stream().map(this::mapToResponse).collect(Collectors.toList());
    }

    @Override
    public StorageUnitResponse getById(UUID id) {
        StorageUnit unit = storageUnitRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.RESOURCE_NOT_FOUND));
        return mapToResponse(unit);
    }

    @Override
    public StorageUnitResponse createUnit(StorageUnitCreateRequest request) {
        Facility facility = facilityRepository.findById(request.getFacilityId())
                .orElseThrow(() -> new AppException(ErrorCode.RESOURCE_NOT_FOUND));

        StorageUnit unit = StorageUnit.builder()
                .unitCode(request.getUnitCode())
                .floorLevel(request.getFloorLevel())
                .status("AVAILABLE")
                .facility(facility)
                .build();

        unit = storageUnitRepository.save(unit);
        return mapToResponse(unit);
    }

    @Override
    public StorageUnitResponse toggleMaintenance(UUID id) {
        StorageUnit unit = storageUnitRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.RESOURCE_NOT_FOUND));

        String nextStatus = "MAINTENANCE".equalsIgnoreCase(unit.getStatus()) ? "AVAILABLE" : "MAINTENANCE";
        unit.setStatus(nextStatus);
        unit = storageUnitRepository.save(unit);

        return mapToResponse(unit);
    }

    private StorageUnitResponse mapToResponse(StorageUnit u) {
        return StorageUnitResponse.builder()
                .id(u.getId())
                .unitCode(u.getUnitCode())
                .floorLevel(u.getFloorLevel())
                .status(u.getStatus() != null ? u.getStatus() : "AVAILABLE")
                .facilityId(u.getFacility() != null ? u.getFacility().getId() : null)
                .facilityName(u.getFacility() != null ? u.getFacility().getName() : "Mega Central Tân Bình")
                .unitTypeId(u.getUnitType() != null ? u.getUnitType().getId() : null)
                .unitTypeName(u.getUnitType() != null ? u.getUnitType().getTypeName() : "Standard Roll-up Door")
                .pricePerMonth(new BigDecimal("1450000"))
                .areaSqMeters(8.0)
                .batteryLevel("98%")
                .smartLockSerial("SL-8841")
                .lastAccessTime("Hôm qua 18:24")
                .build();
    }
}

package com.boxora.service.impl;

import com.boxora.dto.request.StorageUnitCreateRequest;
import com.boxora.dto.request.StorageUnitUpdateRequest;
import com.boxora.dto.response.StorageUnitResponse;
import com.boxora.entity.Facility;
import com.boxora.entity.StorageUnit;
import com.boxora.entity.UnitType;
import com.boxora.enums.UnitStatus;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.repository.BookingRepository;
import com.boxora.repository.FacilityRepository;
import com.boxora.repository.RentalContractRepository;
import com.boxora.repository.StorageUnitRepository;
import com.boxora.repository.UnitTypeRepository;
import com.boxora.security.FacilityAccessGuard;
import com.boxora.service.StorageUnitService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class StorageUnitServiceImpl implements StorageUnitService {

    private final StorageUnitRepository storageUnitRepository;
    private final FacilityRepository facilityRepository;
    private final UnitTypeRepository unitTypeRepository;
    private final BookingRepository bookingRepository;
    private final RentalContractRepository rentalContractRepository;
    private final FacilityAccessGuard facilityAccessGuard;

    @Override
    @Transactional(readOnly = true)
    public List<StorageUnitResponse> getUnits(UUID facilityId, String floorLevel, String status) {
        if (facilityAccessGuard.isFacilityScoped()) {
            UUID scopedId = facilityAccessGuard.scopedFacilityIdOrNull();
            if (facilityId != null && !facilityId.equals(scopedId)) {
                throw new AppException(ErrorCode.FACILITY_ACCESS_DENIED);
            }
            facilityId = scopedId;
        }

        UnitStatus unitStatus = null;
        if (status != null && !status.isBlank()) {
            try {
                unitStatus = UnitStatus.valueOf(status.trim().toUpperCase());
            } catch (IllegalArgumentException e) {
                log.warn("Invalid UnitStatus filter: {}", status);
                return Collections.emptyList();
            }
        }

        List<StorageUnit> units;
        if (facilityId != null && floorLevel != null && !floorLevel.isBlank() && unitStatus != null) {
            units = storageUnitRepository.findByFacility_IdAndFloorLevelAndStatus(facilityId, floorLevel, unitStatus);
        } else if (facilityId != null && floorLevel != null && !floorLevel.isBlank()) {
            units = storageUnitRepository.findByFacility_IdAndFloorLevel(facilityId, floorLevel);
        } else if (facilityId != null && unitStatus != null) {
            units = storageUnitRepository.findByFacility_IdAndStatus(facilityId, unitStatus);
        } else if (facilityId != null) {
            units = storageUnitRepository.findByFacility_Id(facilityId);
        } else if (unitStatus != null) {
            units = storageUnitRepository.findByStatus(unitStatus);
        } else {
            units = storageUnitRepository.findAll();
        }

        return units.stream().map(this::mapToResponse).collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public StorageUnitResponse getById(UUID id) {
        StorageUnit unit = storageUnitRepository.findWithDetailsById(id)
                .orElseThrow(() -> new AppException(ErrorCode.STORAGE_UNIT_NOT_FOUND));

        if (unit.getFacility() != null) {
            facilityAccessGuard.checkFacilityAccess(unit.getFacility().getId());
        }

        return mapToResponse(unit);
    }

    @Override
    public StorageUnitResponse createUnit(StorageUnitCreateRequest request) {
        facilityAccessGuard.checkFacilityAccess(request.getFacilityId());

        Facility facility = facilityRepository.findById(request.getFacilityId())
                .orElseThrow(() -> new AppException(ErrorCode.FACILITY_NOT_FOUND));

        UnitType unitType = unitTypeRepository.findById(request.getUnitTypeId())
                .orElseThrow(() -> new AppException(ErrorCode.UNIT_TYPE_NOT_FOUND));

        String trimmedCode = request.getUnitCode().trim();
        if (storageUnitRepository.existsByFacility_IdAndUnitCode(request.getFacilityId(), trimmedCode)) {
            throw new AppException(ErrorCode.STORAGE_UNIT_CODE_EXISTED);
        }

        StorageUnit unit = StorageUnit.builder()
                .unitCode(trimmedCode)
                .floorLevel(request.getFloorLevel().trim())
                .status(UnitStatus.AVAILABLE)
                .facility(facility)
                .unitType(unitType)
                .build();

        unit = storageUnitRepository.save(unit);
        return mapToResponse(unit);
    }

    @Override
    public StorageUnitResponse updateUnit(UUID id, StorageUnitUpdateRequest request) {
        StorageUnit unit = storageUnitRepository.findWithDetailsById(id)
                .orElseThrow(() -> new AppException(ErrorCode.STORAGE_UNIT_NOT_FOUND));

        facilityAccessGuard.checkFacilityAccess(unit.getFacility().getId());

        String trimmedCode = request.getUnitCode().trim();
        if (storageUnitRepository.existsByFacility_IdAndUnitCodeAndIdNot(unit.getFacility().getId(), trimmedCode, id)) {
            throw new AppException(ErrorCode.STORAGE_UNIT_CODE_EXISTED);
        }

        UnitType unitType = unitTypeRepository.findById(request.getUnitTypeId())
                .orElseThrow(() -> new AppException(ErrorCode.UNIT_TYPE_NOT_FOUND));

        unit.setUnitCode(trimmedCode);
        unit.setFloorLevel(request.getFloorLevel().trim());
        unit.setUnitType(unitType);

        unit = storageUnitRepository.save(unit);
        return mapToResponse(unit);
    }

    @Override
    public void deleteUnit(UUID id) {
        StorageUnit unit = storageUnitRepository.findWithDetailsById(id)
                .orElseThrow(() -> new AppException(ErrorCode.STORAGE_UNIT_NOT_FOUND));

        facilityAccessGuard.checkFacilityAccess(unit.getFacility().getId());

        if (unit.getStatus() == UnitStatus.OCCUPIED || unit.getStatus() == UnitStatus.RESERVED) {
            throw new AppException(ErrorCode.STORAGE_UNIT_IN_USE);
        }

        boolean hasBookings = bookingRepository.existsByStorageUnit_Id(id);
        boolean hasContracts = rentalContractRepository.existsByUnit_Id(id);
        if (hasBookings || hasContracts) {
            throw new AppException(ErrorCode.STORAGE_UNIT_IN_USE);
        }

        storageUnitRepository.delete(unit);
    }

    @Override
    public StorageUnitResponse toggleMaintenance(UUID id) {
        StorageUnit unit = storageUnitRepository.findWithDetailsById(id)
                .orElseThrow(() -> new AppException(ErrorCode.STORAGE_UNIT_NOT_FOUND));

        facilityAccessGuard.checkFacilityAccess(unit.getFacility().getId());

        if (unit.getStatus() == UnitStatus.OCCUPIED || unit.getStatus() == UnitStatus.RESERVED) {
            throw new AppException(ErrorCode.STORAGE_UNIT_CANNOT_MAINTAIN);
        }

        if (unit.getStatus() == UnitStatus.AVAILABLE) {
            unit.setStatus(UnitStatus.UNDER_MAINTENANCE);
        } else if (unit.getStatus() == UnitStatus.UNDER_MAINTENANCE) {
            unit.setStatus(UnitStatus.AVAILABLE);
        }

        unit = storageUnitRepository.save(unit);
        return mapToResponse(unit);
    }

    private StorageUnitResponse mapToResponse(StorageUnit u) {
        BigDecimal price = (u.getUnitType() != null && u.getUnitType().getBasePricePerMonth() != null)
                ? u.getUnitType().getBasePricePerMonth()
                : null;
        Double area = (u.getUnitType() != null) ? u.getUnitType().getAreaSqm() : null;

        return StorageUnitResponse.builder()
                .id(u.getId())
                .unitCode(u.getUnitCode())
                .floorLevel(u.getFloorLevel())
                .status(u.getStatus() != null ? u.getStatus().name() : UnitStatus.AVAILABLE.name())
                .facilityId(u.getFacility() != null ? u.getFacility().getId() : null)
                .facilityName(u.getFacility() != null ? u.getFacility().getName() : null)
                .unitTypeId(u.getUnitType() != null ? u.getUnitType().getId() : null)
                .unitTypeName(u.getUnitType() != null ? u.getUnitType().getTypeName() : null)
                .pricePerMonth(price)
                .areaSqMeters(area)
                .batteryLevel("98%")
                .smartLockSerial("SL-" + (u.getUnitCode() != null ? u.getUnitCode().replace("-", "") : "8841"))
                .lastAccessTime(null)
                .build();
    }
}

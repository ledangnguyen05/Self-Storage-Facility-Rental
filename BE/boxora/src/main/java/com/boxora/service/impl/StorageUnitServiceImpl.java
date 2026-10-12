package com.boxora.service.impl;

import com.boxora.dto.request.StorageUnitCreateRequest;
import com.boxora.dto.request.StorageUnitUpdateRequest;
import com.boxora.dto.response.StorageUnitResponse;
import com.boxora.entity.Facility;
import com.boxora.entity.StorageUnit;
import com.boxora.entity.UnitType;
import com.boxora.enums.ActivityAction;
import com.boxora.enums.UnitStatus;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.repository.BookingRepository;
import com.boxora.repository.FacilityRepository;
import com.boxora.repository.RentalContractRepository;
import com.boxora.repository.StorageUnitRepository;
import com.boxora.repository.UnitTypeRepository;
import com.boxora.security.FacilityAccessGuard;
import com.boxora.service.ActivityLogService;
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
    private final com.boxora.service.StorageUnitPriceHistoryService storageUnitPriceHistoryService;
    private final ActivityLogService activityLogService;

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

        BigDecimal initialPrice = request.getPricePerMonth() != null
                ? request.getPricePerMonth()
                : unitType.getBasePricePerMonth();

        StorageUnit unit = StorageUnit.builder()
                .unitCode(trimmedCode)
                .floorLevel(request.getFloorLevel().trim())
                .status(UnitStatus.AVAILABLE)
                .facility(facility)
                .unitType(unitType)
                .pricePerMonth(initialPrice)
                .build();

        unit = storageUnitRepository.save(unit);

        // Khởi tạo lịch sử giá ban đầu cho kho
        storageUnitPriceHistoryService.recordInitialPrice(unit, initialPrice, null);

        // Ghi Audit Trail ActivityLog
        activityLogService.record(
                facility.getId(),
                ActivityAction.STORAGE_UNIT_CREATE,
                "StorageUnit",
                unit.getId(),
                String.format("Khởi tạo ngăn kho mới %s tại cơ sở %s", unit.getUnitCode(), facility.getName()),
                null,
                unit.getStatus()
        );

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

        // BR-RULE-011: Nếu có cập nhật đơn giá, thực hiện quy trình điều chỉnh và ghi nhận lịch sử giá
        if (request.getPricePerMonth() != null) {
            BigDecimal currentPrice = unit.getEffectiveBasePrice();
            if (currentPrice == null || currentPrice.compareTo(request.getPricePerMonth()) != 0) {
                String reason = request.getPriceChangeReason() != null && !request.getPriceChangeReason().isBlank()
                        ? request.getPriceChangeReason()
                        : "Cập nhật đơn giá kho qua chức năng chỉnh sửa thông tin kho";
                storageUnitPriceHistoryService.adjustUnitPrice(id, com.boxora.dto.request.StorageUnitPriceAdjustmentRequest.builder()
                        .newPrice(request.getPricePerMonth())
                        .reason(reason)
                        .effectiveFrom(java.time.LocalDateTime.now())
                        .build());
            }
        }

        unit = storageUnitRepository.save(unit);

        activityLogService.record(
                unit.getFacility() != null ? unit.getFacility().getId() : null,
                ActivityAction.STORAGE_UNIT_UPDATE,
                "StorageUnit",
                unit.getId(),
                String.format("Cập nhật ngăn kho %s (tầng: %s, loại: %s)", unit.getUnitCode(), unit.getFloorLevel(), unitType.getName()),
                null,
                unit.getStatus()
        );

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

        activityLogService.record(
                unit.getFacility() != null ? unit.getFacility().getId() : null,
                ActivityAction.STORAGE_UNIT_RELEASE,
                "StorageUnit",
                unit.getId(),
                String.format("Xóa bỏ ngăn kho %s khỏi cơ sở", unit.getUnitCode()),
                unit.getStatus(),
                null
        );

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

        UnitStatus oldStatus = unit.getStatus();
        if (unit.getStatus() == UnitStatus.AVAILABLE) {
            unit.setStatus(UnitStatus.UNDER_MAINTENANCE);
        } else if (unit.getStatus() == UnitStatus.UNDER_MAINTENANCE) {
            unit.setStatus(UnitStatus.AVAILABLE);
        }

        unit = storageUnitRepository.save(unit);

        activityLogService.record(
                unit.getFacility() != null ? unit.getFacility().getId() : null,
                ActivityAction.STORAGE_UNIT_STATUS_CHANGE,
                "StorageUnit",
                unit.getId(),
                String.format("Chuyển trạng thái bảo trì ngăn kho %s từ %s sang %s", unit.getUnitCode(), oldStatus, unit.getStatus()),
                oldStatus,
                unit.getStatus()
        );

        return mapToResponse(unit);
    }

    private StorageUnitResponse mapToResponse(StorageUnit u) {
        BigDecimal price = u.getEffectiveBasePrice();
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

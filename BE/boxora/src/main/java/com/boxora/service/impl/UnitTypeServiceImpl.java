package com.boxora.service.impl;

import com.boxora.dto.request.StorageUnitPriceAdjustmentRequest;
import com.boxora.dto.request.UnitTypeCreateRequest;
import com.boxora.dto.request.UnitTypePriceAdjustmentRequest;
import com.boxora.dto.request.UnitTypeUpdateRequest;
import com.boxora.dto.response.StorageUnitPriceHistoryResponse;
import com.boxora.dto.response.UnitTypeResponse;
import com.boxora.entity.StorageUnit;
import com.boxora.entity.UnitType;
import com.boxora.entity.User;
import com.boxora.enums.ActivityAction;
import com.boxora.enums.UnitStatus;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.mapper.UnitTypeMapper;
import com.boxora.repository.StorageUnitRepository;
import com.boxora.repository.UnitTypeRepository;
import com.boxora.repository.UserRepository;
import com.boxora.security.RequestContext;
import com.boxora.service.ActivityLogService;
import com.boxora.service.StorageUnitPriceHistoryService;
import com.boxora.service.UnitTypeService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class UnitTypeServiceImpl implements UnitTypeService {

    private final UnitTypeRepository unitTypeRepository;
    private final StorageUnitRepository storageUnitRepository;
    private final UserRepository userRepository;
    private final UnitTypeMapper unitTypeMapper;
    private final StorageUnitPriceHistoryService storageUnitPriceHistoryService;
    private final ActivityLogService activityLogService;
    private final RequestContext requestContext;

    @Override
    public UnitTypeResponse createUnitType(UnitTypeCreateRequest request) {
        log.info("Creating new unit type: {}", request.getTypeName());

        String trimmedName = request.getTypeName().trim();
        if (unitTypeRepository.existsByTypeNameIgnoreCase(trimmedName)) {
            throw new AppException(ErrorCode.UNIT_TYPE_NAME_EXISTED);
        }

        Double lengthM = request.getLengthM();
        Double widthM = request.getWidthM();
        Double heightM = request.getHeightM();
        Double areaSqm = request.getAreaSqm();
        Double volumeM3 = request.getVolumeM3();

        if (lengthM != null && widthM != null) {
            areaSqm = Math.round(lengthM * widthM * 100.0) / 100.0;
        }
        if (lengthM != null && widthM != null && heightM != null) {
            volumeM3 = Math.round(lengthM * widthM * heightM * 100.0) / 100.0;
        }

        String dimensions = request.getDimensions() != null ? request.getDimensions().trim() : null;
        if ((dimensions == null || dimensions.isBlank()) && lengthM != null && widthM != null && heightM != null) {
            dimensions = String.format(java.util.Locale.US, "%.1fm x %.1fm x %.1fm", lengthM, widthM, heightM);
        }

        UnitType unitType = UnitType.builder()
                .typeName(trimmedName)
                .dimensions(dimensions)
                .areaSqm(areaSqm)
                .volumeM3(volumeM3)
                .lengthM(lengthM)
                .widthM(widthM)
                .heightM(heightM)
                .capacityBoxes(request.getCapacityBoxes())
                .isActive(request.getIsActive() != null ? request.getIsActive() : true)
                .basePricePerMonth(request.getBasePricePerMonth())
                .acPricePerMonth(request.getAcPricePerMonth() != null && request.getAcPricePerMonth().compareTo(BigDecimal.ZERO) > 0 ? request.getAcPricePerMonth() : null)
                .depositAmount(request.getDepositAmount())
                .imageUrl(request.getImageUrl() != null && !request.getImageUrl().isBlank() ? request.getImageUrl().trim() : null)
                .build();

        UnitType saved = unitTypeRepository.save(unitType);

        // Khởi tạo lịch sử giá niêm yết ban đầu cho loại kho
        User currentUser = null;
        UUID currentUserId = requestContext.currentUserId();
        if (currentUserId != null) {
            currentUser = userRepository.findById(currentUserId).orElse(null);
        }
        storageUnitPriceHistoryService.recordInitialUnitTypePrice(saved, saved.getBasePricePerMonth(), currentUser);

        activityLogService.record(
                ActivityAction.UNIT_TYPE_CREATE,
                "UnitType",
                saved.getId(),
                "Tạo mới danh mục loại kho: " + saved.getTypeName(),
                null,
                saved.getId().toString()
        );

        return unitTypeMapper.toResponse(saved, 0L);
    }

    @Override
    public UnitTypeResponse updateUnitType(UUID id, UnitTypeUpdateRequest request) {
        log.info("Updating unit type id={}", id);

        UnitType unitType = unitTypeRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.UNIT_TYPE_NOT_FOUND));

        if (request.getTypeName() != null && !request.getTypeName().isBlank()) {
            String trimmedName = request.getTypeName().trim();
            if (unitTypeRepository.existsByTypeNameIgnoreCaseAndIdNot(trimmedName, id)) {
                throw new AppException(ErrorCode.UNIT_TYPE_NAME_EXISTED);
            }
            unitType.setTypeName(trimmedName);
        }

        if (request.getDimensions() != null && !request.getDimensions().isBlank()) {
            unitType.setDimensions(request.getDimensions().trim());
        }

        if (request.getLengthM() != null) {
            unitType.setLengthM(request.getLengthM());
        }
        if (request.getWidthM() != null) {
            unitType.setWidthM(request.getWidthM());
        }
        if (request.getHeightM() != null) {
            unitType.setHeightM(request.getHeightM());
        }

        // Standardize area & volume calculation: area = length * width; volume = length * width * height
        if (unitType.getLengthM() != null && unitType.getWidthM() != null) {
            unitType.setAreaSqm(Math.round(unitType.getLengthM() * unitType.getWidthM() * 100.0) / 100.0);
        } else if (request.getAreaSqm() != null) {
            unitType.setAreaSqm(request.getAreaSqm());
        }

        if (unitType.getLengthM() != null && unitType.getWidthM() != null && unitType.getHeightM() != null) {
            unitType.setVolumeM3(Math.round(unitType.getLengthM() * unitType.getWidthM() * unitType.getHeightM() * 100.0) / 100.0);
            if (request.getDimensions() == null || request.getDimensions().isBlank()) {
                unitType.setDimensions(String.format(java.util.Locale.US, "%.1fm x %.1fm x %.1fm", unitType.getLengthM(), unitType.getWidthM(), unitType.getHeightM()));
            }
        } else if (request.getVolumeM3() != null) {
            unitType.setVolumeM3(request.getVolumeM3());
        }

        if (request.getCapacityBoxes() != null) {
            unitType.setCapacityBoxes(request.getCapacityBoxes());
        }

        if (request.getIsActive() != null) {
            unitType.setIsActive(request.getIsActive());
        }

        if (request.getLengthM() != null && request.getWidthM() != null && request.getHeightM() != null) {
            unitType.setDimensions(String.format(java.util.Locale.US, "%.1fm x %.1fm x %.1fm", request.getLengthM(), request.getWidthM(), request.getHeightM()));
            if (request.getAreaSqm() == null) {
                unitType.setAreaSqm(Math.round(request.getLengthM() * request.getWidthM() * 100.0) / 100.0);
            }
            if (request.getVolumeM3() == null) {
                unitType.setVolumeM3(Math.round(request.getLengthM() * request.getWidthM() * request.getHeightM() * 10.0) / 10.0);
            }
        }

        if (request.getDepositAmount() != null) {
            unitType.setDepositAmount(request.getDepositAmount());
        }

        if (request.getImageUrl() != null) {
            unitType.setImageUrl(request.getImageUrl().trim().isEmpty() ? null : request.getImageUrl().trim());
        }

        if (request.getAcPricePerMonth() != null) {
            if (request.getAcPricePerMonth().compareTo(BigDecimal.ZERO) > 0) {
                unitType.setAcPricePerMonth(request.getAcPricePerMonth());
            } else {
                unitType.setAcPricePerMonth(null);
            }
        }

        // BR-RULE-011: Nếu có cập nhật basePricePerMonth, lưu vào lịch sử giá
        if (request.getBasePricePerMonth() != null) {
            BigDecimal oldPrice = unitType.getBasePricePerMonth();
            if (oldPrice == null || oldPrice.compareTo(request.getBasePricePerMonth()) != 0) {
                String reason = request.getPriceChangeReason() != null && !request.getPriceChangeReason().isBlank()
                        ? request.getPriceChangeReason().trim()
                        : "Cập nhật đơn giá niêm yết khi chỉnh sửa thông tin loại kho";

                if (storageUnitPriceHistoryService != null) {
                    storageUnitPriceHistoryService.adjustUnitTypePrice(id, StorageUnitPriceAdjustmentRequest.builder()
                            .newPrice(request.getBasePricePerMonth())
                            .reason(reason)
                            .effectiveFrom(LocalDateTime.now())
                            .build());
                }
            }
            unitType.setBasePricePerMonth(request.getBasePricePerMonth());
        }

        UnitType updated = unitTypeRepository.save(unitType);
        long activeUnitsCount = storageUnitRepository.countByUnitType_Id(id);

        activityLogService.record(
                ActivityAction.UNIT_TYPE_UPDATE,
                "UnitType",
                updated.getId(),
                "Cập nhật danh mục loại kho: " + updated.getTypeName(),
                null,
                updated.getId().toString()
        );

        return unitTypeMapper.toResponse(updated, activeUnitsCount);
    }

    @Override
    public UnitTypeResponse adjustPrice(UUID id, UnitTypePriceAdjustmentRequest request) {
        log.info("Adjusting price for unit type id={} under BR-RULE-011", id);

        UnitType unitType = unitTypeRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.UNIT_TYPE_NOT_FOUND));

        // Gọi service điều chỉnh giá chuẩn BR-RULE-011
        storageUnitPriceHistoryService.adjustUnitTypePrice(id, StorageUnitPriceAdjustmentRequest.builder()
                .newPrice(request.getNewPrice())
                .reason(request.getReason())
                .effectiveFrom(request.getEffectiveFrom())
                .build());

        // Nếu bật cascadeToAvailableUnits, cập nhật giá cho các kho đang AVAILABLE thuộc loại này
        if (Boolean.TRUE.equals(request.getCascadeToAvailableUnits())) {
            List<StorageUnit> units = storageUnitRepository.findByUnitType_Id(id);
            for (StorageUnit unit : units) {
                if (unit.getStatus() == UnitStatus.AVAILABLE) {
                    unit.setPricePerMonth(request.getNewPrice());
                    storageUnitRepository.save(unit);
                }
            }
            log.info("Cascaded new price {} to available storage units of unit type {}", request.getNewPrice(), id);
        }

        if (request.getNewAcPrice() != null && request.getNewAcPrice().compareTo(BigDecimal.ZERO) > 0) {
            unitType.setAcPricePerMonth(request.getNewAcPrice());
            unitTypeRepository.save(unitType);
        }

        UnitType reloaded = unitTypeRepository.findById(id).orElse(unitType);
        long activeUnitsCount = storageUnitRepository.countByUnitType_Id(id);

        return unitTypeMapper.toResponse(reloaded, activeUnitsCount);
    }

    @Override
    public void deleteUnitType(UUID id) {
        log.info("Deleting unit type id={}", id);

        UnitType unitType = unitTypeRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.UNIT_TYPE_NOT_FOUND));

        // Kiểm tra xem có kho nào đang thuộc loại kho này không
        if (storageUnitRepository.existsByUnitType_Id(id)) {
            throw new AppException(ErrorCode.UNIT_TYPE_IN_USE);
        }

        unitTypeRepository.delete(unitType);

        activityLogService.record(
                ActivityAction.UNIT_TYPE_DELETE,
                "UnitType",
                id,
                "Xóa danh mục loại kho: " + unitType.getTypeName(),
                id.toString(),
                null
        );
    }

    @Override
    @Transactional(readOnly = true)
    public UnitTypeResponse getById(UUID id) {
        UnitType unitType = unitTypeRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.UNIT_TYPE_NOT_FOUND));

        long count = storageUnitRepository.countByUnitType_Id(id);
        return unitTypeMapper.toResponse(unitType, count);
    }

    @Override
    @Transactional(readOnly = true)
    public List<UnitTypeResponse> getAll() {
        List<UnitType> list = unitTypeRepository.findAllByOrderByCreatedAtAsc();
        return list.stream()
                .map(ut -> {
                    long count = storageUnitRepository.countByUnitType_Id(ut.getId());
                    return unitTypeMapper.toResponse(ut, count);
                })
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<StorageUnitPriceHistoryResponse> getPriceHistory(UUID id) {
        return storageUnitPriceHistoryService.getPriceHistoryByUnitType(id);
    }
}

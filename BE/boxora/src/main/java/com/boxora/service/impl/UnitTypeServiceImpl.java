package com.boxora.service.impl;

import com.boxora.dto.request.UnitTypeCreateRequest;
import com.boxora.dto.request.UnitTypeUpdateRequest;
import com.boxora.dto.response.PriceHistoryResponse;
import com.boxora.dto.response.UnitTypeResponse;
import com.boxora.entity.StorageUnitPriceHistory;
import com.boxora.entity.UnitType;
import com.boxora.entity.User;
import com.boxora.enums.ActivityAction;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.repository.StorageUnitPriceHistoryRepository;
import com.boxora.repository.StorageUnitRepository;
import com.boxora.repository.UnitTypeRepository;
import com.boxora.repository.UserRepository;
import com.boxora.service.ActivityLogService;
import com.boxora.service.UnitTypeService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class UnitTypeServiceImpl implements UnitTypeService {

    private final UnitTypeRepository unitTypeRepository;
    private final StorageUnitPriceHistoryRepository priceHistoryRepository;
    private final StorageUnitRepository storageUnitRepository;
    private final UserRepository userRepository;
    private final ActivityLogService activityLogService;

    @Override
    @Transactional(readOnly = true)
    public List<UnitTypeResponse> getAllUnitTypes() {
        return unitTypeRepository.findAll().stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public UnitTypeResponse getUnitTypeById(UUID id) {
        UnitType unitType = unitTypeRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.UNIT_TYPE_NOT_FOUND));
        return mapToResponse(unitType);
    }

    @Override
    public UnitTypeResponse createUnitType(UnitTypeCreateRequest request, String currentUserEmail) {
        User currentUser = findUserByEmail(currentUserEmail);

        UnitType unitType = UnitType.builder()
                .typeName(request.getTypeName())
                .dimensions(request.getDimensions())
                .areaSqm(request.getAreaSqm())
                .basePricePerMonth(request.getBasePricePerMonth())
                .depositAmount(request.getDepositAmount())
                .build();

        UnitType saved = unitTypeRepository.save(unitType);

        // Record initial price entry in StorageUnitPriceHistory (BR-RULE-011)
        StorageUnitPriceHistory initialHistory = StorageUnitPriceHistory.builder()
                .unitType(saved)
                .oldPrice(saved.getBasePricePerMonth())
                .newPrice(saved.getBasePricePerMonth())
                .effectiveFrom(LocalDateTime.now())
                .effectiveTo(null)
                .reason("Thiết lập biểu giá cơ sở ban đầu (BR-RULE-011)")
                .changedBy(currentUser)
                .build();
        priceHistoryRepository.save(initialHistory);

        if (currentUser != null) {
            activityLogService.recordForUser(
                    currentUser.getId(),
                    ActivityAction.UNIT_TYPE_CREATE,
                    "UnitType",
                    saved.getId(),
                    "Tạo loại kho mới: " + saved.getTypeName() + " với giá " + saved.getBasePricePerMonth() + " VNĐ/tháng",
                    null,
                    saved.getBasePricePerMonth()
            );
        }

        log.info("Created unit type: {} with initial price {}", saved.getTypeName(), saved.getBasePricePerMonth());
        return mapToResponse(saved);
    }

    @Override
    public UnitTypeResponse updateUnitType(UUID id, UnitTypeUpdateRequest request, String currentUserEmail) {
        UnitType unitType = unitTypeRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.UNIT_TYPE_NOT_FOUND));

        User currentUser = findUserByEmail(currentUserEmail);
        BigDecimal oldPrice = unitType.getBasePricePerMonth();

        if (request.getTypeName() != null && !request.getTypeName().isBlank()) {
            unitType.setTypeName(request.getTypeName());
        }
        if (request.getDimensions() != null && !request.getDimensions().isBlank()) {
            unitType.setDimensions(request.getDimensions());
        }
        if (request.getAreaSqm() != null && request.getAreaSqm() > 0) {
            unitType.setAreaSqm(request.getAreaSqm());
        }
        if (request.getDepositAmount() != null && request.getDepositAmount().compareTo(BigDecimal.ZERO) >= 0) {
            unitType.setDepositAmount(request.getDepositAmount());
        }

        // =====================================================================
        // BR-RULE-011: STORAGE UNIT PRICE ADJUSTMENT & AUDIT TRAIL PRESERVATION
        // 1. Changes in unit type base price do not affect existing active contracts.
        // 2. The previous active price record is closed (effectiveTo = now).
        // 3. A new price history record is created with effectiveFrom = now and effectiveTo = null.
        // 4. Audit trail is permanently recorded.
        // =====================================================================
        if (request.getBasePricePerMonth() != null &&
                request.getBasePricePerMonth().compareTo(BigDecimal.ZERO) > 0 &&
                request.getBasePricePerMonth().compareTo(oldPrice) != 0) {

            LocalDateTime now = LocalDateTime.now();

            // Close previously active price history
            priceHistoryRepository.findFirstByUnitType_IdAndEffectiveToIsNullOrderByEffectiveFromDesc(unitType.getId())
                    .ifPresent(prevHistory -> {
                        prevHistory.setEffectiveTo(now);
                        priceHistoryRepository.save(prevHistory);
                    });

            String reason = (request.getChangeReason() != null && !request.getChangeReason().isBlank())
                    ? request.getChangeReason()
                    : "Điều chỉnh biểu giá cơ sở theo quyết định quản lý (BR-RULE-011)";

            // Open new price history record
            StorageUnitPriceHistory newHistory = StorageUnitPriceHistory.builder()
                    .unitType(unitType)
                    .oldPrice(oldPrice)
                    .newPrice(request.getBasePricePerMonth())
                    .effectiveFrom(now)
                    .effectiveTo(null)
                    .reason(reason)
                    .changedBy(currentUser)
                    .build();
            priceHistoryRepository.save(newHistory);

            unitType.setBasePricePerMonth(request.getBasePricePerMonth());

            if (currentUser != null) {
                activityLogService.recordForUser(
                        currentUser.getId(),
                        ActivityAction.PRICE_UPDATE,
                        "UnitType",
                        unitType.getId(),
                        String.format("BR-RULE-011: Điều chỉnh giá loại kho [%s] từ %s sang %s. Lý do: %s",
                                unitType.getTypeName(), oldPrice, request.getBasePricePerMonth(), reason),
                        oldPrice,
                        request.getBasePricePerMonth()
                );
            }

            log.info("BR-RULE-011: Adjusted price for UnitType {} from {} to {}",
                    unitType.getTypeName(), oldPrice, request.getBasePricePerMonth());
        }

        UnitType updated = unitTypeRepository.save(unitType);
        return mapToResponse(updated);
    }

    @Override
    public void deleteUnitType(UUID id) {
        UnitType unitType = unitTypeRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.UNIT_TYPE_NOT_FOUND));

        if (storageUnitRepository.existsByUnitType_Id(id)) {
            throw new AppException(ErrorCode.STORAGE_UNIT_IN_USE);
        }

        unitTypeRepository.delete(unitType);
        log.info("Deleted unit type: {}", unitType.getTypeName());
    }

    @Override
    @Transactional(readOnly = true)
    public List<PriceHistoryResponse> getPriceHistoriesByUnitType(UUID unitTypeId) {
        if (!unitTypeRepository.existsById(unitTypeId)) {
            throw new AppException(ErrorCode.UNIT_TYPE_NOT_FOUND);
        }
        return priceHistoryRepository.findByUnitType_IdOrderByEffectiveFromDesc(unitTypeId).stream()
                .map(this::mapToPriceHistoryResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<PriceHistoryResponse> getAllPriceHistories() {
        return priceHistoryRepository.findAllByOrderByEffectiveFromDesc().stream()
                .map(this::mapToPriceHistoryResponse)
                .collect(Collectors.toList());
    }

    private User findUserByEmail(String email) {
        if (email == null) return null;
        return userRepository.findByEmail(email).orElse(null);
    }

    private UnitTypeResponse mapToResponse(UnitType ut) {
        return UnitTypeResponse.builder()
                .id(ut.getId())
                .typeName(ut.getTypeName())
                .dimensions(ut.getDimensions())
                .areaSqm(ut.getAreaSqm())
                .basePricePerMonth(ut.getBasePricePerMonth())
                .depositAmount(ut.getDepositAmount())
                .createdAt(ut.getCreatedAt())
                .updatedAt(ut.getUpdatedAt())
                .build();
    }

    private PriceHistoryResponse mapToPriceHistoryResponse(StorageUnitPriceHistory h) {
        return PriceHistoryResponse.builder()
                .id(h.getId())
                .unitTypeId(h.getUnitType() != null ? h.getUnitType().getId() : null)
                .unitTypeName(h.getUnitType() != null ? h.getUnitType().getTypeName() : null)
                .oldPrice(h.getOldPrice())
                .newPrice(h.getNewPrice())
                .effectiveFrom(h.getEffectiveFrom())
                .effectiveTo(h.getEffectiveTo())
                .reason(h.getReason())
                .changedById(h.getChangedBy() != null ? h.getChangedBy().getId() : null)
                .changedByName(h.getChangedBy() != null ? h.getChangedBy().getFullName() : "Hệ thống")
                .createdAt(h.getCreatedAt())
                .build();
    }
}

package com.boxora.service.impl;

import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.StorageUnitPriceAdjustmentRequest;
import com.boxora.dto.response.StorageUnitPriceHistoryResponse;
import com.boxora.entity.StorageUnit;
import com.boxora.entity.StorageUnitPriceHistory;
import com.boxora.entity.UnitType;
import com.boxora.entity.User;
import com.boxora.enums.ActivityAction;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.mapper.StorageUnitPriceHistoryMapper;
import com.boxora.repository.StorageUnitPriceHistoryRepository;
import com.boxora.repository.StorageUnitRepository;
import com.boxora.repository.UnitTypeRepository;
import com.boxora.repository.UserRepository;
import com.boxora.security.FacilityAccessGuard;
import com.boxora.security.RequestContext;
import com.boxora.service.ActivityLogService;
import com.boxora.service.StorageUnitPriceHistoryService;
import com.boxora.util.VndFormat;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class StorageUnitPriceHistoryServiceImpl implements StorageUnitPriceHistoryService {

    private static final Set<String> ALLOWED_PRICE_ROLES = Set.of("ADMIN", "BUSINESS_MANAGER", "FACILITY_MANAGER");
    private static final Set<String> SYSTEM_WIDE_PRICE_ROLES = Set.of("ADMIN", "BUSINESS_MANAGER");

    private final StorageUnitPriceHistoryRepository storageUnitPriceHistoryRepository;
    private final StorageUnitRepository storageUnitRepository;
    private final UnitTypeRepository unitTypeRepository;
    private final UserRepository userRepository;
    private final StorageUnitPriceHistoryMapper storageUnitPriceHistoryMapper;
    private final ActivityLogService activityLogService;
    private final FacilityAccessGuard facilityAccessGuard;
    private final RequestContext requestContext;

    /**
     * Nghiệp vụ BR-RULE-011:
     * Quy tắc điều chỉnh giá kho lưu trữ và bảo lưu giá hợp đồng đang hiệu lực.
     */
    @Override
    public StorageUnitPriceHistoryResponse adjustUnitPrice(UUID unitId, StorageUnitPriceAdjustmentRequest request) {
        StorageUnit unit = storageUnitRepository.findWithDetailsById(unitId)
                .orElseThrow(() -> new AppException(ErrorCode.STORAGE_UNIT_NOT_FOUND));

        // 1. Phân quyền và kiểm tra phạm vi cơ sở (BR-RULE-011.3)
        facilityAccessGuard.checkFacilityAccess(unit.getFacility().getId());

        String currentUserRole = requestContext.currentUserRole();
        if (currentUserRole != null && !ALLOWED_PRICE_ROLES.contains(currentUserRole)) {
            log.warn("User role {} is not authorized to adjust price under BR-RULE-011", currentUserRole);
            throw new AppException(ErrorCode.FORBIDDEN);
        }

        UUID currentUserId = requestContext.currentUserId();
        User currentUser = null;
        if (currentUserId != null) {
            currentUser = userRepository.findById(currentUserId).orElse(null);
        }
        if (currentUser == null) {
            // Trường hợp chạy từ background hoặc fallback tìm admin/manager
            currentUser = userRepository.findAll().stream()
                    .filter(u -> u.getRole() != null && ALLOWED_PRICE_ROLES.contains(u.getRole().getName()))
                    .findFirst()
                    .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        }

        // 2. Thẩm định quy tắc giá (BR-RULE-011.4)
        BigDecimal newPrice = request.getNewPrice();
        if (newPrice == null || newPrice.compareTo(BigDecimal.ZERO) <= 0) {
            throw new AppException(ErrorCode.PRICE_MUST_BE_GREATER_THAN_ZERO);
        }

        String reason = request.getReason();
        if (reason == null || reason.trim().isBlank()) {
            throw new AppException(ErrorCode.PRICE_ADJUSTMENT_REASON_REQUIRED);
        }

        BigDecimal currentPrice = unit.getEffectiveBasePrice();
        if (currentPrice != null && currentPrice.compareTo(newPrice) == 0) {
            throw new AppException(ErrorCode.PRICE_UNCHANGED);
        }

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime effectiveFrom = request.getEffectiveFrom() != null ? request.getEffectiveFrom() : now;
        if (effectiveFrom.isBefore(now.minusDays(1))) {
            throw new AppException(ErrorCode.PRICE_EFFECTIVE_DATE_INVALID);
        }

        // 3. Ghi nhận lịch sử bất biến (BR-RULE-011.1)
        StorageUnitPriceHistory history = StorageUnitPriceHistory.builder()
                .storageUnit(unit)
                .unitType(unit.getUnitType())
                .oldPrice(currentPrice)
                .newPrice(newPrice)
                .effectiveFrom(effectiveFrom)
                .reason(reason.trim())
                .changedBy(currentUser)
                .build();

        StorageUnitPriceHistory savedHistory = storageUnitPriceHistoryRepository.save(history);

        // 4. Cập nhật đơn giá mới cho kho lưu trữ
        unit.setPricePerMonth(newPrice);
        storageUnitRepository.save(unit);

        // 5. Ghi nhật ký kiểm toán hệ thống
        activityLogService.record(
                unit.getFacility().getId(),
                ActivityAction.PRICE_UPDATE,
                "StorageUnit",
                unit.getId(),
                String.format("Điều chỉnh đơn giá kho %s từ %s thành %s. Lý do: %s",
                        unit.getUnitCode(), VndFormat.format(currentPrice), VndFormat.format(newPrice), reason.trim()),
                currentPrice,
                newPrice
        );

        log.info("[BR-RULE-011] Price updated for unit {} ({}) from {} to {} by user {}",
                unit.getUnitCode(), unit.getId(), currentPrice, newPrice, currentUser.getUsername());

        return storageUnitPriceHistoryMapper.toResponse(savedHistory);
    }

    /**
     * Nghiệp vụ BR-RULE-011:
     * Điều chỉnh giá niêm yết theo Loại kho (UnitType).
     */
    @Override
    public StorageUnitPriceHistoryResponse adjustUnitTypePrice(UUID unitTypeId, StorageUnitPriceAdjustmentRequest request) {
        UnitType unitType = unitTypeRepository.findById(unitTypeId)
                .orElseThrow(() -> new AppException(ErrorCode.UNIT_TYPE_NOT_FOUND));

        String currentUserRole = requestContext.currentUserRole();
        if (currentUserRole != null && !SYSTEM_WIDE_PRICE_ROLES.contains(currentUserRole)) {
            log.warn("User role {} is not authorized to adjust unit type price", currentUserRole);
            throw new AppException(ErrorCode.FORBIDDEN);
        }

        UUID currentUserId = requestContext.currentUserId();
        User currentUser = null;
        if (currentUserId != null) {
            currentUser = userRepository.findById(currentUserId).orElse(null);
        }
        if (currentUser == null) {
            currentUser = userRepository.findAll().stream()
                    .filter(u -> u.getRole() != null && SYSTEM_WIDE_PRICE_ROLES.contains(u.getRole().getName()))
                    .findFirst()
                    .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        }

        BigDecimal newPrice = request.getNewPrice();
        if (newPrice == null || newPrice.compareTo(BigDecimal.ZERO) <= 0) {
            throw new AppException(ErrorCode.PRICE_MUST_BE_GREATER_THAN_ZERO);
        }

        String reason = request.getReason();
        if (reason == null || reason.trim().isBlank()) {
            throw new AppException(ErrorCode.PRICE_ADJUSTMENT_REASON_REQUIRED);
        }

        BigDecimal currentPrice = unitType.getBasePricePerMonth();
        if (currentPrice != null && currentPrice.compareTo(newPrice) == 0) {
            throw new AppException(ErrorCode.PRICE_UNCHANGED);
        }

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime effectiveFrom = request.getEffectiveFrom() != null ? request.getEffectiveFrom() : now;
        if (effectiveFrom.isBefore(now.minusDays(1))) {
            throw new AppException(ErrorCode.PRICE_EFFECTIVE_DATE_INVALID);
        }

        // Lưu lịch sử giá loại kho
        StorageUnitPriceHistory history = StorageUnitPriceHistory.builder()
                .storageUnit(null)
                .unitType(unitType)
                .oldPrice(currentPrice)
                .newPrice(newPrice)
                .effectiveFrom(effectiveFrom)
                .reason(reason.trim())
                .changedBy(currentUser)
                .build();

        StorageUnitPriceHistory savedHistory = storageUnitPriceHistoryRepository.save(history);

        // Cập nhật giá gốc loại kho
        unitType.setBasePricePerMonth(newPrice);
        unitTypeRepository.save(unitType);

        activityLogService.record(
                ActivityAction.PRICE_UPDATE,
                "UnitType",
                unitType.getId(),
                String.format("Điều chỉnh giá niêm yết loại kho %s từ %s thành %s. Lý do: %s",
                        unitType.getTypeName(), VndFormat.format(currentPrice), VndFormat.format(newPrice), reason.trim()),
                currentPrice,
                newPrice
        );

        log.info("[BR-RULE-011] Price updated for unit type {} ({}) from {} to {} by user {}",
                unitType.getTypeName(), unitType.getId(), currentPrice, newPrice, currentUser.getUsername());

        return storageUnitPriceHistoryMapper.toResponse(savedHistory);
    }

    @Override
    @Transactional(readOnly = true)
    public List<StorageUnitPriceHistoryResponse> getPriceHistoryByUnit(UUID unitId) {
        StorageUnit unit = storageUnitRepository.findWithDetailsById(unitId)
                .orElseThrow(() -> new AppException(ErrorCode.STORAGE_UNIT_NOT_FOUND));

        facilityAccessGuard.checkFacilityAccess(unit.getFacility().getId());

        List<StorageUnitPriceHistory> histories = storageUnitPriceHistoryRepository
                .findByStorageUnit_IdOrderByEffectiveFromDescCreatedAtDesc(unitId);

        return histories.stream()
                .map(storageUnitPriceHistoryMapper::toResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<StorageUnitPriceHistoryResponse> getPriceHistoryByUnitType(UUID unitTypeId) {
        if (!unitTypeRepository.existsById(unitTypeId)) {
            throw new AppException(ErrorCode.UNIT_TYPE_NOT_FOUND);
        }

        List<StorageUnitPriceHistory> histories = storageUnitPriceHistoryRepository
                .findByUnitType_IdOrderByEffectiveFromDescCreatedAtDesc(unitTypeId);

        return histories.stream()
                .map(storageUnitPriceHistoryMapper::toResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<StorageUnitPriceHistoryResponse> getAllPriceHistories(
            UUID facilityId, UUID unitId, UUID unitTypeId, int page, int size, String sortBy, String sortDir
    ) {
        UUID scopedFacilityId = facilityAccessGuard.isFacilityScoped()
                ? facilityAccessGuard.scopedFacilityIdOrNull()
                : facilityId;

        Sort sort = sortDir.equalsIgnoreCase("asc")
                ? Sort.by(sortBy).ascending()
                : Sort.by(sortBy).descending();

        Pageable pageable = PageRequest.of(page, size, sort);

        Page<StorageUnitPriceHistoryResponse> resultPage = storageUnitPriceHistoryRepository
                .findAllWithFilters(scopedFacilityId, unitId, unitTypeId, pageable)
                .map(storageUnitPriceHistoryMapper::toResponse);

        return PageResponse.from(resultPage);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<StorageUnitPriceHistoryResponse> getAllPriceHistories(
            UUID facilityId, UUID unitId, int page, int size, String sortBy, String sortDir
    ) {
        return getAllPriceHistories(facilityId, unitId, null, page, size, sortBy, sortDir);
    }

    @Override
    @Transactional(readOnly = true)
    public BigDecimal getEffectivePrice(UUID unitId, LocalDateTime targetTime) {
        if (targetTime == null) {
            targetTime = LocalDateTime.now();
        }

        List<StorageUnitPriceHistory> histories = storageUnitPriceHistoryRepository
                .findEffectivePriceHistory(unitId, targetTime);

        if (!histories.isEmpty()) {
            return histories.get(0).getNewPrice();
        }

        StorageUnit unit = storageUnitRepository.findById(unitId).orElse(null);
        if (unit != null) {
            return unit.getEffectiveBasePrice();
        }
        return null;
    }

    @Override
    public void recordInitialPrice(StorageUnit unit, BigDecimal price, User changedBy) {
        if (unit == null || price == null) {
            return;
        }

        if (changedBy == null) {
            changedBy = userRepository.findAll().stream().findFirst().orElse(null);
        }
        if (changedBy == null) {
            return;
        }

        StorageUnitPriceHistory initialHistory = StorageUnitPriceHistory.builder()
                .storageUnit(unit)
                .unitType(unit.getUnitType())
                .oldPrice(null)
                .newPrice(price)
                .effectiveFrom(LocalDateTime.now())
                .reason("Khởi tạo giá ban đầu cho kho lưu trữ mới")
                .changedBy(changedBy)
                .build();

        storageUnitPriceHistoryRepository.save(initialHistory);
    }

    @Override
    public void recordInitialUnitTypePrice(UnitType unitType, BigDecimal price, User changedBy) {
        if (unitType == null || price == null) {
            return;
        }

        if (changedBy == null) {
            changedBy = userRepository.findAll().stream().findFirst().orElse(null);
        }
        if (changedBy == null) {
            return;
        }

        StorageUnitPriceHistory initialHistory = StorageUnitPriceHistory.builder()
                .storageUnit(null)
                .unitType(unitType)
                .oldPrice(null)
                .newPrice(price)
                .effectiveFrom(LocalDateTime.now())
                .reason("Khởi tạo giá niêm yết ban đầu cho loại kho " + unitType.getTypeName())
                .changedBy(changedBy)
                .build();

        storageUnitPriceHistoryRepository.save(initialHistory);
    }
}

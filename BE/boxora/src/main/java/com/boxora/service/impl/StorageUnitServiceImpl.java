package com.boxora.service.impl;

import com.boxora.dto.request.StorageUnitCreateRequest;
import com.boxora.dto.request.StorageUnitUpdateRequest;
import com.boxora.dto.request.ToggleMaintenanceRequest;
import com.boxora.dto.response.StorageUnitResponse;
import com.boxora.entity.Facility;
import com.boxora.entity.FacilityPolicy;
import com.boxora.entity.StorageUnit;
import com.boxora.entity.UnitType;
import com.boxora.enums.ActivityAction;
import com.boxora.enums.UnitStatus;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.repository.BookingRepository;
import com.boxora.repository.FacilityRepository;
import com.boxora.repository.FacilityPolicyRepository;
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
import java.util.Map;
import java.util.List;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@Slf4j
@Transactional
public class StorageUnitServiceImpl implements StorageUnitService {

    private final StorageUnitRepository storageUnitRepository;
    private final FacilityRepository facilityRepository;
    private final FacilityPolicyRepository facilityPolicyRepository;
    private final UnitTypeRepository unitTypeRepository;
    private final BookingRepository bookingRepository;
    private final RentalContractRepository rentalContractRepository;
    private final FacilityAccessGuard facilityAccessGuard;
    private final com.boxora.service.StorageUnitPriceHistoryService storageUnitPriceHistoryService;
    private final ActivityLogService activityLogService;

    public StorageUnitServiceImpl(
            StorageUnitRepository storageUnitRepository,
            FacilityRepository facilityRepository,
            FacilityPolicyRepository facilityPolicyRepository,
            UnitTypeRepository unitTypeRepository,
            BookingRepository bookingRepository,
            RentalContractRepository rentalContractRepository,
            FacilityAccessGuard facilityAccessGuard,
            com.boxora.service.StorageUnitPriceHistoryService storageUnitPriceHistoryService,
            ActivityLogService activityLogService
    ) {
        this.storageUnitRepository = storageUnitRepository;
        this.facilityRepository = facilityRepository;
        this.facilityPolicyRepository = facilityPolicyRepository;
        this.unitTypeRepository = unitTypeRepository;
        this.bookingRepository = bookingRepository;
        this.rentalContractRepository = rentalContractRepository;
        this.facilityAccessGuard = facilityAccessGuard;
        this.storageUnitPriceHistoryService = storageUnitPriceHistoryService;
        this.activityLogService = activityLogService;
    }

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

        Map<UUID, FacilityPolicy> activePolicies = facilityPolicyRepository.findByIsActiveTrue().stream()
                .collect(Collectors.toMap(policy -> policy.getFacility().getId(), Function.identity()));
        return units.stream()
                .map(unit -> mapToResponse(unit, activePolicies.get(unit.getFacility().getId())))
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public StorageUnitResponse getById(UUID id) {
        StorageUnit unit = storageUnitRepository.findWithDetailsById(id)
                .orElseThrow(() -> new AppException(ErrorCode.STORAGE_UNIT_NOT_FOUND));

        if (unit.getFacility() != null) {
            facilityAccessGuard.checkFacilityAccess(unit.getFacility().getId());
        }

        FacilityPolicy activePolicy = unit.getFacility() == null
                ? null
                : facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(unit.getFacility().getId()).orElse(null);
        return mapToResponse(unit, activePolicy);
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
                .imageUrl(request.getImageUrl() != null && !request.getImageUrl().isBlank() ? request.getImageUrl().trim() : null)
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

        // Không cho phép đổi mã kho hoặc loại kho nếu kho đang trong hợp đồng thuê hoặc giữ chỗ
        if ((unit.getStatus() == UnitStatus.OCCUPIED || unit.getStatus() == UnitStatus.RESERVED)
                && (!unit.getUnitCode().equals(trimmedCode) || (request.getUnitTypeId() != null && !unit.getUnitType().getId().equals(request.getUnitTypeId())))) {
            throw new AppException(ErrorCode.STORAGE_UNIT_IN_USE);
        }

        UnitType unitType = unitTypeRepository.findById(request.getUnitTypeId())
                .orElseThrow(() -> new AppException(ErrorCode.UNIT_TYPE_NOT_FOUND));

        unit.setUnitCode(trimmedCode);
        unit.setFloorLevel(request.getFloorLevel().trim());
        unit.setUnitType(unitType);
        if (request.getImageUrl() != null) {
            unit.setImageUrl(request.getImageUrl().trim().isEmpty() ? null : request.getImageUrl().trim());
        }

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
                String.format("Cập nhật ngăn kho %s (tầng: %s, loại: %s)", unit.getUnitCode(), unit.getFloorLevel(), unitType.getTypeName()),
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
        return toggleMaintenance(id, null);
    }

    @Override
    public StorageUnitResponse toggleMaintenance(UUID id, ToggleMaintenanceRequest request) {
        StorageUnit unit = storageUnitRepository.findWithDetailsByIdForUpdate(id)
                .orElseThrow(() -> new AppException(ErrorCode.STORAGE_UNIT_NOT_FOUND));

        facilityAccessGuard.checkFacilityAccess(unit.getFacility().getId());

        // Quy tắc nghiệp vụ: Chỉ có thể chuyển trạng thái khi kho đang AVAILABLE hoặc UNDER_MAINTENANCE
        if (unit.getStatus() != UnitStatus.AVAILABLE && unit.getStatus() != UnitStatus.UNDER_MAINTENANCE) {
            throw new AppException(ErrorCode.STORAGE_UNIT_CANNOT_MAINTAIN);
        }

        UnitStatus oldStatus = unit.getStatus();
        if (unit.getStatus() == UnitStatus.AVAILABLE) {
            // Đảm bảo kho không có hợp đồng đang hiệu lực hoặc booking chờ bàn giao/xử lý
            boolean hasActiveContract = rentalContractRepository.existsByUnit_IdAndStatusIn(
                    unit.getId(), List.of(com.boxora.enums.RentalContractStatus.ACTIVE, com.boxora.enums.RentalContractStatus.PENDING_ACTIVATION)
            );
            boolean hasActiveBooking = bookingRepository.existsByStorageUnit_IdAndStatusIn(
                    unit.getId(), List.of(
                            com.boxora.enums.BookingStatus.CONFIRMED,
                            com.boxora.enums.BookingStatus.ACTIVE,
                            com.boxora.enums.BookingStatus.PENDING_PAYMENT,
                            com.boxora.enums.BookingStatus.CHECKOUT_REQUESTED,
                            com.boxora.enums.BookingStatus.INSPECTED
                    )
            );
            if (hasActiveContract || hasActiveBooking) {
                throw new AppException(ErrorCode.STORAGE_UNIT_IN_USE);
            }
            if ( request != null && (request.getReason() == null || request.getReason().trim().isEmpty()) ) {
                throw new IllegalArgumentException("Vui lòng nhập lý do bảo trì kỹ thuật.");
            }
            String reason = (request != null && request.getReason() != null && !request.getReason().trim().isEmpty())
                    ? request.getReason().trim()
                    : "Bảo trì kỹ thuật định kỳ";
            String maintenanceBy = (request != null && request.getMaintenanceBy() != null && !request.getMaintenanceBy().trim().isEmpty())
                    ? request.getMaintenanceBy().trim()
                    : (org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication() != null
                        ? org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getName()
                        : "Kỹ thuật viên cơ sở");
            unit.setStatus(UnitStatus.UNDER_MAINTENANCE);
            unit.setMaintenanceReason(reason);
            unit.setMaintenanceBy(maintenanceBy);
            unit.setMaintenanceAt(java.time.LocalDateTime.now());
        } else if (unit.getStatus() == UnitStatus.UNDER_MAINTENANCE) {
            // Tắt bảo trì: Phục hồi trạng thái thực tế dựa trên hợp đồng/booking, KHÔNG đưa kho đang thuê về AVAILABLE
            boolean hasActiveContract = rentalContractRepository.existsByUnit_IdAndStatusIn(
                    unit.getId(), List.of(com.boxora.enums.RentalContractStatus.ACTIVE)
            );
            boolean hasPendingContract = rentalContractRepository.existsByUnit_IdAndStatusIn(
                    unit.getId(), List.of(com.boxora.enums.RentalContractStatus.PENDING_ACTIVATION)
            );
            boolean hasReservedBooking = bookingRepository.existsByStorageUnit_IdAndStatusIn(
                    unit.getId(), List.of(com.boxora.enums.BookingStatus.CONFIRMED)
            );

            if (hasActiveContract) {
                unit.setStatus(UnitStatus.OCCUPIED);
            } else if (hasPendingContract || hasReservedBooking) {
                unit.setStatus(UnitStatus.RESERVED);
            } else {
                unit.setStatus(UnitStatus.AVAILABLE);
            unit.setMaintenanceReason(null);
            unit.setMaintenanceBy(null);
            unit.setMaintenanceAt(null);
            }
        }

        unit = storageUnitRepository.save(unit);

        activityLogService.record(
                unit.getFacility() != null ? unit.getFacility().getId() : null,
                ActivityAction.STORAGE_UNIT_STATUS_CHANGE,
                "StorageUnit",
                unit.getId(),
                unit.getStatus() == UnitStatus.UNDER_MAINTENANCE
                        ? String.format("Chuyển ngăn kho %s sang bảo trì kỹ thuật (Người phụ trách: %s | Lý do: %s)", unit.getUnitCode(), unit.getMaintenanceBy(), unit.getMaintenanceReason())
                        : String.format("Hoàn tất bảo trì ngăn kho %s, chuyển từ %s sang %s", unit.getUnitCode(), oldStatus, unit.getStatus()),
                oldStatus,
                unit.getStatus()
        );

        return mapToResponse(unit);
    }

    private StorageUnitResponse mapToResponse(StorageUnit u) {
        FacilityPolicy policy = (u.getFacility() != null && u.getFacility().getId() != null)
                ? facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(u.getFacility().getId()).orElse(null)
                : null;
        return mapToResponse(u, policy);
    }

    private StorageUnitResponse mapToResponse(StorageUnit u, FacilityPolicy activePolicy) {
        BigDecimal price = activePolicy == null || u.getUnitType() == null
                ? null
                : activePolicy.getPrices().stream()
                        .filter(policyPrice -> policyPrice.getUnitType().getId().equals(u.getUnitType().getId()))
                        .map(policyPrice -> policyPrice.getMonthlyPrice())
                        .findFirst()
                        .orElse(null);
        if (price == null) price = u.getEffectiveBasePrice();
        Double area = (u.getUnitType() != null) ? u.getUnitType().getAreaSqm() : null;

        UUID bookingId = null;
        String tenantName = null;
        String contractCode = null;
        UUID contractId = null;
        String startDate = null;
        String dueDate = null;

        if (u.getStatus() == UnitStatus.OCCUPIED || u.getStatus() == UnitStatus.OVERDUE_LOCKED || u.getStatus() == UnitStatus.RESERVED) {
            var optContract = rentalContractRepository.findFirstByUnit_IdOrderByCreatedAtDesc(u.getId());
            if (optContract.isPresent()) {
                var contract = optContract.get();
                contractId = contract.getId();
                contractCode = contract.getContractCode();
                if (contract.getCustomer() != null) {
                    tenantName = contract.getCustomer().getFullName() != null ? contract.getCustomer().getFullName() : contract.getCustomer().getUsername();
                }
                if (contract.getStartDate() != null) {
                    startDate = contract.getStartDate().toString();
                }
                if (contract.getEndDate() != null) {
                    dueDate = contract.getEndDate().toString();
                }
                if (contract.getBooking() != null) {
                    bookingId = contract.getBooking().getId();
                }
            }

            if (bookingId == null || tenantName == null || contractCode == null || startDate == null || dueDate == null) {
                var optBooking = bookingRepository.findFirstByStorageUnit_IdOrderByCreatedAtDesc(u.getId());
                if (optBooking.isPresent()) {
                    var booking = optBooking.get();
                    if (bookingId == null) {
                        bookingId = booking.getId();
                    }
                    if (tenantName == null && booking.getCustomer() != null) {
                        tenantName = booking.getCustomer().getFullName() != null ? booking.getCustomer().getFullName() : booking.getCustomer().getUsername();
                    }
                    if (contractCode == null) {
                        contractCode = booking.getBookingCode();
                    }
                    if (startDate == null && booking.getStartDate() != null) {
                        startDate = booking.getStartDate().toString();
                    }
                    if (dueDate == null && booking.getEndDate() != null) {
                        dueDate = booking.getEndDate().toString();
                    }
                }
            }
        }

        return StorageUnitResponse.builder()
                .id(u.getId())
                .unitCode(u.getUnitCode())
                .floorLevel(u.getFloorLevel())
                .status(u.getStatus() != null ? u.getStatus().name() : UnitStatus.AVAILABLE.name())
                .facilityId(u.getFacility() != null ? u.getFacility().getId() : null)
                .facilityName(u.getFacility() != null ? u.getFacility().getName() : null)
                .facilityStatus(u.getFacility() != null && u.getFacility().getStatus() != null ? u.getFacility().getStatus().name() : null)
                .unitTypeId(u.getUnitType() != null ? u.getUnitType().getId() : null)
                .unitTypeName(u.getUnitType() != null ? u.getUnitType().getTypeName() : null)
                .pricePerMonth(price)
                .depositAmount(u.getUnitType() != null ? u.getUnitType().getDepositAmount() : price)
                .areaSqMeters(area)
                .batteryLevel(null)
                .smartLockSerial(null)
                .lastAccessTime(null)
                .bookingId(bookingId)
                .tenantName(tenantName)
                .contractCode(contractCode)
                .contractId(contractId)
                .startDate(startDate)
                .dueDate(dueDate)
                .imageUrl(u.getImageUrl())
                .maintenanceReason(u.getMaintenanceReason())
                .maintenanceBy(u.getMaintenanceBy())
                .maintenanceAt(u.getMaintenanceAt() != null ? u.getMaintenanceAt().toString() : null)
                .build();
    }
}

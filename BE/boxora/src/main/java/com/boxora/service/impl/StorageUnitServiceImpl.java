package com.boxora.service.impl;

import com.boxora.dto.request.StorageUnitCreateRequest;
import com.boxora.dto.request.StorageUnitUpdateRequest;
import com.boxora.dto.response.StorageUnitResponse;
import com.boxora.entity.Booking;
import com.boxora.entity.Facility;
import com.boxora.entity.FacilityPolicy;
import com.boxora.entity.RentalContract;
import com.boxora.entity.StorageUnit;
import com.boxora.entity.UnitType;
import com.boxora.entity.User;
import com.boxora.enums.ActivityAction;
import com.boxora.enums.BookingStatus;
import com.boxora.enums.FacilityStatus;
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
import com.boxora.security.RequestContext;
import com.boxora.service.ActivityLogService;
import com.boxora.service.PricingRules;
import com.boxora.service.StorageUnitService;
import com.boxora.service.UnitAvailability;
import com.boxora.util.FloorLabels;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.Collections;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class StorageUnitServiceImpl implements StorageUnitService {

    /** Vai trò nội bộ được xem thông tin người thuê/hợp đồng của kho (trong phạm vi cơ sở của mình). */
    private static final Set<String> INTERNAL_ROLES =
            Set.of("ADMIN", "SYSTEM_ADMIN", "BUSINESS_MANAGER", "BUSINESS_OPERATIONS_MANAGER", "FACILITY_MANAGER", "STAFF");

    private static final Set<UnitStatus> TENANT_STATUSES =
            EnumSet.of(UnitStatus.RESERVED, UnitStatus.OCCUPIED, UnitStatus.OVERDUE_LOCKED);

    private static final int IN_CLAUSE_CHUNK = 1000;

    private final StorageUnitRepository storageUnitRepository;
    private final FacilityRepository facilityRepository;
    private final FacilityPolicyRepository facilityPolicyRepository;
    private final UnitTypeRepository unitTypeRepository;
    private final BookingRepository bookingRepository;
    private final RentalContractRepository rentalContractRepository;
    private final FacilityAccessGuard facilityAccessGuard;
    private final com.boxora.service.StorageUnitPriceHistoryService storageUnitPriceHistoryService;
    private final ActivityLogService activityLogService;
    private final RequestContext requestContext;

    /** Người thuê hiện tại của một kho: hợp đồng chưa kết thúc và/hoặc đặt kho chưa kết thúc. */
    private record Tenancy(RentalContract contract, Booking booking) {
    }

    @Override
    @Transactional(readOnly = true)
    public List<StorageUnitResponse> getUnits(UUID facilityId, String floorLevel, String status, boolean publicScope) {
        if (!publicScope && facilityAccessGuard.isFacilityScoped()) {
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

        // Tầng được so khớp theo khóa chuẩn hóa nên "Floor 1", "Tầng 1" và "tang 1" là cùng một tầng
        String floorKey = floorLevel != null && !floorLevel.isBlank() ? FloorLabels.key(floorLevel) : null;
        boolean internal = !publicScope && isInternalCaller();

        List<StorageUnit> candidates = facilityId != null
                ? storageUnitRepository.findByFacility_Id(facilityId)
                : storageUnitRepository.findAllWithDetails();
        // Khách vãng lai và khách hàng chỉ thấy kho của cơ sở đang hoạt động (cơ sở bảo trì/ngừng hoạt động không nhận đặt kho)
        candidates = candidates.stream()
                .filter(unit -> internal || (unit.getFacility() != null && unit.getFacility().getStatus() == FacilityStatus.ACTIVE))
                .filter(unit -> floorKey == null || floorKey.equals(FloorLabels.key(unit.getFloorLevel())))
                .toList();

        // Trạng thái hiệu lực: kho có đặt kho còn hiệu lực không bao giờ hiện là "Sẵn sàng" (xem UnitAvailability)
        Map<UUID, List<BookingStatus>> liveBookings = loadLiveBookings(candidates);
        Map<UUID, UnitStatus> effective = new HashMap<>();
        for (StorageUnit unit : candidates) {
            effective.put(unit.getId(), effectiveStatusOf(unit, liveBookings));
        }

        // Lọc trạng thái trên trạng thái hiệu lực; với khách, kho khóa do quá hạn hiển thị như kho đã thuê
        final UnitStatus requested = unitStatus;
        List<StorageUnit> units = candidates.stream()
                .filter(unit -> requested == null
                        || (internal
                        ? effective.get(unit.getId()) == requested
                        : publicStatusOf(effective.get(unit.getId())) == publicStatusOf(requested)))
                .toList();

        Map<UUID, FacilityPolicy> activePolicies = facilityPolicyRepository.findByIsActiveTrue().stream()
                .collect(Collectors.toMap(policy -> policy.getFacility().getId(), Function.identity(), (first, second) -> first));
        Map<UUID, Tenancy> tenancies = internal ? loadTenancies(units, effective) : Collections.emptyMap();
        return units.stream()
                .map(unit -> toResponse(unit, effective.get(unit.getId()), activePolicies.get(unit.getFacility().getId()), tenancies.get(unit.getId()), internal))
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

        boolean internal = isInternalCaller();
        FacilityPolicy activePolicy = activePolicyOf(unit);
        UnitStatus effective = effectiveStatusOf(unit, loadLiveBookings(List.of(unit)));
        Tenancy tenancy = internal ? loadTenancies(List.of(unit), Map.of(unit.getId(), effective)).get(unit.getId()) : null;
        return toResponse(unit, effective, activePolicy, tenancy, internal);
    }

    @Override
    public StorageUnitResponse createUnit(StorageUnitCreateRequest request) {
        facilityAccessGuard.checkFacilityAccess(request.getFacilityId());

        Facility facility = facilityRepository.findById(request.getFacilityId())
                .orElseThrow(() -> new AppException(ErrorCode.FACILITY_NOT_FOUND));

        UnitType unitType = unitTypeRepository.findById(request.getUnitTypeId())
                .orElseThrow(() -> new AppException(ErrorCode.UNIT_TYPE_NOT_FOUND));

        String trimmedCode = request.getUnitCode().trim();
        if (storageUnitRepository.existsByFacility_IdAndUnitCodeIgnoreCase(request.getFacilityId(), trimmedCode)) {
            throw new AppException(ErrorCode.STORAGE_UNIT_CODE_EXISTED);
        }

        BigDecimal initialPrice = request.getPricePerMonth() != null
                ? request.getPricePerMonth()
                : unitType.getBasePricePerMonth();

        StorageUnit unit = StorageUnit.builder()
                .unitCode(trimmedCode)
                .floorLevel(FloorLabels.normalize(request.getFloorLevel()))
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

        return toInternalResponse(unit);
    }

    @Override
    public StorageUnitResponse updateUnit(UUID id, StorageUnitUpdateRequest request) {
        StorageUnit unit = storageUnitRepository.findWithDetailsById(id)
                .orElseThrow(() -> new AppException(ErrorCode.STORAGE_UNIT_NOT_FOUND));

        facilityAccessGuard.checkFacilityAccess(unit.getFacility().getId());

        String trimmedCode = request.getUnitCode().trim();
        if (storageUnitRepository.existsByFacility_IdAndUnitCodeIgnoreCaseAndIdNot(unit.getFacility().getId(), trimmedCode, id)) {
            throw new AppException(ErrorCode.STORAGE_UNIT_CODE_EXISTED);
        }

        UnitType unitType = unitTypeRepository.findById(request.getUnitTypeId())
                .orElseThrow(() -> new AppException(ErrorCode.UNIT_TYPE_NOT_FOUND));

        unit.setUnitCode(trimmedCode);
        unit.setFloorLevel(FloorLabels.normalize(request.getFloorLevel()));
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
                String.format("Cập nhật ngăn kho %s (tầng: %s, loại: %s)", unit.getUnitCode(), unit.getFloorLevel(), unitType.getTypeName()),
                null,
                unit.getStatus()
        );

        return toInternalResponse(unit);
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

        // Quy tắc nghiệp vụ: Trước mắt chỉ duy nhất có thể chuyển từ trạng thái AVAILABLE sang UNDER_MAINTENANCE (hoặc từ UNDER_MAINTENANCE về AVAILABLE)
        if (unit.getStatus() != UnitStatus.AVAILABLE && unit.getStatus() != UnitStatus.UNDER_MAINTENANCE) {
            throw new AppException(ErrorCode.STORAGE_UNIT_CANNOT_MAINTAIN);
        }

        // Kho đang ghi "trống" nhưng đã có đặt kho còn hiệu lực thì không được chuyển sang bảo trì
        if (unit.getStatus() == UnitStatus.AVAILABLE
                && bookingRepository.existsByStorageUnit_IdAndStatusIn(id, UnitAvailability.LIVE_BOOKING_STATUSES)) {
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
                String.format("Chuyển trạng thái ngăn kho %s từ \"%s\" sang \"%s\"", unit.getUnitCode(), UnitAvailability.label(oldStatus), UnitAvailability.label(unit.getStatus())),
                oldStatus,
                unit.getStatus()
        );

        return toInternalResponse(unit);
    }

    // ------------------------------------------------------------------ mapping

    private boolean isInternalCaller() {
        String role = requestContext.currentUserRole();
        return role != null && INTERNAL_ROLES.contains(role);
    }

    private FacilityPolicy activePolicyOf(StorageUnit unit) {
        return (unit.getFacility() != null && unit.getFacility().getId() != null)
                ? facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(unit.getFacility().getId()).orElse(null)
                : null;
    }

    /** Phản hồi của các thao tác ghi (chỉ nhân viên nội bộ gọi được): đầy đủ thông tin thuê. */
    private StorageUnitResponse toInternalResponse(StorageUnit unit) {
        UnitStatus effective = effectiveStatusOf(unit, loadLiveBookings(List.of(unit)));
        return toResponse(unit, effective, activePolicyOf(unit), loadTenancies(List.of(unit), Map.of(unit.getId(), effective)).get(unit.getId()), true);
    }

    /** Trạng thái hiển thị công khai: kho bị khóa do quá hạn chỉ hiện là "đã có người thuê". */
    private static UnitStatus publicStatusOf(UnitStatus status) {
        return status == UnitStatus.OVERDUE_LOCKED ? UnitStatus.OCCUPIED : status;
    }

    /**
     * Tìm người thuê hiện tại của các kho đang được giữ chỗ hoặc thuê bằng 2 truy vấn cho cả danh sách (không N+1).
     * Chỉ lấy hợp đồng/đặt kho chưa kết thúc, nên kho vừa được đặt lại không hiện nhầm người thuê cũ.
     */
    private Map<UUID, Tenancy> loadTenancies(Collection<StorageUnit> units, Map<UUID, UnitStatus> effective) {
        List<UUID> unitIds = units.stream()
                .filter(unit -> TENANT_STATUSES.contains(effective.getOrDefault(unit.getId(), unit.getStatus())))
                .map(StorageUnit::getId)
                .toList();
        if (unitIds.isEmpty()) {
            return Collections.emptyMap();
        }

        Map<UUID, RentalContract> contracts = new HashMap<>();
        Map<UUID, Booking> bookings = new HashMap<>();
        for (int from = 0; from < unitIds.size(); from += IN_CLAUSE_CHUNK) {
            List<UUID> chunk = unitIds.subList(from, Math.min(from + IN_CLAUSE_CHUNK, unitIds.size()));
            // Kết quả đã sắp xếp mới nhất trước nên putIfAbsent giữ bản ghi mới nhất của mỗi kho
            for (RentalContract contract : rentalContractRepository.findCurrentTenancyByUnitIds(chunk)) {
                contracts.putIfAbsent(contract.getUnit().getId(), contract);
            }
            for (Booking booking : bookingRepository.findCurrentTenancyByUnitIds(chunk)) {
                bookings.putIfAbsent(booking.getStorageUnit().getId(), booking);
            }
        }

        Map<UUID, Tenancy> result = new HashMap<>();
        for (UUID unitId : unitIds) {
            RentalContract contract = contracts.get(unitId);
            Booking booking = bookings.get(unitId);
            if (contract != null || booking != null) {
                result.put(unitId, new Tenancy(contract, booking != null ? booking : (contract != null ? contract.getBooking() : null)));
            }
        }
        return result;
    }

    /** Đặt kho còn hiệu lực của các kho đang ghi "trống", bằng một truy vấn cho cả danh sách: unitId -> trạng thái các đặt kho. */
    private Map<UUID, List<BookingStatus>> loadLiveBookings(Collection<StorageUnit> units) {
        List<UUID> availableIds = units.stream()
                .filter(unit -> unit.getStatus() == UnitStatus.AVAILABLE)
                .map(StorageUnit::getId)
                .toList();
        if (availableIds.isEmpty()) {
            return Collections.emptyMap();
        }
        Map<UUID, List<BookingStatus>> live = new HashMap<>();
        for (int from = 0; from < availableIds.size(); from += IN_CLAUSE_CHUNK) {
            List<UUID> chunk = availableIds.subList(from, Math.min(from + IN_CLAUSE_CHUNK, availableIds.size()));
            for (Object[] row : bookingRepository.findLiveBookingStatusesByUnitIds(chunk)) {
                live.computeIfAbsent((UUID) row[0], key -> new java.util.ArrayList<>()).add((BookingStatus) row[1]);
            }
        }
        return live;
    }

    private static UnitStatus effectiveStatusOf(StorageUnit unit, Map<UUID, List<BookingStatus>> liveBookings) {
        return UnitAvailability.effectiveStatus(unit.getStatus(), liveBookings.get(unit.getId()));
    }

    private StorageUnitResponse toResponse(StorageUnit u, UnitStatus effectiveStatus, FacilityPolicy activePolicy, Tenancy tenancy, boolean internal) {
        // Cùng quy tắc giá với báo giá: giá riêng của cơ sở -> giá của kho -> giá niêm yết loại kho
        BigDecimal price = PricingRules.resolveMonthlyPrice(u, activePolicy);
        BigDecimal deposit = PricingRules.depositFor(price, activePolicy);
        Double area = (u.getUnitType() != null) ? u.getUnitType().getAreaSqm() : null;
        UnitStatus status = effectiveStatus != null ? effectiveStatus : UnitStatus.AVAILABLE;

        StorageUnitResponse.StorageUnitResponseBuilder builder = StorageUnitResponse.builder()
                .id(u.getId())
                .unitCode(u.getUnitCode())
                .floorLevel(FloorLabels.normalize(u.getFloorLevel()))
                .status((internal ? status : publicStatusOf(status)).name())
                .facilityId(u.getFacility() != null ? u.getFacility().getId() : null)
                .facilityName(u.getFacility() != null ? u.getFacility().getName() : null)
                .unitTypeId(u.getUnitType() != null ? u.getUnitType().getId() : null)
                .unitTypeName(u.getUnitType() != null ? u.getUnitType().getTypeName() : null)
                .pricePerMonth(price)
                .depositAmount(deposit)
                .areaSqMeters(area);

        if (internal && tenancy != null) {
            applyTenancy(builder, tenancy);
        }
        return builder.build();
    }

    private void applyTenancy(StorageUnitResponse.StorageUnitResponseBuilder builder, Tenancy tenancy) {
        RentalContract contract = tenancy.contract();
        Booking booking = tenancy.booking();

        User tenant = contract != null && contract.getCustomer() != null
                ? contract.getCustomer()
                : (booking != null ? booking.getCustomer() : null);
        if (tenant != null) {
            builder.tenantName(tenant.getFullName() != null ? tenant.getFullName() : tenant.getUsername());
        }
        if (contract != null) {
            builder.contractId(contract.getId())
                    .contractCode(contract.getContractCode());
        }
        if (booking != null) {
            builder.bookingId(booking.getId())
                    .bookingCode(booking.getBookingCode());
        }

        java.time.LocalDate start = contract != null && contract.getStartDate() != null
                ? contract.getStartDate()
                : (booking != null ? booking.getStartDate() : null);
        java.time.LocalDate end = contract != null && contract.getEndDate() != null
                ? contract.getEndDate()
                : (booking != null ? booking.getEndDate() : null);
        builder.startDate(start != null ? start.toString() : null)
                .dueDate(end != null ? end.toString() : null);
    }
}

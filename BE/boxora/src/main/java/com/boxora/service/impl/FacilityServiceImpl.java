package com.boxora.service.impl;

import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.FacilityCreateRequest;
import com.boxora.dto.request.FacilityUpdateRequest;
import com.boxora.dto.response.FacilityResponse;
import com.boxora.entity.Facility;
import com.boxora.entity.User;
import com.boxora.enums.FacilityStatus;
import com.boxora.enums.UnitStatus;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.mapper.FacilityMapper;
import com.boxora.repository.FacilityRepository;
import com.boxora.repository.StorageUnitRepository;
import com.boxora.repository.UserRepository;
import com.boxora.enums.ActivityAction;
import com.boxora.security.FacilityAccessGuard;
import com.boxora.security.RequestContext;
import com.boxora.service.ActivityLogService;
import com.boxora.service.FacilityService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Collection;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class FacilityServiceImpl implements FacilityService {

    private static final Set<String> SORTABLE_FIELDS =
            Set.of("name", "code", "city", "status", "createdAt", "updatedAt", "openTime", "closeTime");
    private static final int COORDINATE_SCALE = 7;
    /** Kho còn khách thuê hoặc đang giữ chỗ: cơ sở chứa các kho này chưa thể ngừng hoạt động. */
    private static final Set<UnitStatus> IN_USE_STATUSES = EnumSet.of(UnitStatus.RESERVED, UnitStatus.OCCUPIED, UnitStatus.OVERDUE_LOCKED);

    private final FacilityRepository facilityRepository;
    private final UserRepository userRepository;
    private final StorageUnitRepository storageUnitRepository;
    private final FacilityMapper facilityMapper;
    private final ActivityLogService activityLogService;
    private final FacilityAccessGuard facilityAccessGuard;
    private final RequestContext requestContext;

    @Override
    @Transactional(readOnly = true)
    public FacilityResponse getById(UUID id) {
        Facility facility = facilityRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.FACILITY_NOT_FOUND));
        boolean publicView = isPublicViewer();
        if (!publicView) {
            facilityAccessGuard.checkFacilityAccess(facility.getId());
        }
        return toResponse(facility, loadUnitCounts(List.of(facility.getId())), publicView);
    }

    @Override
    public FacilityResponse create(FacilityCreateRequest request) {
        validateCoordinates(request.getLatitude(), request.getLongitude());
        String name = request.getName().trim();
        String code = request.getCode().trim();
        if (facilityRepository.existsByCodeIgnoreCase(code)) {
            throw new AppException(ErrorCode.FACILITY_CODE_EXISTED);
        }
        if (facilityRepository.existsByNameIgnoreCase(name)) {
            throw new AppException(ErrorCode.FACILITY_NAME_EXISTED);
        }

        Facility facility = facilityMapper.toEntity(request);
        facility.setName(name);
        facility.setCode(code);
        facility.setStatus(parseStatus(request.getStatus(), FacilityStatus.ACTIVE));
        facility.setLatitude(roundCoordinate(request.getLatitude()));
        facility.setLongitude(roundCoordinate(request.getLongitude()));
        if (facility.getOpenTime() == null) {
            facility.setOpenTime(java.time.LocalTime.of(8, 0));
        }
        if (facility.getCloseTime() == null) {
            facility.setCloseTime(java.time.LocalTime.of(20, 0));
        }

        if (request.getManagerId() != null) {
            facility.setManager(resolveManager(request.getManagerId(), facility));
        }

        Facility saved = facilityRepository.save(facility);

        activityLogService.record(saved.getId(), ActivityAction.FACILITY_CREATE, "FACILITY", saved.getId(),
                "Tạo cơ sở: " + saved.getName() + " (" + saved.getCode() + ")", null, saved.getCode());

        return toResponse(saved, loadUnitCounts(List.of(saved.getId())), false);
    }

    @Override
    public FacilityResponse update(UUID id, FacilityUpdateRequest request) {
        Facility facility = facilityRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.FACILITY_NOT_FOUND));

        facilityAccessGuard.checkFacilityAccess(facility.getId());

        if (request.getCode() != null
                && facilityRepository.existsByCodeIgnoreCaseAndIdNot(request.getCode().trim(), facility.getId())) {
            throw new AppException(ErrorCode.FACILITY_CODE_EXISTED);
        }
        if (request.getName() != null
                && facilityRepository.existsByNameIgnoreCaseAndIdNot(request.getName().trim(), facility.getId())) {
            throw new AppException(ErrorCode.FACILITY_NAME_EXISTED);
        }

        FacilityStatus previousStatus = facility.getStatus();
        FacilityStatus nextStatus = request.getStatus() == null ? previousStatus : parseStatus(request.getStatus(), previousStatus);
        if (nextStatus == FacilityStatus.INACTIVE && previousStatus != FacilityStatus.INACTIVE
                && hasUnitsInUse(facility.getId())) {
            throw new AppException(ErrorCode.FACILITY_UNSAFE_DEACTIVATION);
        }

        facilityMapper.updateEntityFromRequest(request, facility);
        if (request.getName() != null) {
            facility.setName(request.getName().trim());
        }
        if (request.getCode() != null) {
            facility.setCode(request.getCode().trim());
        }
        if (Boolean.TRUE.equals(request.getClearCoordinates())) {
            facility.setLatitude(null);
            facility.setLongitude(null);
        } else {
            facility.setLatitude(roundCoordinate(facility.getLatitude()));
            facility.setLongitude(roundCoordinate(facility.getLongitude()));
        }
        validateCoordinates(facility.getLatitude(), facility.getLongitude());

        if (request.getManagerId() != null) {
            facility.setManager(resolveManager(request.getManagerId(), facility));
        }

        facility.setStatus(nextStatus);

        Facility updated = facilityRepository.save(facility);

        activityLogService.record(updated.getId(), ActivityAction.FACILITY_UPDATE, "FACILITY", updated.getId(),
                "Cập nhật cơ sở: " + updated.getName(), previousStatus, updated.getStatus());

        return toResponse(updated, loadUnitCounts(List.of(updated.getId())), false);
    }

    /**
     * "Xóa" cơ sở là ngừng hoạt động (SRS 3.3.2): cơ sở luôn có nhật ký hoạt động và dữ liệu vận hành tham chiếu tới nó
     * nên không bao giờ xóa cứng. Cơ sở còn kho đang thuê hoặc giữ chỗ bị từ chối.
     */
    @Override
    public void delete(UUID id) {
        Facility facility = facilityRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.FACILITY_NOT_FOUND));

        facilityAccessGuard.checkFacilityAccess(facility.getId());

        if (facility.getStatus() == FacilityStatus.INACTIVE) {
            return;
        }
        if (hasUnitsInUse(facility.getId())) {
            throw new AppException(ErrorCode.FACILITY_UNSAFE_DEACTIVATION);
        }

        FacilityStatus previousStatus = facility.getStatus();
        facility.setStatus(FacilityStatus.INACTIVE);
        facilityRepository.save(facility);

        activityLogService.record(facility.getId(), ActivityAction.FACILITY_DEACTIVATE, "FACILITY", facility.getId(),
                "Ngừng hoạt động cơ sở: " + facility.getName(), previousStatus, FacilityStatus.INACTIVE);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<FacilityResponse> getAll(
            String search, FacilityStatus status, int page, int size, String sortBy, String sortDir, boolean publicScope) {
        String sortField = sortBy != null && SORTABLE_FIELDS.contains(sortBy) ? sortBy : "createdAt";
        Sort sort = "desc".equalsIgnoreCase(sortDir)
                ? Sort.by(sortField).descending()
                : Sort.by(sortField).ascending();
        Pageable pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 200), sort);

        boolean publicView = publicScope || isPublicViewer();
        // Trang công khai chỉ thấy cơ sở đang hoạt động; nhân viên và quản lý cơ sở trong cổng làm việc vẫn bị giới hạn theo cơ sở của mình.
        UUID scopedFacilityId = publicScope ? null : facilityAccessGuard.scopedFacilityIdOrNull();
        FacilityStatus effectiveStatus = publicView ? FacilityStatus.ACTIVE : status;
        String normalizedSearch = search == null || search.isBlank() ? null : search.trim();

        Page<Facility> facilities = facilityRepository.findAllWithFilters(normalizedSearch, effectiveStatus, scopedFacilityId, pageable);
        Map<UUID, long[]> counts = loadUnitCounts(facilities.getContent().stream().map(Facility::getId).toList());
        List<FacilityResponse> content = facilities.getContent().stream()
                .map(facility -> toResponse(facility, counts, publicView))
                .toList();
        return PageResponse.from(new PageImpl<>(content, pageable, facilities.getTotalElements()));
    }

    // ------------------------------------------------------------------ helpers

    /** Còn kho đang thuê/giữ chỗ, kể cả kho ghi "trống" nhưng đã có đặt kho còn hiệu lực. */
    private boolean hasUnitsInUse(UUID facilityId) {
        return storageUnitRepository.countByFacility_IdAndStatusIn(facilityId, IN_USE_STATUSES) > 0
                || !storageUnitRepository.countAvailableWithLiveBookingByFacilityIds(List.of(facilityId)).isEmpty();
    }

    /** Khách vãng lai và khách hàng chỉ nhận thông tin công khai của cơ sở. */
    private boolean isPublicViewer() {
        String role = requestContext.currentUserRole();
        return role == null || "CUSTOMER".equalsIgnoreCase(role);
    }

    private FacilityResponse toResponse(Facility facility, Map<UUID, long[]> counts, boolean publicView) {
        FacilityResponse response = facilityMapper.toResponse(facility);
        long[] unitCounts = counts.getOrDefault(facility.getId(), new long[]{0, 0});
        response.setTotalUnits(unitCounts[0]);
        response.setAvailableUnits(facility.getStatus() == FacilityStatus.ACTIVE ? unitCounts[1] : 0L);
        if (publicView) {
            response.setManagerId(null);
            response.setManagerName(null);
        }
        return response;
    }

    /** Một truy vấn gom nhóm cho cả trang: facilityId -> [tổng số kho, số kho trống]. */
    private Map<UUID, long[]> loadUnitCounts(Collection<UUID> facilityIds) {
        Map<UUID, long[]> counts = new HashMap<>();
        if (facilityIds == null || facilityIds.isEmpty()) {
            return counts;
        }
        for (Object[] row : storageUnitRepository.countByFacilityIdsGroupedByStatus(facilityIds)) {
            UUID facilityId = (UUID) row[0];
            UnitStatus unitStatus = (UnitStatus) row[1];
            long count = ((Number) row[2]).longValue();
            long[] entry = counts.computeIfAbsent(facilityId, key -> new long[]{0, 0});
            entry[0] += count;
            if (unitStatus == UnitStatus.AVAILABLE) {
                entry[1] += count;
            }
        }
        // Kho ghi "trống" nhưng đã có đặt kho còn hiệu lực không phải là kho trống (xem UnitAvailability)
        for (Object[] row : storageUnitRepository.countAvailableWithLiveBookingByFacilityIds(facilityIds)) {
            long[] entry = counts.get((UUID) row[0]);
            if (entry != null) {
                entry[1] = Math.max(0L, entry[1] - ((Number) row[1]).longValue());
            }
        }
        return counts;
    }

    private User resolveManager(UUID managerId, Facility facility) {
        User manager = userRepository.findById(managerId)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        if (manager.getRole() == null || !"FACILITY_MANAGER".equalsIgnoreCase(manager.getRole().getName())) {
            throw new AppException(ErrorCode.INVALID_MANAGER_TO_ASSIGN);
        }
        manager.setFacility(facility);
        return manager;
    }

    private FacilityStatus parseStatus(String raw, FacilityStatus fallback) {
        if (raw == null || raw.isBlank()) {
            return fallback;
        }
        try {
            return FacilityStatus.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new AppException(ErrorCode.FACILITY_STATUS_INVALID);
        }
    }

    private void validateCoordinates(BigDecimal latitude, BigDecimal longitude) {
        if ((latitude == null) != (longitude == null)) {
            throw new AppException(ErrorCode.FACILITY_COORDINATES_INVALID);
        }
    }

    private BigDecimal roundCoordinate(BigDecimal value) {
        return value == null ? null : value.setScale(COORDINATE_SCALE, RoundingMode.HALF_UP);
    }
}

package com.boxora.service.impl;

import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.FacilityCreateRequest;
import com.boxora.dto.request.FacilityUpdateRequest;
import com.boxora.dto.response.FacilityResponse;
import com.boxora.entity.Facility;
import com.boxora.entity.User;
import com.boxora.enums.FacilityStatus;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.mapper.FacilityMapper;
import com.boxora.repository.FacilityRepository;
import com.boxora.repository.UserRepository;
import com.boxora.enums.ActivityAction;
import com.boxora.security.FacilityAccessGuard;
import com.boxora.service.ActivityLogService;
import com.boxora.service.FacilityService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class FacilityServiceImpl implements FacilityService {

    private final FacilityRepository facilityRepository;
    private final UserRepository userRepository;
    private final FacilityMapper facilityMapper;
    private final ActivityLogService activityLogService;
    private final FacilityAccessGuard facilityAccessGuard;

    @Override
    public FacilityResponse getById(UUID id) {
        Facility facility = facilityRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.FACILITY_NOT_FOUND));
        facilityAccessGuard.checkFacilityAccess(facility.getId());
        return facilityMapper.toResponse(facility);
    }

    @Override
    public FacilityResponse create(FacilityCreateRequest request) {
        validateCoordinates(request.getLatitude(), request.getLongitude());
        if (facilityRepository.existsByCode(request.getCode())) {
            throw new AppException(ErrorCode.FACILITY_CODE_EXISTED);
        }

        Facility facility = facilityMapper.toEntity(request);
        if (facility.getStatus() == null) {
            facility.setStatus(FacilityStatus.ACTIVE);
        }
        if (facility.getOpenTime() == null) {
            facility.setOpenTime(java.time.LocalTime.of(8, 0));
        }
        if (facility.getCloseTime() == null) {
            facility.setCloseTime(java.time.LocalTime.of(20, 0));
        }

        if (request.getManagerId() != null) {
            User manager = userRepository.findById(request.getManagerId())
                    .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

            if (manager.getRole() != null && "FACILITY_MANAGER".equalsIgnoreCase(manager.getRole().getName())) {
                facility.setManager(manager);
                manager.setFacility(facility);
            } else {
                throw new AppException(ErrorCode.INVALID_MANAGER_TO_ASSIGN);
            }
        }

        Facility saved = facilityRepository.save(facility);

        activityLogService.record(saved.getId(), ActivityAction.FACILITY_CREATE, "FACILITY", saved.getId(),
                "Created facility: " + saved.getName() + " (" + saved.getCode() + ")", null, saved.getCode());

        return facilityMapper.toResponse(saved);
    }

    @Override
    public FacilityResponse update(UUID id, FacilityUpdateRequest request) {
        Facility facility = facilityRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.FACILITY_NOT_FOUND));

        facilityAccessGuard.checkFacilityAccess(facility.getId());

        if (request.getCode() != null
                && facilityRepository.existsByCodeAndIdNot(request.getCode(), facility.getId())) {
            throw new AppException(ErrorCode.FACILITY_CODE_EXISTED);
        }

        facilityMapper.updateEntityFromRequest(request, facility);
        if (Boolean.TRUE.equals(request.getClearCoordinates())) {
            facility.setLatitude(null);
            facility.setLongitude(null);
        }
        validateCoordinates(facility.getLatitude(), facility.getLongitude());

        if (request.getManagerId() != null) {
            User manager = userRepository.findById(request.getManagerId())
                    .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

            if (manager.getRole() != null && "FACILITY_MANAGER".equalsIgnoreCase(manager.getRole().getName())) {
                facility.setManager(manager);
                manager.setFacility(facility);
            } else {
                throw new AppException(ErrorCode.INVALID_MANAGER_TO_ASSIGN);
            }
        }

        if (request.getStatus() != null) {
            try {
                facility.setStatus(FacilityStatus.valueOf(request.getStatus().toUpperCase()));
            } catch (IllegalArgumentException e) {
                throw new AppException(ErrorCode.INVALID_REQUEST);
            }
        }

        Facility updated = facilityRepository.save(facility);

        activityLogService.record(updated.getId(), ActivityAction.FACILITY_UPDATE, "FACILITY", updated.getId(),
                "Updated facility: " + updated.getName(), null, updated.getStatus());

        return facilityMapper.toResponse(updated);
    }

    @Override
    public void delete(UUID id) {
        Facility facility = facilityRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.FACILITY_NOT_FOUND));

        facilityAccessGuard.checkFacilityAccess(facility.getId());
        // Preserve contracts, payments, tickets, units, and operational history. The public
        // delete operation is a deactivation; facility-linked rows may otherwise cascade-delete.
        facility.setStatus(FacilityStatus.INACTIVE);
        facilityRepository.save(facility);
        activityLogService.record(facility.getId(), ActivityAction.FACILITY_DEACTIVATE, "FACILITY", facility.getId(),
                "Deactivated facility: " + facility.getName(), null, facility.getStatus());
    }

    @Override
    public PageResponse<FacilityResponse> getAll(
            String search, FacilityStatus status, int page, int size, String sortBy, String sortDir) {
        Sort sort = sortDir.equalsIgnoreCase("desc")
                ? Sort.by(sortBy).descending()
                : Sort.by(sortBy).ascending();
        Pageable pageable = PageRequest.of(page, size, sort);

        // STAFF/FACILITY_MANAGER chỉ thấy facility của chính mình trong list
        UUID scopedFacilityId = facilityAccessGuard.scopedFacilityIdOrNull();

        Page<FacilityResponse> result = facilityRepository
                .findAllWithFilters(search, status, scopedFacilityId, pageable)
                .map(facilityMapper::toResponse);
        return PageResponse.from(result);
    }

    private void validateCoordinates(java.math.BigDecimal latitude, java.math.BigDecimal longitude) {
        if ((latitude == null) != (longitude == null)) {
            throw new AppException(ErrorCode.INVALID_REQUEST);
        }
        if (latitude != null) {
            double lat = latitude.doubleValue();
            if (lat < -90.0 || lat > 90.0) {
                throw new AppException(ErrorCode.INVALID_REQUEST);
            }
        }
        if (longitude != null) {
            double lng = longitude.doubleValue();
            if (lng < -180.0 || lng > 180.0) {
                throw new AppException(ErrorCode.INVALID_REQUEST);
            }
        }
    }
}

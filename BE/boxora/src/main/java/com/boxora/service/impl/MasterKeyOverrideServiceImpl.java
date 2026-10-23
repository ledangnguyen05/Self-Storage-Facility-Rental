package com.boxora.service.impl;

import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.MasterKeyOverrideRequest;
import com.boxora.dto.response.MasterKeyOverrideResponse;
import com.boxora.entity.Facility;
import com.boxora.entity.MasterKeyOverride;
import com.boxora.entity.StorageUnit;
import com.boxora.entity.User;
import com.boxora.enums.ActivityAction;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.mapper.MasterKeyOverrideMapper;
import com.boxora.repository.FacilityRepository;
import com.boxora.repository.MasterKeyOverrideRepository;
import com.boxora.repository.StorageUnitRepository;
import com.boxora.repository.UserRepository;
import com.boxora.security.FacilityAccessGuard;
import com.boxora.security.RequestContext;
import com.boxora.service.ActivityLogService;
import com.boxora.service.EmergencyAlertService;
import com.boxora.service.MasterKeyOverrideService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class MasterKeyOverrideServiceImpl implements MasterKeyOverrideService {

    private final MasterKeyOverrideRepository masterKeyOverrideRepository;
    private final FacilityRepository facilityRepository;
    private final UserRepository userRepository;
    private final StorageUnitRepository storageUnitRepository;
    private final PasswordEncoder passwordEncoder;
    private final MasterKeyOverrideMapper masterKeyOverrideMapper;
    private final FacilityAccessGuard facilityAccessGuard;
    private final RequestContext requestContext;
    private final ActivityLogService activityLogService;
    private final EmergencyAlertService emergencyAlertService;

    private static final Set<String> WITNESS_ELIGIBLE_ROLES =
            Set.of("STAFF", "FACILITY_MANAGER", "BUSINESS_MANAGER", "ADMIN");

    private static final Set<String> SYSTEM_WIDE_ROLES =
            Set.of("ADMIN", "BUSINESS_MANAGER");

    @Override
    public MasterKeyOverrideResponse create(MasterKeyOverrideRequest request) {
        Facility facility = facilityRepository.findById(request.getFacilityId())
                .orElseThrow(() -> new AppException(ErrorCode.FACILITY_NOT_FOUND));

        // performer must have access to this facility (STAFF/FACILITY_MANAGER scope,
        // or ADMIN/BUSINESS_MANAGER which always pass)
        facilityAccessGuard.checkFacilityAccess(facility.getId());

        UUID performedById = requestContext.currentUserId();
        if (performedById == null) {
            throw new AppException(ErrorCode.USER_NOT_FOUND);
        }
        User performedBy = userRepository.findById(performedById)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        // ==========================================
        // BR-RULE-009: Two-Person Rule Verification
        // ==========================================

        // 1. Witness cannot be the same user as the performer
        if (request.getWitnessUserId().equals(performedById)) {
            throw new AppException(ErrorCode.MASTER_KEY_WITNESS_REQUIRED);
        }

        // 2. Witness user must exist
        User witness = userRepository.findById(request.getWitnessUserId())
                .orElseThrow(() -> new AppException(ErrorCode.MASTER_KEY_WITNESS_NOT_FOUND));

        // 3. Witness must be active
        if (!Boolean.TRUE.equals(witness.getIsActive())) {
            throw new AppException(ErrorCode.MASTER_KEY_WITNESS_INACTIVE);
        }

        // 4. Witness must have an authorized staff or management role (cannot be a customer)
        String witnessRole = witness.getRole() != null ? witness.getRole().getName() : "";
        if (!WITNESS_ELIGIBLE_ROLES.contains(witnessRole)) {
            throw new AppException(ErrorCode.MASTER_KEY_WITNESS_UNAUTHORIZED_ROLE);
        }

        // 5. Facility scoping: Facility-scoped staff must belong to the same facility.
        // System-wide roles (ADMIN, BUSINESS_MANAGER) can witness at any facility.
        if (!SYSTEM_WIDE_ROLES.contains(witnessRole)) {
            if (witness.getFacility() == null || !witness.getFacility().getId().equals(facility.getId())) {
                throw new AppException(ErrorCode.MASTER_KEY_WITNESS_WRONG_FACILITY);
            }
        }

        // 6. Dual-Authentication: Witness must verify identity via password to prevent spoofing
        if (!passwordEncoder.matches(request.getWitnessPassword(), witness.getPassword())) {
            throw new AppException(ErrorCode.MASTER_KEY_WITNESS_INVALID_CREDENTIALS);
        }

        // ==========================================
        // Resource Validation (StorageUnit)
        // ==========================================
        String resourceType = request.getResourceType() != null && !request.getResourceType().isBlank()
                ? request.getResourceType()
                : "STORAGE_UNIT";

        if (request.getResourceId() != null &&
                (resourceType.equalsIgnoreCase("STORAGE_UNIT") || resourceType.equalsIgnoreCase("UNIT"))) {
            StorageUnit unit = storageUnitRepository.findById(request.getResourceId())
                    .orElseThrow(() -> new AppException(ErrorCode.STORAGE_UNIT_NOT_FOUND));
            if (!unit.getFacility().getId().equals(facility.getId())) {
                throw new AppException(ErrorCode.MASTER_KEY_RESOURCE_WRONG_FACILITY);
            }
        }

        // ==========================================
        // Persist Master Key Override Record
        // ==========================================
        MasterKeyOverride override = MasterKeyOverride.builder()
                .facility(facility)
                .performedBy(performedBy)
                .witness(witness)
                .category(request.getCategory())
                .severity(request.getSeverity())
                .reason(request.getReason())
                .documentReference(request.getDocumentReference())
                .resourceType(resourceType)
                .resourceId(request.getResourceId())
                .build();

        MasterKeyOverride saved = masterKeyOverrideRepository.save(override);

        // ==========================================
        // Append-only Audit Trail (ActivityLog)
        // ==========================================
        Map<String, Object> snapshot = new HashMap<>();
        snapshot.put("overrideId", saved.getId());
        snapshot.put("facilityId", facility.getId());
        snapshot.put("facilityName", facility.getName());
        snapshot.put("performedBy", performedBy.getFullName());
        snapshot.put("witness", witness.getFullName());
        snapshot.put("category", request.getCategory().name());
        snapshot.put("severity", request.getSeverity().name());
        snapshot.put("reason", request.getReason());
        if (request.getDocumentReference() != null) {
            snapshot.put("documentReference", request.getDocumentReference());
        }
        if (request.getResourceId() != null) {
            snapshot.put("resourceId", request.getResourceId());
        }

        activityLogService.record(
                facility.getId(),
                ActivityAction.MASTER_KEY_OVERRIDE,
                resourceType,
                request.getResourceId() != null ? request.getResourceId() : facility.getId(),
                String.format("Master key used [%s/%s] at %s - witnessed by %s. Reason: %s",
                        request.getCategory(), request.getSeverity(), facility.getName(),
                        witness.getFullName(), request.getReason()),
                null,
                snapshot
        );

        // ==========================================
        // Real-time Emergency Alert to Business Manager / Admin
        // ==========================================
        try {
            emergencyAlertService.alertMasterKeyUsed(
                    facility.getId(),
                    facility.getName(),
                    performedBy.getFullName(),
                    witness.getFullName(),
                    request.getCategory(),
                    request.getSeverity(),
                    request.getReason(),
                    request.getDocumentReference()
            );
        } catch (Exception e) {
            log.error("Failed to send master key emergency alert for facility {}", facility.getId(), e);
        }

        return masterKeyOverrideMapper.toResponse(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public MasterKeyOverrideResponse getById(UUID id) {
        MasterKeyOverride override = masterKeyOverrideRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.MASTER_KEY_OVERRIDE_NOT_FOUND));
        facilityAccessGuard.checkFacilityAccess(override.getFacility().getId());
        return masterKeyOverrideMapper.toResponse(override);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<MasterKeyOverrideResponse> getAll(
            UUID facilityId, int page, int size, String sortBy, String sortDir) {
        // STAFF/FACILITY_MANAGER only ever see their own facility's overrides
        UUID scopedFacilityId = facilityAccessGuard.isFacilityScoped()
                ? facilityAccessGuard.scopedFacilityIdOrNull()
                : facilityId;

        Sort sort = sortDir.equalsIgnoreCase("desc")
                ? Sort.by(sortBy).descending()
                : Sort.by(sortBy).ascending();
        Pageable pageable = PageRequest.of(page, size, sort);

        Page<MasterKeyOverrideResponse> result = masterKeyOverrideRepository
                .findAllWithFilters(scopedFacilityId, pageable)
                .map(masterKeyOverrideMapper::toResponse);
        return PageResponse.from(result);
    }
}
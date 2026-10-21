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
                .orElseThrow(() -> new AppException(ErrorCode.FACILITY_NOT_FOUND, "Không tìm thấy cơ sở"));

        // performer must have access to this facility (STAFF/FACILITY_MANAGER scope,
        // or ADMIN/BUSINESS_MANAGER which always pass)
        if (facilityAccessGuard.isFacilityScoped() && requestContext.currentUserFacilityId() == null) {
            throw new AppException(ErrorCode.FACILITY_ACCESS_DENIED);
        }
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
            throw new AppException(ErrorCode.MASTER_KEY_WITNESS_REQUIRED, "Người chứng kiến phải khác người sử dụng chìa khóa tổng");
        }

        // Brute-force guard: the witness password check must not become a password oracle.
        ensureNotLockedOut(performedById, request.getWitnessUserId());

        // 2. Witness user must exist
        User witness = userRepository.findById(request.getWitnessUserId())
                .orElseThrow(() -> new AppException(ErrorCode.MASTER_KEY_WITNESS_NOT_FOUND, "Không tìm thấy người chứng kiến"));

        // 3. Witness must be active
        if (!Boolean.TRUE.equals(witness.getIsActive())) {
            throw new AppException(ErrorCode.MASTER_KEY_WITNESS_INACTIVE, "Tài khoản người chứng kiến đang ngừng hoạt động");
        }

        // 4. Witness must have an authorized staff or management role (cannot be a customer)
        String witnessRole = witness.getRole() != null ? witness.getRole().getName() : "";
        if (!WITNESS_ELIGIBLE_ROLES.contains(witnessRole)) {
            throw new AppException(ErrorCode.MASTER_KEY_WITNESS_UNAUTHORIZED_ROLE, "Người chứng kiến phải là nhân viên hoặc quản lý");
        }

        // 5. Facility scoping: Facility-scoped staff must belong to the same facility.
        // System-wide roles (ADMIN, BUSINESS_MANAGER) can witness at any facility.
        if (!SYSTEM_WIDE_ROLES.contains(witnessRole)) {
            if (witness.getFacility() == null || !witness.getFacility().getId().equals(facility.getId())) {
                throw new AppException(ErrorCode.MASTER_KEY_WITNESS_WRONG_FACILITY, "Người chứng kiến phải thuộc cùng cơ sở");
            }
        }

        // 6. Dual-Authentication: Witness must verify identity via password to prevent spoofing
        if (witness.getPassword() == null || !passwordEncoder.matches(request.getWitnessPassword(), witness.getPassword())) {
            recordFailure(performedById, witness.getId());
            activityLogService.record(facility.getId(), ActivityAction.MASTER_KEY_OVERRIDE, "User", witness.getId(),
                    String.format("Xác thực người chứng kiến %s thất bại khi ghi nhận sử dụng chìa khóa tổng tại %s",
                            witness.getFullName() != null ? witness.getFullName() : witness.getUsername(), facility.getName()),
                    null, "WITNESS_VERIFICATION_FAILED");
            throw new AppException(ErrorCode.MASTER_KEY_WITNESS_INVALID_CREDENTIALS, "Mật khẩu người chứng kiến không đúng");
        }
        clearFailures(performedById, witness.getId());

        // ==========================================
        // Resource Validation (StorageUnit)
        // ==========================================
        String resourceType = request.getResourceType() != null && !request.getResourceType().isBlank()
                ? request.getResourceType()
                : "STORAGE_UNIT";

        String unitCode = null;
        if (request.getResourceId() != null &&
                (resourceType.equalsIgnoreCase("STORAGE_UNIT") || resourceType.equalsIgnoreCase("UNIT"))) {
            StorageUnit unit = storageUnitRepository.findById(request.getResourceId())
                    .orElseThrow(() -> new AppException(ErrorCode.STORAGE_UNIT_NOT_FOUND, "Không tìm thấy kho"));
            if (unit.getFacility() == null || !unit.getFacility().getId().equals(facility.getId())) {
                throw new AppException(ErrorCode.MASTER_KEY_RESOURCE_WRONG_FACILITY, "Kho được chọn không thuộc cơ sở này");
            }
            unitCode = unit.getUnitCode();
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
                String.format("Sử dụng chìa khóa tổng (%s, mức %s) tại %s%s, người chứng kiến %s. Lý do: %s",
                        MasterKeyLabels.category(request.getCategory()),
                        MasterKeyLabels.severity(request.getSeverity()).toLowerCase(java.util.Locale.ROOT), facility.getName(),
                        unitCode != null ? " (kho " + unitCode + ")" : "",
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
                .orElseThrow(() -> new AppException(ErrorCode.MASTER_KEY_OVERRIDE_NOT_FOUND, "Không tìm thấy bản ghi sử dụng chìa khóa tổng"));
        if (facilityAccessGuard.isFacilityScoped() && requestContext.currentUserFacilityId() == null) {
            throw new AppException(ErrorCode.FACILITY_ACCESS_DENIED);
        }
        facilityAccessGuard.checkFacilityAccess(override.getFacility().getId());
        return masterKeyOverrideMapper.toResponse(override);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<MasterKeyOverrideResponse> getAll(
            UUID facilityId, int page, int size, String sortBy, String sortDir) {
        // STAFF/FACILITY_MANAGER only ever see their own facility's overrides
        UUID scopedFacilityId = facilityId;
        if (facilityAccessGuard.isFacilityScoped()) {
            UUID own = requestContext.currentUserFacilityId();
            if (own == null || (facilityId != null && !facilityId.equals(own))) {
                throw new AppException(ErrorCode.FACILITY_ACCESS_DENIED);
            }
            scopedFacilityId = own;
        }

        String sortProperty = SORTABLE_FIELDS.contains(sortBy) ? sortBy : "createdAt";
        Sort sort = "asc".equalsIgnoreCase(sortDir)
                ? Sort.by(sortProperty).ascending()
                : Sort.by(sortProperty).descending();
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 100), sort);

        Page<MasterKeyOverrideResponse> result = masterKeyOverrideRepository
                .findAllWithFilters(scopedFacilityId, pageable)
                .map(masterKeyOverrideMapper::toResponse);
        return PageResponse.from(result);
    }

    // ------------------------------------------------------------------ witness brute-force guard

    private static final java.util.Set<String> SORTABLE_FIELDS = java.util.Set.of("createdAt", "category", "severity");
    private static final int MAX_WITNESS_FAILURES = 5;
    private static final long FAILURE_WINDOW_MS = java.time.Duration.ofMinutes(15).toMillis();
    private final java.util.Map<UUID, java.util.Deque<Long>> witnessFailures = new java.util.concurrent.ConcurrentHashMap<>();

    private void ensureNotLockedOut(UUID performerId, UUID witnessId) {
        if (recentFailures(performerId) >= MAX_WITNESS_FAILURES || recentFailures(witnessId) >= MAX_WITNESS_FAILURES) {
            throw new AppException(ErrorCode.MASTER_KEY_TOO_MANY_ATTEMPTS);
        }
    }

    private int recentFailures(UUID key) {
        if (key == null) {
            return 0;
        }
        java.util.Deque<Long> deque = witnessFailures.get(key);
        if (deque == null) {
            return 0;
        }
        long now = System.currentTimeMillis();
        synchronized (deque) {
            while (!deque.isEmpty() && now - deque.peekFirst() > FAILURE_WINDOW_MS) {
                deque.pollFirst();
            }
            return deque.size();
        }
    }

    private void recordFailure(UUID performerId, UUID witnessId) {
        long now = System.currentTimeMillis();
        for (UUID key : new UUID[]{performerId, witnessId}) {
            if (key == null) {
                continue;
            }
            java.util.Deque<Long> deque = witnessFailures.computeIfAbsent(key, k -> new java.util.ArrayDeque<>());
            synchronized (deque) {
                deque.addLast(now);
            }
        }
    }

    private void clearFailures(UUID performerId, UUID witnessId) {
        if (performerId != null) {
            witnessFailures.remove(performerId);
        }
        if (witnessId != null) {
            witnessFailures.remove(witnessId);
        }
    }
}
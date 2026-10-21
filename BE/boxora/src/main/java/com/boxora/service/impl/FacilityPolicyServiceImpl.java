package com.boxora.service.impl;

import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.FacilityPolicyCreateRequest;
import com.boxora.dto.request.FacilityPolicyPriceRequest;
import com.boxora.dto.request.FacilityPolicyUpdateRequest;
import com.boxora.dto.response.FacilityPolicyResponse;
import com.boxora.dto.response.FacilityPolicyPriceResponse;
import com.boxora.entity.Facility;
import com.boxora.entity.FacilityPolicy;
import com.boxora.entity.FacilityPolicyExceptionGrant;
import com.boxora.entity.FacilityPolicyPrice;
import com.boxora.entity.User;
import com.boxora.entity.UnitType;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.mapper.FacilityPolicyMapper;
import com.boxora.repository.FacilityPolicyRepository;
import com.boxora.repository.FacilityRepository;
import com.boxora.repository.FacilityPolicyExceptionGrantRepository;
import com.boxora.repository.UserRepository;
import com.boxora.repository.UnitTypeRepository;
import com.boxora.enums.ActivityAction;
import com.boxora.security.FacilityAccessGuard;
import com.boxora.security.RequestContext;
import com.boxora.service.ActivityLogService;
import com.boxora.service.FacilityPolicyDefaults;
import com.boxora.service.FacilityPolicyService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.Set;
import java.util.UUID;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class FacilityPolicyServiceImpl implements FacilityPolicyService {

    private static final Set<String> SORTABLE_FIELDS = Set.of("id", "createdAt", "updatedAt", "isActive", "minimumRentalMonths");

    private final FacilityPolicyRepository facilityPolicyRepository;
    private final FacilityRepository facilityRepository;
    private final FacilityPolicyMapper facilityPolicyMapper;
    private final ActivityLogService activityLogService;
    private final FacilityAccessGuard facilityAccessGuard;
    private final FacilityPolicyExceptionGrantRepository exceptionGrantRepository;
    private final UserRepository userRepository;
    private final UnitTypeRepository unitTypeRepository;
    private final RequestContext requestContext;

    /**
     * Chính sách là thông tin công khai (khách xem điều kiện thuê, hủy, cọc trước khi đặt) nên đọc không cần
     * đăng nhập và không bị giới hạn theo cơ sở. Khách vãng lai và khách hàng chỉ thấy chính sách đang áp dụng:
     * chính sách đã tắt coi như cơ sở dùng giá trị mặc định của hệ thống.
     */
    @Override
    @Transactional(readOnly = true)
    public FacilityPolicyResponse getById(UUID id) {
        FacilityPolicy policy = facilityPolicyRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.FACILITY_POLICY_NOT_FOUND));
        return toVisibleResponse(policy);
    }

    @Override
    @Transactional(readOnly = true)
    public FacilityPolicyResponse getByFacilityId(UUID facilityId) {
        FacilityPolicy policy = facilityPolicyRepository.findByFacility_Id(facilityId)
                .orElseThrow(() -> new AppException(ErrorCode.FACILITY_POLICY_NOT_FOUND));
        return toVisibleResponse(policy);
    }

    @Override
    public FacilityPolicyResponse create(FacilityPolicyCreateRequest request) {
        validateCancellation(request.getCancellationFullRefundHours(), request.getCancellationPartialRefundHours());
        validateOverdueStages(request.getOverdueGraceDays(), request.getOverdueAccessDisableDays(), request.getOverdueSealingDays());

        Facility facility = facilityRepository.findById(request.getFacilityId())
                .orElseThrow(() -> new AppException(ErrorCode.FACILITY_NOT_FOUND));

        if (facilityPolicyRepository.existsByFacility_Id(facility.getId())) {
            throw new AppException(ErrorCode.FACILITY_POLICY_ALREADY_EXISTS);
        }

        FacilityPolicy policy = FacilityPolicy.builder()
                .facility(facility)
                .isActive(request.getIsActive() == null || request.getIsActive())
                .depositPercentage(request.getDepositPercentage())
                .renewalWindowDays(request.getRenewalWindowDays())
                .holdGraceHours(request.getHoldGraceHours() != null ? request.getHoldGraceHours() : FacilityPolicyDefaults.HOLD_GRACE_HOURS)
                .maxHoldDays(request.getMaxHoldDays() != null ? request.getMaxHoldDays() : FacilityPolicyDefaults.MAX_HOLD_DAYS)
                .cancellationFullRefundHours(request.getCancellationFullRefundHours())
                .cancellationPartialRefundHours(request.getCancellationPartialRefundHours())
                .cancellationPartialRefundPercent(request.getCancellationPartialRefundPercent())
                .returnNoticeDays(request.getReturnNoticeDays())
                .depositRefundSlaDays(request.getDepositRefundSlaDays())
                .dailyLateFee(request.getDailyLateFee())
                .overdueGraceDays(request.getOverdueGraceDays())
                .overdueAccessDisableDays(request.getOverdueAccessDisableDays())
                .overdueSealingDays(request.getOverdueSealingDays())
                .minimumRentalMonths(request.getMinimumRentalMonths())
                .build();

        syncPrices(policy, request.getPrices());
        FacilityPolicy saved = facilityPolicyRepository.save(policy);

        activityLogService.record(facility.getId(), ActivityAction.FACILITY_POLICY_CREATE, "FACILITY_POLICY", saved.getId(),
                "Ban hành chính sách cho cơ sở " + facility.getName(), null, facility.getId());

        return toResponse(saved);
    }

    @Override
    public FacilityPolicyResponse update(UUID id, FacilityPolicyUpdateRequest request) {
        FacilityPolicy policy = facilityPolicyRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.FACILITY_POLICY_NOT_FOUND));

        facilityAccessGuard.checkFacilityAccess(policy.getFacility().getId());
        if ("FACILITY_MANAGER".equalsIgnoreCase(requestContext.currentUserRole())
                && !exceptionGrantRepository.existsByFacilityPolicy_IdAndUser_IdAndIsActiveTrue(
                policy.getId(), requestContext.currentUserId())) {
            throw new AppException(ErrorCode.FORBIDDEN);
        }
        // Bảng giá thuộc thẩm quyền Giám đốc vận hành (SRS 3.1.2); quản lý cơ sở được cấp ngoại lệ chỉ sửa quy định vận hành.
        if ("FACILITY_MANAGER".equalsIgnoreCase(requestContext.currentUserRole()) && request.getPrices() != null) {
            throw new AppException(ErrorCode.FORBIDDEN, "Chỉ Giám đốc vận hành được thay đổi bảng giá của cơ sở");
        }

        int fullHours = request.getCancellationFullRefundHours() != null
                ? request.getCancellationFullRefundHours()
                : policy.getCancellationFullRefundHours();
        int partialHours = request.getCancellationPartialRefundHours() != null
                ? request.getCancellationPartialRefundHours()
                : policy.getCancellationPartialRefundHours();
        validateCancellation(fullHours, partialHours);

        validateOverdueStages(
                request.getOverdueGraceDays() != null ? request.getOverdueGraceDays() : policy.getOverdueGraceDays(),
                request.getOverdueAccessDisableDays() != null ? request.getOverdueAccessDisableDays() : policy.getOverdueAccessDisableDays(),
                request.getOverdueSealingDays() != null ? request.getOverdueSealingDays() : policy.getOverdueSealingDays());

        facilityPolicyMapper.updateEntityFromRequest(request, policy);
        if (request.getPrices() != null) {
            syncPrices(policy, request.getPrices());
        }
        FacilityPolicy updated = facilityPolicyRepository.save(policy);

        activityLogService.record(policy.getFacility().getId(), ActivityAction.FACILITY_POLICY_UPDATE, "FACILITY_POLICY", updated.getId(),
                "Cập nhật chính sách cơ sở " + (policy.getFacility() != null ? policy.getFacility().getName() : updated.getId()), null, updated.getId());

        return toResponse(updated);
    }

    @Override
    public void delete(UUID id) {
        FacilityPolicy policy = facilityPolicyRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.FACILITY_POLICY_NOT_FOUND));

        facilityAccessGuard.checkFacilityAccess(policy.getFacility().getId());

        facilityPolicyRepository.deleteById(policy.getId());

        activityLogService.record(policy.getFacility().getId(), ActivityAction.FACILITY_POLICY_DELETE, "FACILITY_POLICY", policy.getId(),
                "Xóa chính sách cơ sở " + (policy.getFacility() != null ? policy.getFacility().getName() : id), null, null);
    }

    @Override
    @Transactional(readOnly = true)
    public List<UUID> getExceptionGrants(UUID id) {
        FacilityPolicy policy = facilityPolicyRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.FACILITY_POLICY_NOT_FOUND));
        facilityAccessGuard.checkFacilityAccess(policy.getFacility().getId());
        if ("FACILITY_MANAGER".equalsIgnoreCase(requestContext.currentUserRole())) {
            UUID currentUserId = requestContext.currentUserId();
            return currentUserId != null
                    && exceptionGrantRepository.existsByFacilityPolicy_IdAndUser_IdAndIsActiveTrue(id, currentUserId)
                    ? List.of(currentUserId)
                    : List.of();
        }
        return exceptionGrantRepository.findByFacilityPolicy_IdAndIsActiveTrue(id).stream()
                .map(grant -> grant.getUser().getId())
                .toList();
    }

    @Override
    public void setExceptionGrant(UUID id, UUID facilityManagerId, boolean granted) {
        FacilityPolicy policy = facilityPolicyRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.FACILITY_POLICY_NOT_FOUND));
        User manager = userRepository.findById(facilityManagerId)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        // Only a grant needs an eligible manager. Revoking must always work, otherwise the grant of an account
        // that was locked, re-assigned or demoted afterwards could never be removed.
        if (granted) {
            if (manager.getRole() == null || !"FACILITY_MANAGER".equals(manager.getRole().getName())) {
                throw new AppException(ErrorCode.POLICY_EXCEPTION_NOT_FACILITY_MANAGER);
            }
            if (!Boolean.TRUE.equals(manager.getIsActive())) {
                throw new AppException(ErrorCode.POLICY_EXCEPTION_MANAGER_INACTIVE);
            }
            if (manager.getFacility() == null || !manager.getFacility().getId().equals(policy.getFacility().getId())) {
                throw new AppException(ErrorCode.POLICY_EXCEPTION_WRONG_FACILITY);
            }
        }

        User grantingManager = userRepository.findById(requestContext.currentUserId())
                .orElseThrow(() -> new AppException(ErrorCode.UNAUTHORIZED));
        FacilityPolicyExceptionGrant grant = exceptionGrantRepository
                .findByFacilityPolicy_IdAndUser_Id(id, facilityManagerId)
                .orElseGet(() -> FacilityPolicyExceptionGrant.builder()
                        .facilityPolicy(policy)
                        .user(manager)
                        .grantedBy(grantingManager)
                        .build());
        grant.setGrantedBy(grantingManager);
        grant.setIsActive(granted);
        exceptionGrantRepository.save(grant);
        activityLogService.record(policy.getFacility().getId(), ActivityAction.FACILITY_POLICY_EXCEPTION,
                "FACILITY_POLICY", policy.getId(),
                (granted ? "Cấp quyền sửa chính sách ngoại lệ cho " : "Thu hồi quyền sửa chính sách ngoại lệ của ") + manager.getEmail(),
                null, null);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<FacilityPolicyResponse> getAll(String search, int page, int size, String sortBy, String sortDir) {
        String requestedSort = sortBy == null ? "id" : sortBy;
        String resolvedSortBy = "facilityName".equalsIgnoreCase(requestedSort)
                ? "facility.name"
                : (SORTABLE_FIELDS.contains(requestedSort) ? requestedSort : "id");
        Sort sort = "desc".equalsIgnoreCase(sortDir)
                ? Sort.by(resolvedSortBy).descending()
                : Sort.by(resolvedSortBy).ascending();
        Pageable pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 200), sort);
        UUID scopedFacilityId = facilityAccessGuard.scopedFacilityIdOrNull();
        Page<FacilityPolicyResponse> result = facilityPolicyRepository.findAllWithFilters(search, scopedFacilityId, pageable)
                .map(this::toResponse);
        return PageResponse.from(result);
    }

    // ------------------------------------------------------------------ helpers

    private boolean isPublicViewer() {
        String role = requestContext.currentUserRole();
        return role == null || "CUSTOMER".equalsIgnoreCase(role);
    }

    private FacilityPolicyResponse toVisibleResponse(FacilityPolicy policy) {
        if (isPublicViewer() && !Boolean.TRUE.equals(policy.getIsActive())) {
            throw new AppException(ErrorCode.FACILITY_POLICY_NOT_FOUND);
        }
        return toResponse(policy);
    }

    private void validateCancellation(Integer fullRefundHours, Integer partialRefundHours) {
        if (fullRefundHours != null && partialRefundHours != null && fullRefundHours < partialRefundHours) {
            throw new AppException(ErrorCode.FACILITY_POLICY_INVALID_CANCELLATION);
        }
    }

    private void validateOverdueStages(Integer graceDays, Integer accessDisableDays, Integer sealingDays) {
        if (graceDays == null || accessDisableDays == null || sealingDays == null) {
            return;
        }
        if (accessDisableDays < graceDays) {
            throw new AppException(ErrorCode.FACILITY_POLICY_INVALID_OVERDUE_STAGES,
                    "Mốc khóa PIN phải lớn hơn hoặc bằng số ngày ân hạn");
        }
        if (sealingDays < accessDisableDays) {
            throw new AppException(ErrorCode.FACILITY_POLICY_INVALID_OVERDUE_STAGES,
                    "Mốc niêm phong phải lớn hơn hoặc bằng mốc khóa PIN");
        }
    }

    /**
     * Đồng bộ bảng giá riêng theo yêu cầu: cập nhật dòng đã có, thêm dòng mới, xóa dòng không còn.
     * Không xóa rồi thêm lại vì Hibernate chạy INSERT trước DELETE, sẽ đụng ràng buộc duy nhất (chính sách, loại kho).
     */
    private void syncPrices(FacilityPolicy policy, List<FacilityPolicyPriceRequest> priceRequests) {
        if (priceRequests == null) return;

        List<UUID> unitTypeIds = priceRequests.stream()
                .map(FacilityPolicyPriceRequest::getUnitTypeId)
                .toList();
        if (unitTypeIds.stream().distinct().count() != unitTypeIds.size()) {
            throw new AppException(ErrorCode.FACILITY_POLICY_INVALID_PRICES);
        }

        Map<UUID, UnitType> unitTypes = unitTypeRepository.findAllById(unitTypeIds).stream()
                .collect(Collectors.toMap(UnitType::getId, Function.identity()));
        if (unitTypes.size() != unitTypeIds.size()) {
            throw new AppException(ErrorCode.UNIT_TYPE_NOT_FOUND);
        }

        Map<UUID, FacilityPolicyPriceRequest> requested = new LinkedHashMap<>();
        for (FacilityPolicyPriceRequest priceRequest : priceRequests) {
            requested.put(priceRequest.getUnitTypeId(), priceRequest);
        }

        // Xóa các dòng không còn trong yêu cầu
        for (Iterator<FacilityPolicyPrice> it = policy.getPrices().iterator(); it.hasNext(); ) {
            FacilityPolicyPrice existing = it.next();
            if (!requested.containsKey(existing.getUnitType().getId())) {
                it.remove();
            }
        }

        Map<UUID, FacilityPolicyPrice> existingByType = policy.getPrices().stream()
                .collect(Collectors.toMap(price -> price.getUnitType().getId(), Function.identity()));

        for (FacilityPolicyPriceRequest priceRequest : requested.values()) {
            FacilityPolicyPrice price = existingByType.get(priceRequest.getUnitTypeId());
            if (price == null) {
                price = FacilityPolicyPrice.builder()
                        .facilityPolicy(policy)
                        .unitType(unitTypes.get(priceRequest.getUnitTypeId()))
                        .build();
                policy.getPrices().add(price);
            }
            price.setMonthlyPrice(priceRequest.getMonthlyPrice());
            price.setDiscount3MonthPercent(orZero(priceRequest.getDiscount3MonthPercent()));
            price.setDiscount6MonthPercent(orZero(priceRequest.getDiscount6MonthPercent()));
            price.setDiscount12MonthPercent(orZero(priceRequest.getDiscount12MonthPercent()));
        }
    }

    private static double orZero(Double value) {
        return value == null ? 0.0 : value;
    }

    private FacilityPolicyResponse toResponse(FacilityPolicy policy) {
        FacilityPolicyResponse response = facilityPolicyMapper.toResponse(policy);
        response.setPrices(policy.getPrices().stream()
                .map(price -> FacilityPolicyPriceResponse.builder()
                        .unitTypeId(price.getUnitType().getId())
                        .unitTypeName(price.getUnitType().getTypeName())
                        .monthlyPrice(price.getMonthlyPrice())
                        .discount3MonthPercent(price.getDiscount3MonthPercent())
                        .discount6MonthPercent(price.getDiscount6MonthPercent())
                        .discount12MonthPercent(price.getDiscount12MonthPercent())
                        .build())
                .toList());
        return response;
    }
}

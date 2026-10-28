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
import com.boxora.service.FacilityPolicyService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;
import java.util.List;
import java.util.ArrayList;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class FacilityPolicyServiceImpl implements FacilityPolicyService {

    private final FacilityPolicyRepository facilityPolicyRepository;
    private final FacilityRepository facilityRepository;
    private final FacilityPolicyMapper facilityPolicyMapper;
    private final ActivityLogService activityLogService;
    private final FacilityAccessGuard facilityAccessGuard;
    private final FacilityPolicyExceptionGrantRepository exceptionGrantRepository;
    private final UserRepository userRepository;
    private final UnitTypeRepository unitTypeRepository;
    private final RequestContext requestContext;

    @Override
    public FacilityPolicyResponse getById(UUID id) {
        FacilityPolicy policy = facilityPolicyRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.FACILITY_POLICY_NOT_FOUND));

        facilityAccessGuard.checkFacilityAccess(policy.getFacility().getId());
        return toResponse(policy);
    }

    @Override
    public FacilityPolicyResponse getByFacilityId(UUID facilityId) {
        FacilityPolicy policy = facilityPolicyRepository.findByFacility_Id(facilityId)
                .orElseThrow(() -> new AppException(ErrorCode.FACILITY_POLICY_NOT_FOUND));
        facilityAccessGuard.checkFacilityAccess(policy.getFacility().getId());
        return toResponse(policy);
    }

    @Override
    public FacilityPolicyResponse create(FacilityPolicyCreateRequest request) {
        if (request.getCancellationFullRefundHours() != null
                && request.getCancellationPartialRefundHours() != null
                && request.getCancellationFullRefundHours() > request.getCancellationPartialRefundHours()) {
            throw new AppException(ErrorCode.FACILITY_POLICY_INVALID_CANCELLATION);
        }

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

        replacePrices(policy, request.getPrices());
        FacilityPolicy saved = facilityPolicyRepository.save(policy);

        activityLogService.record(facility.getId(), ActivityAction.FACILITY_POLICY_CREATE, "FACILITY_POLICY", saved.getId(),
                "Created policy for facility " + facility.getName(), null, facility.getId());

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

        int fullHours = request.getCancellationFullRefundHours() != null
                ? request.getCancellationFullRefundHours()
                : policy.getCancellationFullRefundHours();
        int partialHours = request.getCancellationPartialRefundHours() != null
                ? request.getCancellationPartialRefundHours()
                : policy.getCancellationPartialRefundHours();

        if (fullHours > partialHours) {
            throw new AppException(ErrorCode.FACILITY_POLICY_INVALID_CANCELLATION);
        }

        facilityPolicyMapper.updateEntityFromRequest(request, policy);
        if (request.getPrices() != null) {
            replacePrices(policy, request.getPrices());
        }
        FacilityPolicy updated = facilityPolicyRepository.save(policy);

        activityLogService.record(policy.getFacility().getId(), ActivityAction.FACILITY_POLICY_UPDATE, "FACILITY_POLICY", updated.getId(),
                "Updated policy for facility " + (policy.getFacility() != null ? policy.getFacility().getName() : updated.getId()), null, updated.getId());

        return toResponse(updated);
    }

    @Override
    public void delete(UUID id) {
        FacilityPolicy policy = facilityPolicyRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.FACILITY_POLICY_NOT_FOUND));

        facilityAccessGuard.checkFacilityAccess(policy.getFacility().getId());

        facilityPolicyRepository.deleteById(policy.getId());

        activityLogService.record(policy.getFacility().getId(), ActivityAction.FACILITY_POLICY_UPDATE, "FACILITY_POLICY", policy.getId(),
                "Deleted policy for facility " + (policy.getFacility() != null ? policy.getFacility().getName() : id), null, null);
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

        if (manager.getRole() == null || !"FACILITY_MANAGER".equals(manager.getRole().getName())
                || !Boolean.TRUE.equals(manager.getIsActive())
                || manager.getFacility() == null
                || !manager.getFacility().getId().equals(policy.getFacility().getId())) {
            throw new AppException(ErrorCode.FORBIDDEN);
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
        activityLogService.record(policy.getFacility().getId(), ActivityAction.FACILITY_POLICY_UPDATE,
                "FACILITY_POLICY", policy.getId(),
                (granted ? "Granted" : "Revoked") + " policy exception for " + manager.getEmail(),
                null, null);
    }

    @Override
    public PageResponse<FacilityPolicyResponse> getAll(String search, int page, int size, String sortBy, String sortDir) {
        String resolvedSortBy = "facilityName".equalsIgnoreCase(sortBy) ? "facility.name" : sortBy;
        Sort sort = sortDir.equalsIgnoreCase("desc")
                ? Sort.by(resolvedSortBy).descending()
                : Sort.by(resolvedSortBy).ascending();
        Pageable pageable = PageRequest.of(page, size, sort);
        UUID scopedFacilityId = facilityAccessGuard.scopedFacilityIdOrNull();
        Page<FacilityPolicyResponse> result = facilityPolicyRepository.findAllWithFilters(search, scopedFacilityId, pageable)
                .map(this::toResponse);
        return PageResponse.from(result);
    }

    private void replacePrices(FacilityPolicy policy, List<FacilityPolicyPriceRequest> priceRequests) {
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

        List<FacilityPolicyPrice> prices = new ArrayList<>();
        for (FacilityPolicyPriceRequest priceRequest : priceRequests) {
            UnitType unitType = unitTypes.get(priceRequest.getUnitTypeId());
            prices.add(FacilityPolicyPrice.builder()
                    .facilityPolicy(policy)
                    .unitType(unitType)
                    .monthlyPrice(priceRequest.getMonthlyPrice())
                    .discount3MonthPercent(priceRequest.getDiscount3MonthPercent() == null ? 0.0 : priceRequest.getDiscount3MonthPercent())
                    .discount6MonthPercent(priceRequest.getDiscount6MonthPercent() == null ? 0.0 : priceRequest.getDiscount6MonthPercent())
                    .discount12MonthPercent(priceRequest.getDiscount12MonthPercent() == null ? 0.0 : priceRequest.getDiscount12MonthPercent())
                    .build());
        }
        policy.getPrices().clear();
        policy.getPrices().addAll(prices);
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

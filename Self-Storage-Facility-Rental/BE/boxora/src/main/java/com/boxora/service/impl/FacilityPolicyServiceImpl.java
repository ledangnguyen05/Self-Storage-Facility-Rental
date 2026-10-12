package com.boxora.service.impl;

import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.FacilityPolicyCreateRequest;
import com.boxora.dto.request.FacilityPolicyUpdateRequest;
import com.boxora.dto.response.FacilityPolicyResponse;
import com.boxora.entity.Facility;
import com.boxora.entity.FacilityPolicy;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.mapper.FacilityPolicyMapper;
import com.boxora.repository.FacilityPolicyRepository;
import com.boxora.repository.FacilityRepository;
import com.boxora.enums.ActivityAction;
import com.boxora.security.FacilityAccessGuard;
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

    @Override
    public FacilityPolicyResponse getById(UUID id) {
        FacilityPolicy policy = facilityPolicyRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.FACILITY_POLICY_NOT_FOUND));

        facilityAccessGuard.checkFacilityAccess(policy.getFacility().getId());
        return facilityPolicyMapper.toResponse(policy);
    }

    @Override
    public FacilityPolicyResponse getByFacilityId(UUID facilityId) {
        FacilityPolicy policy = facilityPolicyRepository.findByFacility_Id(facilityId)
                .orElseThrow(() -> new AppException(ErrorCode.FACILITY_POLICY_NOT_FOUND));
        facilityAccessGuard.checkFacilityAccess(policy.getFacility().getId());
        return facilityPolicyMapper.toResponse(policy);
    }

    @Override
    public FacilityPolicyResponse create(FacilityPolicyCreateRequest request) {
        if (request.getCancellationFullRefundHours() != null
                && request.getCancellationPartialRefundHours() != null
                && request.getCancellationFullRefundHours() < request.getCancellationPartialRefundHours()) {
            throw new AppException(ErrorCode.FACILITY_POLICY_INVALID_CANCELLATION);
        }

        Facility facility = facilityRepository.findById(request.getFacilityId())
                .orElseThrow(() -> new AppException(ErrorCode.FACILITY_NOT_FOUND));

        if (facilityPolicyRepository.existsByFacility_Id(facility.getId())) {
            throw new AppException(ErrorCode.FACILITY_POLICY_ALREADY_EXISTS);
        }

        FacilityPolicy policy = FacilityPolicy.builder()
                .facility(facility)
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

        FacilityPolicy saved = facilityPolicyRepository.save(policy);

        activityLogService.record(facility.getId(), ActivityAction.FACILITY_POLICY_CREATE, "FACILITY_POLICY", saved.getId(),
                "Created policy for facility " + facility.getName(), null, facility.getId());

        return facilityPolicyMapper.toResponse(saved);
    }

    @Override
    public FacilityPolicyResponse update(UUID id, FacilityPolicyUpdateRequest request) {
        FacilityPolicy policy = facilityPolicyRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.FACILITY_POLICY_NOT_FOUND));

        facilityAccessGuard.checkFacilityAccess(policy.getFacility().getId());

        int fullHours = request.getCancellationFullRefundHours() != null
                ? request.getCancellationFullRefundHours()
                : policy.getCancellationFullRefundHours();
        int partialHours = request.getCancellationPartialRefundHours() != null
                ? request.getCancellationPartialRefundHours()
                : policy.getCancellationPartialRefundHours();

        if (fullHours < partialHours) {
            throw new AppException(ErrorCode.FACILITY_POLICY_INVALID_CANCELLATION);
        }

        facilityPolicyMapper.updateEntityFromRequest(request, policy);
        FacilityPolicy updated = facilityPolicyRepository.save(policy);

        activityLogService.record(policy.getFacility().getId(), ActivityAction.FACILITY_POLICY_UPDATE, "FACILITY_POLICY", updated.getId(),
                "Updated policy for facility " + (policy.getFacility() != null ? policy.getFacility().getName() : updated.getId()), null, updated.getId());

        return facilityPolicyMapper.toResponse(updated);
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
    public PageResponse<FacilityPolicyResponse> getAll(String search, int page, int size, String sortBy, String sortDir) {
        String resolvedSortBy = "facilityName".equalsIgnoreCase(sortBy) ? "facility.name" : sortBy;
        Sort sort = sortDir.equalsIgnoreCase("desc")
                ? Sort.by(resolvedSortBy).descending()
                : Sort.by(resolvedSortBy).ascending();
        Pageable pageable = PageRequest.of(page, size, sort);
        UUID scopedFacilityId = facilityAccessGuard.scopedFacilityIdOrNull();
        Page<FacilityPolicyResponse> result = facilityPolicyRepository.findAllWithFilters(search, scopedFacilityId, pageable)
                .map(facilityPolicyMapper::toResponse);
        return PageResponse.from(result);
    }
}

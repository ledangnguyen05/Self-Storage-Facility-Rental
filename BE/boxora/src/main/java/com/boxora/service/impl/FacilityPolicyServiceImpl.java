package com.boxora.service.impl;

import com.boxora.dto.request.FacilityPolicyRequest;
import com.boxora.dto.response.FacilityPolicyResponse;
import com.boxora.entity.Facility;
import com.boxora.entity.FacilityPolicy;
import com.boxora.repository.FacilityPolicyRepository;
import com.boxora.repository.FacilityRepository;
import com.boxora.service.FacilityPolicyService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class FacilityPolicyServiceImpl implements FacilityPolicyService {

    private final FacilityPolicyRepository facilityPolicyRepository;
    private final FacilityRepository facilityRepository;

    @Override
    public FacilityPolicyResponse getActivePolicy(UUID facilityId) {
        FacilityPolicy policy = null;
        if (facilityId != null) {
            policy = facilityPolicyRepository.findByFacility_Id(facilityId).orElse(null);
        }
        if (policy == null) {
            policy = facilityPolicyRepository.findAll().stream().findFirst().orElse(null);
        }

        if (policy == null) {
            return FacilityPolicyResponse.builder()
                    .depositPercentage(100.0)
                    .dailyLateFee(new BigDecimal("50000"))
                    .cancellationRefundDays(7)
                    .miniPrice(new BigDecimal("650000"))
                    .standardPrice(new BigDecimal("1450000"))
                    .climatePrice(new BigDecimal("2350000"))
                    .discount3Months(5)
                    .discount6Months(10)
                    .discount12Months(15)
                    .gracePeriodDays(3)
                    .build();
        }

        return mapToResponse(policy);
    }

    @Override
    public FacilityPolicyResponse updatePolicy(FacilityPolicyRequest request) {
        Facility facility = null;
        if (request.getFacilityId() != null) {
            facility = facilityRepository.findById(request.getFacilityId()).orElse(null);
        }

        FacilityPolicy policy = null;
        if (facility != null) {
            policy = facilityPolicyRepository.findByFacility_Id(facility.getId()).orElse(null);
        }
        if (policy == null) {
            policy = facilityPolicyRepository.findAll().stream().findFirst().orElse(null);
        }

        if (policy == null) {
            policy = FacilityPolicy.builder()
                    .facility(facility)
                    .depositPercentage(request.getDepositPercentage() != null ? request.getDepositPercentage() : 100.0)
                    .dailyLateFee(request.getDailyLateFee() != null ? request.getDailyLateFee() : new BigDecimal("50000"))
                    .cancellationRefundDays(request.getCancellationRefundDays() != null ? request.getCancellationRefundDays() : 7)
                    .build();
        } else {
            if (request.getDepositPercentage() != null) policy.setDepositPercentage(request.getDepositPercentage());
            if (request.getDailyLateFee() != null) policy.setDailyLateFee(request.getDailyLateFee());
            if (request.getCancellationRefundDays() != null) policy.setCancellationRefundDays(request.getCancellationRefundDays());
        }

        policy = facilityPolicyRepository.save(policy);
        return mapToResponse(policy);
    }

    private FacilityPolicyResponse mapToResponse(FacilityPolicy p) {
        return FacilityPolicyResponse.builder()
                .id(p.getId())
                .facilityId(p.getFacility() != null ? p.getFacility().getId() : null)
                .facilityName(p.getFacility() != null ? p.getFacility().getName() : "Mega Central Tân Bình")
                .depositPercentage(p.getDepositPercentage() != null ? p.getDepositPercentage() : 100.0)
                .dailyLateFee(p.getDailyLateFee() != null ? p.getDailyLateFee() : new BigDecimal("50000"))
                .cancellationRefundDays(p.getCancellationRefundDays() != null ? p.getCancellationRefundDays() : 7)
                .miniPrice(new BigDecimal("650000"))
                .standardPrice(new BigDecimal("1450000"))
                .climatePrice(new BigDecimal("2350000"))
                .discount3Months(5)
                .discount6Months(10)
                .discount12Months(15)
                .gracePeriodDays(3)
                .build();
    }
}

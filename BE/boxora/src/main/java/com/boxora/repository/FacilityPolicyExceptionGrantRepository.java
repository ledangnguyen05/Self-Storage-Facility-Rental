package com.boxora.repository;

import com.boxora.entity.FacilityPolicyExceptionGrant;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface FacilityPolicyExceptionGrantRepository extends JpaRepository<FacilityPolicyExceptionGrant, UUID> {

    boolean existsByFacilityPolicy_IdAndUser_IdAndIsActiveTrue(UUID policyId, UUID userId);

    Optional<FacilityPolicyExceptionGrant> findByFacilityPolicy_IdAndUser_Id(UUID policyId, UUID userId);

    List<FacilityPolicyExceptionGrant> findByFacilityPolicy_IdAndIsActiveTrue(UUID policyId);
}

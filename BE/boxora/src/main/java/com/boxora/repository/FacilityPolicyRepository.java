package com.boxora.repository;

import com.boxora.entity.FacilityPolicy;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface FacilityPolicyRepository extends MongoRepository<FacilityPolicy, UUID> {
    Optional<FacilityPolicy> findByFacility_Id(UUID facilityId);
}

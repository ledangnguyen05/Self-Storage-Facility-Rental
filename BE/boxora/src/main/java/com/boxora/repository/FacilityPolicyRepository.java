package com.boxora.repository;

import com.boxora.entity.FacilityPolicy;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface FacilityPolicyRepository extends JpaRepository<FacilityPolicy, UUID> {

    @Override
    @EntityGraph(attributePaths = {"facility", "prices", "prices.unitType"})
    Optional<FacilityPolicy> findById(UUID id);

    @EntityGraph(attributePaths = {"facility", "prices", "prices.unitType"})
    Optional<FacilityPolicy> findByFacility_Id(UUID facilityId);

    @EntityGraph(attributePaths = {"facility", "prices", "prices.unitType"})
    Optional<FacilityPolicy> findByFacility_IdAndIsActiveTrue(UUID facilityId);

    @EntityGraph(attributePaths = {"facility", "prices", "prices.unitType"})
    java.util.List<FacilityPolicy> findByIsActiveTrue();

    default Optional<FacilityPolicy> findByFacilityId(UUID facilityId) {
        return findByFacility_Id(facilityId);
    }

    boolean existsByFacility_Id(UUID facilityId);

    @EntityGraph(attributePaths = {"facility", "prices", "prices.unitType"})
    @Query("""
            SELECT fp FROM FacilityPolicy fp
            WHERE (:search IS NULL
                OR LOWER(fp.facility.name) LIKE LOWER(CONCAT('%', CAST(:search AS string), '%')))
            AND (:scopedFacilityId IS NULL OR fp.facility.id = :scopedFacilityId)
            """)
    Page<FacilityPolicy> findAllWithFilters(
            @Param("search") String search,
            @Param("scopedFacilityId") UUID scopedFacilityId,
            Pageable pageable
    );
}
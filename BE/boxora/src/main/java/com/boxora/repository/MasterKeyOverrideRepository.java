package com.boxora.repository;

import com.boxora.entity.MasterKeyOverride;
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
public interface MasterKeyOverrideRepository extends JpaRepository<MasterKeyOverride, UUID> {

    @EntityGraph(attributePaths = {"facility", "performedBy", "witness"})
    @Query("""
            SELECT m FROM MasterKeyOverride m
            WHERE (:facilityId IS NULL OR m.facility.id = :facilityId)
            """)
    Page<MasterKeyOverride> findAllWithFilters(@Param("facilityId") UUID facilityId, Pageable pageable);

    @Override
    @EntityGraph(attributePaths = {"facility", "performedBy", "witness"})
    Optional<MasterKeyOverride> findById(UUID id);
}
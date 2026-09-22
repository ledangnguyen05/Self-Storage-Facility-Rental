package com.boxora.repository;

import com.boxora.entity.StorageUnit;
import com.boxora.enums.UnitStatus;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface StorageUnitRepository extends JpaRepository<StorageUnit, UUID> {

    @EntityGraph(attributePaths = {"facility", "unitType"})
    Optional<StorageUnit> findWithDetailsById(UUID id);

    // Derived query type-safe bằng Enum UnitStatus – không hardcode magic string
    @EntityGraph(attributePaths = {"facility", "unitType"})
    List<StorageUnit> findByFacility_IdAndUnitType_IdAndStatus(
            UUID facilityId,
            UUID unitTypeId,
            UnitStatus status
    );

    @Query("""
            SELECT su.facility.id, su.facility.name, su.status, COUNT(su)
            FROM StorageUnit su
            GROUP BY su.facility.id, su.facility.name, su.status
            """)
    List<Object[]> countUnitsGroupedByFacilityAndStatus();
}
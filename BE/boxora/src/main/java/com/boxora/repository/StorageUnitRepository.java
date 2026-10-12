package com.boxora.repository;

import com.boxora.entity.StorageUnit;
import com.boxora.enums.UnitStatus;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface StorageUnitRepository extends JpaRepository<StorageUnit, UUID>, JpaSpecificationExecutor<StorageUnit> {

    @EntityGraph(attributePaths = {"facility", "unitType"})
    Optional<StorageUnit> findWithDetailsById(UUID id);

    @EntityGraph(attributePaths = {"facility", "unitType"})
    List<StorageUnit> findByFacility_Id(UUID facilityId);

    @EntityGraph(attributePaths = {"facility", "unitType"})
    List<StorageUnit> findByFacility_IdAndFloorLevel(UUID facilityId, String floorLevel);

    @EntityGraph(attributePaths = {"facility", "unitType"})
    List<StorageUnit> findByFacility_IdAndStatus(UUID facilityId, UnitStatus status);

    @EntityGraph(attributePaths = {"facility", "unitType"})
    List<StorageUnit> findByFacility_IdAndFloorLevelAndStatus(UUID facilityId, String floorLevel, UnitStatus status);

    @EntityGraph(attributePaths = {"facility", "unitType"})
    List<StorageUnit> findByStatus(UnitStatus status);

    @EntityGraph(attributePaths = {"facility", "unitType"})
    List<StorageUnit> findByFacility_IdAndUnitType_IdAndStatus(
            UUID facilityId,
            UUID unitTypeId,
            UnitStatus status
    );

    boolean existsByFacility_IdAndUnitCode(UUID facilityId, String unitCode);

    boolean existsByFacility_IdAndUnitCodeAndIdNot(UUID facilityId, String unitCode, UUID id);

    boolean existsByUnitType_Id(UUID unitTypeId);

    long countByUnitType_Id(UUID unitTypeId);

    List<StorageUnit> findByUnitType_Id(UUID unitTypeId);

    @Query("""
            SELECT su.facility.id, su.facility.name, su.status, COUNT(su)
            FROM StorageUnit su
            GROUP BY su.facility.id, su.facility.name, su.status
            """)
    List<Object[]> countUnitsGroupedByFacilityAndStatus();
}
package com.boxora.repository;

import com.boxora.entity.StorageUnitPriceHistory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface StorageUnitPriceHistoryRepository extends JpaRepository<StorageUnitPriceHistory, UUID> {

    @EntityGraph(attributePaths = {"storageUnit", "storageUnit.facility", "unitType", "changedBy"})
    List<StorageUnitPriceHistory> findByStorageUnit_IdOrderByEffectiveFromDescCreatedAtDesc(UUID storageUnitId);

    @EntityGraph(attributePaths = {"storageUnit", "storageUnit.facility", "unitType", "changedBy"})
    @Query("""
            SELECT h FROM StorageUnitPriceHistory h
            WHERE (:facilityId IS NULL OR h.storageUnit.facility.id = :facilityId)
              AND (:storageUnitId IS NULL OR h.storageUnit.id = :storageUnitId)
            """)
    Page<StorageUnitPriceHistory> findAllWithFilters(
            @Param("facilityId") UUID facilityId,
            @Param("storageUnitId") UUID storageUnitId,
            Pageable pageable
    );

    @EntityGraph(attributePaths = {"storageUnit", "storageUnit.facility", "unitType", "changedBy"})
    @Query("""
            SELECT h FROM StorageUnitPriceHistory h
            WHERE h.storageUnit.id = :storageUnitId
              AND h.effectiveFrom <= :targetTime
            ORDER BY h.effectiveFrom DESC, h.createdAt DESC
            """)
    List<StorageUnitPriceHistory> findEffectivePriceHistory(
            @Param("storageUnitId") UUID storageUnitId,
            @Param("targetTime") LocalDateTime targetTime
    );

    @Override
    @EntityGraph(attributePaths = {"storageUnit", "storageUnit.facility", "unitType", "changedBy"})
    Optional<StorageUnitPriceHistory> findById(UUID id);
}


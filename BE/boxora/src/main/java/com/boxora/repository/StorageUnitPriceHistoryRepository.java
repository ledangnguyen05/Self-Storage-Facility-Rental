package com.boxora.repository;

import com.boxora.entity.StorageUnitPriceHistory;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface StorageUnitPriceHistoryRepository extends JpaRepository<StorageUnitPriceHistory, UUID> {

    @EntityGraph(attributePaths = {"unitType", "changedBy"})
    List<StorageUnitPriceHistory> findByUnitType_IdOrderByEffectiveFromDesc(UUID unitTypeId);

    @EntityGraph(attributePaths = {"unitType", "changedBy"})
    Optional<StorageUnitPriceHistory> findFirstByUnitType_IdAndEffectiveToIsNullOrderByEffectiveFromDesc(UUID unitTypeId);

    @EntityGraph(attributePaths = {"unitType", "changedBy"})
    List<StorageUnitPriceHistory> findAllByOrderByEffectiveFromDesc();
}

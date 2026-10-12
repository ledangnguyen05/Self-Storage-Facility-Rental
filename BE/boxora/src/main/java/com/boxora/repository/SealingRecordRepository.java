package com.boxora.repository;

import com.boxora.entity.SealingRecord;
import com.boxora.enums.SealingStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SealingRecordRepository extends JpaRepository<SealingRecord, UUID>, JpaSpecificationExecutor<SealingRecord> {

    @EntityGraph(attributePaths = {"storageUnit", "contract", "facility", "sealedBy", "witness", "unsealedBy"})
    Optional<SealingRecord> findBySealTagNumber(String sealTagNumber);

    @EntityGraph(attributePaths = {"storageUnit", "contract", "facility", "sealedBy", "witness", "unsealedBy"})
    List<SealingRecord> findByStorageUnit_Id(UUID storageUnitId);

    @EntityGraph(attributePaths = {"storageUnit", "contract", "facility", "sealedBy", "witness", "unsealedBy"})
    Optional<SealingRecord> findByStorageUnit_IdAndStatus(UUID storageUnitId, SealingStatus status);

    boolean existsByContract_IdAndStatus(UUID contractId, SealingStatus status);

    boolean existsByStorageUnit_IdAndStatus(UUID storageUnitId, SealingStatus status);

    default boolean existsByUnitIdAndStatus(UUID unitId, SealingStatus status) {
        return existsByStorageUnit_IdAndStatus(unitId, status);
    }

    default boolean existsByContractIdAndStatus(UUID contractId, SealingStatus status) {
        return existsByContract_IdAndStatus(contractId, status);
    }

    Optional<SealingRecord> findFirstByContract_IdAndStatusOrderByCreatedAtDesc(UUID contractId, SealingStatus status);

    default Optional<SealingRecord> findFirstByContractIdAndStatusOrderByCreatedAtDesc(UUID contractId, SealingStatus status) {
        return findFirstByContract_IdAndStatusOrderByCreatedAtDesc(contractId, status);
    }

    default Optional<SealingRecord> findFirstByUnitIdAndStatusOrderByCreatedAtDesc(UUID unitId, SealingStatus status) {
        return findByStorageUnit_IdAndStatus(unitId, status);
    }

    @EntityGraph(attributePaths = {"storageUnit", "contract", "facility", "sealedBy", "witness", "unsealedBy"})
    @Query("""
            SELECT s FROM SealingRecord s
            WHERE (:facilityId IS NULL OR s.facility.id = :facilityId)
              AND (:status IS NULL OR s.status = :status)
            """)
    Page<SealingRecord> findAllWithFilters(
            @Param("facilityId") UUID facilityId,
            @Param("status") SealingStatus status,
            Pageable pageable
    );
}

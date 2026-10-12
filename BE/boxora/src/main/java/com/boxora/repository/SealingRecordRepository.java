package com.boxora.repository;

import com.boxora.entity.SealingRecord;
import com.boxora.enums.SealingStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SealingRecordRepository extends JpaRepository<SealingRecord, UUID>, JpaSpecificationExecutor<SealingRecord> {

    Optional<SealingRecord> findByProtocolNumber(String protocolNumber);

    List<SealingRecord> findByContractId(UUID contractId);

    List<SealingRecord> findByUnitId(UUID unitId);

    Page<SealingRecord> findByFacilityId(UUID facilityId, Pageable pageable);

    boolean existsByUnitIdAndStatus(UUID unitId, SealingStatus status);

    boolean existsByContractIdAndStatus(UUID contractId, SealingStatus status);

    Optional<SealingRecord> findFirstByContractIdAndStatusOrderByCreatedAtDesc(UUID contractId, SealingStatus status);

    Optional<SealingRecord> findFirstByUnitIdAndStatusOrderByCreatedAtDesc(UUID unitId, SealingStatus status);
}

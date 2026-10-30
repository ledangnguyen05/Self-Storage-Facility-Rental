package com.boxora.repository;

import com.boxora.entity.SettlementSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SettlementSnapshotRepository extends JpaRepository<SettlementSnapshot, UUID> {
    List<SettlementSnapshot> findByHandoverRecord_IdOrderBySettlementVersionAsc(UUID handoverRecordId);
    List<SettlementSnapshot> findByBooking_IdOrderBySettlementVersionAsc(UUID bookingId);
    Optional<SettlementSnapshot> findTopByHandoverRecord_IdOrderBySettlementVersionDesc(UUID handoverRecordId);
    Optional<SettlementSnapshot> findByHandoverRecord_IdAndSettlementVersion(UUID handoverRecordId, Integer settlementVersion);
}

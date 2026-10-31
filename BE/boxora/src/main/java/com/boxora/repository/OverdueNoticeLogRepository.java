package com.boxora.repository;

import com.boxora.entity.OverdueNoticeLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface OverdueNoticeLogRepository extends JpaRepository<OverdueNoticeLog, UUID> {
    List<OverdueNoticeLog> findByContract_IdOrderBySentAtDesc(UUID contractId);
    long countByContract_Id(UUID contractId);
}

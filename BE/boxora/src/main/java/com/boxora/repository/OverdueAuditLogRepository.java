package com.boxora.repository;

import com.boxora.entity.OverdueAuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface OverdueAuditLogRepository extends JpaRepository<OverdueAuditLog, UUID> {
    List<OverdueAuditLog> findByContract_IdOrderByCreatedAtDesc(UUID contractId);
}


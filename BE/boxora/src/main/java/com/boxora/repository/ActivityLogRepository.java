package com.boxora.repository;

import com.boxora.entity.ActivityLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface ActivityLogRepository
        extends JpaRepository<ActivityLog, UUID>, JpaSpecificationExecutor<ActivityLog> {

    boolean existsByResourceIdAndAction(UUID resourceId, com.boxora.enums.ActivityAction action);

    @org.springframework.data.jpa.repository.Modifying(flushAutomatically = true, clearAutomatically = true)
    @org.springframework.data.jpa.repository.Query("UPDATE ActivityLog a SET a.facility = null WHERE a.facility.id = :facilityId")
    int detachFacility(@org.springframework.data.repository.query.Param("facilityId") UUID facilityId);
}
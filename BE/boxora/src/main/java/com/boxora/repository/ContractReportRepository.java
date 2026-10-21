package com.boxora.repository;

import com.boxora.entity.RentalContract;
import com.boxora.enums.RentalContractStatus;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

/** Contract queries for the overdue-debt report. */
public interface ContractReportRepository extends Repository<RentalContract, UUID> {

    /** Contracts in one of {@code statuses} whose end date is before {@code today}, optionally for one facility. */
    @EntityGraph(attributePaths = {"customer", "unit", "facility", "booking"})
    @Query("""
            SELECT c FROM RentalContract c
            WHERE c.status IN :statuses
            AND c.endDate < :today
            AND (:facilityId IS NULL OR c.facility.id = :facilityId)
            ORDER BY c.endDate ASC
            """)
    List<RentalContract> findPastDue(
            @Param("statuses") Collection<RentalContractStatus> statuses,
            @Param("today") LocalDate today,
            @Param("facilityId") UUID facilityId
    );
}

package com.boxora.repository;

import com.boxora.entity.ShiftSwapRequest;
import com.boxora.enums.ShiftSwapStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ShiftSwapRequestRepository extends JpaRepository<ShiftSwapRequest, UUID>, JpaSpecificationExecutor<ShiftSwapRequest> {

    @Override
    @EntityGraph(attributePaths = {
            "assignment", "assignment.staff", "assignment.facility",
            "targetAssignment", "requester", "targetStaff", "facility", "reviewedBy"
    })
    Page<ShiftSwapRequest> findAll(Specification<ShiftSwapRequest> spec, Pageable pageable);

    @Override
    @EntityGraph(attributePaths = {
            "assignment", "assignment.staff", "assignment.facility",
            "targetAssignment", "requester", "targetStaff", "facility", "reviewedBy"
    })
    Optional<ShiftSwapRequest> findById(UUID id);

    @EntityGraph(attributePaths = {
            "assignment", "targetAssignment", "requester", "targetStaff", "facility", "reviewedBy"
    })
    List<ShiftSwapRequest> findByFacility_IdOrderByCreatedAtDesc(UUID facilityId);

    @EntityGraph(attributePaths = {
            "assignment", "targetAssignment", "requester", "targetStaff", "facility", "reviewedBy"
    })
    List<ShiftSwapRequest> findByFacility_IdAndStatusOrderByCreatedAtDesc(UUID facilityId, ShiftSwapStatus status);

    @EntityGraph(attributePaths = {
            "assignment", "targetAssignment", "requester", "targetStaff", "facility", "reviewedBy"
    })
    @Query("""
            SELECT r FROM ShiftSwapRequest r
            WHERE (r.requester.id = :staffId
                   OR (r.targetStaff.id = :staffId
                       AND (r.status = com.boxora.enums.ShiftSwapStatus.MANAGER_APPROVED
                            OR (r.status IN (com.boxora.enums.ShiftSwapStatus.APPROVED, com.boxora.enums.ShiftSwapStatus.REJECTED)
                                AND r.targetStaffRespondedAt IS NOT NULL))))
            ORDER BY r.createdAt DESC
            """)
    List<ShiftSwapRequest> findByStaffInvolvement(@Param("staffId") UUID staffId);

    @EntityGraph(attributePaths = {
            "assignment", "targetAssignment", "requester", "targetStaff", "facility", "reviewedBy"
    })
    @Query("""
            SELECT r FROM ShiftSwapRequest r
            WHERE (:facilityId IS NULL OR r.facility.id = :facilityId)
              AND (:status IS NULL OR r.status = :status)
              AND (:staffId IS NULL OR r.requester.id = :staffId OR r.targetStaff.id = :staffId)
              AND (CAST(:fromDate AS date) IS NULL OR (r.assignment IS NOT NULL AND r.assignment.assignedDate >= :fromDate))
              AND (CAST(:toDate AS date) IS NULL OR (r.assignment IS NOT NULL AND r.assignment.assignedDate <= :toDate))
            """)
    Page<ShiftSwapRequest> findAllWithFilters(
            @Param("facilityId") UUID facilityId,
            @Param("status") ShiftSwapStatus status,
            @Param("staffId") UUID staffId,
            @Param("fromDate") LocalDate fromDate,
            @Param("toDate") LocalDate toDate,
            Pageable pageable
    );
}

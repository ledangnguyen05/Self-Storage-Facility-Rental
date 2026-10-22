package com.boxora.repository;

import com.boxora.entity.StaffAssignment;
import com.boxora.enums.StaffAssignmentStatus;
import com.boxora.enums.StaffShift;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface StaffAssignmentRepository extends JpaRepository<StaffAssignment, UUID>, JpaSpecificationExecutor<StaffAssignment> {

    @Override
    @EntityGraph(attributePaths = {"staff", "facility", "assignedBy"})
    Optional<StaffAssignment> findById(UUID id);

    @EntityGraph(attributePaths = {"staff", "facility", "assignedBy"})
    List<StaffAssignment> findByFacility_IdAndAssignedDate(UUID facilityId, LocalDate assignedDate);

    @EntityGraph(attributePaths = {"staff", "facility", "assignedBy"})
    List<StaffAssignment> findByFacility_IdAndAssignedDateOrderByShiftAscCreatedAtAsc(UUID facilityId, LocalDate assignedDate);

    @EntityGraph(attributePaths = {"staff", "facility", "assignedBy"})
    List<StaffAssignment> findByStaff_IdAndAssignedDate(UUID staffId, LocalDate assignedDate);

    @EntityGraph(attributePaths = {"staff", "facility", "assignedBy"})
    List<StaffAssignment> findByStaff_IdAndAssignedDateBetween(UUID staffId, LocalDate fromDate, LocalDate toDate);

    @EntityGraph(attributePaths = {"staff", "facility", "assignedBy"})
    List<StaffAssignment> findByFacility_Id(UUID facilityId);

    boolean existsByStaff_IdAndAssignedDateAndShift(UUID staffId, LocalDate assignedDate, StaffShift shift);

    boolean existsByStaff_IdAndAssignedDateAndShiftAndIdNot(UUID staffId, LocalDate assignedDate, StaffShift shift, UUID id);

    boolean existsByStaff_IdAndFacility_IdAndAssignedDateAndStatusNotIn(UUID staffId, UUID facilityId, LocalDate assignedDate, List<StaffAssignmentStatus> statuses);

    boolean existsByStaff_IdAndFacility_Id(UUID staffId, UUID facilityId);

    @Override
    @EntityGraph(attributePaths = {"staff", "facility", "assignedBy"})
    Page<StaffAssignment> findAll(org.springframework.data.jpa.domain.Specification<StaffAssignment> spec, Pageable pageable);

    @EntityGraph(attributePaths = {"staff", "facility", "assignedBy"})
    @Query("""
            SELECT a FROM StaffAssignment a
            WHERE (:facilityId IS NULL OR a.facility.id = :facilityId)
              AND (:staffId IS NULL OR a.staff.id = :staffId)
              AND (:assignedDate IS NULL OR a.assignedDate = :assignedDate)
              AND (:shift IS NULL OR a.shift = :shift)
              AND (:status IS NULL OR a.status = :status)
              AND (CAST(:fromDate AS date) IS NULL OR a.assignedDate >= :fromDate)
              AND (CAST(:toDate AS date) IS NULL OR a.assignedDate <= :toDate)
            """)
    Page<StaffAssignment> findAllWithFilters(
            @Param("facilityId") UUID facilityId,
            @Param("staffId") UUID staffId,
            @Param("assignedDate") LocalDate assignedDate,
            @Param("shift") StaffShift shift,
            @Param("status") StaffAssignmentStatus status,
            @Param("fromDate") LocalDate fromDate,
            @Param("toDate") LocalDate toDate,
            Pageable pageable
    );
    @org.springframework.data.jpa.repository.Modifying
    @Query("""
            UPDATE StaffAssignment a
            SET a.status = com.boxora.enums.StaffAssignmentStatus.ABSENT
            WHERE a.status = com.boxora.enums.StaffAssignmentStatus.ASSIGNED
              AND a.checkedInAt IS NULL
              AND a.assignedDate < :today
            """)
    int markPastUncheckedInAsAbsent(@Param("today") LocalDate today);

    @org.springframework.data.jpa.repository.Modifying
    @Query("""
            UPDATE StaffAssignment a
            SET a.status = com.boxora.enums.StaffAssignmentStatus.ABSENT
            WHERE a.status = com.boxora.enums.StaffAssignmentStatus.ASSIGNED
              AND a.checkedInAt IS NULL
              AND a.assignedDate = :today
              AND a.endTime IS NOT NULL
              AND (a.startTime IS NULL OR a.endTime > a.startTime)
              AND a.endTime <= :nowTime
            """)
    int markTodayEndedUncheckedInAsAbsent(@Param("today") LocalDate today, @Param("nowTime") java.time.LocalTime nowTime);
}

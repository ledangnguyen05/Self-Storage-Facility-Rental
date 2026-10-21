package com.boxora.repository;

import com.boxora.entity.ShiftHandover;
import com.boxora.enums.ShiftHandoverStatus;
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
public interface ShiftHandoverRepository extends JpaRepository<ShiftHandover, UUID>, JpaSpecificationExecutor<ShiftHandover> {

    @Override
    @EntityGraph(attributePaths = {
            "facility", "outgoingStaff", "incomingStaff",
            "outgoingAssignment", "incomingAssignment"
    })
    Page<ShiftHandover> findAll(Specification<ShiftHandover> spec, Pageable pageable);

    @Override
    @EntityGraph(attributePaths = {
            "facility", "outgoingStaff", "incomingStaff",
            "outgoingAssignment", "incomingAssignment"
    })
    Optional<ShiftHandover> findById(UUID id);

    @EntityGraph(attributePaths = {
            "facility", "outgoingStaff", "incomingStaff",
            "outgoingAssignment", "incomingAssignment"
    })
    List<ShiftHandover> findByFacility_IdOrderByHandoverDateDescCreatedAtDesc(UUID facilityId);

    @EntityGraph(attributePaths = {
            "facility", "outgoingStaff", "incomingStaff",
            "outgoingAssignment", "incomingAssignment"
    })
    List<ShiftHandover> findByFacility_IdAndHandoverDateOrderByCreatedAtDesc(UUID facilityId, LocalDate handoverDate);

    @EntityGraph(attributePaths = {
            "facility", "outgoingStaff", "incomingStaff",
            "outgoingAssignment", "incomingAssignment"
    })
    @Query("""
            SELECT h FROM ShiftHandover h
            WHERE (:facilityId IS NULL OR h.facility.id = :facilityId)
              AND (:date IS NULL OR h.handoverDate = :date)
              AND (:status IS NULL OR h.status = :status)
              AND (CAST(:fromDate AS date) IS NULL OR h.handoverDate >= :fromDate)
              AND (CAST(:toDate AS date) IS NULL OR h.handoverDate <= :toDate)
            """)
    Page<ShiftHandover> findAllWithFilters(
            @Param("facilityId") UUID facilityId,
            @Param("date") LocalDate date,
            @Param("status") ShiftHandoverStatus status,
            @Param("fromDate") LocalDate fromDate,
            @Param("toDate") LocalDate toDate,
            Pageable pageable
    );
}

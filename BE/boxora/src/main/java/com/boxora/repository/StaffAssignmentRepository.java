package com.boxora.repository;

import com.boxora.entity.StaffAssignment;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public interface StaffAssignmentRepository extends JpaRepository<StaffAssignment, UUID> {

    @EntityGraph(attributePaths = {"staff", "facility", "assignedBy"})
    List<StaffAssignment> findByFacility_IdAndAssignedDate(UUID facilityId, LocalDate assignedDate);

    @EntityGraph(attributePaths = {"staff", "facility", "assignedBy"})
    List<StaffAssignment> findByStaff_IdAndAssignedDate(UUID staffId, LocalDate assignedDate);

    @EntityGraph(attributePaths = {"staff", "facility", "assignedBy"})
    List<StaffAssignment> findByFacility_Id(UUID facilityId);
}

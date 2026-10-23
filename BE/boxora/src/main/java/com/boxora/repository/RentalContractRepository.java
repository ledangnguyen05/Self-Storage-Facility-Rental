package com.boxora.repository;

import com.boxora.entity.RentalContract;
import com.boxora.enums.RentalContractStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface RentalContractRepository extends JpaRepository<RentalContract, UUID>, JpaSpecificationExecutor<RentalContract> {

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("SELECT c FROM RentalContract c WHERE c.id = :id")
    Optional<RentalContract> findByIdForUpdate(@org.springframework.data.repository.query.Param("id") UUID id);

    List<RentalContract> findByCustomerId(UUID customerId);

    Page<RentalContract> findByCustomerId(UUID customerId, Pageable pageable);

    List<RentalContract> findByFacilityId(UUID facilityId);

    Page<RentalContract> findByFacilityId(UUID facilityId, Pageable pageable);

    Optional<RentalContract> findByDocusealSubmissionId(Long submissionId);

    Optional<RentalContract> findByDocusealSubmitterSlug(String submitterSlug);

    Optional<RentalContract> findByBookingId(UUID bookingId);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("SELECT c FROM RentalContract c WHERE c.booking.id = :bookingId")
    Optional<RentalContract> findByBookingIdForUpdate(@org.springframework.data.repository.query.Param("bookingId") UUID bookingId);

    Optional<RentalContract> findByContractCodeIgnoreCase(String contractCode);

    List<RentalContract> findByStatus(RentalContractStatus status);

    boolean existsByUnit_Id(UUID unitId);

    boolean existsByUnit_IdAndStatusIn(UUID unitId, java.util.Collection<RentalContractStatus> statuses);

    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"customer", "unit", "facility", "booking"})
    Optional<RentalContract> findFirstByUnit_IdOrderByCreatedAtDesc(UUID unitId);

    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"customer", "unit", "facility", "booking"})
    Optional<RentalContract> findFirstByUnit_IdAndStatusInOrderByCreatedAtDesc(UUID unitId, java.util.Collection<RentalContractStatus> statuses);

    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"customer", "unit", "unit.facility", "facility", "booking"})
    @org.springframework.data.jpa.repository.Query("""
            SELECT c FROM RentalContract c
            WHERE c.status IN (com.boxora.enums.RentalContractStatus.ACTIVE, com.boxora.enums.RentalContractStatus.OVERDUE)
              AND c.endDate < :currentDate
            ORDER BY c.endDate ASC
            """)
    List<RentalContract> findActiveOrOverdueContractsBeforeDate(
            @org.springframework.data.repository.query.Param("currentDate") java.time.LocalDate currentDate
    );

    @org.springframework.data.jpa.repository.Query("""
            SELECT COUNT(c) FROM RentalContract c
            WHERE c.status IN (com.boxora.enums.RentalContractStatus.ACTIVE, com.boxora.enums.RentalContractStatus.OVERDUE)
              AND c.endDate < :currentDate
            """)
    long countActiveOrOverdueContractsBeforeDate(
            @org.springframework.data.repository.query.Param("currentDate") java.time.LocalDate currentDate
    );
}

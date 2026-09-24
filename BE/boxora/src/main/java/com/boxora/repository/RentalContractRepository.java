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

    List<RentalContract> findByCustomerId(UUID customerId);

    Page<RentalContract> findByCustomerId(UUID customerId, Pageable pageable);

    List<RentalContract> findByFacilityId(UUID facilityId);

    Page<RentalContract> findByFacilityId(UUID facilityId, Pageable pageable);

    Optional<RentalContract> findByDocusealSubmissionId(Long submissionId);

    Optional<RentalContract> findByDocusealSubmitterSlug(String submitterSlug);

    Optional<RentalContract> findByBookingId(UUID bookingId);

    List<RentalContract> findByStatus(RentalContractStatus status);
}

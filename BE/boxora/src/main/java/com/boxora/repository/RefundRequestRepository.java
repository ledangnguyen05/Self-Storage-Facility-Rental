package com.boxora.repository;

import com.boxora.entity.RefundRequest;
import com.boxora.enums.RefundStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface RefundRequestRepository extends JpaRepository<RefundRequest, UUID>, JpaSpecificationExecutor<RefundRequest> {

    Optional<RefundRequest> findByRequestCode(String requestCode);

    List<RefundRequest> findByCustomerId(UUID customerId);

    Page<RefundRequest> findByCustomerId(UUID customerId, Pageable pageable);

    List<RefundRequest> findByFacilityId(UUID facilityId);

    Page<RefundRequest> findByFacilityId(UUID facilityId, Pageable pageable);

    List<RefundRequest> findByBookingId(UUID bookingId);

    Optional<RefundRequest> findFirstByBooking_IdOrderByCreatedAtDesc(UUID bookingId);

    boolean existsByBooking_IdAndStatusIn(UUID bookingId, List<RefundStatus> statuses);

    List<RefundRequest> findByContractId(UUID contractId);

    List<RefundRequest> findByStatus(RefundStatus status);
}

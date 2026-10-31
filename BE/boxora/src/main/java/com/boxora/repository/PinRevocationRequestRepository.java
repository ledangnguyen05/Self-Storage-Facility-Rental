package com.boxora.repository;

import com.boxora.entity.PinRevocationRequest;
import com.boxora.enums.PinRevocationExecutionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PinRevocationRequestRepository extends JpaRepository<PinRevocationRequest, UUID> {
    List<PinRevocationRequest> findByContract_IdOrderByCreatedAtDesc(UUID contractId);
    Optional<PinRevocationRequest> findTopByContract_IdOrderByCreatedAtDesc(UUID contractId);
    long countByStatus(PinRevocationExecutionStatus status);
}


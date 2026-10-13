package com.boxora.repository;

import com.boxora.entity.ContractRenewal;
import com.boxora.enums.ContractRenewalStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ContractRenewalRepository extends JpaRepository<ContractRenewal, UUID>, JpaSpecificationExecutor<ContractRenewal> {

    List<ContractRenewal> findByContractId(UUID contractId);

    Page<ContractRenewal> findByContractId(UUID contractId, Pageable pageable);

    Optional<ContractRenewal> findByPaymentId(UUID paymentId);

    Optional<ContractRenewal> findByDocusealSubmissionId(Long submissionId);

    Optional<ContractRenewal> findByDocusealSubmitterSlug(String submitterSlug);

    List<ContractRenewal> findByStatus(ContractRenewalStatus status);

    Optional<ContractRenewal> findFirstByContractIdOrderByCreatedAtDesc(UUID contractId);
}

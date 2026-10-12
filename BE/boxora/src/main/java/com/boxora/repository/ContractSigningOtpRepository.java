package com.boxora.repository;

import com.boxora.entity.ContractSigningOtp;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ContractSigningOtpRepository extends JpaRepository<ContractSigningOtp, UUID> {
    Optional<ContractSigningOtp> findByContract_Id(UUID contractId);
}

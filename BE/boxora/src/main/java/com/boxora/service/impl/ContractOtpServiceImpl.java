package com.boxora.service.impl;

import com.boxora.dto.response.ContractOtpResponse;
import com.boxora.entity.ContractSigningOtp;
import com.boxora.entity.RentalContract;
import com.boxora.enums.RentalContractStatus;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.repository.ContractSigningOtpRepository;
import com.boxora.repository.RentalContractRepository;
import com.boxora.security.RequestContext;
import com.boxora.service.ContractOtpService;
import com.boxora.service.ContractSigningService;
import com.boxora.service.EmailService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Locale;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ContractOtpServiceImpl implements ContractOtpService {

    private static final int OTP_TTL_SECONDS = 300;
    private static final int RESEND_COOLDOWN_SECONDS = 60;
    private static final int MAX_FAILED_ATTEMPTS = 5;

    private final ContractSigningOtpRepository otpRepository;
    private final RentalContractRepository contractRepository;
    private final RequestContext requestContext;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;
    private final ContractSigningService contractSigningService;
    private final SecureRandom secureRandom = new SecureRandom();

    @Override
    @Transactional
    public ContractOtpResponse sendOtp(UUID contractId) {
        RentalContract contract = getPendingCustomerContract(contractId);
        ContractSigningOtp existing = otpRepository.findByContract_Id(contractId).orElse(null);
        if (existing != null && !existing.isRevoked() && existing.getVerifiedAt() != null) {
            throw new AppException(ErrorCode.CONTRACT_OTP_ALREADY_VERIFIED);
        }
        if (existing != null && resendWaitSeconds(existing) > 0) {
            throw new AppException(ErrorCode.CONTRACT_OTP_RESEND_TOO_SOON);
        }
        return issueOtp(contract, existing);
    }

    @Override
    @Transactional
    public ContractOtpResponse resendOtp(UUID contractId) {
        RentalContract contract = getPendingCustomerContract(contractId);
        ContractSigningOtp existing = otpRepository.findByContract_Id(contractId)
                .orElseThrow(() -> new AppException(ErrorCode.CONTRACT_OTP_NOT_FOUND));
        if (!existing.isRevoked() && existing.getVerifiedAt() != null) {
            throw new AppException(ErrorCode.CONTRACT_OTP_ALREADY_VERIFIED);
        }
        if (resendWaitSeconds(existing) > 0) {
            throw new AppException(ErrorCode.CONTRACT_OTP_RESEND_TOO_SOON);
        }
        return issueOtp(contract, existing);
    }

    @Override
    @Transactional(noRollbackFor = AppException.class)
    public ContractOtpResponse verifyOtp(UUID contractId, String otp) {
        getPendingCustomerContract(contractId);
        ContractSigningOtp challenge = otpRepository.findByContract_Id(contractId)
                .orElseThrow(() -> new AppException(ErrorCode.CONTRACT_OTP_NOT_FOUND));

        if (challenge.isRevoked() || challenge.getExpiresAt().isBefore(LocalDateTime.now())) {
            challenge.setRevoked(true);
            otpRepository.save(challenge);
            throw new AppException(ErrorCode.CONTRACT_OTP_INVALID);
        }
        if (challenge.getFailedAttempts() >= MAX_FAILED_ATTEMPTS) {
            challenge.setRevoked(true);
            otpRepository.save(challenge);
            throw new AppException(ErrorCode.CONTRACT_OTP_ATTEMPTS_EXCEEDED);
        }
        if (!passwordEncoder.matches(otp, challenge.getOtpHash())) {
            challenge.setFailedAttempts(challenge.getFailedAttempts() + 1);
            if (challenge.getFailedAttempts() >= MAX_FAILED_ATTEMPTS) {
                challenge.setRevoked(true);
                otpRepository.save(challenge);
                throw new AppException(ErrorCode.CONTRACT_OTP_ATTEMPTS_EXCEEDED);
            }
            otpRepository.save(challenge);
            throw new AppException(ErrorCode.CONTRACT_OTP_INVALID);
        }

        if (challenge.getVerifiedAt() == null) {
            challenge.setVerifiedAt(LocalDateTime.now());
            challenge.setFailedAttempts(0);
            otpRepository.save(challenge);
        }

        String signingUrl = contractSigningService.createSigningRequest(contractId);
        return ContractOtpResponse.builder()
                .expiresInSeconds(0)
                .resendInSeconds(0)
                .signingUrl(signingUrl)
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public void requireVerified(UUID contractId) {
        if (!"CUSTOMER".equalsIgnoreCase(requestContext.currentUserRole())) {
            return;
        }
        ContractSigningOtp challenge = otpRepository.findByContract_Id(contractId)
                .orElseThrow(() -> new AppException(ErrorCode.CONTRACT_OTP_NOT_FOUND));
        if (challenge.isRevoked() || challenge.getVerifiedAt() == null) {
            throw new AppException(ErrorCode.CONTRACT_OTP_INVALID);
        }
    }

    private RentalContract getPendingCustomerContract(UUID contractId) {
        RentalContract contract = contractRepository.findById(contractId)
                .orElseThrow(() -> new AppException(ErrorCode.CONTRACT_NOT_FOUND));
        UUID currentUserId = requestContext.currentUserId();
        boolean isOwner = currentUserId != null && contract.getCustomer() != null && currentUserId.equals(contract.getCustomer().getId());
        if (!isOwner && "CUSTOMER".equalsIgnoreCase(requestContext.currentUserRole())) {
            throw new AppException(ErrorCode.FORBIDDEN);
        }
        if (contract.getStatus() != RentalContractStatus.PENDING_SIGNATURE) {
            throw new AppException(ErrorCode.CONTRACT_ALREADY_SIGNED);
        }
        return contract;
    }

    private ContractOtpResponse issueOtp(RentalContract contract, ContractSigningOtp challenge) {
        String otp = String.format(Locale.ROOT, "%06d", secureRandom.nextInt(1_000_000));
        LocalDateTime now = LocalDateTime.now();
        if (challenge == null) {
            challenge = ContractSigningOtp.builder()
                    .contract(contract)
                    .otpHash(passwordEncoder.encode(otp))
                    .expiresAt(now.plusSeconds(OTP_TTL_SECONDS))
                    .lastSentAt(now)
                    .build();
        } else {
            challenge.setOtpHash(passwordEncoder.encode(otp));
            challenge.setExpiresAt(now.plusSeconds(OTP_TTL_SECONDS));
            challenge.setLastSentAt(now);
            challenge.setFailedAttempts(0);
            challenge.setVerifiedAt(null);
            challenge.setRevoked(false);
        }
        otpRepository.save(challenge);
        emailService.sendContractSigningOtp(contract.getCustomer().getEmail(), otp);
        return ContractOtpResponse.builder()
                .expiresInSeconds(OTP_TTL_SECONDS)
                .resendInSeconds(RESEND_COOLDOWN_SECONDS)
                .build();
    }

    private int resendWaitSeconds(ContractSigningOtp challenge) {
        long seconds = Duration.between(LocalDateTime.now(), challenge.getLastSentAt()
                .plusSeconds(RESEND_COOLDOWN_SECONDS)).getSeconds();
        return (int) Math.max(0, seconds);
    }
}

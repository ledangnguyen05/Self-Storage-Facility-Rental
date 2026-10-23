package com.boxora.service;

import com.boxora.entity.ContractSigningOtp;
import com.boxora.entity.RentalContract;
import com.boxora.entity.User;
import com.boxora.enums.RentalContractStatus;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.repository.ContractSigningOtpRepository;
import com.boxora.repository.RentalContractRepository;
import com.boxora.security.RequestContext;
import com.boxora.service.impl.ContractOtpServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ContractOtpServiceTest {

    @Mock
    private ContractSigningOtpRepository otpRepository;

    @Mock
    private RentalContractRepository contractRepository;

    @Mock
    private RequestContext requestContext;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private EmailService emailService;

    @Mock
    private ContractSigningService contractSigningService;

    @InjectMocks
    private ContractOtpServiceImpl contractOtpService;

    private UUID contractId;
    private UUID customerId;
    private RentalContract contract;

    @BeforeEach
    void setUp() {
        contractId = UUID.randomUUID();
        customerId = UUID.randomUUID();
        User customer = User.builder().email("customer@example.com").build();
        customer.setId(customerId);
        contract = RentalContract.builder()
                .customer(customer)
                .status(RentalContractStatus.PENDING_SIGNATURE)
                .build();
        contract.setId(contractId);

        when(requestContext.currentUserId()).thenReturn(customerId);
        when(contractRepository.findById(contractId)).thenReturn(Optional.of(contract));
    }

    @Test
    void sendOtpStoresOnlyHashAndEmailsCode() {
        when(otpRepository.findByContract_Id(contractId)).thenReturn(Optional.empty());
        when(passwordEncoder.encode(anyString())).thenAnswer(invocation -> "hash:" + invocation.getArgument(0));
        when(otpRepository.save(any(ContractSigningOtp.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var response = contractOtpService.sendOtp(contractId);

        ArgumentCaptor<ContractSigningOtp> challengeCaptor = ArgumentCaptor.forClass(ContractSigningOtp.class);
        ArgumentCaptor<String> codeCaptor = ArgumentCaptor.forClass(String.class);
        verify(otpRepository).save(challengeCaptor.capture());
        verify(emailService).sendContractSigningOtp(eq("customer@example.com"), codeCaptor.capture());
        assertThat(codeCaptor.getValue()).matches("\\d{6}");
        assertThat(challengeCaptor.getValue().getOtpHash()).isEqualTo("hash:" + codeCaptor.getValue());
        assertThat(response.getExpiresInSeconds()).isEqualTo(300);
        assertThat(response.getResendInSeconds()).isEqualTo(60);
    }

    @Test
    void resendOtpIsBlockedDuringCooldown() {
        ContractSigningOtp challenge = challenge(LocalDateTime.now());
        when(otpRepository.findByContract_Id(contractId)).thenReturn(Optional.of(challenge));

        AppException exception = assertThrows(AppException.class, () -> contractOtpService.resendOtp(contractId));

        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.CONTRACT_OTP_RESEND_TOO_SOON);
        verify(emailService, never()).sendContractSigningOtp(anyString(), anyString());
    }

    @Test
    void invalidOtpIncrementsAttemptCount() {
        ContractSigningOtp challenge = challenge(LocalDateTime.now().minusMinutes(2));
        when(otpRepository.findByContract_Id(contractId)).thenReturn(Optional.of(challenge));
        when(passwordEncoder.matches("000000", "stored-hash")).thenReturn(false);

        AppException exception = assertThrows(AppException.class,
                () -> contractOtpService.verifyOtp(contractId, "000000"));

        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.CONTRACT_OTP_INVALID);
        assertThat(challenge.getFailedAttempts()).isEqualTo(1);
        verify(otpRepository).save(challenge);
    }

    @Test
    void validOtpReturnsSigningUrlAndMarksChallengeVerified() {
        ContractSigningOtp challenge = challenge(LocalDateTime.now().minusMinutes(2));
        when(otpRepository.findByContract_Id(contractId)).thenReturn(Optional.of(challenge));
        when(passwordEncoder.matches("123456", "stored-hash")).thenReturn(true);
        when(contractSigningService.createSigningRequest(contractId)).thenReturn("https://sign.example.com/token");

        var response = contractOtpService.verifyOtp(contractId, "123456");

        assertThat(response.getSigningUrl()).isEqualTo("https://sign.example.com/token");
        assertThat(challenge.getVerifiedAt()).isNotNull();
        verify(otpRepository).save(challenge);
    }

    private ContractSigningOtp challenge(LocalDateTime lastSentAt) {
        return ContractSigningOtp.builder()
                .contract(contract)
                .otpHash("stored-hash")
                .expiresAt(LocalDateTime.now().plusMinutes(3))
                .lastSentAt(lastSentAt)
                .build();
    }
}

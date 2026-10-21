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
        ArgumentCaptor<String> htmlCaptor = ArgumentCaptor.forClass(String.class);
        verify(otpRepository).save(challengeCaptor.capture());
        // Sent synchronously so the API only reports "sent" when the mail server accepted it.
        verify(emailService).sendNow(eq("customer@example.com"), anyString(), htmlCaptor.capture());
        java.util.regex.Matcher code = java.util.regex.Pattern.compile(">(\\d{6})<").matcher(htmlCaptor.getValue());
        assertThat(code.find()).isTrue();
        assertThat(challengeCaptor.getValue().getOtpHash()).isEqualTo("hash:" + code.group(1));
        assertThat(response.getExpiresInSeconds()).isEqualTo(300);
        assertThat(response.getResendInSeconds()).isEqualTo(60);
    }

    @Test
    void resendOtpIsBlockedDuringCooldown() {
        ContractSigningOtp challenge = challenge(LocalDateTime.now());
        when(otpRepository.findByContract_Id(contractId)).thenReturn(Optional.of(challenge));

        AppException exception = assertThrows(AppException.class, () -> contractOtpService.resendOtp(contractId));

        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.CONTRACT_OTP_RESEND_TOO_SOON);
        verify(emailService, never()).sendNow(anyString(), anyString(), anyString());
    }

    @Test
    void sendOtpFailureIsAClearErrorNotA500() {
        when(otpRepository.findByContract_Id(contractId)).thenReturn(Optional.empty());
        when(passwordEncoder.encode(anyString())).thenReturn("hash");
        when(otpRepository.save(any(ContractSigningOtp.class))).thenAnswer(invocation -> invocation.getArgument(0));
        doThrow(new AppException(ErrorCode.EMAIL_SEND_FAILED)).when(emailService).sendNow(anyString(), anyString(), anyString());

        AppException exception = assertThrows(AppException.class, () -> contractOtpService.sendOtp(contractId));

        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.CONTRACT_OTP_SEND_FAILED);
        assertThat(exception.getErrorCode().getHttpStatus().value()).isEqualTo(503);
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

    @Test
    void staffCanNeverPassTheSigningOtpCheckForACustomer() {
        when(requestContext.currentUserRole()).thenReturn("STAFF");

        AppException exception = assertThrows(AppException.class, () -> contractOtpService.requireVerified(contractId));

        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.CONTRACT_SIGNER_NOT_CUSTOMER);
        verify(otpRepository, never()).findByContract_Id(any());
    }

    @Test
    void anotherCustomerCannotSignThisContract() {
        when(requestContext.currentUserRole()).thenReturn("CUSTOMER");
        when(requestContext.currentUserId()).thenReturn(UUID.randomUUID());

        AppException exception = assertThrows(AppException.class, () -> contractOtpService.requireVerified(contractId));

        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.CONTRACT_SIGNER_NOT_CUSTOMER);
    }

    @Test
    void customerStillNeedsAVerifiedOtp() {
        when(requestContext.currentUserRole()).thenReturn("CUSTOMER");
        when(otpRepository.findByContract_Id(contractId)).thenReturn(Optional.of(challenge(LocalDateTime.now())));

        AppException exception = assertThrows(AppException.class, () -> contractOtpService.requireVerified(contractId));

        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.CONTRACT_OTP_INVALID);
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

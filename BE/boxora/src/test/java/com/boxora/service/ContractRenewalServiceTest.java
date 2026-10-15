package com.boxora.service;

import com.boxora.client.DocuSealClient;
import com.boxora.config.DocuSealConfig;
import com.boxora.dto.response.ContractRenewalResponse;
import com.boxora.dto.response.DocuSealSubmitterResponse;
import com.boxora.entity.ContractRenewal;
import com.boxora.entity.Facility;
import com.boxora.entity.FacilityPolicy;
import com.boxora.entity.Payment;
import com.boxora.entity.RentalContract;
import com.boxora.entity.StorageUnit;
import com.boxora.entity.User;
import com.boxora.enums.ActivityAction;
import com.boxora.enums.ContractRenewalStatus;
import com.boxora.enums.PaymentStatus;
import com.boxora.enums.RentalContractStatus;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.mapper.ContractRenewalMapper;
import com.boxora.repository.ContractRenewalRepository;
import com.boxora.repository.FacilityPolicyRepository;
import com.boxora.repository.PaymentRepository;
import com.boxora.repository.RentalContractRepository;
import com.boxora.security.FacilityAccessGuard;
import com.boxora.security.RequestContext;
import com.boxora.service.impl.ContractRenewalServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ContractRenewalServiceTest {

    @Mock
    private DocuSealClient docuSealClient;

    @Mock
    private DocuSealConfig docuSealConfig;

    @Mock
    private RentalContractRepository rentalContractRepository;

    @Mock
    private ContractRenewalRepository contractRenewalRepository;

    @Mock
    private FacilityPolicyRepository facilityPolicyRepository;

    @Mock
    private PaymentRepository paymentRepository;

    @Mock
    private ContractRenewalMapper contractRenewalMapper;

    @Mock
    private ActivityLogService activityLogService;

    @Mock
    private FacilityAccessGuard facilityAccessGuard;

    @Mock
    private RequestContext requestContext;

    @Mock
    private org.springframework.beans.factory.ObjectProvider<PaymentService> paymentServiceProvider;

    @InjectMocks
    private ContractRenewalServiceImpl contractRenewalService;

    private RentalContract mockContract;
    private ContractRenewal mockRenewal;
    private Facility mockFacility;
    private User mockUser;
    private StorageUnit mockUnit;
    private UUID contractId;
    private UUID renewalId;

    @BeforeEach
    void setUp() {
        contractId = UUID.randomUUID();
        renewalId = UUID.randomUUID();

        mockUser = User.builder()
                .fullName("Tran Van B")
                .email("tranvanb@example.com")
                .build();
        mockUser.setId(UUID.randomUUID());

        mockFacility = Facility.builder()
                .name("Boxora Binh Thanh")
                .build();
        mockFacility.setId(UUID.randomUUID());

        mockUnit = StorageUnit.builder()
                .unitCode("UNIT-202")
                .facility(mockFacility)
                .build();
        mockUnit.setId(UUID.randomUUID());

        // Hợp đồng kết thúc ngày mai (nằm trong window 3 ngày)
        mockContract = RentalContract.builder()
                .contractCode("CTR-2026-002")
                .customer(mockUser)
                .unit(mockUnit)
                .facility(mockFacility)
                .startDate(LocalDate.now().minusMonths(1))
                .endDate(LocalDate.now().plusDays(2))
                .monthlyFee(new BigDecimal("2000000"))
                .status(RentalContractStatus.ACTIVE)
                .build();
        mockContract.setId(contractId);

        mockRenewal = ContractRenewal.builder()
                .contract(mockContract)
                .oldEndDate(mockContract.getEndDate())
                .newEndDate(mockContract.getEndDate().plusMonths(3))
                .cycleMonths(3)
                .renewalFee(new BigDecimal("6000000"))
                .status(ContractRenewalStatus.PENDING_SIGNATURE)
                .build();
        mockRenewal.setId(renewalId);
    }

    @Test
    @DisplayName("requestRenewal should succeed when contract is within renewal window")
    void testRequestRenewalSuccess() {
        FacilityPolicy policy = FacilityPolicy.builder()
                .renewalWindowDays(5)
                .overdueGraceDays(2)
                .build();
        when(rentalContractRepository.findById(contractId)).thenReturn(Optional.of(mockContract));
        when(facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(mockFacility.getId())).thenReturn(Optional.of(policy));
        when(contractRenewalRepository.save(any(ContractRenewal.class))).thenAnswer(inv -> {
            ContractRenewal r = inv.getArgument(0);
            r.setId(renewalId);
            return r;
        });

        when(docuSealConfig.getEffectiveRenewalTemplateId()).thenReturn(2002L);
        when(docuSealConfig.getWebBaseUrl()).thenReturn("http://localhost:3000");

        DocuSealSubmitterResponse submitter = new DocuSealSubmitterResponse();
        submitter.setId(10L);
        submitter.setSubmission_id(8888L);
        submitter.setSlug("renewal-slug-xyz");
        when(docuSealClient.createSubmission(any())).thenReturn(List.of(submitter));

        ContractRenewalResponse mockResponse = ContractRenewalResponse.builder()
                .id(renewalId)
                .contractId(contractId)
                .renewalFee(new BigDecimal("6000000"))
                .cycleMonths(3)
                .build();
        when(contractRenewalMapper.toResponse(any())).thenReturn(mockResponse);

        ContractRenewalResponse response = contractRenewalService.requestRenewal(contractId, 3);

        assertThat(response).isNotNull();
        assertThat(response.getSigningUrl()).isEqualTo("http://localhost:3000/s/renewal-slug-xyz");
        verify(activityLogService).record(any(UUID.class), eq(ActivityAction.RENEWAL_REQUEST), anyString(), any(), anyString(), any(), any());
    }

    @Test
    @DisplayName("requestRenewal should throw CONTRACT_RENEWAL_WINDOW_CLOSED when too early")
    void testRequestRenewalTooEarly() {
        // Hợp đồng còn 20 ngày nữa mới hết hạn, trong khi window là 3 ngày
        mockContract.setEndDate(LocalDate.now().plusDays(20));

        FacilityPolicy policy = FacilityPolicy.builder()
                .renewalWindowDays(3)
                .overdueGraceDays(1)
                .build();
        when(rentalContractRepository.findById(contractId)).thenReturn(Optional.of(mockContract));
        when(facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(mockFacility.getId())).thenReturn(Optional.of(policy));

        AppException ex = assertThrows(AppException.class, () -> contractRenewalService.requestRenewal(contractId, 1));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.CONTRACT_RENEWAL_WINDOW_CLOSED);
    }

    @Test
    @DisplayName("handleRenewalSigned should complete renewal and extend contract when payment is already PAID")
    void testHandleRenewalSignedWithPaymentCompleted() {
        Payment mockPayment = Payment.builder()
                .status(PaymentStatus.PAID)
                .amount(new BigDecimal("6000000"))
                .build();
        mockRenewal.setPayment(mockPayment);

        when(contractRenewalRepository.findById(renewalId)).thenReturn(Optional.of(mockRenewal));

        contractRenewalService.handleRenewalSigned(renewalId, "https://docuseal.com/renewal.pdf");

        assertThat(mockRenewal.getStatus()).isEqualTo(ContractRenewalStatus.COMPLETED);
        assertThat(mockRenewal.getSignedDocumentUrl()).isEqualTo("https://docuseal.com/renewal.pdf");
        assertThat(mockContract.getEndDate()).isEqualTo(mockRenewal.getNewEndDate());

        verify(rentalContractRepository).save(mockContract);
        verify(contractRenewalRepository).save(mockRenewal);
        verify(activityLogService).recordSystem(any(UUID.class), eq(ActivityAction.CONTRACT_EXTENDED), anyString(), any(), anyString());
    }

    @Test
    @DisplayName("handleRenewalSigned should set PENDING_PAYMENT when payment has not been made yet")
    void testHandleRenewalSignedPendingPayment() {
        mockRenewal.setPayment(null);
        when(contractRenewalRepository.findById(renewalId)).thenReturn(Optional.of(mockRenewal));

        contractRenewalService.handleRenewalSigned(renewalId, "https://docuseal.com/renewal.pdf");

        assertThat(mockRenewal.getStatus()).isEqualTo(ContractRenewalStatus.PENDING_PAYMENT);
        assertThat(mockRenewal.getSignedDocumentUrl()).isEqualTo("https://docuseal.com/renewal.pdf");

        verify(contractRenewalRepository).save(mockRenewal);
        verify(rentalContractRepository, never()).save(mockContract);
    }

    @Test
    @DisplayName("handleRenewalPaid should complete renewal and extend contract when already signed")
    void testHandleRenewalPaidAlreadySigned() {
        mockRenewal.setSignedAt(LocalDateTime.now());
        mockRenewal.setSignedDocumentUrl("https://docuseal.com/renewal.pdf");

        Payment mockPayment = Payment.builder()
                .status(PaymentStatus.PAID)
                .contract(mockContract)
                .build();
        mockPayment.setId(UUID.randomUUID());

        when(contractRenewalRepository.findByPaymentId(mockPayment.getId())).thenReturn(Optional.of(mockRenewal));

        contractRenewalService.handleRenewalPaid(mockPayment);

        assertThat(mockRenewal.getStatus()).isEqualTo(ContractRenewalStatus.COMPLETED);
        assertThat(mockContract.getEndDate()).isEqualTo(mockRenewal.getNewEndDate());

        verify(rentalContractRepository).save(mockContract);
        verify(contractRenewalRepository).save(mockRenewal);
        verify(activityLogService).recordSystem(any(UUID.class), eq(ActivityAction.CONTRACT_EXTENDED), anyString(), any(), anyString());
    }
}

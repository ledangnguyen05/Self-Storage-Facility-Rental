package com.boxora.service;

import com.boxora.client.DocuSealClient;
import com.boxora.config.DocuSealConfig;
import com.boxora.dto.request.DocuSealSubmissionRequest;
import com.boxora.dto.response.DocuSealSubmitterResponse;
import com.boxora.entity.Facility;
import com.boxora.entity.RentalContract;
import com.boxora.entity.StorageUnit;
import com.boxora.entity.User;
import com.boxora.enums.ActivityAction;
import com.boxora.enums.RentalContractStatus;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.mapper.RentalContractMapper;
import com.boxora.repository.BookingRepository;
import com.boxora.repository.FacilityRepository;
import com.boxora.repository.RentalContractRepository;
import com.boxora.repository.StorageUnitRepository;
import com.boxora.repository.UserRepository;
import com.boxora.security.FacilityAccessGuard;
import com.boxora.security.RequestContext;
import com.boxora.service.impl.ContractSigningServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.ArgumentCaptor;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ContractSigningServiceTest {

    @Mock
    private DocuSealClient docuSealClient;

    @Mock
    private DocuSealConfig docuSealConfig;

    @Mock
    private RentalContractRepository rentalContractRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private StorageUnitRepository storageUnitRepository;

    @Mock
    private FacilityRepository facilityRepository;

    @Mock
    private BookingRepository bookingRepository;

    @Mock
    private RentalContractMapper rentalContractMapper;

    @Mock
    private ActivityLogService activityLogService;

    @Mock
    private ContractRenewalService contractRenewalService;

    @Mock
    private FacilityAccessGuard facilityAccessGuard;

    @Mock
    private RequestContext requestContext;

    @InjectMocks
    private ContractSigningServiceImpl contractSigningService;

    private RentalContract mockContract;
    private User mockUser;
    private StorageUnit mockUnit;
    private Facility mockFacility;
    private UUID contractId;

    @BeforeEach
    void setUp() {
        contractId = UUID.randomUUID();

        mockUser = User.builder()
                .fullName("Nguyen Van A")
                .email("user@boxora.com")
                .phone("0912345678")
                .build();
        mockUser.setId(UUID.randomUUID());

        mockFacility = Facility.builder()
                .name("Boxora Facility Q1")
                .build();
        mockFacility.setId(UUID.randomUUID());

        mockUnit = StorageUnit.builder()
                .unitCode("BOX-101")
                .facility(mockFacility)
                .build();
        mockUnit.setId(UUID.randomUUID());

        mockContract = RentalContract.builder()
                .contractCode("CTR-2026-001")
                .customer(mockUser)
                .unit(mockUnit)
                .facility(mockFacility)
                .startDate(LocalDate.of(2026, 9, 1))
                .endDate(LocalDate.of(2026, 12, 1))
                .monthlyFee(new BigDecimal("1500000"))
                .depositHeld(new BigDecimal("1500000"))
                .status(RentalContractStatus.PENDING_SIGNATURE)
                .build();
        mockContract.setId(contractId);
    }

    @Test
    @DisplayName("createSigningRequest should submit to DocuSeal and return signingUrl")
    void testCreateSigningRequestSuccess() {
        when(docuSealConfig.getTemplateId()).thenReturn(1001L);
        when(docuSealConfig.getWebBaseUrl()).thenReturn("http://localhost:3000");

        DocuSealSubmitterResponse submitter = new DocuSealSubmitterResponse();
        submitter.setId(1L);
        submitter.setSubmission_id(9999L);
        submitter.setSlug("slug-abc-123");
        when(docuSealClient.createSubmission(any(DocuSealSubmissionRequest.class)))
                .thenReturn(List.of(submitter));

        String signingUrl = contractSigningService.createSigningRequest(mockContract);

        assertThat(signingUrl).isEqualTo("http://localhost:3000/s/slug-abc-123");
        assertThat(mockContract.getDocusealSubmissionId()).isEqualTo(9999L);
        assertThat(mockContract.getDocusealSubmitterSlug()).isEqualTo("slug-abc-123");

        ArgumentCaptor<DocuSealSubmissionRequest> requestCaptor =
                ArgumentCaptor.forClass(DocuSealSubmissionRequest.class);
        verify(docuSealClient).createSubmission(requestCaptor.capture());
        assertThat(requestCaptor.getValue().isSend_email()).isFalse();
        verify(rentalContractRepository).save(mockContract);
        verify(activityLogService).record(any(UUID.class), eq(ActivityAction.CONTRACT_CREATE), anyString(), any(), anyString(), any(), any());
    }

    @Test
    @DisplayName("createSigningRequest should throw CONTRACT_ALREADY_SIGNED if contract already active")
    void testCreateSigningRequestAlreadyActive() {
        mockContract.setStatus(RentalContractStatus.ACTIVE);

        AppException ex = assertThrows(AppException.class, () -> contractSigningService.createSigningRequest(mockContract));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.CONTRACT_ALREADY_SIGNED);
    }

    @Test
    @DisplayName("handleWebhook should mark contract as ACTIVE and set documentUrl on form.completed")
    void testHandleWebhookContractCompleted() {
        when(rentalContractRepository.findById(contractId)).thenReturn(Optional.of(mockContract));

        Map<String, Object> payload = Map.of(
                "event_type", "form.completed",
                "data", Map.of(
                        "external_id", contractId.toString(),
                        "documents", List.of(Map.of("url", "https://docuseal.com/docs/contract-signed.pdf"))
                )
        );

        contractSigningService.handleWebhook(payload);

        assertThat(mockContract.getStatus()).isEqualTo(RentalContractStatus.ACTIVE);
        assertThat(mockContract.getSignedDocumentUrl()).isEqualTo("https://docuseal.com/docs/contract-signed.pdf");
        assertThat(mockContract.getSignedAt()).isNotNull();

        verify(rentalContractRepository).save(mockContract);
        verify(activityLogService).recordSystem(any(UUID.class), eq(ActivityAction.CONTRACT_SIGNED), anyString(), any(), anyString());
    }

    @Test
    @DisplayName("handleWebhook should delegate to contractRenewalService when external_id starts with RENEWAL_")
    void testHandleWebhookRenewalCompleted() {
        UUID renewalId = UUID.randomUUID();
        Map<String, Object> payload = Map.of(
                "event_type", "form.completed",
                "data", Map.of(
                        "external_id", "RENEWAL_" + renewalId,
                        "documents", List.of(Map.of("url", "https://docuseal.com/docs/renewal-addendum.pdf"))
                )
        );

        contractSigningService.handleWebhook(payload);

        verify(contractRenewalService).handleRenewalSigned(renewalId, "https://docuseal.com/docs/renewal-addendum.pdf");
        verifyNoInteractions(rentalContractRepository);
    }
}

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
    private EmailService emailService;

    @Mock
    private EncryptionService encryptionService;

    @Mock
    private ContractRenewalService contractRenewalService;

    @Mock
    private FacilityAccessGuard facilityAccessGuard;

    @Mock
    private RequestContext requestContext;

    @Mock
    private org.springframework.beans.factory.ObjectProvider<ContractBillingService> contractBillingServiceProvider;

    @Mock
    private com.boxora.repository.ContractRenewalRepository contractRenewalRepository;

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

    private com.boxora.entity.Booking bookingOf(UUID bookingId) {
        com.boxora.entity.Booking booking = com.boxora.entity.Booking.builder()
                .bookingCode("BX-2026-OWN001")
                .customer(mockUser)
                .storageUnit(com.boxora.entity.StorageUnit.builder().unitCode("U-1").facility(mockFacility).build())
                .status(com.boxora.enums.BookingStatus.CONFIRMED)
                .build();
        booking.setId(bookingId);
        return booking;
    }

    @Test
    @DisplayName("getContractByBookingId: Chủ sở hữu booking được phép lấy hợp đồng")
    void getContractByBookingId_AuthorizedOwner_ReturnsContract() {
        UUID bookingId = UUID.randomUUID();
        when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(bookingOf(bookingId)));
        when(rentalContractRepository.findByBookingId(bookingId)).thenReturn(Optional.of(mockContract));
        when(requestContext.currentUserRole()).thenReturn("CUSTOMER");
        when(requestContext.currentUserId()).thenReturn(mockUser.getId());
        when(rentalContractMapper.toResponse(mockContract)).thenReturn(
                com.boxora.dto.response.RentalContractResponse.builder()
                        .id(mockContract.getId())
                        .contractCode(mockContract.getContractCode())
                        .build()
        );

        com.boxora.dto.response.RentalContractResponse res = contractSigningService.getContractByBookingId(bookingId);

        assertThat(res).isNotNull();
        assertThat(res.getId()).isEqualTo(mockContract.getId());
    }

    @Test
    @DisplayName("getContractByBookingId: Khách hàng khác bị từ chối trước khi hệ thống tạo hợp đồng (FORBIDDEN)")
    void getContractByBookingId_UnauthorizedCustomer_ThrowsForbidden() {
        UUID bookingId = UUID.randomUUID();
        when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(bookingOf(bookingId)));
        when(requestContext.currentUserRole()).thenReturn("CUSTOMER");
        when(requestContext.currentUserId()).thenReturn(UUID.randomUUID());

        AppException ex = assertThrows(AppException.class, () -> contractSigningService.getContractByBookingId(bookingId));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.FORBIDDEN);
        verify(rentalContractRepository, never()).save(any());
    }

    @Test
    @DisplayName("getContractByBookingId: Nhân viên ngoài phạm vi cơ sở -> Bị từ chối FACILITY_ACCESS_DENIED (403)")
    void getContractByBookingId_OutOfScopeStaff_ThrowsFacilityAccessDenied() {
        UUID bookingId = UUID.randomUUID();
        when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(bookingOf(bookingId)));
        when(facilityAccessGuard.isFacilityScoped()).thenReturn(true);
        doThrow(new AppException(ErrorCode.FACILITY_ACCESS_DENIED))
                .when(facilityAccessGuard).checkFacilityAccess(mockFacility.getId());

        assertThrows(AppException.class, () -> contractSigningService.getContractByBookingId(bookingId));
    }

    @Test
    @DisplayName("mockSign is refused when DocuSeal is configured (no fake signed contracts in production)")
    void mockSign_RefusedWhenDocuSealConfigured() {
        when(docuSealConfig.isMockActive()).thenReturn(false);
        AppException ex = assertThrows(AppException.class, () -> contractSigningService.mockSign(mockContract.getId(), "data:image/png;base64,AA"));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.CONTRACT_MOCK_SIGN_DISABLED);
        verify(rentalContractRepository, never()).save(any());
    }

    @Test
    @DisplayName("mockSign (test environment) stores the signature without inventing a signed document URL")
    void mockSign_TestEnvironment_NoFakeDocumentUrl() {
        when(docuSealConfig.isMockActive()).thenReturn(true);
        mockContract.setStatus(RentalContractStatus.PENDING_SIGNATURE);
        when(rentalContractRepository.findById(mockContract.getId())).thenReturn(Optional.of(mockContract));
        when(requestContext.currentUserRole()).thenReturn("CUSTOMER");
        when(requestContext.currentUserId()).thenReturn(mockUser.getId());
        when(rentalContractMapper.toResponse(mockContract)).thenReturn(com.boxora.dto.response.RentalContractResponse.builder().id(mockContract.getId()).build());

        contractSigningService.mockSign(mockContract.getId(), "data:image/png;base64,AA");

        assertThat(mockContract.getSignedAt()).isNotNull();
        assertThat(mockContract.getSignedDocumentUrl()).isNull();
        assertThat(mockContract.getSignatureData()).isEqualTo("data:image/png;base64,AA");
        assertThat(mockContract.getSigningMethod()).isEqualTo("ELECTRONIC_TEST");
    }

    @Test
    @DisplayName("Staff can never e-sign a customer's contract, even in the test environment")
    void mockSign_RefusedForStaff() {
        when(docuSealConfig.isMockActive()).thenReturn(true);
        when(rentalContractRepository.findById(mockContract.getId())).thenReturn(Optional.of(mockContract));
        when(requestContext.currentUserRole()).thenReturn("STAFF");
        when(requestContext.currentUserId()).thenReturn(UUID.randomUUID());

        AppException ex = assertThrows(AppException.class, () -> contractSigningService.mockSign(mockContract.getId(), "data:image/png;base64,AA"));

        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.CONTRACT_SIGNER_NOT_CUSTOMER);
        assertThat(mockContract.getSignedAt()).isNull();
        verify(rentalContractRepository, never()).save(any());
    }

    @Test
    @DisplayName("A counter booking gets a counter (IN_PERSON) contract; online bookings an ELECTRONIC one")
    void ensureContract_UsesTheBookingSigningMethod() {
        com.boxora.entity.Booking counter = com.boxora.entity.Booking.builder()
                .bookingCode("BX-2026-NJDA8C").customer(mockUser).storageUnit(mockUnit)
                .status(com.boxora.enums.BookingStatus.CONFIRMED).signingMethod("IN_PERSON")
                .startDate(LocalDate.of(2026, 10, 25)).endDate(LocalDate.of(2026, 11, 25))
                .rentalMonths(1).totalRentalFee(new BigDecimal("1500000")).build();
        counter.setId(UUID.randomUUID());
        com.boxora.entity.Booking online = com.boxora.entity.Booking.builder()
                .bookingCode("BX-2026-6NCL2S").customer(mockUser).storageUnit(mockUnit)
                .status(com.boxora.enums.BookingStatus.CONFIRMED).signingMethod("ONLINE")
                .startDate(LocalDate.of(2026, 10, 25)).endDate(LocalDate.of(2026, 11, 25))
                .rentalMonths(1).totalRentalFee(new BigDecimal("1500000")).build();
        online.setId(UUID.randomUUID());
        when(rentalContractRepository.findByBookingId(any())).thenReturn(Optional.empty());
        when(rentalContractRepository.save(any(RentalContract.class))).thenAnswer(invocation -> invocation.getArgument(0));

        assertThat(contractSigningService.ensureContractForBooking(counter).getSigningMethod()).isEqualTo("IN_PERSON");
        assertThat(contractSigningService.ensureContractForBooking(online).getSigningMethod()).isEqualTo("ELECTRONIC");
    }

    @Test
    @DisplayName("Signing online a contract first planned for the counter marks the booking as signed online")
    void mockSign_CounterBookingSignedOnlineBecomesOnline() {
        when(docuSealConfig.isMockActive()).thenReturn(true);
        com.boxora.entity.Booking booking = com.boxora.entity.Booking.builder()
                .bookingCode("BX-2026-CONF-D101").customer(mockUser).storageUnit(mockUnit)
                .status(com.boxora.enums.BookingStatus.CONFIRMED).signingMethod("IN_PERSON").build();
        booking.setId(UUID.randomUUID());
        mockContract.setBooking(booking);
        mockContract.setSigningMethod("IN_PERSON");
        when(rentalContractRepository.findById(mockContract.getId())).thenReturn(Optional.of(mockContract));
        when(requestContext.currentUserRole()).thenReturn("CUSTOMER");
        when(requestContext.currentUserId()).thenReturn(mockUser.getId());
        when(rentalContractMapper.toResponse(mockContract)).thenReturn(com.boxora.dto.response.RentalContractResponse.builder().id(mockContract.getId()).build());

        contractSigningService.mockSign(mockContract.getId(), "data:image/png;base64,AA");

        assertThat(mockContract.getStatus()).isEqualTo(RentalContractStatus.PENDING_ACTIVATION);
        assertThat(mockContract.getSigningMethod()).isEqualTo("ELECTRONIC_TEST");
        assertThat(booking.getSigningMethod()).isEqualTo("ONLINE");
        verify(bookingRepository).save(booking);
    }
}

package com.boxora.service;

import com.boxora.client.DocuSealClient;
import com.boxora.config.DocuSealConfig;
import com.boxora.dto.request.PricingQuoteRequest;
import com.boxora.dto.response.ContractRenewalResponse;
import com.boxora.dto.response.PricingQuoteResponse;
import com.boxora.entity.Booking;
import com.boxora.dto.response.DocuSealSubmitterResponse;
import com.boxora.entity.ContractRenewal;
import com.boxora.entity.Facility;
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
import com.boxora.repository.BookingRepository;
import com.boxora.repository.ContractRenewalRepository;
import com.boxora.repository.PaymentRepository;
import com.boxora.repository.RentalContractRepository;
import com.boxora.security.FacilityAccessGuard;
import com.boxora.security.RequestContext;
import com.boxora.service.impl.ContractRenewalServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
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
    private PaymentRepository paymentRepository;

    @Mock
    private BookingRepository bookingRepository;

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

    @Mock
    private PricingService pricingService;

    @Mock
    private ContractBillingService contractBillingService;

    @Mock
    private OverdueFeeCalculator overdueFeeCalculator;

    @InjectMocks
    private ContractRenewalServiceImpl contractRenewalService;

    private RentalContract mockContract;
    private ContractRenewal mockRenewal;
    private Facility mockFacility;
    private User mockUser;
    private StorageUnit mockUnit;
    private Booking mockBooking;
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

        mockBooking = Booking.builder()
                .bookingCode("BX-2026-TEST01")
                .endDate(LocalDate.now().plusDays(2))
                .rentalMonths(1)
                .build();
        mockBooking.setId(UUID.randomUUID());

        // Hợp đồng kết thúc sau 2 ngày (nằm trong cửa sổ gia hạn của cơ sở)
        mockContract = RentalContract.builder()
                .contractCode("CTR-2026-002")
                .customer(mockUser)
                .unit(mockUnit)
                .facility(mockFacility)
                .booking(mockBooking)
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
                .rentalFeeAmount(new BigDecimal("6000000"))
                .renewalFee(new BigDecimal("6000000"))
                .status(ContractRenewalStatus.PENDING_SIGNATURE)
                .build();
        mockRenewal.setId(renewalId);
    }

    private void renewable() {
        when(contractBillingService.renewalWindow(eq(mockContract), any()))
                .thenReturn(new ContractBillingService.RenewalWindow(true, mockContract.getEndDate().minusDays(3), null, 3, null));
    }

    private void quote(String totalRentalFee) {
        when(pricingService.calculateQuote(any(PricingQuoteRequest.class)))
                .thenReturn(PricingQuoteResponse.builder().totalRentalFee(new BigDecimal(totalRentalFee)).build());
    }

    /** The customer named on the contract is the caller (the only person who may sign the addendum). */
    private void customerSession() {
        lenient().when(requestContext.currentUserRole()).thenReturn("CUSTOMER");
        lenient().when(requestContext.currentUserId()).thenReturn(mockUser.getId());
    }

    private void staffSession() {
        lenient().when(requestContext.currentUserRole()).thenReturn("STAFF");
        lenient().when(requestContext.currentUserId()).thenReturn(UUID.randomUUID());
    }

    private void saveReturnsArgument() {
        when(contractRenewalRepository.save(any(ContractRenewal.class))).thenAnswer(inv -> {
            ContractRenewal r = inv.getArgument(0);
            if (r.getId() == null) r.setId(renewalId);
            return r;
        });
    }

    @Test
    @DisplayName("requestRenewal: fee comes from the PricingService renewal quote; DocuSeal link returned")
    void testRequestRenewalSuccess() {
        customerSession();
        when(rentalContractRepository.findById(contractId)).thenReturn(Optional.of(mockContract));
        renewable();
        quote("5400000");
        saveReturnsArgument();
        when(docuSealConfig.getEffectiveRenewalTemplateId()).thenReturn(2002L);
        when(docuSealConfig.getWebBaseUrl()).thenReturn("http://localhost:3000");
        when(docuSealConfig.isMockActive()).thenReturn(false);

        DocuSealSubmitterResponse submitter = new DocuSealSubmitterResponse();
        submitter.setId(10L);
        submitter.setSubmission_id(8888L);
        submitter.setSlug("renewal-slug-xyz");
        when(docuSealClient.createSubmission(any())).thenReturn(List.of(submitter));
        when(contractRenewalMapper.toResponse(any())).thenAnswer(inv -> {
            ContractRenewal r = inv.getArgument(0);
            return ContractRenewalResponse.builder().id(r.getId()).renewalFee(r.getRenewalFee()).cycleMonths(r.getCycleMonths()).build();
        });

        ContractRenewalResponse response = contractRenewalService.requestRenewal(contractId, 3);

        assertThat(response).isNotNull();
        assertThat(response.getRenewalFee()).isEqualByComparingTo("5400000");
        assertThat(response.getSigningUrl()).isEqualTo("http://localhost:3000/s/renewal-slug-xyz");
        ArgumentCaptor<PricingQuoteRequest> quoteRequest = ArgumentCaptor.forClass(PricingQuoteRequest.class);
        verify(pricingService).calculateQuote(quoteRequest.capture());
        assertThat(quoteRequest.getValue().getRenewal()).isTrue();
        assertThat(quoteRequest.getValue().getStartDate()).isEqualTo(mockContract.getEndDate());
        assertThat(quoteRequest.getValue().getRentalMonths()).isEqualTo(3);
        verify(activityLogService).record(any(UUID.class), eq(ActivityAction.RENEWAL_REQUEST), anyString(), any(), anyString(), any(), any());
    }

    @Test
    @DisplayName("requestRenewal: outside the facility window -> CONTRACT_RENEWAL_WINDOW_CLOSED with the date it opens")
    void testRequestRenewalTooEarly() {
        mockContract.setEndDate(LocalDate.now().plusDays(20));
        when(rentalContractRepository.findById(contractId)).thenReturn(Optional.of(mockContract));
        when(contractBillingService.renewalWindow(eq(mockContract), any())).thenReturn(new ContractBillingService.RenewalWindow(
                false, LocalDate.now().plusDays(17), null, 3, "Bạn có thể gia hạn từ ngày ..."));

        AppException ex = assertThrows(AppException.class, () -> contractRenewalService.requestRenewal(contractId, 1));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.CONTRACT_RENEWAL_WINDOW_CLOSED);
        assertThat(ex.getMessage()).startsWith("Bạn có thể gia hạn từ ngày");
        verify(contractRenewalRepository, never()).save(any());
    }

    @Test
    @DisplayName("requestRenewal: an OVERDUE contract can be renewed; the late fee is added to the fee")
    void testRequestRenewalOverdueAddsLateFee() {
        customerSession();
        mockContract.setStatus(RentalContractStatus.OVERDUE);
        mockContract.setEndDate(LocalDate.now().minusDays(10));
        when(rentalContractRepository.findById(contractId)).thenReturn(Optional.of(mockContract));
        renewable();
        quote("2000000");
        when(overdueFeeCalculator.calculateLateFee(eq(mockContract), any())).thenReturn(new BigDecimal("450000"));
        saveReturnsArgument();
        when(docuSealConfig.isMockActive()).thenReturn(true);
        DocuSealSubmitterResponse submitter = new DocuSealSubmitterResponse();
        submitter.setSlug("mock-abc");
        when(docuSealClient.createSubmission(any())).thenReturn(List.of(submitter));
        when(contractRenewalMapper.toResponse(any())).thenReturn(ContractRenewalResponse.builder().id(renewalId).build());

        ContractRenewalResponse response = contractRenewalService.requestRenewal(contractId, 1);

        ArgumentCaptor<ContractRenewal> saved = ArgumentCaptor.forClass(ContractRenewal.class);
        verify(contractRenewalRepository, atLeastOnce()).save(saved.capture());
        ContractRenewal renewal = saved.getValue();
        assertThat(renewal.getRentalFeeAmount()).isEqualByComparingTo("2000000");
        assertThat(renewal.getLateFeeAmount()).isEqualByComparingTo("450000");
        assertThat(renewal.getRenewalFee()).isEqualByComparingTo("2450000");
        assertThat(renewal.getSigningMethod()).isEqualTo(ContractRenewalServiceImpl.SIGNING_IN_APP_TEST);
        // Test environment: the "signing link" opens the in-app pad, never a dead docuseal.com/s/mock-* link.
        assertThat(response.getSigningUrl()).contains("mockSignRenewalId=" + renewalId).doesNotContain("docuseal.com");
    }

    @Test
    @DisplayName("requestRenewal: an overdue renewal must end after today")
    void testRequestRenewalOverdueTooShort() {
        mockContract.setStatus(RentalContractStatus.OVERDUE_LOCKED);
        mockContract.setEndDate(LocalDate.now().minusDays(45));
        when(rentalContractRepository.findById(contractId)).thenReturn(Optional.of(mockContract));
        renewable();

        AppException ex = assertThrows(AppException.class, () -> contractRenewalService.requestRenewal(contractId, 1));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.CONTRACT_RENEWAL_TERM_TOO_SHORT);
    }

    @Test
    @DisplayName("handleRenewalSigned: with the fee already PAID the contract AND the booking get the new end date")
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
        assertThat(mockBooking.getEndDate()).isEqualTo(mockRenewal.getNewEndDate());

        verify(rentalContractRepository).save(mockContract);
        verify(bookingRepository).save(mockBooking);
        verify(contractRenewalRepository).save(mockRenewal);
        verify(activityLogService).recordSystem(any(UUID.class), eq(ActivityAction.CONTRACT_EXTENDED), anyString(), any(), anyString());
        verify(contractBillingService, never()).restoreAccessAfterCommit(any(), anyString());
    }

    @Test
    @DisplayName("handleRenewalSigned should set PENDING_PAYMENT when payment has not been made yet")
    void testHandleRenewalSignedPendingPayment() {
        mockRenewal.setPayment(null);
        when(contractRenewalRepository.findById(renewalId)).thenReturn(Optional.of(mockRenewal));

        contractRenewalService.handleRenewalSigned(renewalId, "https://docuseal.com/renewal.pdf");

        assertThat(mockRenewal.getStatus()).isEqualTo(ContractRenewalStatus.PENDING_PAYMENT);
        verify(contractRenewalRepository).save(mockRenewal);
        verify(rentalContractRepository, never()).save(mockContract);
    }

    @Test
    @DisplayName("handleRenewalPaid on a signed renewal of an OVERDUE contract extends it and restores access")
    void testHandleRenewalPaidOverdueRestoresAccess() {
        mockContract.setStatus(RentalContractStatus.OVERDUE_LOCKED);
        mockRenewal.setSignedAt(LocalDateTime.now());
        Payment mockPayment = Payment.builder().status(PaymentStatus.PAID).contract(mockContract).build();
        mockPayment.setId(UUID.randomUUID());
        when(contractRenewalRepository.findByPaymentId(mockPayment.getId())).thenReturn(Optional.of(mockRenewal));

        contractRenewalService.handleRenewalPaid(mockPayment);

        assertThat(mockRenewal.getStatus()).isEqualTo(ContractRenewalStatus.COMPLETED);
        assertThat(mockContract.getEndDate()).isEqualTo(mockRenewal.getNewEndDate());
        verify(contractBillingService).restoreAccessAfterCommit(eq(mockContract), anyString());
    }

    @Test
    @DisplayName("mockSignRenewal is refused when DocuSeal is configured")
    void testMockSignRenewalDisabledWithDocuSeal() {
        when(docuSealConfig.isMockActive()).thenReturn(false);
        AppException ex = assertThrows(AppException.class, () -> contractRenewalService.mockSignRenewal(renewalId, "data:image/png;base64,AA"));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.CONTRACT_MOCK_SIGN_DISABLED);
    }

    @Test
    @DisplayName("cancelRenewal refuses a renewal whose fee is paid")
    void testCancelPaidRenewalRefused() {
        mockRenewal.setPayment(Payment.builder().status(PaymentStatus.PAID).build());
        when(contractRenewalRepository.findById(renewalId)).thenReturn(Optional.of(mockRenewal));

        AppException ex = assertThrows(AppException.class, () -> contractRenewalService.cancelRenewal(renewalId, null));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.CONTRACT_RENEWAL_CANNOT_CANCEL);
    }

    @Test
    @DisplayName("mockSignRenewal: staff cannot sign the addendum on the customer's behalf")
    void testMockSignRenewalByStaffRefused() {
        staffSession();
        when(docuSealConfig.isMockActive()).thenReturn(true);
        when(contractRenewalRepository.findById(renewalId)).thenReturn(Optional.of(mockRenewal));

        AppException ex = assertThrows(AppException.class, () -> contractRenewalService.mockSignRenewal(renewalId, "data:image/png;base64,AA"));

        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.CONTRACT_SIGNER_NOT_CUSTOMER);
        assertThat(mockRenewal.getSignedAt()).isNull();
        verify(contractRenewalRepository, never()).save(any());
    }

    @Test
    @DisplayName("getRenewalSigningUrl: the signing link is only handed to the customer, never to staff")
    void testRenewalSigningUrlRefusedToStaff() {
        staffSession();
        when(contractRenewalRepository.findById(renewalId)).thenReturn(Optional.of(mockRenewal));

        AppException ex = assertThrows(AppException.class, () -> contractRenewalService.getRenewalSigningUrl(renewalId));

        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.CONTRACT_SIGNER_NOT_CUSTOMER);
        verify(docuSealClient, never()).createSubmission(any());
    }

    @Test
    @DisplayName("requestRenewal by staff: the addendum is created but the response carries no signing link")
    void testRequestRenewalByStaffHidesSigningLink() {
        staffSession();
        when(rentalContractRepository.findById(contractId)).thenReturn(Optional.of(mockContract));
        renewable();
        quote("5400000");
        saveReturnsArgument();
        when(docuSealConfig.isMockActive()).thenReturn(true);
        DocuSealSubmitterResponse submitter = new DocuSealSubmitterResponse();
        submitter.setSlug("mock-staff");
        when(docuSealClient.createSubmission(any())).thenReturn(List.of(submitter));
        when(contractRenewalMapper.toResponse(any())).thenReturn(ContractRenewalResponse.builder().id(renewalId).build());

        ContractRenewalResponse response = contractRenewalService.requestRenewal(contractId, 3);

        assertThat(response.getSigningUrl()).isNull();
    }
}

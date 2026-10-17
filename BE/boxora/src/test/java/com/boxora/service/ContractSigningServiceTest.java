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
    private com.boxora.repository.PaymentRepository paymentRepository;

    @Mock
    private com.boxora.repository.RefundRequestRepository refundRequestRepository;

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

    @Test
    @DisplayName("getContractByBookingId: Chủ sở hữu booking được phép lấy hợp đồng")
    void getContractByBookingId_AuthorizedOwner_ReturnsContract() {
        UUID bookingId = UUID.randomUUID();
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
    @DisplayName("getContractByBookingId: Khách hàng khác cố truy cập hợp đồng -> Bị từ chối FORBIDDEN (403)")
    void getContractByBookingId_UnauthorizedCustomer_ThrowsForbidden() {
        UUID bookingId = UUID.randomUUID();
        UUID attackerId = UUID.randomUUID();

        when(rentalContractRepository.findByBookingId(bookingId)).thenReturn(Optional.of(mockContract));
        when(requestContext.currentUserRole()).thenReturn("CUSTOMER");
        when(requestContext.currentUserId()).thenReturn(attackerId);

        assertThrows(AppException.class, () -> contractSigningService.getContractByBookingId(bookingId));
    }

    @Test
    @DisplayName("getContractByBookingId: Nhân viên ngoài phạm vi cơ sở -> Bị từ chối FACILITY_ACCESS_DENIED (403)")
    void getContractByBookingId_OutOfScopeStaff_ThrowsFacilityAccessDenied() {
        UUID bookingId = UUID.randomUUID();

        when(rentalContractRepository.findByBookingId(bookingId)).thenReturn(Optional.of(mockContract));
        when(facilityAccessGuard.isFacilityScoped()).thenReturn(true);
        doThrow(new AppException(ErrorCode.FACILITY_ACCESS_DENIED))
                .when(facilityAccessGuard).checkFacilityAccess(mockFacility.getId());

        assertThrows(AppException.class, () -> contractSigningService.getContractByBookingId(bookingId));
    }

    @Test
    @DisplayName("Task 09 Case 6: mockSign with empty, null, or invalid format signatureData is rejected")
    void testTask09_Case6_MockSignWithEmptyOrInvalidSignature_Rejected() {
        when(rentalContractRepository.findById(contractId)).thenReturn(Optional.of(mockContract));
        when(requestContext.currentUserRole()).thenReturn("CUSTOMER");
        when(requestContext.currentUserId()).thenReturn(mockUser.getId());
        when(docuSealConfig.isMockActive()).thenReturn(true);

        AppException exNull = assertThrows(AppException.class, () -> contractSigningService.mockSign(contractId, null));
        assertThat(exNull.getErrorCode()).isEqualTo(ErrorCode.INVALID_REQUEST);

        AppException exEmpty = assertThrows(AppException.class, () -> contractSigningService.mockSign(contractId, "   "));
        assertThat(exEmpty.getErrorCode()).isEqualTo(ErrorCode.INVALID_REQUEST);

        AppException exInvalidPrefix = assertThrows(AppException.class, () -> contractSigningService.mockSign(contractId, "not-a-valid-data-uri"));
        assertThat(exInvalidPrefix.getErrorCode()).isEqualTo(ErrorCode.INVALID_REQUEST);

        AppException exEmptyBase64 = assertThrows(AppException.class, () -> contractSigningService.mockSign(contractId, "data:image/png;base64,   "));
        assertThat(exEmptyBase64.getErrorCode()).isEqualTo(ErrorCode.INVALID_REQUEST);
    }

    @Test
    @DisplayName("Task 09 Case 7: mockSign for a contract not belonging to current customer is rejected with FORBIDDEN")
    void testTask09_Case7_MockSignForAnotherCustomerContract_Rejected() {
        when(rentalContractRepository.findById(contractId)).thenReturn(Optional.of(mockContract));
        when(requestContext.currentUserRole()).thenReturn("CUSTOMER");
        when(requestContext.currentUserId()).thenReturn(UUID.randomUUID()); // Different user!

        AppException ex = assertThrows(AppException.class,
                () -> contractSigningService.mockSign(contractId, "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.FORBIDDEN);
    }

    @Test
    @DisplayName("Task 09 Case 2 & 8: mockSign when booking is unpaid or only DEPOSIT (PARTIALLY_PAID) is rejected and does NOT auto-confirm PENDING_PAYMENT booking")
    void testTask09_Case2_And_8_MockSignWhenBookingUnpaidOrPartiallyPaid_Rejected() {
        com.boxora.entity.Booking unpaidBooking = com.boxora.entity.Booking.builder()
                .bookingCode("BK-UNPAID-01")
                .status(com.boxora.enums.BookingStatus.PENDING_PAYMENT)
                .paymentStatus("UNPAID")
                .signingMethod("ONLINE")
                .depositAmount(new BigDecimal("500000"))
                .totalRentalFee(new BigDecimal("1000000"))
                .rentalMonths(1)
                .build();
        unpaidBooking.setId(UUID.randomUUID());
        mockContract.setBooking(unpaidBooking);

        when(rentalContractRepository.findById(contractId)).thenReturn(Optional.of(mockContract));
        when(requestContext.currentUserRole()).thenReturn("CUSTOMER");
        when(requestContext.currentUserId()).thenReturn(mockUser.getId());
        when(docuSealConfig.isMockActive()).thenReturn(true);

        String validSig = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

        // 1. Completely unpaid PENDING_PAYMENT booking -> rejected, status remains PENDING_PAYMENT
        AppException exUnpaid = assertThrows(AppException.class, () -> contractSigningService.mockSign(contractId, validSig));
        assertThat(exUnpaid.getErrorCode()).isEqualTo(ErrorCode.INVALID_REQUEST);
        assertThat(unpaidBooking.getStatus()).isEqualTo(com.boxora.enums.BookingStatus.PENDING_PAYMENT);

        // 2. Confirmed booking with ONLY DEPOSIT paid (PARTIALLY_PAID, rent still unpaid) -> rejected
        unpaidBooking.setStatus(com.boxora.enums.BookingStatus.CONFIRMED);
        unpaidBooking.setPaymentStatus("PARTIALLY_PAID");
        unpaidBooking.setDepositPaid(new BigDecimal("500000"));
        com.boxora.entity.Payment depositOnlyTx = com.boxora.entity.Payment.builder()
                .booking(unpaidBooking)
                .paymentType(com.boxora.enums.PaymentType.DEPOSIT)
                .status(com.boxora.enums.PaymentStatus.PAID)
                .amount(new BigDecimal("500000"))
                .build();
        when(paymentRepository.findAllByBooking_Id(unpaidBooking.getId())).thenReturn(List.of(depositOnlyTx));

        AppException exPartial = assertThrows(AppException.class, () -> contractSigningService.mockSign(contractId, validSig));
        assertThat(exPartial.getErrorCode()).isEqualTo(ErrorCode.INVALID_REQUEST);
        assertThat(mockContract.getStatus()).isEqualTo(RentalContractStatus.PENDING_SIGNATURE);
    }

    @Test
    @DisplayName("Task 09 Case 4 & 14: mockSign succeeds when BOOKING_PAYMENT is fully PAID, sets PENDING_ACTIVATION, and does NOT decrypt/expose PIN before check-in")
    void testTask09_Case4_And_14_MockSignWhenBookingFullyPaid_SucceedsWithoutPinBeforeCheckIn() {
        com.boxora.entity.Booking paidBooking = com.boxora.entity.Booking.builder()
                .bookingCode("BK-PAID-01")
                .status(com.boxora.enums.BookingStatus.CONFIRMED)
                .paymentStatus("PAID")
                .signingMethod("ONLINE")
                .depositAmount(new BigDecimal("500000"))
                .depositPaid(new BigDecimal("500000"))
                .totalRentalFee(new BigDecimal("1000000"))
                .rentalMonths(1)
                .accessPin("ENCRYPTED-PIN-SECRET")
                .build();
        paidBooking.setId(UUID.randomUUID());
        mockContract.setBooking(paidBooking);

        com.boxora.entity.Payment fullBookingPayment = com.boxora.entity.Payment.builder()
                .booking(paidBooking)
                .paymentType(com.boxora.enums.PaymentType.BOOKING_PAYMENT)
                .status(com.boxora.enums.PaymentStatus.PAID)
                .amount(new BigDecimal("1500000"))
                .build();

        when(rentalContractRepository.findById(contractId)).thenReturn(Optional.of(mockContract));
        when(requestContext.currentUserRole()).thenReturn("CUSTOMER");
        when(requestContext.currentUserId()).thenReturn(mockUser.getId());
        when(docuSealConfig.isMockActive()).thenReturn(true);
        when(paymentRepository.findAllByBooking_Id(paidBooking.getId())).thenReturn(List.of(fullBookingPayment));

        String validSig = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
        contractSigningService.mockSign(contractId, validSig);

        assertThat(mockContract.getStatus()).isEqualTo(RentalContractStatus.PENDING_ACTIVATION);
        assertThat(mockContract.getSignedAt()).isNotNull();
        assertThat(mockContract.getSignatureData()).isEqualTo(validSig);
        // Must NOT decrypt or expose accessPin while booking is CONFIRMED (awaiting check-in)
        verify(encryptionService, never()).decrypt(anyString());
    }

    @Test
    @DisplayName("Final Review Issue 2: mockSign is strictly rejected with FORBIDDEN when mock mode is disabled, even if contract slug starts with mock-")
    void testFinalReview_Issue2_MockSignRejectedWhenMockModeDisabled_EvenWithMockSlug() {
        mockContract.setDocusealSubmitterSlug("mock-bypass-attempt-999");

        when(rentalContractRepository.findById(contractId)).thenReturn(Optional.of(mockContract));
        when(requestContext.currentUserRole()).thenReturn("CUSTOMER");
        when(requestContext.currentUserId()).thenReturn(mockUser.getId());
        when(docuSealConfig.isMockActive()).thenReturn(false); // Production mode (mock disabled)

        String validSig = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

        AppException ex = assertThrows(AppException.class, () -> contractSigningService.mockSign(contractId, validSig));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.FORBIDDEN);
        assertThat(mockContract.getStatus()).isEqualTo(RentalContractStatus.PENDING_SIGNATURE);
        assertThat(mockContract.getSignedAt()).isNull();
        verify(rentalContractRepository, never()).save(any());
    }

    @Test
    @DisplayName("Final Review Issue 1: mockSign is rejected when booking.depositPaid > 0 and paymentStatus is PAID but transaction has been REFUNDED")
    void testFinalReview_Issue1_MockSignRejectedWhenPaymentRefunded() {
        com.boxora.entity.Booking refundedBooking = com.boxora.entity.Booking.builder()
                .bookingCode("BK-REFUND-01")
                .status(com.boxora.enums.BookingStatus.CONFIRMED)
                .paymentStatus("PAID")
                .signingMethod("ONLINE")
                .depositAmount(new BigDecimal("500000"))
                .depositPaid(new BigDecimal("500000"))
                .totalRentalFee(new BigDecimal("1000000"))
                .rentalMonths(1)
                .build();
        refundedBooking.setId(UUID.randomUUID());
        mockContract.setBooking(refundedBooking);

        com.boxora.entity.Payment paidTx = com.boxora.entity.Payment.builder()
                .booking(refundedBooking)
                .paymentType(com.boxora.enums.PaymentType.BOOKING_PAYMENT)
                .status(com.boxora.enums.PaymentStatus.PAID)
                .amount(new BigDecimal("1500000"))
                .build();
        com.boxora.entity.Payment refundTx = com.boxora.entity.Payment.builder()
                .booking(refundedBooking)
                .paymentType(com.boxora.enums.PaymentType.DEPOSIT)
                .status(com.boxora.enums.PaymentStatus.REFUNDED)
                .amount(new BigDecimal("500000"))
                .build();

        when(rentalContractRepository.findById(contractId)).thenReturn(Optional.of(mockContract));
        when(requestContext.currentUserRole()).thenReturn("CUSTOMER");
        when(requestContext.currentUserId()).thenReturn(mockUser.getId());
        when(docuSealConfig.isMockActive()).thenReturn(true);
        when(paymentRepository.findAllByBooking_Id(refundedBooking.getId())).thenReturn(List.of(paidTx, refundTx));

        String validSig = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

        AppException ex = assertThrows(AppException.class, () -> contractSigningService.mockSign(contractId, validSig));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.INVALID_REQUEST);
        assertThat(mockContract.getStatus()).isEqualTo(RentalContractStatus.PENDING_SIGNATURE);
        assertThat(mockContract.getSignedAt()).isNull();
    }

    @Test
    @DisplayName("Refund Spec Case 5, 7, 9: Block mockSign and createSigningRequest when booking is awaiting refund (REFUND_PENDING or active RefundRequest), allow when RefundRequest is REJECTED, and preserve legacy depositPaid fallback")
    void testRefundSpec_Cases5_7_9_ContractSigningProtectionAndLegacyFallback() {
        com.boxora.entity.Booking booking = com.boxora.entity.Booking.builder()
                .bookingCode("BK-REFUND-PENDING-01")
                .status(com.boxora.enums.BookingStatus.CONFIRMED)
                .paymentStatus("PAID")
                .signingMethod("ONLINE")
                .depositAmount(new BigDecimal("500000"))
                .depositPaid(new BigDecimal("500000"))
                .totalRentalFee(new BigDecimal("1000000"))
                .rentalMonths(1)
                .build();
        booking.setId(UUID.randomUUID());
        mockContract.setBooking(booking);

        com.boxora.entity.Payment paidRentTx = com.boxora.entity.Payment.builder()
                .booking(booking)
                .paymentType(com.boxora.enums.PaymentType.RENTAL_FEE)
                .status(com.boxora.enums.PaymentStatus.PAID)
                .amount(new BigDecimal("1000000"))
                .build();
        com.boxora.entity.Payment pendingRefundTx = com.boxora.entity.Payment.builder()
                .booking(booking)
                .paymentType(com.boxora.enums.PaymentType.DEPOSIT)
                .status(com.boxora.enums.PaymentStatus.REFUND_PENDING)
                .amount(new BigDecimal("500000"))
                .build();

        when(rentalContractRepository.findById(contractId)).thenReturn(Optional.of(mockContract));
        when(requestContext.currentUserRole()).thenReturn("CUSTOMER");
        when(requestContext.currentUserId()).thenReturn(mockUser.getId());
        when(docuSealConfig.isMockActive()).thenReturn(true);

        String validSig = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

        // Case 7a: Booking has REFUND_PENDING -> both createSigningRequest and mockSign are blocked with INVALID_REQUEST
        when(paymentRepository.findAllByBooking_Id(booking.getId())).thenReturn(List.of(paidRentTx, pendingRefundTx));
        AppException exCreateUrl = assertThrows(AppException.class, () -> contractSigningService.createSigningRequest(mockContract));
        assertThat(exCreateUrl.getErrorCode()).isEqualTo(ErrorCode.INVALID_REQUEST);

        AppException exMockSignPendingRefund = assertThrows(AppException.class, () -> contractSigningService.mockSign(contractId, validSig));
        assertThat(exMockSignPendingRefund.getErrorCode()).isEqualTo(ErrorCode.INVALID_REQUEST);

        // Case 7b: Booking has active RefundRequest (PENDING_REVIEW / APPROVED / PROCESSING_TRANSFER) -> blocked even if no REFUND_PENDING payment
        when(paymentRepository.findAllByBooking_Id(booking.getId())).thenReturn(List.of(paidRentTx));
        when(refundRequestRepository.existsByBooking_IdAndStatusIn(eq(booking.getId()), any())).thenReturn(true);
        AppException exActiveRefundReq = assertThrows(AppException.class, () -> contractSigningService.mockSign(contractId, validSig));
        assertThat(exActiveRefundReq.getErrorCode()).isEqualTo(ErrorCode.INVALID_REQUEST);

        // Case 5 & 9: RefundRequest is REJECTED (existsByBooking_IdAndStatusIn returns false), and legacy CONFIRMED booking has
        // booking.depositPaid = 500,000đ + PAID RENTAL_FEE = 1,000,000đ + a FAILED deposit attempt -> signing succeeds!
        com.boxora.entity.Payment failedDepositAttempt = com.boxora.entity.Payment.builder()
                .booking(booking)
                .paymentType(com.boxora.enums.PaymentType.DEPOSIT)
                .status(com.boxora.enums.PaymentStatus.FAILED)
                .amount(new BigDecimal("500000"))
                .build();
        when(refundRequestRepository.existsByBooking_IdAndStatusIn(eq(booking.getId()), any())).thenReturn(false);
        when(paymentRepository.findAllByBooking_Id(booking.getId())).thenReturn(List.of(paidRentTx, failedDepositAttempt));

        contractSigningService.mockSign(contractId, validSig);
        assertThat(mockContract.getStatus()).isEqualTo(RentalContractStatus.PENDING_ACTIVATION);
        assertThat(mockContract.getSignedAt()).isNotNull();
    }
}

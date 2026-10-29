package com.boxora.service;

import com.boxora.config.DocuSealConfig;
import com.boxora.dto.request.BookingCreateRequest;
import com.boxora.dto.request.PaymentCreateRequest;
import com.boxora.dto.response.BookingResponse;
import com.boxora.dto.response.RentalContractResponse;
import com.boxora.dto.response.VNPayIpnResponse;
import com.boxora.dto.response.VNPayPaymentResponse;
import com.boxora.entity.Booking;
import com.boxora.entity.Facility;
import com.boxora.entity.Payment;
import com.boxora.entity.RentalContract;
import com.boxora.entity.StorageUnit;
import com.boxora.entity.UnitType;
import com.boxora.entity.User;
import com.boxora.enums.BookingStatus;
import com.boxora.enums.FacilityStatus;
import com.boxora.enums.PaymentStatus;
import com.boxora.enums.PaymentType;
import com.boxora.enums.RentalContractStatus;
import com.boxora.enums.UnitStatus;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.mapper.PaymentMapper;
import com.boxora.mapper.RentalContractMapper;
import com.boxora.repository.BookingRepository;
import com.boxora.repository.BookingRescheduleHistoryRepository;
import com.boxora.repository.FacilityPolicyRepository;
import com.boxora.repository.FacilityRepository;
import com.boxora.repository.PaymentRepository;
import com.boxora.repository.RefundRequestRepository;
import com.boxora.repository.RentalContractRepository;
import com.boxora.repository.RoleRepository;
import com.boxora.repository.StaffAssignmentRepository;
import com.boxora.repository.StorageUnitRepository;
import com.boxora.repository.UnitTypeRepository;
import com.boxora.repository.UserRepository;
import com.boxora.security.FacilityAccessGuard;
import com.boxora.security.RequestContext;
import com.boxora.service.impl.BookingServiceImpl;
import com.boxora.service.impl.ContractSigningServiceImpl;
import com.boxora.service.impl.PaymentServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ContractReSigningWorkflowTest {

    @Mock private BookingRepository bookingRepository;
    @Mock private StorageUnitRepository storageUnitRepository;
    @Mock private UserRepository userRepository;
    @Mock private FacilityPolicyRepository facilityPolicyRepository;
    @Mock private StorageUnitLockService storageUnitLockService;
    @Mock private ActivityLogService activityLogService;
    @Mock private PaymentRepository paymentRepository;
    @Mock private RefundRequestRepository refundRequestRepository;
    @Mock private FacilityAccessGuard facilityAccessGuard;
    @Mock private EncryptionService encryptionService;
    @Mock private PricingService pricingService;
    @Mock private RequestContext requestContext;
    @Mock private ObjectProvider<ContractSigningService> contractSigningServiceProvider;
    @Mock private BookingRescheduleHistoryRepository bookingRescheduleHistoryRepository;
    @Mock private RentalContractRepository rentalContractRepository;
    @Mock private StaffAssignmentRepository staffAssignmentRepository;
    @Mock private FacilityRepository facilityRepository;
    @Mock private UnitTypeRepository unitTypeRepository;
    @Mock private RoleRepository roleRepository;
    @Mock private EmailService emailService;
    @Mock private ObjectProvider<StorageUnitService> storageUnitServiceProvider;
    @Mock private StorageUnitService storageUnitService;
    @Mock private com.boxora.client.DocuSealClient docuSealClient;
    @Mock private com.boxora.repository.HandoverRecordRepository handoverRecordRepository;
    @Mock private com.boxora.repository.NotificationLogRepository notificationLogRepository;
    @Mock private DocuSealConfig docuSealConfig;
    @Mock private RentalContractMapper rentalContractMapper;
    @Mock private ContractRenewalService contractRenewalService;
    @Mock private ObjectProvider<ContractRenewalService> contractRenewalServiceProvider;
    @Mock private ObjectProvider<EmailService> emailServiceProvider;
    @Mock private PaymentMapper paymentMapper;
    @Mock private VNPayService vnPayService;

    private BookingServiceImpl bookingService;
    private ContractSigningServiceImpl contractSigningService;
    private PaymentServiceImpl paymentService;

    private final Map<UUID, Booking> bookingStore = new HashMap<>();
    private final List<RentalContract> contractStore = new ArrayList<>();
    private final List<Payment> paymentStore = new ArrayList<>();

    private User customer;
    private Facility facilityA;
    private Facility facilityB;
    private UnitType unitTypeSmallNonAc;
    private UnitType unitTypeSmallAc;
    private UnitType unitTypeMediumNonAc;

    private static final String VALID_SIG_V1 =
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
    private static final String VALID_SIG_V2 =
            "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M1%201%22%2F%3E%3C%2Fsvg%3E";

    @BeforeEach
    void setUp() {
        bookingStore.clear();
        contractStore.clear();
        paymentStore.clear();

        contractSigningService = new ContractSigningServiceImpl(
                docuSealClient,
                docuSealConfig,
                rentalContractRepository,
                userRepository,
                storageUnitRepository,
                facilityRepository,
                bookingRepository,
                paymentRepository,
                refundRequestRepository,
                rentalContractMapper,
                activityLogService,
                emailService,
                encryptionService,
                facilityAccessGuard,
                requestContext,
                contractRenewalService
        );

        paymentService = new PaymentServiceImpl(
                paymentRepository,
                rentalContractRepository,
                bookingRepository,
                paymentMapper,
                vnPayService,
                activityLogService,
                requestContext,
                facilityAccessGuard,
                contractRenewalServiceProvider,
                contractSigningServiceProvider,
                storageUnitLockService,
                refundRequestRepository,
                storageUnitRepository,
                docuSealConfig,
                emailServiceProvider,
                handoverRecordRepository,
                notificationLogRepository
        );

        bookingService = new BookingServiceImpl(
                bookingRepository,
                storageUnitRepository,
                userRepository,
                facilityPolicyRepository,
                storageUnitLockService,
                activityLogService,
                paymentRepository,
                refundRequestRepository,
                facilityAccessGuard,
                encryptionService,
                pricingService,
                requestContext,
                contractSigningServiceProvider,
                bookingRescheduleHistoryRepository,
                rentalContractRepository,
                staffAssignmentRepository,
                facilityRepository,
                unitTypeRepository,
                roleRepository,
                emailService,
                storageUnitServiceProvider
        );

        org.springframework.test.util.ReflectionTestUtils.setField(bookingService, "softLockHours", 24L);
        org.springframework.test.util.ReflectionTestUtils.setField(bookingService, "maxAdvanceDays", 30);
        org.springframework.test.util.ReflectionTestUtils.setField(bookingService, "approvalTimeoutHours", 24L);
        org.springframework.test.util.ReflectionTestUtils.setField(bookingService, "paymentTimeoutMinutes", 15);

        customer = User.builder()
                .fullName("Nguyen Van A")
                .email("nguyenvana@boxora.vn")
                .phone("0912345678")
                .isActive(true)
                .build();
        customer.setId(UUID.randomUUID());

        facilityA = Facility.builder()
                .name("Boxora Quan 1")
                .code("BX-Q1")
                .status(FacilityStatus.ACTIVE)
                .build();
        facilityA.setId(UUID.randomUUID());

        facilityB = Facility.builder()
                .name("Boxora Quan 7")
                .code("BX-Q7")
                .status(FacilityStatus.ACTIVE)
                .build();
        facilityB.setId(UUID.randomUUID());

        unitTypeSmallNonAc = UnitType.builder()
                .typeName("Small Standard (Non-AC)")
                .dimensions("1.5m x 1.5m x 2m")
                .areaSqm(2.25)
                .basePricePerMonth(new BigDecimal("1000000"))
                .depositAmount(new BigDecimal("500000"))
                .build();
        unitTypeSmallNonAc.setId(UUID.randomUUID());

        unitTypeSmallAc = UnitType.builder()
                .typeName("Small Climate Control (AC)")
                .dimensions("1.5m x 1.5m x 2m")
                .areaSqm(2.25)
                .basePricePerMonth(new BigDecimal("1300000"))
                .depositAmount(new BigDecimal("650000"))
                .build();
        unitTypeSmallAc.setId(UUID.randomUUID());

        unitTypeMediumNonAc = UnitType.builder()
                .typeName("Medium Standard (Non-AC)")
                .dimensions("2m x 2.5m x 2.5m")
                .areaSqm(5.0)
                .basePricePerMonth(new BigDecimal("2000000"))
                .depositAmount(new BigDecimal("1000000"))
                .build();
        unitTypeMediumNonAc.setId(UUID.randomUUID());

        lenient().when(requestContext.currentUserId()).thenReturn(customer.getId());
        lenient().when(requestContext.currentUserRole()).thenReturn("CUSTOMER");
        lenient().when(requestContext.currentIpAddress()).thenReturn("127.0.0.1");
        lenient().when(docuSealConfig.isMockActive()).thenReturn(true);
        lenient().when(userRepository.findById(customer.getId())).thenReturn(Optional.of(customer));
        lenient().when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(facilityRepository.findById(facilityA.getId())).thenReturn(Optional.of(facilityA));
        lenient().when(facilityRepository.findById(facilityB.getId())).thenReturn(Optional.of(facilityB));
        lenient().when(unitTypeRepository.findByIdForUpdate(unitTypeSmallNonAc.getId())).thenReturn(Optional.of(unitTypeSmallNonAc));
        lenient().when(unitTypeRepository.findByIdForUpdate(unitTypeSmallAc.getId())).thenReturn(Optional.of(unitTypeSmallAc));
        lenient().when(unitTypeRepository.findByIdForUpdate(unitTypeMediumNonAc.getId())).thenReturn(Optional.of(unitTypeMediumNonAc));
        lenient().when(contractSigningServiceProvider.getIfAvailable()).thenReturn(contractSigningService);
        lenient().when(storageUnitServiceProvider.getObject()).thenReturn(storageUnitService);
        lenient().when(storageUnitServiceProvider.getIfAvailable()).thenReturn(storageUnitService);
        lenient().when(storageUnitService.getAvailableUnitsCount(any(), any())).thenReturn(3L);
        lenient().when(vnPayService.createPaymentUrl(anyString(), any(BigDecimal.class), anyString(), any()))
                .thenReturn("https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_TxnRef=TEST");
        lenient().when(vnPayService.verifySignature(any())).thenReturn(true);

        lenient().when(bookingRepository.save(any(Booking.class))).thenAnswer(inv -> {
            Booking b = inv.getArgument(0);
            if (b.getId() == null) {
                b.setId(UUID.randomUUID());
            }
            bookingStore.put(b.getId(), b);
            return b;
        });
        lenient().when(bookingRepository.findById(any(UUID.class))).thenAnswer(inv ->
                Optional.ofNullable(bookingStore.get(inv.getArgument(0))));
        lenient().when(bookingRepository.findByIdForUpdate(any(UUID.class))).thenAnswer(inv ->
                Optional.ofNullable(bookingStore.get(inv.getArgument(0))));
        lenient().when(bookingRepository.findByBookingCode(anyString())).thenAnswer(inv -> {
            String code = inv.getArgument(0);
            return bookingStore.values().stream()
                    .filter(b -> code.equals(b.getBookingCode()))
                    .findFirst();
        });

        lenient().when(rentalContractRepository.save(any(RentalContract.class))).thenAnswer(inv -> {
            RentalContract c = inv.getArgument(0);
            if (c.getId() == null) {
                c.setId(UUID.randomUUID());
            }
            if (c.getCreatedAt() == null) {
                c.setCreatedAt(LocalDateTime.now().plusNanos(contractStore.size() * 1_000_000L));
            }
            contractStore.removeIf(existing -> existing.getId().equals(c.getId()));
            contractStore.add(c);
            return c;
        });
        lenient().when(rentalContractRepository.findById(any(UUID.class))).thenAnswer(inv -> {
            UUID id = inv.getArgument(0);
            return contractStore.stream().filter(c -> id.equals(c.getId())).findFirst();
        });
        lenient().when(rentalContractRepository.findByIdForUpdate(any(UUID.class))).thenAnswer(inv -> {
            UUID id = inv.getArgument(0);
            return contractStore.stream().filter(c -> id.equals(c.getId())).findFirst();
        });
        lenient().when(rentalContractRepository.findByBookingId(any(UUID.class))).thenAnswer(inv -> {
            UUID bId = inv.getArgument(0);
            return contractStore.stream()
                    .filter(c -> c.getBooking() != null && bId.equals(c.getBooking().getId()))
                    .filter(c -> c.getStatus() != RentalContractStatus.SUPERSEDED)
                    .max(Comparator.comparing(RentalContract::getCreatedAt));
        });
        lenient().when(rentalContractRepository.findByBookingIdForUpdate(any(UUID.class))).thenAnswer(inv ->
                rentalContractRepository.findByBookingId(inv.getArgument(0)));
        lenient().when(rentalContractRepository.findAllByBooking_IdOrderByCreatedAtDesc(any(UUID.class))).thenAnswer(inv -> {
            UUID bId = inv.getArgument(0);
            return contractStore.stream()
                    .filter(c -> c.getBooking() != null && bId.equals(c.getBooking().getId()))
                    .sorted(Comparator.comparing(RentalContract::getCreatedAt).reversed())
                    .toList();
        });
        lenient().when(rentalContractMapper.toResponse(any(RentalContract.class))).thenAnswer(inv -> {
            RentalContract c = inv.getArgument(0);
            return RentalContractResponse.builder()
                    .id(c.getId())
                    .contractCode(c.getContractCode())
                    .bookingId(c.getBooking() != null ? c.getBooking().getId() : null)
                    .facilityId(c.getFacility() != null ? c.getFacility().getId() : null)
                    .startDate(c.getStartDate())
                    .endDate(c.getEndDate())
                    .monthlyFee(c.getMonthlyFee())
                    .depositHeld(c.getDepositHeld())
                    .status(c.getStatus())
                    .signedAt(c.getSignedAt())
                    .signatureData(c.getSignatureData())
                    .build();
        });

        lenient().when(paymentRepository.save(any(Payment.class))).thenAnswer(inv -> {
            Payment p = inv.getArgument(0);
            if (p.getId() == null) {
                p.setId(UUID.randomUUID());
            }
            paymentStore.removeIf(existing -> existing.getId().equals(p.getId()));
            paymentStore.add(p);
            return p;
        });
        lenient().when(paymentRepository.findAllByBooking_Id(any(UUID.class))).thenAnswer(inv -> {
            UUID bId = inv.getArgument(0);
            return paymentStore.stream()
                    .filter(p -> p.getBooking() != null && bId.equals(p.getBooking().getId()))
                    .toList();
        });
        lenient().when(paymentRepository.existsByBooking_IdAndStatus(any(UUID.class), any(PaymentStatus.class))).thenAnswer(inv -> {
            UUID bId = inv.getArgument(0);
            PaymentStatus st = inv.getArgument(1);
            return paymentStore.stream()
                    .anyMatch(p -> p.getBooking() != null && bId.equals(p.getBooking().getId()) && p.getStatus() == st);
        });
        lenient().when(paymentRepository.findByTransactionId(anyString())).thenAnswer(inv -> {
            String txId = inv.getArgument(0);
            return paymentStore.stream().filter(p -> txId.equals(p.getTransactionId())).findFirst();
        });
        lenient().when(paymentRepository.findByTransactionIdForUpdate(anyString())).thenAnswer(inv ->
                paymentRepository.findByTransactionId(inv.getArgument(0)));
    }

    private BookingCreateRequest buildBaseRequest() {
        LocalDate start = LocalDate.now().plusDays(2);
        return BookingCreateRequest.builder()
                .facilityId(facilityA.getId())
                .unitTypeId(unitTypeSmallNonAc.getId())
                .customerName("Nguyen Van A")
                .customerPhone("0912345678")
                .customerEmail("nguyenvana@boxora.vn")
                .identityCardNumber("079123456789")
                .identityCardType("CCCD")
                .startDate(start)
                .rentalMonths(1)
                .totalRentalFee(new BigDecimal("1000000"))
                .depositAmount(new BigDecimal("500000"))
                .depositPaid(BigDecimal.ZERO)
                .signingMethod("ONLINE")
                .initialStatus("PENDING_SIGNATURE")
                .expectedCheckInAt(start.atTime(9, 0))
                .checkInTime("09:00")
                .build();
    }

    @Test
    @DisplayName("Scenarios 1, 2, 3, 18: Sign contract and pay directly, or view previous steps without changes -> keeps signed status and allows VNPay payment")
    void signContractAndViewPreviousStepsWithoutChanges_PreservesSignedStateAndAllowsPayment() {
        BookingCreateRequest req = buildBaseRequest();
        BookingResponse created = bookingService.createBooking(req);
        assertThat(created.getStatus()).isEqualTo(BookingStatus.PENDING_SIGNATURE);
        assertThat(created.getContractSigned()).isFalse();

        RentalContractResponse contractV1 = contractSigningService.getContractByBookingId(created.getId());
        contractSigningService.mockSign(contractV1.getId(), VALID_SIG_V1);

        Booking afterSign = bookingStore.get(created.getId());
        assertThat(afterSign.getStatus()).isEqualTo(BookingStatus.SIGNED_PENDING_PAYMENT);
        assertThat(afterSign.getContractSigned()).isTrue();

        // Scenario 3 & 18: Customer jumps back to Step 1-4 via Back button or top stepper, changes nothing, and returns to Step 5
        BookingResponse unchanged = bookingService.updateUnpaidBooking(created.getId(), req);
        assertThat(unchanged.getContractSigned()).isTrue();
        assertThat(unchanged.getContractId()).isEqualTo(contractV1.getId());
        assertThat(contractStore).hasSize(1);

        // Scenario 1 & 2: Payment succeeds without re-signing
        VNPayPaymentResponse payRes = paymentService.createVNPayPayment(PaymentCreateRequest.builder()
                .bookingId(created.getId())
                .paymentType(PaymentType.BOOKING_PAYMENT)
                .amount(new BigDecimal("1500000"))
                .build(), null);
        assertThat(payRes.getAmount()).isEqualByComparingTo("1500000");
        assertThat(payRes.getPaymentUrl()).isNotBlank();
    }

    @Test
    @DisplayName("Scenario 4: Change a field and revert back to original value -> still requires re-signing before payment")
    void changeFieldAndRevertToOriginal_StillRequiresReSigning() {
        BookingCreateRequest req = buildBaseRequest();
        BookingResponse created = bookingService.createBooking(req);
        RentalContractResponse contractV1 = contractSigningService.getContractByBookingId(created.getId());
        contractSigningService.mockSign(contractV1.getId(), VALID_SIG_V1);

        // Customer changes field on Frontend -> Frontend calls invalidateSignedContractForBooking
        BookingResponse invalidated = bookingService.invalidateSignedContractForBooking(created.getId());
        assertThat(invalidated.getContractSigned()).isFalse();
        assertThat(invalidated.getStatus()).isEqualTo(BookingStatus.PENDING_SIGNATURE);

        // Customer reverts field back to original value and submits revision
        BookingResponse reverted = bookingService.updateUnpaidBooking(created.getId(), req);
        assertThat(reverted.getContractSigned()).isFalse();
        assertThat(reverted.getStatus()).isEqualTo(BookingStatus.PENDING_SIGNATURE);
        assertThat(reverted.getContractId()).isNotEqualTo(contractV1.getId());

        // Old contract is SUPERSEDED
        RentalContract oldContract = contractStore.stream().filter(c -> c.getId().equals(contractV1.getId())).findFirst().orElseThrow();
        assertThat(oldContract.getStatus()).isEqualTo(RentalContractStatus.SUPERSEDED);
        assertThat(oldContract.getSignatureData()).isEqualTo(VALID_SIG_V1);

        // Attempting VNPay payment without re-signing is blocked
        assertThrows(AppException.class, () -> paymentService.createVNPayPayment(PaymentCreateRequest.builder()
                .bookingId(created.getId())
                .paymentType(PaymentType.BOOKING_PAYMENT)
                .amount(new BigDecimal("1500000"))
                .build(), null));
    }

    @Test
    @DisplayName("Scenarios 5, 6, 7, 8, 9, 10: Changing facility, unitType/size, AC mode, rentalMonths, startDate/checkInTime, or customer info invalidates old contract (SUPERSEDED) and creates new contract revision")
    void changingAnyContractRelevantField_SupersedesOldContractAndCreatesNewRevision() {
        BookingCreateRequest req = buildBaseRequest();
        BookingResponse created = bookingService.createBooking(req);
        UUID bookingId = created.getId();

        // Sign V1
        RentalContractResponse v1 = contractSigningService.getContractByBookingId(bookingId);
        contractSigningService.mockSign(v1.getId(), VALID_SIG_V1);

        // Scenario 5: Change Facility (Q1 -> Q7)
        BookingCreateRequest changeFacility = buildBaseRequest();
        changeFacility.setFacilityId(facilityB.getId());
        BookingResponse afterFacChange = bookingService.updateUnpaidBooking(bookingId, changeFacility);
        assertThat(afterFacChange.getContractSigned()).isFalse();
        assertThat(afterFacChange.getFacilityId()).isEqualTo(facilityB.getId());
        RentalContractResponse v2 = contractSigningService.getContractByBookingId(bookingId);
        assertThat(v2.getId()).isNotEqualTo(v1.getId());
        assertThat(v2.getStatus()).isEqualTo(RentalContractStatus.PENDING_SIGNATURE);
        assertThat(v2.getFacilityId()).isEqualTo(facilityB.getId());
        contractSigningService.mockSign(v2.getId(), VALID_SIG_V1);

        // Scenario 6 & 7: Change UnitType / AC mode (Small Non-AC -> Small AC -> Medium)
        BookingCreateRequest changeAc = buildBaseRequest();
        changeAc.setFacilityId(facilityB.getId());
        changeAc.setUnitTypeId(unitTypeSmallAc.getId());
        changeAc.setTotalRentalFee(new BigDecimal("1300000"));
        changeAc.setDepositAmount(new BigDecimal("650000"));
        BookingResponse afterAcChange = bookingService.updateUnpaidBooking(bookingId, changeAc);
        assertThat(afterAcChange.getContractSigned()).isFalse();
        RentalContractResponse v3 = contractSigningService.getContractByBookingId(bookingId);
        assertThat(v3.getId()).isNotEqualTo(v2.getId());
        assertThat(v3.getMonthlyFee()).isEqualByComparingTo("1300000");
        contractSigningService.mockSign(v3.getId(), VALID_SIG_V1);

        // Scenario 8: Change Rental Duration (1 month -> 3 months)
        BookingCreateRequest changeMonths = buildBaseRequest();
        changeMonths.setFacilityId(facilityB.getId());
        changeMonths.setUnitTypeId(unitTypeMediumNonAc.getId());
        changeMonths.setRentalMonths(3);
        changeMonths.setTotalRentalFee(new BigDecimal("6000000"));
        changeMonths.setDepositAmount(new BigDecimal("1000000"));
        BookingResponse afterMonthsChange = bookingService.updateUnpaidBooking(bookingId, changeMonths);
        assertThat(afterMonthsChange.getContractSigned()).isFalse();
        assertThat(afterMonthsChange.getRentalMonths()).isEqualTo(3);
        RentalContractResponse v4 = contractSigningService.getContractByBookingId(bookingId);
        assertThat(v4.getEndDate()).isEqualTo(changeMonths.getStartDate().plusMonths(3));
        assertThat(v4.getMonthlyFee()).isEqualByComparingTo("2000000");
        contractSigningService.mockSign(v4.getId(), VALID_SIG_V1);

        // Scenario 9: Change Start Date & Check-in Time
        LocalDate newStart = LocalDate.now().plusDays(5);
        BookingCreateRequest changeDates = buildBaseRequest();
        changeDates.setFacilityId(facilityB.getId());
        changeDates.setUnitTypeId(unitTypeMediumNonAc.getId());
        changeDates.setRentalMonths(3);
        changeDates.setTotalRentalFee(new BigDecimal("6000000"));
        changeDates.setDepositAmount(new BigDecimal("1000000"));
        changeDates.setStartDate(newStart);
        changeDates.setExpectedCheckInAt(newStart.atTime(14, 0));
        changeDates.setCheckInTime("14:00");
        BookingResponse afterDateChange = bookingService.updateUnpaidBooking(bookingId, changeDates);
        assertThat(afterDateChange.getContractSigned()).isFalse();
        RentalContractResponse v5 = contractSigningService.getContractByBookingId(bookingId);
        assertThat(v5.getStartDate()).isEqualTo(newStart);
        contractSigningService.mockSign(v5.getId(), VALID_SIG_V1);

        // Scenario 10: Change Customer Identity / Contact info
        BookingCreateRequest changeCustomer = buildBaseRequest();
        changeCustomer.setFacilityId(facilityB.getId());
        changeCustomer.setUnitTypeId(unitTypeMediumNonAc.getId());
        changeCustomer.setRentalMonths(3);
        changeCustomer.setTotalRentalFee(new BigDecimal("6000000"));
        changeCustomer.setDepositAmount(new BigDecimal("1000000"));
        changeCustomer.setStartDate(newStart);
        changeCustomer.setExpectedCheckInAt(newStart.atTime(14, 0));
        changeCustomer.setCustomerName("Tran Thi B");
        changeCustomer.setCustomerPhone("0987654321");
        changeCustomer.setIdentityCardNumber("079987654321");
        BookingResponse afterCustChange = bookingService.updateUnpaidBooking(bookingId, changeCustomer);
        assertThat(afterCustChange.getContractSigned()).isFalse();
        assertThat(afterCustChange.getCustomerName()).isEqualTo("Tran Thi B");
        assertThat(afterCustChange.getCustomerPhone()).isEqualTo("0987654321");
        assertThat(afterCustChange.getIdentityCardNumber()).isEqualTo("079987654321");

        // Verify all 5 previous contracts are preserved as SUPERSEDED
        long supersededCount = contractStore.stream()
                .filter(c -> c.getStatus() == RentalContractStatus.SUPERSEDED)
                .count();
        assertThat(supersededCount).isEqualTo(5);
    }

    @Test
    @DisplayName("Scenarios 11, 12, 13: Direct payment API call after booking change is blocked until re-signed; after re-signing V2, payment succeeds with new amount and active contract is V2")
    void paymentBlockedAfterChangeUntilReSigned_ThenSucceedsWithNewContractAndAmount() {
        BookingCreateRequest req = buildBaseRequest();
        BookingResponse created = bookingService.createBooking(req);
        UUID bookingId = created.getId();

        // Sign V1 (total = 1,000,000 + 500,000 = 1,500,000)
        RentalContractResponse v1 = contractSigningService.getContractByBookingId(bookingId);
        contractSigningService.mockSign(v1.getId(), VALID_SIG_V1);

        // Change to Medium unit for 3 months (total = 6,000,000 + 1,000,000 = 7,000,000)
        BookingCreateRequest updatedReq = buildBaseRequest();
        updatedReq.setUnitTypeId(unitTypeMediumNonAc.getId());
        updatedReq.setRentalMonths(3);
        updatedReq.setTotalRentalFee(new BigDecimal("6000000"));
        updatedReq.setDepositAmount(new BigDecimal("1000000"));
        bookingService.updateUnpaidBooking(bookingId, updatedReq);

        // Scenario 11: Attempting to call createVNPayPayment without re-signing V2 is strictly rejected
        AppException blockedEx = assertThrows(AppException.class, () -> paymentService.createVNPayPayment(
                PaymentCreateRequest.builder()
                        .bookingId(bookingId)
                        .paymentType(PaymentType.BOOKING_PAYMENT)
                        .amount(new BigDecimal("7000000"))
                        .build(), null));
        assertThat(blockedEx.getErrorCode()).isEqualTo(ErrorCode.INVALID_REQUEST);

        // Scenario 12: Re-sign V2 and pay
        RentalContractResponse v2 = contractSigningService.getContractByBookingId(bookingId);
        assertThat(v2.getId()).isNotEqualTo(v1.getId());
        assertThat(v2.getStatus()).isEqualTo(RentalContractStatus.PENDING_SIGNATURE);
        contractSigningService.mockSign(v2.getId(), VALID_SIG_V2);

        // Attempting to pay old amount (1,500,000) is rejected with PAYMENT_AMOUNT_MISMATCH
        AppException amountMismatchEx = assertThrows(AppException.class, () -> paymentService.createVNPayPayment(
                PaymentCreateRequest.builder()
                        .bookingId(bookingId)
                        .paymentType(PaymentType.BOOKING_PAYMENT)
                        .amount(new BigDecimal("1500000"))
                        .build(), null));
        assertThat(amountMismatchEx.getErrorCode()).isEqualTo(ErrorCode.PAYMENT_AMOUNT_MISMATCH);

        // Paying new amount (7,000,000) succeeds
        VNPayPaymentResponse vnpayRes = paymentService.createVNPayPayment(
                PaymentCreateRequest.builder()
                        .bookingId(bookingId)
                        .paymentType(PaymentType.BOOKING_PAYMENT)
                        .amount(new BigDecimal("7000000"))
                        .build(), null);
        assertThat(vnpayRes.getAmount()).isEqualByComparingTo("7000000");

        // Simulate VNPay IPN success
        Payment pendingPayment = paymentStore.stream()
                .filter(p -> p.getStatus() == PaymentStatus.PENDING)
                .findFirst().orElseThrow();
        Map<String, String> ipnParams = new HashMap<>();
        ipnParams.put("vnp_TxnRef", pendingPayment.getTransactionId());
        ipnParams.put("vnp_ResponseCode", "00");
        ipnParams.put("vnp_TransactionStatus", "00");
        ipnParams.put("vnp_Amount", "700000000");
        VNPayIpnResponse ipnRes = paymentService.processVNPayIPN(ipnParams);
        assertThat(ipnRes.getRspCode()).isEqualTo("00");

        // Scenario 13: Active contract after payment is V2 (with VALID_SIG_V2), while V1 remains SUPERSEDED
        RentalContractResponse activeAfterPayment = contractSigningService.getContractByBookingId(bookingId);
        assertThat(activeAfterPayment.getId()).isEqualTo(v2.getId());
        assertThat(activeAfterPayment.getSignatureData()).isEqualTo(VALID_SIG_V2);
        assertThat(bookingStore.get(bookingId).getStatus()).isEqualTo(BookingStatus.PAID_AND_SIGNED);
    }

    @Test
    @DisplayName("Scenarios 14 & 15: Updating unpaid booking reuses the same booking record (no duplicate holding booking) and releases physical unit if changed")
    void updatingUnpaidBooking_DoesNotDoubleDeductInventoryAndReleasesOldUnit() {
        StorageUnit unit1 = StorageUnit.builder()
                .unitCode("Q1-S-101")
                .facility(facilityA)
                .unitType(unitTypeSmallNonAc)
                .status(UnitStatus.AVAILABLE)
                .build();
        unit1.setId(UUID.randomUUID());

        when(storageUnitRepository.findWithDetailsByIdForUpdate(unit1.getId())).thenReturn(Optional.of(unit1));
        when(storageUnitRepository.save(any(StorageUnit.class))).thenAnswer(inv -> inv.getArgument(0));
        when(pricingService.calculateQuote(any())).thenReturn(com.boxora.dto.response.PricingQuoteResponse.builder()
                .totalRentalFee(new BigDecimal("1000000"))
                .depositAmount(new BigDecimal("500000"))
                .build());

        BookingCreateRequest req = buildBaseRequest();
        req.setStorageUnitId(unit1.getId());
        BookingResponse created = bookingService.createBooking(req);
        assertThat(unit1.getStatus()).isEqualTo(UnitStatus.RESERVED);
        assertThat(bookingStore).hasSize(1);

        // Customer updates booking to unassigned unitTypeMediumNonAc via bookingCode reuse
        BookingCreateRequest updateByCodeReq = buildBaseRequest();
        updateByCodeReq.setBookingCode(created.getBookingCode());
        updateByCodeReq.setStorageUnitId(null);
        updateByCodeReq.setUnitTypeId(unitTypeMediumNonAc.getId());
        updateByCodeReq.setTotalRentalFee(new BigDecimal("2000000"));
        updateByCodeReq.setDepositAmount(new BigDecimal("1000000"));

        BookingResponse updated = bookingService.createBooking(updateByCodeReq);
        assertThat(updated.getId()).isEqualTo(created.getId());
        assertThat(bookingStore).hasSize(1); // Strictly 1 booking, no duplicate created!
        assertThat(unit1.getStatus()).isEqualTo(UnitStatus.AVAILABLE); // Old unit released!
        assertThat(updated.getUnitTypeId()).isEqualTo(unitTypeMediumNonAc.getId());
    }

    @Test
    @DisplayName("Scenario 16: Paid or active booking rejects direct unpaid-revision modification")
    void paidBooking_RejectsUnpaidRevisionUpdate() {
        BookingCreateRequest req = buildBaseRequest();
        BookingResponse created = bookingService.createBooking(req);
        Booking b = bookingStore.get(created.getId());
        b.setPaymentStatus("PAID");
        b.setStatus(BookingStatus.PAID_AND_SIGNED);

        BookingCreateRequest modified = buildBaseRequest();
        modified.setRentalMonths(6);
        modified.setTotalRentalFee(new BigDecimal("6000000"));

        AppException ex = assertThrows(AppException.class,
                () -> bookingService.updateUnpaidBooking(created.getId(), modified));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.INVALID_REQUEST);
    }

    @Test
    @DisplayName("Scenario 17: Late DocuSeal webhook on SUPERSEDED contract or late VNPay IPN on EXPIRED payment does not overwrite new contract or activate modified booking")
    void lateWebhookOnSupersededContractOrExpiredPayment_IgnoredSafely() {
        BookingCreateRequest req = buildBaseRequest();
        BookingResponse created = bookingService.createBooking(req);
        UUID bookingId = created.getId();

        RentalContractResponse v1 = contractSigningService.getContractByBookingId(bookingId);
        RentalContract contractV1Entity = contractStore.stream().filter(c -> c.getId().equals(v1.getId())).findFirst().orElseThrow();
        contractV1Entity.setDocusealSubmissionId(1111L);
        contractSigningService.mockSign(v1.getId(), VALID_SIG_V1);

        // Initiate payment on V1 before modifying booking
        paymentService.createVNPayPayment(PaymentCreateRequest.builder()
                .bookingId(bookingId)
                .paymentType(PaymentType.BOOKING_PAYMENT)
                .amount(new BigDecimal("1500000"))
                .build(), null);
        Payment oldPayment = paymentStore.get(0);
        assertThat(oldPayment.getStatus()).isEqualTo(PaymentStatus.PENDING);

        // Modify booking -> V1 becomes SUPERSEDED, V2 becomes PENDING_SIGNATURE, oldPayment becomes EXPIRED
        BookingCreateRequest modified = buildBaseRequest();
        modified.setRentalMonths(3);
        modified.setTotalRentalFee(new BigDecimal("3000000"));
        bookingService.updateUnpaidBooking(bookingId, modified);

        assertThat(oldPayment.getStatus()).isEqualTo(PaymentStatus.EXPIRED);
        assertThat(contractV1Entity.getStatus()).isEqualTo(RentalContractStatus.SUPERSEDED);

        // Late DocuSeal webhook arrives for V1 (submission_id = 1111L) -> must NOT reactivate V1 or mark booking signed
        Map<String, Object> lateWebhook = Map.of(
                "event_type", "form.completed",
                "data", Map.of(
                        "external_id", v1.getId().toString(),
                        "submission_id", 1111L,
                        "documents", List.of(Map.of("url", "https://docuseal.com/docs/old-v1.pdf"))
                )
        );
        contractSigningService.handleWebhook(lateWebhook);
        assertThat(contractV1Entity.getStatus()).isEqualTo(RentalContractStatus.SUPERSEDED);
        assertThat(bookingStore.get(bookingId).getContractSigned()).isFalse();
        assertThat(bookingStore.get(bookingId).getStatus()).isEqualTo(BookingStatus.PENDING_SIGNATURE);

        // Late VNPay IPN arrives for oldPayment -> must NOT confirm modified booking, marks payment REFUND_PENDING
        Map<String, String> lateIpn = new HashMap<>();
        lateIpn.put("vnp_TxnRef", oldPayment.getTransactionId());
        lateIpn.put("vnp_ResponseCode", "00");
        lateIpn.put("vnp_TransactionStatus", "00");
        lateIpn.put("vnp_Amount", "150000000");
        paymentService.processVNPayIPN(lateIpn);

        assertThat(oldPayment.getStatus()).isEqualTo(PaymentStatus.REFUND_PENDING);
        assertThat(bookingStore.get(bookingId).getStatus()).isEqualTo(BookingStatus.PENDING_SIGNATURE);
    }
}


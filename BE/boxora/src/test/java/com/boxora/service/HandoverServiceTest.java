package com.boxora.service;

import com.boxora.dto.request.HandoverRequest;
import com.boxora.dto.request.ManualPaymentRecordRequest;
import com.boxora.dto.response.HandoverPrerequisitesResponse;
import com.boxora.dto.response.HandoverResponse;
import com.boxora.dto.response.ReturnSettlementPreviewResponse;
import com.boxora.dto.response.ReturnSettlementResponse;
import com.boxora.entity.*;
import com.boxora.enums.*;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.repository.*;
import com.boxora.service.impl.HandoverServiceImpl;
import org.mockito.ArgumentCaptor;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
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
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class HandoverServiceTest {

    @Mock
    private HandoverRecordRepository handoverRecordRepository;

    @Mock
    private BookingRepository bookingRepository;

    @Mock
    private StorageUnitRepository storageUnitRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private PaymentRepository paymentRepository;

    @Mock
    private RentalContractRepository rentalContractRepository;

    @Mock
    private FacilityPolicyRepository facilityPolicyRepository;

    @Mock
    private RefundRequestRepository refundRequestRepository;

    @Mock
    private EncryptionService encryptionService;

    @Mock
    private ActivityLogService activityLogService;

    @Mock
    private com.boxora.security.FacilityAccessGuard facilityAccessGuard;

    @Mock
    private com.boxora.security.RequestContext requestContext;

    @Mock
    private NotificationLogRepository notificationLogRepository;

    @Mock
    private EmailService emailService;

    @Mock
    private com.boxora.mapper.PaymentMapper paymentMapper;

    @Mock
    private com.boxora.mapper.RentalContractMapper rentalContractMapper;

    @Mock
    private CustomerDebtRepository customerDebtRepository;

    @Mock
    private FileStorageService fileStorageService;

    @Mock
    private com.boxora.service.impl.HandoverPinMailer pinMailer;

    private HandoverServiceImpl handoverService;

    private Facility testFacility;
    private StorageUnit testUnit;
    private User testCustomer;
    private User testStaff;
    private Booking testBooking;
    private RentalContract testContract;
    private UUID bookingId;
    private UUID staffId;

    @BeforeEach
    void setUp() {
        bookingId = UUID.randomUUID();
        staffId = UUID.randomUUID();

        testFacility = Facility.builder()
                .name("Boxora Tan Binh")
                .build();
        testFacility.setId(UUID.randomUUID());

        testCustomer = User.builder()
                .fullName("Trần Minh Tuấn")
                .email("tuan.tran@gmail.com")
                .phone("0912.345.678")
                .role(Role.builder().name("CUSTOMER").build())
                .build();
        testCustomer.setId(UUID.randomUUID());

        testStaff = User.builder()
                .fullName("Lê Nhân Viên")
                .email("staff@boxora.com")
                .role(Role.builder().name("STAFF").build())
                .build();
        testStaff.setId(staffId);

        testUnit = StorageUnit.builder()
                .unitCode("A-112")
                .facility(testFacility)
                .status(UnitStatus.RESERVED)
                .build();
        testUnit.setId(UUID.randomUUID());

        testBooking = Booking.builder()
                .bookingCode("RES-8921")
                .customer(testCustomer)
                .storageUnit(testUnit)
                .startDate(LocalDate.now())
                .endDate(LocalDate.now().plusMonths(12))
                .rentalMonths(12)
                .totalRentalFee(new BigDecimal("18000000.00"))
                .depositPaid(new BigDecimal("1500000.00"))
                .status(BookingStatus.CONFIRMED)
                .identityVerifiedByStaff(testStaff)
                .identityVerifiedAt(LocalDateTime.now())
                .identityCardNumber("001092003891")
                .build();
        testBooking.setId(bookingId);

        testContract = RentalContract.builder()
                .contractCode("HD-8921-2026")
                .booking(testBooking)
                .customer(testCustomer)
                .unit(testUnit)
                .facility(testFacility)
                .startDate(LocalDate.now())
                .endDate(LocalDate.now().plusMonths(12))
                .monthlyFee(new BigDecimal("1500000.00"))
                .status(RentalContractStatus.PENDING_ACTIVATION)
                .signedAt(LocalDateTime.now())
                .docusealSubmissionId(998822L)
                .build();
        testContract.setId(UUID.randomUUID());

        lenient().when(encryptionService.encrypt(anyString())).thenReturn("739215");
        lenient().when(encryptionService.decrypt(anyString())).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(refundRequestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Payment rentPayment = Payment.builder()
                .paymentType(PaymentType.RENTAL_FEE)
                .status(PaymentStatus.PAID)
                .amount(new BigDecimal("1500000.00"))
                .build();
        lenient().when(paymentRepository.findAllByBooking_Id(any())).thenReturn(List.of(rentPayment));
        lenient().when(paymentMapper.toResponse(any())).thenReturn(new com.boxora.dto.response.PaymentResponse());
        lenient().when(rentalContractMapper.toResponse(any())).thenReturn(new com.boxora.dto.response.RentalContractResponse());

        lenient().when(requestContext.currentUserId()).thenReturn(staffId);
        lenient().when(userRepository.findById(staffId)).thenReturn(Optional.of(testStaff));
        lenient().when(customerDebtRepository.save(any(CustomerDebt.class))).thenAnswer(inv -> {
            CustomerDebt debt = inv.getArgument(0);
            debt.setId(UUID.randomUUID());
            return debt;
        });

        // The real overdue rule, reading the (mocked) facility policy repository.
        OverdueFeeCalculator overdueFeeCalculator = new OverdueFeeCalculator(facilityPolicyRepository);
        handoverService = new HandoverServiceImpl(
                handoverRecordRepository, bookingRepository, storageUnitRepository, userRepository, paymentRepository,
                rentalContractRepository, facilityPolicyRepository, activityLogService, encryptionService,
                refundRequestRepository, customerDebtRepository, notificationLogRepository, emailService,
                fileStorageService, overdueFeeCalculator, facilityAccessGuard, requestContext, paymentMapper,
                rentalContractMapper, pinMailer);
    }

    /** A saved CHECK_IN_INSPECTION record: 5/5 passed and two uploaded photos, as the wizard step 2 stores it. */
    private HandoverRecord passedInspection() {
        return HandoverRecord.builder()
                .booking(testBooking)
                .recordType("CHECK_IN_INSPECTION")
                .unitCondition("5/5 tiêu chí đạt")
                .checklistSummary("Cửa cuốn: Đạt | Vệ sinh: Sạch sẽ | SmartLock: Tốt | Cảm biến IoT: Chuẩn | Tường vách: Nguyên vẹn")
                .evidencePhotos("[\"/uploads/handover/a.jpg\",\"/uploads/handover/b.jpg\"]")
                .recordedAt(LocalDateTime.now())
                .build();
    }

    @Nested
    @DisplayName("Kiểm tra 4 điều kiện bàn giao (BR-RULE-005 Prerequisites)")
    class PrerequisitesTests {

        @Test
        @DisplayName("Thỏa mãn đủ cả 4 điều kiện -> eligibleForCheckIn = true")
        void getCheckInPrerequisites_AllFourSatisfied() {
            Payment rentPayment = Payment.builder()
                    .paymentType(PaymentType.RENTAL_FEE)
                    .status(PaymentStatus.PAID)
                    .amount(new BigDecimal("1500000.00"))
                    .build();

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(paymentRepository.findAllByBooking_Id(bookingId)).thenReturn(List.of(rentPayment));
            when(rentalContractRepository.findByBookingId(bookingId)).thenReturn(Optional.of(testContract));

            HandoverPrerequisitesResponse response = handoverService.getCheckInPrerequisites(bookingId);

            assertThat(response).isNotNull();
            assertThat(response.isDepositSatisfied()).isTrue();
            assertThat(response.isFirstMonthRentSatisfied()).isTrue();
            assertThat(response.isContractSigned()).isTrue();
            assertThat(response.isIdentityVerified()).isTrue();
            assertThat(response.isEligibleForCheckIn()).isTrue();
            assertThat(response.getMissingPrerequisites()).isEmpty();
        }

        @Test
        @DisplayName("Chưa đối soát giấy tờ: idCardNumber = null, không lấy số điện thoại khách thay thế")
        void getCheckInPrerequisites_UnverifiedIdentity_DoesNotInventIdNumber() {
            testBooking.setIdentityVerifiedAt(null);
            testBooking.setIdentityVerifiedByStaff(null);
            testBooking.setIdentityCardNumber(null);

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(rentalContractRepository.findByBookingId(bookingId)).thenReturn(Optional.of(testContract));

            HandoverPrerequisitesResponse response = handoverService.getCheckInPrerequisites(bookingId);

            assertThat(response.isIdentityVerified()).isFalse();
            assertThat(response.getIdCardNumber()).isNull();
            assertThat(response.getCustomerPhone()).isEqualTo("0912.345.678");
        }

        @Test
        @DisplayName("Thiếu tiền cọc và chưa ký hợp đồng -> eligibleForCheckIn = false")
        void getCheckInPrerequisites_MissingPrerequisites() {
            testBooking.setDepositPaid(BigDecimal.ZERO);

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(paymentRepository.findAllByBooking_Id(bookingId)).thenReturn(List.of());
            when(rentalContractRepository.findByBookingId(bookingId)).thenReturn(Optional.empty());

            HandoverPrerequisitesResponse response = handoverService.getCheckInPrerequisites(bookingId);

            assertThat(response).isNotNull();
            assertThat(response.isDepositSatisfied()).isFalse();
            assertThat(response.isFirstMonthRentSatisfied()).isFalse();
            assertThat(response.isContractSigned()).isFalse();
            assertThat(response.isEligibleForCheckIn()).isFalse();
            assertThat(response.getMissingPrerequisites()).hasSize(3);
        }
    }

    @Nested
    @DisplayName("Thực hiện Check-in bàn giao kho (BR-RULE-005/006)")
    class CheckInExecutionTests {

        @Test
        @DisplayName("Đủ 4 điều kiện: Check-in thành công, Booking ACTIVE, Unit OCCUPIED, cấp PIN & RFID")
        void checkIn_Success_AllConditionsMet() {
            HandoverRequest request = HandoverRequest.builder()
                    .bookingId(bookingId)
                    .staffId(staffId)
                    .idCardNumber("001092003891")
                    .identityVerified(true)
                    .firstMonthRentConfirmed(true)
                    .contractConfirmed(true)
                    .rfidCardNumber("RF-409")
                    .accessPin("739215")
                    .unitCondition("Đạt chuẩn 5/5 kiểm định hiện trạng")
                    .notes("Đã bàn giao thẻ từ và hướng dẫn bấm PIN sảnh")
                    .build();

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(rentalContractRepository.findByBookingId(bookingId)).thenReturn(Optional.of(testContract));
            when(userRepository.findById(staffId)).thenReturn(Optional.of(testStaff));
            when(handoverRecordRepository.findFirstByBooking_IdAndRecordTypeOrderByRecordedAtDesc(bookingId, "CHECK_IN_INSPECTION"))
                    .thenReturn(Optional.of(passedInspection()));
            when(emailService.isMailConfigured()).thenReturn(true);
            when(notificationLogRepository.save(any(NotificationLog.class))).thenAnswer(invocation -> invocation.getArgument(0));
            when(handoverRecordRepository.save(any(HandoverRecord.class)))
                    .thenAnswer(invocation -> invocation.getArgument(0));

            HandoverResponse response = handoverService.checkIn(request);

            assertThat(response).isNotNull();
            assertThat(response.getRecordType()).isEqualTo("CHECK_IN");
            // The one place the plain PIN is returned. The mail is queued for after the commit, never sent in the request.
            assertThat(response.getAccessPin()).matches("^[0-9]{6}$");
            assertThat(response.getEmailSent()).isFalse();
            assertThat(response.getEmailQueued()).isTrue();
            assertThat(response.getRfidCardNumber()).isEqualTo("RF-409");
            assertThat(response.getEvidencePhotos()).containsExactly("/uploads/handover/a.jpg", "/uploads/handover/b.jpg");
            verify(emailService, never()).sendNow(anyString(), anyString(), anyString());
            verify(pinMailer).sendAfterCommit(eq("tuan.tran@gmail.com"), anyString(), contains(response.getAccessPin()), eq("RES-8921"));

            // The in-app notification must never carry the PIN.
            ArgumentCaptor<NotificationLog> notification = ArgumentCaptor.forClass(NotificationLog.class);
            verify(notificationLogRepository).save(notification.capture());
            assertThat(notification.getValue().getContent()).doesNotContain(response.getAccessPin());

            // Verify entity state updates
            assertThat(testBooking.getStatus()).isEqualTo(BookingStatus.ACTIVE);
            assertThat(testBooking.getHandoverTime()).isNotNull();
            assertThat(testBooking.getStartDate()).isEqualTo(LocalDate.now());
            assertThat(testBooking.getEndDate()).isEqualTo(LocalDate.now().plusMonths(12));
            assertThat(testBooking.getAccessPin()).isEqualTo("739215");
            assertThat(testUnit.getStatus()).isEqualTo(UnitStatus.OCCUPIED);
            assertThat(testContract.getStatus()).isEqualTo(RentalContractStatus.ACTIVE);
            assertThat(testContract.getStartDate()).isEqualTo(LocalDate.now());
            assertThat(testContract.getEndDate()).isEqualTo(LocalDate.now().plusMonths(12));

            // Verify Activity Logs
            verify(activityLogService).record(
                    eq(testFacility.getId()),
                    eq(ActivityAction.CHECKIN_VERIFIED),
                    eq("Booking"),
                    eq(bookingId),
                    anyString(),
                    isNull(),
                    isNull()
            );
            verify(activityLogService).record(
                    eq(testFacility.getId()),
                    eq(ActivityAction.HANDOVER_COMPLETE),
                    eq("HandoverRecord"),
                    any(),
                    anyString(),
                    eq(UnitStatus.RESERVED),
                    eq(UnitStatus.OCCUPIED)
            );
        }

        @Test
        @DisplayName("Thiếu đối soát CCCD: Ném HANDOVER_PREREQUISITES_NOT_MET")
        void checkIn_MissingIdCard_ThrowsException() {
            HandoverRequest request = HandoverRequest.builder()
                    .bookingId(bookingId)
                    .firstMonthRentConfirmed(true)
                    .contractConfirmed(true)
                    .idCardNumber(null)
                    .identityVerified(false)
                    .build();

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(rentalContractRepository.findByBookingId(bookingId)).thenReturn(Optional.of(testContract));

            AppException ex = assertThrows(AppException.class, () -> handoverService.checkIn(request));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.HANDOVER_PREREQUISITES_NOT_MET);
        }

        @Test
        @DisplayName("BR-RULE-006: Ngăn kho đang UNDER_MAINTENANCE không ready -> Ném HANDOVER_UNIT_NOT_READY")
        void checkIn_UnitNotReady_ThrowsException() {
            testUnit.setStatus(UnitStatus.UNDER_MAINTENANCE);

            HandoverRequest request = HandoverRequest.builder()
                    .bookingId(bookingId)
                    .idCardNumber("001092003891")
                    .identityVerified(true)
                    .firstMonthRentConfirmed(true)
                    .contractConfirmed(true)
                    .build();

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));

            AppException ex = assertThrows(AppException.class, () -> handoverService.checkIn(request));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.HANDOVER_UNIT_NOT_READY);
        }

        @Test
        @DisplayName("Đơn đã ACTIVE từ trước: Ném HANDOVER_ALREADY_ACTIVE")
        void checkIn_AlreadyActive_ThrowsException() {
            testBooking.setStatus(BookingStatus.ACTIVE);

            HandoverRequest request = HandoverRequest.builder()
                    .bookingId(bookingId)
                    .build();

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));

            AppException ex = assertThrows(AppException.class, () -> handoverService.checkIn(request));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.HANDOVER_ALREADY_ACTIVE);
        }

        @Test
        @DisplayName("Người thực hiện checkIn là CUSTOMER (không có quyền STAFF) -> Ném FORBIDDEN")
        void checkIn_CustomerRoleAttempt_ThrowsForbidden() {
            User customerOperator = User.builder()
                    .fullName("Khách hàng tự checkin")
                    .role(Role.builder().name("CUSTOMER").build())
                    .build();
            UUID custOpId = UUID.randomUUID();
            customerOperator.setId(custOpId);

            HandoverRequest request = HandoverRequest.builder()
                    .bookingId(bookingId)
                    .staffId(custOpId)
                    .idCardNumber("001092003891")
                    .identityVerified(true)
                    .build();

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(requestContext.currentUserId()).thenReturn(custOpId);
            when(userRepository.findById(custOpId)).thenReturn(Optional.of(customerOperator));

            AppException ex = assertThrows(AppException.class, () -> handoverService.checkIn(request));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.FORBIDDEN);
        }

        @Test
        @DisplayName("Không xác định được nhân viên thực hiện bàn giao -> Ném FORBIDDEN")
        void checkIn_MissingStaff_ThrowsForbidden() {
            UUID unknownStaffId = UUID.randomUUID();
            HandoverRequest request = HandoverRequest.builder()
                    .bookingId(bookingId)
                    .staffId(unknownStaffId)
                    .idCardNumber("001092003891")
                    .identityVerified(true)
                    .build();

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(userRepository.findById(unknownStaffId)).thenReturn(Optional.empty());
            when(requestContext.currentUserId()).thenReturn(null);

            AppException ex = assertThrows(AppException.class, () -> handoverService.checkIn(request));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.FORBIDDEN);
        }

        @Test
        @DisplayName("Số CCCD sai định dạng (không phải 9-12 chữ số) -> Ném HANDOVER_PREREQUISITES_NOT_MET")
        void checkIn_InvalidCccdFormat_ThrowsPrerequisitesNotMet() {
            HandoverRequest request = HandoverRequest.builder()
                    .bookingId(bookingId)
                    .staffId(staffId)
                    .idCardNumber("123ABC_NOT_CCCD")
                    .identityVerified(true)
                    .build();

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(rentalContractRepository.findByBookingId(bookingId)).thenReturn(Optional.of(testContract));
            when(userRepository.findById(staffId)).thenReturn(Optional.of(testStaff));

            AppException ex = assertThrows(AppException.class, () -> handoverService.checkIn(request));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.HANDOVER_PREREQUISITES_NOT_MET);
        }

        @Test
        @DisplayName("Chưa có biên bản nghiệm thu 5/5 kèm 2 ảnh -> Ném HANDOVER_INSPECTION_REQUIRED, không cấp PIN")
        void checkIn_WithoutInspectionRecord_ThrowsInspectionRequired() {
            HandoverRequest request = HandoverRequest.builder()
                    .bookingId(bookingId)
                    .staffId(staffId)
                    .idCardNumber("001092003891")
                    .identityVerified(true)
                    .build();

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(rentalContractRepository.findByBookingId(bookingId)).thenReturn(Optional.of(testContract));
            when(userRepository.findById(staffId)).thenReturn(Optional.of(testStaff));

            AppException ex = assertThrows(AppException.class, () -> handoverService.checkIn(request));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.HANDOVER_INSPECTION_REQUIRED);
            assertThat(testBooking.getAccessPin()).isNull();
            assertThat(testUnit.getStatus()).isEqualTo(UnitStatus.RESERVED);
        }

        @Test
        @DisplayName("Biên bản nghiệm thu chỉ có 1 ảnh -> Ném HANDOVER_INSPECTION_REQUIRED")
        void checkIn_InspectionWithOnePhoto_ThrowsInspectionRequired() {
            HandoverRecord inspection = passedInspection();
            inspection.setEvidencePhotos("[\"/uploads/handover/a.jpg\"]");
            HandoverRequest request = HandoverRequest.builder()
                    .bookingId(bookingId)
                    .staffId(staffId)
                    .idCardNumber("001092003891")
                    .identityVerified(true)
                    .build();

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(rentalContractRepository.findByBookingId(bookingId)).thenReturn(Optional.of(testContract));
            when(userRepository.findById(staffId)).thenReturn(Optional.of(testStaff));
            when(handoverRecordRepository.findFirstByBooking_IdAndRecordTypeOrderByRecordedAtDesc(bookingId, "CHECK_IN_INSPECTION"))
                    .thenReturn(Optional.of(inspection));

            AppException ex = assertThrows(AppException.class, () -> handoverService.checkIn(request));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.HANDOVER_INSPECTION_REQUIRED);
        }

        @Test
        @DisplayName("Email không gửi được -> vẫn bàn giao, emailSent=false kèm lý do (không báo thành công giả)")
        void checkIn_EmailFailure_IsReportedHonestly() {
            HandoverRequest request = HandoverRequest.builder()
                    .bookingId(bookingId)
                    .staffId(staffId)
                    .idCardNumber("001092003891")
                    .identityVerified(true)
                    .build();

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(rentalContractRepository.findByBookingId(bookingId)).thenReturn(Optional.of(testContract));
            when(userRepository.findById(staffId)).thenReturn(Optional.of(testStaff));
            when(handoverRecordRepository.findFirstByBooking_IdAndRecordTypeOrderByRecordedAtDesc(bookingId, "CHECK_IN_INSPECTION"))
                    .thenReturn(Optional.of(passedInspection()));
            when(handoverRecordRepository.save(any(HandoverRecord.class))).thenAnswer(inv -> inv.getArgument(0));
            when(emailService.isMailConfigured()).thenReturn(false);

            HandoverResponse response = handoverService.checkIn(request);

            assertThat(testBooking.getStatus()).isEqualTo(BookingStatus.ACTIVE);
            assertThat(response.getEmailSent()).isFalse();
            assertThat(response.getEmailQueued()).isFalse();
            assertThat(response.getEmailError()).contains("SMTP");
            verify(emailService, never()).sendNow(anyString(), anyString(), anyString());
            verify(pinMailer, never()).sendAfterCommit(anyString(), anyString(), anyString(), anyString());
        }

        @Test
        @DisplayName("Hộ chiếu (chữ + số) được chấp nhận ở bước đối soát khi nhân viên xác nhận loại PASSPORT")
        void checkIn_PassportNumber_IsAccepted() {
            testBooking.setIdentityVerifiedAt(null);
            testBooking.setIdentityVerifiedByStaff(null);
            testBooking.setIdentityCardNumber(null);
            HandoverRequest request = HandoverRequest.builder()
                    .bookingId(bookingId)
                    .staffId(staffId)
                    .idCardType("PASSPORT")
                    .idCardNumber("b1234567")
                    .identityVerified(true)
                    .build();

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(rentalContractRepository.findByBookingId(bookingId)).thenReturn(Optional.of(testContract));
            when(userRepository.findById(staffId)).thenReturn(Optional.of(testStaff));
            when(handoverRecordRepository.findFirstByBooking_IdAndRecordTypeOrderByRecordedAtDesc(bookingId, "CHECK_IN_INSPECTION"))
                    .thenReturn(Optional.of(passedInspection()));
            when(handoverRecordRepository.save(any(HandoverRecord.class))).thenAnswer(inv -> inv.getArgument(0));

            handoverService.checkIn(request);

            assertThat(testBooking.getIdentityCardType()).isEqualTo("PASSPORT");
            assertThat(testBooking.getIdentityCardNumber()).isEqualTo("B1234567");
            assertThat(testBooking.getStatus()).isEqualTo(BookingStatus.ACTIVE);
        }

        @Test
        @DisplayName("Số điện thoại 10 số không được chấp nhận làm CCCD")
        void checkIn_PhoneNumberAsCccd_IsRejected() {
            testBooking.setIdentityVerifiedAt(null);
            testBooking.setIdentityVerifiedByStaff(null);
            testBooking.setIdentityCardNumber(null);
            HandoverRequest request = HandoverRequest.builder()
                    .bookingId(bookingId)
                    .staffId(staffId)
                    .idCardNumber("0912345678")
                    .identityVerified(true)
                    .build();

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(rentalContractRepository.findByBookingId(bookingId)).thenReturn(Optional.of(testContract));
            when(userRepository.findById(staffId)).thenReturn(Optional.of(testStaff));

            AppException ex = assertThrows(AppException.class, () -> handoverService.checkIn(request));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.HANDOVER_PREREQUISITES_NOT_MET);
        }

        @Test
        @DisplayName("Nhân viên chưa đối soát thực tế (identityVerified = false) -> Ném HANDOVER_PREREQUISITES_NOT_MET")
        void checkIn_StaffDidNotAttestIdentity_ThrowsPrerequisitesNotMet() {
            HandoverRequest request = HandoverRequest.builder()
                    .bookingId(bookingId)
                    .staffId(staffId)
                    .idCardNumber("001092003891")
                    .identityVerified(false)
                    .build();

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(rentalContractRepository.findByBookingId(bookingId)).thenReturn(Optional.of(testContract));
            when(userRepository.findById(staffId)).thenReturn(Optional.of(testStaff));

            AppException ex = assertThrows(AppException.class, () -> handoverService.checkIn(request));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.HANDOVER_PREREQUISITES_NOT_MET);
        }
    }

    @Nested
    @DisplayName("Xem trước quyết toán trả kho (Return Settlement Preview)")
    class ReturnPreviewTests {

        @Test
        @DisplayName("Trả kho đúng hạn: Không phạt quá hạn, gợi ý AUTO_REFUND_APPROVED và SLA 5 ngày")
        void getReturnSettlementPreview_OnTime_FullRefund() {
            FacilityPolicy policy = FacilityPolicy.builder()
                    .facility(testFacility)
                    .depositRefundSlaDays(5)
                    .dailyLateFee(new BigDecimal("100000.00"))
                    .overdueGraceDays(1)
                    .build();

            testBooking.setEndDate(LocalDate.now().plusMonths(1));

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(rentalContractRepository.findByBookingId(bookingId)).thenReturn(Optional.of(testContract));
            when(facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(testFacility.getId())).thenReturn(Optional.of(policy));

            ReturnSettlementPreviewResponse preview = handoverService.getReturnSettlementPreview(bookingId);

            assertThat(preview).isNotNull();
            assertThat(preview.getBookingCode()).isEqualTo("RES-8921");
            assertThat(preview.getDepositPaid()).isEqualByComparingTo(new BigDecimal("1500000.00"));
            assertThat(preview.getOverdueDays()).isEqualTo(0);
            assertThat(preview.getCalculatedOverdueLateFee()).isEqualByComparingTo(BigDecimal.ZERO);
            assertThat(preview.getDepositRefundSlaDays()).isEqualTo(5);
            assertThat(preview.getRecommendedReviewStatus()).isEqualTo("AUTO_REFUND_APPROVED");
            assertThat(preview.getChecklistStandardItems()).hasSize(5);
        }

        @Test
        @DisplayName("Trả kho quá hạn 4 ngày (grace 1 ngày): Tính phạt 3 ngày trễ và gợi ý PENDING_ACCOUNTING_REVIEW")
        void getReturnSettlementPreview_Overdue_CalculatesLateFee() {
            FacilityPolicy policy = FacilityPolicy.builder()
                    .facility(testFacility)
                    .depositRefundSlaDays(5)
                    .dailyLateFee(new BigDecimal("100000.00"))
                    .overdueGraceDays(1)
                    .build();

            testBooking.setEndDate(LocalDate.now().minusDays(4));

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(rentalContractRepository.findByBookingId(bookingId)).thenReturn(Optional.of(testContract));
            when(facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(testFacility.getId())).thenReturn(Optional.of(policy));

            ReturnSettlementPreviewResponse preview = handoverService.getReturnSettlementPreview(bookingId);

            assertThat(preview).isNotNull();
            assertThat(preview.getOverdueDays()).isEqualTo(4);
            // 4 - 1 = 3 days * 100,000 = 300,000
            assertThat(preview.getCalculatedOverdueLateFee()).isEqualByComparingTo(new BigDecimal("300000.00"));
            assertThat(preview.getRecommendedReviewStatus()).isEqualTo("PENDING_ACCOUNTING_REVIEW");
        }
    }

    @Nested
    @DisplayName("Nghiệm thu trả kho và quyết toán cọc (BR-RULE-013/014/015 Execution)")
    class ReturnExecutionTests {

        @Test
        @DisplayName("Kho nguyên vẹn 5/5: Hoàn cọc 100%, AUTO_REFUND_APPROVED, xóa PIN, giải phóng kho AVAILABLE, thanh lý hợp đồng")
        void processReturn_AllClean_FullRefundDirect() {
            testBooking.setStatus(BookingStatus.ACTIVE);
            testBooking.setAccessPin("739215");
            testUnit.setStatus(UnitStatus.OCCUPIED);

            FacilityPolicy policy = FacilityPolicy.builder()
                    .facility(testFacility)
                    .depositRefundSlaDays(5)
                    .build();

            HandoverRequest request = HandoverRequest.builder()
                    .bookingId(bookingId)
                    .staffId(staffId)
                    .doorConditionPassed(true)
                    .cleanlinessPassed(true)
                    .smartLockPassed(true)
                    .sensorPassed(true)
                    .wallStructurePassed(true)
                    .damageFee(BigDecimal.ZERO)
                    .cleaningFee(BigDecimal.ZERO)
                    .refundMethod("CASH")
                    .evidencePhotos(List.of("/uploads/handover/photo1.jpg", "/uploads/handover/photo2.jpg"))
                    .build();

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(userRepository.findById(staffId)).thenReturn(Optional.of(testStaff));
            when(facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(testFacility.getId())).thenReturn(Optional.of(policy));
            when(rentalContractRepository.findByBookingId(bookingId)).thenReturn(Optional.of(testContract));
            when(handoverRecordRepository.save(any(HandoverRecord.class)))
                    .thenAnswer(invocation -> invocation.getArgument(0));

            HandoverResponse response = handoverService.processReturn(request);

            assertThat(response).isNotNull();
            assertThat(response.getRecordType()).isEqualTo("RETURN");
            assertThat(response.getReviewStatus()).isEqualTo("AUTO_REFUND_APPROVED");
            assertThat(response.getRefundAmount()).isEqualByComparingTo(new BigDecimal("1500000.00"));
            assertThat(response.getDeductionAmount()).isEqualByComparingTo(BigDecimal.ZERO);
            assertThat(response.getChecklistAllPassed()).isTrue();

            // Verify entity state updates
            assertThat(testBooking.getStatus()).isEqualTo(BookingStatus.COMPLETED);
            assertThat(testBooking.getReturnTime()).isNotNull();
            assertThat(testBooking.getAccessPin()).isNull(); // SmartLock PIN revoked
            assertThat(testUnit.getStatus()).isEqualTo(UnitStatus.AVAILABLE); // Storage unit released
            assertThat(testContract.getStatus()).isEqualTo(RentalContractStatus.TERMINATED); // Contract terminated

            // Verify Payment created with REFUND_PENDING status
            verify(paymentRepository).save(argThat(payment ->
                    payment.getAmount().compareTo(new BigDecimal("1500000.00")) == 0
                            && payment.getPaymentType() == PaymentType.DEPOSIT
                            && payment.getStatus() == PaymentStatus.REFUND_PENDING
            ));

            // Verify Activity Logs
            verify(activityLogService).record(
                    eq(testFacility.getId()),
                    eq(ActivityAction.CHECKOUT_INSPECTION_COMPLETE),
                    eq("HandoverRecord"),
                    any(),
                    anyString(),
                    isNull(),
                    isNull()
            );
            verify(activityLogService).record(
                    eq(testFacility.getId()),
                    eq(ActivityAction.ACCESS_CREDENTIAL_REVOKE),
                    eq("Booking"),
                    eq(bookingId),
                    anyString(),
                    isNull(),
                    isNull()
            );
            verify(activityLogService).record(
                    eq(testFacility.getId()),
                    eq(ActivityAction.STORAGE_UNIT_RELEASE),
                    eq("StorageUnit"),
                    eq(testUnit.getId()),
                    anyString(),
                    eq(UnitStatus.OCCUPIED),
                    eq(UnitStatus.AVAILABLE)
            );
        }

        @Test
        @DisplayName("Có hư hại & vệ sinh: Khấu trừ cọc, sinh reviewStatus PENDING_ACCOUNTING_REVIEW, thanh toán PENDING")
        void processReturn_WithDamageAndCleaning_PendingAccountingReview() {
            testBooking.setStatus(BookingStatus.ACTIVE);
            testBooking.setAccessPin("739215");

            FacilityPolicy policy = FacilityPolicy.builder()
                    .facility(testFacility)
                    .depositRefundSlaDays(5)
                    .build();

            HandoverRequest request = HandoverRequest.builder()
                    .bookingId(bookingId)
                    .staffId(staffId)
                    .doorConditionPassed(true)
                    .cleanlinessPassed(false)
                    .smartLockPassed(true)
                    .sensorPassed(true)
                    .wallStructurePassed(false)
                    .damageFee(new BigDecimal("300000.00"))
                    .cleaningFee(new BigDecimal("200000.00"))
                    .damageNotes("Vách kho bị cấn móp, sàn bám bẩn rác cặn")
                    .refundMethod("BANK_TRANSFER")
                    .refundBankName("Vietcombank")
                    .refundBankAccountNumber("0071001234567")
                    .refundBankAccountName("Tran Minh Tuan")
                    .evidencePhotos(List.of("/uploads/handover/photo1.jpg", "/uploads/handover/photo2.jpg"))
                    .build();

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(userRepository.findById(staffId)).thenReturn(Optional.of(testStaff));
            when(facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(testFacility.getId())).thenReturn(Optional.of(policy));
            when(rentalContractRepository.findByBookingId(bookingId)).thenReturn(Optional.of(testContract));
            when(handoverRecordRepository.save(any(HandoverRecord.class)))
                    .thenAnswer(invocation -> invocation.getArgument(0));

            HandoverResponse response = handoverService.processReturn(request);

            assertThat(response).isNotNull();
            assertThat(response.getReviewStatus()).isEqualTo("PENDING_ACCOUNTING_REVIEW");
            assertThat(response.getDeductionAmount()).isEqualByComparingTo(new BigDecimal("500000.00"));
            // 1,500,000 - 500,000 = 1,000,000
            assertThat(response.getRefundAmount()).isEqualByComparingTo(new BigDecimal("1000000.00"));

            // Verify Payment created with REFUND_PENDING status for accounting review
            verify(paymentRepository).save(argThat(payment ->
                    payment.getAmount().compareTo(new BigDecimal("1000000.00")) == 0
                            && payment.getPaymentType() == PaymentType.DEPOSIT
                            && payment.getStatus() == PaymentStatus.REFUND_PENDING
            ));

            // The refund request carries the bank account the staff captured at the desk.
            ArgumentCaptor<RefundRequest> refund = ArgumentCaptor.forClass(RefundRequest.class);
            verify(refundRequestRepository).save(refund.capture());
            assertThat(refund.getValue().getBankName()).isEqualTo("Vietcombank");
            assertThat(refund.getValue().getBankAccountNumber()).isEqualTo("0071001234567");
            assertThat(refund.getValue().getDeductionAmount()).isEqualByComparingTo(new BigDecimal("500000.00"));
            assertThat(refund.getValue().getFinalRefundAmount()).isEqualByComparingTo(new BigDecimal("1000000.00"));
            assertThat(testUnit.getStatus()).isEqualTo(UnitStatus.UNDER_MAINTENANCE);

            // Verify DAMAGE_FEE_RECORDED activity log
            verify(activityLogService).record(
                    eq(testFacility.getId()),
                    eq(ActivityAction.DAMAGE_FEE_RECORDED),
                    eq("Booking"),
                    eq(bookingId),
                    anyString(),
                    isNull(),
                    isNull()
            );
        }

        @Test
        @DisplayName("Hoàn cọc chuyển khoản thiếu số tài khoản -> Ném HANDOVER_REFUND_BANK_REQUIRED, booking vẫn ACTIVE")
        void processReturn_BankTransferWithoutAccount_IsRejected() {
            testBooking.setStatus(BookingStatus.ACTIVE);
            testBooking.setAccessPin("739215");
            testUnit.setStatus(UnitStatus.OCCUPIED);

            HandoverRequest request = HandoverRequest.builder()
                    .bookingId(bookingId)
                    .staffId(staffId)
                    .refundMethod("BANK_TRANSFER")
                    .evidencePhotos(List.of("/uploads/handover/photo1.jpg", "/uploads/handover/photo2.jpg"))
                    .build();

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(userRepository.findById(staffId)).thenReturn(Optional.of(testStaff));

            AppException ex = assertThrows(AppException.class, () -> handoverService.processReturn(request));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.HANDOVER_REFUND_BANK_REQUIRED);
            assertThat(testBooking.getStatus()).isEqualTo(BookingStatus.ACTIVE);
            verify(refundRequestRepository, never()).save(any());
        }

        @Test
        @DisplayName("Ảnh gửi dạng base64 hoặc ít hơn 2 ảnh bị từ chối")
        void processReturn_Base64OrMissingPhotos_IsRejected() {
            testBooking.setStatus(BookingStatus.ACTIVE);
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(userRepository.findById(staffId)).thenReturn(Optional.of(testStaff));

            HandoverRequest base64 = HandoverRequest.builder()
                    .bookingId(bookingId)
                    .staffId(staffId)
                    .evidencePhotos(List.of("data:image/jpeg;base64,AAAA", "data:image/jpeg;base64,BBBB"))
                    .build();
            AppException ex = assertThrows(AppException.class, () -> handoverService.processReturn(base64));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.HANDOVER_EVIDENCE_URL_INVALID);

            HandoverRequest onePhoto = HandoverRequest.builder()
                    .bookingId(bookingId)
                    .staffId(staffId)
                    .evidencePhotos(List.of("/uploads/handover/photo1.jpg"))
                    .build();
            AppException few = assertThrows(AppException.class, () -> handoverService.processReturn(onePhoto));
            assertThat(few.getErrorCode()).isEqualTo(ErrorCode.RETURN_PHOTO_EVIDENCE_REQUIRED);
        }

        @Test
        @DisplayName("Đơn chưa ACTIVE (đang CONFIRMED): Ném BOOKING_NOT_ACTIVE_FOR_RETURN")
        void processReturn_BookingNotActive_ThrowsException() {
            testBooking.setStatus(BookingStatus.CONFIRMED);

            HandoverRequest request = HandoverRequest.builder()
                    .bookingId(bookingId)
                    .build();

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));

            AppException ex = assertThrows(AppException.class, () -> handoverService.processReturn(request));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.BOOKING_NOT_ACTIVE_FOR_RETURN);
        }

        @Test
        @DisplayName("processReturnSettlement trả về ReturnSettlementResponse đầy đủ breakdown")
        void processReturnSettlement_DetailedResponse_Success() {
            testBooking.setStatus(BookingStatus.ACTIVE);
            testBooking.setAccessPin("739215");

            FacilityPolicy policy = FacilityPolicy.builder()
                    .facility(testFacility)
                    .depositRefundSlaDays(5)
                    .build();

            HandoverRequest request = HandoverRequest.builder()
                    .bookingId(bookingId)
                    .staffId(staffId)
                    .doorConditionPassed(true)
                    .cleanlinessPassed(true)
                    .smartLockPassed(true)
                    .sensorPassed(true)
                    .wallStructurePassed(true)
                    .damageFee(BigDecimal.ZERO)
                    .cleaningFee(BigDecimal.ZERO)
                    .refundMethod("CASH")
                    .evidencePhotos(List.of("/uploads/handover/photo1.jpg", "/uploads/handover/photo2.jpg"))
                    .build();

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(userRepository.findById(staffId)).thenReturn(Optional.of(testStaff));
            when(facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(testFacility.getId())).thenReturn(Optional.of(policy));
            when(rentalContractRepository.findByBookingId(bookingId)).thenReturn(Optional.of(testContract));
            when(handoverRecordRepository.save(any(HandoverRecord.class)))
                    .thenAnswer(invocation -> invocation.getArgument(0));

            ReturnSettlementResponse response = handoverService.processReturnSettlement(request);

            assertThat(response).isNotNull();
            assertThat(response.getBookingCode()).isEqualTo("RES-8921");
            assertThat(response.getDepositPaid()).isEqualByComparingTo(new BigDecimal("1500000.00"));
            assertThat(response.getNetRefundAmount()).isEqualByComparingTo(new BigDecimal("1500000.00"));
            assertThat(response.getReviewStatus()).isEqualTo("AUTO_REFUND_APPROVED");
            assertThat(response.isChecklistAllPassed()).isTrue();
            assertThat(response.getEvidencePhotoCount()).isEqualTo(2);
            assertThat(response.getEvidencePhotos()).containsExactly("/uploads/handover/photo1.jpg", "/uploads/handover/photo2.jpg");
            assertThat(response.getRefundMethod()).isEqualTo("CASH");
            assertThat(response.getCustomerDebtAmount()).isEqualByComparingTo(BigDecimal.ZERO);
        }

        @Test
        @DisplayName("processReturnSettlement khi tiền phạt vượt quá tiền cọc thì actualRefund = 0 và ghi nhận cảnh báo nợ")
        void processReturnSettlement_ExcessDeduction_ShouldCapRefundAtZeroAndFlagDebt() {
            testBooking.setStatus(BookingStatus.ACTIVE);
            testBooking.setAccessPin("739215");

            FacilityPolicy policy = FacilityPolicy.builder()
                    .facility(testFacility)
                    .depositRefundSlaDays(7)
                    .build();

            // Cọc: 1,500,000. Phạt hư hại: 2,000,000 -> Âm 500,000
            HandoverRequest request = HandoverRequest.builder()
                    .bookingId(bookingId)
                    .staffId(staffId)
                    .damageFee(new BigDecimal("2000000.00"))
                    .damageNotes("Vỡ kính cường lực và hỏng ray cửa")
                    .evidencePhotos(List.of("/uploads/handover/photo1.jpg", "/uploads/handover/photo2.jpg"))
                    .build();

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(userRepository.findById(staffId)).thenReturn(Optional.of(testStaff));
            when(facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(testFacility.getId())).thenReturn(Optional.of(policy));
            when(rentalContractRepository.findByBookingId(bookingId)).thenReturn(Optional.of(testContract));
            when(handoverRecordRepository.save(any(HandoverRecord.class)))
                    .thenAnswer(invocation -> invocation.getArgument(0));

            ReturnSettlementResponse response = handoverService.processReturnSettlement(request);

            assertThat(response).isNotNull();
            assertThat(response.getDepositPaid()).isEqualByComparingTo(new BigDecimal("1500000.00"));
            assertThat(response.getTotalDeduction()).isEqualByComparingTo(new BigDecimal("2000000.00"));
            assertThat(response.getNetRefundAmount()).isEqualByComparingTo(BigDecimal.ZERO);
            assertThat(response.getReviewStatus()).isEqualTo("PENDING_ACCOUNTING_REVIEW");
            assertThat(response.getNotes()).contains("CẢNH BÁO: Khấu trừ vượt quá tiền cọc!");
            assertThat(response.getNotes()).contains("500.000 ₫");
            verify(paymentRepository, never()).save(any(Payment.class));

            // The unrecovered amount is recorded for accounting instead of only being written into the notes.
            assertThat(response.getCustomerDebtAmount()).isEqualByComparingTo(new BigDecimal("500000.00"));
            assertThat(response.getCustomerDebtId()).isNotNull();
            ArgumentCaptor<CustomerDebt> debt = ArgumentCaptor.forClass(CustomerDebt.class);
            verify(customerDebtRepository).save(debt.capture());
            assertThat(debt.getValue().getAmount()).isEqualByComparingTo(new BigDecimal("500000.00"));
            assertThat(debt.getValue().getStatus()).isEqualTo(CustomerDebt.STATUS_OPEN);
            verify(refundRequestRepository, never()).save(any());
        }
    }

    @Nested
    @DisplayName("Trả kho quá hạn, minh chứng và định dạng tiền")
    class OverdueReturnEvidenceAndMoneyTests {

        private HandoverRequest cleanReturn() {
            return HandoverRequest.builder()
                    .bookingId(bookingId)
                    .staffId(staffId)
                    .doorConditionPassed(true)
                    .cleanlinessPassed(true)
                    .smartLockPassed(true)
                    .sensorPassed(true)
                    .wallStructurePassed(true)
                    .refundMethod("CASH")
                    .evidencePhotos(List.of("/uploads/handover/photo1.jpg", "/uploads/handover/photo2.jpg"))
                    .build();
        }

        private void arrangeOverdueReturn() {
            testBooking.setStatus(BookingStatus.ACTIVE);
            testBooking.setAccessPin("739215");
            testBooking.setEndDate(LocalDate.now().minusDays(4));
            testUnit.setStatus(UnitStatus.OCCUPIED);
            FacilityPolicy policy = FacilityPolicy.builder()
                    .facility(testFacility)
                    .depositRefundSlaDays(5)
                    .dailyLateFee(new BigDecimal("100000.00"))
                    .overdueGraceDays(1)
                    .build();
            lenient().when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            lenient().when(userRepository.findById(staffId)).thenReturn(Optional.of(testStaff));
            lenient().when(facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(testFacility.getId())).thenReturn(Optional.of(policy));
            lenient().when(rentalContractRepository.findByBookingId(bookingId)).thenReturn(Optional.of(testContract));
            lenient().when(handoverRecordRepository.save(any(HandoverRecord.class))).thenAnswer(inv -> inv.getArgument(0));
        }

        @Test
        @DisplayName("Trả kho sạch nhưng quá hạn, chỉ có phí trễ hạn theo chính sách -> kho về AVAILABLE, không vào bảo trì")
        void overdueCleanReturn_withOnlyPolicyLateFee_releasesUnitToAvailable() {
            arrangeOverdueReturn();
            HandoverRequest request = cleanReturn();
            // The wizard used to send its mandatory reason text as damageNotes; neither field may mean "damage".
            request.setDamageNotes("Phí trễ hạn theo chính sách cơ sở");

            ReturnSettlementResponse response = handoverService.processReturnSettlement(request);

            assertThat(testUnit.getStatus()).isEqualTo(UnitStatus.AVAILABLE);
            assertThat(response.getTotalDeduction()).isEqualByComparingTo(new BigDecimal("300000.00"));
            assertThat(response.getOverdueDebt()).isEqualByComparingTo(new BigDecimal("300000.00"));
            assertThat(response.isChecklistAllPassed()).isTrue();
            // Money in backend-composed text is Vietnamese-style, never "300,000 VNĐ".
            assertThat(response.getNotes()).contains("300.000 ₫").doesNotContain("VNĐ");
        }

        @Test
        @DisplayName("Lý do khấu trừ riêng (deductionReason) được lưu vào biên bản và không đổi trạng thái kho")
        void deductionReason_isRecordedAndDoesNotSendUnitToMaintenance() {
            arrangeOverdueReturn();
            HandoverRequest request = cleanReturn();
            request.setOverdueDebt(new BigDecimal("100000.00"));
            request.setDeductionReason("Quản lý đồng ý giảm phí trễ hạn còn một ngày");

            ReturnSettlementResponse response = handoverService.processReturnSettlement(request);

            assertThat(testUnit.getStatus()).isEqualTo(UnitStatus.AVAILABLE);
            assertThat(response.getNotes()).contains("Lý do khấu trừ: Quản lý đồng ý giảm phí trễ hạn còn một ngày");
        }

        @Test
        @DisplayName("Phí hư hại hoặc hạng mục không đạt vẫn đưa kho vào bảo trì")
        void damageOrFailedChecklist_stillSendsUnitToMaintenance() {
            arrangeOverdueReturn();
            HandoverRequest damaged = cleanReturn();
            damaged.setDamageFee(new BigDecimal("200000.00"));
            damaged.setDeductionReason("Thay chốt khóa");
            handoverService.processReturnSettlement(damaged);
            assertThat(testUnit.getStatus()).isEqualTo(UnitStatus.UNDER_MAINTENANCE);

            assertThat(HandoverServiceImplAccess.release(BigDecimal.ZERO, BigDecimal.ZERO, true, false, true, true, true))
                    .isEqualTo(UnitStatus.UNDER_MAINTENANCE);
            assertThat(HandoverServiceImplAccess.release(BigDecimal.ZERO, new BigDecimal("50000"), true, true, true, true, true))
                    .isEqualTo(UnitStatus.UNDER_MAINTENANCE);
            assertThat(HandoverServiceImplAccess.release(BigDecimal.ZERO, BigDecimal.ZERO, true, true, true, true, true))
                    .isEqualTo(UnitStatus.AVAILABLE);
        }

        @Test
        @DisplayName("Khấu trừ ngoài phí trễ hạn mà không ghi lý do bị từ chối")
        void nonLateDeductionWithoutReason_isRejected() {
            arrangeOverdueReturn();
            HandoverRequest request = cleanReturn();
            request.setCleaningFee(new BigDecimal("150000.00"));

            AppException ex = assertThrows(AppException.class, () -> handoverService.processReturnSettlement(request));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.INVALID_REQUEST);
            assertThat(testBooking.getStatus()).isEqualTo(BookingStatus.ACTIVE);
        }

        @Test
        @DisplayName("Ảnh trả kho phải là tệp đã tải lên cho đúng đơn: tệp không tồn tại hoặc của đơn khác bị từ chối")
        void returnEvidence_mustBelongToTheBooking() {
            arrangeOverdueReturn();
            doThrow(new AppException(ErrorCode.HANDOVER_EVIDENCE_URL_INVALID))
                    .when(fileStorageService).requireBookingEvidence(any(), eq(bookingId), eq(testFacility.getId()));

            AppException ex = assertThrows(AppException.class, () -> handoverService.processReturnSettlement(cleanReturn()));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.HANDOVER_EVIDENCE_URL_INVALID);
            assertThat(testBooking.getStatus()).isEqualTo(BookingStatus.ACTIVE);
            assertThat(testUnit.getStatus()).isEqualTo(UnitStatus.OCCUPIED);
            verify(handoverRecordRepository, never()).save(any(HandoverRecord.class));
        }

        @Test
        @DisplayName("Ảnh nghiệm thu khi nhận kho cũng được kiểm tra tồn tại và thuộc đơn")
        void inspectionEvidence_isCheckedAgainstTheStoredFiles() {
            testBooking.setStatus(BookingStatus.ACTIVE);
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(userRepository.findById(staffId)).thenReturn(Optional.of(testStaff));
            doThrow(new AppException(ErrorCode.HANDOVER_EVIDENCE_URL_INVALID))
                    .when(fileStorageService).requireBookingEvidence(any(), eq(bookingId), eq(testFacility.getId()));

            HandoverRequest request = HandoverRequest.builder()
                    .bookingId(bookingId)
                    .staffId(staffId)
                    .evidencePhotos(List.of("/uploads/handover/nonexistent-1.jpg", "/uploads/handover/nonexistent-2.jpg"))
                    .build();
            AppException ex = assertThrows(AppException.class, () -> handoverService.performInspection(request));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.HANDOVER_EVIDENCE_URL_INVALID);
            verify(handoverRecordRepository, never()).save(any(HandoverRecord.class));
        }

        @Test
        @DisplayName("Tải ảnh lên gắn với đơn và cơ sở của đơn")
        void upload_isBoundToTheBookingAndItsFacility() {
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            org.springframework.web.multipart.MultipartFile file = new org.springframework.mock.web.MockMultipartFile(
                    "file", "a.jpg", "image/jpeg", new byte[]{1});

            handoverService.uploadEvidence(file, bookingId);

            verify(fileStorageService).storeDocument(file, "handover", bookingId, testFacility.getId());
        }

        @Test
        @DisplayName("Thông báo thiếu điều kiện dùng định dạng tiền Việt: 1.250.000 ₫")
        void prerequisiteMessages_useVietnameseMoneyFormat() {
            testBooking.setDepositPaid(null);
            testBooking.setDepositAmount(new BigDecimal("1250000"));
            testBooking.setTotalRentalFee(new BigDecimal("1250000"));
            testBooking.setRentalMonths(1);
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(rentalContractRepository.findByBookingId(bookingId)).thenReturn(Optional.empty());
            when(paymentRepository.findAllByBooking_Id(any())).thenReturn(List.of());

            HandoverPrerequisitesResponse response = handoverService.getCheckInPrerequisites(bookingId);

            assertThat(response.getMissingPrerequisites())
                    .anyMatch(m -> m.contains("Tiền cọc còn thiếu 1.250.000 ₫ (Đã xác nhận: 0 ₫ / Yêu cầu: 1.250.000 ₫)"))
                    .anyMatch(m -> m.contains("Tiền thuê tháng đầu còn thiếu 1.250.000 ₫"))
                    .noneMatch(m -> m.contains("VNĐ") || m.contains("1,250,000"));
        }

        @Test
        @DisplayName("Thu vượt số còn phải thu: báo số còn lại theo định dạng 1.500.000 ₫")
        void overpayment_messageUsesVietnameseMoneyFormat() {
            testBooking.setDepositPaid(BigDecimal.ZERO);
            testBooking.setDepositAmount(new BigDecimal("1500000"));
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(paymentRepository.findAllByBooking_Id(any())).thenReturn(List.of());

            ManualPaymentRecordRequest tooMuch = ManualPaymentRecordRequest.builder()
                    .bookingId(bookingId)
                    .paymentType(PaymentType.DEPOSIT)
                    .paymentMethod("CASH")
                    .amount(new BigDecimal("2000000"))
                    .receiptVoucherCode("PT-001")
                    .build();
            AppException ex = assertThrows(AppException.class, () -> handoverService.recordManualPayment(tooMuch));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.HANDOVER_PAYMENT_OVER_REMAINING);
            assertThat(ex.getMessage()).contains("1.500.000 ₫").doesNotContain("VNĐ");
        }

        @Test
        @DisplayName("Biên bản check-in chỉ ghi 4 số cuối của giấy tờ")
        void checkIn_doesNotWriteTheFullIdentityNumberIntoTheRecord() {
            HandoverRequest request = HandoverRequest.builder()
                    .bookingId(bookingId)
                    .staffId(staffId)
                    .idCardNumber("001092003891")
                    .identityVerified(true)
                    .build();
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(rentalContractRepository.findByBookingId(bookingId)).thenReturn(Optional.of(testContract));
            when(handoverRecordRepository.findFirstByBooking_IdAndRecordTypeOrderByRecordedAtDesc(bookingId, "CHECK_IN_INSPECTION"))
                    .thenReturn(Optional.of(passedInspection()));
            when(handoverRecordRepository.save(any(HandoverRecord.class))).thenAnswer(inv -> inv.getArgument(0));

            HandoverResponse response = handoverService.checkIn(request);

            assertThat(response.getNotes()).contains("********3891").doesNotContain("001092003891");
        }
    }

    /** The unit release rule is package-private in the implementation; this mirrors its call for the pure-function checks. */
    private static final class HandoverServiceImplAccess {
        static UnitStatus release(BigDecimal damageFee, BigDecimal cleaningFee, boolean door, boolean cleanliness,
                                  boolean lock, boolean sensor, boolean wall) {
            return com.boxora.service.impl.HandoverUnitRelease.statusAfterReturn(damageFee, cleaningFee, door, cleanliness, lock, sensor, wall);
        }
    }

    @Nested
    @DisplayName("Tách biệt dữ liệu đa đơn đặt chỗ và bảo vệ điều kiện nghiệp vụ (Data Isolation & Security Guards)")
    class BookingSeparationAndSecurityTests {

        @Test
        @DisplayName("F.1-5: Gọi đối soát cho nhiều booking độc lập không bị trộn lẫn thông tin hoặc điều kiện tiên quyết")
        void getCheckInPrerequisites_IndependentMultipleBookings() {
            // Booking 1: Pham Mai Phuong - BX-2026-1013 - Kho TB-C204 (Đã cọc + đã thuê + đã ký HĐ)
            UUID booking1Id = UUID.randomUUID();
            StorageUnit unit1 = StorageUnit.builder()
                    .unitCode("TB-C204")
                    .facility(testFacility)
                    .status(UnitStatus.RESERVED)
                    .build();
            unit1.setId(UUID.randomUUID());

            User customer1 = User.builder()
                    .fullName("Phạm Mai Phương")
                    .email("phuong.pham@gmail.com")
                    .phone("0987.654.321")
                    .isActive(true)
                    .role(Role.builder().name("CUSTOMER").build())
                    .build();
            customer1.setId(UUID.randomUUID());

            Booking booking1 = Booking.builder()
                    .bookingCode("BX-2026-1013")
                    .customer(customer1)
                    .storageUnit(unit1)
                    .depositPaid(new BigDecimal("4800000.00"))
                    .rentalMonths(12)
                    .totalRentalFee(new BigDecimal("57600000.00"))
                    .status(BookingStatus.CONFIRMED)
                    .identityVerifiedByStaff(testStaff)
                    .identityVerifiedAt(LocalDateTime.now())
                    .identityCardNumber("079090123456")
                    .build();
            booking1.setId(booking1Id);

            RentalContract contract1 = RentalContract.builder()
                    .contractCode("CTR-2026-1013")
                    .booking(booking1)
                    .customer(customer1)
                    .unit(unit1)
                    .facility(testFacility)
                    .status(RentalContractStatus.ACTIVE)
                    .signedAt(LocalDateTime.now())
                    .build();

            Payment rentPayment1 = Payment.builder()
                    .paymentType(PaymentType.RENTAL_FEE)
                    .status(PaymentStatus.PAID)
                    .amount(new BigDecimal("4800000.00"))
                    .build();

            // Booking 2: Le Thi Hoang Yen - BX-RES-TBC210 - Kho TB-C210 (Chưa nộp tiền + chưa ký HĐ)
            UUID booking2Id = UUID.randomUUID();
            StorageUnit unit2 = StorageUnit.builder()
                    .unitCode("TB-C210")
                    .facility(testFacility)
                    .status(UnitStatus.RESERVED)
                    .build();
            unit2.setId(UUID.randomUUID());

            User customer2 = User.builder()
                    .fullName("Lê Thị Hoàng Yến")
                    .email("yen.le@gmail.com")
                    .phone("0912.888.999")
                    .isActive(true)
                    .role(Role.builder().name("CUSTOMER").build())
                    .build();
            customer2.setId(UUID.randomUUID());

            Booking booking2 = Booking.builder()
                    .bookingCode("BX-RES-TBC210")
                    .customer(customer2)
                    .storageUnit(unit2)
                    .depositPaid(BigDecimal.ZERO)
                    .rentalMonths(6)
                    .totalRentalFee(new BigDecimal("7500000.00"))
                    .status(BookingStatus.PENDING_PAYMENT)
                    .build();
            booking2.setId(booking2Id);

            when(bookingRepository.findById(booking1Id)).thenReturn(Optional.of(booking1));
            when(bookingRepository.findById(booking2Id)).thenReturn(Optional.of(booking2));

            when(paymentRepository.findAllByBooking_Id(booking1Id)).thenReturn(List.of(rentPayment1));
            when(paymentRepository.findAllByBooking_Id(booking2Id)).thenReturn(List.of());

            when(rentalContractRepository.findByBookingId(booking1Id)).thenReturn(Optional.of(contract1));
            when(rentalContractRepository.findByBookingId(booking2Id)).thenReturn(Optional.empty());

            // 1. Kiểm tra đối soát của Booking 1 (Phương)
            HandoverPrerequisitesResponse resp1 = handoverService.getCheckInPrerequisites(booking1Id);
            assertThat(resp1.getBookingCode()).isEqualTo("BX-2026-1013");
            assertThat(resp1.getCustomerName()).isEqualTo("Phạm Mai Phương");
            assertThat(resp1.getUnitCode()).isEqualTo("TB-C204");
            assertThat(resp1.isDepositSatisfied()).isTrue();
            assertThat(resp1.isFirstMonthRentSatisfied()).isTrue();
            assertThat(resp1.isContractSigned()).isTrue();
            assertThat(resp1.isEligibleForCheckIn()).isTrue();
            assertThat(resp1.getContractCode()).isEqualTo("CTR-2026-1013");

            // 2. Kiểm tra đối soát của Booking 2 (Yến)
            HandoverPrerequisitesResponse resp2 = handoverService.getCheckInPrerequisites(booking2Id);
            assertThat(resp2.getBookingCode()).isEqualTo("BX-RES-TBC210");
            assertThat(resp2.getCustomerName()).isEqualTo("Lê Thị Hoàng Yến");
            assertThat(resp2.getUnitCode()).isEqualTo("TB-C210");
            assertThat(resp2.isDepositSatisfied()).isFalse();
            assertThat(resp2.isFirstMonthRentSatisfied()).isFalse();
            assertThat(resp2.isContractSigned()).isFalse();
            assertThat(resp2.isEligibleForCheckIn()).isFalse();
            assertThat(resp2.getContractCode()).isNull();

            // 3. Gọi lại Booking 1 để xác nhận không bị lưu vết hay ghi đè từ Booking 2
            HandoverPrerequisitesResponse resp1Again = handoverService.getCheckInPrerequisites(booking1Id);
            assertThat(resp1Again.getBookingCode()).isEqualTo("BX-2026-1013");
            assertThat(resp1Again.getCustomerName()).isEqualTo("Phạm Mai Phương");
            assertThat(resp1Again.getUnitCode()).isEqualTo("TB-C204");
            assertThat(resp1Again.isEligibleForCheckIn()).isTrue();
        }

        @Test
        @DisplayName("F.8: Đơn đang 'Chờ cọc' (PENDING_PAYMENT / thiếu cọc) không thể bàn giao bằng cách gọi API trực tiếp")
        void checkIn_PendingPaymentBooking_ChờCọc_ThrowsPrerequisitesNotMet() {
            testBooking.setStatus(BookingStatus.PENDING_PAYMENT);
            testBooking.setDepositPaid(BigDecimal.ZERO);

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(paymentRepository.findAllByBooking_Id(bookingId)).thenReturn(List.of());

            HandoverRequest request = HandoverRequest.builder()
                    .bookingId(bookingId)
                    .staffId(staffId)
                    .idCardNumber("001092003891")
                    .identityVerified(true)
                    .firstMonthRentConfirmed(true)
                    .contractConfirmed(true)
                    .build();

            AppException ex = assertThrows(AppException.class, () -> handoverService.checkIn(request));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.HANDOVER_PREREQUISITES_NOT_MET);

            // Unit remains RESERVED and no PIN is assigned
            assertThat(testUnit.getStatus()).isEqualTo(UnitStatus.RESERVED);
            assertThat(testBooking.getAccessPin()).isNull();
        }

        @Test
        @DisplayName("F.10: Kiểm thử quyền truy cập theo cơ sở (Facility Access Guard)")
        void checkIn_FacilityMismatch_AccessGuardThrowsForbidden() {
            doThrow(new AppException(ErrorCode.FORBIDDEN))
                    .when(facilityAccessGuard).checkFacilityAccess(testFacility.getId());

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));

            HandoverRequest request = HandoverRequest.builder()
                    .bookingId(bookingId)
                    .staffId(staffId)
                    .idCardNumber("001092003891")
                    .identityVerified(true)
                    .build();

            AppException ex = assertThrows(AppException.class, () -> handoverService.checkIn(request));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.FORBIDDEN);
        }

        @Test
        @DisplayName("E: Backend kiểm tra DB, từ chối bàn giao nếu frontend tự gửi cờ confirmed mà DB chưa thanh toán")
        void checkIn_TamperedFrontendFlagsWithoutDbPayments_ThrowsPrerequisitesNotMet() {
            testBooking.setDepositPaid(BigDecimal.ZERO);

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(paymentRepository.findAllByBooking_Id(bookingId)).thenReturn(List.of());
            when(rentalContractRepository.findByBookingId(bookingId)).thenReturn(Optional.empty());

            // Frontend sends both flags as true, but DB has no payments and no signed contract
            HandoverRequest tamperedRequest = HandoverRequest.builder()
                    .bookingId(bookingId)
                    .staffId(staffId)
                    .idCardNumber("001092003891")
                    .identityVerified(true)
                    .firstMonthRentConfirmed(true)
                    .contractConfirmed(true)
                    .build();

            AppException ex = assertThrows(AppException.class, () -> handoverService.checkIn(tamperedRequest));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.HANDOVER_PREREQUISITES_NOT_MET);
        }
    }

    @Nested
    @DisplayName("Phân quyền, bảo mật mã PIN và chứng từ tại quầy")
    class SecurityAndCounterPaymentTests {

        @Test
        @DisplayName("Lịch sử biên bản không bao giờ trả mã PIN hay QR token, kể cả khi đơn đang ACTIVE")
        void getByBookingId_NeverReturnsPin() {
            testBooking.setStatus(BookingStatus.ACTIVE);
            testBooking.setAccessPin("739215");
            testBooking.setQrAccessToken("QR-ABCD1234");
            HandoverRecord record = HandoverRecord.builder()
                    .booking(testBooking)
                    .staff(testStaff)
                    .recordType("CHECK_IN")
                    .recordedAt(LocalDateTime.now())
                    .build();

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(handoverRecordRepository.findByBookingId(bookingId)).thenReturn(List.of(record));

            List<HandoverResponse> history = handoverService.getByBookingId(bookingId);

            assertThat(history).hasSize(1);
            assertThat(history.get(0).getAccessPin()).isNull();
            assertThat(history.get(0).getQrAccessToken()).isNull();
        }

        @Test
        @DisplayName("Khách xem biên bản / quyết toán của đơn người khác -> không tìm thấy")
        void customerCannotReadAnotherCustomersBooking() {
            UUID otherCustomerId = UUID.randomUUID();
            when(requestContext.currentUserRole()).thenReturn("CUSTOMER");
            when(requestContext.currentUserId()).thenReturn(otherCustomerId);
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));

            AppException history = assertThrows(AppException.class, () -> handoverService.getByBookingId(bookingId));
            assertThat(history.getErrorCode()).isEqualTo(ErrorCode.BOOKING_NOT_FOUND);
            AppException preview = assertThrows(AppException.class, () -> handoverService.getReturnSettlementPreview(bookingId));
            assertThat(preview.getErrorCode()).isEqualTo(ErrorCode.BOOKING_NOT_FOUND);
            verify(handoverRecordRepository, never()).findByBookingId(any());
        }

        @Test
        @DisplayName("Khách xem biên bản của chính mình được phép")
        void customerCanReadOwnBooking() {
            when(requestContext.currentUserRole()).thenReturn("CUSTOMER");
            when(requestContext.currentUserId()).thenReturn(testCustomer.getId());
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(handoverRecordRepository.findByBookingId(bookingId)).thenReturn(List.of());

            assertThat(handoverService.getByBookingId(bookingId)).isEmpty();
        }

        @Test
        @DisplayName("Nhân viên cơ sở khác bị chặn bởi FacilityAccessGuard khi xem biên bản")
        void staffOfAnotherFacilityIsBlocked() {
            doThrow(new AppException(ErrorCode.FACILITY_ACCESS_DENIED))
                    .when(facilityAccessGuard).checkFacilityAccess(testFacility.getId());
            when(requestContext.currentUserRole()).thenReturn("STAFF");
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));

            AppException ex = assertThrows(AppException.class, () -> handoverService.getByBookingId(bookingId));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.FACILITY_ACCESS_DENIED);
        }

        @Test
        @DisplayName("Gửi lại PIN: luôn gửi tới email trong hồ sơ khách và chỉ báo thành công khi sendNow xong")
        void sendHandoverPinEmail_GoesToCustomerEmailOnFile() {
            testBooking.setStatus(BookingStatus.ACTIVE);
            testBooking.setAccessPin("739215");
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(emailService.isMailConfigured()).thenReturn(true);

            String sentTo = handoverService.sendHandoverPinEmail(bookingId);

            assertThat(sentTo).isEqualTo("tuan.tran@gmail.com");
            verify(emailService).sendNow(eq("tuan.tran@gmail.com"), anyString(), contains("739215"));
        }

        @Test
        @DisplayName("Gửi PIN khi chưa bàn giao -> HANDOVER_NOT_CHECKED_IN; SMTP chưa cấu hình -> EMAIL_SEND_FAILED")
        void sendHandoverPinEmail_RefusesWhenNothingToSendOrMailMissing() {
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            AppException notCheckedIn = assertThrows(AppException.class, () -> handoverService.sendHandoverPinEmail(bookingId));
            assertThat(notCheckedIn.getErrorCode()).isEqualTo(ErrorCode.HANDOVER_NOT_CHECKED_IN);

            testBooking.setStatus(BookingStatus.ACTIVE);
            testBooking.setAccessPin("739215");
            when(emailService.isMailConfigured()).thenReturn(false);
            AppException noSmtp = assertThrows(AppException.class, () -> handoverService.sendHandoverPinEmail(bookingId));
            assertThat(noSmtp.getErrorCode()).isEqualTo(ErrorCode.EMAIL_SEND_FAILED);
            verify(emailService, never()).sendNow(anyString(), anyString(), anyString());
        }

        @Test
        @DisplayName("Thông báo trong ứng dụng không chứa PIN và không tạo bản ghi trùng khi gọi lại")
        void sendHandoverWebNotification_IsPinFreeAndIdempotent() {
            testBooking.setStatus(BookingStatus.ACTIVE);
            testBooking.setAccessPin("739215");
            NotificationLog existing = NotificationLog.builder()
                    .recipient(testCustomer)
                    .recipientEmail("tuan.tran@gmail.com")
                    .notificationType(NotificationType.HANDOVER_PIN)
                    .channel(NotificationChannel.IN_APP)
                    .title("Bàn giao kho A-112")
                    .content("đã được bàn giao")
                    .build();
            existing.setId(UUID.randomUUID());
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(notificationLogRepository.findFirstByNotificationTypeAndReferenceIdAndChannelOrderByCreatedAtDesc(
                    NotificationType.HANDOVER_PIN, bookingId, NotificationChannel.IN_APP)).thenReturn(Optional.of(existing));

            handoverService.sendHandoverWebNotification(bookingId);

            verify(notificationLogRepository, never()).save(any());
        }

        @Test
        @DisplayName("Xác nhận chuyển khoản: chỉ BANK_TRANSFER đang PENDING có mã tham chiếu và biên lai")
        void confirmBankTransfer_Rules() {
            Payment vnpay = Payment.builder().booking(testBooking).amount(new BigDecimal("1500000"))
                    .paymentType(PaymentType.DEPOSIT).paymentMethod("VNPAY").status(PaymentStatus.PENDING)
                    .referenceCode("REF1").proofDocumentUrl("/uploads/handover/p.jpg").build();
            UUID vnpayId = UUID.randomUUID();
            vnpay.setId(vnpayId);
            when(paymentRepository.findById(vnpayId)).thenReturn(Optional.of(vnpay));
            assertThat(assertThrows(AppException.class, () -> handoverService.confirmBankTransferPayment(vnpayId, null)).getErrorCode())
                    .isEqualTo(ErrorCode.HANDOVER_PAYMENT_NOT_PENDING_TRANSFER);

            Payment failed = Payment.builder().booking(testBooking).amount(new BigDecimal("1500000"))
                    .paymentType(PaymentType.DEPOSIT).paymentMethod("BANK_TRANSFER").status(PaymentStatus.FAILED)
                    .referenceCode("REF2").proofDocumentUrl("/uploads/handover/p.jpg").build();
            UUID failedId = UUID.randomUUID();
            failed.setId(failedId);
            when(paymentRepository.findById(failedId)).thenReturn(Optional.of(failed));
            assertThat(assertThrows(AppException.class, () -> handoverService.confirmBankTransferPayment(failedId, null)).getErrorCode())
                    .isEqualTo(ErrorCode.HANDOVER_PAYMENT_NOT_PENDING_TRANSFER);

            Payment noProof = Payment.builder().booking(testBooking).amount(new BigDecimal("1500000"))
                    .paymentType(PaymentType.DEPOSIT).paymentMethod("BANK_TRANSFER").status(PaymentStatus.PENDING)
                    .referenceCode("REF3").build();
            UUID noProofId = UUID.randomUUID();
            noProof.setId(noProofId);
            when(paymentRepository.findById(noProofId)).thenReturn(Optional.of(noProof));
            assertThat(assertThrows(AppException.class, () -> handoverService.confirmBankTransferPayment(noProofId, null)).getErrorCode())
                    .isEqualTo(ErrorCode.HANDOVER_PAYMENT_PROOF_REQUIRED);

            Payment good = Payment.builder().booking(testBooking).amount(new BigDecimal("1500000"))
                    .paymentType(PaymentType.DEPOSIT).paymentMethod("BANK_TRANSFER").status(PaymentStatus.PENDING)
                    .referenceCode("REF4").proofDocumentUrl("/uploads/handover/p.jpg").build();
            UUID goodId = UUID.randomUUID();
            good.setId(goodId);
            when(paymentRepository.findById(goodId)).thenReturn(Optional.of(good));
            when(paymentRepository.save(any(Payment.class))).thenAnswer(inv -> inv.getArgument(0));
            handoverService.confirmBankTransferPayment(goodId, "Đã đối soát");
            assertThat(good.getStatus()).isEqualTo(PaymentStatus.PAID);
            assertThat(good.getConfirmedByStaff()).isEqualTo(testStaff);
        }

        @Test
        @DisplayName("Ghi nhận thu vượt quá số còn phải thu bị từ chối; ảnh biên lai base64 bị từ chối")
        void recordManualPayment_RejectsOverpaymentAndBase64Proof() {
            testBooking.setDepositPaid(BigDecimal.ZERO);
            testBooking.setDepositAmount(new BigDecimal("1500000"));
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(paymentRepository.findAllByBooking_Id(any())).thenReturn(List.of());

            ManualPaymentRecordRequest tooMuch = ManualPaymentRecordRequest.builder()
                    .bookingId(bookingId)
                    .paymentType(PaymentType.DEPOSIT)
                    .paymentMethod("CASH")
                    .amount(new BigDecimal("2000000"))
                    .receiptVoucherCode("PT-001")
                    .build();
            assertThat(assertThrows(AppException.class, () -> handoverService.recordManualPayment(tooMuch)).getErrorCode())
                    .isEqualTo(ErrorCode.HANDOVER_PAYMENT_OVER_REMAINING);

            ManualPaymentRecordRequest base64Proof = ManualPaymentRecordRequest.builder()
                    .bookingId(bookingId)
                    .paymentType(PaymentType.DEPOSIT)
                    .paymentMethod("BANK_TRANSFER")
                    .amount(new BigDecimal("1500000"))
                    .referenceCode("FT123")
                    .proofDocumentUrl("data:image/png;base64,AAAA")
                    .build();
            assertThat(assertThrows(AppException.class, () -> handoverService.recordManualPayment(base64Proof)).getErrorCode())
                    .isEqualTo(ErrorCode.HANDOVER_EVIDENCE_URL_INVALID);
            verify(paymentRepository, never()).save(any());
        }

        @Test
        @DisplayName("Tra cứu QR: nhận BOXORA-CHECKIN:<mã>, mã thô và UUID; không trả mã PIN; mã lạ -> 404")
        void lookupBooking_AcceptsQrCodeAndRawCode() {
            // The real query ignores case; the mock has to as well.
            when(bookingRepository.findByBookingCodeIgnoreCase(argThat(code -> code != null && code.equalsIgnoreCase("RES-8921"))))
                    .thenReturn(Optional.of(testBooking));
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));

            assertThat(handoverService.lookupBooking("BOXORA-CHECKIN:RES-8921").getBookingCode()).isEqualTo("RES-8921");
            assertThat(handoverService.lookupBooking("  #res-8921 ").getFacilityName()).isEqualTo("Boxora Tan Binh");
            assertThat(handoverService.lookupBooking(bookingId.toString()).getId()).isEqualTo(bookingId);
            assertThat(handoverService.lookupBooking("RES-8921").isCheckedIn()).isFalse();

            AppException ex = assertThrows(AppException.class, () -> handoverService.lookupBooking("BOXORA-CHECKIN:KHONG-CO"));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.HANDOVER_LOOKUP_NOT_FOUND);
        }

        @Test
        @DisplayName("Tra cứu QR bị chặn khi đơn thuộc cơ sở khác")
        void lookupBooking_OtherFacilityIsBlocked() {
            doThrow(new AppException(ErrorCode.FACILITY_ACCESS_DENIED))
                    .when(facilityAccessGuard).checkFacilityAccess(testFacility.getId());
            when(bookingRepository.findByBookingCodeIgnoreCase("RES-8921")).thenReturn(Optional.of(testBooking));

            AppException ex = assertThrows(AppException.class, () -> handoverService.lookupBooking("RES-8921"));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.FACILITY_ACCESS_DENIED);
        }
    }
}

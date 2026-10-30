package com.boxora.service;

import com.boxora.dto.request.HandoverRequest;
import com.boxora.dto.request.IdentityVerifyRequest;
import com.boxora.dto.request.ManualPaymentRecordRequest;
import com.boxora.dto.request.PaperContractCreateRequest;
import com.boxora.dto.response.*;
import com.boxora.entity.*;
import com.boxora.enums.*;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.repository.*;
import com.boxora.service.impl.HandoverServiceImpl;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;
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
    private FileStorageService fileStorageService;

    @Mock
    private SupportTicketRepository supportTicketRepository;

    @InjectMocks
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

        UnitType testType = UnitType.builder().typeName("Standard").build();
        testType.setId(UUID.randomUUID());

        testUnit = StorageUnit.builder()
                .unitCode("A-112")
                .facility(testFacility)
                .unitType(testType)
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
                .identityOriginalDocumentSeen(true)
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
        lenient().when(storageUnitRepository.findWithDetailsByFacilityAndUnitCodeForUpdate(any(UUID.class), anyString()))
                .thenReturn(Optional.of(testUnit));

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
        lenient().when(bookingRepository.findByIdForUpdate(any(UUID.class)))
                .thenAnswer(invocation -> bookingRepository.findById(invocation.getArgument(0)));

        HandoverRecord inboundInspection = HandoverRecord.builder()
                .booking(testBooking)
                .recordType("CHECK_IN_INSPECTION")
                .doorConditionPassed(true)
                .cleanlinessPassed(true)
                .smartLockPassed(true)
                .sensorPassed(true)
                .wallStructurePassed(true)
                .evidencePhotos("/uploads/door.jpg;/uploads/interior.jpg")
                .recordedAt(LocalDateTime.now())
                .build();
        HandoverRecord returnInspection = HandoverRecord.builder()
                .booking(testBooking)
                .recordType("INSPECTION")
                .doorConditionPassed(true)
                .cleanlinessPassed(true)
                .smartLockPassed(true)
                .sensorPassed(true)
                .wallStructurePassed(true)
                .evidencePhotos("/uploads/return-door.jpg;/uploads/return-interior.jpg")
                .recordedAt(LocalDateTime.now())
                .build();
        lenient().when(handoverRecordRepository.findByBooking_Id(any(UUID.class)))
                .thenReturn(List.of(inboundInspection, returnInspection));

        FacilityPolicy policy = FacilityPolicy.builder()
                .facility(testFacility)
                .depositRefundSlaDays(5)
                .overdueGraceDays(1)
                .dailyLateFee(new BigDecimal("100000.00"))
                .build();
        lenient().when(facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(any(UUID.class)))
                .thenReturn(Optional.of(policy));
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
            when(handoverRecordRepository.save(any(HandoverRecord.class)))
                    .thenAnswer(invocation -> invocation.getArgument(0));

            HandoverResponse response = handoverService.checkIn(request);

            assertThat(response).isNotNull();
            assertThat(response.getRecordType()).isEqualTo("CHECK_IN");

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
        @DisplayName("Client checklist and photo URLs cannot bypass a missing persisted inspection")
        void checkIn_ClientInspectionPayloadCannotBypassPersistedInspection() {
            HandoverRequest request = HandoverRequest.builder()
                    .bookingId(bookingId)
                    .identityVerified(true)
                    .doorConditionPassed(true)
                    .cleanlinessPassed(true)
                    .smartLockPassed(true)
                    .sensorPassed(true)
                    .wallStructurePassed(true)
                    .evidencePhotos(List.of("/uploads/client-door.jpg", "/uploads/client-interior.jpg"))
                    .build();
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(handoverRecordRepository.findByBooking_Id(bookingId)).thenReturn(List.of());

            AppException ex = assertThrows(AppException.class, () -> handoverService.checkIn(request));

            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.RETURN_INSPECTION_CHECKLIST_INCOMPLETE);
            verify(handoverRecordRepository, never()).save(any(HandoverRecord.class));
        }

        @Test
        @DisplayName("Thiếu đối soát CCCD: Ném HANDOVER_PREREQUISITES_NOT_MET")
        void checkIn_MissingIdCard_ThrowsException() {
            testBooking.setIdentityOriginalDocumentSeen(false);
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
            when(userRepository.findById(custOpId)).thenReturn(Optional.of(customerOperator));
            when(requestContext.currentUserId()).thenReturn(custOpId);

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
            when(requestContext.currentUserId()).thenReturn(null);

            AppException ex = assertThrows(AppException.class, () -> handoverService.checkIn(request));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.FORBIDDEN);
        }

        @Test
        @DisplayName("Số CCCD sai định dạng (không phải 9-12 chữ số) -> Ném HANDOVER_PREREQUISITES_NOT_MET")
        void checkIn_InvalidCccdFormat_ThrowsPrerequisitesNotMet() {
            testBooking.setIdentityOriginalDocumentSeen(false);
            testBooking.setIdentityVerifiedAt(null);
            testBooking.setIdentityVerifiedByStaff(null);
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
        @DisplayName("Nhân viên chưa đối soát thực tế (identityVerified = false) -> Ném HANDOVER_PREREQUISITES_NOT_MET")
        void checkIn_StaffDidNotAttestIdentity_ThrowsPrerequisitesNotMet() {
            testBooking.setIdentityOriginalDocumentSeen(false);
            testBooking.setIdentityVerifiedAt(null);
            testBooking.setIdentityVerifiedByStaff(null);
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
                    .dailyLateFee(new BigDecimal("100000.00"))
                    .overdueGraceDays(1)
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
                    .evidencePhotos(List.of("http://boxora.com/photo1.jpg", "http://boxora.com/photo2.jpg"))
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
            verify(paymentRepository, never()).save(any(Payment.class));

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
                    .dailyLateFee(new BigDecimal("100000.00"))
                    .overdueGraceDays(1)
                    .build();

            HandoverRecord damagedInspection = HandoverRecord.builder()
                    .booking(testBooking)
                    .recordType("INSPECTION")
                    .doorConditionPassed(true)
                    .cleanlinessPassed(false)
                    .smartLockPassed(true)
                    .sensorPassed(true)
                    .wallStructurePassed(false)
                    .evidencePhotos("/uploads/return-door.jpg;/uploads/return-interior.jpg")
                    .recordedAt(LocalDateTime.now())
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
                    .build();

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(userRepository.findById(staffId)).thenReturn(Optional.of(testStaff));
            when(facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(testFacility.getId())).thenReturn(Optional.of(policy));
            when(rentalContractRepository.findByBookingId(bookingId)).thenReturn(Optional.of(testContract));
            when(handoverRecordRepository.findByBooking_Id(bookingId)).thenReturn(List.of(damagedInspection));
            when(handoverRecordRepository.save(any(HandoverRecord.class)))
                    .thenAnswer(invocation -> invocation.getArgument(0));

            HandoverResponse response = handoverService.processReturn(request);

            assertThat(response).isNotNull();
            assertThat(response.getReviewStatus()).isEqualTo("PENDING_ACCOUNTING_REVIEW");
            assertThat(response.getDeductionAmount()).isEqualByComparingTo(new BigDecimal("500000.00"));
            // 1,500,000 - 500,000 = 1,000,000
            assertThat(response.getRefundAmount()).isEqualByComparingTo(new BigDecimal("1000000.00"));

            // A proposal creates no payment transaction before finance records an actual payout.
            verify(paymentRepository, never()).save(any(Payment.class));

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
                    .dailyLateFee(new BigDecimal("100000.00"))
                    .overdueGraceDays(1)
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
                    .evidencePhotos(List.of("http://boxora.com/photo1.jpg", "http://boxora.com/photo2.jpg"))
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
        }

        @Test
        @DisplayName("processReturnSettlement khi tiền phạt vượt quá tiền cọc thì actualRefund = 0 và ghi nhận cảnh báo nợ")
        void processReturnSettlement_ExcessDeduction_ShouldCapRefundAtZeroAndFlagDebt() {
            testBooking.setStatus(BookingStatus.ACTIVE);
            testBooking.setAccessPin("739215");

            FacilityPolicy policy = FacilityPolicy.builder()
                    .facility(testFacility)
                    .depositRefundSlaDays(7)
                    .dailyLateFee(new BigDecimal("100000.00"))
                    .overdueGraceDays(1)
                    .build();

            // Cọc: 1,500,000. Phạt hư hại: 2,000,000 -> Âm 500,000
            HandoverRequest request = HandoverRequest.builder()
                    .bookingId(bookingId)
                    .staffId(staffId)
                    .damageFee(new BigDecimal("2000000.00"))
                    .damageNotes("Vỡ kính cường lực và hỏng ray cửa")
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
            assertThat(response.getNotes()).contains("500000.00");
            verify(paymentRepository, never()).save(any(Payment.class));
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
                    .identityOriginalDocumentSeen(true)
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
    @DisplayName("Task 13: Lưu hợp đồng giấy, ghi nhận tiền cọc chuyển khoản và tiền mặt tại quầy (BR-RULE-005/006)")
    class Task13HandoverTests {

        @BeforeEach
        void initTask13Booking() {
            testBooking.setDepositAmount(new BigDecimal("450000.00"));
            testBooking.setDepositPaid(BigDecimal.ZERO);
            testBooking.setStatus(BookingStatus.CONFIRMED);
            lenient().when(paymentRepository.save(any(Payment.class))).thenAnswer(inv -> inv.getArgument(0));
            lenient().when(rentalContractRepository.save(any(RentalContract.class))).thenAnswer(inv -> inv.getArgument(0));
        }

        @Test
        @DisplayName("1. Upload hợp đồng giấy với file ảnh hợp lệ -> Lưu thành công với status PENDING_VERIFICATION")
        void createOrUploadPaperContract_validImage_statusPendingVerification() {
            String paperUrl = "/uploads/contracts/" + bookingId + "/doc-image-scan.jpg";
            PaperContractCreateRequest req = PaperContractCreateRequest.builder()
                    .bookingId(bookingId)
                    .paperContractUrl(paperUrl)
                    .paperOriginalLocation("Tủ hồ sơ tầng 1, ngăn A12")
                    .notes("Đã ký sống tại quầy Tân Bình")
                    .build();

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(rentalContractRepository.findByBookingId(bookingId)).thenReturn(Optional.empty());
            when(rentalContractRepository.findByContractCodeIgnoreCase(anyString())).thenReturn(Optional.empty());
            when(rentalContractRepository.save(any(RentalContract.class))).thenAnswer(inv -> inv.getArgument(0));

            RentalContractResponse res = handoverService.createOrUploadPaperContract(req);

            assertThat(res).isNotNull();
            verify(rentalContractRepository).save(argThat(c ->
                    RentalContractStatus.PENDING_VERIFICATION.equals(c.getStatus())
                            && paperUrl.equals(c.getPaperContractUrl())
                            && "PAPER".equals(c.getSigningMethod())
                            && c.getPaperVerifiedAt() == null
                            && c.getSignedAt() == null
            ));
        }

        @Test
        @DisplayName("2. Upload hợp đồng giấy với file PDF hợp lệ -> Lưu thành công với status PENDING_VERIFICATION")
        void createOrUploadPaperContract_validPdf_statusPendingVerification() {
            String paperUrl = "/uploads/contracts/" + bookingId + "/doc-contract-signed.pdf";
            PaperContractCreateRequest req = PaperContractCreateRequest.builder()
                    .bookingId(bookingId)
                    .paperContractUrl(paperUrl)
                    .contractCode("HD-GIAY-" + testBooking.getBookingCode())
                    .paperOriginalLocation("Tủ hồ sơ văn phòng")
                    .build();

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(rentalContractRepository.findByBookingId(bookingId)).thenReturn(Optional.empty());
            when(rentalContractRepository.findByContractCodeIgnoreCase(anyString())).thenReturn(Optional.empty());
            when(rentalContractRepository.save(any(RentalContract.class))).thenAnswer(inv -> inv.getArgument(0));

            handoverService.createOrUploadPaperContract(req);

            verify(rentalContractRepository).save(argThat(c ->
                    RentalContractStatus.PENDING_VERIFICATION.equals(c.getStatus())
                            && paperUrl.equals(c.getPaperContractUrl())
            ));
        }

        @Test
        @DisplayName("3. Upload tài liệu định dạng không hỗ trợ hoặc kích thước >10MB -> Ném lỗi INVALID_REQUEST / TICKET_IMAGE_SIZE_EXCEEDED")
        void uploadHandoverDocument_invalidFormatOrOversized_throwsError() {
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));

            MultipartFile dummyFile = mock(MultipartFile.class);
            AppException exType = assertThrows(AppException.class, () ->
                    handoverService.uploadHandoverDocument(bookingId, dummyFile, "UNKNOWN_TYPE"));
            assertThat(exType.getErrorCode()).isEqualTo(ErrorCode.INVALID_REQUEST);

            when(fileStorageService.storeDocumentFile(any(), eq("contracts/" + bookingId)))
                    .thenThrow(new AppException(ErrorCode.TICKET_IMAGE_SIZE_EXCEEDED));
            AppException exSize = assertThrows(AppException.class, () ->
                    handoverService.uploadHandoverDocument(bookingId, dummyFile, "PAPER_CONTRACT"));
            assertThat(exSize.getErrorCode()).isEqualTo(ErrorCode.TICKET_IMAGE_SIZE_EXCEEDED);
        }

        @Test
        @DisplayName("4. Base64 data URI hoặc URL > 500 ký tự -> Từ chối với INVALID_REQUEST (ngăn lỗi VARCHAR 500)")
        void createOrUploadPaperContract_base64OrTooLong_throwsInvalidRequest() {
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));

            PaperContractCreateRequest base64Req = PaperContractCreateRequest.builder()
                    .bookingId(bookingId)
                    .paperContractUrl("data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...")
                    .build();
            AppException ex1 = assertThrows(AppException.class, () ->
                    handoverService.createOrUploadPaperContract(base64Req));
            assertThat(ex1.getErrorCode()).isEqualTo(ErrorCode.INVALID_REQUEST);

            String longUrl = "/uploads/contracts/" + "a".repeat(500) + ".pdf";
            PaperContractCreateRequest longReq = PaperContractCreateRequest.builder()
                    .bookingId(bookingId)
                    .paperContractUrl(longUrl)
                    .build();
            AppException ex2 = assertThrows(AppException.class, () ->
                    handoverService.createOrUploadPaperContract(longReq));
            assertThat(ex2.getErrorCode()).isEqualTo(ErrorCode.INVALID_REQUEST);

            ManualPaymentRecordRequest bankBase64Req = ManualPaymentRecordRequest.builder()
                    .bookingId(bookingId)
                    .paymentType(PaymentType.DEPOSIT)
                    .paymentMethod("BANK_TRANSFER")
                    .amount(new BigDecimal("450000.00"))
                    .referenceCode("REF-123")
                    .proofDocumentUrl("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...")
                    .build();
            when(paymentRepository.findAllByBooking_Id(bookingId)).thenReturn(List.of());
            AppException ex3 = assertThrows(AppException.class, () ->
                    handoverService.recordManualPayment(bankBase64Req));
            assertThat(ex3.getErrorCode()).isEqualTo(ErrorCode.INVALID_REQUEST);
        }

        @Test
        @DisplayName("5. Hợp đồng giấy ở trạng thái PENDING_VERIFICATION -> Chưa đủ điều kiện check-in (eligibleForCheckIn = false)")
        void getCheckInPrerequisites_paperContractPendingVerification_notEligible() {
            testBooking.setDepositPaid(new BigDecimal("450000.00"));
            RentalContract paperContract = RentalContract.builder()
                    .contractCode("HĐ-GIAY-8921")
                    .booking(testBooking)
                    .customer(testCustomer)
                    .unit(testUnit)
                    .facility(testFacility)
                    .signingMethod("PAPER")
                    .paperContractUrl("/uploads/contracts/" + bookingId + "/scan.pdf")
                    .status(RentalContractStatus.PENDING_VERIFICATION)
                    .paperVerifiedAt(null)
                    .build();

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(rentalContractRepository.findByBookingId(bookingId)).thenReturn(Optional.of(paperContract));

            HandoverPrerequisitesResponse resp = handoverService.getCheckInPrerequisites(bookingId);
            assertThat(resp.isContractSigned()).isFalse();
            assertThat(resp.getContractVerificationStatus()).isEqualTo("PENDING_VERIFICATION");
            assertThat(resp.isEligibleForCheckIn()).isFalse();
            assertThat(resp.getMissingPrerequisites()).anyMatch(m -> m.contains("chờ nhân viên kiểm tra chữ ký"));
        }

        @Test
        @DisplayName("6. Xác minh hợp đồng giấy: Nhân viên hợp lệ -> PASS (ACTIVE/PENDING_ACTIVATION); Khách hàng -> FORBIDDEN")
        void verifyPaperContract_authorizedStaffPass_customerForbidden() {
            RentalContract paperContract = RentalContract.builder()
                    .contractCode("HĐ-GIAY-8921")
                    .booking(testBooking)
                    .customer(testCustomer)
                    .unit(testUnit)
                    .facility(testFacility)
                    .signingMethod("PAPER")
                    .paperContractUrl("/uploads/contracts/" + bookingId + "/scan.pdf")
                    .status(RentalContractStatus.PENDING_VERIFICATION)
                    .build();

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(rentalContractRepository.findByBookingId(bookingId)).thenReturn(Optional.of(paperContract));
            when(rentalContractRepository.save(any(RentalContract.class))).thenAnswer(inv -> inv.getArgument(0));

            RentalContractResponse res = handoverService.verifyPaperContract(bookingId, "Đã kiểm tra chữ ký tay đối chiếu CMND");
            assertThat(res).isNotNull();
            assertThat(paperContract.getPaperVerifiedAt()).isNotNull();
            assertThat(paperContract.getPaperVerifiedBy()).isEqualTo(testStaff);
            assertThat(paperContract.getStatus()).isEqualTo(RentalContractStatus.PENDING_ACTIVATION);

            UUID customerUserId = testCustomer.getId();
            when(requestContext.currentUserId()).thenReturn(customerUserId);
            when(userRepository.findById(customerUserId)).thenReturn(Optional.of(testCustomer));

            AppException ex = assertThrows(AppException.class, () ->
                    handoverService.verifyPaperContract(bookingId, "Khách tự duyệt"));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.FORBIDDEN);
        }

        @Test
        @DisplayName("7. Thu tiền mặt (CASH) tại quầy -> Bắt buộc có mã phiếu thu, tự động loại bỏ proofDocumentUrl và referenceCode thừa")
        void recordManualPayment_cash_nullifiesProofAndRefCode_andSetsPaid() {
            ManualPaymentRecordRequest req = ManualPaymentRecordRequest.builder()
                    .bookingId(bookingId)
                    .paymentType(PaymentType.DEPOSIT)
                    .paymentMethod("CASH")
                    .amount(new BigDecimal("450000.00"))
                    .receiptVoucherCode("PT-2026-TANBINH-001")
                    .referenceCode("REF-LEFTOVER-999")
                    .proofDocumentUrl("/uploads/payments/" + bookingId + "/leftover.png")
                    .notes("Khách đóng tiền mặt tại sảnh")
                    .build();

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(paymentRepository.existsByReceiptVoucherCodeIgnoreCase("PT-2026-TANBINH-001")).thenReturn(false);
            when(paymentRepository.findAllByBooking_Id(bookingId)).thenReturn(List.of());
            when(paymentRepository.save(any(Payment.class))).thenAnswer(inv -> inv.getArgument(0));

            handoverService.recordManualPayment(req);

            verify(paymentRepository).save(argThat(p ->
                    PaymentStatus.PAID.equals(p.getStatus())
                            && "CASH".equals(p.getPaymentMethod())
                            && "PT-2026-TANBINH-001".equals(p.getReceiptVoucherCode())
                            && p.getReferenceCode() == null
                            && p.getProofDocumentUrl() == null
                            && p.getConfirmedByStaff() != null
                            && p.getConfirmedAt() != null
            ));
        }

        @Test
        @DisplayName("8. Thu tiền mặt trùng mã phiếu thu (duplicate voucher code) -> Ném lỗi PAYMENT_ALREADY_PROCESSED")
        void recordManualPayment_duplicateCashVoucherCode_throwsPaymentAlreadyProcessed() {
            ManualPaymentRecordRequest req = ManualPaymentRecordRequest.builder()
                    .bookingId(bookingId)
                    .paymentType(PaymentType.DEPOSIT)
                    .paymentMethod("CASH")
                    .amount(new BigDecimal("450000.00"))
                    .receiptVoucherCode("PT-DUPLICATE-999")
                    .build();

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(paymentRepository.findAllByBooking_Id(bookingId)).thenReturn(List.of());
            when(paymentRepository.existsByReceiptVoucherCodeIgnoreCase("PT-DUPLICATE-999")).thenReturn(true);

            AppException ex = assertThrows(AppException.class, () ->
                    handoverService.recordManualPayment(req));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.PAYMENT_ALREADY_PROCESSED);
        }

        @Test
        @DisplayName("9. Thu tiền mặt khi nghĩa vụ đã hoàn tất -> Ném lỗi PAYMENT_ALREADY_PROCESSED chống cộng tiền trùng")
        void recordManualPayment_obligationAlreadySatisfied_throwsPaymentAlreadyProcessed() {
            Payment existingDep = Payment.builder()
                    .paymentType(PaymentType.DEPOSIT)
                    .status(PaymentStatus.PAID)
                    .amount(new BigDecimal("450000.00"))
                    .build();

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(paymentRepository.findAllByBooking_Id(bookingId)).thenReturn(List.of(existingDep));

            ManualPaymentRecordRequest req = ManualPaymentRecordRequest.builder()
                    .bookingId(bookingId)
                    .paymentType(PaymentType.DEPOSIT)
                    .paymentMethod("CASH")
                    .amount(new BigDecimal("450000.00"))
                    .receiptVoucherCode("PT-EXTRA-888")
                    .build();

            AppException ex = assertThrows(AppException.class, () ->
                    handoverService.recordManualPayment(req));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.PAYMENT_ALREADY_PROCESSED);
        }

        @Test
        @DisplayName("10. Ghi nhận chuyển khoản ngân hàng -> Trạng thái PENDING, lưu proof URL, chưa cộng vào tiền đã thanh toán")
        void recordManualPayment_bankTransfer_statusPending_notCountedAsPaid() {
            String proofUrl = "/uploads/payments/" + bookingId + "/proof_mb_123.jpg";
            ManualPaymentRecordRequest req = ManualPaymentRecordRequest.builder()
                    .bookingId(bookingId)
                    .paymentType(PaymentType.DEPOSIT)
                    .paymentMethod("BANK_TRANSFER")
                    .amount(new BigDecimal("450000.00"))
                    .referenceCode("MB-FT8921001")
                    .proofDocumentUrl(proofUrl)
                    .build();

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(paymentRepository.findAllByBooking_Id(bookingId)).thenReturn(List.of());
            when(paymentRepository.existsByReferenceCodeIgnoreCase("MB-FT8921001")).thenReturn(false);
            when(paymentRepository.save(any(Payment.class))).thenAnswer(inv -> inv.getArgument(0));

            handoverService.recordManualPayment(req);

            verify(paymentRepository).save(argThat(p ->
                    PaymentStatus.PENDING.equals(p.getStatus())
                            && "BANK_TRANSFER".equals(p.getPaymentMethod())
                            && "MB-FT8921001".equals(p.getReferenceCode())
                            && proofUrl.equals(p.getProofDocumentUrl())
                            && p.getConfirmedByStaff() == null
                            && p.getConfirmedAt() == null
            ));
            assertThat(testBooking.getDepositPaid()).isEqualByComparingTo("0.00");
        }

        @Test
        @DisplayName("11. Chuyển khoản ngân hàng chỉ được tính đã thanh toán sau khi nhân viên đối soát khớp lệnh")
        void confirmBankTransferPayment_authorizedStaff_setsPaidAndSynchronizesDeposit() {
            UUID paymentId = UUID.randomUUID();
            Payment pendingBankPayment = Payment.builder()
                    .booking(testBooking)
                    .amount(new BigDecimal("450000.00"))
                    .paymentType(PaymentType.DEPOSIT)
                    .paymentMethod("BANK_TRANSFER")
                    .referenceCode("VCB-FT9921002")
                    .proofDocumentUrl("/uploads/payments/" + bookingId + "/proof_vcb.png")
                    .status(PaymentStatus.PENDING)
                    .build();
            pendingBankPayment.setId(paymentId);

            testBooking.setDepositPaid(BigDecimal.ZERO);

            when(paymentRepository.findById(paymentId)).thenReturn(Optional.of(pendingBankPayment));
            when(paymentRepository.findAllByBooking_Id(bookingId)).thenReturn(List.of());
            when(paymentRepository.save(any(Payment.class))).thenAnswer(inv -> inv.getArgument(0));

            handoverService.confirmBankTransferPayment(paymentId, "Đã khớp lệnh tiền nổi tài khoản VCB Boxora");

            assertThat(pendingBankPayment.getStatus()).isEqualTo(PaymentStatus.PAID);
            assertThat(pendingBankPayment.getConfirmedByStaff()).isEqualTo(testStaff);
            assertThat(pendingBankPayment.getConfirmedAt()).isNotNull();
            verify(bookingRepository).save(argThat(b ->
                    b.getDepositPaid() != null && b.getDepositPaid().compareTo(new BigDecimal("450000.00")) == 0
            ));
        }

        @Test
        @DisplayName("12. Xác nhận trùng chuyển khoản đã PAID -> Ném lỗi PAYMENT_ALREADY_PROCESSED, không cộng tiền 2 lần")
        void confirmBankTransferPayment_alreadyPaid_throwsPaymentAlreadyProcessed() {
            UUID paymentId = UUID.randomUUID();
            Payment alreadyPaidPayment = Payment.builder()
                    .booking(testBooking)
                    .amount(new BigDecimal("450000.00"))
                    .paymentType(PaymentType.DEPOSIT)
                    .paymentMethod("BANK_TRANSFER")
                    .status(PaymentStatus.PAID)
                    .build();
            alreadyPaidPayment.setId(paymentId);

            when(paymentRepository.findById(paymentId)).thenReturn(Optional.of(alreadyPaidPayment));

            AppException ex = assertThrows(AppException.class, () ->
                    handoverService.confirmBankTransferPayment(paymentId, "Duyệt lại"));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.PAYMENT_ALREADY_PROCESSED);
        }

        @Test
        @DisplayName("13. Check-in bị chặn nếu thiếu bất kỳ điều kiện nào trong 4 điều kiện (BR-RULE-005)")
        void checkIn_missingAnyOfFourConditions_throwsPrerequisitesNotMet() {
            // Case 13a: Missing Deposit
            testBooking.setDepositPaid(BigDecimal.ZERO);
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(paymentRepository.findAllByBooking_Id(bookingId)).thenReturn(List.of());
            when(rentalContractRepository.findByBookingId(bookingId)).thenReturn(Optional.of(testContract));

            HandoverRequest reqNoDeposit = HandoverRequest.builder()
                    .bookingId(bookingId)
                    .staffId(staffId)
                    .idCardNumber("001092003891")
                    .identityVerified(true)
                    .build();
            AppException ex1 = assertThrows(AppException.class, () -> handoverService.checkIn(reqNoDeposit));
            assertThat(ex1.getErrorCode()).isEqualTo(ErrorCode.HANDOVER_PREREQUISITES_NOT_MET);

            // Case 13b: Missing Rent (no rent payment)
            testBooking.setDepositPaid(new BigDecimal("450000.00"));
            when(paymentRepository.findAllByBooking_Id(bookingId)).thenReturn(List.of(
                    Payment.builder().paymentType(PaymentType.DEPOSIT).status(PaymentStatus.PAID).amount(new BigDecimal("450000.00")).build()
            ));
            AppException ex2 = assertThrows(AppException.class, () -> handoverService.checkIn(reqNoDeposit));
            assertThat(ex2.getErrorCode()).isEqualTo(ErrorCode.HANDOVER_PREREQUISITES_NOT_MET);

            // Case 13c: Missing Verified Contract (e.g. Paper Contract still PENDING_VERIFICATION)
            RentalContract unverifiedPaper = RentalContract.builder()
                    .contractCode("HĐ-CHUA-DUYET")
                    .signingMethod("PAPER")
                    .status(RentalContractStatus.PENDING_VERIFICATION)
                    .paperContractUrl("/uploads/contracts/scan.pdf")
                    .build();
            when(rentalContractRepository.findByBookingId(bookingId)).thenReturn(Optional.of(unverifiedPaper));
            when(paymentRepository.findAllByBooking_Id(bookingId)).thenReturn(List.of(
                    Payment.builder().paymentType(PaymentType.DEPOSIT).status(PaymentStatus.PAID).amount(new BigDecimal("450000.00")).build(),
                    Payment.builder().paymentType(PaymentType.RENTAL_FEE).status(PaymentStatus.PAID).amount(new BigDecimal("1500000.00")).build()
            ));
            AppException ex3 = assertThrows(AppException.class, () -> handoverService.checkIn(reqNoDeposit));
            assertThat(ex3.getErrorCode()).isEqualTo(ErrorCode.HANDOVER_PREREQUISITES_NOT_MET);

            // Case 13d: Missing Identity verification
            testBooking.setDepositPaid(new BigDecimal("450000.00"));
            testBooking.setIdentityVerifiedAt(null);
            testBooking.setIdentityVerifiedByStaff(null);
            testBooking.setIdentityCardNumber(null);
            when(rentalContractRepository.findByBookingId(bookingId)).thenReturn(Optional.of(testContract));
            HandoverRequest reqNoIdentity = HandoverRequest.builder()
                    .bookingId(bookingId)
                    .staffId(staffId)
                    .identityVerified(false)
                    .build();
            AppException ex4 = assertThrows(AppException.class, () -> handoverService.checkIn(reqNoIdentity));
            assertThat(ex4.getErrorCode()).isEqualTo(ErrorCode.HANDOVER_PREREQUISITES_NOT_MET);
        }

        @Test
        @DisplayName("14. Luồng ký điện tử qua DocuSeal hoàn toàn không bị ảnh hưởng và được công nhận hợp lệ")
        void docuSealElectronicContract_recognizedAsSigned() {
            RentalContract docusealContract = RentalContract.builder()
                    .contractCode("HD-ONLINE-2026")
                    .booking(testBooking)
                    .customer(testCustomer)
                    .unit(testUnit)
                    .facility(testFacility)
                    .signingMethod("ONLINE")
                    .docusealSubmissionId(883921L)
                    .status(RentalContractStatus.PENDING_ACTIVATION)
                    .signedAt(LocalDateTime.now())
                    .build();

            testBooking.setDepositPaid(new BigDecimal("450000.00"));

            Payment rentPayment = Payment.builder()
                    .paymentType(PaymentType.RENTAL_FEE)
                    .status(PaymentStatus.PAID)
                    .amount(new BigDecimal("1500000.00"))
                    .build();

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(rentalContractRepository.findByBookingId(bookingId)).thenReturn(Optional.of(docusealContract));
            when(paymentRepository.findAllByBooking_Id(bookingId)).thenReturn(List.of(rentPayment));

            HandoverPrerequisitesResponse resp = handoverService.getCheckInPrerequisites(bookingId);
            assertThat(resp.isContractSigned()).isTrue();
            assertThat(resp.getContractSigningMethod()).isEqualTo("ONLINE");
            assertThat(resp.getContractStatus()).isEqualTo("ĐÃ_KÝ_ĐIỆN_TỬ");
            assertThat(resp.isEligibleForCheckIn()).isTrue();
        }

        @Test
        @DisplayName("15. Luồng trả kho & quyết toán hoàn tiền (Return/Refund của Khang) không bị ảnh hưởng, khấu trừ đúng khoản REFUNDED")
        void returnFlowAndRefundCalculation_remainsIntact() {
            Payment paidDeposit = Payment.builder()
                    .paymentType(PaymentType.DEPOSIT)
                    .status(PaymentStatus.PAID)
                    .amount(new BigDecimal("1500000.00"))
                    .build();
            Payment refundedDeposit = Payment.builder()
                    .paymentType(PaymentType.DEPOSIT)
                    .status(PaymentStatus.REFUNDED)
                    .amount(new BigDecimal("500000.00"))
                    .build();
            Payment refundPending = Payment.builder()
                    .paymentType(PaymentType.DEPOSIT)
                    .status(PaymentStatus.REFUND_PENDING)
                    .amount(new BigDecimal("200000.00"))
                    .build();

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(paymentRepository.findAllByBooking_Id(bookingId)).thenReturn(List.of(paidDeposit, refundedDeposit, refundPending));

            HandoverPrerequisitesResponse resp = handoverService.getCheckInPrerequisites(bookingId);
            assertThat(resp.getDepositPaid()).isEqualByComparingTo("1000000.00");
        }

        @Test
        @DisplayName("16. Bảo vệ đa cơ sở: Khi facilityAccessGuard từ chối quyền thì tất cả các endpoint Task 13 đều ném FORBIDDEN")
        void crossFacilityAccess_deniedByGuard_throwsForbidden() {
            doThrow(new AppException(ErrorCode.FORBIDDEN))
                    .when(facilityAccessGuard).checkFacilityAccess(testFacility.getId());

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));

            MultipartFile mockFile = mock(MultipartFile.class);
            assertThrows(AppException.class, () ->
                    handoverService.uploadHandoverDocument(bookingId, mockFile, "PAPER_CONTRACT"));

            PaperContractCreateRequest paperReq = PaperContractCreateRequest.builder()
                    .bookingId(bookingId)
                    .paperContractUrl("/uploads/contracts/test.pdf")
                    .build();
            assertThrows(AppException.class, () ->
                    handoverService.createOrUploadPaperContract(paperReq));

            assertThrows(AppException.class, () ->
                    handoverService.verifyPaperContract(bookingId, "Duyệt khác cơ sở"));

            ManualPaymentRecordRequest payReq = ManualPaymentRecordRequest.builder()
                    .bookingId(bookingId)
                    .paymentType(PaymentType.DEPOSIT)
                    .paymentMethod("CASH")
                    .receiptVoucherCode("PT-CROSS-123")
                    .amount(new BigDecimal("450000.00"))
                    .build();
            assertThrows(AppException.class, () ->
                    handoverService.recordManualPayment(payReq));
        }

        @Test
        @DisplayName("17. Bảo mật tài liệu: Yêu cầu xác thực, từ chối khi chưa đăng nhập")
        void getAuthorizedHandoverDocumentPath_unauthenticated_throwsForbidden() {
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(requestContext.currentUserId()).thenReturn(null);

            AppException ex = assertThrows(AppException.class, () ->
                    handoverService.getAuthorizedHandoverDocumentPath(bookingId, "/uploads/contracts/" + bookingId + "/doc.pdf"));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.FORBIDDEN);
        }

        @Test
        @DisplayName("18. Bảo mật tài liệu: Khách hàng không thể xem tài liệu đơn đặt kho của khách khác (IDOR)")
        void getAuthorizedHandoverDocumentPath_otherCustomer_throwsForbidden() {
            UUID otherCustomerId = UUID.randomUUID();
            User otherCustomer = User.builder()
                    .fullName("Người lạ")
                    .role(Role.builder().name("CUSTOMER").build())
                    .build();
            otherCustomer.setId(otherCustomerId);

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(requestContext.currentUserId()).thenReturn(otherCustomerId);
            when(userRepository.findById(otherCustomerId)).thenReturn(Optional.of(otherCustomer));

            AppException ex = assertThrows(AppException.class, () ->
                    handoverService.getAuthorizedHandoverDocumentPath(bookingId, "/uploads/contracts/" + bookingId + "/doc.pdf"));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.FORBIDDEN);
        }

        @Test
        @DisplayName("19. Bảo mật tài liệu: Nhân viên trái cơ sở bị facilityAccessGuard chặn khi xem tệp")
        void getAuthorizedHandoverDocumentPath_crossFacilityStaff_throwsForbidden() {
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(requestContext.currentUserId()).thenReturn(staffId);
            when(userRepository.findById(staffId)).thenReturn(Optional.of(testStaff));
            doThrow(new AppException(ErrorCode.FORBIDDEN))
                    .when(facilityAccessGuard).checkFacilityAccess(testFacility.getId());

            AppException ex = assertThrows(AppException.class, () ->
                    handoverService.getAuthorizedHandoverDocumentPath(bookingId, "/uploads/contracts/" + bookingId + "/doc.pdf"));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.FORBIDDEN);
        }

        @Test
        @DisplayName("20. Bảo mật tài liệu: Chặn truy xuất tệp không thuộc booking (IDOR file tamper)")
        void getAuthorizedHandoverDocumentPath_idorMismatchedFile_throwsForbidden() {
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(requestContext.currentUserId()).thenReturn(staffId);
            when(userRepository.findById(staffId)).thenReturn(Optional.of(testStaff));
            when(rentalContractRepository.findByBookingId(bookingId)).thenReturn(Optional.empty());
            when(paymentRepository.findAllByBooking_Id(bookingId)).thenReturn(List.of());

            AppException ex = assertThrows(AppException.class, () ->
                    handoverService.getAuthorizedHandoverDocumentPath(bookingId, "/uploads/contracts/other-booking-id/secret.pdf"));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.FORBIDDEN);
        }

        @Test
        @DisplayName("21. Bảo mật tài liệu: Nhân viên hợp lệ xem đúng tài liệu của đơn kho thành công")
        void getAuthorizedHandoverDocumentPath_validAccess_returnsPath() {
            String validUrl = "/uploads/contracts/" + bookingId + "/paper_contract.pdf";
            java.nio.file.Path mockPath = java.nio.file.Path.of("uploads", "contracts", bookingId.toString(), "paper_contract.pdf");

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(requestContext.currentUserId()).thenReturn(staffId);
            when(userRepository.findById(staffId)).thenReturn(Optional.of(testStaff));
            when(rentalContractRepository.findByBookingId(bookingId)).thenReturn(Optional.of(
                    RentalContract.builder().paperContractUrl(validUrl).build()
            ));
            when(fileStorageService.resolveStoredFilePath(validUrl)).thenReturn(mockPath);

            java.nio.file.Path result = handoverService.getAuthorizedHandoverDocumentPath(bookingId, validUrl);
            assertThat(result).isEqualTo(mockPath);
        }
    }

    @Nested
    @DisplayName("Bảo vệ luồng gửi lại mã PIN: Chỉ cho phép đơn ACTIVE đã check-in thành công")
    class HandoverPinEmailGuardTests {

        @Test
        @DisplayName("Gửi lại PIN: Booking PENDING_PAYMENT bị từ chối với BOOKING_NOT_CHECKED_IN")
        void sendHandoverPinEmail_PendingPayment_ThrowsException() {
            testBooking.setStatus(BookingStatus.PENDING_PAYMENT);
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));

            AppException ex = assertThrows(AppException.class, () ->
                    handoverService.sendHandoverPinEmail(bookingId, null));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.BOOKING_NOT_CHECKED_IN);
            verify(emailService, never()).sendHandoverPinEmail(anyString(), anyString(), anyString(), anyString(), anyString(), anyString());
        }

        @Test
        @DisplayName("Gửi lại PIN: Booking CONFIRMED chưa check-in bị từ chối với BOOKING_NOT_CHECKED_IN")
        void sendHandoverPinEmail_ConfirmedNotActive_ThrowsException() {
            testBooking.setStatus(BookingStatus.CONFIRMED);
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));

            AppException ex = assertThrows(AppException.class, () ->
                    handoverService.sendHandoverPinEmail(bookingId, null));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.BOOKING_NOT_CHECKED_IN);
            verify(emailService, never()).sendHandoverPinEmail(anyString(), anyString(), anyString(), anyString(), anyString(), anyString());
        }

        @Test
        @DisplayName("Gửi lại PIN: Booking ACTIVE nhưng thiếu accessPin bị từ chối với BOOKING_NOT_CHECKED_IN")
        void sendHandoverPinEmail_ActiveMissingPin_ThrowsException() {
            testBooking.setStatus(BookingStatus.ACTIVE);
            testBooking.setAccessPin(null);
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));

            AppException ex = assertThrows(AppException.class, () ->
                    handoverService.sendHandoverPinEmail(bookingId, null));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.BOOKING_NOT_CHECKED_IN);
            verify(emailService, never()).sendHandoverPinEmail(anyString(), anyString(), anyString(), anyString(), anyString(), anyString());
        }

        @Test
        @DisplayName("Gửi lại PIN: Booking ACTIVE đã check-in gửi lại đúng PIN hiện hữu, không sinh PIN mới")
        void sendHandoverPinEmail_ActiveCheckedIn_SendsExistingPinSuccessfully() {
            testBooking.setStatus(BookingStatus.ACTIVE);
            testBooking.setAccessPin("encrypted-pin-123456");
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(encryptionService.decrypt("encrypted-pin-123456")).thenReturn("123456");

            handoverService.sendHandoverPinEmail(bookingId, null);

            verify(emailService, times(1)).sendHandoverPinEmail(
                    eq(testCustomer.getEmail()),
                    eq(testCustomer.getFullName()),
                    eq(testUnit.getUnitCode()),
                    eq(testBooking.getBookingCode()),
                    eq("123456"),
                    eq(testFacility.getName())
            );
            // Verify accessPin is not modified or replaced
            assertThat(testBooking.getAccessPin()).isEqualTo("encrypted-pin-123456");
        }

        @Test
        @DisplayName("Thông báo Web PIN: Booking chưa ACTIVE bị từ chối với BOOKING_NOT_CHECKED_IN")
        void sendHandoverWebNotification_NotActive_ThrowsException() {
            testBooking.setStatus(BookingStatus.CONFIRMED);
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));

            AppException ex = assertThrows(AppException.class, () ->
                    handoverService.sendHandoverWebNotification(bookingId));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.BOOKING_NOT_CHECKED_IN);
            verify(notificationLogRepository, never()).save(any());
        }
    }

    @Nested
    @DisplayName("Task 3: Early Check-in With Confirmation (Kiểm tra nhận kho sớm có xác nhận)")
    class EarlyCheckInTests {

        @Test
        @DisplayName("getCheckInPrerequisites: Trước ngày check-in không thêm vào missingPrerequisites")
        void getCheckInPrerequisites_BeforeDate_DoesNotPolluteMissingPrerequisites() {
            LocalDateTime tomorrowCheckIn = LocalDateTime.now().plusDays(2).withHour(9).withMinute(0);
            testBooking.setExpectedCheckInAt(tomorrowCheckIn);

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
            assertThat(response.isCheckInTimeMet()).isFalse();
            assertThat(response.getCheckInTimeStatus()).isEqualTo("BEFORE_DATE");
            assertThat(response.getCheckInTimeMessage()).contains("Chưa đến ngày check-in. Thời điểm đúng để thực hiện tiếp nhận kho từ:");
            assertThat(response.getMissingPrerequisites()).isEmpty();
            assertThat(response.isEligibleForInspection()).isTrue();
        }

        @Test
        @DisplayName("checkIn: Trước ngày check-in và KHÔNG có xác nhận tiếp nhận sớm -> Ném lỗi HANDOVER_BEFORE_CHECKIN_DATE")
        void checkIn_BeforeDate_WithoutEarlyConfirmation_ThrowsException() {
            LocalDateTime futureCheckIn = LocalDateTime.now().plusDays(2).withHour(9).withMinute(0);
            testBooking.setExpectedCheckInAt(futureCheckIn);

            when(bookingRepository.findByIdForUpdate(bookingId)).thenReturn(Optional.of(testBooking));
            when(requestContext.currentUserId()).thenReturn(staffId);
            when(userRepository.findById(staffId)).thenReturn(Optional.of(testStaff));

            HandoverRecord inspection = HandoverRecord.builder()
                    .recordType("CHECK_IN_INSPECTION")
                    .recordedAt(LocalDateTime.now())
                    .doorConditionPassed(true)
                    .cleanlinessPassed(true)
                    .smartLockPassed(true)
                    .sensorPassed(true)
                    .wallStructurePassed(true)
                    .evidencePhotos("https://photo1.jpg;https://photo2.jpg")
                    .build();
            when(handoverRecordRepository.findByBooking_Id(bookingId)).thenReturn(List.of(inspection));

            HandoverRequest req = HandoverRequest.builder()
                    .bookingId(bookingId)
                    .earlyCheckInConfirmed(false)
                    .build();

            AppException ex = assertThrows(AppException.class, () -> handoverService.checkIn(req));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.HANDOVER_BEFORE_CHECKIN_DATE);
            assertThat(ex.getMessage()).contains("Chưa đến ngày check-in");
        }

        @Test
        @DisplayName("checkIn: Trước ngày check-in và CÓ xác nhận tiếp nhận sớm -> Thành công, ghi nhận audit và giữ nguyên expectedCheckInAt")
        void checkIn_BeforeDate_WithEarlyConfirmation_SucceedsAndAudits() {
            LocalDateTime futureCheckIn = LocalDateTime.now().plusDays(2).withHour(9).withMinute(0);
            testBooking.setExpectedCheckInAt(futureCheckIn);

            Payment rentPayment = Payment.builder()
                    .paymentType(PaymentType.RENTAL_FEE)
                    .status(PaymentStatus.PAID)
                    .amount(new BigDecimal("1500000.00"))
                    .build();

            when(bookingRepository.findByIdForUpdate(bookingId)).thenReturn(Optional.of(testBooking));
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(requestContext.currentUserId()).thenReturn(staffId);
            when(userRepository.findById(staffId)).thenReturn(Optional.of(testStaff));
            when(encryptionService.encrypt(anyString())).thenReturn("enc-pin");
            when(handoverRecordRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(bookingRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(storageUnitRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(paymentRepository.findAllByBooking_Id(bookingId)).thenReturn(List.of(rentPayment));
            when(rentalContractRepository.findByBookingId(bookingId)).thenReturn(Optional.of(testContract));

            HandoverRecord inspection = HandoverRecord.builder()
                    .recordType("CHECK_IN_INSPECTION")
                    .recordedAt(LocalDateTime.now())
                    .doorConditionPassed(true)
                    .cleanlinessPassed(true)
                    .smartLockPassed(true)
                    .sensorPassed(true)
                    .wallStructurePassed(true)
                    .evidencePhotos("https://photo1.jpg;https://photo2.jpg")
                    .build();
            when(handoverRecordRepository.findByBooking_Id(bookingId)).thenReturn(List.of(inspection));

            HandoverRequest req = HandoverRequest.builder()
                    .bookingId(bookingId)
                    .earlyCheckInConfirmed(true)
                    .earlyCheckInReason("Khách có nhu cầu chuyển đồ gấp")
                    .build();

            HandoverResponse res = handoverService.checkIn(req);

            assertThat(res).isNotNull();
            assertThat(testBooking.getStatus()).isEqualTo(BookingStatus.ACTIVE);
            assertThat(testBooking.getExpectedCheckInAt()).isEqualTo(futureCheckIn); // Preserved!
            assertThat(testBooking.getStepTransitionHistory()).contains("[EARLY_CHECKIN]");
            assertThat(testBooking.getStepTransitionHistory()).contains("Khách có nhu cầu chuyển đồ gấp");
        }

        @Test
        @DisplayName("Kiểm tra extractReturnHistoryNotes: Chỉ lấy sự kiện trả kho và lọc bỏ check-in / bản ghi trùng lặp")
        void testExtractReturnHistoryNotes_FiltersCheckInAndDuplicates() {
            String rawHistory = String.join("\n", List.of(
                    "[EARLY_CHECKIN][2026-10-27T21:36:48.342876700] Tiếp nhận sớm bởi Phan Van Hau (STAFF). Lý do: Khách nhận kho sớm có xác nhận của nhân viên. Lịch hẹn gốc giữ nguyên: 09:00 28/10/2026.",
                    "[2026-10-27T21:40:00] Hoàn tất đối soát 4 điều kiện bởi nhân viên Phan Van Hau. Chuyển sang bước Nghiệm thu hiện trường.",
                    "[15:23 28/10/2026] Nhân viên Phan Van Hau xác nhận lịch hẹn nghiệm thu hiện trường vào lúc 15:18 28/10/2026. Ghi chú: Test schedule inspection",
                    "[15:23 28/10/2026] Nhân viên Phan Van Hau xác nhận lịch hẹn nghiệm thu hiện trường vào lúc 15:18 28/10/2026. Ghi chú: Test schedule inspection",
                    "[15:24 28/10/2026] Nhân viên Phan Van Hau xác nhận lịch hẹn nghiệm thu hiện trường vào lúc 15:18 28/10/2026. Ghi chú: Tiếp nhận và hẹn lịch nghiệm thu bởi Phan Van Hau",
                    "[16:01 28/10/2026] Nhân viên Phan Van Hau bắt đầu nghiệm thu hiện trường.",
                    "[16:11 28/10/2026] Nhân viên Phan Van Hau hoàn thành thẩm định hiện trường: Cửa cuốn: Không đạt | Vệ sinh: Bẩn | Tường vách: Hư hại | SmartLock: Tốt | Dọn đồ: Đã dọn hết | Cảm biến: Chuẩn",
                    "[16:29 28/10/2026] Nhân viên Phan Van Hau hoàn thành thẩm định hiện trường: Cửa cuốn: Không đạt | Vệ sinh: Bẩn | Tường vách: Hư hại | SmartLock: Tốt | Dọn đồ: Đã dọn hết | Cảm biến: Chuẩn",
                    "[19:22 28/10/2026] Nhân viên Phan Van Hau trình quản lý phê duyệt các khoản khấu trừ bồi thường. Ghi chú: Nhân viên Phan Van Hau trình duyệt quyết toán: Khấu trừ 5.450.008đ",
                    "[20:44 28/10/2026] Ghi nhận khiếu nại tranh chấp từ khách hàng: đắt",
                    "[20:46 28/10/2026] Nhân viên Nguyen Thi Bich trình quản lý phê duyệt các khoản khấu trừ bồi thường. Ghi chú: Nhân viên Nguyen Thi Bich trình duyệt quyết toán: Khấu trừ 5.450.008đ",
                    "[20:53 28/10/2026] Nhân viên Nguyen Thi Bich trình quản lý phê duyệt các khoản khấu trừ bồi thường. Ghi chú: Nhân viên Nguyen Thi Bich trình duyệt quyết toán: Khấu trừ 5.450.008đ"
            ));

            List<String> notes = handoverService.extractReturnHistoryNotes(rawHistory);

            assertThat(notes).isNotNull();
            // Assert that EARLY_CHECKIN and 4 prerequisite check-in logs are excluded
            assertThat(notes).noneMatch(n -> n.contains("EARLY_CHECKIN") || n.contains("Tiếp nhận sớm") || n.contains("đối soát 4 điều kiện"));
            // Assert return events are retained
            assertThat(notes).anyMatch(n -> n.contains("xác nhận lịch hẹn nghiệm thu"));
            assertThat(notes).anyMatch(n -> n.contains("bắt đầu nghiệm thu hiện trường"));
            assertThat(notes).anyMatch(n -> n.contains("hoàn thành thẩm định hiện trường"));
            assertThat(notes).anyMatch(n -> n.contains("Ghi nhận khiếu nại tranh chấp"));
            // Assert consecutive duplicates are removed
            long inspectionSummaryCount = notes.stream().filter(n -> n.contains("hoàn thành thẩm định hiện trường")).count();
            assertThat(inspectionSummaryCount).isEqualTo(1);
        }
    }
}


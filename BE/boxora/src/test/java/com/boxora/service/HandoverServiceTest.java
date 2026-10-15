package com.boxora.service;

import com.boxora.dto.request.HandoverRequest;
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
                .status(RentalContractStatus.ACTIVE)
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

        lenient().when(requestContext.currentUserId()).thenReturn(staffId);
        lenient().when(userRepository.findById(staffId)).thenReturn(Optional.of(testStaff));
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
            assertThat(testBooking.getAccessPin()).isEqualTo("739215");
            assertThat(testUnit.getStatus()).isEqualTo(UnitStatus.OCCUPIED);

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
            when(facilityPolicyRepository.findByFacilityId(testFacility.getId())).thenReturn(Optional.of(policy));

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
            when(facilityPolicyRepository.findByFacilityId(testFacility.getId())).thenReturn(Optional.of(policy));

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
                    .evidencePhotos(List.of("http://boxora.com/photo1.jpg", "http://boxora.com/photo2.jpg"))
                    .build();

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(userRepository.findById(staffId)).thenReturn(Optional.of(testStaff));
            when(facilityPolicyRepository.findByFacilityId(testFacility.getId())).thenReturn(Optional.of(policy));
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
                    .build();

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(userRepository.findById(staffId)).thenReturn(Optional.of(testStaff));
            when(facilityPolicyRepository.findByFacilityId(testFacility.getId())).thenReturn(Optional.of(policy));
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
            when(facilityPolicyRepository.findByFacilityId(testFacility.getId())).thenReturn(Optional.of(policy));
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
            when(facilityPolicyRepository.findByFacilityId(testFacility.getId())).thenReturn(Optional.of(policy));
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
}



package com.boxora.service;

import com.boxora.dto.request.HandoverRequest;
import com.boxora.dto.response.HandoverPrerequisitesResponse;
import com.boxora.dto.response.HandoverResponse;
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
    private ActivityLogService activityLogService;

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
                .build();
        testCustomer.setId(UUID.randomUUID());

        testStaff = User.builder()
                .fullName("Lê Nhân Viên")
                .email("staff@boxora.com")
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
                .docusealSubmissionId(998822L)
                .build();
        testContract.setId(UUID.randomUUID());
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
    }
}


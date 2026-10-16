package com.boxora.service;

import com.boxora.dto.request.BookingCreateRequest;
import com.boxora.dto.response.BookingResponse;
import com.boxora.entity.Facility;
import com.boxora.entity.FacilityPolicy;
import com.boxora.entity.StorageUnit;
import com.boxora.entity.User;
import com.boxora.enums.ActivityAction;
import com.boxora.enums.BookingStatus;
import com.boxora.enums.UnitStatus;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.repository.BookingRepository;
import com.boxora.repository.FacilityPolicyRepository;
import com.boxora.repository.StorageUnitRepository;
import com.boxora.repository.UserRepository;
import com.boxora.service.impl.BookingServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BookingServiceTest {

    @Mock
    private BookingRepository bookingRepository;

    @Mock
    private StorageUnitRepository storageUnitRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private FacilityPolicyRepository facilityPolicyRepository;

    @Mock
    private StorageUnitLockService storageUnitLockService;

    @Mock
    private ActivityLogService activityLogService;

    @Mock
    private com.boxora.security.FacilityAccessGuard facilityAccessGuard;

    @Mock
    private EncryptionService encryptionService;

    @Mock
    private com.boxora.security.RequestContext requestContext;

    @Mock
    private PricingService pricingService;

    @Mock
    private com.boxora.repository.PaymentRepository paymentRepository;

    @Mock
    private com.boxora.repository.BookingRescheduleHistoryRepository bookingRescheduleHistoryRepository;

    @Mock
    private com.boxora.repository.RentalContractRepository rentalContractRepository;

    @InjectMocks
    private BookingServiceImpl bookingService;

    private Facility testFacility;
    private FacilityPolicy testPolicy;
    private StorageUnit testUnit;
    private User testCustomer;
    private UUID unitId;
    private UUID customerId;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(bookingService, "softLockHours", 24L);
        ReflectionTestUtils.setField(bookingService, "maxAdvanceDays", 30);

        lenient().when(pricingService.calculateQuote(any())).thenReturn(
                com.boxora.dto.response.PricingQuoteResponse.builder()
                        .totalRentalFee(new BigDecimal("3000000.00"))
                        .depositAmount(new BigDecimal("1500000.00"))
                        .initialPaymentAmount(new BigDecimal("4500000.00"))
                        .build()
        );

        unitId = UUID.randomUUID();
        customerId = UUID.randomUUID();

        testCustomer = User.builder()
                .email("test.customer@boxora.com")
                .fullName("Trần Khách Hàng")
                .build();
        testCustomer.setId(customerId);

        testFacility = Facility.builder()
                .name("Boxora Tan Binh")
                .build();
        testFacility.setId(UUID.randomUUID());

        testPolicy = FacilityPolicy.builder()
                .facility(testFacility)
                .minimumRentalMonths(1)
                .build();

        testUnit = StorageUnit.builder()
                .unitCode("U-205")
                .facility(testFacility)
                .status(UnitStatus.AVAILABLE)
                .build();
        testUnit.setId(unitId);
    }

    @Nested
    @DisplayName("Validation & Soft-lock Tests")
    class ValidationAndSoftLockTests {

        @Test
        @DisplayName("Tạo đơn thành công: PENDING_PAYMENT, soft-lock 24h qua Redis, chưa cấp PIN")
        void createBooking_Success() {
            BookingCreateRequest request = BookingCreateRequest.builder()
                    .storageUnitId(unitId)
                    .customerId(customerId)
                    .startDate(LocalDate.now().plusDays(5))
                    .rentalMonths(2)
                    .build();

            when(storageUnitRepository.findWithDetailsByIdForUpdate(unitId)).thenReturn(Optional.of(testUnit));
            when(storageUnitLockService.isUnitLocked(unitId)).thenReturn(false);
            when(storageUnitLockService.tryLockUnit(eq(unitId), any(), anyLong())).thenReturn(true);
            when(userRepository.findById(customerId)).thenReturn(Optional.of(testCustomer));
            when(facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(testFacility.getId())).thenReturn(Optional.of(testPolicy));
            when(bookingRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

            BookingResponse response = bookingService.createBooking(request);

            assertThat(response).isNotNull();
            assertThat(response.getStatus()).isEqualTo(BookingStatus.PENDING_PAYMENT);
            assertThat(response.getAccessPin()).isNull();
            assertThat(response.getQrAccessToken()).isNull();
            assertThat(testUnit.getStatus()).isEqualTo(UnitStatus.RESERVED);

            verify(storageUnitLockService).tryLockUnit(eq(unitId), any(), anyLong());
            verify(activityLogService).record(
                    eq(testFacility.getId()),
                    eq(ActivityAction.RESERVATION_CREATE),
                    eq("Booking"),
                    any(),
                    anyString(),
                    isNull(),
                    eq(BookingStatus.PENDING_PAYMENT)
            );
        }

        @Test
        @DisplayName("Ngày bắt đầu trong quá khứ: Ném BOOKING_START_DATE_PAST")
        void createBooking_StartDateInPast_ThrowsException() {
            BookingCreateRequest request = BookingCreateRequest.builder()
                    .storageUnitId(unitId)
                    .startDate(LocalDate.now().minusDays(1))
                    .rentalMonths(1)
                    .build();

            when(storageUnitRepository.findWithDetailsByIdForUpdate(unitId)).thenReturn(Optional.of(testUnit));
            when(storageUnitLockService.isUnitLocked(unitId)).thenReturn(false);

            AppException ex = assertThrows(AppException.class, () -> bookingService.createBooking(request));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.BOOKING_START_DATE_PAST);
        }

        @Test
        @DisplayName("Ngày bắt đầu quá 30 ngày: Ném BOOKING_ADVANCE_NOTICE_EXCEEDED")
        void createBooking_StartDateExceeds30Days_ThrowsException() {
            BookingCreateRequest request = BookingCreateRequest.builder()
                    .storageUnitId(unitId)
                    .startDate(LocalDate.now().plusDays(35))
                    .rentalMonths(1)
                    .build();

            when(storageUnitRepository.findWithDetailsByIdForUpdate(unitId)).thenReturn(Optional.of(testUnit));
            when(storageUnitLockService.isUnitLocked(unitId)).thenReturn(false);

            AppException ex = assertThrows(AppException.class, () -> bookingService.createBooking(request));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.BOOKING_ADVANCE_NOTICE_EXCEEDED);
        }

        @Test
        @DisplayName("Ngăn kho đang bị soft-lock trong Redis: Ném STORAGE_UNIT_SOFT_LOCKED")
        void createBooking_UnitAlreadySoftLocked_ThrowsException() {
            BookingCreateRequest request = BookingCreateRequest.builder()
                    .storageUnitId(unitId)
                    .startDate(LocalDate.now().plusDays(3))
                    .rentalMonths(1)
                    .build();

            when(storageUnitRepository.findWithDetailsByIdForUpdate(unitId)).thenReturn(Optional.of(testUnit));
            when(storageUnitLockService.isUnitLocked(unitId)).thenReturn(true);

            AppException ex = assertThrows(AppException.class, () -> bookingService.createBooking(request));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.STORAGE_UNIT_SOFT_LOCKED);
        }

        @Test
        @DisplayName("Ngăn kho không ở trạng thái AVAILABLE: Ném STORAGE_UNIT_NOT_AVAILABLE")
        void createBooking_UnitNotAvailable_ThrowsException() {
            testUnit.setStatus(UnitStatus.OCCUPIED);
            BookingCreateRequest request = BookingCreateRequest.builder()
                    .storageUnitId(unitId)
                    .startDate(LocalDate.now().plusDays(3))
                    .rentalMonths(1)
                    .build();

            when(storageUnitRepository.findWithDetailsByIdForUpdate(unitId)).thenReturn(Optional.of(testUnit));

            AppException ex = assertThrows(AppException.class, () -> bookingService.createBooking(request));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.STORAGE_UNIT_NOT_AVAILABLE);
        }

        @Test
        @DisplayName("Số tháng thuê bé hơn 1: Ném BOOKING_MINIMUM_DURATION_INVALID")
        void createBooking_ZeroRentalMonths_ThrowsException() {
            BookingCreateRequest request = BookingCreateRequest.builder()
                    .storageUnitId(unitId)
                    .startDate(LocalDate.now().plusDays(3))
                    .rentalMonths(0)
                    .build();

            when(storageUnitRepository.findWithDetailsByIdForUpdate(unitId)).thenReturn(Optional.of(testUnit));
            when(storageUnitLockService.isUnitLocked(unitId)).thenReturn(false);

            AppException ex = assertThrows(AppException.class, () -> bookingService.createBooking(request));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.BOOKING_MINIMUM_DURATION_INVALID);
        }

        @Test
        @DisplayName("Số tháng thuê nhỏ hơn quy định chính sách cơ sở: Ném BOOKING_MINIMUM_DURATION_INVALID")
        void createBooking_BelowPolicyMinimum_ThrowsException() {
            testPolicy.setMinimumRentalMonths(3);

            BookingCreateRequest request = BookingCreateRequest.builder()
                    .storageUnitId(unitId)
                    .startDate(LocalDate.now().plusDays(3))
                    .rentalMonths(2)
                    .build();

            when(storageUnitRepository.findWithDetailsByIdForUpdate(unitId)).thenReturn(Optional.of(testUnit));
            when(storageUnitLockService.isUnitLocked(unitId)).thenReturn(false);
            when(facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(testFacility.getId())).thenReturn(Optional.of(testPolicy));

            AppException ex = assertThrows(AppException.class, () -> bookingService.createBooking(request));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.BOOKING_MINIMUM_DURATION_INVALID);
        }

        @Test
        @DisplayName("Redis lỗi/offline: Hệ thống bỏ qua tối ưu hóa Redis và tiếp tục đặt kho an toàn bằng DB Pessimistic Lock")
        void createBooking_RedisFails_ProceedsWithDbPessimisticLockSuccess() {
            BookingCreateRequest request = BookingCreateRequest.builder()
                    .storageUnitId(unitId)
                    .customerId(customerId)
                    .startDate(LocalDate.now().plusDays(2))
                    .rentalMonths(1)
                    .build();

            when(storageUnitRepository.findWithDetailsByIdForUpdate(unitId)).thenReturn(Optional.of(testUnit));
            // Redis ném ngoại lệ kết nối
            when(storageUnitLockService.isUnitLocked(unitId)).thenThrow(new RuntimeException("Redis connection refused"));
            when(storageUnitLockService.tryLockUnit(eq(unitId), any(), eq(24L))).thenThrow(new RuntimeException("Redis connection timeout"));
            when(userRepository.findById(customerId)).thenReturn(Optional.of(testCustomer));
            when(facilityPolicyRepository.findByFacility_Id(testFacility.getId())).thenReturn(Optional.of(testPolicy));
            when(bookingRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

            BookingResponse response = bookingService.createBooking(request);

            assertThat(response).isNotNull();
            assertThat(response.getStatus()).isEqualTo(BookingStatus.PENDING_PAYMENT);
            assertThat(testUnit.getStatus()).isEqualTo(UnitStatus.RESERVED);
            verify(storageUnitRepository).save(testUnit);
        }

        @Test
        @DisplayName("Cạnh tranh đặt kho đồng thời: Database phát hiện kho đã có active reservation khác -> Ném STORAGE_UNIT_NOT_AVAILABLE")
        void createBooking_ConcurrentAttempt_AlreadyOccupiedInDb_ThrowsNotAvailable() {
            BookingCreateRequest request = BookingCreateRequest.builder()
                    .storageUnitId(unitId)
                    .startDate(LocalDate.now().plusDays(2))
                    .rentalMonths(1)
                    .build();

            when(storageUnitRepository.findWithDetailsByIdForUpdate(unitId)).thenReturn(Optional.of(testUnit));
            when(bookingRepository.existsByStorageUnit_IdAndStatusIn(eq(unitId), any())).thenReturn(true);

            AppException ex = assertThrows(AppException.class, () -> bookingService.createBooking(request));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.STORAGE_UNIT_NOT_AVAILABLE);
        }
    }

    @Nested
    @DisplayName("Expiration & Payment Race Condition Tests")
    class ExpirationAndPaymentRaceTests {

        @Test
        @DisplayName("expireUnpaidBookings: Tính lũy thừa (Idempotent) - Booking đã bị CANCELLED được bỏ qua an toàn")
        void expireUnpaidBookings_Idempotent_AlreadyCancelled_SafeNoOp() {
            com.boxora.entity.Booking booking = com.boxora.entity.Booking.builder()
                    .bookingCode("BK-EXP-001")
                    .status(BookingStatus.CANCELLED)
                    .storageUnit(testUnit)
                    .build();
            booking.setId(UUID.randomUUID());

            when(bookingRepository.findExpiredHoldCandidates(any(), any(), any(), any()))
                    .thenReturn(java.util.List.of(booking));
            when(bookingRepository.findByIdForUpdate(booking.getId())).thenReturn(Optional.of(booking));

            bookingService.expireUnpaidBookings();

            // Unit must not be touched for already cancelled booking
            verify(storageUnitRepository, never()).save(any());
            assertThat(booking.getStatus()).isEqualTo(BookingStatus.CANCELLED);
        }

        @Test
        @DisplayName("expireUnpaidBookings: Race condition - Thanh toán thành công cùng lúc hết hạn -> Đối soát chuyển CONFIRMED thay vì CANCELLED")
        void expireUnpaidBookings_RaceWithPayment_PaymentAlreadyPaid_ReconcilesToConfirmed() {
            com.boxora.entity.Booking booking = com.boxora.entity.Booking.builder()
                    .bookingCode("BK-EXP-002")
                    .status(BookingStatus.PENDING_PAYMENT)
                    .paymentStatus("UNPAID")
                    .storageUnit(testUnit)
                    .build();
            booking.setId(UUID.randomUUID());

            when(bookingRepository.findExpiredHoldCandidates(any(), any(), any(), any()))
                    .thenReturn(java.util.List.of(booking));
            when(bookingRepository.findByIdForUpdate(booking.getId())).thenReturn(Optional.of(booking));
            // Payment repo reports PAID
            when(paymentRepository.existsByBooking_IdAndStatus(booking.getId(), com.boxora.enums.PaymentStatus.PAID))
                    .thenReturn(true);

            bookingService.expireUnpaidBookings();

            assertThat(booking.getStatus()).isEqualTo(BookingStatus.CONFIRMED);
            assertThat(booking.getPaymentExpiresAt()).isNull();
            verify(storageUnitLockService).releaseLock(testUnit.getId());
        }

        @Test
        @DisplayName("expireUnpaidBookings: Không giải phóng kho về AVAILABLE nếu vẫn còn đơn active khác trên kho đó")
        void expireUnpaidBookings_SafeUnitRelease_DoesNotReleaseUnitIfAnotherActiveBookingExists() {
            com.boxora.entity.Booking booking = com.boxora.entity.Booking.builder()
                    .bookingCode("BK-EXP-003")
                    .status(BookingStatus.PENDING_PAYMENT)
                    .paymentStatus("UNPAID")
                    .storageUnit(testUnit)
                    .build();
            booking.setId(UUID.randomUUID());
            testUnit.setStatus(UnitStatus.RESERVED);

            when(bookingRepository.findExpiredHoldCandidates(any(), any(), any(), any()))
                    .thenReturn(java.util.List.of(booking));
            when(bookingRepository.findByIdForUpdate(booking.getId())).thenReturn(Optional.of(booking));
            when(paymentRepository.existsByBooking_IdAndStatus(booking.getId(), com.boxora.enums.PaymentStatus.PAID))
                    .thenReturn(false);

            when(storageUnitRepository.findWithDetailsByIdForUpdate(testUnit.getId())).thenReturn(Optional.of(testUnit));
            // Another active reservation occupies the unit
            when(bookingRepository.existsByStorageUnit_IdAndStatusInAndIdNot(eq(testUnit.getId()), any(), eq(booking.getId())))
                    .thenReturn(true);

            bookingService.expireUnpaidBookings();

            assertThat(booking.getStatus()).isEqualTo(BookingStatus.CANCELLED);
            // testUnit should NOT be reverted to AVAILABLE because another active booking exists
            assertThat(testUnit.getStatus()).isEqualTo(UnitStatus.RESERVED);
            verify(storageUnitRepository, never()).save(testUnit);
        }

        @Test
        @DisplayName("expireUnpaidBookings: Booking CONFIRMED quá hạn lịch check-in -> Tự động chuyển sang OVERDUE và giải phóng kho")
        void expireUnpaidBookings_ConfirmedPastAppointment_TransitionsToOverdueAndReleasesUnit() {
            com.boxora.entity.Booking booking = com.boxora.entity.Booking.builder()
                    .bookingCode("BX-2025-6291")
                    .status(BookingStatus.CONFIRMED)
                    .paymentStatus("UNPAID")
                    .expectedCheckInAt(LocalDateTime.now().minusDays(3))
                    .storageUnit(testUnit)
                    .build();
            booking.setId(UUID.randomUUID());
            testUnit.setStatus(UnitStatus.RESERVED);

            when(bookingRepository.findExpiredHoldCandidates(any(), any(), any(), any()))
                    .thenReturn(java.util.List.of(booking));
            when(bookingRepository.findByIdForUpdate(booking.getId())).thenReturn(Optional.of(booking));
            when(paymentRepository.existsByBooking_IdAndStatus(booking.getId(), com.boxora.enums.PaymentStatus.PAID))
                    .thenReturn(false);

            when(storageUnitRepository.findWithDetailsByIdForUpdate(testUnit.getId())).thenReturn(Optional.of(testUnit));
            when(bookingRepository.existsByStorageUnit_IdAndStatusInAndIdNot(eq(testUnit.getId()), any(), eq(booking.getId())))
                    .thenReturn(false);

            bookingService.expireUnpaidBookings();

            assertThat(booking.getStatus()).isEqualTo(BookingStatus.OVERDUE);
            assertThat(testUnit.getStatus()).isEqualTo(UnitStatus.AVAILABLE);
            verify(storageUnitRepository).save(testUnit);
            verify(bookingRepository).save(booking);
        }
    }

    @Nested
    @DisplayName("Check-in Rescheduling Workflow Tests")
    class RescheduleWorkflowTests {

        private com.boxora.entity.Booking eligibleBooking;
        private UUID bookingId;

        @BeforeEach
        void initBooking() {
            bookingId = UUID.randomUUID();
            com.boxora.entity.Role customerRole = new com.boxora.entity.Role();
            customerRole.setName("CUSTOMER");
            testCustomer.setRole(customerRole);

            eligibleBooking = com.boxora.entity.Booking.builder()
                    .bookingCode("BK-RESCHED-01")
                    .customer(testCustomer)
                    .storageUnit(testUnit)
                    .startDate(LocalDate.now().plusDays(2))
                    .endDate(LocalDate.now().plusDays(2).plusMonths(3))
                    .rentalMonths(3)
                    .totalRentalFee(new BigDecimal("3000000.00"))
                    .depositPaid(new BigDecimal("1000000.00"))
                    .depositAmount(new BigDecimal("1000000.00"))
                    .status(BookingStatus.CONFIRMED)
                    .paymentStatus("PAID")
                    .expectedCheckInAt(LocalDate.now().plusDays(2).atTime(10, 0))
                    .build();
            eligibleBooking.setId(bookingId);
        }

        @Test
        @DisplayName("1. Reschedule thành công: Cập nhật lịch hẹn và lưu lịch sử kiểm toán nguyên tử")
        void reschedule_Success_ValidBooking() {
            LocalDate newDate = LocalDate.now().plusDays(5);
            com.boxora.dto.request.BookingRescheduleRequest req = com.boxora.dto.request.BookingRescheduleRequest.builder()
                    .newStartDate(newDate)
                    .newExpectedCheckInAt(newDate.atTime(14, 0))
                    .newCheckInTime("14:00")
                    .reason("Thay đổi lịch vận chuyển đồ đạc")
                    .build();

            when(bookingRepository.findByIdForUpdate(bookingId)).thenReturn(Optional.of(eligibleBooking));
            when(requestContext.currentUserId()).thenReturn(testCustomer.getId());
            when(userRepository.findById(testCustomer.getId())).thenReturn(Optional.of(testCustomer));
            when(facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(testFacility.getId()))
                    .thenReturn(Optional.of(testPolicy));
            when(bookingRepository.existsByStorageUnit_IdAndStatusInAndIdNot(eq(testUnit.getId()), any(), eq(bookingId)))
                    .thenReturn(false);
            when(bookingRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(rentalContractRepository.findByBookingId(bookingId)).thenReturn(Optional.empty());
            when(bookingRescheduleHistoryRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            com.boxora.dto.response.BookingRescheduleResponse res = bookingService.rescheduleBookingDetailed(bookingId, req);

            assertThat(res).isNotNull();
            assertThat(res.getBooking().getStartDate()).isEqualTo(newDate);
            assertThat(res.getBooking().getEndDate()).isEqualTo(newDate.plusMonths(3));
            assertThat(res.getBooking().getExpectedCheckInAt()).isEqualTo(newDate.atTime(14, 0));
            verify(bookingRescheduleHistoryRepository).save(any());
            verify(activityLogService).record(eq(testFacility.getId()), eq(ActivityAction.CHECKIN_RESCHEDULE), eq("Booking"), eq(bookingId), any(), any(), eq(BookingStatus.CONFIRMED));
        }

        @Test
        @DisplayName("2. Khách hàng không thể đổi lịch đơn của khách hàng khác -> FORBIDDEN")
        void reschedule_Forbidden_AnotherCustomer() {
            UUID strangerId = UUID.randomUUID();
            User stranger = User.builder().fullName("Người Lạ").build();
            stranger.setId(strangerId);
            com.boxora.entity.Role role = new com.boxora.entity.Role();
            role.setName("CUSTOMER");
            stranger.setRole(role);

            when(bookingRepository.findByIdForUpdate(bookingId)).thenReturn(Optional.of(eligibleBooking));
            when(requestContext.currentUserId()).thenReturn(strangerId);
            when(userRepository.findById(strangerId)).thenReturn(Optional.of(stranger));

            com.boxora.dto.request.BookingRescheduleRequest req = com.boxora.dto.request.BookingRescheduleRequest.builder()
                    .newStartDate(LocalDate.now().plusDays(4))
                    .build();

            AppException ex = assertThrows(AppException.class, () -> bookingService.rescheduleBookingDetailed(bookingId, req));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.FORBIDDEN);
        }

        @Test
        @DisplayName("3. Đơn đã bàn giao thực tế -> Không thể đổi lịch (BOOKING_ALREADY_HANDED_OVER)")
        void reschedule_Rejected_CompletedHandover() {
            eligibleBooking.setHandoverTime(java.time.LocalDateTime.now().minusDays(1));
            when(bookingRepository.findByIdForUpdate(bookingId)).thenReturn(Optional.of(eligibleBooking));
            when(requestContext.currentUserId()).thenReturn(testCustomer.getId());
            when(userRepository.findById(testCustomer.getId())).thenReturn(Optional.of(testCustomer));

            com.boxora.dto.request.BookingRescheduleRequest req = com.boxora.dto.request.BookingRescheduleRequest.builder()
                    .newStartDate(LocalDate.now().plusDays(4))
                    .build();

            AppException ex = assertThrows(AppException.class, () -> bookingService.rescheduleBookingDetailed(bookingId, req));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.BOOKING_ALREADY_HANDED_OVER);
        }

        @Test
        @DisplayName("4. Đơn đã bị hủy -> Không thể đổi lịch (BOOKING_ALREADY_CANCELLED)")
        void reschedule_Rejected_CancelledBooking() {
            eligibleBooking.setStatus(BookingStatus.CANCELLED);
            when(bookingRepository.findByIdForUpdate(bookingId)).thenReturn(Optional.of(eligibleBooking));
            when(requestContext.currentUserId()).thenReturn(testCustomer.getId());
            when(userRepository.findById(testCustomer.getId())).thenReturn(Optional.of(testCustomer));

            com.boxora.dto.request.BookingRescheduleRequest req = com.boxora.dto.request.BookingRescheduleRequest.builder()
                    .newStartDate(LocalDate.now().plusDays(4))
                    .build();

            AppException ex = assertThrows(AppException.class, () -> bookingService.rescheduleBookingDetailed(bookingId, req));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.BOOKING_ALREADY_CANCELLED);
        }

        @Test
        @DisplayName("5. Ngày hẹn trong quá khứ -> Bị từ chối (BOOKING_START_DATE_PAST)")
        void reschedule_Rejected_PastDate() {
            when(bookingRepository.findByIdForUpdate(bookingId)).thenReturn(Optional.of(eligibleBooking));
            when(requestContext.currentUserId()).thenReturn(testCustomer.getId());
            when(userRepository.findById(testCustomer.getId())).thenReturn(Optional.of(testCustomer));

            com.boxora.dto.request.BookingRescheduleRequest req = com.boxora.dto.request.BookingRescheduleRequest.builder()
                    .newStartDate(LocalDate.now().minusDays(1))
                    .build();

            AppException ex = assertThrows(AppException.class, () -> bookingService.rescheduleBookingDetailed(bookingId, req));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.BOOKING_START_DATE_PAST);
        }

        @Test
        @DisplayName("6. Hợp đồng đã ký điện tử: Bảo lưu chữ ký số và cập nhật lịch dự kiến")
        void reschedule_PreservesSignedContract() {
            LocalDate newDate = LocalDate.now().plusDays(7);
            com.boxora.dto.request.BookingRescheduleRequest req = com.boxora.dto.request.BookingRescheduleRequest.builder()
                    .newStartDate(newDate)
                    .newExpectedCheckInAt(newDate.atTime(10, 0))
                    .build();

            com.boxora.entity.RentalContract contract = com.boxora.entity.RentalContract.builder()
                    .contractCode("HD-TEST-001")
                    .status(com.boxora.enums.RentalContractStatus.PENDING_ACTIVATION)
                    .signedDocumentUrl("https://boxora.storage/contracts/signed_doc_01.pdf")
                    .signatureData("SIG-DATA-BASE64")
                    .signedAt(java.time.LocalDateTime.now().minusDays(1))
                    .startDate(eligibleBooking.getStartDate())
                    .endDate(eligibleBooking.getEndDate())
                    .build();

            when(bookingRepository.findByIdForUpdate(bookingId)).thenReturn(Optional.of(eligibleBooking));
            when(requestContext.currentUserId()).thenReturn(testCustomer.getId());
            when(userRepository.findById(testCustomer.getId())).thenReturn(Optional.of(testCustomer));
            when(facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(testFacility.getId()))
                    .thenReturn(Optional.of(testPolicy));
            when(bookingRepository.existsByStorageUnit_IdAndStatusInAndIdNot(any(), any(), any())).thenReturn(false);
            when(bookingRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(rentalContractRepository.findByBookingId(bookingId)).thenReturn(Optional.of(contract));
            when(bookingRescheduleHistoryRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            com.boxora.dto.response.BookingRescheduleResponse res = bookingService.rescheduleBookingDetailed(bookingId, req);

            assertThat(contract.getStartDate()).isEqualTo(newDate);
            assertThat(contract.getEndDate()).isEqualTo(newDate.plusMonths(3));
            // Signed contract integrity preserved
            assertThat(contract.getSignedDocumentUrl()).isEqualTo("https://boxora.storage/contracts/signed_doc_01.pdf");
            assertThat(contract.getSignatureData()).isEqualTo("SIG-DATA-BASE64");
            assertThat(contract.getSignedAt()).isNotNull();
            assertThat(res.getHistoryRecord().getContractAmendmentNotes()).contains("bảo lưu chữ ký số");
        }

        @Test
        @DisplayName("7. getRescheduleEligibility: Trả về đầy đủ thông tin kiểm tra điều kiện")
        void getRescheduleEligibility_ReturnsCorrectDetails() {
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(eligibleBooking));
            when(requestContext.currentUserId()).thenReturn(testCustomer.getId());
            when(userRepository.findById(testCustomer.getId())).thenReturn(Optional.of(testCustomer));
            when(facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(testFacility.getId()))
                    .thenReturn(Optional.of(testPolicy));
            when(rentalContractRepository.findByBookingId(bookingId)).thenReturn(Optional.empty());

            com.boxora.dto.response.BookingRescheduleEligibilityResponse res = bookingService.getRescheduleEligibility(bookingId);

            assertThat(res).isNotNull();
            assertThat(res.isEligible()).isTrue();
            assertThat(res.getBookingId()).isEqualTo(bookingId);
            assertThat(res.getRestrictions()).isNotEmpty();
            assertThat(res.getAllowedMinDate()).isEqualTo(LocalDate.now());
        }
    }

    @Nested
    @DisplayName("Get Booking By Id Authorization Tests")
    class GetByIdAuthorizationTests {

        @Test
        @DisplayName("getById: Chủ sở hữu booking được phép truy cập thành công")
        void getById_AuthorizedOwner_ReturnsBooking() {
            UUID id = UUID.randomUUID();
            com.boxora.entity.Booking booking = com.boxora.entity.Booking.builder()
                    .bookingCode("BX-OWNER-01")
                    .customer(testCustomer)
                    .storageUnit(testUnit)
                    .startDate(LocalDate.now())
                    .endDate(LocalDate.now().plusMonths(1))
                    .status(BookingStatus.CONFIRMED)
                    .build();
            booking.setId(id);

            when(bookingRepository.findById(id)).thenReturn(Optional.of(booking));
            when(requestContext.currentUserId()).thenReturn(testCustomer.getId());
            when(userRepository.findById(testCustomer.getId())).thenReturn(Optional.of(testCustomer));

            com.boxora.dto.response.BookingResponse response = bookingService.getById(id);

            assertThat(response).isNotNull();
            assertThat(response.getBookingCode()).isEqualTo("BX-OWNER-01");
        }

        @Test
        @DisplayName("getById: Khách hàng khác truy cập booking của người khác -> Bị từ chối FORBIDDEN (403)")
        void getById_UnauthorizedCustomer_ThrowsForbidden() {
            UUID id = UUID.randomUUID();
            com.boxora.entity.Booking booking = com.boxora.entity.Booking.builder()
                    .bookingCode("BX-OTHER-01")
                    .customer(testCustomer)
                    .storageUnit(testUnit)
                    .startDate(LocalDate.now())
                    .endDate(LocalDate.now().plusMonths(1))
                    .status(BookingStatus.CONFIRMED)
                    .build();
            booking.setId(id);

            UUID attackerId = UUID.randomUUID();
            com.boxora.entity.User attacker = com.boxora.entity.User.builder()
                    .email("attacker@gmail.com")
                    .role(com.boxora.entity.Role.builder().name("CUSTOMER").build())
                    .build();
            attacker.setId(attackerId);

            when(bookingRepository.findById(id)).thenReturn(Optional.of(booking));
            when(requestContext.currentUserId()).thenReturn(attackerId);
            when(userRepository.findById(attackerId)).thenReturn(Optional.of(attacker));

            org.junit.jupiter.api.Assertions.assertThrows(
                    com.boxora.exception.AppException.class,
                    () -> bookingService.getById(id)
            );
        }

        @Test
        @DisplayName("getById: Nhân viên cơ sở khác cố truy cập booking cơ sở ngoài phạm vi -> Ném lỗi FACILITY_ACCESS_DENIED")
        void getById_OutOfScopeStaff_ThrowsFacilityAccessDenied() {
            UUID id = UUID.randomUUID();
            com.boxora.entity.Booking booking = com.boxora.entity.Booking.builder()
                    .bookingCode("BX-FACILITY-01")
                    .customer(testCustomer)
                    .storageUnit(testUnit)
                    .startDate(LocalDate.now())
                    .endDate(LocalDate.now().plusMonths(1))
                    .status(BookingStatus.CONFIRMED)
                    .build();
            booking.setId(id);

            UUID staffId = UUID.randomUUID();
            com.boxora.entity.User otherStaff = com.boxora.entity.User.builder()
                    .email("staff.d7@boxora.com")
                    .role(com.boxora.entity.Role.builder().name("STAFF").build())
                    .build();
            otherStaff.setId(staffId);

            when(bookingRepository.findById(id)).thenReturn(Optional.of(booking));
            when(requestContext.currentUserId()).thenReturn(staffId);
            when(userRepository.findById(staffId)).thenReturn(Optional.of(otherStaff));
            when(facilityAccessGuard.isFacilityScoped()).thenReturn(true);
            org.mockito.Mockito.doThrow(new com.boxora.exception.AppException(com.boxora.exception.ErrorCode.FACILITY_ACCESS_DENIED))
                    .when(facilityAccessGuard).checkFacilityAccess(testFacility.getId());

            org.junit.jupiter.api.Assertions.assertThrows(
                    com.boxora.exception.AppException.class,
                    () -> bookingService.getById(id)
            );
        }
    }
}

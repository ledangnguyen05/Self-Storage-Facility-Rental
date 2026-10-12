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

            when(storageUnitRepository.findWithDetailsById(unitId)).thenReturn(Optional.of(testUnit));
            when(storageUnitLockService.isUnitLocked(unitId)).thenReturn(false);
            when(storageUnitLockService.tryLockUnit(eq(unitId), any(), eq(24L))).thenReturn(true);
            when(userRepository.findById(customerId)).thenReturn(Optional.of(testCustomer));
            when(facilityPolicyRepository.findByFacility_Id(testFacility.getId())).thenReturn(Optional.of(testPolicy));
            when(bookingRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

            BookingResponse response = bookingService.createBooking(request);

            assertThat(response).isNotNull();
            assertThat(response.getStatus()).isEqualTo(BookingStatus.PENDING_PAYMENT);
            assertThat(response.getAccessPin()).isNull();
            assertThat(response.getQrAccessToken()).isNull();
            assertThat(testUnit.getStatus()).isEqualTo(UnitStatus.RESERVED);

            verify(storageUnitLockService).tryLockUnit(eq(unitId), any(), eq(24L));
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

            when(storageUnitRepository.findWithDetailsById(unitId)).thenReturn(Optional.of(testUnit));
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

            when(storageUnitRepository.findWithDetailsById(unitId)).thenReturn(Optional.of(testUnit));
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

            when(storageUnitRepository.findWithDetailsById(unitId)).thenReturn(Optional.of(testUnit));
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

            when(storageUnitRepository.findWithDetailsById(unitId)).thenReturn(Optional.of(testUnit));

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

            when(storageUnitRepository.findWithDetailsById(unitId)).thenReturn(Optional.of(testUnit));
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

            when(storageUnitRepository.findWithDetailsById(unitId)).thenReturn(Optional.of(testUnit));
            when(storageUnitLockService.isUnitLocked(unitId)).thenReturn(false);
            when(facilityPolicyRepository.findByFacility_Id(testFacility.getId())).thenReturn(Optional.of(testPolicy));

            AppException ex = assertThrows(AppException.class, () -> bookingService.createBooking(request));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.BOOKING_MINIMUM_DURATION_INVALID);
        }
    }
}


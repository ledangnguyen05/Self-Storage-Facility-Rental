package com.boxora.service;

import com.boxora.dto.request.BookingCancelRequest;
import com.boxora.dto.request.BookingCreateRequest;
import com.boxora.dto.response.BookingCancelResponse;
import com.boxora.dto.response.StorageUnitResponse;
import com.boxora.dto.response.UnitAvailabilityResponse;
import com.boxora.entity.Booking;
import com.boxora.entity.Facility;
import com.boxora.entity.StorageUnit;
import com.boxora.entity.UnitType;
import com.boxora.entity.User;
import com.boxora.enums.ActivityAction;
import com.boxora.enums.BookingStatus;
import com.boxora.enums.FacilityStatus;
import com.boxora.enums.UnitStatus;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.repository.BookingRepository;
import com.boxora.repository.FacilityPolicyRepository;
import com.boxora.repository.FacilityRepository;
import com.boxora.repository.PaymentRepository;
import com.boxora.repository.RefundRequestRepository;
import com.boxora.repository.RentalContractRepository;
import com.boxora.repository.RoleRepository;
import com.boxora.repository.StorageUnitRepository;
import com.boxora.repository.UnitTypeRepository;
import com.boxora.repository.UserRepository;
import com.boxora.security.FacilityAccessGuard;
import com.boxora.security.RequestContext;
import com.boxora.service.impl.BookingCancellationServiceImpl;
import com.boxora.service.impl.BookingServiceImpl;
import com.boxora.service.impl.StorageUnitServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("Task 11: Inventory Availability & Booking Lifecycle Integration Tests")
class InventoryAvailabilityServiceTest {

    // StorageUnitService dependencies
    @Mock
    private StorageUnitRepository storageUnitRepository;
    @Mock
    private FacilityRepository facilityRepository;
    @Mock
    private FacilityPolicyRepository facilityPolicyRepository;
    @Mock
    private UnitTypeRepository unitTypeRepository;
    @Mock
    private BookingRepository bookingRepository;
    @Mock
    private RentalContractRepository rentalContractRepository;
    @Mock
    private FacilityAccessGuard facilityAccessGuard;
    @Mock
    private StorageUnitPriceHistoryService storageUnitPriceHistoryService;
    @Mock
    private ActivityLogService activityLogService;

    @InjectMocks
    private StorageUnitServiceImpl storageUnitService;

    // BookingCancellationService mocks
    @Mock
    private PaymentRepository paymentRepository;
    @Mock
    private RefundRequestRepository refundRequestRepository;
    @Mock
    private com.boxora.repository.HandoverRecordRepository handoverRecordRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private RequestContext requestContext;
    @Mock
    private StorageUnitLockService storageUnitLockService;
    @Mock
    private EmailService emailService;

    @InjectMocks
    private BookingCancellationServiceImpl cancellationService;

    private UUID facilityThuDucId;
    private UUID facilityD1Id;
    private UUID unitType3m2Id;
    private UUID unitType1m2Id;

    private Facility facilityThuDuc;
    private Facility facilityD1;
    private UnitType unitType3m2;
    private UnitType unitType1m2;

    @BeforeEach
    void setUp() {
        facilityThuDucId = UUID.randomUUID();
        facilityD1Id = UUID.randomUUID();
        unitType3m2Id = UUID.randomUUID();
        unitType1m2Id = UUID.randomUUID();

        facilityThuDuc = Facility.builder()
                .name("Boxora Thủ Đức")
                .address("123 Võ Văn Ngân, TP. Thủ Đức")
                .status(FacilityStatus.ACTIVE)
                .build();
        facilityThuDuc.setId(facilityThuDucId);

        facilityD1 = Facility.builder()
                .name("Boxora Quận 1")
                .address("45 Lê Thánh Tôn, Quận 1")
                .status(FacilityStatus.ACTIVE)
                .build();
        facilityD1.setId(facilityD1Id);

        unitType3m2 = UnitType.builder()
                .typeName("Kho Tiêu Chuẩn 3m²")
                .areaSqm(3.0)
                .basePricePerMonth(BigDecimal.valueOf(1500000))
                .build();
        unitType3m2.setId(unitType3m2Id);

        unitType1m2 = UnitType.builder()
                .typeName("Tủ Locker 1m²")
                .areaSqm(1.0)
                .basePricePerMonth(BigDecimal.valueOf(600000))
                .build();
        unitType1m2.setId(unitType1m2Id);

        lenient().when(facilityRepository.findById(facilityThuDucId)).thenReturn(Optional.of(facilityThuDuc));
        lenient().when(facilityRepository.findById(facilityD1Id)).thenReturn(Optional.of(facilityD1));
        lenient().when(unitTypeRepository.findById(unitType3m2Id)).thenReturn(Optional.of(unitType3m2));
        lenient().when(unitTypeRepository.findById(unitType1m2Id)).thenReturn(Optional.of(unitType1m2));
    }

    @Nested
    @DisplayName("1. Authoritative Inventory Availability Calculations")
    class AvailabilityCalculationTests {

        @Test
        @DisplayName("TC-INV-01: Ban đầu có 2 buồng AVAILABLE, 0 đơn chưa gán -> Available = 2")
        void initialAvailability_TwoUnits_ZeroHoldings_ReturnsTwo() {
            when(storageUnitRepository.countByFacility_IdAndUnitType_IdAndStatus(facilityThuDucId, unitType3m2Id, UnitStatus.AVAILABLE))
                    .thenReturn(2L);
            when(storageUnitRepository.countByFacility_IdAndUnitType_Id(facilityThuDucId, unitType3m2Id))
                    .thenReturn(2L);
            when(bookingRepository.countUnassignedHoldingBookings(eq(facilityThuDucId), eq(unitType3m2Id), any(), any()))
                    .thenReturn(0L);

            long available = storageUnitService.getAvailableUnitsCount(facilityThuDucId, unitType3m2Id);
            assertEquals(2L, available);

            UnitAvailabilityResponse dto = storageUnitService.getUnitAvailability(facilityThuDucId, unitType3m2Id);
            assertEquals(2L, dto.getTotalUnits());
            assertEquals(2L, dto.getPhysicalAvailableUnits());
            assertEquals(0L, dto.getUnassignedHoldingBookings());
            assertEquals(2L, dto.getAvailableUnits());
        }

        @Test
        @DisplayName("TC-INV-02: Khách A hoàn tất đặt wizard -> 1 đơn chưa gán -> Available giảm từ 2 xuống 1")
        void customerABooksWizard_DecreasesAvailableToOne() {
            when(storageUnitRepository.countByFacility_IdAndUnitType_IdAndStatus(facilityThuDucId, unitType3m2Id, UnitStatus.AVAILABLE))
                    .thenReturn(2L);
            when(storageUnitRepository.countByFacility_IdAndUnitType_Id(facilityThuDucId, unitType3m2Id))
                    .thenReturn(2L);
            // 1 unassigned booking holding a slot
            when(bookingRepository.countUnassignedHoldingBookings(eq(facilityThuDucId), eq(unitType3m2Id), any(), any()))
                    .thenReturn(1L);

            long available = storageUnitService.getAvailableUnitsCount(facilityThuDucId, unitType3m2Id);
            assertEquals(1L, available);

            UnitAvailabilityResponse dto = storageUnitService.getUnitAvailability(facilityThuDucId, unitType3m2Id);
            assertEquals(1L, dto.getAvailableUnits());
            assertEquals(1L, dto.getUnassignedHoldingBookings());
        }

        @Test
        @DisplayName("TC-INV-03: Khách B hoàn tất đặt wizard -> 2 đơn chưa gán -> Available giảm xuống 0 (hết kho)")
        void customerBBooksWizard_DecreasesAvailableToZero() {
            when(storageUnitRepository.countByFacility_IdAndUnitType_IdAndStatus(facilityThuDucId, unitType3m2Id, UnitStatus.AVAILABLE))
                    .thenReturn(2L);
            when(storageUnitRepository.countByFacility_IdAndUnitType_Id(facilityThuDucId, unitType3m2Id))
                    .thenReturn(2L);
            // 2 unassigned bookings holding 2 slots
            when(bookingRepository.countUnassignedHoldingBookings(eq(facilityThuDucId), eq(unitType3m2Id), any(), any()))
                    .thenReturn(2L);

            long available = storageUnitService.getAvailableUnitsCount(facilityThuDucId, unitType3m2Id);
            assertEquals(0L, available);

            UnitAvailabilityResponse dto = storageUnitService.getUnitAvailability(facilityThuDucId, unitType3m2Id);
            assertEquals(0L, dto.getAvailableUnits());
        }

        @Test
        @DisplayName("TC-INV-04: Bounds Clamping: Nếu đơn ảo vượt quá physical available, available = 0 (không âm)")
        void boundsClamping_NeverNegative() {
            when(storageUnitRepository.countByFacility_IdAndUnitType_IdAndStatus(facilityThuDucId, unitType3m2Id, UnitStatus.AVAILABLE))
                    .thenReturn(2L);
            when(storageUnitRepository.countByFacility_IdAndUnitType_Id(facilityThuDucId, unitType3m2Id))
                    .thenReturn(2L);
            // 5 unassigned bookings (edge condition)
            when(bookingRepository.countUnassignedHoldingBookings(eq(facilityThuDucId), eq(unitType3m2Id), any(), any()))
                    .thenReturn(5L);

            long available = storageUnitService.getAvailableUnitsCount(facilityThuDucId, unitType3m2Id);
            assertEquals(0L, available, "Available units must clamp to 0 and never be negative");
        }

        @Test
        @DisplayName("TC-INV-05: Maintenance & Occupied units do not count as physical available")
        void maintenanceAndOccupiedUnits_ExcludedFromAvailable() {
            // Out of 4 total units: 2 AVAILABLE, 1 OCCUPIED, 1 UNDER_MAINTENANCE
            when(storageUnitRepository.countByFacility_IdAndUnitType_IdAndStatus(facilityThuDucId, unitType3m2Id, UnitStatus.AVAILABLE))
                    .thenReturn(2L);
            when(storageUnitRepository.countByFacility_IdAndUnitType_Id(facilityThuDucId, unitType3m2Id))
                    .thenReturn(4L);
            when(bookingRepository.countUnassignedHoldingBookings(eq(facilityThuDucId), eq(unitType3m2Id), any(), any()))
                    .thenReturn(0L);

            UnitAvailabilityResponse dto = storageUnitService.getUnitAvailability(facilityThuDucId, unitType3m2Id);
            assertEquals(4L, dto.getTotalUnits());
            assertEquals(2L, dto.getPhysicalAvailableUnits());
            assertEquals(2L, dto.getAvailableUnits());
        }
    }

    @Nested
    @DisplayName("2. Scoping & Isolation Tests (Facility & Unit Type)")
    class ScopingAndIsolationTests {

        @Test
        @DisplayName("TC-INV-06: Đặt kho tại Thủ Đức không làm giảm kho tại Quận 1 (Facility Isolation)")
        void facilityIsolation_ThuDucBookingDoesNotAffectDistrict1() {
            // Thủ Đức has 1 booking holding a slot (2 - 1 = 1)
            when(storageUnitRepository.countByFacility_IdAndUnitType_IdAndStatus(facilityThuDucId, unitType3m2Id, UnitStatus.AVAILABLE))
                    .thenReturn(2L);
            when(storageUnitRepository.countByFacility_IdAndUnitType_Id(facilityThuDucId, unitType3m2Id))
                    .thenReturn(2L);
            when(bookingRepository.countUnassignedHoldingBookings(eq(facilityThuDucId), eq(unitType3m2Id), any(), any()))
                    .thenReturn(1L);

            // Quận 1 has 0 bookings holding slots (2 - 0 = 2)
            when(storageUnitRepository.countByFacility_IdAndUnitType_IdAndStatus(facilityD1Id, unitType3m2Id, UnitStatus.AVAILABLE))
                    .thenReturn(2L);
            when(storageUnitRepository.countByFacility_IdAndUnitType_Id(facilityD1Id, unitType3m2Id))
                    .thenReturn(2L);
            when(bookingRepository.countUnassignedHoldingBookings(eq(facilityD1Id), eq(unitType3m2Id), any(), any()))
                    .thenReturn(0L);

            long thuDucAvailable = storageUnitService.getAvailableUnitsCount(facilityThuDucId, unitType3m2Id);
            long d1Available = storageUnitService.getAvailableUnitsCount(facilityD1Id, unitType3m2Id);

            assertEquals(1L, thuDucAvailable);
            assertEquals(2L, d1Available, "District 1 inventory must remain 2, isolated from Thu Duc bookings");
        }

        @Test
        @DisplayName("TC-INV-07: Đặt kho 3m² không làm giảm kho Locker 1m² cùng cơ sở (Unit Type Isolation)")
        void unitTypeIsolation_3m2BookingDoesNotAffect1m2() {
            // Kho 3m2 has 1 booking holding (2 - 1 = 1)
            when(storageUnitRepository.countByFacility_IdAndUnitType_IdAndStatus(facilityThuDucId, unitType3m2Id, UnitStatus.AVAILABLE))
                    .thenReturn(2L);
            when(storageUnitRepository.countByFacility_IdAndUnitType_Id(facilityThuDucId, unitType3m2Id))
                    .thenReturn(2L);
            when(bookingRepository.countUnassignedHoldingBookings(eq(facilityThuDucId), eq(unitType3m2Id), any(), any()))
                    .thenReturn(1L);

            // Locker 1m2 has 0 bookings holding (3 - 0 = 3)
            when(storageUnitRepository.countByFacility_IdAndUnitType_IdAndStatus(facilityThuDucId, unitType1m2Id, UnitStatus.AVAILABLE))
                    .thenReturn(3L);
            when(storageUnitRepository.countByFacility_IdAndUnitType_Id(facilityThuDucId, unitType1m2Id))
                    .thenReturn(3L);
            when(bookingRepository.countUnassignedHoldingBookings(eq(facilityThuDucId), eq(unitType1m2Id), any(), any()))
                    .thenReturn(0L);

            long count3m2 = storageUnitService.getAvailableUnitsCount(facilityThuDucId, unitType3m2Id);
            long count1m2 = storageUnitService.getAvailableUnitsCount(facilityThuDucId, unitType1m2Id);

            assertEquals(1L, count3m2);
            assertEquals(3L, count1m2, "Locker 1m2 inventory must remain 3, isolated from 3m2 bookings");
        }
    }

    @Nested
    @DisplayName("3. Public Query Virtual Reservation & Staff Physical Assignment")
    class PublicQueryAndAssignmentTests {

        @Test
        @DisplayName("TC-INV-08: Public GET /units ảo hóa RESERVED cho các slot đang được giữ chỗ")
        void publicGetUnits_DynamicallyReservesHeldSlots() {
            StorageUnit u1 = StorageUnit.builder().unitCode("TD-301").facility(facilityThuDuc).unitType(unitType3m2).status(UnitStatus.AVAILABLE).build();
            u1.setId(UUID.randomUUID());
            StorageUnit u2 = StorageUnit.builder().unitCode("TD-302").facility(facilityThuDuc).unitType(unitType3m2).status(UnitStatus.AVAILABLE).build();
            u2.setId(UUID.randomUUID());

            when(facilityAccessGuard.isFacilityScoped()).thenReturn(false);
            when(storageUnitRepository.findByFacility_Id(facilityThuDucId)).thenReturn(List.of(u1, u2));
            when(facilityPolicyRepository.findByIsActiveTrue()).thenReturn(Collections.emptyList());

            // 1 unassigned booking holding a slot
            List<Object[]> groupedHoldings = new java.util.ArrayList<>();
            groupedHoldings.add(new Object[]{facilityThuDucId, unitType3m2Id, 1L});
            when(bookingRepository.countAllUnassignedHoldingGroupedByFacilityAndUnitType(any(), any()))
                    .thenReturn(groupedHoldings);

            // Call public getUnits (forAssignment = false)
            List<StorageUnitResponse> responses = storageUnitService.getUnits(
                    facilityThuDucId, null, null, false
            );

            assertThat(responses).hasSize(2);
            long availableResponses = responses.stream().filter(r -> "AVAILABLE".equals(r.getStatus())).count();
            long reservedResponses = responses.stream().filter(r -> "RESERVED".equals(r.getStatus())).count();

            assertEquals(1L, availableResponses, "One unit should remain AVAILABLE");
            assertEquals(1L, reservedResponses, "One unit should be dynamically marked RESERVED for customer view");
        }

        @Test
        @DisplayName("TC-INV-09: Staff Handover Modal GET /units với forAssignment=true trả về kho vật lý thực tế")
        void staffGetUnits_ForAssignmentTrue_ReturnsPhysicalAvailable() {
            StorageUnit u1 = StorageUnit.builder().unitCode("TD-301").facility(facilityThuDuc).unitType(unitType3m2).status(UnitStatus.AVAILABLE).build();
            u1.setId(UUID.randomUUID());
            StorageUnit u2 = StorageUnit.builder().unitCode("TD-302").facility(facilityThuDuc).unitType(unitType3m2).status(UnitStatus.AVAILABLE).build();
            u2.setId(UUID.randomUUID());

            when(facilityAccessGuard.isFacilityScoped()).thenReturn(false);
            when(storageUnitRepository.findByFacility_Id(facilityThuDucId)).thenReturn(List.of(u1, u2));
            when(facilityPolicyRepository.findByIsActiveTrue()).thenReturn(Collections.emptyList());

            // Call staff getUnits with forAssignment = true
            List<StorageUnitResponse> responses = storageUnitService.getUnits(
                    facilityThuDucId, null, null, true
            );

            assertThat(responses).hasSize(2);
            long availableResponses = responses.stream().filter(r -> "AVAILABLE".equals(r.getStatus())).count();
            assertEquals(2L, availableResponses, "Staff assignment modal must see both physical AVAILABLE units for selection");
        }
    }

    @Nested
    @DisplayName("5. Concurrency & Booking Creation Guards (Pessimistic Lock & Zero Availability)")
    class ConcurrencyAndBookingCreationGuards {

        @Mock
        private StorageUnitLockService lockService;
        @Mock
        private ActivityLogService actLogService;
        @Mock
        private PaymentRepository payRepo;
        @Mock
        private FacilityAccessGuard facGuard;
        @Mock
        private EncryptionService encService;
        @Mock
        private PricingService priceService;
        @Mock
        private RequestContext reqContext;
        @Mock
        private ObjectProvider<ContractSigningService> contractSigningProv;
        @Mock
        private com.boxora.repository.BookingRescheduleHistoryRepository rescheduleRepo;
        @Mock
        private com.boxora.repository.StaffAssignmentRepository staffAssignRepo;
        @Mock
        private RoleRepository roleRepo;
        @Mock
        private EmailService mailService;
        @Mock
        private RefundRequestRepository refundRequestRepo;
        @Mock
        private ObjectProvider<StorageUnitService> storageUnitProv;

        private BookingServiceImpl bookingService;

        @BeforeEach
        void initBookingService() {
            when(storageUnitProv.getObject()).thenReturn(storageUnitService);

            bookingService = new BookingServiceImpl(
                    bookingRepository,
                    storageUnitRepository,
                    userRepository,
                    facilityPolicyRepository,
                    lockService,
                    actLogService,
                    payRepo,
                    refundRequestRepo,
                    facGuard,
                    encService,
                    priceService,
                    reqContext,
                    contractSigningProv,
                    rescheduleRepo,
                    rentalContractRepository,
                    staffAssignRepo,
                    facilityRepository,
                    unitTypeRepository,
                    roleRepo,
                    mailService,
                    storageUnitProv
            );
        }

        @Test
        @DisplayName("TC-INV-13: Chặn đặt chỗ khi availableCount <= 0 và sử dụng Pessimistic Lock trên UnitType")
        void createBooking_ZeroAvailable_ThrowsStorageUnitNotAvailableAndUsesPessimisticLock() {
            BookingCreateRequest request = BookingCreateRequest.builder()
                    .facilityId(facilityThuDucId)
                    .unitTypeId(unitType3m2Id)
                    .startDate(LocalDate.now().plusDays(2))
                    .rentalMonths(1)
                    .customerName("Trần Văn Test")
                    .customerPhone("0987654321")
                    .customerEmail("test@boxora.com")
                    .build();

            when(facilityRepository.findById(facilityThuDucId)).thenReturn(Optional.of(facilityThuDuc));
            when(unitTypeRepository.findByIdForUpdate(unitType3m2Id)).thenReturn(Optional.of(unitType3m2));

            // Available units count is 0
            when(storageUnitRepository.countByFacility_IdAndUnitType_IdAndStatus(facilityThuDucId, unitType3m2Id, UnitStatus.AVAILABLE))
                    .thenReturn(2L);
            when(storageUnitRepository.countByFacility_IdAndUnitType_Id(facilityThuDucId, unitType3m2Id))
                    .thenReturn(2L);
            when(bookingRepository.countUnassignedHoldingBookings(eq(facilityThuDucId), eq(unitType3m2Id), any(), any()))
                    .thenReturn(2L);

            AppException ex = assertThrows(AppException.class, () -> bookingService.createBooking(request));

            assertEquals(ErrorCode.STORAGE_UNIT_NOT_AVAILABLE, ex.getErrorCode());
            assertThat(ex.getMessage()).contains("hết buồng kho khả dụng");

            // Verify pessimistic write lock was acquired on unitType
            verify(unitTypeRepository, times(1)).findByIdForUpdate(unitType3m2Id);
        }
    }

    @Nested
    @DisplayName("4. Booking Cancellation & Slot Release Lifecycle")
    class CancellationLifecycleTests {

        @Test
        @DisplayName("TC-INV-10: Hủy đơn đặt chỗ chưa gán kho (unit == null) giải phóng 1 slot khả dụng")
        void cancelUnassignedBooking_ReleasesSlot() {
            ReflectionTestUtils.setField(cancellationService, "defaultPendingPaymentTimeoutMinutes", 15);

            UUID bookingId = UUID.randomUUID();
            UUID customerId = UUID.randomUUID();
            User customer = User.builder().fullName("Nguyễn Khách").build();
            customer.setId(customerId);

            Booking booking = Booking.builder()
                    .bookingCode("BX-2025-1111")
                    .facility(facilityThuDuc)
                    .unitType(unitType3m2)
                    .storageUnit(null) // Unassigned booking
                    .customer(customer)
                    .status(BookingStatus.PENDING_CONTACT)
                    .startDate(LocalDate.now().plusDays(3))
                    .rentalMonths(2)
                    .totalRentalFee(BigDecimal.valueOf(3000000))
                    .depositPaid(BigDecimal.ZERO)
                    .depositAmount(BigDecimal.valueOf(1500000))
                    .build();
            booking.setId(bookingId);

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(booking));
            when(rentalContractRepository.findByBookingId(bookingId)).thenReturn(Optional.empty());
            when(bookingRepository.save(any(Booking.class))).thenAnswer(i -> i.getArgument(0));

            BookingCancelRequest request = BookingCancelRequest.builder()
                    .cancellationReason("Thay đổi kế hoạch")
                    .build();

            BookingCancelResponse response = cancellationService.cancelBooking(bookingId, request);

            assertNotNull(response);
            assertEquals(BookingStatus.CANCELLED, response.getStatus());
            assertThat(response.isUnitReleased()).isTrue();

            // Verify activity log recorded cancellation and unassigned slot release
            verify(activityLogService).record(
                    eq(facilityThuDucId),
                    eq(ActivityAction.RESERVATION_CANCEL),
                    eq("Booking"),
                    eq(bookingId),
                    anyString(),
                    eq(BookingStatus.PENDING_CONTACT),
                    eq(BookingStatus.CANCELLED)
            );
            verify(activityLogService).record(
                    eq(facilityThuDucId),
                    eq(ActivityAction.STORAGE_UNIT_RELEASE),
                    eq("Booking"),
                    eq(bookingId),
                    contains("về kho khả dụng"),
                    isNull(),
                    eq(UnitStatus.AVAILABLE)
            );
        }

        @Test
        @DisplayName("TC-INV-11: Idempotency: Không cho phép hủy đơn đã ở trạng thái CANCELLED")
        void cancelAlreadyCancelledBooking_ThrowsAppException() {
            UUID bookingId = UUID.randomUUID();
            Booking booking = Booking.builder()
                    .bookingCode("BX-2025-2222")
                    .status(BookingStatus.CANCELLED)
                    .build();
            booking.setId(bookingId);

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(booking));

            BookingCancelRequest request = BookingCancelRequest.builder().cancellationReason("Hủy lần 2").build();

            AppException ex = assertThrows(AppException.class, () -> cancellationService.cancelBooking(bookingId, request));
            assertEquals(ErrorCode.BOOKING_ALREADY_CANCELLED, ex.getErrorCode());
        }

        @Test
        @DisplayName("TC-INV-12: Không cho phép hủy đơn đã ACTIVE (đã nhận kho check-in)")
        void cancelActiveBooking_ThrowsAppException() {
            UUID bookingId = UUID.randomUUID();
            Booking booking = Booking.builder()
                    .bookingCode("BX-2025-3333")
                    .status(BookingStatus.ACTIVE)
                    .build();
            booking.setId(bookingId);

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(booking));

            BookingCancelRequest request = BookingCancelRequest.builder().cancellationReason("Khách muốn hủy khi đang thuê").build();

            AppException ex = assertThrows(AppException.class, () -> cancellationService.cancelBooking(bookingId, request));
            assertEquals(ErrorCode.BOOKING_CANNOT_BE_CANCELLED, ex.getErrorCode());
        }
    }
}

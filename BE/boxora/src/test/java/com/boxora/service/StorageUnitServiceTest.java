package com.boxora.service;

import com.boxora.dto.request.StorageUnitCreateRequest;
import com.boxora.dto.request.StorageUnitUpdateRequest;
import com.boxora.dto.response.StorageUnitResponse;
import com.boxora.entity.Booking;
import com.boxora.entity.Facility;
import com.boxora.entity.FacilityPolicy;
import com.boxora.entity.FacilityPolicyPrice;
import com.boxora.entity.RentalContract;
import com.boxora.entity.StorageUnit;
import com.boxora.entity.UnitType;
import com.boxora.entity.User;
import com.boxora.enums.BookingStatus;
import com.boxora.enums.FacilityStatus;
import com.boxora.enums.RentalContractStatus;
import com.boxora.enums.UnitStatus;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.repository.BookingRepository;
import com.boxora.repository.FacilityPolicyRepository;
import com.boxora.repository.FacilityRepository;
import com.boxora.repository.RentalContractRepository;
import com.boxora.repository.StorageUnitRepository;
import com.boxora.repository.UnitTypeRepository;
import com.boxora.security.FacilityAccessGuard;
import com.boxora.security.RequestContext;
import com.boxora.service.impl.StorageUnitServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StorageUnitServiceTest {

    @Mock private StorageUnitRepository storageUnitRepository;
    @Mock private FacilityRepository facilityRepository;
    @Mock private FacilityPolicyRepository facilityPolicyRepository;
    @Mock private UnitTypeRepository unitTypeRepository;
    @Mock private BookingRepository bookingRepository;
    @Mock private RentalContractRepository rentalContractRepository;
    @Mock private FacilityAccessGuard facilityAccessGuard;
    @Mock private StorageUnitPriceHistoryService priceHistoryService;
    @Mock private ActivityLogService activityLogService;
    @Mock private RequestContext requestContext;

    private StorageUnitServiceImpl service;

    private Facility activeFacility;
    private Facility pausedFacility;
    private UnitType unitType;
    private StorageUnit available;
    private StorageUnit occupied;
    private StorageUnit locked;
    private StorageUnit inPausedFacility;

    @BeforeEach
    void setUp() {
        service = new StorageUnitServiceImpl(storageUnitRepository, facilityRepository, facilityPolicyRepository,
                unitTypeRepository, bookingRepository, rentalContractRepository, facilityAccessGuard,
                priceHistoryService, activityLogService, requestContext);

        activeFacility = Facility.builder().name("Boxora District 1").code("HCM-D1").address("123 Nguyen Hue").build();
        activeFacility.setId(UUID.randomUUID());
        pausedFacility = Facility.builder().name("Boxora Bao Tri").code("HCM-BT").address("1 Test").status(FacilityStatus.MAINTENANCE).build();
        pausedFacility.setId(UUID.randomUUID());

        unitType = UnitType.builder().typeName("Standard (1-Bedroom)").areaSqm(6.0)
                .basePricePerMonth(new BigDecimal("2400000")).depositAmount(new BigDecimal("2400000")).build();
        unitType.setId(UUID.randomUUID());

        available = unit("D1-A101", UnitStatus.AVAILABLE, activeFacility, "2400000");
        occupied = unit("D1-A102", UnitStatus.OCCUPIED, activeFacility, "2400000");
        locked = unit("D1-A103", UnitStatus.OVERDUE_LOCKED, activeFacility, "2400000");
        inPausedFacility = unit("BT-A101", UnitStatus.AVAILABLE, pausedFacility, "1000000");

        lenient().when(facilityPolicyRepository.findByIsActiveTrue()).thenReturn(List.of());
        lenient().when(storageUnitRepository.findAllWithDetails())
                .thenReturn(List.of(available, occupied, locked, inPausedFacility));
        lenient().when(facilityAccessGuard.isFacilityScoped()).thenReturn(false);
    }

    private StorageUnit unit(String code, UnitStatus status, Facility facility, String price) {
        StorageUnit unit = StorageUnit.builder()
                .unitCode(code).floorLevel("Floor 1").status(status)
                .facility(facility).unitType(unitType).pricePerMonth(new BigDecimal(price))
                .build();
        unit.setId(UUID.randomUUID());
        return unit;
    }

    private RentalContract contractFor(StorageUnit unit) {
        User customer = User.builder().username("tenant").fullName("Tran Minh Tuan").email("tenant@boxora.vn").build();
        customer.setId(UUID.randomUUID());
        Booking booking = Booking.builder().bookingCode("BX-2026-0001").customer(customer).storageUnit(unit)
                .status(BookingStatus.ACTIVE).startDate(LocalDate.of(2026, 3, 1)).endDate(LocalDate.of(2026, 9, 1)).build();
        booking.setId(UUID.randomUUID());
        RentalContract contract = RentalContract.builder().contractCode("CTR-2026-1001").customer(customer).unit(unit)
                .booking(booking).status(RentalContractStatus.ACTIVE)
                .startDate(LocalDate.of(2026, 3, 1)).endDate(LocalDate.of(2026, 9, 1)).build();
        contract.setId(UUID.randomUUID());
        return contract;
    }

    @Test
    @DisplayName("Anonymous callers never receive tenant, contract or booking data, trigger no tenancy queries and see only ACTIVE facilities")
    void anonymousGetsSlimUnits() {
        when(requestContext.currentUserRole()).thenReturn(null);

        List<StorageUnitResponse> result = service.getUnits(null, null, null, false);

        assertThat(result).hasSize(3);
        assertThat(result).extracting(StorageUnitResponse::getUnitCode).doesNotContain("BT-A101");
        assertThat(result).allSatisfy(unit -> {
            assertThat(unit.getTenantName()).isNull();
            assertThat(unit.getContractCode()).isNull();
            assertThat(unit.getContractId()).isNull();
            assertThat(unit.getBookingId()).isNull();
            assertThat(unit.getBookingCode()).isNull();
            assertThat(unit.getStartDate()).isNull();
            assertThat(unit.getDueDate()).isNull();
        });
        verify(rentalContractRepository, never()).findCurrentTenancyByUnitIds(any());
        verify(bookingRepository, never()).findCurrentTenancyByUnitIds(any());
    }

    @Test
    @DisplayName("Customers get the same slim view as anonymous visitors")
    void customerGetsSlimUnits() {
        when(requestContext.currentUserRole()).thenReturn("CUSTOMER");
        List<StorageUnitResponse> result = service.getUnits(null, null, null, false);
        assertThat(result).allSatisfy(unit -> assertThat(unit.getTenantName()).isNull());
        verify(rentalContractRepository, never()).findCurrentTenancyByUnitIds(any());
    }

    @Test
    @DisplayName("Staff see the current tenant, resolved with two batch queries instead of one query per unit")
    void staffSeeTenantWithBatchQueries() {
        when(requestContext.currentUserRole()).thenReturn("FACILITY_MANAGER");
        RentalContract contract = contractFor(occupied);
        when(rentalContractRepository.findCurrentTenancyByUnitIds(any())).thenReturn(List.of(contract));
        when(bookingRepository.findCurrentTenancyByUnitIds(any())).thenReturn(List.of(contract.getBooking()));

        List<StorageUnitResponse> result = service.getUnits(null, null, null, false);

        StorageUnitResponse row = result.stream().filter(u -> "D1-A102".equals(u.getUnitCode())).findFirst().orElseThrow();
        assertThat(row.getTenantName()).isEqualTo("Tran Minh Tuan");
        assertThat(row.getContractCode()).isEqualTo("CTR-2026-1001");
        assertThat(row.getBookingCode()).isEqualTo("BX-2026-0001");
        assertThat(row.getDueDate()).isEqualTo("2026-09-01");

        StorageUnitResponse free = result.stream().filter(u -> "D1-A101".equals(u.getUnitCode())).findFirst().orElseThrow();
        assertThat(free.getTenantName()).isNull();

        // internal view keeps the real status
        assertThat(result.stream().filter(u -> "D1-A103".equals(u.getUnitCode())).findFirst().orElseThrow().getStatus())
                .isEqualTo("OVERDUE_LOCKED");

        verify(rentalContractRepository, times(1)).findCurrentTenancyByUnitIds(any());
        verify(bookingRepository, times(1)).findCurrentTenancyByUnitIds(any());
    }

    @Test
    @DisplayName("A re-reserved unit without a contract shows no contract code and never reuses the booking code as one")
    void noContractMeansNoContractCode() {
        when(requestContext.currentUserRole()).thenReturn("STAFF");
        occupied.setStatus(UnitStatus.RESERVED);
        RentalContract contract = contractFor(occupied);
        when(rentalContractRepository.findCurrentTenancyByUnitIds(any())).thenReturn(List.of());
        when(bookingRepository.findCurrentTenancyByUnitIds(any())).thenReturn(List.of(contract.getBooking()));

        StorageUnitResponse row = service.getUnits(null, null, null, false).stream()
                .filter(u -> "D1-A102".equals(u.getUnitCode())).findFirst().orElseThrow();

        assertThat(row.getContractCode()).isNull();
        assertThat(row.getBookingCode()).isEqualTo("BX-2026-0001");
        assertThat(row.getTenantName()).isEqualTo("Tran Minh Tuan");
    }

    @Test
    @DisplayName("Public scope lists every unit of ACTIVE facilities, shows locked units as occupied and ignores staff facility scoping")
    void publicScopeShowsOccupiedMarkedUnits() {
        // Even a signed-in staff member gets the public view when scope=public is requested
        lenient().when(requestContext.currentUserRole()).thenReturn("STAFF");

        List<StorageUnitResponse> result = service.getUnits(null, null, null, true);

        assertThat(result).extracting(StorageUnitResponse::getUnitCode).containsExactlyInAnyOrder("D1-A101", "D1-A102", "D1-A103");
        assertThat(result.stream().filter(u -> "D1-A103".equals(u.getUnitCode())).findFirst().orElseThrow().getStatus())
                .isEqualTo("OCCUPIED");
        assertThat(result).allSatisfy(unit -> assertThat(unit.getTenantName()).isNull());
        verify(facilityAccessGuard, never()).scopedFacilityIdOrNull();
        verify(rentalContractRepository, never()).findCurrentTenancyByUnitIds(any());
    }

    @Test
    @DisplayName("Public status filter OCCUPIED also returns units locked for overdue")
    void publicStatusFilterMatchesLockedAsOccupied() {
        List<StorageUnitResponse> result = service.getUnits(null, null, "OCCUPIED", true);
        assertThat(result).extracting(StorageUnitResponse::getUnitCode).containsExactlyInAnyOrder("D1-A102", "D1-A103");
    }

    @Test
    @DisplayName("Listed price and deposit follow the facility price list and deposit percentage (same rule as the quote)")
    void listedPriceUsesFacilityPolicy() {
        FacilityPolicy policy = FacilityPolicy.builder().facility(activeFacility).depositPercentage(50.0).build();
        policy.getPrices().add(FacilityPolicyPrice.builder().facilityPolicy(policy).unitType(unitType)
                .monthlyPrice(new BigDecimal("2000000")).build());
        when(facilityPolicyRepository.findByIsActiveTrue()).thenReturn(List.of(policy));

        StorageUnitResponse row = service.getUnits(null, null, "AVAILABLE", true).stream()
                .filter(u -> "D1-A101".equals(u.getUnitCode())).findFirst().orElseThrow();

        assertThat(row.getPricePerMonth()).isEqualByComparingTo("2000000");
        assertThat(row.getDepositAmount()).isEqualByComparingTo("1000000");
        assertThat(row.getAreaSqMeters()).isEqualTo(6.0);
    }

    @Test
    @DisplayName("The response no longer carries any fabricated lock telemetry")
    void noFabricatedLockTelemetry() {
        assertThat(StorageUnitResponse.class.getDeclaredFields())
                .extracting(java.lang.reflect.Field::getName)
                .doesNotContain("batteryLevel", "smartLockSerial", "lastAccessTime");
    }

    @Test
    @DisplayName("getById returns the slim view for anonymous callers")
    void getByIdSlimForAnonymous() {
        when(requestContext.currentUserRole()).thenReturn(null);
        when(storageUnitRepository.findWithDetailsById(occupied.getId())).thenReturn(Optional.of(occupied));
        when(facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(any())).thenReturn(Optional.empty());

        StorageUnitResponse row = service.getById(occupied.getId());
        assertThat(row.getTenantName()).isNull();
        verify(rentalContractRepository, never()).findCurrentTenancyByUnitIds(any());
    }

    // ------------------------------------------------------------------ availability reflects live bookings

    @Test
    @DisplayName("A unit recorded AVAILABLE that holds a PENDING_PAYMENT booking is listed as RESERVED and never matches the AVAILABLE filter")
    void liveBookingMakesAvailableUnitReserved() {
        lenient().when(requestContext.currentUserRole()).thenReturn(null);
        when(bookingRepository.findLiveBookingStatusesByUnitIds(any())).thenReturn(List.<Object[]>of(
                new Object[]{available.getId(), BookingStatus.PENDING_PAYMENT}));

        List<StorageUnitResponse> all = service.getUnits(null, null, null, true);
        assertThat(all.stream().filter(u -> "D1-A101".equals(u.getUnitCode())).findFirst().orElseThrow().getStatus())
                .isEqualTo("RESERVED");

        assertThat(service.getUnits(null, null, "AVAILABLE", true)).isEmpty();
        assertThat(service.getUnits(null, null, "RESERVED", true))
                .extracting(StorageUnitResponse::getUnitCode).containsExactly("D1-A101");
    }

    @Test
    @DisplayName("A running or overdue booking on an AVAILABLE-recorded unit shows it as occupied (strongest live booking wins)")
    void strongestLiveBookingWins() {
        lenient().when(requestContext.currentUserRole()).thenReturn("FACILITY_MANAGER");
        when(bookingRepository.findLiveBookingStatusesByUnitIds(any())).thenReturn(List.<Object[]>of(
                new Object[]{available.getId(), BookingStatus.CONFIRMED},
                new Object[]{available.getId(), BookingStatus.OVERDUE}));

        StorageUnitResponse row = service.getUnits(null, null, null, false).stream()
                .filter(u -> "D1-A101".equals(u.getUnitCode())).findFirst().orElseThrow();

        assertThat(row.getStatus()).isEqualTo("OVERDUE_LOCKED");
    }

    @Test
    @DisplayName("Only AVAILABLE-recorded units are checked for live bookings, in a single batch query")
    void liveBookingLookupIsOneBatchForAvailableUnitsOnly() {
        lenient().when(requestContext.currentUserRole()).thenReturn(null);

        service.getUnits(null, null, null, true);

        org.mockito.ArgumentCaptor<java.util.Collection<UUID>> ids = org.mockito.ArgumentCaptor.forClass(java.util.Collection.class);
        verify(bookingRepository, times(1)).findLiveBookingStatusesByUnitIds(ids.capture());
        assertThat(ids.getValue()).containsExactly(available.getId());
    }

    @Test
    @DisplayName("Staff see the tenant of an AVAILABLE-recorded unit that already holds a live booking")
    void staffSeeTenantOfDriftedUnit() {
        when(requestContext.currentUserRole()).thenReturn("STAFF");
        RentalContract contract = contractFor(available);
        contract.getBooking().setStatus(BookingStatus.PENDING_PAYMENT);
        when(bookingRepository.findLiveBookingStatusesByUnitIds(any())).thenReturn(List.<Object[]>of(
                new Object[]{available.getId(), BookingStatus.PENDING_PAYMENT}));
        when(rentalContractRepository.findCurrentTenancyByUnitIds(any())).thenReturn(List.of());
        when(bookingRepository.findCurrentTenancyByUnitIds(any())).thenReturn(List.of(contract.getBooking()));

        StorageUnitResponse row = service.getUnits(null, null, null, false).stream()
                .filter(u -> "D1-A101".equals(u.getUnitCode())).findFirst().orElseThrow();

        assertThat(row.getStatus()).isEqualTo("RESERVED");
        assertThat(row.getBookingCode()).isEqualTo("BX-2026-0001");
        assertThat(row.getTenantName()).isEqualTo("Tran Minh Tuan");
    }

    @Test
    @DisplayName("Customers browsing the rent tab (not public scope) still never see units of a facility under maintenance")
    void customerListHidesInactiveFacilities() {
        when(requestContext.currentUserRole()).thenReturn("CUSTOMER");

        List<StorageUnitResponse> result = service.getUnits(null, null, "AVAILABLE", false);

        assertThat(result).extracting(StorageUnitResponse::getUnitCode).containsExactly("D1-A101");
    }

    @Test
    @DisplayName("Staff keep seeing every unit of their facility, even when the facility is not ACTIVE")
    void staffStillSeeUnitsOfPausedFacility() {
        when(requestContext.currentUserRole()).thenReturn("FACILITY_MANAGER");

        List<StorageUnitResponse> result = service.getUnits(null, null, null, false);

        assertThat(result).extracting(StorageUnitResponse::getUnitCode).contains("BT-A101");
    }

    // ------------------------------------------------------------------ floor labels

    @Test
    @DisplayName("Floor filter and response treat 'Floor 1', 'Tang 1' and 'Tầng 1' as the same floor and always return 'Tầng 1'")
    void floorLabelsAreNormalised() {
        available.setFloorLevel("Floor 1");
        occupied.setFloorLevel("Tầng 1");
        locked.setFloorLevel("tang 01");
        inPausedFacility.setFloorLevel("Floor 2");
        when(requestContext.currentUserRole()).thenReturn("ADMIN");

        List<StorageUnitResponse> floorOne = service.getUnits(null, "Tầng 1", null, false);

        assertThat(floorOne).extracting(StorageUnitResponse::getUnitCode).containsExactlyInAnyOrder("D1-A101", "D1-A102", "D1-A103");
        assertThat(floorOne).extracting(StorageUnitResponse::getFloorLevel).containsOnly("Tầng 1");
        assertThat(service.getUnits(null, "floor 2", null, false)).extracting(StorageUnitResponse::getUnitCode).containsExactly("BT-A101");
    }

    // ------------------------------------------------------------------ create / update / maintenance

    private StorageUnitCreateRequest createRequest(String code, String floor) {
        return StorageUnitCreateRequest.builder()
                .unitCode(code).floorLevel(floor).facilityId(activeFacility.getId()).unitTypeId(unitType.getId())
                .build();
    }

    @Test
    @DisplayName("Creating a unit whose code differs only by case or spaces from an existing one is refused")
    void createRejectsCaseInsensitiveDuplicateCode() {
        when(facilityRepository.findById(activeFacility.getId())).thenReturn(Optional.of(activeFacility));
        when(unitTypeRepository.findById(unitType.getId())).thenReturn(Optional.of(unitType));
        when(storageUnitRepository.existsByFacility_IdAndUnitCodeIgnoreCase(activeFacility.getId(), "d1-qa01")).thenReturn(true);

        AppException ex = assertThrows(AppException.class, () -> service.createUnit(createRequest("  d1-qa01  ", "Tầng 1")));

        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.STORAGE_UNIT_CODE_EXISTED);
        verify(storageUnitRepository, never()).save(any(StorageUnit.class));
    }

    @Test
    @DisplayName("A new unit is stored with a normalised floor label and the trimmed code")
    void createNormalisesFloorAndTrimsCode() {
        when(facilityRepository.findById(activeFacility.getId())).thenReturn(Optional.of(activeFacility));
        when(unitTypeRepository.findById(unitType.getId())).thenReturn(Optional.of(unitType));
        when(storageUnitRepository.save(any(StorageUnit.class))).thenAnswer(invocation -> {
            StorageUnit saved = invocation.getArgument(0);
            saved.setId(UUID.randomUUID());
            return saved;
        });

        StorageUnitResponse created = service.createUnit(createRequest(" D1-QA01 ", "Floor 2"));

        assertThat(created.getUnitCode()).isEqualTo("D1-QA01");
        assertThat(created.getFloorLevel()).isEqualTo("Tầng 2");
        assertThat(created.getStatus()).isEqualTo("AVAILABLE");
    }

    @Test
    @DisplayName("Renaming a unit to the code of another unit (any letter case) is refused")
    void updateRejectsCaseInsensitiveDuplicateCode() {
        when(storageUnitRepository.findWithDetailsById(available.getId())).thenReturn(Optional.of(available));
        when(storageUnitRepository.existsByFacility_IdAndUnitCodeIgnoreCaseAndIdNot(activeFacility.getId(), "d1-a102", available.getId()))
                .thenReturn(true);

        StorageUnitUpdateRequest request = StorageUnitUpdateRequest.builder()
                .unitCode("d1-a102").floorLevel("Tầng 1").unitTypeId(unitType.getId()).build();
        AppException ex = assertThrows(AppException.class, () -> service.updateUnit(available.getId(), request));

        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.STORAGE_UNIT_CODE_EXISTED);
    }

    @Test
    @DisplayName("A unit recorded AVAILABLE that holds a live booking cannot be switched to maintenance")
    void maintenanceRefusedWhenLiveBookingHoldsUnit() {
        when(storageUnitRepository.findWithDetailsById(available.getId())).thenReturn(Optional.of(available));
        when(bookingRepository.existsByStorageUnit_IdAndStatusIn(available.getId(), UnitAvailability.LIVE_BOOKING_STATUSES))
                .thenReturn(true);

        AppException ex = assertThrows(AppException.class, () -> service.toggleMaintenance(available.getId()));

        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.STORAGE_UNIT_CANNOT_MAINTAIN);
        assertThat(available.getStatus()).isEqualTo(UnitStatus.AVAILABLE);
    }
}

package com.boxora.service;

import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.FacilityCreateRequest;
import com.boxora.dto.request.FacilityUpdateRequest;
import com.boxora.dto.response.FacilityResponse;
import com.boxora.entity.Facility;
import com.boxora.entity.Role;
import com.boxora.entity.User;
import com.boxora.enums.FacilityStatus;
import com.boxora.enums.UnitStatus;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.mapper.FacilityMapper;
import com.boxora.repository.FacilityRepository;
import com.boxora.repository.StorageUnitRepository;
import com.boxora.repository.UserRepository;
import com.boxora.security.FacilityAccessGuard;
import com.boxora.security.RequestContext;
import com.boxora.service.impl.FacilityServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mapstruct.factory.Mappers;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FacilityServiceTest {

    @Mock private FacilityRepository facilityRepository;
    @Mock private UserRepository userRepository;
    @Mock private StorageUnitRepository storageUnitRepository;
    @Mock private ActivityLogService activityLogService;
    @Mock private FacilityAccessGuard facilityAccessGuard;
    @Mock private RequestContext requestContext;

    private final FacilityMapper facilityMapper = Mappers.getMapper(FacilityMapper.class);
    private FacilityServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new FacilityServiceImpl(facilityRepository, userRepository, storageUnitRepository, facilityMapper,
                activityLogService, facilityAccessGuard, requestContext);
        lenient().when(facilityRepository.save(any(Facility.class))).thenAnswer(invocation -> {
            Facility saved = invocation.getArgument(0);
            if (saved.getId() == null) saved.setId(UUID.randomUUID());
            return saved;
        });
        lenient().when(storageUnitRepository.countByFacilityIdsGroupedByStatus(any())).thenReturn(List.of());
    }

    private FacilityCreateRequest createRequest() {
        return FacilityCreateRequest.builder()
                .name("Boxora Binh Thanh").code("HCM-BT").address("12 Dien Bien Phu").city("Ho Chi Minh City")
                .build();
    }

    private Facility facility(String name, FacilityStatus status) {
        Facility facility = Facility.builder().name(name).code(name.replace(' ', '-')).address("addr").status(status).build();
        facility.setId(UUID.randomUUID());
        User manager = User.builder().fullName("Nguyen Van Quan Ly").build();
        manager.setId(UUID.randomUUID());
        facility.setManager(manager);
        return facility;
    }

    @Test
    @DisplayName("Creating a facility honours the chosen status instead of forcing ACTIVE")
    void createHonoursStatus() {
        FacilityCreateRequest request = createRequest();
        request.setStatus("MAINTENANCE");

        FacilityResponse response = service.create(request);

        assertThat(response.getStatus()).isEqualTo(FacilityStatus.MAINTENANCE);
    }

    @Test
    @DisplayName("Without a status a new facility is ACTIVE; an invalid status is a 400")
    void createDefaultsToActiveAndRejectsInvalidStatus() {
        assertThat(service.create(createRequest()).getStatus()).isEqualTo(FacilityStatus.ACTIVE);

        FacilityCreateRequest bad = createRequest();
        bad.setStatus("EXPLODED");
        AppException ex = assertThrows(AppException.class, () -> service.create(bad));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.FACILITY_STATUS_INVALID);
    }

    @Test
    @DisplayName("Coordinates with many decimals are rounded to 7 places instead of being rejected")
    void createRoundsCoordinates() {
        FacilityCreateRequest request = createRequest();
        request.setLatitude(new BigDecimal("10.774130012345678"));
        request.setLongitude(new BigDecimal("106.703320098765"));

        FacilityResponse response = service.create(request);

        assertThat(response.getLatitude()).isEqualByComparingTo("10.7741300");
        assertThat(response.getLongitude()).isEqualByComparingTo("106.7033201");
    }

    @Test
    @DisplayName("Latitude without longitude is rejected")
    void createRejectsHalfCoordinates() {
        FacilityCreateRequest request = createRequest();
        request.setLatitude(new BigDecimal("10.77"));
        AppException ex = assertThrows(AppException.class, () -> service.create(request));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.FACILITY_COORDINATES_INVALID);
    }

    @Test
    @DisplayName("Duplicate facility name is rejected")
    void createRejectsDuplicateName() {
        when(facilityRepository.existsByNameIgnoreCase("Boxora Binh Thanh")).thenReturn(true);
        AppException ex = assertThrows(AppException.class, () -> service.create(createRequest()));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.FACILITY_NAME_EXISTED);
        verify(facilityRepository, never()).save(any());
    }

    @Test
    @DisplayName("A facility with units in use cannot be deactivated")
    void updateRejectsUnsafeDeactivation() {
        Facility facility = facility("Boxora D1", FacilityStatus.ACTIVE);
        when(facilityRepository.findById(facility.getId())).thenReturn(Optional.of(facility));
        when(storageUnitRepository.countByFacility_IdAndStatusIn(eq(facility.getId()), any())).thenReturn(3L);

        FacilityUpdateRequest request = new FacilityUpdateRequest();
        request.setStatus("INACTIVE");
        AppException ex = assertThrows(AppException.class, () -> service.update(facility.getId(), request));

        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.FACILITY_UNSAFE_DEACTIVATION);
        assertThat(facility.getStatus()).isEqualTo(FacilityStatus.ACTIVE);
    }

    @Test
    @DisplayName("An empty facility can be deactivated and clearing coordinates works")
    void updateDeactivatesEmptyFacility() {
        Facility facility = facility("Boxora D1", FacilityStatus.ACTIVE);
        facility.setLatitude(new BigDecimal("10.7"));
        facility.setLongitude(new BigDecimal("106.7"));
        when(facilityRepository.findById(facility.getId())).thenReturn(Optional.of(facility));
        when(storageUnitRepository.countByFacility_IdAndStatusIn(eq(facility.getId()), any())).thenReturn(0L);

        FacilityUpdateRequest request = new FacilityUpdateRequest();
        request.setStatus("INACTIVE");
        request.setClearCoordinates(true);
        FacilityResponse response = service.update(facility.getId(), request);

        assertThat(response.getStatus()).isEqualTo(FacilityStatus.INACTIVE);
        assertThat(response.getLatitude()).isNull();
        assertThat(response.getLongitude()).isNull();
    }

    @Test
    @DisplayName("Delete deactivates the facility (never a hard delete) and is refused while units are in use")
    void deleteDeactivatesAndGuardsUnitsInUse() {
        Facility busy = facility("Boxora D1", FacilityStatus.ACTIVE);
        when(facilityRepository.findById(busy.getId())).thenReturn(Optional.of(busy));
        when(storageUnitRepository.countByFacility_IdAndStatusIn(eq(busy.getId()), any())).thenReturn(2L);
        AppException ex = assertThrows(AppException.class, () -> service.delete(busy.getId()));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.FACILITY_UNSAFE_DEACTIVATION);
        assertThat(busy.getStatus()).isEqualTo(FacilityStatus.ACTIVE);

        Facility idle = facility("Boxora D9", FacilityStatus.ACTIVE);
        when(facilityRepository.findById(idle.getId())).thenReturn(Optional.of(idle));
        when(storageUnitRepository.countByFacility_IdAndStatusIn(eq(idle.getId()), any())).thenReturn(0L);
        service.delete(idle.getId());
        assertThat(idle.getStatus()).isEqualTo(FacilityStatus.INACTIVE);
        verify(facilityRepository, never()).delete(any(Facility.class));
    }

    @Test
    @DisplayName("The public list returns total/available unit counts from one grouped query and hides manager data")
    void publicListHasCountsAndNoManager() {
        Facility active = facility("Boxora D1", FacilityStatus.ACTIVE);
        Facility paused = facility("Boxora D7", FacilityStatus.MAINTENANCE);
        when(facilityRepository.findAllWithFilters(any(), eq(FacilityStatus.ACTIVE), any(), any(Pageable.class)))
                .thenAnswer(invocation -> new PageImpl<>(List.of(active), invocation.<Pageable>getArgument(3), 1));
        when(storageUnitRepository.countByFacilityIdsGroupedByStatus(any())).thenReturn(List.of(
                new Object[]{active.getId(), UnitStatus.AVAILABLE, 7L},
                new Object[]{active.getId(), UnitStatus.OCCUPIED, 13L},
                new Object[]{active.getId(), UnitStatus.RESERVED, 2L}
        ));

        PageResponse<FacilityResponse> page = service.getAll(null, null, 0, 50, "createdAt", "desc", true);

        assertThat(page.getContent()).hasSize(1);
        FacilityResponse row = page.getContent().get(0);
        assertThat(row.getTotalUnits()).isEqualTo(22L);
        assertThat(row.getAvailableUnits()).isEqualTo(7L);
        assertThat(row.getManagerId()).isNull();
        assertThat(row.getManagerName()).isNull();
        // public scope ignores the staff facility scoping completely
        verify(facilityAccessGuard, never()).scopedFacilityIdOrNull();
        ArgumentCaptor<Collection<UUID>> idsCaptor = ArgumentCaptor.forClass(Collection.class);
        verify(storageUnitRepository).countByFacilityIdsGroupedByStatus(idsCaptor.capture());
        assertThat(idsCaptor.getValue()).containsExactly(active.getId());
        assertThat(paused.getStatus()).isEqualTo(FacilityStatus.MAINTENANCE);
    }

    @Test
    @DisplayName("Internal managers keep manager data; a facility that is not ACTIVE reports 0 available units")
    void internalListKeepsManagerAndZeroAvailableWhenPaused() {
        Facility paused = facility("Boxora D7", FacilityStatus.MAINTENANCE);
        when(requestContext.currentUserRole()).thenReturn("BUSINESS_MANAGER");
        when(facilityAccessGuard.scopedFacilityIdOrNull()).thenReturn(null);
        when(facilityRepository.findAllWithFilters(any(), any(), any(), any(Pageable.class)))
                .thenAnswer(invocation -> new PageImpl<>(List.of(paused), invocation.<Pageable>getArgument(3), 1));
        when(storageUnitRepository.countByFacilityIdsGroupedByStatus(any())).thenReturn(List.<Object[]>of(
                new Object[]{paused.getId(), UnitStatus.AVAILABLE, 5L}));

        FacilityResponse row = service.getAll(null, null, 0, 50, "badField", "desc", false).getContent().get(0);

        assertThat(row.getManagerName()).isEqualTo("Nguyen Van Quan Ly");
        assertThat(row.getTotalUnits()).isEqualTo(5L);
        assertThat(row.getAvailableUnits()).isZero();
    }

    @Test
    @DisplayName("Only facility managers can be assigned as facility manager")
    void createRejectsNonManagerAssignee() {
        UUID userId = UUID.randomUUID();
        Role customerRole = new Role();
        customerRole.setName("CUSTOMER");
        User notManager = User.builder().role(customerRole).build();
        notManager.setId(userId);
        when(userRepository.findById(userId)).thenReturn(Optional.of(notManager));

        FacilityCreateRequest request = createRequest();
        request.setManagerId(userId);
        AppException ex = assertThrows(AppException.class, () -> service.create(request));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.INVALID_MANAGER_TO_ASSIGN);
    }

    @Test
    @DisplayName("Facility codes are unique ignoring case: qa-kt16211 is refused next to QA-KT16211")
    void createRejectsDuplicateCodeIgnoringCase() {
        FacilityCreateRequest request = createRequest();
        request.setCode("hcm-bt");
        when(facilityRepository.existsByCodeIgnoreCase("hcm-bt")).thenReturn(true);

        AppException ex = assertThrows(AppException.class, () -> service.create(request));

        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.FACILITY_CODE_EXISTED);
        verify(facilityRepository, never()).save(any());
    }

    @Test
    @DisplayName("The code is trimmed before the duplicate check")
    void createTrimsCodeBeforeDuplicateCheck() {
        FacilityCreateRequest request = createRequest();
        request.setCode("  HCM-BT  ");
        when(facilityRepository.existsByCodeIgnoreCase("HCM-BT")).thenReturn(true);

        AppException ex = assertThrows(AppException.class, () -> service.create(request));

        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.FACILITY_CODE_EXISTED);
    }

    @Test
    @DisplayName("Changing a code to one that differs only by case from another facility is refused; a case-only edit of itself is fine")
    void updateRejectsCaseInsensitiveDuplicateCode() {
        Facility facility = facility("Boxora D1", FacilityStatus.ACTIVE);
        when(facilityRepository.findById(facility.getId())).thenReturn(Optional.of(facility));
        when(facilityRepository.existsByCodeIgnoreCaseAndIdNot("hcm-d7", facility.getId())).thenReturn(true);

        FacilityUpdateRequest clash = new FacilityUpdateRequest();
        clash.setCode("hcm-d7");
        AppException ex = assertThrows(AppException.class, () -> service.update(facility.getId(), clash));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.FACILITY_CODE_EXISTED);

        FacilityUpdateRequest ownCase = new FacilityUpdateRequest();
        ownCase.setCode("boxora-d1");
        assertThat(service.update(facility.getId(), ownCase).getCode()).isEqualTo("boxora-d1");
    }

    @Test
    @DisplayName("Units that are recorded AVAILABLE but already hold a live booking are not counted as available")
    void availableCountExcludesUnitsHeldByLiveBookings() {
        Facility active = facility("Boxora D1", FacilityStatus.ACTIVE);
        when(facilityRepository.findAllWithFilters(any(), eq(FacilityStatus.ACTIVE), any(), any(Pageable.class)))
                .thenAnswer(invocation -> new PageImpl<>(List.of(active), invocation.<Pageable>getArgument(3), 1));
        when(storageUnitRepository.countByFacilityIdsGroupedByStatus(any())).thenReturn(List.of(
                new Object[]{active.getId(), UnitStatus.AVAILABLE, 7L},
                new Object[]{active.getId(), UnitStatus.OCCUPIED, 13L}
        ));
        when(storageUnitRepository.countAvailableWithLiveBookingByFacilityIds(any())).thenReturn(List.<Object[]>of(
                new Object[]{active.getId(), 2L}));

        FacilityResponse row = service.getAll(null, null, 0, 50, "createdAt", "desc", true).getContent().get(0);

        assertThat(row.getTotalUnits()).isEqualTo(20L);
        assertThat(row.getAvailableUnits()).isEqualTo(5L);
    }
}

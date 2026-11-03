package com.boxora.service;

import com.boxora.dto.request.PricingQuoteRequest;
import com.boxora.dto.request.StorageUnitCreateRequest;
import com.boxora.dto.request.UnitTypeUpdateRequest;
import com.boxora.dto.response.PricingQuoteResponse;
import com.boxora.dto.response.StorageUnitResponse;
import com.boxora.dto.response.UnitTypeResponse;
import com.boxora.entity.Facility;
import com.boxora.entity.FacilityPolicy;
import com.boxora.entity.StorageUnit;
import com.boxora.entity.UnitType;
import com.boxora.enums.ActivityAction;
import com.boxora.enums.UnitStatus;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.mapper.UnitTypeMapper;
import com.boxora.repository.*;
import com.boxora.security.FacilityAccessGuard;
import com.boxora.security.RequestContext;
import com.boxora.service.impl.PricingServiceImpl;
import com.boxora.service.impl.StorageUnitServiceImpl;
import com.boxora.service.impl.UnitTypeServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
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

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class StorageTypeAndUnitManagementRegressionTest {

    @Mock
    private UnitTypeRepository unitTypeRepository;
    @Mock
    private StorageUnitRepository storageUnitRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private UnitTypeMapper unitTypeMapper;
    @Mock
    private FacilityRepository facilityRepository;
    @Mock
    private FacilityPolicyRepository facilityPolicyRepository;
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
    @Mock
    private DiscountService discountService;
    @Mock
    private RequestContext requestContext;

    @InjectMocks
    private UnitTypeServiceImpl unitTypeService;

    private StorageUnitServiceImpl storageUnitService;
    private PricingServiceImpl pricingService;

    @BeforeEach
    void setUp() {
        storageUnitService = new StorageUnitServiceImpl(
                storageUnitRepository,
                facilityRepository,
                facilityPolicyRepository,
                unitTypeRepository,
                bookingRepository,
                rentalContractRepository,
                facilityAccessGuard,
                storageUnitPriceHistoryService,
                activityLogService
        );

        pricingService = new PricingServiceImpl(
                storageUnitRepository,
                facilityPolicyRepository,
                discountService
        );
    }

    @Test
    @DisplayName("Task 3 & 5: Update UnitType with dimensions, volume, capacity and active status")
    void testUpdateUnitType_Success() {
        UUID unitTypeId = UUID.randomUUID();
        UnitType existing = UnitType.builder()
                .typeName("Tủ cá nhân")
                .dimensions("1m x 1m x 1m")
                .areaSqm(1.0)
                .volumeM3(1.0)
                .basePricePerMonth(BigDecimal.valueOf(500000))
                .acPricePerMonth(BigDecimal.valueOf(600000))
                .isActive(true)
                .build();
        ReflectionTestUtils.setField(existing, "id", unitTypeId);

        when(unitTypeRepository.findById(unitTypeId)).thenReturn(Optional.of(existing));
        when(unitTypeRepository.save(any(UnitType.class))).thenAnswer(inv -> inv.getArgument(0));
        when(unitTypeMapper.toResponse(any(UnitType.class), anyLong())).thenAnswer(inv -> {
            UnitType u = inv.getArgument(0);
            return UnitTypeResponse.builder()
                    .id(u.getId())
                    .typeName(u.getTypeName())
                    .dimensions(u.getDimensions())
                    .areaSqm(u.getAreaSqm())
                    .volumeM3(u.getVolumeM3())
                    .lengthM(u.getLengthM())
                    .widthM(u.getWidthM())
                    .heightM(u.getHeightM())
                    .capacityBoxes(u.getCapacityBoxes())
                    .basePricePerMonth(u.getBasePricePerMonth())
                    .acPricePerMonth(u.getAcPricePerMonth())
                    .isActive(u.getIsActive())
                    .build();
        });

        UnitTypeUpdateRequest req = UnitTypeUpdateRequest.builder()
                .typeName("Tủ cá nhân nâng cấp")
                .lengthM(1.2)
                .widthM(1.2)
                .heightM(1.5)
                .volumeM3(2.16)
                .areaSqm(1.44)
                .capacityBoxes(12)
                .basePricePerMonth(BigDecimal.valueOf(650000))
                .acPricePerMonth(BigDecimal.valueOf(780000))
                .isActive(false)
                .priceChangeReason("Cập nhật quy cách và tạm ngưng")
                .build();

        UnitTypeResponse resp = unitTypeService.updateUnitType(unitTypeId, req);

        assertNotNull(resp);
        assertEquals("Tủ cá nhân nâng cấp", resp.getTypeName());
        assertEquals(2.16, resp.getVolumeM3());
        assertEquals(1.2, resp.getLengthM());
        assertEquals(1.2, resp.getWidthM());
        assertEquals(1.5, resp.getHeightM());
        assertEquals(1.44, resp.getAreaSqm());
        assertEquals(12, resp.getCapacityBoxes());
        assertEquals(BigDecimal.valueOf(650000), resp.getBasePricePerMonth());
        assertEquals(BigDecimal.valueOf(780000), resp.getAcPricePerMonth());
        assertFalse(resp.getIsActive());
        assertEquals("1.2m x 1.2m x 1.5m", resp.getDimensions());
    }

    @Test
    @DisplayName("Task 4: Dynamic term discounts from facility policy (3M, 6M, 12M)")
    void testDynamicTermDiscounts_FromFacilityPolicy() {
        UUID unitId = UUID.randomUUID();
        UUID facilityId = UUID.randomUUID();

        Facility facility = Facility.builder().name("Boxora Thủ Đức").build();
        ReflectionTestUtils.setField(facility, "id", facilityId);

        UnitType unitType = UnitType.builder()
                .typeName("Studio 8m³")
                .basePricePerMonth(BigDecimal.valueOf(1000000))
                .build();

        StorageUnit unit = StorageUnit.builder()
                .unitCode("TD-101")
                .facility(facility)
                .unitType(unitType)
                .pricePerMonth(BigDecimal.valueOf(1000000))
                .build();
        ReflectionTestUtils.setField(unit, "id", unitId);

        when(storageUnitRepository.findWithDetailsById(unitId)).thenReturn(Optional.of(unit));

        // Facility policy with customized term discounts: 3M = 8%, 6M = 12%, 12M = 25%
        FacilityPolicy policy = FacilityPolicy.builder()
                .facility(facility)
                .depositPercentage(100.0)
                .discount3MonthPercent(BigDecimal.valueOf(8.0))
                .discount6MonthPercent(BigDecimal.valueOf(12.0))
                .discount12MonthPercent(BigDecimal.valueOf(25.0))
                .build();

        when(facilityPolicyRepository.findByFacilityId(facilityId)).thenReturn(Optional.of(policy));

        // 1. Test 3 months -> 8% discount
        PricingQuoteRequest req3M = PricingQuoteRequest.builder()
                .storageUnitId(unitId)
                .rentalMonths(3)
                .build();
        PricingQuoteResponse resp3M = pricingService.calculateQuote(req3M);
        // subtotal = 3 * 1,000,000 = 3,000,000. 8% discount = 240,000. total = 2,760,000
        assertEquals(8, resp3M.getDiscountPercentage());
        assertEquals(BigDecimal.valueOf(240000).setScale(2), resp3M.getDiscountAmount());
        assertEquals(BigDecimal.valueOf(2760000).setScale(2), resp3M.getTotalRentalFee());

        // 2. Test 6 months -> 12% discount
        PricingQuoteRequest req6M = PricingQuoteRequest.builder()
                .storageUnitId(unitId)
                .rentalMonths(6)
                .build();
        PricingQuoteResponse resp6M = pricingService.calculateQuote(req6M);
        // subtotal = 6 * 1,000,000 = 6,000,000. 12% discount = 720,000. total = 5,280,000
        assertEquals(12, resp6M.getDiscountPercentage());
        assertEquals(BigDecimal.valueOf(720000).setScale(2), resp6M.getDiscountAmount());

        // 3. Test 12 months -> 25% discount
        PricingQuoteRequest req12M = PricingQuoteRequest.builder()
                .storageUnitId(unitId)
                .rentalMonths(12)
                .build();
        PricingQuoteResponse resp12M = pricingService.calculateQuote(req12M);
        // subtotal = 12 * 1,000,000 = 12,000,000. 25% discount = 3,000,000
        assertEquals(25, resp12M.getDiscountPercentage());
        assertEquals(BigDecimal.valueOf(3000000).setScale(2), resp12M.getDiscountAmount());
    }

    @Test
    @DisplayName("Task 4: Zero or deleted discount applies 0% without NPE")
    void testZeroOrDeletedDiscount_AppliesZeroPercent() {
        UUID unitId = UUID.randomUUID();
        UUID facilityId = UUID.randomUUID();

        Facility facility = Facility.builder().name("Boxora Quận 7").build();
        ReflectionTestUtils.setField(facility, "id", facilityId);

        UnitType unitType = UnitType.builder()
                .typeName("Tủ cá nhân")
                .basePricePerMonth(BigDecimal.valueOf(500000))
                .build();

        StorageUnit unit = StorageUnit.builder()
                .unitCode("Q7-001")
                .facility(facility)
                .unitType(unitType)
                .pricePerMonth(BigDecimal.valueOf(500000))
                .build();
        ReflectionTestUtils.setField(unit, "id", unitId);

        when(storageUnitRepository.findWithDetailsById(unitId)).thenReturn(Optional.of(unit));

        // Policy with discounts set to 0.0 or null
        FacilityPolicy policy = FacilityPolicy.builder()
                .facility(facility)
                .depositPercentage(100.0)
                .discount3MonthPercent(BigDecimal.ZERO)
                .discount6MonthPercent(BigDecimal.ZERO)
                .discount12MonthPercent(null) // null should not cause NPE
                .build();

        when(facilityPolicyRepository.findByFacilityId(facilityId)).thenReturn(Optional.of(policy));

        PricingQuoteRequest req = PricingQuoteRequest.builder()
                .storageUnitId(unitId)
                .rentalMonths(6)
                .build();

        PricingQuoteResponse resp = pricingService.calculateQuote(req);
        assertNotNull(resp);
        assertEquals(BigDecimal.ZERO, resp.getDiscountAmount());
        assertEquals(BigDecimal.valueOf(3000000), resp.getTotalRentalFee());
    }

    @Test
    @DisplayName("Task 6: Create StorageUnit in active floor and active storage zone")
    void testCreateStorageUnit_ActiveFloorAndZone_Success() {
        UUID facilityId = UUID.randomUUID();
        UUID unitTypeId = UUID.randomUUID();

        String layoutConfig = """
        {
            "floors": [
                {
                    "name": "Tầng 1",
                    "code": "FL-01",
                    "status": "ACTIVE",
                    "zones": [
                        { "code": "ZA", "name": "Phân khu A (Kho tiêu chuẩn)", "status": "ACTIVE" }
                    ],
                    "functionalAreas": [
                        { "type": "LOADING_BAY", "name": "Khu nhận hàng", "code": "FA-01" }
                    ]
                }
            ]
        }
        """;

        Facility facility = Facility.builder()
                .name("Boxora Tân Bình")
                .layoutConfig(layoutConfig)
                .build();
        ReflectionTestUtils.setField(facility, "id", facilityId);

        UnitType unitType = UnitType.builder()
                .typeName("Kho tiêu chuẩn")
                .basePricePerMonth(BigDecimal.valueOf(1500000))
                .build();
        ReflectionTestUtils.setField(unitType, "id", unitTypeId);

        when(facilityRepository.findById(facilityId)).thenReturn(Optional.of(facility));
        when(unitTypeRepository.findById(unitTypeId)).thenReturn(Optional.of(unitType));
        when(storageUnitRepository.existsByFacility_IdAndUnitCode(eq(facilityId), anyString())).thenReturn(false);
        when(storageUnitRepository.save(any(StorageUnit.class))).thenAnswer(inv -> {
            StorageUnit saved = inv.getArgument(0);
            ReflectionTestUtils.setField(saved, "id", UUID.randomUUID());
            return saved;
        });

        StorageUnitCreateRequest req = StorageUnitCreateRequest.builder()
                .unitCode("TB-A-101")
                .floorLevel("Tầng 1")
                .zoneCode("ZA")
                .facilityId(facilityId)
                .unitTypeId(unitTypeId)
                .build();

        StorageUnitResponse resp = storageUnitService.createUnit(req);

        assertNotNull(resp);
        assertEquals("TB-A-101", resp.getUnitCode());
        assertEquals("Tầng 1", resp.getFloorLevel());
        assertEquals("ZA", resp.getZoneCode());
        assertEquals("Phân khu A (Kho tiêu chuẩn)", resp.getZoneName());
        assertEquals(BigDecimal.valueOf(1500000), resp.getPricePerMonth());
    }

    @Test
    @DisplayName("Task 6: Reject Create StorageUnit in functional area")
    void testCreateStorageUnit_FunctionalArea_Rejected() {
        UUID facilityId = UUID.randomUUID();
        UUID unitTypeId = UUID.randomUUID();

        String layoutConfig = """
        {
            "floors": [
                {
                    "name": "Tầng 1",
                    "code": "FL-01",
                    "status": "ACTIVE",
                    "zones": [],
                    "functionalAreas": [
                        { "type": "LOADING_BAY", "name": "Khu nhận hàng", "code": "LOADING_BAY" }
                    ]
                }
            ]
        }
        """;

        Facility facility = Facility.builder()
                .name("Boxora Tân Bình")
                .layoutConfig(layoutConfig)
                .build();
        ReflectionTestUtils.setField(facility, "id", facilityId);

        UnitType unitType = UnitType.builder().typeName("Standard").build();

        when(facilityRepository.findById(facilityId)).thenReturn(Optional.of(facility));
        when(unitTypeRepository.findById(unitTypeId)).thenReturn(Optional.of(unitType));

        StorageUnitCreateRequest req = StorageUnitCreateRequest.builder()
                .unitCode("TB-FA-01")
                .floorLevel("Tầng 1")
                .zoneCode("LOADING_BAY")
                .facilityId(facilityId)
                .unitTypeId(unitTypeId)
                .build();

        AppException ex = assertThrows(AppException.class, () -> storageUnitService.createUnit(req));
        assertEquals(ErrorCode.STORAGE_UNIT_FLOOR_OR_ZONE_INVALID, ex.getErrorCode());
        assertTrue(ex.getMessage().contains("Không được phép tạo ngăn kho trong khu vực chức năng"));
    }
}

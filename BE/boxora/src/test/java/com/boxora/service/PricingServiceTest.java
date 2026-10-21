package com.boxora.service;

import com.boxora.dto.request.PricingQuoteRequest;
import com.boxora.dto.response.DiscountValidateResponse;
import com.boxora.dto.response.PricingQuoteResponse;
import com.boxora.dto.response.TermDiscountResponse;
import com.boxora.entity.Facility;
import com.boxora.entity.FacilityPolicy;
import com.boxora.entity.FacilityPolicyPrice;
import com.boxora.entity.StorageUnit;
import com.boxora.entity.UnitType;
import com.boxora.enums.BookingStatus;
import com.boxora.enums.DiscountType;
import com.boxora.enums.FacilityStatus;
import com.boxora.enums.UnitStatus;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.repository.BookingRepository;
import com.boxora.repository.FacilityPolicyRepository;
import com.boxora.repository.StorageUnitRepository;
import com.boxora.service.impl.PricingServiceImpl;
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
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PricingServiceTest {

    @Mock
    private StorageUnitRepository storageUnitRepository;

    @Mock
    private FacilityPolicyRepository facilityPolicyRepository;

    @Mock
    private DiscountService discountService;

    @Mock
    private BookingRepository bookingRepository;

    private PricingServiceImpl pricingService;

    private UUID unitId;
    private UnitType unitType;
    private Facility facility;
    private StorageUnit mockUnit;

    @BeforeEach
    void setUp() {
        pricingService = new PricingServiceImpl(storageUnitRepository, facilityPolicyRepository, discountService, bookingRepository);
        unitId = UUID.randomUUID();
        unitType = UnitType.builder()
                .typeName("Standard (1-Bedroom)")
                .basePricePerMonth(new BigDecimal("2400000.00"))
                .depositAmount(new BigDecimal("2400000.00"))
                .build();
        unitType.setId(UUID.randomUUID());

        facility = Facility.builder()
                .name("Boxora District 1")
                .build();
        facility.setId(UUID.randomUUID());

        mockUnit = StorageUnit.builder()
                .unitCode("D1-A103")
                .status(UnitStatus.AVAILABLE)
                .unitType(unitType)
                .facility(facility)
                .pricePerMonth(new BigDecimal("2400000.00"))
                .build();
        mockUnit.setId(unitId);

        lenient().when(storageUnitRepository.findWithDetailsById(unitId)).thenReturn(Optional.of(mockUnit));
        lenient().when(facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(any())).thenReturn(Optional.empty());
    }

    private FacilityPolicy policy(double depositPercentage, int minimumMonths, FacilityPolicyPrice... prices) {
        FacilityPolicy policy = FacilityPolicy.builder()
                .facility(facility)
                .depositPercentage(depositPercentage)
                .minimumRentalMonths(minimumMonths)
                .build();
        for (FacilityPolicyPrice price : prices) {
            price.setFacilityPolicy(policy);
            policy.getPrices().add(price);
        }
        lenient().when(facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(facility.getId())).thenReturn(Optional.of(policy));
        return policy;
    }

    private FacilityPolicyPrice policyPrice(String monthly, double d3, double d6, double d12) {
        return FacilityPolicyPrice.builder()
                .unitType(unitType)
                .monthlyPrice(new BigDecimal(monthly))
                .discount3MonthPercent(d3)
                .discount6MonthPercent(d6)
                .discount12MonthPercent(d12)
                .build();
    }

    private PricingQuoteRequest request(int months) {
        return PricingQuoteRequest.builder()
                .storageUnitId(unitId)
                .rentalMonths(months)
                .startDate(LocalDate.of(2026, 10, 16))
                .build();
    }

    @Test
    @DisplayName("Without a facility price list the system tiers apply: 12 months gets 15%")
    void testCalculateQuote12MonthsTermDiscount() {
        PricingQuoteResponse response = pricingService.calculateQuote(request(12));

        assertThat(response).isNotNull();
        assertThat(response.getSubtotalRentalFee()).isEqualByComparingTo("28800000.00");
        assertThat(response.getDiscountPercentage()).isEqualTo(15);
        assertThat(response.getDiscountPercent()).isEqualTo(15.0);
        assertThat(response.getDiscountAmount()).isEqualByComparingTo("4320000.00");
        assertThat(response.getTotalRentalFee()).isEqualByComparingTo("24480000.00");
        assertThat(response.getDepositAmount()).isEqualByComparingTo("2400000.00");
        assertThat(response.getDepositPercentage()).isEqualTo(100.0);
        assertThat(response.getTotalContractValue()).isEqualByComparingTo("26880000.00");
        assertThat(response.getInitialPaymentAmount()).isEqualByComparingTo("4440000.00");
        assertThat(response.getMonthlyPrice()).isEqualByComparingTo("2400000.00");
        assertThat(response.getMonthlyRate()).isEqualByComparingTo(response.getMonthlyPrice());
        assertThat(response.getPriceSource()).isEqualTo("UNIT");
    }

    @Test
    @DisplayName("3-month lease gets 5% and 6-month lease gets 10% by default")
    void testCalculateQuote3And6Months() {
        PricingQuoteResponse res3m = pricingService.calculateQuote(request(3));
        assertThat(res3m.getDiscountPercentage()).isEqualTo(5);
        assertThat(res3m.getSubtotalRentalFee()).isEqualByComparingTo("7200000.00");
        assertThat(res3m.getDiscountAmount()).isEqualByComparingTo("360000.00");
        assertThat(res3m.getTotalRentalFee()).isEqualByComparingTo("6840000.00");

        PricingQuoteResponse res6m = pricingService.calculateQuote(request(6));
        assertThat(res6m.getDiscountPercentage()).isEqualTo(10);
        assertThat(res6m.getSubtotalRentalFee()).isEqualByComparingTo("14400000.00");
        assertThat(res6m.getDiscountAmount()).isEqualByComparingTo("1440000.00");
        assertThat(res6m.getTotalRentalFee()).isEqualByComparingTo("12960000.00");
    }

    @Test
    @DisplayName("A 1-month lease has no term discount")
    void testNoDiscountForOneMonth() {
        PricingQuoteResponse response = pricingService.calculateQuote(request(1));
        assertThat(response.getDiscountAmount()).isEqualByComparingTo("0");
        assertThat(response.getDiscountCode()).isNull();
        assertThat(response.getDiscountPercentage()).isNull();
        assertThat(response.getTotalRentalFee()).isEqualByComparingTo("2400000.00");
        assertThat(response.getInitialPaymentAmount()).isEqualByComparingTo("4800000.00");
    }

    @Test
    @DisplayName("Facility price list overrides the unit price, its own discounts apply, and the deposit follows depositPercentage")
    void testFacilityPolicyPriceDiscountsAndDeposit() {
        policy(50.0, 1, policyPrice("2000000.00", 3.0, 12.5, 20.0));

        PricingQuoteResponse res6m = pricingService.calculateQuote(request(6));
        assertThat(res6m.getPriceSource()).isEqualTo("FACILITY_POLICY");
        assertThat(res6m.getMonthlyPrice()).isEqualByComparingTo("2000000.00");
        assertThat(res6m.getSubtotalRentalFee()).isEqualByComparingTo("12000000.00");
        assertThat(res6m.getDiscountPercent()).isEqualTo(12.5);
        assertThat(res6m.getDiscountAmount()).isEqualByComparingTo("1500000");
        assertThat(res6m.getTotalRentalFee()).isEqualByComparingTo("10500000");
        assertThat(res6m.getDepositPercentage()).isEqualTo(50.0);
        assertThat(res6m.getDepositAmount()).isEqualByComparingTo("1000000");
        assertThat(res6m.getInitialPaymentAmount()).isEqualByComparingTo("2750000.00");

        // 24 months uses the 12-month tier of the facility list, not the system 20% tier
        PricingQuoteResponse res24m = pricingService.calculateQuote(request(24));
        assertThat(res24m.getDiscountPercent()).isEqualTo(20.0);
    }

    @Test
    @DisplayName("A facility price list with zero discounts means no discount, not the system tiers")
    void testPolicyZeroDiscountMeansNoDiscount() {
        policy(100.0, 1, policyPrice("2000000.00", 0, 0, 0));
        PricingQuoteResponse response = pricingService.calculateQuote(request(12));
        assertThat(response.getDiscountAmount()).isEqualByComparingTo("0");
        assertThat(response.getTotalRentalFee()).isEqualByComparingTo("24000000");
    }

    @Test
    @DisplayName("The listed price (PricingRules) always equals the quoted monthly price")
    void testListedPriceEqualsQuotePrice() {
        FacilityPolicy withPrice = policy(100.0, 1, policyPrice("2150000.00", 5, 10, 15));
        BigDecimal listed = PricingRules.resolveMonthlyPrice(mockUnit, withPrice);
        assertThat(pricingService.calculateQuote(request(1)).getMonthlyPrice()).isEqualByComparingTo(listed);

        assertThat(PricingRules.depositFor(listed, withPrice))
                .isEqualByComparingTo(pricingService.calculateQuote(request(1)).getDepositAmount());
    }

    @Test
    @DisplayName("Unit type base price is used when the unit has no price of its own")
    void testFallsBackToUnitTypePrice() {
        mockUnit.setPricePerMonth(null);
        PricingQuoteResponse response = pricingService.calculateQuote(request(1));
        assertThat(response.getMonthlyPrice()).isEqualByComparingTo("2400000.00");
        assertThat(response.getPriceSource()).isEqualTo("UNIT_TYPE");
    }

    @Test
    @DisplayName("No configured price is an error, never an invented default price")
    void testNoPriceConfigured() {
        mockUnit.setPricePerMonth(null);
        unitType.setBasePricePerMonth(null);
        AppException ex = assertThrows(AppException.class, () -> pricingService.calculateQuote(request(1)));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.UNIT_TYPE_PRICE_NOT_CONFIGURED);
        assertThat(ErrorCode.UNIT_TYPE_PRICE_NOT_CONFIGURED.getHttpStatus().is5xxServerError()).isFalse();
    }

    @Test
    @DisplayName("Minimum rental months of the active policy is enforced, except for renewals")
    void testMinimumRentalMonths() {
        policy(100.0, 3);
        AppException ex = assertThrows(AppException.class, () -> pricingService.calculateQuote(request(2)));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.BOOKING_MINIMUM_DURATION_INVALID);

        PricingQuoteRequest renewal = request(2);
        renewal.setRenewal(true);
        assertThat(pricingService.calculateQuote(renewal).getRentalMonths()).isEqualTo(2);
    }

    @Test
    @DisplayName("An invalid discount code is a 400 business error, not silently ignored")
    void testInvalidDiscountCodeIsRejected() {
        when(discountService.validateAndCalculateDiscount(any()))
                .thenThrow(new AppException(ErrorCode.DISCOUNT_EXPIRED));

        PricingQuoteRequest request = request(3);
        request.setDiscountCode("NOPE123");
        AppException ex = assertThrows(AppException.class, () -> pricingService.calculateQuote(request));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.DISCOUNT_CODE_INVALID);
        assertThat(ex.getErrorCode().getHttpStatus().value()).isEqualTo(400);
        assertThat(ex.getMessage()).isEqualTo(ErrorCode.DISCOUNT_EXPIRED.getMessage());
    }

    @Test
    @DisplayName("A valid discount code beats a smaller term discount, and the larger one wins only once")
    void testDiscountCodeWinsWhenLarger() {
        when(discountService.validateAndCalculateDiscount(any())).thenReturn(DiscountValidateResponse.builder()
                .isValid(true)
                .code("SUMMER2026")
                .discountType(DiscountType.PERCENTAGE)
                .discountValue(new BigDecimal("20"))
                .discountAmount(new BigDecimal("1440000.00"))
                .build());

        PricingQuoteRequest request = request(3);
        request.setDiscountCode("summer2026");
        PricingQuoteResponse response = pricingService.calculateQuote(request);

        assertThat(response.getDiscountCode()).isEqualTo("SUMMER2026");
        assertThat(response.getDiscountAmount()).isEqualByComparingTo("1440000");
        assertThat(response.getDiscountPercent()).isEqualTo(20.0);
        assertThat(response.getTotalRentalFee()).isEqualByComparingTo("5760000");
    }

    @Test
    @DisplayName("Term discount ladder for the unit is exposed for the booking form")
    void testTermDiscountsEndpointData() {
        List<TermDiscountResponse> defaults = pricingService.getTermDiscounts(unitId);
        assertThat(defaults).extracting(TermDiscountResponse::getMonths).containsExactly(3, 6, 12, 24);

        policy(100.0, 1, policyPrice("2000000.00", 4.0, 8.0, 16.0));
        List<TermDiscountResponse> custom = pricingService.getTermDiscounts(unitId);
        assertThat(custom).extracting(TermDiscountResponse::getPercent).containsExactly(4.0, 8.0, 16.0);
    }

    // ------------------------------------------------------------------ bookability (facility status, unit availability)

    @Test
    @DisplayName("A facility under maintenance refuses new quotes with a clear Vietnamese reason")
    void testQuoteRefusedWhenFacilityUnderMaintenance() {
        facility.setStatus(FacilityStatus.MAINTENANCE);

        AppException ex = assertThrows(AppException.class, () -> pricingService.calculateQuote(request(1)));

        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.FACILITY_NOT_ACCEPTING_BOOKINGS);
        assertThat(ex.getErrorCode().getHttpStatus().is4xxClientError()).isTrue();
        assertThat(ex.getMessage()).contains("đang bảo trì");
    }

    @Test
    @DisplayName("An inactive facility refuses new quotes")
    void testQuoteRefusedWhenFacilityInactive() {
        facility.setStatus(FacilityStatus.INACTIVE);

        AppException ex = assertThrows(AppException.class, () -> pricingService.calculateQuote(request(1)));

        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.FACILITY_NOT_ACCEPTING_BOOKINGS);
        assertThat(ex.getMessage()).contains("ngừng hoạt động");
    }

    @Test
    @DisplayName("A renewal quote still works for a facility that is not ACTIVE (existing contract)")
    void testRenewalQuoteIgnoresFacilityStatus() {
        facility.setStatus(FacilityStatus.MAINTENANCE);
        mockUnit.setStatus(UnitStatus.OCCUPIED);
        PricingQuoteRequest renewal = request(2);
        renewal.setRenewal(true);

        assertThat(pricingService.calculateQuote(renewal).getRentalMonths()).isEqualTo(2);
    }

    @Test
    @DisplayName("A unit that is already reserved, rented or locked cannot be quoted for a new booking")
    void testQuoteRefusedWhenUnitNotAvailable() {
        for (UnitStatus status : List.of(UnitStatus.RESERVED, UnitStatus.OCCUPIED, UnitStatus.OVERDUE_LOCKED)) {
            mockUnit.setStatus(status);
            AppException ex = assertThrows(AppException.class, () -> pricingService.calculateQuote(request(1)));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.STORAGE_UNIT_NOT_AVAILABLE);
        }
    }

    @Test
    @DisplayName("A unit under maintenance is refused with its own explanation")
    void testQuoteRefusedWhenUnitUnderMaintenance() {
        mockUnit.setStatus(UnitStatus.UNDER_MAINTENANCE);

        AppException ex = assertThrows(AppException.class, () -> pricingService.calculateQuote(request(1)));

        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.STORAGE_UNIT_NOT_AVAILABLE);
        assertThat(ex.getMessage()).contains("D1-A103").contains("bảo trì");
    }

    @Test
    @DisplayName("A unit recorded as AVAILABLE but holding a live booking is refused (no quote for a unit nobody can book)")
    void testQuoteRefusedWhenLiveBookingHoldsUnit() {
        when(bookingRepository.existsByStorageUnit_IdAndStatusIn(unitId, UnitAvailability.LIVE_BOOKING_STATUSES)).thenReturn(true);

        AppException ex = assertThrows(AppException.class, () -> pricingService.calculateQuote(request(1)));

        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.STORAGE_UNIT_NOT_AVAILABLE);
        assertThat(ex.getErrorCode().getHttpStatus().value()).isEqualTo(409);
    }

    @Test
    @DisplayName("Live bookings are every status except COMPLETED and CANCELLED")
    void testLiveBookingStatuses() {
        assertThat(UnitAvailability.LIVE_BOOKING_STATUSES)
                .contains(BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED, BookingStatus.ACTIVE, BookingStatus.OVERDUE)
                .doesNotContain(BookingStatus.COMPLETED, BookingStatus.CANCELLED);
    }
}

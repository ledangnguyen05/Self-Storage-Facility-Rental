package com.boxora.service;

import com.boxora.dto.request.PricingQuoteRequest;
import com.boxora.dto.response.PricingQuoteResponse;
import com.boxora.entity.Facility;
import com.boxora.entity.StorageUnit;
import com.boxora.entity.UnitType;
import com.boxora.repository.FacilityPolicyRepository;
import com.boxora.repository.StorageUnitRepository;
import com.boxora.service.impl.PricingServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PricingServiceTest {

    @Mock
    private StorageUnitRepository storageUnitRepository;

    @Mock
    private FacilityPolicyRepository facilityPolicyRepository;

    @Mock
    private DiscountService discountService;

    private PricingServiceImpl pricingService;

    private UUID unitId;
    private StorageUnit mockUnit;

    @BeforeEach
    void setUp() {
        pricingService = new PricingServiceImpl(storageUnitRepository, facilityPolicyRepository, discountService);
        unitId = UUID.randomUUID();
        UnitType unitType = UnitType.builder()
                .typeName("Standard (1-Bedroom)")
                .basePricePerMonth(new BigDecimal("2400000.00"))
                .depositAmount(new BigDecimal("2400000.00"))
                .build();

        Facility facility = Facility.builder()
                .name("Boxora District 1")
                .build();
        facility.setId(UUID.randomUUID());

        mockUnit = StorageUnit.builder()
                .unitCode("D1-A103")
                .unitType(unitType)
                .facility(facility)
                .pricePerMonth(new BigDecimal("2400000.00"))
                .build();
        mockUnit.setId(unitId);

        when(storageUnitRepository.findWithDetailsById(unitId)).thenReturn(Optional.of(mockUnit));
        when(facilityPolicyRepository.findByFacilityId(any())).thenReturn(Optional.empty());
    }

    @Test
    @DisplayName("12-month lease automatically gets 15% term discount")
    void testCalculateQuote12MonthsTermDiscount() {
        PricingQuoteRequest request = PricingQuoteRequest.builder()
                .storageUnitId(unitId)
                .rentalMonths(12)
                .startDate(LocalDate.of(2026, 10, 16))
                .build();

        PricingQuoteResponse response = pricingService.calculateQuote(request);

        assertThat(response).isNotNull();
        assertThat(response.getSubtotalRentalFee()).isEqualByComparingTo("28800000.00");
        assertThat(response.getDiscountPercentage()).isEqualTo(15);
        assertThat(response.getDiscountAmount()).isEqualByComparingTo("4320000.00");
        assertThat(response.getTotalRentalFee()).isEqualByComparingTo("24480000.00");
        assertThat(response.getDepositAmount()).isEqualByComparingTo("2400000.00");
        assertThat(response.getTotalContractValue()).isEqualByComparingTo("26880000.00");
        assertThat(response.getInitialPaymentAmount()).isEqualByComparingTo("4440000.00");
    }

    @Test
    @DisplayName("3-month lease gets 5% and 6-month lease gets 10% term discount")
    void testCalculateQuote3And6Months() {
        PricingQuoteRequest req3m = PricingQuoteRequest.builder()
                .storageUnitId(unitId)
                .rentalMonths(3)
                .build();

        PricingQuoteResponse res3m = pricingService.calculateQuote(req3m);
        assertThat(res3m.getDiscountPercentage()).isEqualTo(5);
        assertThat(res3m.getSubtotalRentalFee()).isEqualByComparingTo("7200000.00");
        assertThat(res3m.getDiscountAmount()).isEqualByComparingTo("360000.00");
        assertThat(res3m.getTotalRentalFee()).isEqualByComparingTo("6840000.00");

        PricingQuoteRequest req6m = PricingQuoteRequest.builder()
                .storageUnitId(unitId)
                .rentalMonths(6)
                .build();

        PricingQuoteResponse res6m = pricingService.calculateQuote(req6m);
        assertThat(res6m.getDiscountPercentage()).isEqualTo(10);
        assertThat(res6m.getSubtotalRentalFee()).isEqualByComparingTo("14400000.00");
        assertThat(res6m.getDiscountAmount()).isEqualByComparingTo("1440000.00");
        assertThat(res6m.getTotalRentalFee()).isEqualByComparingTo("12960000.00");
    }
}

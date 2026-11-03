package com.boxora.service;

import com.boxora.dto.request.BookingCreateRequest;
import com.boxora.dto.request.PricingQuoteRequest;
import com.boxora.dto.response.BookingCancellationPreviewResponse;
import com.boxora.dto.response.PricingQuoteResponse;
import com.boxora.entity.*;
import com.boxora.enums.BookingStatus;
import com.boxora.enums.UnitStatus;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.repository.*;
import com.boxora.service.impl.BookingCancellationServiceImpl;
import com.boxora.service.impl.BookingServiceImpl;
import com.boxora.service.impl.PricingServiceImpl;
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
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
public class FacilityPolicyTask1And2RegressionTest {

    @Test
    @DisplayName("Task 1: Late fee reflects facility active policy (50,000d at Thao Dien, supports 0d/day)")
    void testTask1_LateFeeConsistency() {
        Facility facility = Facility.builder().name("Boxora Thảo Điền").build();

        FacilityPolicy thaoDienPolicy = FacilityPolicy.builder()
                .facility(facility)
                .isActive(true)
                .dailyLateFee(new BigDecimal("50000.00"))
                .build();

        assertThat(thaoDienPolicy.getDailyLateFee()).isEqualByComparingTo("50000.00");

        FacilityPolicy freeLateFeePolicy = FacilityPolicy.builder()
                .facility(facility)
                .isActive(true)
                .dailyLateFee(BigDecimal.ZERO)
                .build();

        assertThat(freeLateFeePolicy.getDailyLateFee()).isEqualByComparingTo("0.00");
    }

    @Nested
    @DisplayName("Task 2.1: Deposit Calculation Tests")
    class PricingDepositTests {
        @Mock
        private StorageUnitRepository storageUnitRepository;

        @Mock
        private FacilityPolicyRepository facilityPolicyRepository;

        @Mock
        private DiscountService discountService;

        @InjectMocks
        private PricingServiceImpl pricingService;

        private UUID facilityId;
        private UUID unitId;
        private Facility facility;
        private StorageUnit unit;

        @BeforeEach
        void setUp() {
            facilityId = UUID.randomUUID();
            unitId = UUID.randomUUID();

            facility = Facility.builder().name("Boxora Thảo Điền").build();
            facility.setId(facilityId);

            UnitType unitType = UnitType.builder()
                    .typeName("Standard Unit")
                    .basePricePerMonth(new BigDecimal("2000000.00"))
                    .depositAmount(new BigDecimal("2000000.00"))
                    .build();

            unit = StorageUnit.builder()
                    .unitCode("TD-101")
                    .facility(facility)
                    .unitType(unitType)
                    .pricePerMonth(new BigDecimal("2000000.00"))
                    .status(UnitStatus.AVAILABLE)
                    .build();
            unit.setId(unitId);
        }

        @Test
        @DisplayName("Deposit is calculated as 1 month rent * depositPercentage / 100, NOT whole contract")
        void testDepositCalculatedOnOneMonthRent() {
            FacilityPolicy policy = FacilityPolicy.builder()
                    .facility(facility)
                    .isActive(true)
                    .depositPercentage(100.0) // 100% of 1 month rent
                    .build();

            when(storageUnitRepository.findWithDetailsById(unitId)).thenReturn(Optional.of(unit));
            when(facilityPolicyRepository.findByFacilityId(facilityId)).thenReturn(Optional.of(policy));

            // Lease for 3 months (90 days)
            PricingQuoteRequest request = PricingQuoteRequest.builder()
                    .storageUnitId(unitId)
                    .rentalMonths(3)
                    .startDate(LocalDate.now().plusDays(2))
                    .build();

            PricingQuoteResponse quote = pricingService.calculateQuote(request);

            assertThat(quote).isNotNull();
            // Rent for 3 months = 2,000,000 * 3 = 6,000,000
            assertThat(quote.getSubtotalRentalFee()).isEqualByComparingTo("6000000.00");
            // Deposit must be 2,000,000 (1 month rent), NOT 6,000,000!
            assertThat(quote.getDepositAmount()).isEqualByComparingTo("2000000.00");
            // 3-month lease gives 5% term discount = 300,000
            assertThat(quote.getDiscountAmount()).isEqualByComparingTo("300000.00");
            // Total rental fee after discount = 5,700,000
            assertThat(quote.getTotalRentalFee()).isEqualByComparingTo("5700000.00");
            // Total contract value = 5,700,000 + 2,000,000 = 7,700,000
            assertThat(quote.getTotalContractValue()).isEqualByComparingTo("7700000.00");
        }
    }

    @Nested
    @DisplayName("Task 2.2: Minimum Rental Days Tests")
    class BookingValidationTests {
        @Mock
        private BookingRepository bookingRepository;

        @Mock
        private StorageUnitRepository storageUnitRepository;

        @Mock
        private FacilityPolicyRepository facilityPolicyRepository;

        @Mock
        private StorageUnitLockService storageUnitLockService;

        @Mock
        private UserRepository userRepository;

        @InjectMocks
        private BookingServiceImpl bookingService;

        private UUID facilityId;
        private UUID unitId;
        private UUID customerId;
        private Facility facility;
        private StorageUnit unit;
        private User customer;

        @BeforeEach
        void setUp() {
            ReflectionTestUtils.setField(bookingService, "maxAdvanceDays", 30);

            facilityId = UUID.randomUUID();
            unitId = UUID.randomUUID();
            customerId = UUID.randomUUID();

            facility = Facility.builder().name("Boxora Thảo Điền").build();
            facility.setId(facilityId);

            unit = StorageUnit.builder()
                    .unitCode("TD-101")
                    .facility(facility)
                    .status(UnitStatus.AVAILABLE)
                    .build();
            unit.setId(unitId);

            customer = User.builder()
                    .fullName("Nguyen Van A")
                    .email("customer@example.com")
                    .build();
            customer.setId(customerId);
        }

        @Test
        @DisplayName("Booking validates minimumRentalDays and rejects booking shorter than policy requirement")
        void testMinimumRentalDaysValidation() {
            FacilityPolicy policy = FacilityPolicy.builder()
                    .facility(facility)
                    .isActive(true)
                    .minimumRentalDays(30)
                    .build();

            when(storageUnitRepository.findWithDetailsByIdForUpdate(unitId)).thenReturn(Optional.of(unit));
            when(facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(facilityId)).thenReturn(Optional.of(policy));
            when(storageUnitLockService.isUnitLocked(unitId)).thenReturn(false);
            when(bookingRepository.existsByStorageUnit_IdAndStatusIn(any(), any())).thenReturn(false);

            // Attempt to book for 15 days (< minimumRentalDays 30)
            LocalDate startDate = LocalDate.now().plusDays(2);
            LocalDate endDate = startDate.plusDays(15);
            BookingCreateRequest shortBookingRequest = BookingCreateRequest.builder()
                    .storageUnitId(unitId)
                    .customerId(customerId)
                    .startDate(startDate)
                    .endDate(endDate)
                    .rentalMonths(1)
                    .build();

            AppException ex = assertThrows(AppException.class, () -> bookingService.createBooking(shortBookingRequest));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.BOOKING_MINIMUM_DURATION_INVALID);
            assertThat(ex.getMessage()).contains("30 ngày");
        }
    }

    @Nested
    @DisplayName("Task 2.4: Three-Milestone Cancellation Refund Tests")
    class CancellationRefundTests {
        @Mock
        private BookingRepository bookingRepository;

        @Mock
        private FacilityPolicyRepository facilityPolicyRepository;

        @Mock
        private HandoverRecordRepository handoverRecordRepository;

        @InjectMocks
        private BookingCancellationServiceImpl cancellationService;

        private UUID facilityId;
        private UUID bookingId;
        private Facility facility;
        private FacilityPolicy policy;
        private Booking booking;

        @BeforeEach
        void setUp() {
            ReflectionTestUtils.setField(cancellationService, "defaultPendingPaymentTimeoutMinutes", 15);

            facilityId = UUID.randomUUID();
            bookingId = UUID.randomUUID();

            facility = Facility.builder().name("Boxora Thảo Điền").build();
            facility.setId(facilityId);

            StorageUnit unit = StorageUnit.builder()
                    .unitCode("TD-101")
                    .facility(facility)
                    .status(UnitStatus.AVAILABLE)
                    .build();

            User customer = User.builder()
                    .fullName("Nguyen Van A")
                    .email("customer@example.com")
                    .build();

            policy = FacilityPolicy.builder()
                    .facility(facility)
                    .isActive(true)
                    .cancellationFullRefundHours(24)
                    .cancellationPartialRefundHours(48)
                    .cancellationPartialRefundPercent(70.0) // milestone 2
                    .cancellationAfter48hRefundPercent(50.0) // milestone 3
                    .build();

            booking = Booking.builder()
                    .storageUnit(unit)
                    .customer(customer)
                    .status(BookingStatus.CONFIRMED)
                    .paymentStatus("PAID")
                    .depositPaid(new BigDecimal("2000000.00"))
                    .totalRentalFee(new BigDecimal("6000000.00"))
                    .startDate(LocalDate.now().plusDays(10))
                    .endDate(LocalDate.now().plusDays(100))
                    .rentalMonths(3)
                    .build();
            booking.setId(bookingId);

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(booking));
            when(facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(facilityId)).thenReturn(Optional.of(policy));
            when(handoverRecordRepository.existsByBooking_IdAndRecordType(any(), any())).thenReturn(false);
        }

        @Test
        @DisplayName("3-milestone cancellation refund correctly calculates deposit refund without deducting from rent")
        void testThreeMilestoneCancellationRefund() {
            // 1. Milestone 1: cancel at 10 hours after booking (<= 24h)
            booking.setCreatedAt(LocalDateTime.now().minusHours(10));
            BookingCancellationPreviewResponse previewStage1 = cancellationService.previewCancellationRefund(bookingId);

            assertThat(previewStage1.getMilestoneStage()).isEqualTo("STAGE_1_FULL_REFUND");
            assertThat(previewStage1.getRefundPercentage()).isEqualTo(100.0);
            // Full deposit (2,000,000) + full rent (6,000,000) = 8,000,000
            assertThat(previewStage1.getRefundAmount()).isEqualByComparingTo("8000000.00");
            assertThat(previewStage1.getPenaltyAmount()).isEqualByComparingTo("0.00");

            // 2. Milestone 2: cancel at 30 hours after booking (24h < t <= 48h)
            booking.setCreatedAt(LocalDateTime.now().minusHours(30));
            BookingCancellationPreviewResponse previewStage2 = cancellationService.previewCancellationRefund(bookingId);

            assertThat(previewStage2.getMilestoneStage()).isEqualTo("STAGE_2_PARTIAL_REFUND");
            assertThat(previewStage2.getRefundPercentage()).isEqualTo(70.0);
            // 70% deposit = 1,400,000 + full rent 6,000,000 = 7,400,000
            assertThat(previewStage2.getRefundAmount()).isEqualByComparingTo("7400000.00");
            // Penalty is 30% of deposit = 600,000
            assertThat(previewStage2.getPenaltyAmount()).isEqualByComparingTo("600000.00");

            // 3. Milestone 3: cancel at 60 hours after booking (> 48h)
            booking.setCreatedAt(LocalDateTime.now().minusHours(60));
            BookingCancellationPreviewResponse previewStage3 = cancellationService.previewCancellationRefund(bookingId);

            assertThat(previewStage3.getMilestoneStage()).isEqualTo("STAGE_3_OVER_48H_REFUND");
            assertThat(previewStage3.getRefundPercentage()).isEqualTo(50.0);
            // 50% deposit = 1,000,000 + full rent 6,000,000 = 7,000,000
            assertThat(previewStage3.getRefundAmount()).isEqualByComparingTo("7000000.00");
            // Penalty is 50% of deposit = 1,000,000
            assertThat(previewStage3.getPenaltyAmount()).isEqualByComparingTo("1000000.00");
        }
    }
}

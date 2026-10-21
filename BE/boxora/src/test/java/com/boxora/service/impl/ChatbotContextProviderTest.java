package com.boxora.service.impl;

import com.boxora.entity.Facility;
import com.boxora.entity.FacilityPolicy;
import com.boxora.entity.FacilityPolicyPrice;
import com.boxora.entity.UnitType;
import com.boxora.enums.FacilityStatus;
import com.boxora.enums.UnitStatus;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.repository.FacilityPolicyRepository;
import com.boxora.repository.FacilityRepository;
import com.boxora.repository.UnitReportRepository;
import com.boxora.repository.UnitTypeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ChatbotContextProviderTest {

    @Mock private FacilityRepository facilityRepository;
    @Mock private FacilityPolicyRepository facilityPolicyRepository;
    @Mock private UnitTypeRepository unitTypeRepository;
    @Mock private UnitReportRepository unitReportRepository;

    private ChatbotContextProvider provider;
    private Facility d1;
    private Facility closed;
    private UnitType mini;
    private UnitType cold;

    @BeforeEach
    void setUp() {
        provider = new ChatbotContextProvider(facilityRepository, facilityPolicyRepository, unitTypeRepository, unitReportRepository);

        d1 = Facility.builder().name("Boxora District 1").code("HCM-D1").address("123 Nguyen Hue, Ben Nghe Ward").city("Ho Chi Minh City")
                .contactPhone("0901234567").openTime(LocalTime.of(8, 0)).closeTime(LocalTime.of(20, 0)).status(FacilityStatus.ACTIVE).build();
        d1.setId(UUID.randomUUID());
        closed = Facility.builder().name("Boxora Closed").code("X").address("Somewhere").status(FacilityStatus.INACTIVE).build();
        closed.setId(UUID.randomUUID());

        mini = UnitType.builder().typeName("Mini (Personal Locker)").dimensions("1.0m x 1.0m x 1.2m").areaSqm(1.0)
                .basePricePerMonth(new BigDecimal("450000")).depositAmount(new BigDecimal("450000")).build();
        mini.setId(UUID.randomUUID());
        cold = UnitType.builder().typeName("Cold Storage").dimensions("2.0m x 2.5m x 2.8m").areaSqm(5.0)
                .basePricePerMonth(new BigDecimal("3200000")).depositAmount(new BigDecimal("3200000")).build();
        cold.setId(UUID.randomUUID());

        FacilityPolicy policy = FacilityPolicy.builder().facility(d1).depositPercentage(100.0).minimumRentalMonths(1)
                .cancellationFullRefundHours(48).cancellationPartialRefundHours(24).cancellationPartialRefundPercent(50.0)
                .dailyLateFee(new BigDecimal("50000")).build();

        when(facilityRepository.findAllByOrderByCreatedAtAsc()).thenReturn(List.of(d1, closed));
        when(unitTypeRepository.findAll()).thenReturn(List.of(mini, cold));
        when(facilityPolicyRepository.findByIsActiveTrue()).thenReturn(List.of(policy));
        when(unitReportRepository.summarizeUnitsByFacilityTypeAndStatus()).thenReturn(List.of(
                new Object[]{d1.getId(), mini.getId(), UnitStatus.AVAILABLE, 7L, new BigDecimal("450000"), new BigDecimal("450000")},
                new Object[]{d1.getId(), mini.getId(), UnitStatus.OCCUPIED, 3L, new BigDecimal("450000"), new BigDecimal("450000")},
                new Object[]{d1.getId(), cold.getId(), UnitStatus.OCCUPIED, 2L, new BigDecimal("3200000"), new BigDecimal("3200000")}));
    }

    @Test
    @DisplayName("The catalogue lists real addresses, hours, phone, availability and prices, and skips inactive facilities")
    void describesLiveCatalogue() {
        String context = provider.currentContext();

        assertThat(context).contains("Boxora District 1").contains("HCM-D1")
                .contains("123 Nguyen Hue, Ben Nghe Ward, Ho Chi Minh City")
                .contains("08:00 - 20:00").contains("0901234567")
                .contains("Mini (Personal Locker)").contains("còn 7 kho trống").contains("450.000 ₫/tháng")
                .contains("Cold Storage").contains("hiện hết kho trống").contains("3.200.000 ₫/tháng");
        assertThat(context).doesNotContain("Boxora Closed");
        assertThat(context).doesNotContain("Bình Thạnh").doesNotContain("Bảo hiểm");
    }

    @Test
    @DisplayName("Policy highlights come from the facility policy")
    void describesPolicy() {
        String context = provider.currentContext();

        assertThat(context).contains("CHÍNH SÁCH")
                .contains("tiền cọc bằng 100% tiền thuê một tháng")
                .contains("hủy trước giờ nhận kho ít nhất 48 giờ được hoàn 100% tiền cọc")
                .contains("hủy trước ít nhất 24 giờ được hoàn 50% tiền cọc")
                .contains("phí trễ 50.000 ₫/ngày");
    }

    @Test
    @DisplayName("A facility policy price overrides the unit prices and its term discounts are mentioned")
    void policyPriceWins() {
        FacilityPolicy policy = FacilityPolicy.builder().facility(d1).depositPercentage(100.0).dailyLateFee(new BigDecimal("50000")).build();
        policy.getPrices().add(FacilityPolicyPrice.builder().facilityPolicy(policy).unitType(mini)
                .monthlyPrice(new BigDecimal("500000")).discount3MonthPercent(5.0).discount6MonthPercent(10.0).discount12MonthPercent(0.0).build());
        when(facilityPolicyRepository.findByIsActiveTrue()).thenReturn(List.of(policy));

        String context = provider.currentContext();

        assertThat(context).contains("500.000 ₫/tháng").contains("giảm 5% khi thuê từ 3 tháng").contains("giảm 10% khi thuê từ 6 tháng")
                .doesNotContain("khi thuê từ 12 tháng");
    }

    @Test
    @DisplayName("A facility without a policy says so instead of inventing one")
    void missingPolicyIsStated() {
        when(facilityPolicyRepository.findByIsActiveTrue()).thenReturn(List.of());

        assertThat(provider.currentContext()).contains("chưa có chính sách riêng được công bố");
    }

    @Test
    @DisplayName("The snapshot is cached, and can be dropped")
    void snapshotIsCached() {
        provider.currentContext();
        provider.currentContext();
        verify(facilityRepository, times(1)).findAllByOrderByCreatedAtAsc();

        provider.invalidate();
        provider.currentContext();
        verify(facilityRepository, times(2)).findAllByOrderByCreatedAtAsc();
    }

    @Test
    @DisplayName("When the database cannot be read and nothing is cached the bot is unavailable (503), never guessing")
    void databaseFailureWithoutCacheIsUnavailable() {
        when(facilityRepository.findAllByOrderByCreatedAtAsc()).thenThrow(new IllegalStateException("db down"));

        assertThatThrownBy(() -> provider.currentContext())
                .isInstanceOfSatisfying(AppException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.CHATBOT_UNAVAILABLE));
    }

    @Test
    @DisplayName("No active facility is reported as such")
    void noFacilities() {
        when(facilityRepository.findAllByOrderByCreatedAtAsc()).thenReturn(List.of(closed));

        assertThat(provider.currentContext()).contains("chưa có cơ sở nào đang hoạt động");
    }
}

package com.boxora.service;

import com.boxora.dto.request.FacilityPolicyCreateRequest;
import com.boxora.dto.request.FacilityPolicyPriceRequest;
import com.boxora.dto.request.FacilityPolicyUpdateRequest;
import com.boxora.dto.response.FacilityPolicyResponse;
import com.boxora.entity.Facility;
import com.boxora.entity.FacilityPolicy;
import com.boxora.entity.FacilityPolicyPrice;
import com.boxora.entity.UnitType;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.mapper.FacilityPolicyMapper;
import com.boxora.repository.FacilityPolicyExceptionGrantRepository;
import com.boxora.repository.FacilityPolicyRepository;
import com.boxora.repository.FacilityRepository;
import com.boxora.repository.UnitTypeRepository;
import com.boxora.repository.UserRepository;
import com.boxora.security.FacilityAccessGuard;
import com.boxora.security.RequestContext;
import com.boxora.service.impl.FacilityPolicyServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mapstruct.factory.Mappers;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FacilityPolicyServiceTest {

    @Mock private FacilityPolicyRepository facilityPolicyRepository;
    @Mock private FacilityRepository facilityRepository;
    @Mock private ActivityLogService activityLogService;
    @Mock private FacilityAccessGuard facilityAccessGuard;
    @Mock private FacilityPolicyExceptionGrantRepository exceptionGrantRepository;
    @Mock private UserRepository userRepository;
    @Mock private UnitTypeRepository unitTypeRepository;
    @Mock private RequestContext requestContext;

    private final FacilityPolicyMapper policyMapper = Mappers.getMapper(FacilityPolicyMapper.class);
    private FacilityPolicyServiceImpl service;

    private Facility facility;
    private UnitType mini;
    private UnitType standard;

    @BeforeEach
    void setUp() {
        service = new FacilityPolicyServiceImpl(facilityPolicyRepository, facilityRepository, policyMapper, activityLogService,
                facilityAccessGuard, exceptionGrantRepository, userRepository, unitTypeRepository, requestContext);

        facility = Facility.builder().name("Boxora District 1").code("HCM-D1").address("addr").build();
        facility.setId(UUID.randomUUID());
        mini = unitType("Mini (Personal Locker)");
        standard = unitType("Standard (1-Bedroom)");

        lenient().when(unitTypeRepository.findAllById(any())).thenAnswer(invocation -> {
            Iterable<UUID> ids = invocation.getArgument(0);
            List<UnitType> found = new java.util.ArrayList<>();
            for (UUID id : ids) {
                if (id.equals(mini.getId())) found.add(mini);
                if (id.equals(standard.getId())) found.add(standard);
            }
            return found;
        });
        lenient().when(facilityPolicyRepository.save(any(FacilityPolicy.class))).thenAnswer(invocation -> {
            FacilityPolicy saved = invocation.getArgument(0);
            if (saved.getId() == null) saved.setId(UUID.randomUUID());
            return saved;
        });
    }

    private UnitType unitType(String name) {
        UnitType type = UnitType.builder().typeName(name).dimensions("1x1").areaSqm(1.0)
                .basePricePerMonth(new BigDecimal("450000")).depositAmount(new BigDecimal("450000")).build();
        type.setId(UUID.randomUUID());
        return type;
    }

    private FacilityPolicy policy(boolean active) {
        FacilityPolicy policy = FacilityPolicy.builder().facility(facility).isActive(active)
                .depositPercentage(100.0).dailyLateFee(new BigDecimal("50000")).build();
        policy.setId(UUID.randomUUID());
        return policy;
    }

    private FacilityPolicyPriceRequest price(UnitType type, String monthly, double d3, double d6, double d12) {
        return FacilityPolicyPriceRequest.builder().unitTypeId(type.getId()).monthlyPrice(new BigDecimal(monthly))
                .discount3MonthPercent(d3).discount6MonthPercent(d6).discount12MonthPercent(d12).build();
    }

    @Test
    @DisplayName("Anonymous and customer callers get 404 for an inactive policy, so the facility falls back to system defaults")
    void inactivePolicyIsHiddenFromPublic() {
        FacilityPolicy inactive = policy(false);
        when(facilityPolicyRepository.findByFacility_Id(facility.getId())).thenReturn(Optional.of(inactive));

        when(requestContext.currentUserRole()).thenReturn(null);
        AppException anonymous = assertThrows(AppException.class, () -> service.getByFacilityId(facility.getId()));
        assertThat(anonymous.getErrorCode()).isEqualTo(ErrorCode.FACILITY_POLICY_NOT_FOUND);

        when(requestContext.currentUserRole()).thenReturn("CUSTOMER");
        assertThrows(AppException.class, () -> service.getByFacilityId(facility.getId()));

        when(requestContext.currentUserRole()).thenReturn("BUSINESS_MANAGER");
        assertThat(service.getByFacilityId(facility.getId()).getIsActive()).isFalse();
    }

    @Test
    @DisplayName("Any caller can read the active policy of any facility (no facility-access guard on reads)")
    void activePolicyIsPublicAndCrossFacilityReadable() {
        FacilityPolicy active = policy(true);
        active.setHoldGraceHours(36);
        active.setMaxHoldDays(10);
        when(facilityPolicyRepository.findByFacility_Id(facility.getId())).thenReturn(Optional.of(active));
        when(requestContext.currentUserRole()).thenReturn("STAFF");

        FacilityPolicyResponse response = service.getByFacilityId(facility.getId());

        assertThat(response.getHoldGraceHours()).isEqualTo(36);
        assertThat(response.getMaxHoldDays()).isEqualTo(10);
        assertThat(response.getDepositPercentage()).isEqualTo(100.0);
        org.mockito.Mockito.verifyNoInteractions(facilityAccessGuard);
    }

    @Test
    @DisplayName("Creating a policy stores the hold fields, defaulting them to 24 hours and 14 days")
    void createStoresHoldFields() {
        when(facilityRepository.findById(facility.getId())).thenReturn(Optional.of(facility));
        when(facilityPolicyRepository.existsByFacility_Id(facility.getId())).thenReturn(false);

        FacilityPolicyCreateRequest request = baseCreate();
        FacilityPolicyResponse defaults = service.create(request);
        assertThat(defaults.getHoldGraceHours()).isEqualTo(24);
        assertThat(defaults.getMaxHoldDays()).isEqualTo(14);

        when(facilityPolicyRepository.existsByFacility_Id(facility.getId())).thenReturn(false);
        request.setHoldGraceHours(48);
        request.setMaxHoldDays(30);
        FacilityPolicyResponse custom = service.create(request);
        assertThat(custom.getHoldGraceHours()).isEqualTo(48);
        assertThat(custom.getMaxHoldDays()).isEqualTo(30);
    }

    private FacilityPolicyCreateRequest baseCreate() {
        return FacilityPolicyCreateRequest.builder()
                .facilityId(facility.getId()).depositPercentage(100.0).renewalWindowDays(3)
                .cancellationFullRefundHours(48).cancellationPartialRefundHours(24).cancellationPartialRefundPercent(50.0)
                .returnNoticeDays(0).depositRefundSlaDays(5).dailyLateFee(new BigDecimal("50000"))
                .overdueGraceDays(1).overdueAccessDisableDays(3).overdueSealingDays(7).minimumRentalMonths(1)
                .build();
    }

    @Test
    @DisplayName("Overdue stages must be increasing (grace <= PIN lock <= sealing)")
    void createRejectsDisorderedOverdueStages() {
        FacilityPolicyCreateRequest request = baseCreate();
        request.setOverdueSealingDays(2);
        AppException ex = assertThrows(AppException.class, () -> service.create(request));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.FACILITY_POLICY_INVALID_OVERDUE_STAGES);
    }

    @Test
    @DisplayName("Updating prices edits existing rows in place, adds new rows and removes dropped ones (no duplicate unit type)")
    void updatePricesSyncsInPlace() {
        FacilityPolicy policy = policy(true);
        FacilityPolicyPrice existing = FacilityPolicyPrice.builder().facilityPolicy(policy).unitType(mini)
                .monthlyPrice(new BigDecimal("400000")).discount3MonthPercent(1.0).build();
        existing.setId(UUID.randomUUID());
        FacilityPolicyPrice dropped = FacilityPolicyPrice.builder().facilityPolicy(policy).unitType(standard)
                .monthlyPrice(new BigDecimal("2000000")).build();
        dropped.setId(UUID.randomUUID());
        policy.getPrices().add(existing);
        policy.getPrices().add(dropped);

        when(facilityPolicyRepository.findById(policy.getId())).thenReturn(Optional.of(policy));
        when(requestContext.currentUserRole()).thenReturn("BUSINESS_MANAGER");

        FacilityPolicyUpdateRequest request = new FacilityPolicyUpdateRequest();
        request.setPrices(List.of(price(mini, "450000", 5, 10, 15)));
        FacilityPolicyResponse response = service.update(policy.getId(), request);

        assertThat(policy.getPrices()).hasSize(1);
        assertThat(policy.getPrices().get(0)).isSameAs(existing); // same entity row updated, not deleted and re-inserted
        assertThat(existing.getMonthlyPrice()).isEqualByComparingTo("450000");
        assertThat(existing.getDiscount6MonthPercent()).isEqualTo(10.0);
        assertThat(response.getPrices()).hasSize(1);
        assertThat(response.getPrices().get(0).getUnitTypeName()).isEqualTo("Mini (Personal Locker)");
    }

    @Test
    @DisplayName("An update without a prices field leaves the price list untouched; an empty list clears it")
    void updateWithoutPricesKeepsList() {
        FacilityPolicy policy = policy(true);
        policy.getPrices().add(FacilityPolicyPrice.builder().facilityPolicy(policy).unitType(mini)
                .monthlyPrice(new BigDecimal("400000")).build());
        when(facilityPolicyRepository.findById(policy.getId())).thenReturn(Optional.of(policy));
        when(requestContext.currentUserRole()).thenReturn("BUSINESS_MANAGER");

        FacilityPolicyUpdateRequest keep = new FacilityPolicyUpdateRequest();
        keep.setIsActive(false);
        service.update(policy.getId(), keep);
        assertThat(policy.getPrices()).hasSize(1);
        assertThat(policy.getIsActive()).isFalse();

        FacilityPolicyUpdateRequest clear = new FacilityPolicyUpdateRequest();
        clear.setPrices(List.of());
        service.update(policy.getId(), clear);
        assertThat(policy.getPrices()).isEmpty();
    }

    @Test
    @DisplayName("Two price rows for the same unit type are rejected")
    void duplicateUnitTypeRejected() {
        FacilityPolicy policy = policy(true);
        when(facilityPolicyRepository.findById(policy.getId())).thenReturn(Optional.of(policy));
        when(requestContext.currentUserRole()).thenReturn("BUSINESS_MANAGER");

        FacilityPolicyUpdateRequest request = new FacilityPolicyUpdateRequest();
        request.setPrices(List.of(price(mini, "450000", 0, 0, 0), price(mini, "500000", 0, 0, 0)));
        AppException ex = assertThrows(AppException.class, () -> service.update(policy.getId(), request));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.FACILITY_POLICY_INVALID_PRICES);
    }

    @Test
    @DisplayName("A facility manager with an exception grant may edit rules but not the price list")
    void facilityManagerCannotEditPrices() {
        FacilityPolicy policy = policy(true);
        when(facilityPolicyRepository.findById(policy.getId())).thenReturn(Optional.of(policy));
        when(requestContext.currentUserRole()).thenReturn("FACILITY_MANAGER");
        UUID managerId = UUID.randomUUID();
        when(requestContext.currentUserId()).thenReturn(managerId);
        when(exceptionGrantRepository.existsByFacilityPolicy_IdAndUser_IdAndIsActiveTrue(policy.getId(), managerId)).thenReturn(true);

        FacilityPolicyUpdateRequest priceChange = new FacilityPolicyUpdateRequest();
        priceChange.setPrices(List.of(price(mini, "450000", 0, 0, 0)));
        AppException ex = assertThrows(AppException.class, () -> service.update(policy.getId(), priceChange));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.FORBIDDEN);

        FacilityPolicyUpdateRequest ruleChange = new FacilityPolicyUpdateRequest();
        ruleChange.setRenewalWindowDays(5);
        assertThat(service.update(policy.getId(), ruleChange).getRenewalWindowDays()).isEqualTo(5);
    }
}

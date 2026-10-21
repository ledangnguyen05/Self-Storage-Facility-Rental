package com.boxora.service;

import com.boxora.dto.request.SealingCreateRequest;
import com.boxora.dto.request.SealingUnsealRequest;
import com.boxora.dto.response.SealingRecordResponse;
import com.boxora.entity.*;
import com.boxora.enums.*;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.repository.*;
import com.boxora.security.FacilityAccessGuard;
import com.boxora.security.RequestContext;
import com.boxora.service.impl.AccessRestorationServiceImpl;
import com.boxora.service.impl.OverdueNotificationSender;
import com.boxora.service.impl.SealingServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SealingServiceTest {

    @Mock private SealingRecordRepository sealingRecordRepository;
    @Mock private RentalContractRepository rentalContractRepository;
    @Mock private StorageUnitRepository storageUnitRepository;
    @Mock private BookingRepository bookingRepository;
    @Mock private UserRepository userRepository;
    @Mock private OverdueCaseRepository overdueCaseRepository;
    @Mock private FacilityPolicyRepository facilityPolicyRepository;
    @Mock private NotificationLogRepository notificationLogRepository;
    @Mock private EmailService emailService;
    @Mock private EncryptionService encryptionService;
    @Mock private ActivityLogService activityLogService;
    @Mock private FacilityAccessGuard facilityAccessGuard;
    @Mock private RequestContext requestContext;

    private SealingServiceImpl sealingService;

    private Facility facility;
    private StorageUnit unit;
    private RentalContract contract;
    private Booking booking;
    private User customer;
    private User performer;
    private User witness;
    private final LocalDate today = LocalDate.now();

    @BeforeEach
    void setUp() {
        OverdueFeeCalculator calculator = new OverdueFeeCalculator(facilityPolicyRepository);
        OverdueNotificationSender sender = new OverdueNotificationSender(emailService, notificationLogRepository);
        AccessRestorationServiceImpl restoration = new AccessRestorationServiceImpl(rentalContractRepository, bookingRepository,
                storageUnitRepository, sealingRecordRepository, overdueCaseRepository, encryptionService, activityLogService,
                sender);
        sealingService = new SealingServiceImpl(sealingRecordRepository, rentalContractRepository, storageUnitRepository,
                bookingRepository, userRepository, overdueCaseRepository, calculator, restoration, sender,
                activityLogService, facilityAccessGuard, requestContext);

        facility = Facility.builder().name("Boxora Thủ Đức").address("Thủ Đức").contactPhone("0281234567").build();
        facility.setId(UUID.randomUUID());
        when(facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(facility.getId())).thenReturn(Optional.of(
                FacilityPolicy.builder().facility(facility).overdueGraceDays(1).overdueAccessDisableDays(3)
                        .overdueSealingDays(7).dailyLateFee(new BigDecimal("50000")).build()));

        unit = StorageUnit.builder().unitCode("TD-B116").facility(facility).status(UnitStatus.OCCUPIED).build();
        unit.setId(UUID.randomUUID());

        customer = User.builder().fullName("Trần Thị B").email("b.tran@example.com").phone("0909123456").isActive(true).build();
        customer.setId(UUID.randomUUID());

        Role manager = Role.builder().name("FACILITY_MANAGER").build();
        Role staff = Role.builder().name("STAFF").build();
        performer = User.builder().username("fm").fullName("Quản Lý A").role(manager).facility(facility).isActive(true).build();
        performer.setId(UUID.randomUUID());
        witness = User.builder().username("staff").fullName("Nhân Viên B").role(staff).facility(facility).isActive(true).build();
        witness.setId(UUID.randomUUID());

        booking = Booking.builder().bookingCode("BX-1").status(BookingStatus.ACTIVE).accessPin("enc").qrAccessToken("QR-1").build();
        booking.setId(UUID.randomUUID());

        contract = RentalContract.builder()
                .contractCode("CTR-TEST-001").facility(facility).unit(unit).customer(customer).booking(booking)
                .monthlyFee(new BigDecimal("1500000")).status(RentalContractStatus.OVERDUE)
                .startDate(today.minusMonths(2)).endDate(today.minusDays(15))
                .build();
        contract.setId(UUID.randomUUID());

        when(rentalContractRepository.findById(contract.getId())).thenReturn(Optional.of(contract));
        when(userRepository.findById(performer.getId())).thenReturn(Optional.of(performer));
        when(userRepository.findById(witness.getId())).thenReturn(Optional.of(witness));
        when(requestContext.currentUserId()).thenReturn(performer.getId());
        when(requestContext.currentUserFacilityId()).thenReturn(facility.getId());
        when(facilityAccessGuard.isFacilityScoped()).thenReturn(true);
        when(overdueCaseRepository.sumOverdueCredits(any(RentalContract.class))).thenReturn(BigDecimal.ZERO);
        when(overdueCaseRepository.findFirstByContract_IdAndStatus(any(), eq(OverdueCaseStatus.OPEN))).thenReturn(Optional.empty());
        when(sealingRecordRepository.save(any(SealingRecord.class))).thenAnswer(inv -> {
            SealingRecord r = inv.getArgument(0);
            if (r.getId() == null) {
                r.setId(UUID.randomUUID());
            }
            return r;
        });
        when(sealingRecordRepository.saveAndFlush(any(SealingRecord.class))).thenAnswer(inv -> inv.getArgument(0));
        when(sealingRecordRepository.findFirstByContract_IdAndStatusOrderBySealedAtDesc(any(), any())).thenReturn(Optional.empty());
        when(sealingRecordRepository.findFirstByStorageUnit_IdAndStatusOrderBySealedAtDesc(any(), any())).thenReturn(Optional.empty());
        when(encryptionService.encrypt(anyString())).thenReturn("enc-new");
    }

    private SealingCreateRequest request() {
        return SealingCreateRequest.builder().contractId(contract.getId()).witnessId(witness.getId())
                .sealTagNumber("TEM-0001").reason("Quá hạn 15 ngày").build();
    }

    @Test
    @DisplayName("Sealing revokes PIN/QR, locks unit and contract, and reports the email honestly")
    void sealRevokesAccess() {
        when(emailService.isMailConfigured()).thenReturn(false);

        SealingRecordResponse response = sealingService.createSealing(request());

        assertThat(response.getStatus()).isEqualTo(SealingStatus.SEALED);
        assertThat(response.getProtocolNumber()).startsWith("BBNP-");
        assertThat(response.getWitnessName()).isEqualTo("Nhân Viên B");
        assertThat(response.getCustomerNotified()).isFalse();
        assertThat(response.getNotificationMessage()).contains("Chưa gửi được email");
        assertThat(booking.getAccessPin()).isNull();
        assertThat(booking.getQrAccessToken()).isEqualTo("REVOKED_OVERDUE");
        assertThat(booking.getStatus()).isEqualTo(BookingStatus.OVERDUE);
        assertThat(unit.getStatus()).isEqualTo(UnitStatus.OVERDUE_LOCKED);
        assertThat(contract.getStatus()).isEqualTo(RentalContractStatus.OVERDUE_LOCKED);
        // 1 started rent block (1.500.000) + (15 - 1) x 50.000 late fee
        assertThat(response.getTotalDebtAmount()).isEqualByComparingTo("2200000");
    }

    @Test
    @DisplayName("Sealing before the sealing day of the policy is rejected (409)")
    void sealTooEarly() {
        contract.setEndDate(today.minusDays(4));
        AppException ex = assertThrows(AppException.class, () -> sealingService.createSealing(request()));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.OVERDUE_ACTION_NOT_ELIGIBLE);
        assertThat(ex.getMessage()).contains("ngày quá hạn thứ 7");
        verify(sealingRecordRepository, never()).save(any());
    }

    @Test
    @DisplayName("Unit without an overdue contract: clear 409 instead of a NullPointerException")
    void unitWithoutContract() {
        when(storageUnitRepository.findById(unit.getId())).thenReturn(Optional.of(unit));
        when(rentalContractRepository.findFirstByUnit_IdOrderByCreatedAtDesc(unit.getId())).thenReturn(Optional.empty());
        SealingCreateRequest req = SealingCreateRequest.builder().unitId(unit.getId()).witnessId(witness.getId()).build();

        AppException ex = assertThrows(AppException.class, () -> sealingService.createSealing(req));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.SEALING_CONTRACT_REQUIRED);
    }

    @Test
    @DisplayName("The witness must be active staff of the same facility, not the performer")
    void witnessRules() {
        Facility other = Facility.builder().name("Khác").build();
        other.setId(UUID.randomUUID());
        witness.setFacility(other);
        AppException ex = assertThrows(AppException.class, () -> sealingService.createSealing(request()));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.SEALING_WITNESS_INVALID);

        witness.setFacility(facility);
        SealingCreateRequest self = SealingCreateRequest.builder().contractId(contract.getId()).witnessId(performer.getId()).build();
        AppException selfEx = assertThrows(AppException.class, () -> sealingService.createSealing(self));
        assertThat(selfEx.getErrorCode()).isEqualTo(ErrorCode.SEALING_WITNESS_INVALID);
    }

    @Test
    @DisplayName("A seal tag number can only be used once")
    void duplicateTag() {
        when(sealingRecordRepository.existsBySealTagNumberIgnoreCase("TEM-0001")).thenReturn(true);
        AppException ex = assertThrows(AppException.class, () -> sealingService.createSealing(request()));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.SEAL_TAG_ALREADY_USED);
    }

    @Test
    @DisplayName("Unsealing reopens access (new PIN, unit occupied) and never releases the unit to AVAILABLE")
    void unsealRestoresAccess() {
        contract.setStatus(RentalContractStatus.OVERDUE_LOCKED);
        booking.setStatus(BookingStatus.OVERDUE);
        booking.setAccessPin(null);
        unit.setStatus(UnitStatus.OVERDUE_LOCKED);
        SealingRecord record = SealingRecord.builder().contract(contract).unit(unit).facility(facility)
                .performedBy(performer).witness(witness).protocolNumber("BBNP-1").sealTagNumber("TEM-0001")
                .status(SealingStatus.SEALED).build();
        record.setId(UUID.randomUUID());
        when(sealingRecordRepository.findById(record.getId())).thenReturn(Optional.of(record));
        when(emailService.isMailConfigured()).thenReturn(true);

        SealingRecordResponse response = sealingService.unseal(record.getId(),
                SealingUnsealRequest.builder().reason("Khách đã thanh toán tại quầy").holdUntil(today.plusDays(3)).build());

        assertThat(response.getStatus()).isEqualTo(SealingStatus.UNSEALED);
        assertThat(response.getAccessRestoration()).isNotNull();
        assertThat(response.getAccessRestoration().isPinReissued()).isTrue();
        assertThat(response.getAccessRestoration().getAccessHoldUntil()).isEqualTo(today.plusDays(3));
        assertThat(response.getCustomerNotified()).isTrue();
        assertThat(unit.getStatus()).isEqualTo(UnitStatus.OCCUPIED);
        assertThat(booking.getStatus()).isEqualTo(BookingStatus.ACTIVE);
        assertThat(contract.getStatus()).isEqualTo(RentalContractStatus.OVERDUE);
        verify(emailService).sendNow(eq("b.tran@example.com"), anyString(), anyString());
    }

    @Test
    @DisplayName("A customer cannot read another customer's sealing record")
    void customerOwnership() {
        when(requestContext.currentUserRole()).thenReturn("CUSTOMER");
        when(requestContext.currentUserId()).thenReturn(UUID.randomUUID());
        AppException ex = assertThrows(AppException.class, () -> sealingService.getActiveSealingByContractId(contract.getId()));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.CONTRACT_NOT_FOUND);
    }
}

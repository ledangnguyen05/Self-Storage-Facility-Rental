package com.boxora.service;

import com.boxora.dto.response.AccessRestorationResponse;
import com.boxora.dto.response.LockoutResponse;
import com.boxora.dto.response.OverdueLedgerItemResponse;
import com.boxora.dto.response.OverdueLedgerResponse;
import com.boxora.dto.response.OverdueProcessResult;
import com.boxora.dto.response.OverdueReminderResponse;
import com.boxora.entity.*;
import com.boxora.enums.*;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.repository.*;
import com.boxora.security.FacilityAccessGuard;
import com.boxora.security.RequestContext;
import com.boxora.service.impl.AccessRestorationServiceImpl;
import com.boxora.service.impl.OverdueNotificationSender;
import com.boxora.service.impl.OverdueProcessingServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.transaction.PlatformTransactionManager;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class OverdueProcessingServiceTest {

    @Mock private RentalContractRepository rentalContractRepository;
    @Mock private BookingRepository bookingRepository;
    @Mock private StorageUnitRepository storageUnitRepository;
    @Mock private SealingRecordRepository sealingRecordRepository;
    @Mock private OverdueCaseRepository overdueCaseRepository;
    @Mock private FacilityPolicyRepository facilityPolicyRepository;
    @Mock private NotificationLogRepository notificationLogRepository;
    @Mock private ActivityLogService activityLogService;
    @Mock private FacilityAccessGuard facilityAccessGuard;
    @Mock private RequestContext requestContext;
    @Mock private EncryptionService encryptionService;
    @Mock private EmailService emailService;
    @Mock private PlatformTransactionManager transactionManager;

    private OverdueFeeCalculator calculator;
    private AccessRestorationServiceImpl accessRestorationService;
    private OverdueProcessingServiceImpl service;

    private Facility facility;
    private FacilityPolicy policy;
    private StorageUnit unit;
    private User customer;
    private Booking booking;
    private RentalContract contract;
    private final LocalDate today = LocalDate.now();

    @BeforeEach
    void setUp() {
        calculator = new OverdueFeeCalculator(facilityPolicyRepository);
        OverdueNotificationSender sender = new OverdueNotificationSender(emailService, notificationLogRepository);
        accessRestorationService = new AccessRestorationServiceImpl(rentalContractRepository, bookingRepository,
                storageUnitRepository, sealingRecordRepository, overdueCaseRepository, encryptionService, activityLogService,
                sender);
        service = new OverdueProcessingServiceImpl(rentalContractRepository, bookingRepository, storageUnitRepository,
                sealingRecordRepository, overdueCaseRepository, activityLogService, facilityAccessGuard, requestContext,
                calculator, accessRestorationService, sender, transactionManager);

        facility = Facility.builder().name("Boxora District 1").code("D1").address("1 Lê Lợi").build();
        facility.setId(UUID.randomUUID());

        policy = FacilityPolicy.builder()
                .facility(facility)
                .overdueGraceDays(1)
                .overdueAccessDisableDays(3)
                .overdueSealingDays(7)
                .dailyLateFee(new BigDecimal("50000"))
                .build();
        when(facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(facility.getId())).thenReturn(Optional.of(policy));

        unit = StorageUnit.builder().unitCode("D1-A102").facility(facility).status(UnitStatus.OCCUPIED).build();
        unit.setId(UUID.randomUUID());

        customer = User.builder().fullName("Nguyễn Văn A").email("customer@gmail.com").phone("0901234567").build();
        customer.setId(UUID.randomUUID());

        booking = Booking.builder().bookingCode("BX-2026-0001").status(BookingStatus.ACTIVE)
                .accessPin("encrypted-pin").qrAccessToken("QR-ABCDEF12").build();
        booking.setId(UUID.randomUUID());

        contract = RentalContract.builder()
                .contractCode("CTR-2026-1001")
                .customer(customer)
                .unit(unit)
                .facility(facility)
                .booking(booking)
                .startDate(today.minusMonths(6))
                .endDate(today.minusDays(5))
                .monthlyFee(new BigDecimal("1250000"))
                .status(RentalContractStatus.ACTIVE)
                .build();
        contract.setId(UUID.randomUUID());

        when(rentalContractRepository.findById(contract.getId())).thenReturn(Optional.of(contract));
        when(overdueCaseRepository.sumOverdueCredits(any(RentalContract.class))).thenReturn(BigDecimal.ZERO);
        when(overdueCaseRepository.findFirstByContract_IdAndStatus(any(), eq(OverdueCaseStatus.OPEN))).thenReturn(Optional.empty());
        when(overdueCaseRepository.save(any(OverdueCase.class))).thenAnswer(inv -> inv.getArgument(0));
        when(sealingRecordRepository.findFirstByContract_IdAndStatusOrderBySealedAtDesc(any(), eq(SealingStatus.SEALED))).thenReturn(Optional.empty());
        when(sealingRecordRepository.findFirstByStorageUnit_IdAndStatusOrderBySealedAtDesc(any(), eq(SealingStatus.SEALED))).thenReturn(Optional.empty());
        when(facilityAccessGuard.isFacilityScoped()).thenReturn(true);
        when(requestContext.currentUserFacilityId()).thenReturn(facility.getId());
        when(requestContext.currentUserRole()).thenReturn("FACILITY_MANAGER");
        when(encryptionService.encrypt(anyString())).thenAnswer(inv -> "enc:" + inv.getArgument(0));
    }

    @Nested
    @DisplayName("OverdueFeeCalculator: one rule driven by the facility policy")
    class CalculatorTests {

        @Test
        @DisplayName("Late fee is charged only for the days past the grace period")
        void lateFeeExcludesGraceDays() {
            contract.setEndDate(today.minusDays(5));
            assertThat(calculator.daysOverdue(contract, today)).isEqualTo(5);
            assertThat(calculator.calculateLateFee(contract, today)).isEqualByComparingTo("200000"); // 4 x 50k
            contract.setEndDate(today.minusDays(1));
            assertThat(calculator.calculateLateFee(contract, today)).isEqualByComparingTo("0");
            contract.setEndDate(today);
            assertThat(calculator.daysOverdue(contract, today)).isZero();
        }

        @Test
        @DisplayName("Stages follow the policy: blocked from the access-disable day, sealing from the sealing day")
        void stagesFollowPolicy() {
            OverdueFeeCalculator.OverduePolicy p = calculator.policyFor(facility.getId());
            assertThat(calculator.stageOf(1, p)).isEqualTo(OverdueFeeCalculator.Stage.GRACE_PERIOD);
            assertThat(calculator.stageOf(2, p)).isEqualTo(OverdueFeeCalculator.Stage.WARNING);
            assertThat(calculator.stageOf(3, p)).isEqualTo(OverdueFeeCalculator.Stage.ACCESS_BLOCKED);
            assertThat(calculator.stageOf(7, p)).isEqualTo(OverdueFeeCalculator.Stage.ELIGIBLE_FOR_SEALING);

            policy.setOverdueSealingDays(10);
            OverdueFeeCalculator.OverduePolicy custom = calculator.policyFor(facility.getId());
            assertThat(calculator.stageOf(7, custom)).isEqualTo(OverdueFeeCalculator.Stage.ACCESS_BLOCKED);
        }

        @Test
        @DisplayName("Facility without policy uses the documented defaults (50.000 ₫/day, 1/3/7 days)")
        void defaultsWithoutPolicy() {
            UUID other = UUID.randomUUID();
            when(facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(other)).thenReturn(Optional.empty());
            OverdueFeeCalculator.OverduePolicy p = calculator.policyFor(other);
            assertThat(p.fromFacilityPolicy()).isFalse();
            assertThat(p.dailyLateFee()).isEqualByComparingTo("50000");
            assertThat(p.graceDays()).isEqualTo(1);
            assertThat(p.accessDisableDays()).isEqualTo(3);
            assertThat(p.sealingDays()).isEqualTo(7);
        }

        @Test
        @DisplayName("Debt = rent for started 30-day blocks + late fee - payments after the due date, never negative")
        void assessmentDeductsCredits() {
            contract.setEndDate(today.minusDays(31));
            OverdueFeeCalculator.OverdueAssessment a = calculator.assess(contract, today, new BigDecimal("500000"));
            assertThat(a.overdueRent()).isEqualByComparingTo("2500000"); // 2 blocks x 1.25M
            assertThat(a.lateFee()).isEqualByComparingTo("1500000"); // 30 x 50k
            assertThat(a.totalDebt()).isEqualByComparingTo("3500000");
            assertThat(calculator.assess(contract, today, new BigDecimal("99000000")).totalDebt()).isEqualByComparingTo("0");
        }
    }

    @Nested
    @DisplayName("Ledger")
    class LedgerTests {

        @Test
        @DisplayName("Contracts already OVERDUE (cron / lockout) and OVERDUE_LOCKED stay in the ledger with the right stage")
        void ledgerKeepsOverdueContracts() {
            contract.setStatus(RentalContractStatus.OVERDUE);
            contract.setEndDate(today.minusDays(4));
            booking.setStatus(BookingStatus.OVERDUE);
            booking.setAccessPin(null);
            booking.setQrAccessToken("REVOKED_OVERDUE");
            unit.setStatus(UnitStatus.OVERDUE_LOCKED);

            RentalContract lockedContract = RentalContract.builder()
                    .contractCode("CTR-2026-OVD-003").customer(customer).facility(facility)
                    .unit(StorageUnit.builder().unitCode("D1-A104").facility(facility).status(UnitStatus.OVERDUE_LOCKED).build())
                    .startDate(today.minusMonths(6)).endDate(today.minusDays(12))
                    .monthlyFee(new BigDecimal("3200000")).status(RentalContractStatus.OVERDUE_LOCKED).build();
            lockedContract.setId(UUID.randomUUID());
            SealingRecord seal = SealingRecord.builder().contract(lockedContract).protocolNumber("BBNP-1")
                    .status(SealingStatus.SEALED).sealTagNumber("TEM-1").build();
            seal.setId(UUID.randomUUID());

            when(overdueCaseRepository.findOverdueContracts(today, facility.getId())).thenReturn(List.of(contract, lockedContract));
            when(sealingRecordRepository.findByStatusAndContract_IdIn(eq(SealingStatus.SEALED), any())).thenReturn(List.of(seal));
            when(overdueCaseRepository.findByStatusAndContractIds(eq(OverdueCaseStatus.OPEN), any())).thenReturn(List.of());

            OverdueLedgerResponse ledger = service.getOverdueLedger(null);

            assertThat(ledger.getFacilityId()).isEqualTo(facility.getId());
            assertThat(ledger.getItems()).hasSize(2);
            OverdueLedgerItemResponse first = ledger.getItems().get(0);
            assertThat(first.getContractCode()).isEqualTo("CTR-2026-OVD-003");
            assertThat(first.getOverdueStage()).isEqualTo("ELIGIBLE_FOR_SEALING");
            assertThat(first.isSealed()).isTrue();
            assertThat(first.isCanSeal()).isFalse();
            assertThat(first.isCanUnseal()).isTrue();

            OverdueLedgerItemResponse second = ledger.getItems().get(1);
            assertThat(second.getContractStatus()).isEqualTo("OVERDUE");
            assertThat(second.getOverdueStage()).isEqualTo("ACCESS_BLOCKED");
            assertThat(second.isAccessLocked()).isTrue();
            assertThat(second.isCanRestoreAccess()).isTrue();
            assertThat(second.getTotalLateFee()).isEqualByComparingTo("150000");
            assertThat(second.getUnpaidRent()).isEqualByComparingTo("1250000");
            assertThat(ledger.getAccessLockedCount()).isEqualTo(2);
            assertThat(ledger.getSealedCount()).isEqualTo(1);
            assertThat(ledger.getPolicy().getSealingDays()).isEqualTo(7);
        }

        @Test
        @DisplayName("A facility manager cannot read another facility's ledger")
        void ledgerIsFacilityScoped() {
            AppException ex = assertThrows(AppException.class, () -> service.getOverdueLedger(UUID.randomUUID()));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.FACILITY_ACCESS_DENIED);
        }
    }

    @Nested
    @DisplayName("Nightly assessment")
    class ProcessTests {

        @Test
        @DisplayName("Uses the facility policy: persists the fee, locks access from the access-disable day, never fabricates a seal")
        void processUsesPolicy() {
            policy.setOverdueSealingDays(10);
            contract.setEndDate(today.minusDays(7));
            when(overdueCaseRepository.findOverdueContracts(today, facility.getId())).thenReturn(List.of(contract));
            when(overdueCaseRepository.findAllByStatusWithContract(OverdueCaseStatus.OPEN, facility.getId())).thenReturn(List.of());

            OverdueProcessResult result = service.processOverdueContracts(null, null);

            assertThat(result.getPinDisabledCount()).isEqualTo(1);
            assertThat(result.getSealingEligibleCount()).isZero();
            assertThat(result.getDetails()).hasSize(1);
            assertThat(result.getDetails().get(0).getOverdueStage()).isEqualTo("ACCESS_BLOCKED");
            assertThat(contract.getStatus()).isEqualTo(RentalContractStatus.OVERDUE);
            assertThat(booking.getStatus()).isEqualTo(BookingStatus.OVERDUE);
            assertThat(booking.getAccessPin()).isNull();
            assertThat(unit.getStatus()).isEqualTo(UnitStatus.OVERDUE_LOCKED);

            ArgumentCaptor<OverdueCase> captor = ArgumentCaptor.forClass(OverdueCase.class);
            verify(overdueCaseRepository, atLeastOnce()).save(captor.capture());
            OverdueCase saved = captor.getValue();
            assertThat(saved.getLateFeeAmount()).isEqualByComparingTo("300000"); // (7 - 1) x 50k
            assertThat(saved.getDaysOverdue()).isEqualTo(7);
            verify(sealingRecordRepository, never()).save(any());
        }

        @Test
        @DisplayName("A manager reprieve (hold date) stops the job from locking access again")
        void holdPreventsRelock() {
            contract.setStatus(RentalContractStatus.OVERDUE);
            OverdueCase open = OverdueCase.builder().contract(contract).facility(facility).dueDate(contract.getEndDate())
                    .accessHoldUntil(today.plusDays(2)).build();
            when(overdueCaseRepository.findFirstByContract_IdAndStatus(contract.getId(), OverdueCaseStatus.OPEN)).thenReturn(Optional.of(open));
            when(overdueCaseRepository.findOverdueContracts(today, facility.getId())).thenReturn(List.of(contract));
            when(overdueCaseRepository.findAllByStatusWithContract(OverdueCaseStatus.OPEN, facility.getId())).thenReturn(List.of());

            OverdueProcessResult result = service.processOverdueContracts(null, null);

            assertThat(result.getOnHoldCount()).isEqualTo(1);
            assertThat(result.getPinDisabledCount()).isZero();
            assertThat(booking.getAccessPin()).isEqualTo("encrypted-pin");
        }

        @Test
        @DisplayName("A facility manager cannot run the job for another date")
        void managerCannotSimulateDates() {
            AppException ex = assertThrows(AppException.class,
                    () -> service.processOverdueContracts(today.plusDays(30), null));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.OVERDUE_PROCESS_FORBIDDEN);
        }

        @Test
        @DisplayName("An EXPIRED contract whose tenant never returned the unit is treated as overdue, not as ended")
        void expiredButHeldIsOverdue() {
            contract.setStatus(RentalContractStatus.EXPIRED);
            contract.setEndDate(today.minusDays(4));
            when(overdueCaseRepository.findOverdueContracts(today, facility.getId())).thenReturn(List.of(contract));
            when(overdueCaseRepository.findAllByStatusWithContract(OverdueCaseStatus.OPEN, facility.getId())).thenReturn(List.of());
            when(overdueCaseRepository.findEndedContractsWithLiveCredentials(any())).thenReturn(List.of(contract));

            // The 02:00 credential cleanup must leave it to the overdue rule.
            service.cleanupExpiredCredentials();
            assertThat(booking.getAccessPin()).isEqualTo("encrypted-pin");

            OverdueProcessResult result = service.processOverdueContracts(null, null);

            assertThat(result.getDetails()).hasSize(1);
            assertThat(contract.getStatus()).isEqualTo(RentalContractStatus.OVERDUE);
            assertThat(result.getPinDisabledCount()).isEqualTo(1);
            assertThat(booking.getAccessPin()).isNull();
            assertThat(unit.getStatus()).isEqualTo(UnitStatus.OVERDUE_LOCKED);
        }
    }

    @Nested
    @DisplayName("Lockout and access restoration")
    class LockoutTests {

        @Test
        @DisplayName("Lockout before the access-disable day is rejected with a clear message")
        void lockoutTooEarly() {
            contract.setEndDate(today.minusDays(2));
            AppException ex = assertThrows(AppException.class, () -> service.lockoutContract(contract.getId(), null));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.OVERDUE_ACTION_NOT_ELIGIBLE);
            assertThat(ex.getMessage()).contains("ngày quá hạn thứ 3");
            assertThat(booking.getAccessPin()).isEqualTo("encrypted-pin");
        }

        @Test
        @DisplayName("Lockout revokes the PIN/QR and locks the unit")
        void lockoutRevokesAccess() {
            LockoutResponse response = service.lockoutContract(contract.getId(), "Quá hạn");
            assertThat(response.getStatus()).isEqualTo("SUCCESS");
            assertThat(booking.getAccessPin()).isNull();
            assertThat(booking.getQrAccessToken()).isEqualTo("REVOKED_OVERDUE");
            assertThat(unit.getStatus()).isEqualTo(UnitStatus.OVERDUE_LOCKED);
            assertThat(contract.getStatus()).isEqualTo(RentalContractStatus.OVERDUE);
        }

        @Test
        @DisplayName("Mở khóa truy cập while still overdue: new PIN, unit occupied, contract stays overdue with a hold date")
        void restoreWhileStillOverdue() {
            service.lockoutContract(contract.getId(), "Quá hạn");

            AccessRestorationResponse r = service.restoreAccess(contract.getId(), "Khách hẹn thanh toán", today.plusDays(5));

            assertThat(r.isAccessRestored()).isTrue();
            assertThat(r.isPinReissued()).isTrue();
            assertThat(r.isSettled()).isFalse();
            assertThat(r.getAccessHoldUntil()).isEqualTo(today.plusDays(5));
            assertThat(booking.getStatus()).isEqualTo(BookingStatus.ACTIVE);
            assertThat(booking.getAccessPin()).startsWith("enc:");
            assertThat(unit.getStatus()).isEqualTo(UnitStatus.OCCUPIED);
            assertThat(contract.getStatus()).isEqualTo(RentalContractStatus.OVERDUE);
        }

        @Test
        @DisplayName("Lockout notifies the tenant: one in-app notification, plus an email when mail is configured")
        void lockoutNotifiesTenant() {
            when(emailService.isMailConfigured()).thenReturn(true);

            LockoutResponse response = service.lockoutContract(contract.getId(), null);

            verify(emailService).sendNow(eq("customer@gmail.com"), anyString(), anyString());
            ArgumentCaptor<NotificationLog> log = ArgumentCaptor.forClass(NotificationLog.class);
            verify(notificationLogRepository).save(log.capture());
            assertThat(log.getValue().getChannel()).isEqualTo(NotificationChannel.IN_APP);
            assertThat(log.getValue().getRecipient()).isSameAs(customer);
            assertThat(log.getValue().getTitle()).contains("D1-A102").contains("đã bị khóa");
            assertThat(log.getValue().getContent()).contains("₫").doesNotContain("enc:");
            assertThat(response.getCustomerNotified()).isTrue();
            assertThat(response.getNotificationMessage()).contains("customer@gmail.com");
        }

        @Test
        @DisplayName("Lockout without mail configured still leaves an in-app notification and never claims an email")
        void lockoutWithoutMailStillNotifiesInApp() {
            when(emailService.isMailConfigured()).thenReturn(false);

            LockoutResponse response = service.lockoutContract(contract.getId(), "Quá hạn");

            verify(emailService, never()).sendNow(anyString(), anyString(), anyString());
            ArgumentCaptor<NotificationLog> log = ArgumentCaptor.forClass(NotificationLog.class);
            verify(notificationLogRepository).save(log.capture());
            assertThat(log.getValue().getChannel()).isEqualTo(NotificationChannel.IN_APP);
            assertThat(log.getValue().getContent()).contains("Email thông báo chưa được gửi");
            assertThat(response.getCustomerNotified()).isFalse();
            assertThat(response.getStatus()).isEqualTo("SUCCESS");
        }

        @Test
        @DisplayName("A failing mail server never rolls back the lockout")
        void lockoutSurvivesMailFailure() {
            when(emailService.isMailConfigured()).thenReturn(true);
            doThrow(new AppException(ErrorCode.EMAIL_SEND_FAILED)).when(emailService).sendNow(anyString(), anyString(), anyString());

            LockoutResponse response = service.lockoutContract(contract.getId(), null);

            assertThat(response.getStatus()).isEqualTo("SUCCESS");
            assertThat(response.getCustomerNotified()).isFalse();
            assertThat(booking.getAccessPin()).isNull();
        }

        @Test
        @DisplayName("Lockout during an access hold needs an explicit override flag and a written reason")
        void lockoutDuringHoldNeedsOverride() {
            OverdueCase held = OverdueCase.builder().contract(contract).facility(facility).dueDate(contract.getEndDate())
                    .status(OverdueCaseStatus.OPEN).accessHoldUntil(today.plusDays(3)).build();
            when(overdueCaseRepository.findFirstByContract_IdAndStatus(contract.getId(), OverdueCaseStatus.OPEN))
                    .thenReturn(Optional.of(held));

            // A plain lockout (even with a reason, as the old client always sent) is refused while the hold runs.
            AppException plain = assertThrows(AppException.class, () -> service.lockoutContract(contract.getId(), null));
            assertThat(plain.getErrorCode()).isEqualTo(ErrorCode.OVERDUE_LOCKOUT_HOLD_ACTIVE);
            AppException withReason = assertThrows(AppException.class, () -> service.lockoutContract(contract.getId(), "Quá hạn"));
            assertThat(withReason.getErrorCode()).isEqualTo(ErrorCode.OVERDUE_LOCKOUT_HOLD_ACTIVE);
            // Overriding without saying why is refused too.
            AppException blank = assertThrows(AppException.class, () -> service.lockoutContract(contract.getId(), "   ", true));
            assertThat(blank.getErrorCode()).isEqualTo(ErrorCode.OVERDUE_LOCKOUT_HOLD_ACTIVE);
            assertThat(booking.getAccessPin()).isEqualTo("encrypted-pin");
            assertThat(unit.getStatus()).isEqualTo(UnitStatus.OCCUPIED);

            LockoutResponse response = service.lockoutContract(contract.getId(), "Khách từ chối thanh toán", true);
            assertThat(response.getStatus()).isEqualTo("SUCCESS");
            assertThat(response.getReason()).contains("Khóa sớm").contains("Khách từ chối thanh toán");
            assertThat(booking.getAccessPin()).isNull();
            assertThat(held.getAccessHoldUntil()).isNull();
        }

        @Test
        @DisplayName("An expired access hold no longer blocks a plain lockout")
        void expiredHoldDoesNotBlockLockout() {
            OverdueCase stale = OverdueCase.builder().contract(contract).facility(facility).dueDate(contract.getEndDate())
                    .status(OverdueCaseStatus.OPEN).accessHoldUntil(today.minusDays(1)).build();
            when(overdueCaseRepository.findFirstByContract_IdAndStatus(contract.getId(), OverdueCaseStatus.OPEN))
                    .thenReturn(Optional.of(stale));

            assertThat(service.lockoutContract(contract.getId(), null).getStatus()).isEqualTo("SUCCESS");
        }

        @Test
        @DisplayName("Manager restore tells the tenant by email and in-app and never puts the PIN in the notice")
        void restoreNotifiesTenant() {
            service.lockoutContract(contract.getId(), "Quá hạn");
            reset(notificationLogRepository, emailService);
            when(emailService.isMailConfigured()).thenReturn(true);

            AccessRestorationResponse r = service.restoreAccess(contract.getId(), "Khách hẹn thanh toán", today.plusDays(5));

            ArgumentCaptor<String> html = ArgumentCaptor.forClass(String.class);
            verify(emailService).sendNow(eq("customer@gmail.com"), anyString(), html.capture());
            assertThat(html.getValue()).doesNotContain(booking.getAccessPin());
            ArgumentCaptor<NotificationLog> log = ArgumentCaptor.forClass(NotificationLog.class);
            verify(notificationLogRepository).save(log.capture());
            assertThat(log.getValue().getChannel()).isEqualTo(NotificationChannel.IN_APP);
            assertThat(log.getValue().getTitle()).contains("đã được mở lại");
            assertThat(r.getCustomerNotified()).isTrue();
            assertThat(r.getNotificationMessage()).contains("customer@gmail.com");
        }

        @Test
        @DisplayName("Settlement restore notifies in-app only (the payment already sends its own confirmation)")
        void settlementRestoreIsInAppOnly() {
            service.lockoutContract(contract.getId(), "Quá hạn");
            reset(notificationLogRepository, emailService);
            when(emailService.isMailConfigured()).thenReturn(true);
            contract.setEndDate(today.plusMonths(1));

            accessRestorationService.restoreAccessAfterSettlement(contract.getId(), "Đã gia hạn");

            verify(emailService, never()).sendNow(anyString(), anyString(), anyString());
            ArgumentCaptor<NotificationLog> log = ArgumentCaptor.forClass(NotificationLog.class);
            verify(notificationLogRepository).save(log.capture());
            assertThat(log.getValue().getChannel()).isEqualTo(NotificationChannel.IN_APP);
        }

        @Test
        @DisplayName("Restoring access that is not locked is rejected")
        void restoreNotLocked() {
            AppException ex = assertThrows(AppException.class,
                    () -> service.restoreAccess(contract.getId(), "Thử", null));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.OVERDUE_ACCESS_NOT_LOCKED);
        }

        @Test
        @DisplayName("After settlement (renewed): contract ACTIVE, episode settled; a sealed unit is left for the manager")
        void restoreAfterSettlement() {
            service.lockoutContract(contract.getId(), "Quá hạn");
            OverdueCase open = OverdueCase.builder().contract(contract).facility(facility).dueDate(contract.getEndDate())
                    .status(OverdueCaseStatus.OPEN).build();
            when(overdueCaseRepository.findFirstByContract_IdAndStatus(contract.getId(), OverdueCaseStatus.OPEN)).thenReturn(Optional.of(open));
            contract.setEndDate(today.plusMonths(1));

            accessRestorationService.restoreAccessAfterSettlement(contract.getId(), "Đã gia hạn");

            assertThat(contract.getStatus()).isEqualTo(RentalContractStatus.ACTIVE);
            assertThat(booking.getStatus()).isEqualTo(BookingStatus.ACTIVE);
            assertThat(unit.getStatus()).isEqualTo(UnitStatus.OCCUPIED);
            assertThat(open.getStatus()).isEqualTo(OverdueCaseStatus.SETTLED);

            // Sealed: nothing reopens, and the payment flow never sees an exception.
            booking.setStatus(BookingStatus.OVERDUE);
            booking.setAccessPin(null);
            SealingRecord seal = SealingRecord.builder().contract(contract).protocolNumber("BBNP-2").status(SealingStatus.SEALED).build();
            when(sealingRecordRepository.findFirstByContract_IdAndStatusOrderBySealedAtDesc(contract.getId(), SealingStatus.SEALED))
                    .thenReturn(Optional.of(seal));
            assertDoesNotThrow(() -> accessRestorationService.restoreAccessAfterSettlement(contract.getId(), "Đã thanh toán"));
            assertThat(booking.getStatus()).isEqualTo(BookingStatus.OVERDUE);
        }
    }

    @Nested
    @DisplayName("Reminders")
    class ReminderTests {

        @Test
        @DisplayName("Mail not configured: 503 with a Vietnamese message, nothing claimed as sent")
        void mailNotConfigured() {
            when(emailService.isMailConfigured()).thenReturn(false);
            AppException ex = assertThrows(AppException.class, () -> service.sendReminder(contract.getId()));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.OVERDUE_REMINDER_EMAIL_UNAVAILABLE);
            verify(emailService, never()).sendNow(anyString(), anyString(), anyString());
        }

        @Test
        @DisplayName("SMTP failure: EMAIL_SEND_FAILED and a FAILED notification log")
        void smtpFailure() {
            when(emailService.isMailConfigured()).thenReturn(true);
            doThrow(new AppException(ErrorCode.EMAIL_SEND_FAILED)).when(emailService).sendNow(anyString(), anyString(), anyString());

            AppException ex = assertThrows(AppException.class, () -> service.sendReminder(contract.getId()));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.EMAIL_SEND_FAILED);
            ArgumentCaptor<NotificationLog> log = ArgumentCaptor.forClass(NotificationLog.class);
            verify(notificationLogRepository).save(log.capture());
            assertThat(log.getValue().getStatus()).isEqualTo("FAILED");
        }

        @Test
        @DisplayName("Success only after the mail server accepted the message")
        void success() {
            when(emailService.isMailConfigured()).thenReturn(true);
            OverdueReminderResponse r = service.sendReminder(contract.getId());
            assertThat(r.getSentTo()).isEqualTo("customer@gmail.com");
            assertThat(r.getReminderCount()).isEqualTo(1);
            verify(emailService).sendNow(eq("customer@gmail.com"), anyString(), anyString());
        }

        @Test
        @DisplayName("A second reminder right after a successful one is refused instead of emailing the tenant twice")
        void secondReminderWithinCooldownIsRefused() {
            when(emailService.isMailConfigured()).thenReturn(true);
            OverdueCase recent = OverdueCase.builder().contract(contract).facility(facility).dueDate(contract.getEndDate())
                    .status(OverdueCaseStatus.OPEN).lastReminderStatus("SENT").lastReminderAt(java.time.LocalDateTime.now().minusSeconds(5))
                    .reminderCount(1).build();
            when(overdueCaseRepository.findFirstByContract_IdAndStatus(contract.getId(), OverdueCaseStatus.OPEN))
                    .thenReturn(Optional.of(recent));

            AppException ex = assertThrows(AppException.class, () -> service.sendReminder(contract.getId()));

            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.OVERDUE_REMINDER_TOO_SOON);
            verify(emailService, never()).sendNow(anyString(), anyString(), anyString());
        }

        @Test
        @DisplayName("A reminder after the cooldown, or after a failed one, goes out")
        void reminderAfterCooldownIsSent() {
            when(emailService.isMailConfigured()).thenReturn(true);
            OverdueCase old = OverdueCase.builder().contract(contract).facility(facility).dueDate(contract.getEndDate())
                    .status(OverdueCaseStatus.OPEN).lastReminderStatus("SENT").lastReminderAt(java.time.LocalDateTime.now().minusMinutes(5))
                    .reminderCount(1).build();
            when(overdueCaseRepository.findFirstByContract_IdAndStatus(contract.getId(), OverdueCaseStatus.OPEN))
                    .thenReturn(Optional.of(old));

            assertThat(service.sendReminder(contract.getId()).getReminderCount()).isEqualTo(2);

            old.setLastReminderStatus("FAILED");
            old.setLastReminderAt(java.time.LocalDateTime.now());
            assertThat(service.sendReminder(contract.getId()).getReminderCount()).isEqualTo(3);
        }

        @Test
        @DisplayName("Customer without email: 400 instead of a fake success")
        void noEmail() {
            customer.setEmail(null);
            AppException ex = assertThrows(AppException.class, () -> service.sendReminder(contract.getId()));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.OVERDUE_REMINDER_NO_EMAIL);
        }
    }
}

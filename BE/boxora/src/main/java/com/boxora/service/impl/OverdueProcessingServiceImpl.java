package com.boxora.service.impl;

import com.boxora.dto.response.AccessRestorationResponse;
import com.boxora.dto.response.LockoutResponse;
import com.boxora.dto.response.OverdueContractDetail;
import com.boxora.dto.response.OverdueLedgerItemResponse;
import com.boxora.dto.response.OverdueLedgerResponse;
import com.boxora.dto.response.OverduePolicyResponse;
import com.boxora.dto.response.OverdueProcessResult;
import com.boxora.dto.response.OverdueReminderResponse;
import com.boxora.entity.Booking;
import com.boxora.entity.Facility;
import com.boxora.entity.OverdueCase;
import com.boxora.entity.RentalContract;
import com.boxora.entity.SealingRecord;
import com.boxora.entity.StorageUnit;
import com.boxora.entity.User;
import com.boxora.enums.ActivityAction;
import com.boxora.enums.BookingStatus;
import com.boxora.enums.NotificationType;
import com.boxora.enums.OverdueCaseStatus;
import com.boxora.enums.RentalContractStatus;
import com.boxora.enums.SealingStatus;
import com.boxora.enums.UnitStatus;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.repository.BookingRepository;
import com.boxora.repository.OverdueCaseRepository;
import com.boxora.repository.RentalContractRepository;
import com.boxora.repository.SealingRecordRepository;
import com.boxora.repository.StorageUnitRepository;
import com.boxora.security.FacilityAccessGuard;
import com.boxora.security.RequestContext;
import com.boxora.service.ActivityLogService;
import com.boxora.service.OverdueFeeCalculator;
import com.boxora.service.OverdueFeeCalculator.OverdueAssessment;
import com.boxora.service.OverdueFeeCalculator.OverduePolicy;
import com.boxora.service.OverdueFeeCalculator.Stage;
import com.boxora.service.OverdueProcessingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;
import java.util.stream.Collectors;

import static com.boxora.service.impl.OverdueNotificationSender.date;
import static com.boxora.service.impl.OverdueNotificationSender.money;

@Service
@RequiredArgsConstructor
@Slf4j
public class OverdueProcessingServiceImpl implements OverdueProcessingService {

    private static final Set<String> SYSTEM_WIDE_ROLES = Set.of("ADMIN", "BUSINESS_MANAGER");
    private static final Set<RentalContractStatus> ENDED_STATUSES =
            EnumSet.of(RentalContractStatus.EXPIRED, RentalContractStatus.TERMINATED, RentalContractStatus.CANCELLED);
    /** Bookings in a return flow are settled by the return (late fee included) and are not locked out. */
    private static final Set<BookingStatus> RETURN_IN_PROGRESS =
            EnumSet.of(BookingStatus.CHECKOUT_REQUESTED, BookingStatus.INSPECTED);
    static final String REVOKED_OVERDUE = "REVOKED_OVERDUE";
    /** A successful reminder blocks another one for this long (seconds). */
    static final long REMINDER_COOLDOWN_SECONDS = 60;
    private final Set<UUID> remindersInFlight = ConcurrentHashMap.newKeySet();

    private final RentalContractRepository rentalContractRepository;
    private final BookingRepository bookingRepository;
    private final StorageUnitRepository storageUnitRepository;
    private final SealingRecordRepository sealingRecordRepository;
    private final OverdueCaseRepository overdueCaseRepository;
    private final ActivityLogService activityLogService;
    private final FacilityAccessGuard facilityAccessGuard;
    private final RequestContext requestContext;
    private final OverdueFeeCalculator overdueFeeCalculator;
    private final AccessRestorationServiceImpl accessRestorationService;
    private final OverdueNotificationSender notificationSender;
    private final PlatformTransactionManager transactionManager;

    // =====================================================================================================
    // Scheduled jobs
    // =====================================================================================================

    /** Nightly overdue assessment (01:00 by default) for every facility, driven by each facility policy. */
    @Scheduled(cron = "${app.scheduling.overdue-cron:0 0 1 * * ?}")
    public void runDailyOverdueCron() {
        log.info("[CRON] Overdue assessment started");
        try {
            OverdueProcessResult result = processInternal(LocalDate.now(), null);
            log.info("[CRON] Overdue assessment done. Scanned: {}, fees assessed: {}, locked: {}, sealing eligible: {}, restored: {}, on hold: {}",
                    result.getScannedOverdueContractsCount(), result.getLateFeeAssessedCount(), result.getPinDisabledCount(),
                    result.getSealingEligibleCount(), result.getAccessRestoredCount(), result.getOnHoldCount());
        } catch (Exception e) {
            log.error("[CRON] Overdue assessment failed", e);
        }
    }

    /**
     * Revokes door credentials still attached to bookings of contracts that have ended (expired, terminated,
     * cancelled). Overdue contracts are not touched here: their access follows the facility policy above.
     */
    @Scheduled(cron = "${app.scheduling.credential-cleanup-cron:0 0 2 * * ?}")
    public void cleanupExpiredCredentials() {
        try {
            TransactionTemplate tx = new TransactionTemplate(transactionManager);
            Integer revoked = tx.execute(status -> {
                int count = 0;
                for (RentalContract contract : overdueCaseRepository.findEndedContractsWithLiveCredentials(ENDED_STATUSES)) {
                    Booking booking = contract.getBooking();
                    // A tenant still holding the unit after expiry follows the overdue rule, not this cleanup.
                    if (booking == null || booking.getAccessPin() == null || AccessRestorationServiceImpl.isHeldAfterExpiry(contract)) {
                        continue;
                    }
                    booking.setAccessPin(null);
                    booking.setQrAccessToken("REVOKED_EXPIRED");
                    booking.setPinUpdatedAt(LocalDateTime.now());
                    bookingRepository.save(booking);
                    activityLogService.recordSystem(
                            contract.getFacility() != null ? contract.getFacility().getId() : null,
                            ActivityAction.ACCESS_CREDENTIAL_REVOKE, "Booking", booking.getId(),
                            String.format("Tự động thu hồi mã PIN/QR kho %s vì hợp đồng %s đã kết thúc.",
                                    unitCode(contract), contract.getContractCode()));
                    count++;
                }
                return count;
            });
            log.info("[CRON] Credential cleanup revoked {} stale credential(s)", revoked);
        } catch (Exception e) {
            log.error("[CRON] Credential cleanup failed: {}", e.getMessage(), e);
        }
    }

    // =====================================================================================================
    // Manual trigger
    // =====================================================================================================

    @Override
    public OverdueProcessResult processOverdueContracts(LocalDate referenceDate, UUID facilityId) {
        LocalDate today = LocalDate.now();
        String role = requestContext.currentUserRole();
        boolean systemWide = role != null && SYSTEM_WIDE_ROLES.contains(role);
        UUID scope = facilityId;
        if (!systemWide) {
            if (referenceDate != null && !referenceDate.equals(today)) {
                throw new AppException(ErrorCode.OVERDUE_PROCESS_FORBIDDEN);
            }
            UUID own = requestContext.currentUserFacilityId();
            if (own == null || (facilityId != null && !facilityId.equals(own))) {
                throw new AppException(ErrorCode.FACILITY_ACCESS_DENIED);
            }
            scope = own;
        }
        return processInternal(referenceDate != null ? referenceDate : today, scope);
    }

    /** One transaction per contract, so a bad row never blocks the rest of the run. */
    OverdueProcessResult processInternal(LocalDate asOf, UUID facilityId) {
        TransactionTemplate readTx = new TransactionTemplate(transactionManager);
        readTx.setReadOnly(true);
        List<UUID> contractIds = readTx.execute(status -> overdueCaseRepository.findOverdueContracts(asOf, facilityId)
                .stream().map(RentalContract::getId).toList());

        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        tx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);

        Map<UUID, OverduePolicy> policyCache = new HashMap<>();
        RunCounters counters = new RunCounters();
        List<OverdueContractDetail> details = new ArrayList<>();
        Set<UUID> processed = new HashSet<>();

        for (UUID contractId : contractIds == null ? List.<UUID>of() : contractIds) {
            try {
                OverdueContractDetail detail = tx.execute(status -> processOne(contractId, asOf, policyCache, counters));
                processed.add(contractId);
                if (detail != null) {
                    details.add(detail);
                }
            } catch (RuntimeException e) {
                log.error("[OVERDUE] Could not process contract {}: {}", contractId, e.getMessage(), e);
            }
        }

        try {
            tx.executeWithoutResult(status -> closeStaleCases(asOf, facilityId, processed));
        } catch (RuntimeException e) {
            log.error("[OVERDUE] Could not close stale overdue cases: {}", e.getMessage(), e);
        }

        return OverdueProcessResult.builder()
                .executionTime(LocalDateTime.now())
                .asOfDate(asOf)
                .facilityId(facilityId)
                .scannedOverdueContractsCount(details.size())
                .lateFeeAssessedCount(counters.feesAssessed)
                .pinDisabledCount(counters.locked)
                .sealingEligibleCount(counters.sealingEligible)
                .accessRestoredCount(counters.restored)
                .onHoldCount(counters.onHold)
                .details(details)
                .build();
    }

    private static final class RunCounters {
        int feesAssessed;
        int locked;
        int sealingEligible;
        int restored;
        int onHold;
    }

    private OverdueContractDetail processOne(UUID contractId, LocalDate asOf, Map<UUID, OverduePolicy> policyCache,
                                             RunCounters counters) {
        RentalContract contract = rentalContractRepository.findById(contractId).orElse(null);
        if (contract == null || contract.getEndDate() == null) {
            return null;
        }
        Facility facility = contract.getFacility();
        UUID facilityId = facility != null ? facility.getId() : null;
        boolean sealed = activeSeal(contract) != null;

        // Renewed (end date moved) while still marked overdue: reopen access automatically.
        if (!contract.getEndDate().isBefore(asOf)) {
            boolean stillMarked = AccessRestorationServiceImpl.isAccessLocked(contract)
                    || contract.getStatus() == RentalContractStatus.OVERDUE;
            if (!sealed && stillMarked && asOf.equals(LocalDate.now())) {
                accessRestorationService.restoreAccessAfterSettlement(contract.getId(),
                        "Hợp đồng đã được gia hạn đến " + date(contract.getEndDate()));
                counters.restored++;
            }
            return null;
        }

        OverduePolicy policy = policyCache.computeIfAbsent(facilityId == null ? new UUID(0, 0) : facilityId,
                key -> overdueFeeCalculator.policyFor(facilityId));
        OverdueAssessment assessment = overdueFeeCalculator.assess(contract, asOf,
                overdueCaseRepository.sumOverdueCredits(contract), policy);
        int days = assessment.daysOverdue();
        if (days < 1) {
            return null;
        }
        List<String> actions = new ArrayList<>();

        if (contract.getStatus() == RentalContractStatus.ACTIVE || AccessRestorationServiceImpl.isHeldAfterExpiry(contract)) {
            contract.setStatus(RentalContractStatus.OVERDUE);
            rentalContractRepository.save(contract);
            activityLogService.recordSystem(facilityId, ActivityAction.OVERDUE_DETECTED, "RentalContract", contract.getId(),
                    String.format("Hợp đồng %s (kho %s) quá hạn từ %s. Phí trễ hạn %s mỗi ngày sau %d ngày ân hạn theo chính sách cơ sở.",
                            contract.getContractCode(), unitCode(contract), date(contract.getEndDate().plusDays(1)),
                            money(policy.dailyLateFee()), policy.graceDays()));
            actions.add("Chuyển hợp đồng sang quá hạn");
        }

        OverdueCase overdueCase = openCase(contract);
        int previousDays = overdueCase.getDaysOverdue() != null ? overdueCase.getDaysOverdue() : 0;
        overdueCase.setDueDate(contract.getEndDate());
        overdueCase.setDaysOverdue(days);
        overdueCase.setGraceDays(policy.graceDays());
        overdueCase.setDailyLateFee(policy.dailyLateFee());
        overdueCase.setLateFeeAmount(assessment.lateFee());
        overdueCase.setOverdueRentAmount(assessment.overdueRent());
        overdueCase.setLastAssessedOn(asOf);
        counters.feesAssessed++;
        actions.add("Phí trễ hạn " + money(assessment.lateFee()) + " (" + assessment.chargeableLateDays() + " ngày tính phí)");

        Booking booking = contract.getBooking();
        boolean locked = AccessRestorationServiceImpl.isAccessLocked(contract);
        boolean returnInProgress = booking != null && RETURN_IN_PROGRESS.contains(booking.getStatus());
        if (assessment.stage().isAccessBlocked() && !locked && !sealed && !returnInProgress) {
            LocalDate hold = overdueCase.getAccessHoldUntil();
            if (hold != null && !asOf.isAfter(hold)) {
                counters.onHold++;
                actions.add("Đang giữ quyền truy cập đến " + date(hold) + " theo quyết định của quản lý");
            } else {
                revokeAccess(contract, overdueCase, String.format(
                        "Tự động khóa truy cập: quá hạn %d ngày, chính sách cơ sở khóa từ ngày thứ %d", days, policy.accessDisableDays()),
                        true);
                counters.locked++;
                locked = true;
                actions.add("Đã thu hồi mã PIN/QR và khóa kho");
                OverdueNotificationSender.Outcome notice = notifyAccessLocked(contract, days, null);
                if (notice != null) {
                    actions.add(notice.sent() ? "Đã gửi email báo khách" : "Đã thông báo khách trong cổng khách hàng");
                }
            }
        }

        if (assessment.stage() == Stage.ELIGIBLE_FOR_SEALING && !sealed && previousDays < policy.sealingDays()) {
            counters.sealingEligible++;
            activityLogService.recordSystem(facilityId, ActivityAction.OVERDUE_DETECTED, "RentalContract", contract.getId(),
                    String.format("Hợp đồng %s (kho %s) quá hạn %d ngày, đã đến mốc niêm phong (từ ngày thứ %d). "
                                    + "Quản lý cần lập biên bản niêm phong có người chứng kiến tại hiện trường.",
                            contract.getContractCode(), unitCode(contract), days, policy.sealingDays()));
            actions.add("Đến mốc niêm phong, chờ quản lý lập biên bản");
        }

        overdueCaseRepository.save(overdueCase);

        return OverdueContractDetail.builder()
                .contractId(contract.getId())
                .contractCode(contract.getContractCode())
                .storageUnitId(contract.getUnit() != null ? contract.getUnit().getId() : null)
                .unitCode(unitCode(contract))
                .facilityId(facilityId)
                .facilityName(facility != null ? facility.getName() : null)
                .endDate(contract.getEndDate())
                .overdueDays(days)
                .contractStatus(contract.getStatus().name())
                .overdueStage(assessment.stage().name())
                .lateFeeAmount(assessment.lateFee())
                .accessLocked(locked)
                .sealed(sealed)
                .actionSummary(String.join("; ", actions))
                .build();
    }

    /** Open episodes whose contract left the overdue state (returned, terminated or renewed). */
    private void closeStaleCases(LocalDate asOf, UUID facilityId, Set<UUID> processed) {
        for (OverdueCase oc : overdueCaseRepository.findAllByStatusWithContract(OverdueCaseStatus.OPEN, facilityId)) {
            RentalContract contract = oc.getContract();
            if (contract == null || processed.contains(contract.getId())) {
                continue;
            }
            if (ENDED_STATUSES.contains(contract.getStatus()) && !AccessRestorationServiceImpl.isHeldAfterExpiry(contract)) {
                oc.setStatus(OverdueCaseStatus.CLOSED);
                oc.setResolvedAt(LocalDateTime.now());
                oc.setResolutionNote("Hợp đồng đã kết thúc (" + contract.getStatus().name() + ")");
                overdueCaseRepository.save(oc);
            } else if (contract.getStatus() == RentalContractStatus.ACTIVE && contract.getEndDate() != null
                    && !contract.getEndDate().isBefore(asOf)) {
                oc.setStatus(OverdueCaseStatus.SETTLED);
                oc.setResolvedAt(LocalDateTime.now());
                oc.setAccessHoldUntil(null);
                oc.setResolutionNote("Hợp đồng đã được gia hạn đến " + date(contract.getEndDate()));
                overdueCaseRepository.save(oc);
            }
        }
    }

    // =====================================================================================================
    // Ledger
    // =====================================================================================================

    @Override
    @Transactional(readOnly = true)
    public OverdueLedgerResponse getOverdueLedger(UUID facilityId) {
        UUID scope = resolveScope(facilityId);
        LocalDate today = LocalDate.now();

        List<RentalContract> contracts = overdueCaseRepository.findOverdueContracts(today, scope).stream()
                .filter(c -> overdueFeeCalculator.daysOverdue(c, today) >= 1)
                .toList();
        List<UUID> ids = contracts.stream().map(RentalContract::getId).toList();

        Map<UUID, SealingRecord> seals = ids.isEmpty() ? Map.of() : sealingRecordRepository
                .findByStatusAndContract_IdIn(SealingStatus.SEALED, ids).stream()
                .filter(s -> s.getContract() != null)
                .collect(Collectors.toMap(s -> s.getContract().getId(), Function.identity(), (a, b) -> a));
        Map<UUID, OverdueCase> cases = ids.isEmpty() ? Map.of() : overdueCaseRepository
                .findByStatusAndContractIds(OverdueCaseStatus.OPEN, ids).stream()
                .collect(Collectors.toMap(oc -> oc.getContract().getId(), Function.identity(), (a, b) -> a));
        Map<UUID, OverduePolicy> policies = new HashMap<>();

        List<OverdueLedgerItemResponse> items = new ArrayList<>();
        for (RentalContract contract : contracts) {
            UUID fid = contract.getFacility() != null ? contract.getFacility().getId() : null;
            OverduePolicy policy = policies.computeIfAbsent(fid == null ? new UUID(0, 0) : fid,
                    key -> overdueFeeCalculator.policyFor(fid));
            SealingRecord seal = seals.get(contract.getId());
            if (seal == null && contract.getUnit() != null && contract.getStatus() == RentalContractStatus.OVERDUE_LOCKED) {
                seal = sealingRecordRepository.findFirstByStorageUnit_IdAndStatusOrderBySealedAtDesc(
                        contract.getUnit().getId(), SealingStatus.SEALED).orElse(null);
            }
            items.add(toLedgerItem(contract, today, policy, seal, cases.get(contract.getId())));
        }
        items.sort((a, b) -> Integer.compare(b.getDaysOverdue(), a.getDaysOverdue()));

        long grace = 0, warning = 0, blocked = 0, sealing = 0, locked = 0, sealedCount = 0;
        BigDecimal debt = BigDecimal.ZERO, rent = BigDecimal.ZERO, fees = BigDecimal.ZERO, paid = BigDecimal.ZERO;
        for (OverdueLedgerItemResponse item : items) {
            switch (item.getOverdueStage()) {
                case "GRACE_PERIOD" -> grace++;
                case "WARNING" -> warning++;
                case "ACCESS_BLOCKED" -> blocked++;
                default -> sealing++;
            }
            if (item.isAccessLocked()) {
                locked++;
            }
            if (item.isSealed()) {
                sealedCount++;
            }
            debt = debt.add(item.getTotalDebt());
            rent = rent.add(item.getUnpaidRent());
            fees = fees.add(item.getTotalLateFee());
            paid = paid.add(item.getPaidSinceDue());
        }

        OverduePolicyResponse policyResponse = null;
        if (scope != null) {
            OverduePolicy p = overdueFeeCalculator.policyFor(scope);
            policyResponse = OverduePolicyResponse.builder()
                    .graceDays(p.graceDays())
                    .accessDisableDays(p.accessDisableDays())
                    .sealingDays(p.sealingDays())
                    .dailyLateFee(p.dailyLateFee())
                    .defaultPolicy(!p.fromFacilityPolicy())
                    .build();
        }

        return OverdueLedgerResponse.builder()
                .asOfDate(today)
                .facilityId(scope)
                .policy(policyResponse)
                .totalOverdueCount(items.size())
                .totalDebtAmount(debt)
                .totalUnpaidRent(rent)
                .totalLateFees(fees)
                .totalPaidSinceDue(paid)
                .gracePeriodCount(grace)
                .warningCount(warning)
                .accessBlockedCount(blocked)
                .eligibleForSealingCount(sealing)
                .accessLockedCount(locked)
                .sealedCount(sealedCount)
                .items(items)
                .build();
    }

    private OverdueLedgerItemResponse toLedgerItem(RentalContract contract, LocalDate today, OverduePolicy policy,
                                                   SealingRecord seal, OverdueCase overdueCase) {
        OverdueAssessment a = overdueFeeCalculator.assess(contract, today, overdueCaseRepository.sumOverdueCredits(contract), policy);
        User customer = contract.getCustomer();
        StorageUnit unit = contract.getUnit();
        Booking booking = contract.getBooking();
        Facility facility = contract.getFacility();
        boolean sealed = seal != null;
        boolean locked = sealed || AccessRestorationServiceImpl.isAccessLocked(contract);
        boolean returnInProgress = booking != null && RETURN_IN_PROGRESS.contains(booking.getStatus());
        String email = customer != null && customer.getEmail() != null && !customer.getEmail().isBlank() ? customer.getEmail() : null;

        return OverdueLedgerItemResponse.builder()
                .contractId(contract.getId())
                .contractCode(contract.getContractCode())
                .contractStatus(contract.getStatus() != null ? contract.getStatus().name() : null)
                .bookingId(booking != null ? booking.getId() : null)
                .bookingCode(booking != null ? booking.getBookingCode() : null)
                .bookingStatus(booking != null && booking.getStatus() != null ? booking.getStatus().name() : null)
                .customerId(customer != null ? customer.getId() : null)
                .customerName(customer != null ? OverdueNotificationSender.displayName(customer) : null)
                .customerPhone(customer != null ? blankToNull(customer.getPhone()) : null)
                .customerEmail(email)
                .unitId(unit != null ? unit.getId() : null)
                .unitCode(unit != null ? unit.getUnitCode() : null)
                .unitStatus(unit != null && unit.getStatus() != null ? unit.getStatus().name() : null)
                .facilityId(facility != null ? facility.getId() : null)
                .facilityName(facility != null ? facility.getName() : null)
                .startDate(contract.getStartDate())
                .dueDate(contract.getEndDate())
                .daysOverdue(a.daysOverdue())
                .graceDays(policy.graceDays())
                .accessDisableDays(policy.accessDisableDays())
                .sealingDays(policy.sealingDays())
                .defaultPolicy(!policy.fromFacilityPolicy())
                .monthlyFee(contract.getMonthlyFee())
                .unpaidRent(a.overdueRent())
                .dailyLateFee(policy.dailyLateFee())
                .chargeableLateDays(a.chargeableLateDays())
                .totalLateFee(a.lateFee())
                .paidSinceDue(a.credits())
                .totalDebt(a.totalDebt())
                .overdueStage(a.stage() == Stage.CURRENT ? Stage.GRACE_PERIOD.name() : a.stage().name())
                .accessLocked(locked)
                .accessLockedAt(overdueCase != null ? overdueCase.getAccessLockedAt() : null)
                .accessHoldUntil(overdueCase != null && overdueCase.getAccessHoldUntil() != null
                        && !overdueCase.getAccessHoldUntil().isBefore(today) ? overdueCase.getAccessHoldUntil() : null)
                .sealed(sealed)
                .sealingRecordId(sealed ? seal.getId() : null)
                .sealingProtocolNumber(sealed ? seal.getProtocolNumber() : null)
                .sealedAt(sealed ? seal.getSealedAt() : null)
                .lastReminderAt(overdueCase != null ? overdueCase.getLastReminderAt() : null)
                .lastReminderStatus(overdueCase != null ? overdueCase.getLastReminderStatus() : null)
                .reminderCount(overdueCase != null && overdueCase.getReminderCount() != null ? overdueCase.getReminderCount() : 0)
                .accruedLateFee(overdueCase != null ? overdueCase.getLateFeeAmount() : null)
                .lastAssessedOn(overdueCase != null ? overdueCase.getLastAssessedOn() : null)
                .canRemind(email != null)
                .canLockout(a.stage().isAccessBlocked() && !locked && !returnInProgress)
                .canSeal(a.stage() == Stage.ELIGIBLE_FOR_SEALING && !sealed)
                .canRestoreAccess(locked && !sealed)
                .canUnseal(sealed)
                .build();
    }

    // =====================================================================================================
    // Lockout / restore / reminder
    // =====================================================================================================

    @Override
    @Transactional
    public LockoutResponse lockoutContract(UUID contractId, String reason) {
        return lockout(contractId, reason, false);
    }

    @Override
    @Transactional
    public LockoutResponse lockoutContract(UUID contractId, String reason, boolean overrideAccessHold) {
        return lockout(contractId, reason, overrideAccessHold);
    }

    private LockoutResponse lockout(UUID contractId, String reason, boolean overrideAccessHold) {
        RentalContract contract = loadAuthorized(contractId);
        Booking booking = contract.getBooking();
        LocalDate today = LocalDate.now();

        if (activeSeal(contract) != null) {
            throw new AppException(ErrorCode.UNIT_ALREADY_SEALED,
                    "Kho đã được niêm phong nên quyền truy cập đã bị thu hồi.");
        }
        OverduePolicy policy = overdueFeeCalculator.policyFor(contract);
        int days = overdueFeeCalculator.daysOverdue(contract, today);
        boolean heldAfterExpiry = AccessRestorationServiceImpl.isHeldAfterExpiry(contract);
        if (days < 1 || !(contract.getStatus() == RentalContractStatus.ACTIVE || contract.getStatus() == RentalContractStatus.OVERDUE
                || heldAfterExpiry)) {
            throw new AppException(ErrorCode.OVERDUE_CONTRACT_NOT_OVERDUE);
        }
        Stage stage = overdueFeeCalculator.stageOf(days, policy);
        if (!stage.isAccessBlocked()) {
            throw new AppException(ErrorCode.OVERDUE_ACTION_NOT_ELIGIBLE, String.format(
                    "Chỉ khóa truy cập được từ ngày quá hạn thứ %d theo chính sách của cơ sở (hiện quá hạn %d ngày).",
                    policy.accessDisableDays(), days));
        }
        if (booking != null && RETURN_IN_PROGRESS.contains(booking.getStatus())) {
            throw new AppException(ErrorCode.OVERDUE_ACTION_NOT_ELIGIBLE,
                    "Khách đang làm thủ tục trả kho. Phí trễ hạn sẽ được tính khi quyết toán trả kho.");
        }

        String lockoutReason = reason != null && !reason.isBlank() ? reason.trim()
                : String.format("Quá hạn thanh toán %d ngày", days);
        OverdueCase overdueCase = openCase(contract);
        boolean alreadyLocked = AccessRestorationServiceImpl.isAccessLocked(contract);

        // A manager who granted an access hold promised the tenant the door stays open until that date. Locking earlier
        // is possible but must be a conscious override with a written reason, never an accidental click.
        LocalDate hold = overdueCase.getAccessHoldUntil();
        boolean holdActive = !alreadyLocked && hold != null && !hold.isBefore(today);
        boolean overridesHold = holdActive && overrideAccessHold;
        if (holdActive && !overrideAccessHold) {
            throw new AppException(ErrorCode.OVERDUE_LOCKOUT_HOLD_ACTIVE, String.format(
                    "Quản lý đã giữ quyền truy cập cho khách đến hết ngày %s. Nếu vẫn muốn khóa ngay, hãy chọn khóa sớm và nhập lý do.",
                    date(hold)));
        }
        if (overridesHold) {
            if (reason == null || reason.isBlank()) {
                throw new AppException(ErrorCode.OVERDUE_LOCKOUT_HOLD_ACTIVE, String.format(
                        "Khóa sớm khi đang giữ quyền truy cập đến hết ngày %s cần có lý do bằng văn bản.", date(hold)));
            }
            lockoutReason = String.format("Khóa sớm khi đang giữ quyền truy cập đến %s. Lý do: %s", date(hold), lockoutReason);
        }

        if (alreadyLocked) {
            return LockoutResponse.builder()
                    .contractId(contract.getId())
                    .contractCode(contract.getContractCode())
                    .bookingId(booking != null ? booking.getId() : null)
                    .unitCode(unitCode(contract))
                    .status("ALREADY_LOCKED")
                    .message("Quyền truy cập kho đã bị khóa trước đó.")
                    .reason(lockoutReason)
                    .lockedAt(overdueCase.getAccessLockedAt())
                    .pinRevoked(true)
                    .build();
        }

        if (contract.getStatus() == RentalContractStatus.ACTIVE || heldAfterExpiry) {
            contract.setStatus(RentalContractStatus.OVERDUE);
            rentalContractRepository.save(contract);
        }
        revokeAccess(contract, overdueCase, lockoutReason, false);
        overdueCaseRepository.save(overdueCase);

        // The tenant must not find the PIN dead without notice: in-app notification plus email when mail is configured.
        OverdueNotificationSender.Outcome notice = notifyAccessLocked(contract, days, overridesHold ? hold : null);

        return LockoutResponse.builder()
                .contractId(contract.getId())
                .contractCode(contract.getContractCode())
                .bookingId(booking != null ? booking.getId() : null)
                .unitCode(unitCode(contract))
                .status("SUCCESS")
                .message("Đã thu hồi mã PIN/QR của khách và khóa kho. Lưu ý: hệ thống chưa kết nối khóa điện tử, "
                        + "nhân viên cần khóa kho tại chỗ nếu cơ sở dùng khóa cơ.")
                .reason(lockoutReason)
                .lockedAt(overdueCase.getAccessLockedAt())
                .pinRevoked(true)
                .customerNotified(notice != null ? notice.sent() : null)
                .notificationMessage(notice != null ? describeNotice(notice) : null)
                .build();
    }

    /** Tells the tenant their door credentials were revoked (in-app + email when configured). Never throws. */
    private OverdueNotificationSender.Outcome notifyAccessLocked(RentalContract contract, int days, LocalDate overriddenHold) {
        try {
            User customer = contract.getCustomer();
            Facility facility = contract.getFacility();
            OverduePolicy policy = overdueFeeCalculator.policyFor(contract);
            OverdueAssessment a = overdueFeeCalculator.assess(contract, LocalDate.now(),
                    overdueCaseRepository.sumOverdueCredits(contract), policy);
            String unit = unitCode(contract);
            String title = "Quyền truy cập kho " + unit + " đã bị khóa";
            String summary = String.format("Quyền truy cập kho %s theo hợp đồng %s đã bị tạm khóa vì quá hạn thanh toán %d ngày. "
                            + "Mã PIN/QR cũ đã bị thu hồi; tổng cần thanh toán %s.",
                    unit, contract.getContractCode(), days, money(a.totalDebt()));
            List<Map.Entry<String, String>> rows = new ArrayList<>();
            rows.add(Map.entry("Hợp đồng", contract.getContractCode()));
            rows.add(Map.entry("Kho", unit));
            rows.add(Map.entry("Cơ sở", facility != null ? facility.getName() : "—"));
            rows.add(Map.entry("Hết hạn ngày", date(contract.getEndDate())));
            rows.add(Map.entry("Số ngày quá hạn", days + " ngày"));
            rows.add(Map.entry("Tổng cần thanh toán", money(a.totalDebt())));
            List<String> closing = new ArrayList<>();
            if (overriddenHold != null) {
                closing.add("Quyền truy cập được khóa sớm hơn thời hạn giữ truy cập (" + date(overriddenHold) + ") mà cơ sở đã báo trước.");
            }
            closing.add("Quyền truy cập sẽ được mở lại sau khi bạn gia hạn hợp đồng hoặc thanh toán đủ.");
            closing.add("Bạn có thể gia hạn hợp đồng trong cổng khách hàng Boxora hoặc thanh toán tại quầy.");
            closing.add(OverdueNotificationSender.facilityContact(facility));
            String html = notificationSender.render(title,
                    "Xin chào " + OverdueNotificationSender.displayName(customer) + ", " + summary, rows, closing);
            return notificationSender.notifyCustomer(customer, facility, NotificationType.OVERDUE_NOTICE, "RentalContract",
                    contract.getId(), true, "[Boxora] " + title, title, summary, html);
        } catch (RuntimeException e) {
            log.warn("[OVERDUE] Could not notify the tenant of contract {} about the lockout: {}", contract.getId(), e.getMessage());
            return null;
        }
    }

    private static String describeNotice(OverdueNotificationSender.Outcome notice) {
        return notice.sent()
                ? "Đã gửi email tới " + notice.recipientEmail() + " và thông báo trong cổng khách hàng."
                : "Đã thông báo trong cổng khách hàng. Chưa gửi được email" + (notice.error() != null ? ": " + notice.error() : "") + ".";
    }

    @Override
    @Transactional
    public AccessRestorationResponse restoreAccess(UUID contractId, String reason, LocalDate holdUntil) {
        RentalContract contract = loadAuthorized(contractId);
        String why = reason != null ? reason.trim() : "";
        String actor = requestContext.currentUserEmail();
        return accessRestorationService.restoreByManager(contract,
                actor != null ? why + " (thực hiện bởi " + actor + ")" : why, holdUntil);
    }

    @Override
    @Transactional(noRollbackFor = AppException.class)
    public OverdueReminderResponse sendReminder(UUID contractId) {
        RentalContract contract = loadAuthorized(contractId);
        // Sending takes seconds on a real SMTP server: a second click (or request) for the same contract meanwhile would
        // email the tenant twice, so it is refused while the first one is in flight.
        if (!remindersInFlight.add(contractId)) {
            throw new AppException(ErrorCode.OVERDUE_REMINDER_TOO_SOON);
        }
        try {
            return deliverReminder(contract);
        } finally {
            remindersInFlight.remove(contractId);
        }
    }

    private OverdueReminderResponse deliverReminder(RentalContract contract) {
        LocalDate today = LocalDate.now();
        int days = overdueFeeCalculator.daysOverdue(contract, today);
        if (days < 1 || (ENDED_STATUSES.contains(contract.getStatus()) && !AccessRestorationServiceImpl.isHeldAfterExpiry(contract))) {
            throw new AppException(ErrorCode.OVERDUE_REMINDER_NOT_OVERDUE);
        }
        User customer = contract.getCustomer();
        if (customer == null || customer.getEmail() == null || customer.getEmail().isBlank()) {
            throw new AppException(ErrorCode.OVERDUE_REMINDER_NO_EMAIL);
        }
        if (!notificationSender.isMailConfigured()) {
            throw new AppException(ErrorCode.OVERDUE_REMINDER_EMAIL_UNAVAILABLE);
        }
        OverdueCase lastCase = overdueCaseRepository.findFirstByContract_IdAndStatus(contract.getId(), OverdueCaseStatus.OPEN).orElse(null);
        if (lastCase != null && "SENT".equals(lastCase.getLastReminderStatus()) && lastCase.getLastReminderAt() != null
                && lastCase.getLastReminderAt().isAfter(LocalDateTime.now().minusSeconds(REMINDER_COOLDOWN_SECONDS))) {
            throw new AppException(ErrorCode.OVERDUE_REMINDER_TOO_SOON);
        }

        OverduePolicy policy = overdueFeeCalculator.policyFor(contract);
        OverdueAssessment a = overdueFeeCalculator.assess(contract, today, overdueCaseRepository.sumOverdueCredits(contract), policy);
        Facility facility = contract.getFacility();
        boolean locked = AccessRestorationServiceImpl.isAccessLocked(contract);

        String subject = "[Boxora] Nhắc thanh toán quá hạn hợp đồng " + contract.getContractCode();
        List<Map.Entry<String, String>> rows = List.of(
                Map.entry("Hợp đồng", contract.getContractCode()),
                Map.entry("Kho", unitCode(contract)),
                Map.entry("Cơ sở", facility != null ? facility.getName() : "—"),
                Map.entry("Hết hạn ngày", date(contract.getEndDate())),
                Map.entry("Số ngày quá hạn", days + " ngày"),
                Map.entry("Tiền thuê kỳ quá hạn", money(a.overdueRent())),
                Map.entry("Phí trễ hạn", money(a.lateFee()) + " (" + money(policy.dailyLateFee()) + "/ngày, sau "
                        + policy.graceDays() + " ngày ân hạn)"),
                Map.entry("Đã thanh toán sau hạn", money(a.credits())),
                Map.entry("Tổng cần thanh toán", money(a.totalDebt())));
        List<String> closing = new ArrayList<>();
        if (locked) {
            closing.add("Quyền truy cập kho của bạn đang tạm khóa. Quyền truy cập sẽ được mở lại sau khi bạn gia hạn hoặc thanh toán đủ.");
        } else {
            closing.add("Theo chính sách của cơ sở, quyền truy cập kho sẽ tạm khóa từ ngày quá hạn thứ "
                    + policy.accessDisableDays() + " và kho có thể được niêm phong từ ngày quá hạn thứ " + policy.sealingDays() + ".");
        }
        closing.add("Bạn có thể gia hạn hợp đồng trong cổng khách hàng Boxora hoặc thanh toán tại quầy.");
        closing.add(OverdueNotificationSender.facilityContact(facility));
        String html = notificationSender.render("Nhắc thanh toán quá hạn",
                "Xin chào " + OverdueNotificationSender.displayName(customer) + ", hợp đồng thuê kho của bạn đã quá hạn thanh toán.",
                rows, closing);
        String summary = String.format("Nhắc nợ quá hạn %d ngày, tổng cần thanh toán %s.", days, money(a.totalDebt()));

        OverdueNotificationSender.Outcome outcome = notificationSender.send(customer, facility, NotificationType.OVERDUE_NOTICE,
                "RentalContract", contract.getId(), subject, summary, html);

        OverdueCase overdueCase = openCase(contract);
        LocalDateTime now = LocalDateTime.now();
        overdueCase.setLastReminderAt(now);
        overdueCase.setLastReminderStatus(outcome.sent() ? "SENT" : "FAILED");
        overdueCase.setLastReminderError(outcome.sent() ? null : AccessRestorationServiceImpl.truncate(outcome.error(), 500));
        if (outcome.sent()) {
            overdueCase.setReminderCount((overdueCase.getReminderCount() != null ? overdueCase.getReminderCount() : 0) + 1);
        }
        if (overdueCase.getDaysOverdue() == null || overdueCase.getDaysOverdue() == 0) {
            overdueCase.setDaysOverdue(days);
            overdueCase.setGraceDays(policy.graceDays());
            overdueCase.setDailyLateFee(policy.dailyLateFee());
            overdueCase.setLateFeeAmount(a.lateFee());
            overdueCase.setOverdueRentAmount(a.overdueRent());
            overdueCase.setLastAssessedOn(today);
        }
        overdueCaseRepository.save(overdueCase);

        if (!outcome.sent()) {
            throw new AppException(ErrorCode.EMAIL_SEND_FAILED,
                    "Chưa gửi được email nhắc nợ tới " + outcome.recipientEmail() + ": " + outcome.error() + ". Vui lòng thử lại sau.");
        }

        activityLogService.record(facility != null ? facility.getId() : null, ActivityAction.OVERDUE_REMINDER_SENT,
                "RentalContract", contract.getId(),
                String.format("Đã gửi email nhắc nợ hợp đồng %s (kho %s) tới %s: quá hạn %d ngày, tổng cần thanh toán %s.",
                        contract.getContractCode(), unitCode(contract), outcome.recipientEmail(), days, money(a.totalDebt())),
                null, null);

        return OverdueReminderResponse.builder()
                .contractId(contract.getId())
                .contractCode(contract.getContractCode())
                .sentTo(outcome.recipientEmail())
                .sentAt(now)
                .daysOverdue(days)
                .totalDebt(a.totalDebt())
                .reminderCount(overdueCase.getReminderCount())
                .build();
    }

    // =====================================================================================================
    // Helpers
    // =====================================================================================================

    /** Revokes the tenant credentials and locks the unit; records the lock on the open case. */
    void revokeAccess(RentalContract contract, OverdueCase overdueCase, String reason, boolean system) {
        LocalDateTime now = LocalDateTime.now();
        Booking booking = contract.getBooking();
        if (booking != null) {
            if (booking.getStatus() == BookingStatus.ACTIVE) {
                booking.setStatus(BookingStatus.OVERDUE);
            }
            booking.setAccessPin(null);
            booking.setQrAccessToken(REVOKED_OVERDUE);
            booking.setPinUpdatedAt(now);
            bookingRepository.save(booking);
        }
        StorageUnit unit = contract.getUnit();
        if (unit != null && (unit.getStatus() == UnitStatus.OCCUPIED || unit.getStatus() == UnitStatus.RESERVED)) {
            unit.setStatus(UnitStatus.OVERDUE_LOCKED);
            storageUnitRepository.save(unit);
        }
        overdueCase.setAccessLockedAt(now);
        overdueCase.setAccessHoldUntil(null);

        UUID facilityId = contract.getFacility() != null ? contract.getFacility().getId() : null;
        String description = String.format("Thu hồi mã PIN/QR và khóa kho %s theo hợp đồng %s. Lý do: %s",
                unitCode(contract), contract.getContractCode(), reason);
        if (system) {
            activityLogService.recordSystem(facilityId, ActivityAction.OVERDUE_ACCESS_DISABLED, "RentalContract", contract.getId(), description);
        } else {
            activityLogService.record(facilityId, ActivityAction.OVERDUE_ACCESS_DISABLED, "RentalContract", contract.getId(),
                    description, null, BookingStatus.OVERDUE.name());
        }
    }

    private OverdueCase openCase(RentalContract contract) {
        return overdueCaseRepository.findFirstByContract_IdAndStatus(contract.getId(), OverdueCaseStatus.OPEN)
                .orElseGet(() -> overdueCaseRepository.save(OverdueCase.builder()
                        .contract(contract)
                        .facility(contract.getFacility())
                        .dueDate(contract.getEndDate())
                        .status(OverdueCaseStatus.OPEN)
                        .build()));
    }

    private SealingRecord activeSeal(RentalContract contract) {
        SealingRecord seal = sealingRecordRepository
                .findFirstByContract_IdAndStatusOrderBySealedAtDesc(contract.getId(), SealingStatus.SEALED).orElse(null);
        if (seal == null && contract.getUnit() != null) {
            seal = sealingRecordRepository.findFirstByStorageUnit_IdAndStatusOrderBySealedAtDesc(
                    contract.getUnit().getId(), SealingStatus.SEALED).orElse(null);
        }
        return seal;
    }

    private RentalContract loadAuthorized(UUID contractId) {
        RentalContract contract = rentalContractRepository.findById(contractId)
                .orElseThrow(() -> new AppException(ErrorCode.CONTRACT_NOT_FOUND, "Không tìm thấy hợp đồng thuê"));
        UUID facilityId = contract.getFacility() != null ? contract.getFacility().getId() : null;
        if (facilityAccessGuard.isFacilityScoped()) {
            if (facilityId == null) {
                throw new AppException(ErrorCode.FACILITY_ACCESS_DENIED);
            }
            facilityAccessGuard.checkFacilityAccess(facilityId);
        }
        return contract;
    }

    /** Facility-scoped roles always see their own facility; a scoped account without facility sees nothing. */
    private UUID resolveScope(UUID requested) {
        if (facilityAccessGuard.isFacilityScoped()) {
            UUID own = requestContext.currentUserFacilityId();
            if (own == null || (requested != null && !Objects.equals(requested, own))) {
                throw new AppException(ErrorCode.FACILITY_ACCESS_DENIED);
            }
            return own;
        }
        return requested;
    }

    private static String unitCode(RentalContract contract) {
        return contract.getUnit() != null && contract.getUnit().getUnitCode() != null ? contract.getUnit().getUnitCode() : "—";
    }

    private static String blankToNull(String value) {
        return value != null && !value.isBlank() ? value : null;
    }
}

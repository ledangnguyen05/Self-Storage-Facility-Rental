package com.boxora.service.impl;

import com.boxora.dto.response.ContractOutstandingResponse;
import com.boxora.entity.Booking;
import com.boxora.entity.FacilityPolicy;
import com.boxora.entity.Payment;
import com.boxora.entity.RentalContract;
import com.boxora.entity.StorageUnit;
import com.boxora.enums.ActivityAction;
import com.boxora.enums.BookingStatus;
import com.boxora.enums.PaymentStatus;
import com.boxora.enums.PaymentType;
import com.boxora.enums.RentalContractStatus;
import com.boxora.enums.UnitStatus;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.repository.BookingRepository;
import com.boxora.repository.FacilityPolicyRepository;
import com.boxora.repository.PaymentRepository;
import com.boxora.repository.RentalContractRepository;
import com.boxora.repository.StorageUnitRepository;
import com.boxora.security.FacilityAccessGuard;
import com.boxora.security.RequestContext;
import com.boxora.service.AccessRestorationService;
import com.boxora.service.ActivityLogService;
import com.boxora.service.ContractBillingService;
import com.boxora.service.OverdueFeeCalculator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ContractBillingServiceImpl implements ContractBillingService {

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final Set<RentalContractStatus> STARTED = Set.of(
            RentalContractStatus.ACTIVE, RentalContractStatus.OVERDUE, RentalContractStatus.OVERDUE_LOCKED);
    private static final Set<RentalContractStatus> OVERDUE_STATUSES = Set.of(
            RentalContractStatus.OVERDUE, RentalContractStatus.OVERDUE_LOCKED);
    private static final int DEFAULT_RENEWAL_WINDOW_DAYS = 3;

    private final RentalContractRepository rentalContractRepository;
    private final BookingRepository bookingRepository;
    private final PaymentRepository paymentRepository;
    private final StorageUnitRepository storageUnitRepository;
    private final FacilityPolicyRepository facilityPolicyRepository;
    private final OverdueFeeCalculator overdueFeeCalculator;
    private final ObjectProvider<AccessRestorationService> accessRestorationServiceProvider;
    private final ActivityLogService activityLogService;
    private final FacilityAccessGuard facilityAccessGuard;
    private final RequestContext requestContext;
    private final PlatformTransactionManager transactionManager;

    @Override
    @Transactional(readOnly = true)
    public ContractOutstandingResponse getOutstanding(UUID contractId) {
        RentalContract contract = rentalContractRepository.findById(contractId)
                .orElseThrow(() -> new AppException(ErrorCode.CONTRACT_NOT_FOUND));
        assertContractAccess(contract);
        return computeOutstanding(contract, LocalDate.now());
    }

    @Override
    public void assertContractAccess(RentalContract contract) {
        String role = requestContext.currentUserRole();
        if ("CUSTOMER".equalsIgnoreCase(role)) {
            UUID currentUserId = requestContext.currentUserId();
            if (currentUserId == null || contract.getCustomer() == null || !currentUserId.equals(contract.getCustomer().getId())) {
                throw new AppException(ErrorCode.FORBIDDEN);
            }
            return;
        }
        if (facilityAccessGuard.isFacilityScoped() && contract.getFacility() != null) {
            facilityAccessGuard.checkFacilityAccess(contract.getFacility().getId());
        }
    }

    @Override
    public BigDecimal monthlyRent(RentalContract contract) {
        Booking booking = contract.getBooking();
        if (booking != null && booking.getTotalRentalFee() != null && booking.getRentalMonths() != null
                && booking.getRentalMonths() > 0 && booking.getTotalRentalFee().signum() > 0) {
            return booking.getTotalRentalFee().divide(BigDecimal.valueOf(booking.getRentalMonths()), 0, RoundingMode.HALF_UP);
        }
        return contract.getMonthlyFee() != null ? contract.getMonthlyFee().setScale(0, RoundingMode.HALF_UP) : BigDecimal.ZERO;
    }

    @Override
    @Transactional(readOnly = true)
    public ContractOutstandingResponse computeOutstanding(RentalContract contract, LocalDate asOf) {
        LocalDate today = asOf != null ? asOf : LocalDate.now();
        Booking booking = contract.getBooking();
        BigDecimal monthlyRent = monthlyRent(contract);

        int termMonths = resolveTermMonths(contract);
        LocalDate termStart = contract.getStartDate();
        LocalDate termEnd = termStart != null ? termStart.plusMonths(termMonths) : null;
        boolean started = STARTED.contains(contract.getStatus());

        int billedMonths = 0;
        if (started && termStart != null && !today.isBefore(termStart)) {
            long elapsed = ChronoUnit.MONTHS.between(termStart, today);
            billedMonths = (int) Math.min(termMonths, elapsed + 1);
        }

        BigDecimal rentPaid = rentPaid(contract, booking, monthlyRent);
        BigDecimal rentDue = monthlyRent.multiply(BigDecimal.valueOf(billedMonths));
        BigDecimal rentOutstanding = rentDue.subtract(rentPaid).max(BigDecimal.ZERO);

        int coveredMonths = monthlyRent.signum() > 0
                ? rentPaid.divide(monthlyRent, 0, RoundingMode.FLOOR).min(BigDecimal.valueOf(termMonths)).intValue()
                : termMonths;
        int remainingTermMonths = started ? Math.max(0, termMonths - Math.max(billedMonths, coveredMonths)) : 0;
        BigDecimal remainingTermRent = monthlyRent.multiply(BigDecimal.valueOf(remainingTermMonths));
        int nextPeriod = Math.max(billedMonths, coveredMonths);
        LocalDate nextRentDueDate = started && termStart != null && nextPeriod < termMonths ? termStart.plusMonths(nextPeriod) : null;

        boolean pastEnd = started && contract.getEndDate() != null && today.isAfter(contract.getEndDate());
        int overdueDays = pastEnd ? overdueFeeCalculator.daysOverdue(contract, today) : 0;
        BigDecimal lateFee = pastEnd ? nz(overdueFeeCalculator.calculateLateFee(contract, today)) : BigDecimal.ZERO;
        BigDecimal overdueRent = pastEnd ? nz(overdueFeeCalculator.calculateOverdueRent(contract, today)) : BigDecimal.ZERO;
        int blocks = overdueDays > 0 ? (overdueDays + OverdueFeeCalculator.RENT_BLOCK_DAYS - 1) / OverdueFeeCalculator.RENT_BLOCK_DAYS : 0;
        int extensionDays = blocks * OverdueFeeCalculator.RENT_BLOCK_DAYS;

        BigDecimal totalDueNow = rentOutstanding.add(lateFee).add(overdueRent);

        List<ContractOutstandingResponse.Item> items = new ArrayList<>();
        if (rentOutstanding.signum() > 0) {
            items.add(item("RENT_OUTSTANDING", String.format("Tiền thuê các kỳ đã đến hạn (%d/%d tháng)", billedMonths, termMonths), rentOutstanding));
        }
        if (overdueRent.signum() > 0) {
            items.add(item("OVERDUE_RENT", String.format("Tiền thuê thời gian quá hạn (%d ngày, tính theo %d khối 30 ngày)", overdueDays, blocks), overdueRent));
        }
        if (lateFee.signum() > 0) {
            items.add(item("LATE_FEE", String.format("Phí trễ hạn theo chính sách cơ sở (%d ngày quá hạn)", overdueDays), lateFee));
        }

        String blockedReason = null;
        if (!started) {
            blockedReason = "Hợp đồng chưa bắt đầu tính tiền thuê. Khoản thanh toán đầu tiên được thực hiện khi đặt kho hoặc khi nhận kho.";
        } else if (totalDueNow.signum() <= 0 && remainingTermMonths <= 0) {
            blockedReason = "Bạn đã thanh toán đủ tiền thuê của hợp đồng.";
        } else if (booking != null && (booking.getStatus() == BookingStatus.CHECKOUT_REQUESTED || booking.getStatus() == BookingStatus.INSPECTED)) {
            blockedReason = "Kho đang làm thủ tục trả kho. Các khoản còn lại được quyết toán tại quầy.";
        }

        String note;
        if (pastEnd) {
            note = String.format("Hợp đồng đã hết hạn ngày %s. Thanh toán công nợ quá hạn sẽ kéo dài thời hạn thuê đến %s "
                            + "và mở lại quyền truy cập kho; bạn cũng có thể gia hạn hợp đồng theo tháng.",
                    contract.getEndDate().format(DATE_FMT), contract.getEndDate().plusDays(extensionDays).format(DATE_FMT));
        } else if (rentOutstanding.signum() > 0) {
            note = "Tiền thuê được tính vào đầu mỗi kỳ hàng tháng kể từ ngày nhận kho.";
        } else if (nextRentDueDate != null) {
            note = String.format("Kỳ thuê tiếp theo đến hạn ngày %s.", nextRentDueDate.format(DATE_FMT));
        } else {
            note = started ? "Không có khoản tiền thuê nào đến hạn." : blockedReason;
        }

        return ContractOutstandingResponse.builder()
                .contractId(contract.getId())
                .contractCode(contract.getContractCode())
                .contractStatus(contract.getStatus() != null ? contract.getStatus().name() : null)
                .bookingId(booking != null ? booking.getId() : null)
                .bookingCode(booking != null ? booking.getBookingCode() : null)
                .unitCode(contract.getUnit() != null ? contract.getUnit().getUnitCode() : null)
                .facilityName(contract.getFacility() != null ? contract.getFacility().getName() : null)
                .termStartDate(termStart)
                .termEndDate(termEnd)
                .contractEndDate(contract.getEndDate())
                .termMonths(termMonths)
                .monthlyRent(monthlyRent)
                .billedMonths(billedMonths)
                .rentDue(rentDue)
                .rentPaid(rentPaid)
                .rentOutstanding(rentOutstanding)
                .remainingTermMonths(remainingTermMonths)
                .remainingTermRent(remainingTermRent)
                .nextRentDueDate(nextRentDueDate)
                .overdue(pastEnd || OVERDUE_STATUSES.contains(contract.getStatus()))
                .overdueDays(overdueDays)
                .lateFee(lateFee)
                .overdueRent(overdueRent)
                .extensionDays(extensionDays)
                .paidThroughAfterSettlement(pastEnd ? contract.getEndDate().plusDays(extensionDays) : null)
                .totalDueNow(totalDueNow)
                .canPayOnline(blockedReason == null)
                .blockedReason(blockedReason)
                .note(note)
                .items(items)
                .build();
    }

    @Override
    @Transactional
    public void applyRentalPayment(Payment payment) {
        RentalContract contract = payment.getContract();
        if (contract == null && payment.getBooking() != null) {
            contract = rentalContractRepository.findByBookingId(payment.getBooking().getId()).orElse(null);
        }
        if (contract == null) {
            return;
        }
        boolean wasOverdue = OVERDUE_STATUSES.contains(contract.getStatus());
        int extensionDays = payment.getExtensionDays() != null ? payment.getExtensionDays() : 0;
        UUID facilityId = contract.getFacility() != null ? contract.getFacility().getId() : null;

        if (extensionDays > 0 && contract.getEndDate() != null) {
            LocalDate oldEnd = contract.getEndDate();
            LocalDate newEnd = oldEnd.plusDays(extensionDays);
            contract.setEndDate(newEnd);
            rentalContractRepository.save(contract);
            Booking booking = contract.getBooking();
            if (booking != null) {
                booking.setEndDate(newEnd);
                bookingRepository.save(booking);
            }
            activityLogService.recordSystem(facilityId, ActivityAction.CONTRACT_EXTENDED, "RentalContract", contract.getId(),
                    String.format("Khách thanh toán công nợ quá hạn (giao dịch %s): thời hạn hợp đồng %s chuyển từ %s đến %s.",
                            payment.getTransactionId(), contract.getContractCode(), oldEnd.format(DATE_FMT), newEnd.format(DATE_FMT)));
        }

        if (wasOverdue) {
            ContractOutstandingResponse after = computeOutstanding(contract, LocalDate.now());
            boolean settled = after.getTotalDueNow().signum() <= 0
                    && contract.getEndDate() != null && !contract.getEndDate().isBefore(LocalDate.now());
            if (settled) {
                restoreAccessAfterCommit(contract, "Khách hàng đã thanh toán công nợ quá hạn qua VNPay (giao dịch "
                        + payment.getTransactionId() + ")");
            } else {
                log.info("[BILLING] Contract {} still owes {} after payment {}; access stays restricted",
                        contract.getContractCode(), after.getTotalDueNow(), payment.getTransactionId());
            }
        }
    }

    @Override
    public void restoreAccessAfterCommit(RentalContract contract, String reason) {
        UUID contractId = contract.getId();
        Runnable restore = () -> {
            AccessRestorationService service = accessRestorationServiceProvider.getIfAvailable();
            // afterCommit still has the old transaction bound: work must run in a NEW transaction.
            TransactionTemplate template = new TransactionTemplate(transactionManager);
            template.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
            try {
                template.executeWithoutResult(status -> {
                    if (service != null) {
                        service.restoreAccessAfterSettlement(contractId, reason);
                    } else {
                        log.warn("[BILLING] AccessRestorationService is not available; applying minimal restoration for contract {}", contractId);
                        minimalRestore(contractId, reason);
                    }
                });
            } catch (Exception ex) {
                log.error("[BILLING] Access restoration failed for contract {}: {}", contractId, ex.getMessage(), ex);
            }
        };
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    restore.run();
                }
            });
        } else {
            restore.run();
        }
    }

    /** Used only when the overdue module is not deployed: status changes without PIN re-issue. */
    private void minimalRestore(UUID contractId, String reason) {
        RentalContract contract = rentalContractRepository.findById(contractId).orElse(null);
        if (contract == null || !OVERDUE_STATUSES.contains(contract.getStatus())) {
            return;
        }
        contract.setStatus(RentalContractStatus.ACTIVE);
        rentalContractRepository.save(contract);
        Booking booking = contract.getBooking();
        if (booking != null && booking.getStatus() == BookingStatus.OVERDUE) {
            booking.setStatus(BookingStatus.ACTIVE);
            bookingRepository.save(booking);
        }
        StorageUnit unit = contract.getUnit();
        if (unit != null && unit.getStatus() == UnitStatus.OVERDUE_LOCKED) {
            unit.setStatus(UnitStatus.OCCUPIED);
            storageUnitRepository.save(unit);
        }
        activityLogService.recordSystem(contract.getFacility() != null ? contract.getFacility().getId() : null,
                ActivityAction.CONTRACT_EXTENDED, "RentalContract", contract.getId(),
                "Đã gỡ trạng thái quá hạn của hợp đồng " + contract.getContractCode() + ". " + reason);
    }

    @Override
    @Transactional
    public void syncContractDeposit(Booking booking) {
        if (booking == null || booking.getId() == null || booking.getDepositPaid() == null) {
            return;
        }
        rentalContractRepository.findByBookingId(booking.getId()).ifPresent(contract -> {
            BigDecimal held = contract.getDepositHeld() != null ? contract.getDepositHeld() : BigDecimal.ZERO;
            if (booking.getDepositPaid().compareTo(held) > 0) {
                contract.setDepositHeld(booking.getDepositPaid());
                rentalContractRepository.save(contract);
            }
        });
    }

    @Override
    public RenewalWindow renewalWindow(RentalContract contract, LocalDate asOf) {
        LocalDate today = asOf != null ? asOf : LocalDate.now();
        FacilityPolicy policy = contract.getFacility() != null
                ? facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(contract.getFacility().getId()).orElse(null)
                : null;
        int windowDays = policy != null && policy.getRenewalWindowDays() != null && policy.getRenewalWindowDays() >= 0
                ? policy.getRenewalWindowDays() : DEFAULT_RENEWAL_WINDOW_DAYS;
        LocalDate end = contract.getEndDate();
        LocalDate opensOn = end != null ? end.minusDays(windowDays) : null;
        RentalContractStatus status = contract.getStatus();

        if (status == null || !STARTED.contains(status)) {
            String reason = switch (status == null ? RentalContractStatus.DRAFT : status) {
                case PENDING_SIGNATURE, PENDING_VERIFICATION, PENDING_ACTIVATION, DRAFT ->
                        "Hợp đồng chưa có hiệu lực. Bạn có thể gia hạn sau khi nhận kho.";
                default -> "Hợp đồng đã kết thúc nên không thể gia hạn.";
            };
            return new RenewalWindow(false, opensOn, null, windowDays, reason);
        }
        Booking booking = contract.getBooking();
        if (booking != null && (booking.getStatus() == BookingStatus.CHECKOUT_REQUESTED || booking.getStatus() == BookingStatus.INSPECTED)) {
            return new RenewalWindow(false, opensOn, null, windowDays, "Bạn đã gửi yêu cầu trả kho nên không thể gia hạn hợp đồng này.");
        }
        if (end == null) {
            return new RenewalWindow(false, null, null, windowDays, "Hợp đồng chưa có ngày kết thúc.");
        }
        if (status == RentalContractStatus.ACTIVE && today.isBefore(opensOn)) {
            return new RenewalWindow(false, opensOn, null, windowDays, String.format(
                    "Bạn có thể gia hạn từ ngày %s (trong vòng %d ngày trước khi hợp đồng hết hạn ngày %s).",
                    opensOn.format(DATE_FMT), windowDays, end.format(DATE_FMT)));
        }
        return new RenewalWindow(true, opensOn, null, windowDays, null);
    }

    // ------------------------------------------------------------------ helpers

    private int resolveTermMonths(RentalContract contract) {
        Booking booking = contract.getBooking();
        if (booking != null && booking.getRentalMonths() != null && booking.getRentalMonths() > 0) {
            return booking.getRentalMonths();
        }
        if (contract.getStartDate() != null && contract.getEndDate() != null) {
            return (int) Math.max(1, ChronoUnit.MONTHS.between(contract.getStartDate(), contract.getEndDate()));
        }
        return 1;
    }

    /**
     * Rent paid so far for the booked term, in two parts:
     * <ul>
     *   <li><b>initial</b>: what was paid for the first month with the reservation or at the counter on the
     *       check-in day: the rent part of the online booking payment (amount minus the deposit) and RENTAL_FEE
     *       payments not made against the contract or dated on/before the check-in. A booking marked PAID without
     *       such a record (seeded / legacy data) counts as having paid that first month;</li>
     *   <li><b>later</b>: RENTAL_FEE payments made against the contract after the check-in, and every online (VNPay)
     *       RENTAL_FEE payment of the contract (outstanding rent, paying ahead, overdue settlement), minus their
     *       late-fee / overdue-rent parts.</li>
     * </ul>
     * The "first month assumed paid" fallback only fills the <i>initial</i> part, so a later rent payment always
     * adds to it instead of replacing it.
     */
    BigDecimal rentPaid(RentalContract contract, Booking booking, BigDecimal monthlyRent) {
        Map<UUID, Payment> payments = new LinkedHashMap<>();
        if (booking != null && booking.getId() != null) {
            paymentRepository.findAllByBooking_Id(booking.getId()).forEach(p -> payments.put(p.getId(), p));
        }
        if (contract.getId() != null) {
            paymentRepository.findAllByContract_Id(contract.getId()).forEach(p -> payments.putIfAbsent(p.getId(), p));
        }
        LocalDate checkInDay = booking != null && booking.getHandoverTime() != null
                ? booking.getHandoverTime().toLocalDate() : contract.getStartDate();
        BigDecimal initialRent = BigDecimal.ZERO;
        BigDecimal laterRent = BigDecimal.ZERO;
        BigDecimal bookingPayments = BigDecimal.ZERO;
        for (Payment p : payments.values()) {
            if (p.getStatus() != PaymentStatus.PAID || p.getAmount() == null) {
                continue;
            }
            if (p.getPaymentType() == PaymentType.RENTAL_FEE) {
                BigDecimal rentPart = p.getAmount().subtract(nz(p.getLateFeeAmount())).subtract(nz(p.getOverdueRentAmount())).max(BigDecimal.ZERO);
                LocalDate paidOn = p.getPaymentTime() != null ? p.getPaymentTime().toLocalDate() : null;
                // Online rent payments against a contract are only possible once the rental has started (outstanding
                // rent / paying ahead), so they always pay a later period, even on the check-in day itself.
                boolean onlineContractRent = p.getContract() != null && "VNPAY".equalsIgnoreCase(p.getPaymentMethod());
                boolean atCheckIn = !onlineContractRent
                        && (p.getContract() == null || checkInDay == null || paidOn == null || !paidOn.isAfter(checkInDay));
                if (atCheckIn) {
                    initialRent = initialRent.add(rentPart);
                } else {
                    laterRent = laterRent.add(rentPart);
                }
            } else if (p.getPaymentType() == PaymentType.BOOKING_PAYMENT) {
                bookingPayments = bookingPayments.add(p.getAmount());
            }
        }
        if (bookingPayments.signum() > 0) {
            BigDecimal deposit = booking != null && booking.getDepositAmount() != null ? booking.getDepositAmount() : BigDecimal.ZERO;
            initialRent = initialRent.add(bookingPayments.subtract(deposit).max(BigDecimal.ZERO));
        }
        if (booking != null && "PAID".equalsIgnoreCase(booking.getPaymentStatus()) && initialRent.compareTo(monthlyRent) < 0) {
            initialRent = monthlyRent;
        }
        return initialRent.add(laterRent).setScale(0, RoundingMode.HALF_UP);
    }

    private static ContractOutstandingResponse.Item item(String code, String label, BigDecimal amount) {
        return ContractOutstandingResponse.Item.builder().code(code).label(label).amount(amount).build();
    }

    private static BigDecimal nz(BigDecimal value) {
        return value != null ? value : BigDecimal.ZERO;
    }
}

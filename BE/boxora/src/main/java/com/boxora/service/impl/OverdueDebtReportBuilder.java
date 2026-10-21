package com.boxora.service.impl;

import com.boxora.dto.response.FacilityOverdueDebtResponse;
import com.boxora.dto.response.OverdueDebtItemResponse;
import com.boxora.dto.response.OverdueDebtReportResponse;
import com.boxora.entity.Booking;
import com.boxora.entity.Facility;
import com.boxora.entity.RentalContract;
import com.boxora.entity.StorageUnit;
import com.boxora.entity.User;
import com.boxora.enums.BookingStatus;
import com.boxora.enums.RentalContractStatus;
import com.boxora.enums.UnitStatus;
import com.boxora.repository.BookingReportRepository;
import com.boxora.repository.ContractReportRepository;
import com.boxora.repository.PaymentReportRepository;
import com.boxora.service.OverdueFeeCalculator;
import com.boxora.service.OverdueFeeCalculator.OverduePolicy;
import com.boxora.service.OverdueFeeCalculator.Stage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Builds the overdue-debt ledger from real contracts, bookings and payments.
 *
 * <p>Money and stages come from {@link OverdueFeeCalculator} (the one overdue rule driven by the facility
 * policy); this class only collects the rows, subtracts what the customer already paid for the overdue period
 * and sums the figures. Nothing is invented: a missing customer or facility field stays {@code null}.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class OverdueDebtReportBuilder {

    /** Contract states in which an end date in the past means the customer still owes money. */
    private static final List<RentalContractStatus> PAST_DUE_CONTRACT_STATUSES = List.of(
            RentalContractStatus.ACTIVE,
            RentalContractStatus.OVERDUE,
            RentalContractStatus.OVERDUE_LOCKED,
            RentalContractStatus.EXPIRED);

    /** Bookings in which the customer holds the unit without a contract to bill (data anomaly, still reported). */
    private static final List<BookingStatus> PAST_DUE_BOOKING_STATUSES = List.of(
            BookingStatus.ACTIVE,
            BookingStatus.OVERDUE);

    /** QR token written when overdue processing revokes a customer's access. */
    private static final String REVOKED_OVERDUE_TOKEN = "REVOKED_OVERDUE";

    private final ContractReportRepository contractReportRepository;
    private final BookingReportRepository bookingReportRepository;
    private final PaymentReportRepository paymentReportRepository;
    private final OverdueFeeCalculator overdueFeeCalculator;

    /** Figures of one overdue contract (or booking standing in for a contract) on a given day. */
    public record DebtFigures(
            int daysOverdue,
            Stage stage,
            OverduePolicy policy,
            BigDecimal unpaidRent,
            BigDecimal lateFee,
            BigDecimal paidAmount
    ) {
        public BigDecimal totalDebt() {
            return unpaidRent.add(lateFee);
        }
    }

    public OverdueDebtReportResponse build(UUID facilityId, LocalDate today) {
        Map<UUID, OverduePolicy> policies = new HashMap<>();

        List<RentalContract> contracts = contractReportRepository.findPastDue(PAST_DUE_CONTRACT_STATUSES, today, facilityId);
        Map<UUID, List<PaidRow>> overstayPayments = loadOverstayPayments(contracts);

        List<OverdueDebtItemResponse> items = new ArrayList<>();
        for (RentalContract contract : contracts) {
            DebtFigures figures = figures(contract, today, policies,
                    paidSince(overstayPayments.get(contract.getId()), contract.getEndDate()));
            if (figures != null) {
                items.add(toItem(contract, contract.getBooking(), figures));
            }
        }

        for (Booking booking : bookingReportRepository.findPastDueWithoutContract(PAST_DUE_BOOKING_STATUSES, today, facilityId)) {
            RentalContract stand = standInContract(booking);
            if (stand == null) {
                log.warn("Skipping overdue booking {} without a contract: its monthly rent cannot be derived", booking.getBookingCode());
                continue;
            }
            DebtFigures figures = figures(stand, today, policies, BigDecimal.ZERO);
            if (figures != null) {
                OverdueDebtItemResponse item = toItem(stand, booking, figures);
                item.setContractId(null);
                item.setContractCode(null);
                item.setContractStatus(null);
                items.add(item);
            }
        }

        items.sort(Comparator.comparingLong(OverdueDebtItemResponse::getDaysOverdue).reversed());
        return summarize(items, today);
    }

    /** Figures for a single contract on {@code asOf}, or {@code null} when it is not overdue. */
    public DebtFigures figuresFor(RentalContract contract, LocalDate asOf) {
        Map<UUID, OverduePolicy> policies = new HashMap<>();
        Map<UUID, List<PaidRow>> payments = loadOverstayPayments(List.of(contract));
        return figures(contract, asOf, policies, paidSince(payments.get(contract.getId()), contract.getEndDate()));
    }

    // ---------------------------------------------------------------------------- figures

    private DebtFigures figures(RentalContract contract, LocalDate today, Map<UUID, OverduePolicy> policies, BigDecimal paid) {
        int days = overdueFeeCalculator.daysOverdue(contract, today);
        if (days <= 0) {
            return null;
        }
        UUID facilityId = contract.getFacility() != null ? contract.getFacility().getId() : null;
        OverduePolicy policy = facilityId == null
                ? OverduePolicy.defaults()
                : policies.computeIfAbsent(facilityId, overdueFeeCalculator::policyFor);

        BigDecimal rentDue = nz(overdueFeeCalculator.calculateOverdueRent(contract, today));
        BigDecimal lateDue = nz(overdueFeeCalculator.calculateLateFee(days, policy));
        BigDecimal paidTotal = nz(paid).min(rentDue.add(lateDue));

        // What the customer paid settles the rent first, then the late fee.
        BigDecimal rentOutstanding = rentDue.subtract(paidTotal).max(BigDecimal.ZERO);
        BigDecimal paidOnLateFee = paidTotal.subtract(rentDue).max(BigDecimal.ZERO);
        BigDecimal lateOutstanding = lateDue.subtract(paidOnLateFee).max(BigDecimal.ZERO);

        return new DebtFigures(days, overdueFeeCalculator.stageOf(days, policy), policy,
                rentOutstanding, lateOutstanding, paidTotal);
    }

    private Map<UUID, List<PaidRow>> loadOverstayPayments(Collection<RentalContract> contracts) {
        Set<UUID> ids = new HashSet<>();
        for (RentalContract contract : contracts) {
            if (contract.getId() != null) {
                ids.add(contract.getId());
            }
        }
        Map<UUID, List<PaidRow>> byContract = new HashMap<>();
        if (ids.isEmpty()) {
            return byContract;
        }
        for (Object[] row : paymentReportRepository.findOverstayPayments(ids)) {
            if (row[0] == null || row[2] == null) {
                continue;
            }
            LocalDateTime paidAt = row[1] instanceof LocalDateTime time ? time : null;
            byContract.computeIfAbsent((UUID) row[0], key -> new ArrayList<>())
                    .add(new PaidRow(paidAt, toBigDecimal(row[2])));
        }
        return byContract;
    }

    private BigDecimal paidSince(List<PaidRow> rows, LocalDate dueDate) {
        if (rows == null || dueDate == null) {
            return BigDecimal.ZERO;
        }
        LocalDateTime since = dueDate.atStartOfDay();
        BigDecimal sum = BigDecimal.ZERO;
        for (PaidRow row : rows) {
            if (row.paidAt() != null && !row.paidAt().isBefore(since)) {
                sum = sum.add(row.amount());
            }
        }
        return sum;
    }

    /** A booking without a contract is priced as if it had one: its monthly rent and its own end date. */
    private RentalContract standInContract(Booking booking) {
        Integer months = booking.getRentalMonths();
        BigDecimal total = booking.getTotalRentalFee();
        if (months == null || months <= 0 || total == null || total.signum() <= 0 || booking.getStorageUnit() == null) {
            return null;
        }
        StorageUnit unit = booking.getStorageUnit();
        return RentalContract.builder()
                .customer(booking.getCustomer())
                .unit(unit)
                .facility(unit.getFacility())
                .booking(booking)
                .startDate(booking.getStartDate())
                .endDate(booking.getEndDate())
                .monthlyFee(total.divide(BigDecimal.valueOf(months), 0, RoundingMode.HALF_UP))
                .status(RentalContractStatus.ACTIVE)
                .build();
    }

    // ---------------------------------------------------------------------------- item

    private OverdueDebtItemResponse toItem(RentalContract contract, Booking booking, DebtFigures figures) {
        User customer = contract.getCustomer();
        StorageUnit unit = contract.getUnit();
        Facility facility = contract.getFacility();
        UnitStatus unitStatus = unit != null ? unit.getStatus() : null;

        boolean accessRevoked = booking != null && booking.getQrAccessToken() != null
                && booking.getQrAccessToken().startsWith(REVOKED_OVERDUE_TOKEN);
        boolean sealed = contract.getStatus() == RentalContractStatus.OVERDUE_LOCKED;
        boolean locked = sealed || unitStatus == UnitStatus.OVERDUE_LOCKED || accessRevoked;

        String smartLockStatus;
        if (sealed) {
            smartLockStatus = "SEALED";
        } else if (locked) {
            smartLockStatus = "TEMP_LOCKED";
        } else if (figures.stage() == Stage.GRACE_PERIOD) {
            smartLockStatus = "NORMAL";
        } else {
            smartLockStatus = "WARNING";
        }

        return OverdueDebtItemResponse.builder()
                .contractId(contract.getId())
                .contractCode(contract.getContractCode())
                .bookingId(booking != null ? booking.getId() : null)
                .bookingCode(booking != null ? booking.getBookingCode() : null)
                .customerId(customer != null ? customer.getId() : null)
                .customerName(customer != null ? displayName(customer) : null)
                .customerPhone(customer != null ? customer.getPhone() : null)
                .customerEmail(customer != null ? customer.getEmail() : null)
                .unitId(unit != null ? unit.getId() : null)
                .unitCode(unit != null ? unit.getUnitCode() : null)
                .facilityId(facility != null ? facility.getId() : null)
                .facilityName(facility != null ? facility.getName() : null)
                .startDate(contract.getStartDate())
                .dueDate(contract.getEndDate())
                .daysOverdue(figures.daysOverdue())
                .unpaidRent(figures.unpaidRent())
                .dailyLateFee(figures.policy().dailyLateFee())
                .totalLateFee(figures.lateFee())
                .paidAmount(figures.paidAmount())
                .totalDebt(figures.totalDebt())
                .overdueStage(figures.stage().name())
                .smartLockStatus(smartLockStatus)
                .contractStatus(contract.getStatus() != null ? contract.getStatus().name() : null)
                .unitStatus(unitStatus != null ? unitStatus.name() : null)
                .locked(locked)
                .build();
    }

    private static String displayName(User user) {
        if (user.getFullName() != null && !user.getFullName().isBlank()) {
            return user.getFullName();
        }
        return user.getUsername();
    }

    // ---------------------------------------------------------------------------- totals

    private OverdueDebtReportResponse summarize(List<OverdueDebtItemResponse> items, LocalDate today) {
        BigDecimal aging1To3 = BigDecimal.ZERO;
        BigDecimal aging4To7 = BigDecimal.ZERO;
        BigDecimal aging8To14 = BigDecimal.ZERO;
        BigDecimal aging15Plus = BigDecimal.ZERO;
        BigDecimal graceDebt = BigDecimal.ZERO;
        BigDecimal totalUnpaid = BigDecimal.ZERO;
        BigDecimal totalLate = BigDecimal.ZERO;
        long graceCount = 0;
        long warningCount = 0;
        long blockedCount = 0;
        long sealingCount = 0;
        Set<Object> lockedUnits = new HashSet<>();

        for (OverdueDebtItemResponse item : items) {
            long days = item.getDaysOverdue();
            BigDecimal debt = nz(item.getTotalDebt());
            totalUnpaid = totalUnpaid.add(nz(item.getUnpaidRent()));
            totalLate = totalLate.add(nz(item.getTotalLateFee()));

            if (days <= 3) {
                aging1To3 = aging1To3.add(debt);
            } else if (days <= 7) {
                aging4To7 = aging4To7.add(debt);
            } else if (days <= 14) {
                aging8To14 = aging8To14.add(debt);
            } else {
                aging15Plus = aging15Plus.add(debt);
            }

            switch (Stage.valueOf(item.getOverdueStage())) {
                case GRACE_PERIOD -> {
                    graceCount++;
                    graceDebt = graceDebt.add(debt);
                }
                case ACCESS_BLOCKED -> blockedCount++;
                case ELIGIBLE_FOR_SEALING -> sealingCount++;
                default -> warningCount++;
            }

            if (item.isLocked()) {
                lockedUnits.add(item.getUnitId() != null ? item.getUnitId() : item);
            }
        }

        BigDecimal totalDebt = totalUnpaid.add(totalLate);

        Map<UUID, List<OverdueDebtItemResponse>> byFacilityMap = new LinkedHashMap<>();
        for (OverdueDebtItemResponse item : items) {
            if (item.getFacilityId() != null) {
                byFacilityMap.computeIfAbsent(item.getFacilityId(), key -> new ArrayList<>()).add(item);
            }
        }
        List<FacilityOverdueDebtResponse> byFacility = new ArrayList<>();
        for (Map.Entry<UUID, List<OverdueDebtItemResponse>> entry : byFacilityMap.entrySet()) {
            List<OverdueDebtItemResponse> group = entry.getValue();
            BigDecimal unpaid = group.stream().map(OverdueDebtItemResponse::getUnpaidRent).map(OverdueDebtReportBuilder::nz)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal late = group.stream().map(OverdueDebtItemResponse::getTotalLateFee).map(OverdueDebtReportBuilder::nz)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            byFacility.add(FacilityOverdueDebtResponse.builder()
                    .facilityId(entry.getKey())
                    .facilityName(group.get(0).getFacilityName())
                    .overdueContractCount(group.size())
                    .totalUnpaidRent(unpaid)
                    .totalLateFees(late)
                    .totalOverdueDebt(unpaid.add(late))
                    .build());
        }
        byFacility.sort(Comparator.comparing(FacilityOverdueDebtResponse::getTotalOverdueDebt).reversed());

        return OverdueDebtReportResponse.builder()
                .asOfDate(today)
                .totalOverdueCount(items.size())
                .totalDebtAmount(totalDebt)
                .totalUnpaidRent(totalUnpaid)
                .totalLateFees(totalLate)
                .gracePeriodDebt(graceDebt)
                .delinquentCount(items.size() - graceCount)
                .delinquentDebtAmount(totalDebt.subtract(graceDebt))
                .lockedUnitCount(lockedUnits.size())
                .gracePeriodCount(graceCount)
                .warningCount(warningCount)
                .accessBlockedCount(blockedCount)
                .eligibleForSealingCount(sealingCount)
                .aging1To3DaysDebt(aging1To3)
                .aging4To7DaysDebt(aging4To7)
                .aging8To14DaysDebt(aging8To14)
                .aging15PlusDaysDebt(aging15Plus)
                .items(items)
                .byFacility(byFacility)
                .build();
    }

    private static BigDecimal nz(BigDecimal value) {
        return value != null ? value : BigDecimal.ZERO;
    }

    private static BigDecimal toBigDecimal(Object value) {
        if (value instanceof BigDecimal decimal) {
            return decimal;
        }
        return value instanceof Number number ? new BigDecimal(number.toString()) : BigDecimal.ZERO;
    }

    private record PaidRow(LocalDateTime paidAt, BigDecimal amount) {
    }
}

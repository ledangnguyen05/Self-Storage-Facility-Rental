package com.boxora.service.impl;

import com.boxora.dto.response.*;
import com.boxora.entity.Booking;
import com.boxora.entity.Facility;
import com.boxora.entity.FacilityPolicy;
import com.boxora.entity.RentalContract;
import com.boxora.entity.User;
import com.boxora.enums.ActivityAction;
import com.boxora.enums.BookingStatus;
import com.boxora.enums.RentalContractStatus;
import com.boxora.enums.UnitStatus;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.repository.*;
import com.boxora.security.FacilityAccessGuard;
import com.boxora.service.ActivityLogService;
import com.boxora.service.EmailService;
import com.boxora.service.ReportService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

import com.boxora.entity.Payment;
import com.boxora.enums.PaymentType;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional(readOnly = true) // reports only read data, never mutate it
public class ReportServiceImpl implements ReportService {

    private final PaymentRepository paymentRepository;
    private final StorageUnitRepository storageUnitRepository;
    private final FacilityRepository facilityRepository;
    private final RentalContractRepository rentalContractRepository;
    private final FacilityPolicyRepository facilityPolicyRepository;
    private final BookingRepository bookingRepository;
    private final EmailService emailService;
    private final ActivityLogService activityLogService;
    private final FacilityAccessGuard facilityAccessGuard;
    private final RefundRequestRepository refundRequestRepository;

    @Override
    public RevenueReportResponse getRevenueReport(LocalDate fromDate, LocalDate toDate) {
        return getRevenueReport(fromDate, toDate, null);
    }

    @Override
    public RevenueReportResponse getRevenueReport(LocalDate fromDate, LocalDate toDate, UUID facilityId) {
        if (fromDate != null && toDate != null && fromDate.isAfter(toDate)) {
            throw new AppException(ErrorCode.INVALID_REQUEST);
        }

        UUID effectiveFacilityId = facilityId;
        if (facilityAccessGuard.isFacilityScoped()) {
            effectiveFacilityId = facilityAccessGuard.scopedFacilityIdOrNull();
        }

        LocalDateTime from = fromDate != null ? fromDate.atStartOfDay() : LocalDateTime.of(2000, 1, 1, 0, 0, 0);
        LocalDateTime to = toDate != null ? toDate.atTime(LocalTime.MAX) : LocalDateTime.of(2099, 12, 31, 23, 59, 59);

        List<FacilityRevenueResponse> byFacility = paymentRepository.sumRevenueByFacility(from, to, effectiveFacilityId);
        SystemRevenueSummaryResponse systemSummary = paymentRepository.sumSystemRevenue(from, to, effectiveFacilityId);
        if (systemSummary == null) {
            systemSummary = SystemRevenueSummaryResponse.builder()
                    .totalRevenue(BigDecimal.ZERO)
                    .depositRevenue(BigDecimal.ZERO)
                    .rentalFeeRevenue(BigDecimal.ZERO)
                    .renewalFeeRevenue(BigDecimal.ZERO)
                    .extraChargeRevenue(BigDecimal.ZERO)
                    .bookingPaymentRevenue(BigDecimal.ZERO)
                    .paymentCount(0L)
                    .build();
        }

        List<RevenueMonthSummaryResponse> monthlyRevenue = Optional.ofNullable(
                        paymentRepository.sumRevenueByMonth(from, to, effectiveFacilityId))
                .orElseGet(List::of)
                .stream()
                .map(this::toMonthlySummary)
                .toList();
        List<PaymentMethodSummaryResponse> paymentsByMethod = Optional.ofNullable(
                        paymentRepository.countPaidPaymentsByMethod(from, to, effectiveFacilityId))
                .orElseGet(List::of)
                .stream()
                .map(this::toPaymentMethodSummary)
                .toList();

        // 1. Calculate Overdue Debt breakdown & total
        OverdueDebtReportResponse overdueDebtReport = getOverdueDebtReport(effectiveFacilityId);
        BigDecimal totalOverdueDebt = overdueDebtReport != null && overdueDebtReport.getTotalDebtAmount() != null
                ? overdueDebtReport.getTotalDebtAmount()
                : BigDecimal.ZERO;

        BigDecimal gracePeriodAmt = BigDecimal.ZERO;
        long gracePeriodCnt = 0;
        BigDecimal warningAmt = BigDecimal.ZERO;
        long warningCnt = 0;
        BigDecimal accessBlockedAmt = BigDecimal.ZERO;
        long accessBlockedCnt = 0;
        BigDecimal eligibleForSealingAmt = BigDecimal.ZERO;
        long eligibleForSealingCnt = 0;

        if (overdueDebtReport != null && overdueDebtReport.getItems() != null) {
            for (OverdueDebtItemResponse item : overdueDebtReport.getItems()) {
                BigDecimal debt = item.getTotalDebt() != null ? item.getTotalDebt() : BigDecimal.ZERO;
                String stage = item.getOverdueStage() != null ? item.getOverdueStage() : "";
                switch (stage) {
                    case "GRACE_PERIOD" -> {
                        gracePeriodAmt = gracePeriodAmt.add(debt);
                        gracePeriodCnt++;
                    }
                    case "WARNING" -> {
                        warningAmt = warningAmt.add(debt);
                        warningCnt++;
                    }
                    case "ACCESS_BLOCKED" -> {
                        accessBlockedAmt = accessBlockedAmt.add(debt);
                        accessBlockedCnt++;
                    }
                    case "ELIGIBLE_FOR_SEALING" -> {
                        eligibleForSealingAmt = eligibleForSealingAmt.add(debt);
                        eligibleForSealingCnt++;
                    }
                    default -> {
                    }
                }
            }
        }

        DebtBreakdownResponse debtBreakdown = DebtBreakdownResponse.builder()
                .gracePeriodAmount(gracePeriodAmt)
                .gracePeriodCount(gracePeriodCnt)
                .warningAmount(warningAmt)
                .warningCount(warningCnt)
                .accessBlockedAmount(accessBlockedAmt)
                .accessBlockedCount(accessBlockedCnt)
                .eligibleForSealingAmount(eligibleForSealingAmt)
                .eligibleForSealingCount(eligibleForSealingCnt)
                .totalDebt(totalOverdueDebt)
                .totalCount(overdueDebtReport != null ? overdueDebtReport.getTotalOverdueCount() : 0)
                .build();

        // 2. Calculate Active Deposits Held
        final UUID finalFacilityId = effectiveFacilityId;
        List<RentalContract> allContracts = rentalContractRepository.findAll();
        BigDecimal depositsHeld = allContracts.stream()
                .filter(c -> c.getStatus() == RentalContractStatus.ACTIVE
                        || c.getStatus() == RentalContractStatus.OVERDUE
                        || c.getStatus() == RentalContractStatus.OVERDUE_LOCKED)
                .filter(c -> finalFacilityId == null || (c.getFacility() != null && finalFacilityId.equals(c.getFacility().getId())))
                .map(c -> c.getDepositHeld() != null ? c.getDepositHeld() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // 3. Calculate Refunds breakdown
        List<com.boxora.entity.RefundRequest> allRefunds = refundRequestRepository.findAll();
        List<com.boxora.entity.RefundRequest> scopedRefunds = allRefunds.stream()
                .filter(r -> finalFacilityId == null || (r.getFacility() != null && finalFacilityId.equals(r.getFacility().getId())))
                .toList();

        BigDecimal completedRefundAmount = BigDecimal.ZERO;
        long completedRefundCount = 0;
        BigDecimal pendingReviewAmount = BigDecimal.ZERO;
        long pendingReviewCount = 0;
        BigDecimal processingTransferAmount = BigDecimal.ZERO;
        long processingTransferCount = 0;
        BigDecimal rejectedRefundAmount = BigDecimal.ZERO;
        long rejectedRefundCount = 0;
        BigDecimal totalRequestedAmount = BigDecimal.ZERO;

        for (com.boxora.entity.RefundRequest r : scopedRefunds) {
            BigDecimal amt = r.getFinalRefundAmount() != null ? r.getFinalRefundAmount() : (r.getRequestedAmount() != null ? r.getRequestedAmount() : BigDecimal.ZERO);
            totalRequestedAmount = totalRequestedAmount.add(amt);
            LocalDateTime refTime = r.getProcessedAt() != null ? r.getProcessedAt() : (r.getReviewedAt() != null ? r.getReviewedAt() : r.getCreatedAt());

            boolean inPeriod = (fromDate == null || !refTime.isBefore(from)) && (toDate == null || !refTime.isAfter(to));

            if (r.getStatus() == com.boxora.enums.RefundStatus.COMPLETED
                    || r.getStatus() == com.boxora.enums.RefundStatus.RECONCILED
                    || r.getStatus() == com.boxora.enums.RefundStatus.PROCESSED) {
                if (inPeriod) {
                    completedRefundAmount = completedRefundAmount.add(amt);
                    completedRefundCount++;
                }
            } else if (r.getStatus() == com.boxora.enums.RefundStatus.PENDING_REVIEW) {
                pendingReviewAmount = pendingReviewAmount.add(amt);
                pendingReviewCount++;
            } else if (r.getStatus() == com.boxora.enums.RefundStatus.APPROVED
                    || r.getStatus() == com.boxora.enums.RefundStatus.PROCESSING_TRANSFER
                    || r.getStatus() == com.boxora.enums.RefundStatus.AWAITING_CUSTOMER_CONFIRMATION) {
                processingTransferAmount = processingTransferAmount.add(amt);
                processingTransferCount++;
            } else if (r.getStatus() == com.boxora.enums.RefundStatus.REJECTED) {
                rejectedRefundAmount = rejectedRefundAmount.add(amt);
                rejectedRefundCount++;
            }
        }

        BigDecimal pendingRefundAmount = pendingReviewAmount.add(processingTransferAmount);
        long pendingReconciliationCount = pendingReviewCount + processingTransferCount;

        RefundBreakdownResponse refundBreakdown = RefundBreakdownResponse.builder()
                .completedRefundAmount(completedRefundAmount)
                .completedRefundCount(completedRefundCount)
                .pendingReviewAmount(pendingReviewAmount)
                .pendingReviewCount(pendingReviewCount)
                .processingTransferAmount(processingTransferAmount)
                .processingTransferCount(processingTransferCount)
                .rejectedRefundAmount(rejectedRefundAmount)
                .rejectedRefundCount(rejectedRefundCount)
                .totalRequestedAmount(totalRequestedAmount)
                .totalRefundRequests(scopedRefunds.size())
                .build();

        // 4. Enrich systemSummary with pure accounting indicators
        BigDecimal rentalRev = safe(systemSummary.getRentalFeeRevenue()).add(safe(systemSummary.getRenewalFeeRevenue()));
        BigDecimal grossRev = rentalRev.add(safe(systemSummary.getExtraChargeRevenue()));
        BigDecimal netRev = grossRev.subtract(completedRefundAmount).max(BigDecimal.ZERO);
        BigDecimal cashIn = grossRev.add(safe(systemSummary.getDepositRevenue())).add(safe(systemSummary.getBookingPaymentRevenue()));

        systemSummary.setNetRevenue(netRev);
        systemSummary.setTotalCashIn(cashIn);
        systemSummary.setRentalRevenue(rentalRev);
        systemSummary.setTotalOverdueDebt(totalOverdueDebt);
        systemSummary.setDepositsHeld(depositsHeld);
        systemSummary.setRefundedAmount(completedRefundAmount);
        systemSummary.setPendingRefundAmount(pendingRefundAmount);
        systemSummary.setPendingReconciliationCount(pendingReconciliationCount);

        // 5. Enrich facility breakdowns
        Map<UUID, BigDecimal> facilityDebts = new HashMap<>();
        if (overdueDebtReport != null && overdueDebtReport.getItems() != null) {
            for (OverdueDebtItemResponse item : overdueDebtReport.getItems()) {
                if (item.getFacilityId() != null && item.getTotalDebt() != null) {
                    facilityDebts.merge(item.getFacilityId(), item.getTotalDebt(), BigDecimal::add);
                }
            }
        }

        Map<UUID, BigDecimal> facilityDeposits = allContracts.stream()
                .filter(c -> (c.getStatus() == RentalContractStatus.ACTIVE
                        || c.getStatus() == RentalContractStatus.OVERDUE
                        || c.getStatus() == RentalContractStatus.OVERDUE_LOCKED) && c.getFacility() != null)
                .collect(Collectors.groupingBy(
                        c -> c.getFacility().getId(),
                        Collectors.reducing(BigDecimal.ZERO, c -> c.getDepositHeld() != null ? c.getDepositHeld() : BigDecimal.ZERO, BigDecimal::add)
                ));

        Map<UUID, BigDecimal> facilityRefunds = allRefunds.stream()
                .filter(r -> (r.getStatus() == com.boxora.enums.RefundStatus.COMPLETED
                        || r.getStatus() == com.boxora.enums.RefundStatus.RECONCILED
                        || r.getStatus() == com.boxora.enums.RefundStatus.PROCESSED) && r.getFacility() != null)
                .collect(Collectors.groupingBy(
                        r -> r.getFacility().getId(),
                        Collectors.reducing(BigDecimal.ZERO, r -> r.getFinalRefundAmount() != null ? r.getFinalRefundAmount() : BigDecimal.ZERO, BigDecimal::add)
                ));

        Map<UUID, BigDecimal> facilityPendingRefunds = allRefunds.stream()
                .filter(r -> (r.getStatus() == com.boxora.enums.RefundStatus.PENDING_REVIEW
                        || r.getStatus() == com.boxora.enums.RefundStatus.APPROVED
                        || r.getStatus() == com.boxora.enums.RefundStatus.PROCESSING_TRANSFER
                        || r.getStatus() == com.boxora.enums.RefundStatus.AWAITING_CUSTOMER_CONFIRMATION) && r.getFacility() != null)
                .collect(Collectors.groupingBy(
                        r -> r.getFacility().getId(),
                        Collectors.reducing(BigDecimal.ZERO, r -> r.getFinalRefundAmount() != null ? r.getFinalRefundAmount() : (r.getRequestedAmount() != null ? r.getRequestedAmount() : BigDecimal.ZERO), BigDecimal::add)
                ));

        for (FacilityRevenueResponse row : byFacility) {
            BigDecimal fRental = safe(row.getRentalFeeRevenue()).add(safe(row.getRenewalFeeRevenue()));
            BigDecimal fGross = fRental.add(safe(row.getExtraChargeRevenue()));
            BigDecimal fRefunded = facilityRefunds.getOrDefault(row.getFacilityId(), BigDecimal.ZERO);
            BigDecimal fNet = fGross.subtract(fRefunded).max(BigDecimal.ZERO);
            BigDecimal fCashIn = fGross.add(safe(row.getDepositRevenue())).add(safe(row.getBookingPaymentRevenue()));

            row.setNetRevenue(fNet);
            row.setTotalCashIn(fCashIn);
            row.setRentalRevenue(fRental);
            row.setDepositsHeld(facilityDeposits.getOrDefault(row.getFacilityId(), BigDecimal.ZERO));
            row.setTotalOverdueDebt(facilityDebts.getOrDefault(row.getFacilityId(), BigDecimal.ZERO));
            row.setRefundedAmount(fRefunded);
            row.setPendingRefundAmount(facilityPendingRefunds.getOrDefault(row.getFacilityId(), BigDecimal.ZERO));
        }

        return RevenueReportResponse.builder()
                .fromDate(fromDate)
                .toDate(toDate)
                .systemSummary(systemSummary)
                .byFacility(byFacility)
                .monthlyRevenue(monthlyRevenue)
                .paymentsByMethod(paymentsByMethod)
                .debtBreakdown(debtBreakdown)
                .refundBreakdown(refundBreakdown)
                .build();
    }

    private RevenueMonthSummaryResponse toMonthlySummary(Object[] row) {
        Number year = (Number) row[0];
        Number month = (Number) row[1];
        String monthKey = year == null || month == null
                ? null
                : String.format(Locale.ROOT, "%04d-%02d", year.intValue(), month.intValue());

        return RevenueMonthSummaryResponse.builder()
                .month(monthKey)
                .rentalFeeRevenue(toBigDecimal(row[2]))
                .depositRevenue(toBigDecimal(row[3]))
                .renewalFeeRevenue(toBigDecimal(row[4]))
                .extraChargeRevenue(toBigDecimal(row[5]))
                .bookingPaymentRevenue(toBigDecimal(row[6]))
                .totalRevenue(toBigDecimal(row[7]))
                .paymentCount(((Number) row[8]).longValue())
                .build();
    }

    private PaymentMethodSummaryResponse toPaymentMethodSummary(Object[] row) {
        String method = (String) row[0];
        long count = row[1] != null ? ((Number) row[1]).longValue() : 0L;
        BigDecimal totalAmt = row.length > 2 ? toBigDecimal(row[2]) : BigDecimal.ZERO;
        BigDecimal recAmt = row.length > 3 ? toBigDecimal(row[3]) : BigDecimal.ZERO;
        return PaymentMethodSummaryResponse.builder()
                .paymentMethod(method)
                .paymentCount(count)
                .totalAmount(totalAmt)
                .reconciledAmount(recAmt)
                .build();
    }

    private BigDecimal safe(BigDecimal val) {
        return val != null ? val : BigDecimal.ZERO;
    }

    private BigDecimal toBigDecimal(Object value) {
        if (value instanceof BigDecimal amount) return amount;
        if (value instanceof Number amount) return new BigDecimal(amount.toString());
        return BigDecimal.ZERO;
    }

    @Override
    public OccupancyReportResponse getOccupancyReport() {
        return getOccupancyReport(null);
    }

    @Override
    public OccupancyReportResponse getOccupancyReport(UUID facilityId) {
        UUID effectiveFacilityId = facilityId;
        if (facilityAccessGuard.isFacilityScoped()) {
            effectiveFacilityId = facilityAccessGuard.scopedFacilityIdOrNull();
        }

        List<Object[]> rows = storageUnitRepository.countUnitsGroupedByFacilityAndStatus();

        Map<UUID, String> facilityNames = new LinkedHashMap<>();
        // bucket layout per facility: [total, occupied, available, reserved, maintenance]
        Map<UUID, long[]> counts = new LinkedHashMap<>();

        facilityRepository.findAll().forEach(facility -> {
            if (facility != null && facility.getId() != null) {
                facilityNames.putIfAbsent(facility.getId(), facility.getName());
                counts.computeIfAbsent(facility.getId(), ignored -> new long[5]);
            }
        });

        for (Object[] row : rows) {
            UUID fId = (UUID) row[0];
            String facilityName = (String) row[1];
            
            UnitStatus status;
            if (row[2] instanceof UnitStatus us) {
                status = us;
            } else if (row[2] instanceof String str) {
                status = UnitStatus.valueOf(str);
            } else {
                continue;
            }
            Long count = row[3] instanceof Number num ? num.longValue() : 0L;

            facilityNames.putIfAbsent(fId, facilityName);
            long[] bucket = counts.computeIfAbsent(fId, k -> new long[5]);
            bucket[0] += count;
            switch (status) {
                case OCCUPIED, OVERDUE_LOCKED -> bucket[1] += count;
                case AVAILABLE -> bucket[2] += count;
                case RESERVED -> bucket[3] += count;
                case UNDER_MAINTENANCE -> bucket[4] += count;
            }
        }

        List<FacilityOccupancyResponse> byFacility = new ArrayList<>();
        long sysTotal = 0, sysOccupied = 0, sysAvailable = 0, sysReserved = 0, sysMaintenance = 0;

        for (Map.Entry<UUID, long[]> entry : counts.entrySet()) {
            UUID fId = entry.getKey();
            if (effectiveFacilityId != null && !effectiveFacilityId.equals(fId)) {
                continue;
            }
            long[] c = entry.getValue();
            double rate = c[0] == 0 ? 0.0 : (c[1] * 100.0) / c[0];

            byFacility.add(FacilityOccupancyResponse.builder()
                    .facilityId(fId)
                    .facilityName(facilityNames.get(fId))
                    .totalUnits(c[0])
                    .occupiedUnits(c[1])
                    .availableUnits(c[2])
                    .reservedUnits(c[3])
                    .maintenanceUnits(c[4])
                    .occupancyRate(round2(rate))
                    .build());

            sysTotal += c[0];
            sysOccupied += c[1];
            sysAvailable += c[2];
            sysReserved += c[3];
            sysMaintenance += c[4];
        }

        double systemRate = sysTotal == 0 ? 0.0 : (sysOccupied * 100.0) / sysTotal;

        SystemOccupancyResponse systemSummary = SystemOccupancyResponse.builder()
                .totalUnits(sysTotal)
                .occupiedUnits(sysOccupied)
                .availableUnits(sysAvailable)
                .reservedUnits(sysReserved)
                .maintenanceUnits(sysMaintenance)
                .occupancyRate(round2(systemRate))
                .build();

        return OccupancyReportResponse.builder()
                .systemSummary(systemSummary)
                .byFacility(byFacility)
                .build();
    }

    @Override
    public OverdueDebtReportResponse getOverdueDebtReport(UUID filterFacilityId) {
        LocalDate today = LocalDate.now();

        UUID effectiveFacilityId = filterFacilityId;
        if (facilityAccessGuard.isFacilityScoped()) {
            effectiveFacilityId = facilityAccessGuard.scopedFacilityIdOrNull();
        }
        final UUID targetFacilityId = effectiveFacilityId;

        // Include linked booking IDs from every contract to avoid counting a linked booking a second time.
        List<RentalContract> allContracts = rentalContractRepository.findAll();
        Set<UUID> accountedBookingIds = allContracts.stream()
                .map(RentalContract::getBooking)
                .filter(Objects::nonNull)
                .map(Booking::getId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        List<RentalContract> overdueContracts = allContracts.stream()
                .filter(c -> (c.getStatus() == RentalContractStatus.ACTIVE
                        || c.getStatus() == RentalContractStatus.OVERDUE
                        || c.getStatus() == RentalContractStatus.OVERDUE_LOCKED
                        || c.getStatus() == RentalContractStatus.EXPIRED)
                        && c.getEndDate() != null && c.getEndDate().isBefore(today))
                .filter(c -> c.getBooking() == null
                        || (c.getBooking().getStatus() != BookingStatus.CANCELLED
                        && c.getBooking().getStatus() != BookingStatus.COMPLETED
                        && !"REFUNDED".equalsIgnoreCase(c.getBooking().getPaymentStatus())))
                .filter(c -> targetFacilityId == null || (c.getFacility() != null && targetFacilityId.equals(c.getFacility().getId())))
                .toList();

        Map<UUID, FacilityPolicy> policyCache = new HashMap<>();
        List<OverdueDebtItemResponse> overdueItems = new ArrayList<>();

        for (RentalContract contract : overdueContracts) {
            Facility facility = contract.getFacility();
            UUID facilityId = facility != null ? facility.getId() : null;

            FacilityPolicy policy = null;
            if (facilityId != null) {
                policy = policyCache.computeIfAbsent(facilityId, id -> facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(id).orElse(null));
            }

            long daysOverdue = ChronoUnit.DAYS.between(contract.getEndDate(), today);
            // RentalContract has no recurring invoice/payment ledger, so monthlyFee cannot be called unpaid rent.
            BigDecimal unpaidRent = null;
            BigDecimal dailyLateFee = configuredDailyLateFee(policy);
            BigDecimal totalLateFee = calculateLateFee(daysOverdue, policy);
            BigDecimal totalDebt = addIfKnown(unpaidRent, totalLateFee);
            String overdueStage = resolveOverdueStage(daysOverdue, policy);

            overdueItems.add(OverdueDebtItemResponse.builder()
                    .contractId(contract.getId())
                    .contractCode(contract.getContractCode())
                    .bookingId(contract.getBooking() != null ? contract.getBooking().getId() : null)
                    .bookingCode(contract.getBooking() != null ? contract.getBooking().getBookingCode() : null)
                    .customerId(contract.getCustomer() != null ? contract.getCustomer().getId() : null)
                    .customerName(contract.getCustomer() != null ? contract.getCustomer().getFullName() : null)
                    .customerPhone(contract.getCustomer() != null ? contract.getCustomer().getPhone() : null)
                    .customerEmail(contract.getCustomer() != null ? contract.getCustomer().getEmail() : null)
                    .unitId(contract.getUnit() != null ? contract.getUnit().getId() : null)
                    .unitCode(contract.getUnit() != null ? contract.getUnit().getUnitCode() : "N/A")
                    .facilityId(facilityId)
                    .facilityName(facility != null ? facility.getName() : null)
                    .startDate(contract.getStartDate())
                    .dueDate(contract.getEndDate())
                    .daysOverdue(daysOverdue)
                    .unpaidRent(unpaidRent)
                    .dailyLateFee(dailyLateFee)
                    .totalLateFee(totalLateFee)
                    .totalDebt(totalDebt)
                    .overdueStage(overdueStage)
                    .smartLockStatus("UNVERIFIED")
                    .build());
        }

        // 2. Also check active/confirmed bookings past end date not linked to contract
        List<Booking> overdueBookings = bookingRepository.findAll().stream()
                .filter(b -> (b.getStatus() == BookingStatus.ACTIVE || b.getStatus() == BookingStatus.CONFIRMED)
                        && b.getEndDate() != null && b.getEndDate().isBefore(today))
                .filter(b -> !accountedBookingIds.contains(b.getId()))
                .filter(b -> !"REFUNDED".equalsIgnoreCase(b.getPaymentStatus()))
                .filter(b -> {
                    if (targetFacilityId == null) return true;
                    return b.getStorageUnit() != null && b.getStorageUnit().getFacility() != null
                            && targetFacilityId.equals(b.getStorageUnit().getFacility().getId());
                })
                .toList();

        for (Booking booking : overdueBookings) {
            Facility facility = (booking.getStorageUnit() != null) ? booking.getStorageUnit().getFacility() : null;
            UUID facilityId = facility != null ? facility.getId() : null;

            FacilityPolicy policy = null;
            if (facilityId != null) {
                policy = policyCache.computeIfAbsent(facilityId, id -> facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(id).orElse(null));
            }

            long daysOverdue = ChronoUnit.DAYS.between(booking.getEndDate(), today);
            BigDecimal unpaidRent = resolveUnpaidBookingRent(booking);
            BigDecimal dailyLateFee = configuredDailyLateFee(policy);
            BigDecimal totalLateFee = calculateLateFee(daysOverdue, policy);
            BigDecimal totalDebt = addIfKnown(unpaidRent, totalLateFee);
            String overdueStage = resolveOverdueStage(daysOverdue, policy);

            overdueItems.add(OverdueDebtItemResponse.builder()
                    .contractId(null)
                    .contractCode(null)
                    .bookingId(booking.getId())
                    .bookingCode(booking.getBookingCode())
                    .customerId(booking.getCustomer() != null ? booking.getCustomer().getId() : null)
                    .customerName(booking.getCustomer() != null ? booking.getCustomer().getFullName() : null)
                    .customerPhone(booking.getCustomer() != null ? booking.getCustomer().getPhone() : null)
                    .customerEmail(booking.getCustomer() != null ? booking.getCustomer().getEmail() : null)
                    .unitId(booking.getStorageUnit() != null ? booking.getStorageUnit().getId() : null)
                    .unitCode(booking.getStorageUnit() != null ? booking.getStorageUnit().getUnitCode() : "N/A")
                    .facilityId(facilityId)
                    .facilityName(facility != null ? facility.getName() : null)
                    .startDate(booking.getStartDate())
                    .dueDate(booking.getEndDate())
                    .daysOverdue(daysOverdue)
                    .unpaidRent(unpaidRent)
                    .dailyLateFee(dailyLateFee)
                    .totalLateFee(totalLateFee)
                    .totalDebt(totalDebt)
                    .overdueStage(overdueStage)
                    .smartLockStatus("UNVERIFIED")
                    .build());
        }

        // Sort by daysOverdue descending
        overdueItems.sort((a, b) -> Long.compare(b.getDaysOverdue(), a.getDaysOverdue()));

        // Calculate aging distribution and stage counts
        BigDecimal aging1To3 = BigDecimal.ZERO;
        BigDecimal aging4To7 = BigDecimal.ZERO;
        BigDecimal aging8To14 = BigDecimal.ZERO;
        BigDecimal aging15Plus = BigDecimal.ZERO;
        long graceCount = 0;
        long warningCount = 0;
        long blockedCount = 0;
        long sealingCount = 0;
        long policyUnconfiguredCount = 0;

        for (OverdueDebtItemResponse item : overdueItems) {
            long days = item.getDaysOverdue();
            BigDecimal debt = item.getTotalDebt();

            if (debt == null) {
                aging1To3 = null;
                aging4To7 = null;
                aging8To14 = null;
                aging15Plus = null;
            } else if (aging1To3 == null) {
                // Keep all aging totals unavailable if any item lacks a configured debt calculation.
            } else if (days <= 3) {
                aging1To3 = aging1To3.add(debt);
            } else if (days <= 7) {
                aging4To7 = aging4To7.add(debt);
            } else if (days <= 14) {
                aging8To14 = aging8To14.add(debt);
            } else {
                aging15Plus = aging15Plus.add(debt);
            }

            if ("GRACE_PERIOD".equals(item.getOverdueStage())) {
                graceCount++;
            } else if ("WARNING".equals(item.getOverdueStage())) {
                warningCount++;
            } else if ("ACCESS_BLOCKED".equals(item.getOverdueStage())) {
                blockedCount++;
            } else if ("ELIGIBLE_FOR_SEALING".equals(item.getOverdueStage())) {
                sealingCount++;
            } else if ("POLICY_UNCONFIGURED".equals(item.getOverdueStage())) {
                policyUnconfiguredCount++;
            }
        }

        // Aggregate by facility
        Map<UUID, List<OverdueDebtItemResponse>> byFacilityMap = overdueItems.stream()
                .filter(i -> i.getFacilityId() != null)
                .collect(Collectors.groupingBy(OverdueDebtItemResponse::getFacilityId));

        List<FacilityOverdueDebtResponse> byFacilitySummary = new ArrayList<>();
        for (Map.Entry<UUID, List<OverdueDebtItemResponse>> entry : byFacilityMap.entrySet()) {
            List<OverdueDebtItemResponse> items = entry.getValue();
            String fName = items.isEmpty() ? null : items.get(0).getFacilityName();
            BigDecimal fUnpaid = sumIfKnown(items.stream().map(OverdueDebtItemResponse::getUnpaidRent).toList());
            BigDecimal fLate = sumIfKnown(items.stream().map(OverdueDebtItemResponse::getTotalLateFee).toList());
            BigDecimal fTotal = sumIfKnown(items.stream().map(OverdueDebtItemResponse::getTotalDebt).toList());

            byFacilitySummary.add(FacilityOverdueDebtResponse.builder()
                    .facilityId(entry.getKey())
                    .facilityName(fName)
                    .overdueContractCount(items.size())
                    .totalUnpaidRent(fUnpaid)
                    .totalLateFees(fLate)
                    .totalOverdueDebt(fTotal)
                    .build());
        }

        long totalOverdueCount = overdueItems.size();
        BigDecimal totalUnpaid = sumIfKnown(overdueItems.stream().map(OverdueDebtItemResponse::getUnpaidRent).toList());
        BigDecimal totalLate = sumIfKnown(overdueItems.stream().map(OverdueDebtItemResponse::getTotalLateFee).toList());
        BigDecimal totalDebt = sumIfKnown(overdueItems.stream().map(OverdueDebtItemResponse::getTotalDebt).toList());

        return OverdueDebtReportResponse.builder()
                .asOfDate(today)
                .totalOverdueCount(totalOverdueCount)
                .totalDebtAmount(totalDebt)
                .totalUnpaidRent(totalUnpaid)
                .totalLateFees(totalLate)
                .gracePeriodCount(graceCount)
                .warningCount(warningCount)
                .accessBlockedCount(blockedCount)
                .eligibleForSealingCount(sealingCount)
                .policyUnconfiguredCount(policyUnconfiguredCount)
                .aging1To3DaysDebt(aging1To3)
                .aging4To7DaysDebt(aging4To7)
                .aging8To14DaysDebt(aging8To14)
                .aging15PlusDaysDebt(aging15Plus)
                .items(overdueItems)
                .byFacility(byFacilitySummary)
                .build();
    }

    @Override
    @Transactional
    public void sendOverdueReminder(UUID contractId) {
        RentalContract contract = rentalContractRepository.findById(contractId)
                .orElseThrow(() -> new AppException(ErrorCode.CONTRACT_NOT_FOUND));

        if (contract.getFacility() == null) {
            throw new AppException(ErrorCode.FACILITY_ACCESS_DENIED);
        }
        facilityAccessGuard.checkFacilityAccess(contract.getFacility().getId());

        LocalDate today = LocalDate.now();
        if (contract.getEndDate() == null || !contract.getEndDate().isBefore(today)) {
            throw new AppException(ErrorCode.INVALID_REQUEST);
        }

        FacilityPolicy policy = facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(contract.getFacility().getId()).orElse(null);

        if (policy == null || policy.getOverdueGraceDays() == null || policy.getOverdueGraceDays() < 0
                || configuredDailyLateFee(policy) == null) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "An active facility overdue policy is required to calculate this reminder");
        }

        long daysOverdue = ChronoUnit.DAYS.between(contract.getEndDate(), today);
        // The contract model has no recurring invoice ledger, so monthlyFee is not an authoritative unpaid balance.
        BigDecimal unpaidRent = null;
        BigDecimal totalLateFee = calculateLateFee(daysOverdue, policy);
        BigDecimal totalDebt = addIfKnown(unpaidRent, totalLateFee);
        String overdueStage = resolveOverdueStage(daysOverdue, policy);

        User customer = contract.getCustomer();
        if (customer != null && customer.getEmail() != null) {
            emailService.sendOverdueNoticeEmail(
                    customer.getEmail(),
                    customer.getFullName() != null ? customer.getFullName() : customer.getUsername(),
                    contract.getContractCode(),
                    contract.getUnit() != null ? contract.getUnit().getUnitCode() : "N/A",
                    daysOverdue,
                    totalDebt,
                    overdueStage
            );
        }

        UUID facilityId = contract.getFacility() != null ? contract.getFacility().getId() : null;
        activityLogService.record(
                facilityId,
                ActivityAction.OVERDUE_REMINDER_SENT,
                "RentalContract",
                contract.getId(),
                "Sent an overdue reminder to " + (customer != null ? customer.getEmail() : "N/A")
                        + " for " + daysOverdue + " days overdue; the outstanding balance is not reconciled.",
                null,
                contract.getContractCode()
        );
    }

    private double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    private BigDecimal configuredDailyLateFee(FacilityPolicy policy) {
        return policy != null && policy.getDailyLateFee() != null
                && policy.getDailyLateFee().compareTo(BigDecimal.ZERO) >= 0
                ? policy.getDailyLateFee()
                : null;
    }

    private BigDecimal calculateLateFee(long daysOverdue, FacilityPolicy policy) {
        if (policy == null || policy.getOverdueGraceDays() == null || policy.getOverdueGraceDays() < 0
                || configuredDailyLateFee(policy) == null) {
            return null;
        }
        long billableDays = Math.max(0, daysOverdue - policy.getOverdueGraceDays());
        return configuredDailyLateFee(policy).multiply(BigDecimal.valueOf(billableDays));
    }

    private String resolveOverdueStage(long daysOverdue, FacilityPolicy policy) {
        if (policy == null || policy.getOverdueGraceDays() == null || policy.getOverdueGraceDays() < 0
                || policy.getOverdueAccessDisableDays() == null || policy.getOverdueAccessDisableDays() < 0
                || policy.getOverdueSealingDays() == null || policy.getOverdueSealingDays() < 0
                || configuredDailyLateFee(policy) == null) {
            return "POLICY_UNCONFIGURED";
        }
        if (daysOverdue <= policy.getOverdueGraceDays()) return "GRACE_PERIOD";
        if (daysOverdue < policy.getOverdueAccessDisableDays()) return "WARNING";
        if (daysOverdue < policy.getOverdueSealingDays()) return "ACCESS_BLOCKED";
        return "ELIGIBLE_FOR_SEALING";
    }

    private BigDecimal addIfKnown(BigDecimal left, BigDecimal right) {
        return left == null || right == null ? null : left.add(right);
    }

    private BigDecimal resolveUnpaidBookingRent(Booking booking) {
        if (booking.getTotalRentalFee() == null || booking.getTotalRentalFee().compareTo(BigDecimal.ZERO) < 0) {
            return null;
        }
        String paymentStatus = booking.getPaymentStatus();
        if ("PAID".equalsIgnoreCase(paymentStatus)) {
            return BigDecimal.ZERO;
        }
        if ("UNPAID".equalsIgnoreCase(paymentStatus)) {
            return booking.getTotalRentalFee();
        }
        // Partial payments, pending refunds, and unknown legacy statuses need ledger reconciliation.
        return null;
    }

    private BigDecimal sumIfKnown(List<BigDecimal> amounts) {
        if (amounts.stream().anyMatch(Objects::isNull)) return null;
        return amounts.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}

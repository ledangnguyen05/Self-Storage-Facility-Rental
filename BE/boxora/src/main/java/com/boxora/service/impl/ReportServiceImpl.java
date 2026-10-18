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
    private final RentalContractRepository rentalContractRepository;
    private final FacilityPolicyRepository facilityPolicyRepository;
    private final BookingRepository bookingRepository;
    private final EmailService emailService;
    private final ActivityLogService activityLogService;
    private final FacilityAccessGuard facilityAccessGuard;

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
                    .paymentCount(0L)
                    .build();
        }

        List<Payment> periodPayments = paymentRepository.findSuccessfulPaymentsInPeriod(from, to, effectiveFacilityId);
        BigDecimal refundedAmount = paymentRepository.sumRefundedAmount(from, to, effectiveFacilityId);

        // Group periodPayments by Year-Month (e.g. 2026-03)
        Map<String, List<Payment>> byMonth = periodPayments.stream()
                .filter(p -> p.getPaymentTime() != null)
                .collect(Collectors.groupingBy(p -> {
                    LocalDateTime pt = p.getPaymentTime();
                    return pt.getYear() + "-" + String.format("%02d", pt.getMonthValue());
                }, TreeMap::new, Collectors.toList()));

        List<MonthlyRevenueResponse> monthlyBreakdown = byMonth.entrySet().stream()
                .map(entry -> {
                    String mKey = entry.getKey();
                    String[] parts = mKey.split("-");
                    String label = "T" + parts[1] + "/" + parts[0].substring(2);

                    BigDecimal rent = entry.getValue().stream()
                            .filter(p -> p.getPaymentType() == PaymentType.RENTAL_FEE)
                            .map(Payment::getAmount)
                            .reduce(BigDecimal.ZERO, BigDecimal::add);

                    BigDecimal dep = entry.getValue().stream()
                            .filter(p -> p.getPaymentType() == PaymentType.DEPOSIT)
                            .map(Payment::getAmount)
                            .reduce(BigDecimal.ZERO, BigDecimal::add);

                    BigDecimal renewal = entry.getValue().stream()
                            .filter(p -> p.getPaymentType() == PaymentType.RENEWAL_FEE)
                            .map(Payment::getAmount)
                            .reduce(BigDecimal.ZERO, BigDecimal::add);

                    BigDecimal extra = entry.getValue().stream()
                            .filter(p -> p.getPaymentType() == PaymentType.EXTRA_CHARGE)
                            .map(Payment::getAmount)
                            .reduce(BigDecimal.ZERO, BigDecimal::add);

                    BigDecimal netTotal = rent.add(renewal).add(extra);

                    return MonthlyRevenueResponse.builder()
                            .monthKey(mKey)
                            .label(label)
                            .rentalFee(rent)
                            .deposit(dep)
                            .renewalFee(renewal)
                            .extraCharge(extra)
                            .total(netTotal)
                            .build();
                })
                .collect(Collectors.toList());

        return RevenueReportResponse.builder()
                .fromDate(fromDate)
                .toDate(toDate)
                .systemSummary(systemSummary)
                .byFacility(byFacility)
                .monthlyBreakdown(monthlyBreakdown)
                .refundedAmount(refundedAmount)
                .build();
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
                case OCCUPIED -> bucket[1] += count;
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

        // 1. Fetch overdue contracts (endDate < today and status in ACTIVE, EXPIRED)
        List<RentalContract> allContracts = rentalContractRepository.findAll();
        List<RentalContract> overdueContracts = allContracts.stream()
                .filter(c -> (c.getStatus() == RentalContractStatus.ACTIVE || c.getStatus() == RentalContractStatus.EXPIRED)
                        && c.getEndDate() != null && c.getEndDate().isBefore(today))
                .filter(c -> targetFacilityId == null || (c.getFacility() != null && targetFacilityId.equals(c.getFacility().getId())))
                .toList();

        Map<UUID, FacilityPolicy> policyCache = new HashMap<>();
        List<OverdueDebtItemResponse> overdueItems = new ArrayList<>();
        Set<UUID> accountedBookingIds = new HashSet<>();

        for (RentalContract contract : overdueContracts) {
            Facility facility = contract.getFacility();
            UUID facilityId = facility != null ? facility.getId() : null;

            FacilityPolicy policy = null;
            if (facilityId != null) {
                policy = policyCache.computeIfAbsent(facilityId, id -> facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(id).orElse(null));
            }

            int graceDays = (policy != null && policy.getOverdueGraceDays() != null) ? policy.getOverdueGraceDays() : 1;
            int accessDisableDays = (policy != null && policy.getOverdueAccessDisableDays() != null) ? policy.getOverdueAccessDisableDays() : 3;
            int sealingDays = (policy != null && policy.getOverdueSealingDays() != null) ? policy.getOverdueSealingDays() : 7;
            BigDecimal dailyLateFee = (policy != null && policy.getDailyLateFee() != null) ? policy.getDailyLateFee() : new BigDecimal("50000");

            long daysOverdue = ChronoUnit.DAYS.between(contract.getEndDate(), today);
            BigDecimal unpaidRent = contract.getMonthlyFee() != null ? contract.getMonthlyFee() : BigDecimal.ZERO;
            BigDecimal totalLateFee = daysOverdue > graceDays ? dailyLateFee.multiply(BigDecimal.valueOf(daysOverdue)) : BigDecimal.ZERO;
            BigDecimal totalDebt = unpaidRent.add(totalLateFee);

            String overdueStage;
            String smartLockStatus;
            if (daysOverdue <= graceDays) {
                overdueStage = "GRACE_PERIOD";
                smartLockStatus = "NORMAL";
            } else if (daysOverdue <= accessDisableDays) {
                overdueStage = "WARNING";
                smartLockStatus = "WARNING";
            } else if (daysOverdue < sealingDays) {
                overdueStage = "ACCESS_BLOCKED";
                smartLockStatus = "TEMP_LOCKED";
            } else {
                overdueStage = "ELIGIBLE_FOR_SEALING";
                smartLockStatus = "SEALED";
            }

            if (contract.getBooking() != null) {
                accountedBookingIds.add(contract.getBooking().getId());
            }

            overdueItems.add(OverdueDebtItemResponse.builder()
                    .contractId(contract.getId())
                    .contractCode(contract.getContractCode())
                    .bookingId(contract.getBooking() != null ? contract.getBooking().getId() : null)
                    .bookingCode(contract.getBooking() != null ? contract.getBooking().getBookingCode() : null)
                    .customerId(contract.getCustomer() != null ? contract.getCustomer().getId() : null)
                    .customerName(contract.getCustomer() != null ? contract.getCustomer().getFullName() : "N/A")
                    .customerPhone(contract.getCustomer() != null ? contract.getCustomer().getPhone() : "N/A")
                    .customerEmail(contract.getCustomer() != null ? contract.getCustomer().getEmail() : "N/A")
                    .unitId(contract.getUnit() != null ? contract.getUnit().getId() : null)
                    .unitCode(contract.getUnit() != null ? contract.getUnit().getUnitCode() : "N/A")
                    .facilityId(facilityId)
                    .facilityName(facility != null ? facility.getName() : "N/A")
                    .startDate(contract.getStartDate())
                    .dueDate(contract.getEndDate())
                    .daysOverdue(daysOverdue)
                    .unpaidRent(unpaidRent)
                    .dailyLateFee(dailyLateFee)
                    .totalLateFee(totalLateFee)
                    .totalDebt(totalDebt)
                    .overdueStage(overdueStage)
                    .smartLockStatus(smartLockStatus)
                    .build());
        }

        // 2. Also check active/confirmed bookings past end date not linked to contract
        List<Booking> overdueBookings = bookingRepository.findAll().stream()
                .filter(b -> (b.getStatus() == BookingStatus.ACTIVE || b.getStatus() == BookingStatus.CONFIRMED)
                        && b.getEndDate() != null && b.getEndDate().isBefore(today))
                .filter(b -> !accountedBookingIds.contains(b.getId()))
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

            int graceDays = (policy != null && policy.getOverdueGraceDays() != null) ? policy.getOverdueGraceDays() : 1;
            int accessDisableDays = (policy != null && policy.getOverdueAccessDisableDays() != null) ? policy.getOverdueAccessDisableDays() : 3;
            int sealingDays = (policy != null && policy.getOverdueSealingDays() != null) ? policy.getOverdueSealingDays() : 7;
            BigDecimal dailyLateFee = (policy != null && policy.getDailyLateFee() != null) ? policy.getDailyLateFee() : new BigDecimal("50000");

            long daysOverdue = ChronoUnit.DAYS.between(booking.getEndDate(), today);
            BigDecimal unpaidRent = booking.getTotalRentalFee() != null ? booking.getTotalRentalFee() : new BigDecimal("1450000");
            BigDecimal totalLateFee = daysOverdue > graceDays ? dailyLateFee.multiply(BigDecimal.valueOf(daysOverdue)) : BigDecimal.ZERO;
            BigDecimal totalDebt = unpaidRent.add(totalLateFee);

            String overdueStage;
            String smartLockStatus;
            if (daysOverdue <= graceDays) {
                overdueStage = "GRACE_PERIOD";
                smartLockStatus = "NORMAL";
            } else if (daysOverdue <= accessDisableDays) {
                overdueStage = "WARNING";
                smartLockStatus = "WARNING";
            } else if (daysOverdue < sealingDays) {
                overdueStage = "ACCESS_BLOCKED";
                smartLockStatus = "TEMP_LOCKED";
            } else {
                overdueStage = "ELIGIBLE_FOR_SEALING";
                smartLockStatus = "SEALED";
            }

            overdueItems.add(OverdueDebtItemResponse.builder()
                    .contractId(null)
                    .contractCode("HĐ-TẠM-" + booking.getBookingCode())
                    .bookingId(booking.getId())
                    .bookingCode(booking.getBookingCode())
                    .customerId(booking.getCustomer() != null ? booking.getCustomer().getId() : null)
                    .customerName(booking.getCustomer() != null ? booking.getCustomer().getFullName() : "Khách hàng Boxora")
                    .customerPhone(booking.getCustomer() != null ? booking.getCustomer().getPhone() : "0900000000")
                    .customerEmail(booking.getCustomer() != null ? booking.getCustomer().getEmail() : "customer@boxora.vn")
                    .unitId(booking.getStorageUnit() != null ? booking.getStorageUnit().getId() : null)
                    .unitCode(booking.getStorageUnit() != null ? booking.getStorageUnit().getUnitCode() : "N/A")
                    .facilityId(facilityId)
                    .facilityName(facility != null ? facility.getName() : "Cơ sở Tân Bình")
                    .startDate(booking.getStartDate())
                    .dueDate(booking.getEndDate())
                    .daysOverdue(daysOverdue)
                    .unpaidRent(unpaidRent)
                    .dailyLateFee(dailyLateFee)
                    .totalLateFee(totalLateFee)
                    .totalDebt(totalDebt)
                    .overdueStage(overdueStage)
                    .smartLockStatus(smartLockStatus)
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

        for (OverdueDebtItemResponse item : overdueItems) {
            long days = item.getDaysOverdue();
            BigDecimal debt = item.getTotalDebt() != null ? item.getTotalDebt() : BigDecimal.ZERO;

            if (days <= 3) {
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
            } else {
                sealingCount++;
            }
        }

        // Aggregate by facility
        Map<UUID, List<OverdueDebtItemResponse>> byFacilityMap = overdueItems.stream()
                .filter(i -> i.getFacilityId() != null)
                .collect(Collectors.groupingBy(OverdueDebtItemResponse::getFacilityId));

        List<FacilityOverdueDebtResponse> byFacilitySummary = new ArrayList<>();
        for (Map.Entry<UUID, List<OverdueDebtItemResponse>> entry : byFacilityMap.entrySet()) {
            List<OverdueDebtItemResponse> items = entry.getValue();
            String fName = items.isEmpty() ? "N/A" : items.get(0).getFacilityName();
            BigDecimal fUnpaid = items.stream().map(OverdueDebtItemResponse::getUnpaidRent).reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal fLate = items.stream().map(OverdueDebtItemResponse::getTotalLateFee).reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal fTotal = fUnpaid.add(fLate);

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
        BigDecimal totalUnpaid = overdueItems.stream().map(OverdueDebtItemResponse::getUnpaidRent).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalLate = overdueItems.stream().map(OverdueDebtItemResponse::getTotalLateFee).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalDebt = totalUnpaid.add(totalLate);

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

        if (facilityAccessGuard.isFacilityScoped() && contract.getFacility() != null) {
            facilityAccessGuard.checkFacilityAccess(contract.getFacility().getId());
        }

        LocalDate today = LocalDate.now();
        if (contract.getEndDate() == null || !contract.getEndDate().isBefore(today)) {
            throw new AppException(ErrorCode.INVALID_REQUEST);
        }

        FacilityPolicy policy = (contract.getFacility() != null)
                ? facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(contract.getFacility().getId()).orElse(null)
                : null;

        int graceDays = (policy != null && policy.getOverdueGraceDays() != null) ? policy.getOverdueGraceDays() : 1;
        int accessDisableDays = (policy != null && policy.getOverdueAccessDisableDays() != null) ? policy.getOverdueAccessDisableDays() : 3;
        int sealingDays = (policy != null && policy.getOverdueSealingDays() != null) ? policy.getOverdueSealingDays() : 7;
        BigDecimal dailyLateFee = (policy != null && policy.getDailyLateFee() != null) ? policy.getDailyLateFee() : new BigDecimal("50000");

        long daysOverdue = ChronoUnit.DAYS.between(contract.getEndDate(), today);
        BigDecimal unpaidRent = contract.getMonthlyFee() != null ? contract.getMonthlyFee() : BigDecimal.ZERO;
        BigDecimal totalLateFee = daysOverdue > graceDays ? dailyLateFee.multiply(BigDecimal.valueOf(daysOverdue)) : BigDecimal.ZERO;
        BigDecimal totalDebt = unpaidRent.add(totalLateFee);

        String overdueStage = (daysOverdue <= graceDays) ? "GRACE_PERIOD"
                : (daysOverdue <= accessDisableDays) ? "WARNING"
                : (daysOverdue < sealingDays) ? "ACCESS_BLOCKED" : "ELIGIBLE_FOR_SEALING";

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
                ActivityAction.OVERDUE_DETECTED,
                "RentalContract",
                contract.getId(),
                "Da gui email thong bao nhac no qua han cho khach hang " + (customer != null ? customer.getEmail() : "N/A") + " - So ngay qua han: " + daysOverdue + ", tong no: " + totalDebt,
                null,
                contract.getContractCode()
        );
    }

    private double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}

package com.boxora.service.impl;

import com.boxora.dto.response.*;
import com.boxora.enums.UnitStatus;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.repository.PaymentRepository;
import com.boxora.repository.StorageUnitRepository;
import com.boxora.service.ReportService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional(readOnly = true) // reports only read data, never mutate it
public class ReportServiceImpl implements ReportService {

    private final PaymentRepository paymentRepository;
    private final StorageUnitRepository storageUnitRepository;

    @Override
    public RevenueReportResponse getRevenueReport(LocalDate fromDate, LocalDate toDate) {
        if (fromDate != null && toDate != null && fromDate.isAfter(toDate)) {
            throw new AppException(ErrorCode.INVALID_REQUEST);
        }

        LocalDateTime from = fromDate != null ? fromDate.atStartOfDay() : null;
        LocalDateTime to = toDate != null ? toDate.atTime(LocalTime.MAX) : null;

        List<FacilityRevenueResponse> byFacility = paymentRepository.sumRevenueByFacility(from, to);
        SystemRevenueSummaryResponse systemSummary = paymentRepository.sumSystemRevenue(from, to);
        if (systemSummary == null) {
            systemSummary = SystemRevenueSummaryResponse.builder()
                    .totalRevenue(BigDecimal.ZERO)
                    .depositRevenue(BigDecimal.ZERO)
                    .rentalFeeRevenue(BigDecimal.ZERO)
                    .extraChargeRevenue(BigDecimal.ZERO)
                    .paymentCount(0L)
                    .build();
        }

        return RevenueReportResponse.builder()
                .fromDate(fromDate)
                .toDate(toDate)
                .systemSummary(systemSummary)
                .byFacility(byFacility)
                .build();
    }

    @Override
    public OccupancyReportResponse getOccupancyReport() {
        List<Object[]> rows = storageUnitRepository.countUnitsGroupedByFacilityAndStatus();

        Map<UUID, String> facilityNames = new LinkedHashMap<>();
        // bucket layout per facility: [total, occupied, available, reserved, maintenance]
        Map<UUID, long[]> counts = new LinkedHashMap<>();

        for (Object[] row : rows) {
            UUID facilityId = (UUID) row[0];
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

            facilityNames.putIfAbsent(facilityId, facilityName);
            long[] bucket = counts.computeIfAbsent(facilityId, k -> new long[5]);
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
            long[] c = entry.getValue();
            double rate = c[0] == 0 ? 0.0 : (c[1] * 100.0) / c[0];

            byFacility.add(FacilityOccupancyResponse.builder()
                    .facilityId(entry.getKey())
                    .facilityName(facilityNames.get(entry.getKey()))
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

    private double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}

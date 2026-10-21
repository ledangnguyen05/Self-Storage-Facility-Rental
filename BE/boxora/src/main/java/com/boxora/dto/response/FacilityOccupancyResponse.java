package com.boxora.dto.response;

import lombok.*;

import java.util.UUID;

/**
 * Công suất kho của một cơ sở. {@code occupiedUnits} gồm cả kho đang bị khóa do quá hạn ({@code lockedUnits});
 * occupied + available + reserved + maintenance = total.
 */
@Data
@AllArgsConstructor
@Builder
public class FacilityOccupancyResponse {
    private UUID facilityId;
    private String facilityName;
    private long totalUnits;
    private long occupiedUnits;
    /** Trong số kho đang thuê, số kho bị khóa do quá hạn (OVERDUE_LOCKED). */
    private long lockedUnits;
    private long availableUnits;
    private long reservedUnits;
    private long maintenanceUnits;
    private double occupancyRate; // percentage, 0-100
}

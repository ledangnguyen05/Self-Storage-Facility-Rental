package com.boxora.dto.response;

import lombok.*;

/** Công suất kho toàn hệ thống (hoặc một cơ sở khi lọc). Ý nghĩa các trường xem {@link FacilityOccupancyResponse}. */
@Data
@AllArgsConstructor
@Builder
public class SystemOccupancyResponse {
    private long totalUnits;
    private long occupiedUnits;
    private long lockedUnits;
    private long availableUnits;
    private long reservedUnits;
    private long maintenanceUnits;
    private double occupancyRate; // percentage, 0-100
}

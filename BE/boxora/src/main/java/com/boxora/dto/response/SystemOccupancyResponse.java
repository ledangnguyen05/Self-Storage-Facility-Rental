package com.boxora.dto.response;

import lombok.*;

@Data
@AllArgsConstructor
@Builder
public class SystemOccupancyResponse {
    private long totalUnits;
    private long occupiedUnits;
    private long availableUnits;
    private long reservedUnits;
    private long maintenanceUnits;
    private double occupancyRate; // percentage, 0-100
}

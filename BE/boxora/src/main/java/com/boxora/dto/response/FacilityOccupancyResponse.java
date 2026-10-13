package com.boxora.dto.response;

import lombok.*;

import java.util.UUID;

@Data
@AllArgsConstructor
@Builder
public class FacilityOccupancyResponse {
    private UUID facilityId;
    private String facilityName;
    private long totalUnits;
    private long occupiedUnits;
    private long availableUnits;
    private long reservedUnits;
    private long maintenanceUnits;
    private double occupancyRate; // percentage, 0-100
}

package com.boxora.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UnitAvailabilityResponse {
    private UUID facilityId;
    private String facilityName;
    private UUID unitTypeId;
    private String unitTypeName;
    private long totalUnits;
    private long physicalAvailableUnits;
    private long unassignedHoldingBookings;
    private long availableUnits;
}

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
public class FacilityResponse {
    private UUID id;
    private String name;
    private String address;
    private String city;
    private String contactPhone;
    private Integer totalUnits;
    private Integer occupiedUnits;
    private Double occupancyRate;
    private Double monthlyRevenue;
}

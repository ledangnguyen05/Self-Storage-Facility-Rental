package com.boxora.dto.response;

import lombok.*;

import java.util.List;

@Data
@AllArgsConstructor
@Builder
public class OccupancyReportResponse {
    private SystemOccupancyResponse systemSummary;
    private List<FacilityOccupancyResponse> byFacility;
}

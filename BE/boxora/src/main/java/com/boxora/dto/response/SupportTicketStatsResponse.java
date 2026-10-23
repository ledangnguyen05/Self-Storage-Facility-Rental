package com.boxora.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SupportTicketStatsResponse {
    private long totalTickets;
    private long openTickets;
    private long inProgressTickets;
    private long resolvedTickets;
    private long closedTickets;
    private long reopenedTickets;
    private long overdueTickets;
    private double slaCompliancePercent;
    private Double avgResolutionMinutes;
    private Map<String, Long> countByFacility;
    private Map<String, Long> countByCategory;
    private Map<String, Long> countByPriority;
}

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
    /** Tỷ lệ phiếu đúng hạn SLA (0-100); null khi chưa có phiếu nào để đánh giá */
    private Double slaCompliancePercent;
    /** Thời gian xử lý trung bình (phút) từ lúc tạo đến lúc giải quyết; null khi chưa có phiếu nào được giải quyết */
    private Double avgResolutionMinutes;
    private long resolvedOnTimeTickets;
    private long resolvedLateTickets;
    private Map<String, Long> countByFacility;
    private Map<String, Long> countByCategory;
    private Map<String, Long> countByPriority;
}

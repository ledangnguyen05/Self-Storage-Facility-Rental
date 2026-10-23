package com.boxora.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SupportTicketResponse {
    private UUID id;
    private String ticketCode;
    private UUID customerId;
    private String customerName;
    private String customerPhone;
    private UUID bookingId;
    private String unitCode;
    private String category;
    private String title;
    private String description;
    private String status;
    private String priority;
    private UUID facilityId;
    private String facilityName;
    private String facilityCode;
    private UUID assignedStaffId;
    private String assignedStaffName;
    private String assignedStaffPhone;
    private String imageEvidence;
    private List<String> evidenceUrls;
    private String resolutionNote;
    private LocalDateTime slaDueAt;
    private Boolean isOverdue;
    private LocalDateTime resolvedAt;
    private LocalDateTime closedAt;
    private Integer contactLogCount;
    private UUID storageUnitId;
    private UUID createdByStaffId;
    private String createdByStaffName;
    private String createdByStaffRole;
    private Boolean isStaffRecorded;
    private LocalDateTime createdAt;
}

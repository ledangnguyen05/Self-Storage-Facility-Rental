package com.boxora.dto.response;

import com.boxora.enums.ShiftHandoverStatus;
import com.boxora.enums.StaffShift;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Thông tin phản hồi biên bản bàn giao ca trực")
public class ShiftHandoverResponse {

    private UUID id;

    // Facility
    private UUID facilityId;
    private String facilityName;
    private String facilityCode;

    private LocalDate handoverDate;
    private StaffShift shift;

    // Outgoing Staff
    private UUID outgoingStaffId;
    private String outgoingStaffName;
    private String outgoingStaffUsername;

    // Incoming Staff
    private UUID incomingStaffId;
    private String incomingStaffName;
    private String incomingStaffUsername;

    // Assignment IDs
    private UUID outgoingAssignmentId;
    private UUID incomingAssignmentId;

    // Content
    private String pendingTasks;
    private Integer pendingTicketsCount;
    private Integer unresolvedBookingsCount;
    private BigDecimal cashInDrawer;
    private String facilityStatusNote;
    private Boolean checklistCompleted;
    private String notes;

    // Status
    private ShiftHandoverStatus status;
    private LocalDateTime acknowledgedAt;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}

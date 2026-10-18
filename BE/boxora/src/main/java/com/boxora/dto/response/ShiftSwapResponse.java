package com.boxora.dto.response;

import com.boxora.enums.ShiftSwapStatus;
import com.boxora.enums.StaffShift;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Thông tin phản hồi yêu cầu đổi ca trực")
public class ShiftSwapResponse {

    private UUID id;

    // Assignment info
    private UUID assignmentId;
    private LocalDate assignmentDate;
    private StaffShift assignmentShift;
    private String assignedZone;

    // Requester
    private UUID requesterId;
    private String requesterName;
    private String requesterUsername;
    private String requesterEmail;

    // Target Staff
    private UUID targetStaffId;
    private String targetStaffName;
    private String targetStaffUsername;
    private String targetStaffEmail;

    // Facility
    private UUID facilityId;
    private String facilityName;
    private String facilityCode;

    // Details
    private String reason;
    private ShiftSwapStatus status;
    private String managerNotes;

    // Reviewer info
    private UUID reviewedById;
    private String reviewedByName;
    private LocalDateTime reviewedAt;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}

package com.boxora.dto.response;

import com.boxora.enums.StaffAssignmentStatus;
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
@Schema(description = "Phản hồi thông tin phân công ca trực của nhân viên")
public class StaffAssignmentResponse {

    private UUID id;

    // Staff details
    private UUID staffId;
    private String staffUsername;
    private String staffFullName;
    private String staffEmail;
    private String staffRole;

    // Facility details
    private UUID facilityId;
    private String facilityName;
    private String facilityCode;

    // Assignment info
    private LocalDate assignedDate;
    private StaffShift shift;
    private String assignedZone;
    private String roleInShift;
    private StaffAssignmentStatus status;

    // Assigning manager info
    private UUID assignedById;
    private String assignedByName;

    // Time and Attendance
    private java.time.LocalTime startTime;
    private java.time.LocalTime endTime;
    private LocalDateTime checkedInAt;
    private LocalDateTime checkedOutAt;
    private String checkInNote;
    private String checkOutNote;

    private String notes;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}

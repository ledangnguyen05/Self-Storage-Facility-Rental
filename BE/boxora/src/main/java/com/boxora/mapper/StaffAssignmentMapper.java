package com.boxora.mapper;

import com.boxora.dto.response.StaffAssignmentResponse;
import com.boxora.entity.StaffAssignment;
import org.springframework.stereotype.Component;

@Component
public class StaffAssignmentMapper {

    public StaffAssignmentResponse toResponse(StaffAssignment entity) {
        if (entity == null) {
            return null;
        }

        StaffAssignmentResponse.StaffAssignmentResponseBuilder builder = StaffAssignmentResponse.builder()
                .id(entity.getId())
                .assignedDate(entity.getAssignedDate())
                .shift(entity.getShift())
                .assignedZone(entity.getAssignedZone())
                .roleInShift(entity.getRoleInShift())
                .status(entity.getStatus())
                .startTime(entity.getStartTime())
                .endTime(entity.getEndTime())
                .checkedInAt(entity.getCheckedInAt())
                .checkedOutAt(entity.getCheckedOutAt())
                .checkInNote(entity.getCheckInNote())
                .checkOutNote(entity.getCheckOutNote())
                .notes(entity.getNotes())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt());

        if (entity.getStaff() != null) {
            builder.staffId(entity.getStaff().getId())
                    .staffUsername(entity.getStaff().getUsername())
                    .staffFullName(entity.getStaff().getFullName())
                    .staffEmail(entity.getStaff().getEmail());
            if (entity.getStaff().getRole() != null) {
                builder.staffRole(entity.getStaff().getRole().getName());
            }
        }

        if (entity.getFacility() != null) {
            builder.facilityId(entity.getFacility().getId())
                    .facilityName(entity.getFacility().getName())
                    .facilityCode(entity.getFacility().getCode());
        }

        if (entity.getAssignedBy() != null) {
            builder.assignedById(entity.getAssignedBy().getId())
                    .assignedByName(entity.getAssignedBy().getFullName());
        }

        return builder.build();
    }
}

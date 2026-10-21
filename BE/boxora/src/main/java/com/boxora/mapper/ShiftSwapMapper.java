package com.boxora.mapper;

import com.boxora.dto.response.ShiftSwapResponse;
import com.boxora.entity.ShiftSwapRequest;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface ShiftSwapMapper {

    @Mapping(source = "assignment.id", target = "assignmentId")
    @Mapping(source = "assignment.assignedDate", target = "assignmentDate")
    @Mapping(source = "assignment.shift", target = "assignmentShift")
    @Mapping(source = "assignment.assignedZone", target = "assignedZone")
    @Mapping(source = "requester.id", target = "requesterId")
    @Mapping(source = "requester.fullName", target = "requesterName")
    @Mapping(source = "requester.username", target = "requesterUsername")
    @Mapping(source = "requester.email", target = "requesterEmail")
    @Mapping(source = "targetStaff.id", target = "targetStaffId")
    @Mapping(source = "targetStaff.fullName", target = "targetStaffName")
    @Mapping(source = "targetStaff.username", target = "targetStaffUsername")
    @Mapping(source = "targetStaff.email", target = "targetStaffEmail")
    @Mapping(source = "facility.id", target = "facilityId")
    @Mapping(source = "facility.name", target = "facilityName")
    @Mapping(source = "facility.code", target = "facilityCode")
    @Mapping(source = "reviewedBy.id", target = "reviewedById")
    @Mapping(source = "reviewedBy.fullName", target = "reviewedByName")
    ShiftSwapResponse toResponse(ShiftSwapRequest entity);
}

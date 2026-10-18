package com.boxora.mapper;

import com.boxora.dto.response.ShiftHandoverResponse;
import com.boxora.entity.ShiftHandover;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface ShiftHandoverMapper {

    @Mapping(source = "facility.id", target = "facilityId")
    @Mapping(source = "facility.name", target = "facilityName")
    @Mapping(source = "facility.code", target = "facilityCode")
    @Mapping(source = "outgoingStaff.id", target = "outgoingStaffId")
    @Mapping(source = "outgoingStaff.fullName", target = "outgoingStaffName")
    @Mapping(source = "outgoingStaff.username", target = "outgoingStaffUsername")
    @Mapping(source = "incomingStaff.id", target = "incomingStaffId")
    @Mapping(source = "incomingStaff.fullName", target = "incomingStaffName")
    @Mapping(source = "incomingStaff.username", target = "incomingStaffUsername")
    @Mapping(source = "outgoingAssignment.id", target = "outgoingAssignmentId")
    @Mapping(source = "incomingAssignment.id", target = "incomingAssignmentId")
    ShiftHandoverResponse toResponse(ShiftHandover entity);
}

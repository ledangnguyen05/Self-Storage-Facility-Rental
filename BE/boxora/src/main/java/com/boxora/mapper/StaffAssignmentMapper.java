package com.boxora.mapper;

import com.boxora.dto.response.StaffAssignmentResponse;
import com.boxora.entity.StaffAssignment;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface StaffAssignmentMapper {

    @Mapping(source = "staff.id", target = "staffId")
    @Mapping(source = "staff.username", target = "staffUsername")
    @Mapping(source = "staff.fullName", target = "staffFullName")
    @Mapping(source = "staff.email", target = "staffEmail")
    @Mapping(source = "facility.id", target = "facilityId")
    @Mapping(source = "facility.name", target = "facilityName")
    @Mapping(source = "facility.code", target = "facilityCode")
    @Mapping(source = "assignedBy.id", target = "assignedById")
    @Mapping(source = "assignedBy.fullName", target = "assignedByName")
    StaffAssignmentResponse toResponse(StaffAssignment entity);
}

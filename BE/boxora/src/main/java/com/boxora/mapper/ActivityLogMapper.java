package com.boxora.mapper;

import com.boxora.dto.response.ActivityLogResponse;
import com.boxora.entity.ActivityLog;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface ActivityLogMapper {

    @Mapping(source = "user.id", target = "userId")
    @Mapping(source = "user.fullName", target = "userName")
    @Mapping(source = "user.email", target = "userEmail")
    @Mapping(target = "critical", expression = "java(entity.getAction() != null && entity.getAction().isCritical())")
    ActivityLogResponse toResponse(ActivityLog entity);
}
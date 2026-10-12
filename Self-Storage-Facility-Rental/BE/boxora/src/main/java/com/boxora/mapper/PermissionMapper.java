package com.boxora.mapper;

import com.boxora.dto.request.PermissionCreateRequest;
import com.boxora.dto.request.PermissionUpdateRequest;
import com.boxora.dto.response.PermissionResponse;
import com.boxora.entity.Permission;
import org.mapstruct.*;

@Mapper(
        componentModel = "spring",
        nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE
)
public interface PermissionMapper {
    Permission toEntity(PermissionCreateRequest request);
    PermissionResponse toResponse(Permission entity);

    //ignore and not update the field(s) that has null value
    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    void updateEntityFromRequest(PermissionUpdateRequest request, @MappingTarget Permission permission);
}

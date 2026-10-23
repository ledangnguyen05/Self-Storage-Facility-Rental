package com.boxora.mapper;

import com.boxora.dto.request.FacilityPolicyUpdateRequest;
import com.boxora.dto.response.FacilityPolicyResponse;
import com.boxora.entity.FacilityPolicy;
import org.mapstruct.*;

/**
 * FacilityPolicyMapper
 */
@Mapper(
        componentModel = "spring",
        nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE
)
public interface FacilityPolicyMapper {

    @Mapping(source = "facility.id", target = "facilityId")
    @Mapping(source = "facility.name", target = "facilityName")
    FacilityPolicyResponse toResponse(FacilityPolicy entity);

    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    @Mapping(target = "prices", ignore = true)
    void updateEntityFromRequest(FacilityPolicyUpdateRequest request, @MappingTarget FacilityPolicy entity);
}
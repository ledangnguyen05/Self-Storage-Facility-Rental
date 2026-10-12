package com.boxora.mapper;

import com.boxora.dto.response.MasterKeyOverrideResponse;
import com.boxora.entity.MasterKeyOverride;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface MasterKeyOverrideMapper {

    @Mapping(source = "facility.id", target = "facilityId")
    @Mapping(source = "facility.name", target = "facilityName")
    @Mapping(source = "performedBy.id", target = "performedById")
    @Mapping(source = "performedBy.fullName", target = "performedByName")
    @Mapping(source = "witness.id", target = "witnessId")
    @Mapping(source = "witness.fullName", target = "witnessName")
    MasterKeyOverrideResponse toResponse(MasterKeyOverride entity);
}
package com.boxora.mapper;

import com.boxora.dto.response.UnitTypeResponse;
import com.boxora.entity.UnitType;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface UnitTypeMapper {

    @Mapping(target = "activeUnitsCount", ignore = true)
    UnitTypeResponse toResponse(UnitType entity);

    @Mapping(target = "activeUnitsCount", source = "activeUnitsCount")
    UnitTypeResponse toResponse(UnitType entity, Long activeUnitsCount);
}

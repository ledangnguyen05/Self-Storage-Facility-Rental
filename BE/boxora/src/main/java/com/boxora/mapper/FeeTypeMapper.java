package com.boxora.mapper;

import com.boxora.dto.request.FeeTypeCreateRequest;
import com.boxora.dto.response.FeeTypeResponse;
import com.boxora.entity.FeeType;
import org.mapstruct.Mapper;
import org.mapstruct.ReportingPolicy;

@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.IGNORE)
public interface FeeTypeMapper {
    FeeType toEntity(FeeTypeCreateRequest request);
    FeeTypeResponse toResponse(FeeType entity);
}

package com.boxora.mapper;

import com.boxora.dto.response.SealingRecordResponse;
import com.boxora.entity.SealingRecord;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface SealingRecordMapper {

    @Mapping(source = "storageUnit.id", target = "storageUnitId")
    @Mapping(source = "storageUnit.unitCode", target = "unitCode")
    @Mapping(source = "contract.id", target = "contractId")
    @Mapping(source = "contract.contractCode", target = "contractCode")
    @Mapping(source = "facility.id", target = "facilityId")
    @Mapping(source = "facility.name", target = "facilityName")
    @Mapping(source = "sealedBy.id", target = "sealedById")
    @Mapping(source = "sealedBy.fullName", target = "sealedByName")
    @Mapping(source = "witness.id", target = "witnessId")
    @Mapping(source = "witness.fullName", target = "witnessName")
    @Mapping(source = "unsealedBy.id", target = "unsealedById")
    @Mapping(source = "unsealedBy.fullName", target = "unsealedByName")
    SealingRecordResponse toResponse(SealingRecord entity);
}

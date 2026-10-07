package com.boxora.mapper;

import com.boxora.dto.response.StorageUnitPriceHistoryResponse;
import com.boxora.entity.StorageUnitPriceHistory;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface StorageUnitPriceHistoryMapper {

    @Mapping(source = "storageUnit.id", target = "storageUnitId")
    @Mapping(source = "storageUnit.unitCode", target = "unitCode")
    @Mapping(source = "storageUnit.facility.id", target = "facilityId")
    @Mapping(source = "storageUnit.facility.name", target = "facilityName")
    @Mapping(source = "unitType.id", target = "unitTypeId")
    @Mapping(source = "unitType.typeName", target = "unitTypeName")
    @Mapping(source = "changedBy.id", target = "changedById")
    @Mapping(source = "changedBy.fullName", target = "changedByName")
    StorageUnitPriceHistoryResponse toResponse(StorageUnitPriceHistory entity);
}


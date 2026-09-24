package com.boxora.mapper;

import com.boxora.dto.response.RentalContractResponse;
import com.boxora.entity.RentalContract;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface RentalContractMapper {

    @Mapping(source = "customer.id", target = "customerId")
    @Mapping(source = "customer.fullName", target = "customerName")
    @Mapping(source = "customer.email", target = "customerEmail")
    @Mapping(source = "customer.phone", target = "customerPhone")
    @Mapping(source = "unit.id", target = "unitId")
    @Mapping(source = "unit.unitCode", target = "unitCode")
    @Mapping(source = "facility.id", target = "facilityId")
    @Mapping(source = "facility.name", target = "facilityName")
    @Mapping(source = "booking.id", target = "bookingId")
    @Mapping(target = "signingUrl", ignore = true)
    RentalContractResponse toResponse(RentalContract entity);
}

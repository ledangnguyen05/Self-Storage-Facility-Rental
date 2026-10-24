package com.boxora.mapper;

import com.boxora.dto.response.RentalContractResponse;
import com.boxora.entity.RentalContract;
import com.boxora.enums.BookingStatus;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface RentalContractMapper {

    @Mapping(source = "customer.id", target = "customerId")
    @Mapping(source = "customer.fullName", target = "customerName")
    @Mapping(source = "customer.email", target = "customerEmail")
    @Mapping(source = "customer.phone", target = "customerPhone")
    @Mapping(source = "unit.id", target = "unitId")
    @Mapping(target = "unitCode", expression = "java(resolveUnitCode(entity))")
    @Mapping(source = "facility.id", target = "facilityId")
    @Mapping(source = "facility.name", target = "facilityName")
    @Mapping(source = "booking.id", target = "bookingId")
    @Mapping(source = "booking.identityCardNumber", target = "identityCardNumber")
    @Mapping(source = "booking.identityCardType", target = "identityCardType")
    @Mapping(source = "paperVerifiedBy.id", target = "paperVerifiedById")
    @Mapping(source = "paperVerifiedBy.fullName", target = "paperVerifiedByName")
    @Mapping(target = "signingUrl", ignore = true)
    RentalContractResponse toResponse(RentalContract entity);

    default String resolveUnitCode(RentalContract contract) {
        if (contract == null || contract.getUnit() == null) {
            return null;
        }
        return contract.getUnit().getUnitCode();
    }
}

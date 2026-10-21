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
    @Mapping(source = "unit.id", target = "storageUnitId")
    @Mapping(source = "unit.unitCode", target = "unitCode")
    @Mapping(source = "facility.id", target = "facilityId")
    @Mapping(source = "facility.name", target = "facilityName")
    @Mapping(source = "booking.id", target = "bookingId")
    @Mapping(source = "booking.bookingCode", target = "bookingCode")
    @Mapping(source = "booking.status", target = "bookingStatus")
    @Mapping(source = "booking.rentalMonths", target = "rentalMonths")
    @Mapping(source = "booking.depositAmount", target = "depositAmount")
    @Mapping(source = "paperVerifiedBy.id", target = "paperVerifiedById")
    @Mapping(source = "paperVerifiedBy.fullName", target = "paperVerifiedByName")
    @Mapping(target = "signingUrl", ignore = true)
    @Mapping(target = "renewable", ignore = true)
    @Mapping(target = "renewalOpensOn", ignore = true)
    @Mapping(target = "renewalClosesOn", ignore = true)
    @Mapping(target = "renewalBlockedReason", ignore = true)
    @Mapping(target = "renewalWindowDays", ignore = true)
    @Mapping(target = "pendingRenewalId", ignore = true)
    @Mapping(target = "signingSimulated", ignore = true)
    RentalContractResponse toResponse(RentalContract entity);
}

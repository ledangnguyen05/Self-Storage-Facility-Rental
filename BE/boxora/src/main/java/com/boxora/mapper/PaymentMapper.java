package com.boxora.mapper;

import com.boxora.dto.response.PaymentResponse;
import com.boxora.entity.Payment;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface PaymentMapper {

    @Mapping(source = "booking.id", target = "bookingId")
    @Mapping(source = "booking.bookingCode", target = "bookingCode")
    @Mapping(source = "contract.id", target = "contractId")
    @Mapping(source = "collectedByStaff.id", target = "collectedById")
    @Mapping(source = "collectedByStaff.fullName", target = "collectedByName")
    @Mapping(source = "confirmedByStaff.id", target = "confirmedById")
    @Mapping(source = "confirmedByStaff.fullName", target = "confirmedByName")
    @Mapping(target = "unitCode", ignore = true)
    @Mapping(target = "facilityName", ignore = true)
    @Mapping(target = "customerName", ignore = true)
    PaymentResponse toResponse(Payment entity);

    @org.mapstruct.AfterMapping
    default void enrichDetails(Payment entity, @org.mapstruct.MappingTarget PaymentResponse response) {
        if (entity == null || response == null) return;
        if (entity.getBooking() != null) {
            boolean unitWasHandedOver = entity.getBooking().getHandoverTime() != null;
            if (unitWasHandedOver && entity.getBooking().getStorageUnit() != null) {
                response.setUnitCode(entity.getBooking().getStorageUnit().getUnitCode());
            }
            if (entity.getBooking().getStorageUnit() != null
                    && entity.getBooking().getStorageUnit().getFacility() != null) {
                response.setFacilityName(entity.getBooking().getStorageUnit().getFacility().getName());
            }
            if (entity.getBooking().getCustomer() != null) {
                response.setCustomerName(entity.getBooking().getCustomer().getFullName());
            }
        }
        if (entity.getContract() != null) {
            boolean bookingWasHandedOver = entity.getBooking() == null
                    || entity.getBooking().getHandoverTime() != null;
            boolean contractUnitWasHandedOver = bookingWasHandedOver
                    && (entity.getContract().getBooking() == null
                    || entity.getContract().getBooking().getHandoverTime() != null);
            if (response.getUnitCode() == null && contractUnitWasHandedOver && entity.getContract().getUnit() != null) {
                response.setUnitCode(entity.getContract().getUnit().getUnitCode());
            }
            if (response.getFacilityName() == null && entity.getContract().getFacility() != null) {
                response.setFacilityName(entity.getContract().getFacility().getName());
            }
            if (response.getCustomerName() == null && entity.getContract().getCustomer() != null) {
                response.setCustomerName(entity.getContract().getCustomer().getFullName());
            }
        }
    }
}

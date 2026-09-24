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
    PaymentResponse toResponse(Payment entity);
}
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
    @Mapping(source = "contract.contractCode", target = "contractCode")
    @Mapping(source = "collectedByStaff.id", target = "collectedById")
    @Mapping(source = "collectedByStaff.fullName", target = "collectedByName")
    @Mapping(source = "confirmedByStaff.id", target = "confirmedById")
    @Mapping(source = "confirmedByStaff.fullName", target = "confirmedByName")
    @Mapping(target = "depositPortion", ignore = true)
    @Mapping(target = "unitCode", ignore = true)
    @Mapping(target = "facilityName", ignore = true)
    @Mapping(target = "customerName", ignore = true)
    @Mapping(target = "failureReason", ignore = true)
    @Mapping(target = "mayHaveBeenCharged", ignore = true)
    PaymentResponse toResponse(Payment entity);

    /**
     * Deposit share of a payment: all of a DEPOSIT, the booking's deposit (capped at the amount) for an online
     * BOOKING_PAYMENT that pays deposit and first month together, nothing for rent, renewals, extra charges.
     */
    static java.math.BigDecimal depositPortionOf(Payment payment) {
        java.math.BigDecimal amount = payment.getAmount() != null ? payment.getAmount() : java.math.BigDecimal.ZERO;
        if (payment.getPaymentType() == com.boxora.enums.PaymentType.DEPOSIT) {
            return amount;
        }
        if (payment.getPaymentType() != com.boxora.enums.PaymentType.BOOKING_PAYMENT || payment.getBooking() == null) {
            return java.math.BigDecimal.ZERO;
        }
        com.boxora.entity.Booking booking = payment.getBooking();
        java.math.BigDecimal deposit = booking.getDepositAmount();
        if ((deposit == null || deposit.signum() <= 0) && booking.getStorageUnit() != null
                && booking.getStorageUnit().getUnitType() != null) {
            deposit = booking.getStorageUnit().getUnitType().getDepositAmount();
        }
        if (deposit == null || deposit.signum() <= 0) {
            return java.math.BigDecimal.ZERO;
        }
        return deposit.min(amount);
    }

    @org.mapstruct.AfterMapping
    default void enrichDetails(Payment entity, @org.mapstruct.MappingTarget PaymentResponse response) {
        if (entity == null || response == null) return;
        response.setDepositPortion(depositPortionOf(entity));
        if (entity.getStatus() == com.boxora.enums.PaymentStatus.FAILED) {
            String reason = com.boxora.util.VNPayResponseCodes.failureReason(entity.getGatewayResponseCode(), entity.getGatewayTransactionStatus());
            response.setFailureReason(reason != null ? reason : "Giao dịch không hoàn tất.");
            response.setMayHaveBeenCharged(com.boxora.util.VNPayResponseCodes.mayHaveBeenCharged(
                    entity.getGatewayResponseCode(), entity.getGatewayTransactionStatus()));
        }
        if (entity.getBooking() != null) {
            if (entity.getBooking().getStorageUnit() != null) {
                response.setUnitCode(entity.getBooking().getStorageUnit().getUnitCode());
                if (entity.getBooking().getStorageUnit().getFacility() != null) {
                    response.setFacilityName(entity.getBooking().getStorageUnit().getFacility().getName());
                }
            }
            if (entity.getBooking().getCustomer() != null) {
                response.setCustomerName(entity.getBooking().getCustomer().getFullName());
            }
        }
        if (entity.getContract() != null) {
            if (response.getUnitCode() == null && entity.getContract().getUnit() != null) {
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
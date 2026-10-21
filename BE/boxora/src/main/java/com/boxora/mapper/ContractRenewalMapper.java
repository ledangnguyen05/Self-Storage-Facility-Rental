package com.boxora.mapper;

import com.boxora.dto.response.ContractRenewalResponse;
import com.boxora.entity.ContractRenewal;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface ContractRenewalMapper {

    @Mapping(source = "contract.id", target = "contractId")
    @Mapping(source = "contract.contractCode", target = "contractCode")
    @Mapping(source = "contract.customer.id", target = "customerId")
    @Mapping(source = "contract.customer.fullName", target = "customerName")
    @Mapping(source = "contract.customer.email", target = "customerEmail")
    @Mapping(source = "contract.facility.id", target = "facilityId")
    @Mapping(source = "contract.facility.name", target = "facilityName")
    @Mapping(source = "contract.unit.unitCode", target = "unitCode")
    @Mapping(source = "payment.id", target = "paymentId")
    @Mapping(source = "payment.status", target = "paymentStatus")
    @Mapping(target = "signingUrl", ignore = true)
    @Mapping(target = "signingSimulated", expression = "java(\"IN_APP_TEST\".equals(entity.getSigningMethod()) || (entity.getDocusealSubmitterSlug() != null && entity.getDocusealSubmitterSlug().startsWith(\"mock-\")))")
    @Mapping(target = "paid", expression = "java(entity.getPayment() != null && entity.getPayment().getStatus() == com.boxora.enums.PaymentStatus.PAID)")
    @Mapping(target = "signed", expression = "java(entity.getSignedAt() != null)")
    ContractRenewalResponse toResponse(ContractRenewal entity);
}

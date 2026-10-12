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
    @Mapping(source = "contract.facility.name", target = "facilityName")
    @Mapping(source = "contract.unit.unitCode", target = "unitCode")
    @Mapping(source = "payment.id", target = "paymentId")
    @Mapping(source = "payment.status", target = "paymentStatus")
    @Mapping(target = "signingUrl", ignore = true)
    ContractRenewalResponse toResponse(ContractRenewal entity);
}

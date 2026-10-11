package com.boxora.mapper;

import com.boxora.dto.request.DiscountCreateRequest;
import com.boxora.dto.response.DiscountResponse;
import com.boxora.entity.Discount;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.Named;
import org.mapstruct.ReportingPolicy;

import java.time.LocalDate;

@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.IGNORE)
public interface DiscountMapper {

    @Mapping(target = "facility", ignore = true)
    Discount toEntity(DiscountCreateRequest request);

    @Mapping(target = "facilityId", source = "facility.id")
    @Mapping(target = "facilityName", source = "facility.name")
    @Mapping(target = "isCurrentlyValid", source = "entity", qualifiedByName = "checkCurrentlyValid")
    DiscountResponse toResponse(Discount entity);

    @Named("checkCurrentlyValid")
    default Boolean checkCurrentlyValid(Discount discount) {
        if (discount == null || Boolean.FALSE.equals(discount.getIsActive())) {
            return false;
        }
        LocalDate today = LocalDate.now();
        if (discount.getStartDate() != null && discount.getStartDate().isAfter(today)) {
            return false;
        }
        if (discount.getEndDate() != null && discount.getEndDate().isBefore(today)) {
            return false;
        }
        if (discount.getUsageLimit() != null && discount.getUsedCount() != null
                && discount.getUsedCount() >= discount.getUsageLimit()) {
            return false;
        }
        return true;
    }
}


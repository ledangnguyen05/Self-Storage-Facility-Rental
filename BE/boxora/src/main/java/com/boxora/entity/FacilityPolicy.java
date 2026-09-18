package com.boxora.entity;

import lombok.*;
import org.springframework.data.mongodb.core.mapping.DBRef;
import org.springframework.data.mongodb.core.mapping.Document;

import java.math.BigDecimal;

@Document(collection = "facility_policies")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FacilityPolicy extends BaseEntity {

    @DBRef
    private Facility facility;

    private Double depositPercentage;

    private BigDecimal dailyLateFee;

    private Integer cancellationRefundDays;
}
package com.boxora.entity;

import lombok.*;
import org.springframework.data.mongodb.core.mapping.Document;

import java.math.BigDecimal;

@Document(collection = "unit_types")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UnitType extends BaseEntity {

    private String typeName;

    private String dimensions;

    private Double areaSqm;

    private BigDecimal basePricePerMonth;

    private BigDecimal depositAmount;
}
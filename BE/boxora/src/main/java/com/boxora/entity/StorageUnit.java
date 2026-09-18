package com.boxora.entity;

import lombok.*;
import org.springframework.data.mongodb.core.mapping.DBRef;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "storage_units")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StorageUnit extends BaseEntity {

    private String unitCode;

    private String floorLevel;

    private String status;

    @DBRef
    private Facility facility;

    @DBRef
    private UnitType unitType;
}
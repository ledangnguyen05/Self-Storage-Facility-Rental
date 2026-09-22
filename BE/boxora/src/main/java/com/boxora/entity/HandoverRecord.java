package com.boxora.entity;

import lombok.*;
import org.springframework.data.mongodb.core.mapping.DBRef;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "handover_records")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class HandoverRecord extends BaseEntity {

    @DBRef
    private Booking booking;

    @DBRef
    private User staff;

    private String recordType;

    private String unitCondition;

    private String notes;

    private LocalDateTime recordedAt;
}
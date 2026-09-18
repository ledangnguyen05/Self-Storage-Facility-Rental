package com.boxora.entity;

import lombok.*;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.DBRef;
import org.springframework.data.mongodb.core.mapping.Document;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Document(collection = "payments")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Payment extends BaseEntity {

    @Indexed(unique = true)
    private String transactionId;

    @DBRef
    private Booking booking;

    private BigDecimal amount;

    private String paymentType;

    private String status;

    private String paymentMethod;

    private LocalDateTime paymentTime;
}
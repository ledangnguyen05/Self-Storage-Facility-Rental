package com.boxora.entity;

import lombok.*;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.DBRef;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "support_tickets")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SupportTicket extends BaseEntity {

    @Indexed(unique = true)
    private String ticketCode;

    @DBRef
    private User customer;

    @DBRef
    private Booking booking;

    private String category;

    private String title;

    private String description;

    @Builder.Default
    private String status = "OPEN";

    @Builder.Default
    private String priority = "MEDIUM";

    @DBRef
    private User assignedStaff;

    private String resolutionNote;
}

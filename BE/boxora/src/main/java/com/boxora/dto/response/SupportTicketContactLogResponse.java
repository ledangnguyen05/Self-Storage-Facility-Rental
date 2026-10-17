package com.boxora.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SupportTicketContactLogResponse {
    private UUID id;
    private UUID ticketId;
    private String ticketCode;
    private String contactMethod;
    private UUID contactedById;
    private String contactedByName;
    private String targetRole;
    private String contactTarget;
    private String summary;
    private String result;
    private LocalDateTime createdAt;
}

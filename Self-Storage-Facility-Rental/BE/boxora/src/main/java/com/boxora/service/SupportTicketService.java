package com.boxora.service;

import com.boxora.dto.request.SupportTicketRequest;
import com.boxora.dto.response.SupportTicketResponse;

import java.util.List;
import java.util.UUID;

public interface SupportTicketService {
    SupportTicketResponse createTicket(SupportTicketRequest request);
    List<SupportTicketResponse> getQueue();
    List<SupportTicketResponse> getMyTickets(UUID customerId);
    SupportTicketResponse resolveTicket(UUID id, String resolutionNote);
    String uploadAttachment(org.springframework.web.multipart.MultipartFile file);
}

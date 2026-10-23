package com.boxora.service;

import com.boxora.dto.request.SupportTicketContactLogRequest;
import com.boxora.dto.request.SupportTicketRequest;
import com.boxora.dto.request.TicketStatusUpdateRequest;
import com.boxora.dto.response.EscalationContactResponse;
import com.boxora.dto.response.FileUploadResponse;
import com.boxora.dto.response.SupportTicketContactLogResponse;
import com.boxora.dto.response.SupportTicketResponse;
import com.boxora.dto.response.SupportTicketStatsResponse;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

public interface SupportTicketService {
    SupportTicketResponse createTicket(SupportTicketRequest request);
    SupportTicketResponse createTicketWithFiles(SupportTicketRequest request, List<MultipartFile> files);
    FileUploadResponse uploadEvidenceImage(MultipartFile file);
    List<FileUploadResponse> uploadEvidenceImages(List<MultipartFile> files);

    List<SupportTicketResponse> getQueue();
    List<SupportTicketResponse> getQueue(UUID facilityId, String status, String category, String priority);
    SupportTicketResponse getTicketById(UUID id);

    List<SupportTicketResponse> getMyTickets(UUID customerId);

    SupportTicketResponse takeOwnership(UUID id);
    SupportTicketResponse assignTicket(UUID id, UUID staffId);
    SupportTicketResponse updateStatus(UUID id, TicketStatusUpdateRequest request);
    SupportTicketResponse resolveTicket(UUID id, String resolutionNote);
    SupportTicketResponse closeTicket(UUID id, String closingNote);
    SupportTicketResponse reopenTicket(UUID id, String reopenReason);

    SupportTicketContactLogResponse recordContactLog(UUID ticketId, SupportTicketContactLogRequest request);
    List<SupportTicketContactLogResponse> getContactLogs(UUID ticketId);
    List<EscalationContactResponse> getEscalationContacts();
    SupportTicketStatsResponse getStats(UUID facilityId);
}

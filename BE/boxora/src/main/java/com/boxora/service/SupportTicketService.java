package com.boxora.service;

import com.boxora.dto.request.SupportTicketRequest;
import com.boxora.dto.response.SupportTicketResponse;

import com.boxora.dto.response.FileUploadResponse;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

public interface SupportTicketService {
    SupportTicketResponse createTicket(SupportTicketRequest request);
    SupportTicketResponse createTicketWithFiles(SupportTicketRequest request, List<MultipartFile> files);
    FileUploadResponse uploadEvidenceImage(MultipartFile file);
    List<FileUploadResponse> uploadEvidenceImages(List<MultipartFile> files);
    List<SupportTicketResponse> getQueue();
    List<SupportTicketResponse> getMyTickets(UUID customerId);
    SupportTicketResponse resolveTicket(UUID id, String resolutionNote);
}

package com.boxora.controller;

import com.boxora.common.response.ApiResponse;
import com.boxora.dto.request.SupportTicketRequest;
import com.boxora.dto.response.SupportTicketResponse;
import com.boxora.service.SupportTicketService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/support-tickets")
@RequiredArgsConstructor
public class SupportTicketController {

    private final SupportTicketService supportTicketService;

    @PostMapping
    public ResponseEntity<ApiResponse<SupportTicketResponse>> create(@Valid @RequestBody SupportTicketRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Rapid support ticket logged", supportTicketService.createTicket(request)));
    }

    @GetMapping("/queue")
    public ResponseEntity<ApiResponse<List<SupportTicketResponse>>> getQueue() {
        return ResponseEntity.ok(ApiResponse.success(supportTicketService.getQueue()));
    }

    @GetMapping("/my-tickets")
    public ResponseEntity<ApiResponse<List<SupportTicketResponse>>> getMyTickets(@RequestParam(required = false) UUID customerId) {
        return ResponseEntity.ok(ApiResponse.success(supportTicketService.getMyTickets(customerId)));
    }

    @PatchMapping("/{id}/resolve")
    public ResponseEntity<ApiResponse<SupportTicketResponse>> resolve(
            @PathVariable UUID id,
            @RequestParam(defaultValue = "Resolved by operations staff on-site") String resolutionNote
    ) {
        return ResponseEntity.ok(ApiResponse.success("Ticket marked as resolved", supportTicketService.resolveTicket(id, resolutionNote)));
    }
}

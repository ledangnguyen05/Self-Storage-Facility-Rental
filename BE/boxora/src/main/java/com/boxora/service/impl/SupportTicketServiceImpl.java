package com.boxora.service.impl;

import com.boxora.dto.request.SupportTicketRequest;
import com.boxora.dto.response.SupportTicketResponse;
import com.boxora.entity.Booking;
import com.boxora.entity.SupportTicket;
import com.boxora.entity.User;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.repository.BookingRepository;
import com.boxora.repository.SupportTicketRepository;
import com.boxora.repository.UserRepository;
import com.boxora.service.SupportTicketService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Random;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SupportTicketServiceImpl implements SupportTicketService {

    private final SupportTicketRepository supportTicketRepository;
    private final UserRepository userRepository;
    private final BookingRepository bookingRepository;

    @Override
    public SupportTicketResponse createTicket(SupportTicketRequest request) {
        User customer = null;
        if (request.getCustomerId() != null) {
            customer = userRepository.findById(request.getCustomerId()).orElse(null);
        }
        if (customer == null) {
            customer = userRepository.findAll().stream().findFirst().orElse(null);
        }

        Booking booking = null;
        if (request.getBookingId() != null) {
            booking = bookingRepository.findById(request.getBookingId()).orElse(null);
        }

        String ticketCode = "TK-" + String.format("%04d", new Random().nextInt(10000));

        SupportTicket ticket = SupportTicket.builder()
                .ticketCode(ticketCode)
                .customer(customer)
                .booking(booking)
                .category(request.getCategory())
                .title(request.getTitle())
                .description(request.getDescription())
                .status("OPEN")
                .priority(request.getPriority() != null ? request.getPriority() : "MEDIUM")
                .build();

        ticket = supportTicketRepository.save(ticket);
        return mapToResponse(ticket);
    }

    @Override
    public List<SupportTicketResponse> getQueue() {
        return supportTicketRepository.findAll().stream().map(this::mapToResponse).collect(Collectors.toList());
    }

    @Override
    public List<SupportTicketResponse> getMyTickets(UUID customerId) {
        List<SupportTicket> list = supportTicketRepository.findAll();
        if (customerId != null) {
            list = list.stream()
                    .filter(t -> t.getCustomer() != null && customerId.equals(t.getCustomer().getId()))
                    .collect(Collectors.toList());
        }
        return list.stream().map(this::mapToResponse).collect(Collectors.toList());
    }

    @Override
    public SupportTicketResponse resolveTicket(UUID id, String resolutionNote) {
        SupportTicket ticket = supportTicketRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.RESOURCE_NOT_FOUND));

        ticket.setStatus("RESOLVED");
        ticket.setResolutionNote(resolutionNote);
        ticket = supportTicketRepository.save(ticket);

        return mapToResponse(ticket);
    }

    private SupportTicketResponse mapToResponse(SupportTicket t) {
        return SupportTicketResponse.builder()
                .id(t.getId())
                .ticketCode(t.getTicketCode())
                .customerId(t.getCustomer() != null ? t.getCustomer().getId() : null)
                .customerName(t.getCustomer() != null ? t.getCustomer().getFullName() : "Nguyễn Văn An")
                .customerPhone(t.getCustomer() != null ? t.getCustomer().getPhone() : "0918 234 567")
                .bookingId(t.getBooking() != null ? t.getBooking().getId() : null)
                .unitCode(t.getBooking() != null && t.getBooking().getStorageUnit() != null 
                        ? t.getBooking().getStorageUnit().getUnitCode() 
                        : "A-108")
                .category(t.getCategory())
                .title(t.getTitle())
                .description(t.getDescription())
                .status(t.getStatus() != null ? t.getStatus() : "OPEN")
                .priority(t.getPriority() != null ? t.getPriority() : "MEDIUM")
                .resolutionNote(t.getResolutionNote())
                .createdAt(t.getCreatedAt() != null ? t.getCreatedAt() : LocalDateTime.now())
                .build();
    }
}

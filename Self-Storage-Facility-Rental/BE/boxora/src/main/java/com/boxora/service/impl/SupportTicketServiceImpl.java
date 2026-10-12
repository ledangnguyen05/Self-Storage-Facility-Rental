package com.boxora.service.impl;

import com.boxora.dto.request.SupportTicketRequest;
import com.boxora.dto.response.SupportTicketResponse;
import com.boxora.entity.Booking;
import com.boxora.entity.SupportTicket;
import com.boxora.entity.User;
import com.boxora.enums.TicketCategory;
import com.boxora.enums.TicketStatus;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.repository.BookingRepository;
import com.boxora.repository.SupportTicketRepository;
import com.boxora.repository.UserRepository;
import com.boxora.service.SupportTicketService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Random;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
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

        TicketCategory category = TicketCategory.OTHER;
        if (request.getCategory() != null && !request.getCategory().isBlank()) {
            try {
                category = TicketCategory.valueOf(request.getCategory().trim().toUpperCase());
            } catch (IllegalArgumentException ignored) {
            }
        }

        SupportTicket ticket = SupportTicket.builder()
                .ticketCode(ticketCode)
                .customer(customer)
                .booking(booking)
                .category(category)
                .title(request.getTitle())
                .description(request.getDescription())
                .attachmentUrl(request.getAttachmentUrl())
                .status(TicketStatus.OPEN)
                .priority(request.getPriority() != null ? request.getPriority() : "MEDIUM")
                .build();

        ticket = supportTicketRepository.save(ticket);
        return mapToResponse(ticket);
    }

    @Override
    @Transactional(readOnly = true)
    public List<SupportTicketResponse> getQueue() {
        return supportTicketRepository.findAll().stream().map(this::mapToResponse).collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
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
                .orElseThrow(() -> new AppException(ErrorCode.TICKET_NOT_FOUND));

        ticket.setStatus(TicketStatus.RESOLVED);
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
                .category(t.getCategory() != null ? t.getCategory().name() : null)
                .title(t.getTitle())
                .description(t.getDescription())
                .status(t.getStatus() != null ? t.getStatus().name() : TicketStatus.OPEN.name())
                .priority(t.getPriority() != null ? t.getPriority() : "MEDIUM")
                .resolutionNote(t.getResolutionNote())
                .attachmentUrl(t.getAttachmentUrl())
                .createdAt(t.getCreatedAt() != null ? t.getCreatedAt() : LocalDateTime.now())
                .build();
    }

    @Override
    public String uploadAttachment(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Tập tin tải lên không được rỗng");
        }
        try {
            String uploadDir = "uploads/support/";
            Path uploadPath = Paths.get(uploadDir);
            if (!Files.exists(uploadPath)) {
                Files.createDirectories(uploadPath);
            }
            String originalName = file.getOriginalFilename();
            String cleanName = originalName != null ? StringUtils.cleanPath(originalName).replaceAll("[^a-zA-Z0-9._-]", "_") : "attachment.jpg";
            String filename = UUID.randomUUID().toString() + "_" + cleanName;
            Path filePath = uploadPath.resolve(filename);
            Files.copy(file.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);
            return "/uploads/support/" + filename;
        } catch (IOException e) {
            throw new RuntimeException("Lỗi lưu trữ tập tin: " + e.getMessage(), e);
        }
    }
}

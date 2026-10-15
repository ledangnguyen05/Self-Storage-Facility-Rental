package com.boxora.service.impl;

import com.boxora.dto.request.SupportTicketRequest;
import com.boxora.dto.response.FileUploadResponse;
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
import com.boxora.service.FileStorageService;
import com.boxora.service.SupportTicketService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import com.boxora.security.RequestContext;
import java.util.*;
import java.util.concurrent.ThreadLocalRandom;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class SupportTicketServiceImpl implements SupportTicketService {

    private final SupportTicketRepository supportTicketRepository;
    private final UserRepository userRepository;
    private final BookingRepository bookingRepository;
    private final FileStorageService fileStorageService;
    private final RequestContext requestContext;

    @Override
    public SupportTicketResponse createTicket(SupportTicketRequest request) {
        UUID currentUserId = requestContext != null ? requestContext.currentUserId() : null;
        String currentUserRole = requestContext != null ? requestContext.currentUserRole() : null;
        boolean isStaffOrAdmin = "STAFF".equalsIgnoreCase(currentUserRole)
                || "FACILITY_MANAGER".equalsIgnoreCase(currentUserRole)
                || "ADMIN".equalsIgnoreCase(currentUserRole);

        User customer;
        if (isStaffOrAdmin) {
            if (request.getCustomerId() != null) {
                customer = userRepository.findById(request.getCustomerId())
                        .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
            } else if (currentUserId != null) {
                customer = userRepository.findById(currentUserId).orElse(null);
            } else {
                throw new AppException(ErrorCode.USER_NOT_FOUND);
            }
        } else {
            // Customer role: customer MUST be the authenticated principal
            if (currentUserId == null) {
                throw new AppException(ErrorCode.UNAUTHORIZED);
            }
            if (request.getCustomerId() != null && !request.getCustomerId().equals(currentUserId)) {
                log.warn("[SECURITY] Customer {} attempted to create support ticket for another user {}",
                        currentUserId, request.getCustomerId());
                throw new AppException(ErrorCode.FORBIDDEN);
            }
            customer = userRepository.findById(currentUserId)
                    .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        }

        // Validate access to any booking linked to a support ticket
        Booking booking = null;
        if (request.getBookingId() != null) {
            booking = bookingRepository.findById(request.getBookingId())
                    .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

            if (!isStaffOrAdmin) {
                if (booking.getCustomer() == null || !booking.getCustomer().getId().equals(customer.getId())) {
                    log.warn("[SECURITY] Customer {} attempted to link support ticket to booking {} owned by customer {}",
                            customer.getId(), booking.getId(), booking.getCustomer() != null ? booking.getCustomer().getId() : "null");
                    throw new AppException(ErrorCode.FORBIDDEN);
                }
            }
        }

        // Collision-resistant unique ticket identifier: TK-YYMMDD-XXXX
        String ticketCode = generateUniqueTicketCode();

        TicketCategory category = TicketCategory.OTHER;
        if (request.getCategory() != null && !request.getCategory().isBlank()) {
            try {
                category = TicketCategory.valueOf(request.getCategory().trim().toUpperCase());
            } catch (IllegalArgumentException ignored) {
            }
        }

        String combinedEvidence = resolveImageEvidence(request.getImageEvidence(), request.getEvidenceUrls());

        SupportTicket ticket = SupportTicket.builder()
                .ticketCode(ticketCode)
                .customer(customer)
                .booking(booking)
                .category(category)
                .title(request.getTitle())
                .description(request.getDescription())
                .status(TicketStatus.OPEN)
                .priority(request.getPriority() != null ? request.getPriority() : "MEDIUM")
                .imageEvidence(combinedEvidence)
                .build();

        ticket = supportTicketRepository.save(ticket);
        log.info("Created support ticket {} for customer {} with image evidence: {}", ticketCode, customer.getId(), combinedEvidence);
        return mapToResponse(ticket);
    }

    @Override
    public SupportTicketResponse createTicketWithFiles(SupportTicketRequest request, List<MultipartFile> files) {
        List<FileUploadResponse> uploadedFiles = fileStorageService.storeFiles(files, "tickets");
        List<String> uploadedUrls = uploadedFiles.stream()
                .map(FileUploadResponse::getFileUrl)
                .collect(Collectors.toList());

        List<String> allUrls = new ArrayList<>(uploadedUrls);
        if (request.getEvidenceUrls() != null) {
            allUrls.addAll(request.getEvidenceUrls());
        }

        request.setEvidenceUrls(allUrls);
        return createTicket(request);
    }

    @Override
    public FileUploadResponse uploadEvidenceImage(MultipartFile file) {
        return fileStorageService.storeFile(file, "tickets");
    }

    @Override
    public List<FileUploadResponse> uploadEvidenceImages(List<MultipartFile> files) {
        return fileStorageService.storeFiles(files, "tickets");
    }

    @Override
    @Transactional(readOnly = true)
    public List<SupportTicketResponse> getQueue() {
        return supportTicketRepository.findAll().stream().map(this::mapToResponse).collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<SupportTicketResponse> getMyTickets(UUID customerId) {
        UUID currentUserId = requestContext != null ? requestContext.currentUserId() : null;
        String currentUserRole = requestContext != null ? requestContext.currentUserRole() : null;
        boolean isStaffOrAdmin = "STAFF".equalsIgnoreCase(currentUserRole)
                || "FACILITY_MANAGER".equalsIgnoreCase(currentUserRole)
                || "ADMIN".equalsIgnoreCase(currentUserRole);

        UUID targetCustomerId = customerId;
        if (!isStaffOrAdmin) {
            if (currentUserId == null) {
                throw new AppException(ErrorCode.UNAUTHORIZED);
            }
            if (customerId != null && !customerId.equals(currentUserId)) {
                log.warn("[SECURITY] Customer {} attempted to view tickets of customer {}", currentUserId, customerId);
                throw new AppException(ErrorCode.FORBIDDEN);
            }
            targetCustomerId = currentUserId;
        }

        List<SupportTicket> list;
        if (targetCustomerId != null) {
            list = supportTicketRepository.findByCustomer_Id(targetCustomerId);
        } else {
            list = supportTicketRepository.findAll();
        }
        return list.stream().map(this::mapToResponse).collect(Collectors.toList());
    }

    @Override
    public SupportTicketResponse resolveTicket(UUID id, String resolutionNote) {
        String currentUserRole = requestContext != null ? requestContext.currentUserRole() : null;
        boolean isStaffOrAdmin = "STAFF".equalsIgnoreCase(currentUserRole)
                || "FACILITY_MANAGER".equalsIgnoreCase(currentUserRole)
                || "ADMIN".equalsIgnoreCase(currentUserRole);

        if (requestContext != null && requestContext.currentUserId() != null && !isStaffOrAdmin) {
            log.warn("[SECURITY] Non-staff user attempted to resolve support ticket {}", id);
            throw new AppException(ErrorCode.FORBIDDEN);
        }

        SupportTicket ticket = supportTicketRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.TICKET_NOT_FOUND));

        ticket.setStatus(TicketStatus.RESOLVED);
        ticket.setResolutionNote(resolutionNote);
        ticket = supportTicketRepository.save(ticket);

        return mapToResponse(ticket);
    }

    private String generateUniqueTicketCode() {
        String datePart = java.time.LocalDate.now().format(java.time.format.DateTimeFormatter.ofPattern("yyMMdd"));
        for (int i = 0; i < 5; i++) {
            String candidate = String.format("TK-%s-%04d", datePart, ThreadLocalRandom.current().nextInt(10000));
            if (supportTicketRepository.findByTicketCode(candidate).isEmpty()) {
                return candidate;
            }
        }
        return "TK-" + datePart + "-" + UUID.randomUUID().toString().substring(0, 6).toUpperCase();
    }

    private String resolveImageEvidence(String singleEvidence, List<String> evidenceUrls) {
        Set<String> urls = new LinkedHashSet<>();
        if (singleEvidence != null && !singleEvidence.isBlank()) {
            for (String part : singleEvidence.split(";")) {
                if (!part.trim().isEmpty()) {
                    urls.add(part.trim());
                }
            }
        }
        if (evidenceUrls != null) {
            for (String url : evidenceUrls) {
                if (url != null && !url.trim().isEmpty()) {
                    urls.add(url.trim());
                }
            }
        }
        return urls.isEmpty() ? null : String.join(";", urls);
    }

    private SupportTicketResponse mapToResponse(SupportTicket t) {
        List<String> evidenceUrls = (t.getImageEvidence() != null && !t.getImageEvidence().isBlank())
                ? Arrays.stream(t.getImageEvidence().split(";"))
                        .map(String::trim)
                        .filter(s -> !s.isEmpty())
                        .collect(Collectors.toList())
                : List.of();

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
                .imageEvidence(t.getImageEvidence())
                .evidenceUrls(evidenceUrls)
                .resolutionNote(t.getResolutionNote())
                .createdAt(t.getCreatedAt() != null ? t.getCreatedAt() : LocalDateTime.now())
                .build();
    }
}

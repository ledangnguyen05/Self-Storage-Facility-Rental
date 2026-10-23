package com.boxora.service.impl;

import com.boxora.dto.request.SupportTicketContactLogRequest;
import com.boxora.dto.request.SupportTicketRequest;
import com.boxora.dto.request.TicketStatusUpdateRequest;
import com.boxora.dto.response.EscalationContactResponse;
import com.boxora.dto.response.FileUploadResponse;
import com.boxora.dto.response.SupportTicketContactLogResponse;
import com.boxora.dto.response.SupportTicketResponse;
import com.boxora.dto.response.SupportTicketStatsResponse;
import com.boxora.entity.ActivityLog;
import com.boxora.entity.Booking;
import com.boxora.entity.Facility;
import com.boxora.entity.SupportTicket;
import com.boxora.entity.SupportTicketContactLog;
import com.boxora.entity.User;
import com.boxora.enums.ActivityAction;
import com.boxora.enums.ActivityLogStatus;
import com.boxora.enums.ActivityLogType;
import com.boxora.enums.TicketCategory;
import com.boxora.enums.TicketStatus;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.repository.ActivityLogRepository;
import com.boxora.repository.BookingRepository;
import com.boxora.repository.FacilityRepository;
import com.boxora.repository.SupportTicketContactLogRepository;
import com.boxora.repository.SupportTicketRepository;
import com.boxora.repository.UserRepository;
import com.boxora.security.RequestContext;
import com.boxora.service.FileStorageService;
import com.boxora.service.SupportTicketService;
import com.boxora.entity.StorageUnit;
import com.boxora.entity.RentalContract;
import com.boxora.enums.RentalContractStatus;
import com.boxora.enums.BookingStatus;
import com.boxora.repository.StorageUnitRepository;
import com.boxora.repository.RentalContractRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ThreadLocalRandom;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class SupportTicketServiceImpl implements SupportTicketService {

    private final SupportTicketRepository supportTicketRepository;
    private final SupportTicketContactLogRepository contactLogRepository;
    private final UserRepository userRepository;
    private final BookingRepository bookingRepository;
    private final FacilityRepository facilityRepository;
    private final StorageUnitRepository storageUnitRepository;
    private final RentalContractRepository rentalContractRepository;
    private final ActivityLogRepository activityLogRepository;
    private final FileStorageService fileStorageService;
    private final RequestContext requestContext;

    @Override
    public SupportTicketResponse createTicket(SupportTicketRequest request) {
        UUID currentUserId = requestContext != null ? requestContext.currentUserId() : null;
        String currentUserRole = requestContext != null ? requestContext.currentUserRole() : null;

        // Business Operations Manager & System Administrator cannot create tickets
        if ("BUSINESS_MANAGER".equalsIgnoreCase(currentUserRole)) {
            log.warn("[SECURITY] BUSINESS_MANAGER {} attempted to create support ticket", currentUserId);
            throw new AppException(ErrorCode.FORBIDDEN, "Business Operations Manager chỉ có quyền xem báo cáo sự cố, không được tạo ticket thay người dùng");
        }
        if ("ADMIN".equalsIgnoreCase(currentUserRole)) {
            log.warn("[SECURITY] ADMIN {} attempted to create support ticket", currentUserId);
            throw new AppException(ErrorCode.FORBIDDEN, "System Administrator chỉ có quyền xem báo cáo kiểm tra hệ thống, không tạo ticket nghiệp vụ");
        }

        boolean isStaffOrManager = "STAFF".equalsIgnoreCase(currentUserRole) || "FACILITY_MANAGER".equalsIgnoreCase(currentUserRole);

        User customer;
        User currentStaffOrManager = null;
        if (isStaffOrManager) {
            currentStaffOrManager = currentUserId != null ? userRepository.findById(currentUserId).orElse(null) : null;
            if (currentStaffOrManager == null || currentStaffOrManager.getFacility() == null) {
                throw new AppException(ErrorCode.FORBIDDEN, "Staff and facility managers must have an assigned facility to create tickets");
            }
            if (request.getFacilityId() != null
                    && !request.getFacilityId().equals(currentStaffOrManager.getFacility().getId())) {
                log.warn("[SECURITY] {} {} attempted to create ticket for non-assigned facility {}",
                        currentUserRole, currentUserId, request.getFacilityId());
                throw new AppException(ErrorCode.TICKET_FACILITY_MISMATCH);
            }
            if (request.getCustomerId() != null) {
                customer = userRepository.findById(request.getCustomerId())
                        .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
            } else if (currentStaffOrManager != null) {
                // If staff creates an on-site operational incident, customer defaults to staff/self
                customer = currentStaffOrManager;
            } else {
                throw new AppException(ErrorCode.USER_NOT_FOUND);
            }
        } else {
            // Customer role: principal must be authenticated customer
            if (currentUserId == null) {
                throw new AppException(ErrorCode.UNAUTHORIZED);
            }
            if (request.getCustomerId() != null && !request.getCustomerId().equals(currentUserId)) {
                log.warn("[SECURITY] Customer {} attempted to create ticket for user {}", currentUserId, request.getCustomerId());
                throw new AppException(ErrorCode.FORBIDDEN);
            }
            customer = userRepository.findById(currentUserId)
                    .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        }

        // Resolve associated booking and facility
        Booking booking = null;
        Facility facility = null;

        if (request.getBookingId() != null) {
            booking = bookingRepository.findById(request.getBookingId())
                    .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

            if (!isStaffOrManager) {
                if (booking.getCustomer() == null || !booking.getCustomer().getId().equals(customer.getId())) {
                    log.warn("[SECURITY] Customer {} attempted to link support ticket to booking {} owned by {}",
                            customer.getId(), booking.getId(), booking.getCustomer() != null ? booking.getCustomer().getId() : "null");
                    throw new AppException(ErrorCode.FORBIDDEN);
                }
            }

            if (booking.getStorageUnit() != null) {
                facility = booking.getStorageUnit().getFacility();
            }
            if (isStaffOrManager && (facility == null
                    || !facility.getId().equals(currentStaffOrManager.getFacility().getId()))) {
                log.warn("[SECURITY] {} {} attempted to create ticket for booking {} outside assigned facility",
                        currentUserRole, currentUserId, booking.getId());
                throw new AppException(ErrorCode.TICKET_FACILITY_MISMATCH);
            }
        }

        // If facility not resolved from booking, attempt to resolve from request or user
        if (facility == null && request.getFacilityId() != null) {
            facility = facilityRepository.findById(request.getFacilityId()).orElse(null);
        }
        if (isStaffOrManager) {
            facility = currentStaffOrManager.getFacility();
        }
        if (facility == null && !isStaffOrManager) {
            facility = facilityRepository.findAllByOrderByCreatedAtAsc().stream().findFirst().orElse(null);
        }

        String ticketCode = generateUniqueTicketCode();

        TicketCategory category = TicketCategory.OTHER;
        if (request.getCategory() != null && !request.getCategory().isBlank()) {
            try {
                category = TicketCategory.valueOf(request.getCategory().trim().toUpperCase());
            } catch (IllegalArgumentException ignored) {
            }
        }

        String priority = (request.getPriority() != null && !request.getPriority().isBlank())
                ? request.getPriority().trim().toUpperCase()
                : "MEDIUM";

        // Calculate SLA due timestamp
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime slaDueAt = calculateSlaDueAt(now, priority);

        String combinedEvidence = resolveImageEvidence(request.getImageEvidence(), request.getEvidenceUrls());

        SupportTicket ticket = SupportTicket.builder()
                .ticketCode(ticketCode)
                .customer(customer)
                .booking(booking)
                .storageUnit(storageUnit)
                .createdByStaff(createdByStaff)
                .isStaffRecorded(isStaffRecorded)
                .facility(facility)
                .category(category)
                .title(request.getTitle())
                .description(request.getDescription())
                .status(TicketStatus.OPEN)
                .priority(priority)
                .imageEvidence(combinedEvidence)
                .slaDueAt(slaDueAt)
                .build();

        ticket = supportTicketRepository.save(ticket);

        // Audit log
        logActivity(ticket, ActivityAction.SUPPORT_TICKET_CREATE, null, ticket.getStatus().name(),
                "Tạo phiếu báo cáo sự cố mới " + ticketCode + " (" + category + ", " + priority + ")");

        log.info("Created support ticket {} for customer {} at facility {}", ticketCode, customer.getId(),
                facility != null ? facility.getCode() : "UNKNOWN");
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
        return getQueue(null, null, null, null);
    }

    @Override
    @Transactional(readOnly = true)
    public List<SupportTicketResponse> getQueue(UUID facilityId, String status, String category, String priority) {
        UUID currentUserId = requestContext != null ? requestContext.currentUserId() : null;
        String currentUserRole = requestContext != null ? requestContext.currentUserRole() : null;

        if (currentUserId == null) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }

        User currentUser = userRepository.findById(currentUserId).orElse(null);

        List<SupportTicket> rawList;

        if ("CUSTOMER".equalsIgnoreCase(currentUserRole)) {
            // Customer only sees own tickets
            rawList = supportTicketRepository.findByCustomer_Id(currentUserId);
        } else if ("STAFF".equalsIgnoreCase(currentUserRole)) {
            // Staff only sees tickets in their assigned facility or assigned to them
            if (currentUser == null || currentUser.getFacility() == null) {
                throw new AppException(ErrorCode.FORBIDDEN, "Nhân viên chưa được phân công cơ sở");
            } else {
                if (facilityId != null && !facilityId.equals(currentUser.getFacility().getId())) {
                    log.warn("[SECURITY] Staff {} attempted to access tickets of facility {}", currentUserId, facilityId);
                    throw new AppException(ErrorCode.FORBIDDEN, "Nhân viên không có quyền truy cập dữ liệu của cơ sở khác");
                }
                rawList = supportTicketRepository.findByFacility_Id(currentUser.getFacility().getId());
            }
        } else if ("FACILITY_MANAGER".equalsIgnoreCase(currentUserRole)) {
            // Facility manager only sees tickets in their facility
            if (currentUser == null || currentUser.getFacility() == null) {
                if (facilityId != null) {
                    throw new AppException(ErrorCode.FORBIDDEN, "Quản lý cơ sở chưa được phân công cơ sở");
                }
                rawList = Collections.emptyList();
            } else {
                if (facilityId != null && !facilityId.equals(currentUser.getFacility().getId())) {
                    log.warn("[SECURITY] Facility Manager {} attempted to access tickets of facility {}", currentUserId, facilityId);
                    throw new AppException(ErrorCode.FORBIDDEN, "Quản lý cơ sở không có quyền truy cập dữ liệu của cơ sở khác");
                }
                rawList = supportTicketRepository.findByFacility_Id(currentUser.getFacility().getId());
            }
        } else if ("BUSINESS_MANAGER".equalsIgnoreCase(currentUserRole) || "ADMIN".equalsIgnoreCase(currentUserRole)) {
            // BOM & Admin: system-wide view with optional facility filter
            if (facilityId != null) {
                rawList = supportTicketRepository.findByFacility_Id(facilityId);
            } else {
                rawList = supportTicketRepository.findAll();
            }
        } else {
            rawList = Collections.emptyList();
        }

        // Apply in-memory filters for status, category, priority
        return rawList.stream()
                .filter(t -> {
                    if (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status)) {
                        if (t.getStatus() == null || !t.getStatus().name().equalsIgnoreCase(status.trim())) {
                            return false;
                        }
                    }
                    if (category != null && !category.isBlank() && !"ALL".equalsIgnoreCase(category)) {
                        if (t.getCategory() == null || !t.getCategory().name().equalsIgnoreCase(category.trim())) {
                            return false;
                        }
                    }
                    if (priority != null && !priority.isBlank() && !"ALL".equalsIgnoreCase(priority)) {
                        if (t.getPriority() == null || !t.getPriority().equalsIgnoreCase(priority.trim())) {
                            return false;
                        }
                    }
                    return true;
                })
                .sorted((t1, t2) -> {
                    if (t1.getCreatedAt() != null && t2.getCreatedAt() != null) {
                        return t2.getCreatedAt().compareTo(t1.getCreatedAt());
                    }
                    return 0;
                })
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public SupportTicketResponse getTicketById(UUID id) {
        SupportTicket ticket = supportTicketRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.TICKET_NOT_FOUND));

        validateViewPermission(ticket);
        return mapToResponse(ticket);
    }

    @Override
    @Transactional(readOnly = true)
    public List<SupportTicketResponse> getMyTickets(UUID customerId) {
        UUID currentUserId = requestContext != null ? requestContext.currentUserId() : null;
        String currentUserRole = requestContext != null ? requestContext.currentUserRole() : null;
        boolean isStaffOrAdmin = "STAFF".equalsIgnoreCase(currentUserRole)
                || "FACILITY_MANAGER".equalsIgnoreCase(currentUserRole)
                || "BUSINESS_MANAGER".equalsIgnoreCase(currentUserRole)
                || "ADMIN".equalsIgnoreCase(currentUserRole);

        UUID targetCustomerId = customerId;
        if (!isStaffOrAdmin) {
            if (currentUserId == null) throw new AppException(ErrorCode.UNAUTHORIZED);
            if (customerId != null && !customerId.equals(currentUserId)) {
                log.warn("[SECURITY] Customer {} attempted to view tickets of {}", currentUserId, customerId);
                throw new AppException(ErrorCode.FORBIDDEN);
            }
            targetCustomerId = currentUserId;
        }

        List<SupportTicket> list = (targetCustomerId != null)
                ? supportTicketRepository.findByCustomer_Id(targetCustomerId)
                : supportTicketRepository.findAll();

        if ("STAFF".equalsIgnoreCase(currentUserRole) || "FACILITY_MANAGER".equalsIgnoreCase(currentUserRole)) {
            User currentUser = currentUserId != null ? userRepository.findById(currentUserId).orElse(null) : null;
            if (currentUser == null || currentUser.getFacility() == null) {
                throw new AppException(ErrorCode.FORBIDDEN, "Người dùng chưa được phân công cơ sở");
            }
            UUID assignedFacilityId = currentUser.getFacility().getId();
            list = list.stream()
                    .filter(ticket -> ticket.getFacility() != null
                            && assignedFacilityId.equals(ticket.getFacility().getId()))
                    .toList();
        }

        return list.stream()
                .sorted((t1, t2) -> {
                    if (t1.getCreatedAt() != null && t2.getCreatedAt() != null) {
                        return t2.getCreatedAt().compareTo(t1.getCreatedAt());
                    }
                    return 0;
                })
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Override
    public SupportTicketResponse takeOwnership(UUID id) {
        UUID currentUserId = requestContext != null ? requestContext.currentUserId() : null;
        String currentUserRole = requestContext != null ? requestContext.currentUserRole() : null;

        assertOperationalHandlerRole(currentUserRole, "tiếp nhận xử lý ticket");

        SupportTicket ticket = supportTicketRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.TICKET_NOT_FOUND));

        User currentUser = userRepository.findById(currentUserId)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        validateFacilityScope(ticket, currentUser);

        if (ticket.getStatus() == TicketStatus.CLOSED) {
            throw new AppException(ErrorCode.TICKET_ALREADY_CLOSED);
        }

        TicketStatus oldStatus = ticket.getStatus();
        ticket.setAssignedStaff(currentUser);
        ticket.setStatus(TicketStatus.IN_PROGRESS);
        ticket = supportTicketRepository.save(ticket);

        logActivity(ticket, ActivityAction.SUPPORT_TICKET_ASSIGN, oldStatus.name(), ticket.getStatus().name(),
                currentUser.getFullName() + " đã tiếp nhận xử lý ticket tại cơ sở");

        return mapToResponse(ticket);
    }

    @Override
    public SupportTicketResponse assignTicket(UUID id, UUID staffId) {
        UUID currentUserId = requestContext != null ? requestContext.currentUserId() : null;
        String currentUserRole = requestContext != null ? requestContext.currentUserRole() : null;

        if (!"FACILITY_MANAGER".equalsIgnoreCase(currentUserRole)) {
            log.warn("[SECURITY] Role {} attempted to assign support ticket", currentUserRole);
            throw new AppException(ErrorCode.FORBIDDEN, "Chỉ Facility Manager mới có quyền phân công nhân viên xử lý sự cố trong cơ sở");
        }

        SupportTicket ticket = supportTicketRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.TICKET_NOT_FOUND));

        User manager = userRepository.findById(currentUserId)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        validateFacilityScope(ticket, manager);

        if (ticket.getStatus() == TicketStatus.CLOSED) {
            throw new AppException(ErrorCode.TICKET_ALREADY_CLOSED);
        }

        User targetStaff = userRepository.findById(staffId)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        // Verify target user is active staff in the same facility
        if (targetStaff.getRole() == null || !"STAFF".equalsIgnoreCase(targetStaff.getRole().getName())) {
            throw new AppException(ErrorCode.TICKET_STAFF_NOT_IN_FACILITY, "Người được phân công phải là nhân viên vận hành (STAFF)");
        }
        if (ticket.getFacility() != null && targetStaff.getFacility() != null
                && !ticket.getFacility().getId().equals(targetStaff.getFacility().getId())) {
            throw new AppException(ErrorCode.TICKET_STAFF_NOT_IN_FACILITY, "Nhân viên không thuộc cơ sở xảy ra sự cố");
        }

        TicketStatus oldStatus = ticket.getStatus();
        ticket.setAssignedStaff(targetStaff);
        if (ticket.getStatus() == TicketStatus.OPEN || ticket.getStatus() == TicketStatus.REOPENED) {
            ticket.setStatus(TicketStatus.IN_PROGRESS);
        }
        ticket = supportTicketRepository.save(ticket);

        logActivity(ticket, ActivityAction.SUPPORT_TICKET_ASSIGN, oldStatus.name(), ticket.getStatus().name(),
                "Phân công cho nhân viên " + targetStaff.getFullName() + " bởi Quản lý " + manager.getFullName());

        return mapToResponse(ticket);
    }

    @Override
    public SupportTicketResponse updateStatus(UUID id, TicketStatusUpdateRequest request) {
        UUID currentUserId = requestContext != null ? requestContext.currentUserId() : null;
        String currentUserRole = requestContext != null ? requestContext.currentUserRole() : null;

        assertOperationalHandlerRole(currentUserRole, "cập nhật tiến độ ticket");

        SupportTicket ticket = supportTicketRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.TICKET_NOT_FOUND));

        User currentUser = userRepository.findById(currentUserId)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        validateFacilityScope(ticket, currentUser);

        if (ticket.getStatus() == TicketStatus.CLOSED) {
            throw new AppException(ErrorCode.TICKET_ALREADY_CLOSED);
        }

        TicketStatus oldStatus = ticket.getStatus();
        TicketStatus targetStatus = null;
        if (request.getStatus() != null && !request.getStatus().isBlank()) {
            try {
                targetStatus = TicketStatus.valueOf(request.getStatus().trim().toUpperCase());
            } catch (IllegalArgumentException e) {
                throw new AppException(ErrorCode.TICKET_INVALID_STATUS_TRANSITION);
            }
        }

        // Validate transition
        if (targetStatus != null && targetStatus != oldStatus) {
            validateTransition(oldStatus, targetStatus, currentUserRole);
            ticket.setStatus(targetStatus);
            if (targetStatus == TicketStatus.RESOLVED) {
                ticket.setResolvedAt(LocalDateTime.now());
            } else if (targetStatus == TicketStatus.CLOSED) {
                ticket.setClosedAt(LocalDateTime.now());
            }
        }

        // Priority adjustment (only Facility Manager can change priority)
        if (request.getPriority() != null && !request.getPriority().isBlank()) {
            if (!"FACILITY_MANAGER".equalsIgnoreCase(currentUserRole)) {
                throw new AppException(ErrorCode.FORBIDDEN, "Chỉ Facility Manager mới có quyền điều chỉnh mức độ ưu tiên sự cố");
            }
            ticket.setPriority(request.getPriority().trim().toUpperCase());
            ticket.setSlaDueAt(calculateSlaDueAt(ticket.getCreatedAt(), ticket.getPriority()));
        }

        // Update resolution/progress notes
        if (request.getNote() != null && !request.getNote().isBlank()) {
            String timestamp = LocalDateTime.now().format(java.time.format.DateTimeFormatter.ofPattern("dd/MM HH:mm"));
            String noteEntry = String.format("[%s - %s]: %s", timestamp, currentUser.getFullName(), request.getNote().trim());
            if (ticket.getResolutionNote() != null && !ticket.getResolutionNote().isBlank()) {
                ticket.setResolutionNote(ticket.getResolutionNote() + "\n" + noteEntry);
            } else {
                ticket.setResolutionNote(noteEntry);
            }
        }

        // Append evidence urls if provided
        if (request.getEvidenceUrls() != null && !request.getEvidenceUrls().isEmpty()) {
            String combined = resolveImageEvidence(ticket.getImageEvidence(), request.getEvidenceUrls());
            ticket.setImageEvidence(combined);
        }

        ticket = supportTicketRepository.save(ticket);

        logActivity(ticket, ActivityAction.SUPPORT_TICKET_UPDATE, oldStatus.name(), ticket.getStatus().name(),
                "Cập nhật tiến độ: " + (request.getNote() != null ? request.getNote() : "Cập nhật thông tin xử lý"));

        return mapToResponse(ticket);
    }

    @Override
    public SupportTicketResponse resolveTicket(UUID id, String resolutionNote) {
        UUID currentUserId = requestContext != null ? requestContext.currentUserId() : null;
        String currentUserRole = requestContext != null ? requestContext.currentUserRole() : null;

        assertOperationalHandlerRole(currentUserRole, "xác nhận giải quyết sự cố");

        SupportTicket ticket = supportTicketRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.TICKET_NOT_FOUND));

        User currentUser = userRepository.findById(currentUserId)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        validateFacilityScope(ticket, currentUser);

        if (ticket.getStatus() == TicketStatus.CLOSED) {
            throw new AppException(ErrorCode.TICKET_ALREADY_CLOSED);
        }

        TicketStatus oldStatus = ticket.getStatus();
        ticket.setStatus(TicketStatus.RESOLVED);
        ticket.setResolvedAt(LocalDateTime.now());

        String note = (resolutionNote != null && !resolutionNote.isBlank())
                ? resolutionNote.trim()
                : "Đã xử lý xong hiện trường bởi nhân viên " + currentUser.getFullName();

        if (ticket.getResolutionNote() != null && !ticket.getResolutionNote().isBlank()) {
            ticket.setResolutionNote(ticket.getResolutionNote() + "\n[GIẢI QUYẾT XONG]: " + note);
        } else {
            ticket.setResolutionNote(note);
        }

        ticket = supportTicketRepository.save(ticket);

        logActivity(ticket, ActivityAction.SUPPORT_TICKET_RESOLVE, oldStatus.name(), TicketStatus.RESOLVED.name(),
                "Giải quyết hoàn tất: " + note);

        return mapToResponse(ticket);
    }

    @Override
    public SupportTicketResponse closeTicket(UUID id, String closingNote) {
        UUID currentUserId = requestContext != null ? requestContext.currentUserId() : null;
        String currentUserRole = requestContext != null ? requestContext.currentUserRole() : null;
        if ("BUSINESS_MANAGER".equalsIgnoreCase(currentUserRole) || "ADMIN".equalsIgnoreCase(currentUserRole)) {
            throw new AppException(ErrorCode.FORBIDDEN, "Role chỉ xem báo cáo, không được quyền đóng ticket");
        }
        if ("STAFF".equalsIgnoreCase(currentUserRole)) {
            throw new AppException(ErrorCode.FORBIDDEN, "Nhân viên không được tự ý đóng ticket. Việc đóng ticket cần sự xác nhận của Khách hàng hoặc Facility Manager.");
        }

        SupportTicket ticket = supportTicketRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.TICKET_NOT_FOUND));

        boolean isCustomer = "CUSTOMER".equalsIgnoreCase(currentUserRole);
        boolean isManager = "FACILITY_MANAGER".equalsIgnoreCase(currentUserRole);

        if (isCustomer) {
            if (ticket.getCustomer() == null || !ticket.getCustomer().getId().equals(currentUserId)) {
                throw new AppException(ErrorCode.FORBIDDEN, "Khách hàng không thể đóng ticket của người khác");
            }
        } else if (isManager) {
            User manager = userRepository.findById(currentUserId).orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
            validateFacilityScope(ticket, manager);
        }

        // Ticket must be in RESOLVED state to be closed
        if (ticket.getStatus() != TicketStatus.RESOLVED) {
            throw new AppException(ErrorCode.TICKET_INVALID_STATUS_TRANSITION,
                    "Chỉ có thể đóng ticket khi đã ở trạng thái ĐÃ XỬ LÝ (RESOLVED)");
        }

        TicketStatus oldStatus = ticket.getStatus();
        ticket.setStatus(TicketStatus.CLOSED);
        ticket.setClosedAt(LocalDateTime.now());

        String feedback = (closingNote != null && !closingNote.isBlank()) ? closingNote.trim() : "Xác nhận đóng hoàn tất";
        ticket.setResolutionNote(ticket.getResolutionNote() + "\n[ĐÓNG PHIẾU]: " + feedback);

        ticket = supportTicketRepository.save(ticket);

        logActivity(ticket, ActivityAction.SUPPORT_TICKET_CLOSE, oldStatus.name(), TicketStatus.CLOSED.name(),
                "Đóng phiếu sự cố: " + feedback);

        return mapToResponse(ticket);
    }

    @Override
    public SupportTicketResponse reopenTicket(UUID id, String reopenReason) {
        UUID currentUserId = requestContext != null ? requestContext.currentUserId() : null;
        String currentUserRole = requestContext != null ? requestContext.currentUserRole() : null;

        if ("BUSINESS_MANAGER".equalsIgnoreCase(currentUserRole) || "ADMIN".equalsIgnoreCase(currentUserRole) || "STAFF".equalsIgnoreCase(currentUserRole)) {
            throw new AppException(ErrorCode.FORBIDDEN, "Chỉ Khách hàng hoặc Facility Manager mới có quyền yêu cầu mở lại / xử lý lại ticket");
        }

        SupportTicket ticket = supportTicketRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.TICKET_NOT_FOUND));

        boolean isCustomer = "CUSTOMER".equalsIgnoreCase(currentUserRole);
        boolean isManager = "FACILITY_MANAGER".equalsIgnoreCase(currentUserRole);

        if (isCustomer) {
            if (ticket.getCustomer() == null || !ticket.getCustomer().getId().equals(currentUserId)) {
                throw new AppException(ErrorCode.FORBIDDEN);
            }
        } else if (isManager) {
            User manager = userRepository.findById(currentUserId).orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
            validateFacilityScope(ticket, manager);
        }

        // Ticket can only be reopened from RESOLVED or CLOSED
        if (ticket.getStatus() != TicketStatus.RESOLVED && ticket.getStatus() != TicketStatus.CLOSED) {
            throw new AppException(ErrorCode.TICKET_INVALID_STATUS_TRANSITION,
                    "Chỉ có thể mở lại ticket khi đang ở trạng thái RESOLVED hoặc CLOSED");
        }

        TicketStatus oldStatus = ticket.getStatus();
        ticket.setStatus(TicketStatus.REOPENED);
        // Extend SLA window by 12h for reopened investigation
        ticket.setSlaDueAt(LocalDateTime.now().plusHours(12));

        String reason = (reopenReason != null && !reopenReason.isBlank()) ? reopenReason.trim() : "Yêu cầu kiểm tra xử lý lại";
        ticket.setResolutionNote(ticket.getResolutionNote() + "\n[REOPEN YÊU CẦU XỬ LÝ LẠI]: " + reason);

        ticket = supportTicketRepository.save(ticket);

        logActivity(ticket, ActivityAction.SUPPORT_TICKET_REOPEN, oldStatus.name(), TicketStatus.REOPENED.name(),
                "Yêu cầu xử lý lại sự cố: " + reason);

        return mapToResponse(ticket);
    }

    @Override
    public SupportTicketContactLogResponse recordContactLog(UUID ticketId, SupportTicketContactLogRequest request) {
        UUID currentUserId = requestContext != null ? requestContext.currentUserId() : null;
        String currentUserRole = requestContext != null ? requestContext.currentUserRole() : null;

        if (!"FACILITY_MANAGER".equalsIgnoreCase(currentUserRole)) {
            log.warn("[SECURITY] Role {} attempted to record BOM contact log", currentUserRole);
            throw new AppException(ErrorCode.FORBIDDEN, "Chỉ Facility Manager mới có quyền ghi nhận nhật ký liên hệ hỗ trợ quản lý với BOM");
        }

        SupportTicket ticket = supportTicketRepository.findById(ticketId)
                .orElseThrow(() -> new AppException(ErrorCode.TICKET_NOT_FOUND));

        User manager = userRepository.findById(currentUserId)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        validateFacilityScope(ticket, manager);

        SupportTicketContactLog contactLog = SupportTicketContactLog.builder()
                .ticket(ticket)
                .contactMethod(request.getContactMethod())
                .contactedBy(manager)
                .targetRole("BUSINESS_MANAGER")
                .contactTarget(request.getContactTarget())
                .summary(request.getSummary())
                .result(request.getResult())
                .build();

        contactLog = contactLogRepository.save(contactLog);

        // Audit log (contact log does NOT change ticket status)
        logActivity(ticket, ActivityAction.SUPPORT_TICKET_CONTACT_BOM, null, null,
                "Facility Manager liên hệ BOM (" + request.getContactMethod() + ") tới " + request.getContactTarget() + ": " + request.getSummary());

        return mapToContactLogResponse(contactLog);
    }

    @Override
    @Transactional(readOnly = true)
    public List<SupportTicketContactLogResponse> getContactLogs(UUID ticketId) {
        SupportTicket ticket = supportTicketRepository.findById(ticketId)
                .orElseThrow(() -> new AppException(ErrorCode.TICKET_NOT_FOUND));

        validateViewPermission(ticket);

        return contactLogRepository.findByTicket_IdOrderByCreatedAtDesc(ticketId).stream()
                .map(this::mapToContactLogResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<EscalationContactResponse> getEscalationContacts() {
        return userRepository.findAllByRole_NameInAndIsActiveTrue(List.of("BUSINESS_MANAGER")).stream()
                .map(u -> EscalationContactResponse.builder()
                        .id(u.getId())
                        .fullName(u.getFullName())
                        .email(u.getEmail())
                        .phone(u.getPhone())
                        .role("BUSINESS_MANAGER")
                        .build())
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public SupportTicketStatsResponse getStats(UUID facilityId) {
        String currentUserRole = requestContext != null ? requestContext.currentUserRole() : null;
        UUID currentUserId = requestContext != null ? requestContext.currentUserId() : null;

        if (currentUserId == null) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }

        User currentUser = userRepository.findById(currentUserId).orElse(null);

        UUID targetFacilityId = facilityId;
        if ("STAFF".equalsIgnoreCase(currentUserRole) || "FACILITY_MANAGER".equalsIgnoreCase(currentUserRole)) {
            if (currentUser == null || currentUser.getFacility() == null) {
                throw new AppException(ErrorCode.FORBIDDEN, "Người dùng chưa được phân công cơ sở");
            }
            UUID assignedFacilityId = currentUser.getFacility().getId();
            if (facilityId != null && !facilityId.equals(assignedFacilityId)) {
                throw new AppException(ErrorCode.FORBIDDEN, "Người dùng không có quyền xem thống kê của cơ sở khác");
            }
            targetFacilityId = assignedFacilityId;
        }

        List<SupportTicket> list = targetFacilityId != null
                ? supportTicketRepository.findByFacility_Id(targetFacilityId)
                : supportTicketRepository.findAll();

        long total = list.size();
        long open = list.stream().filter(t -> t.getStatus() == TicketStatus.OPEN).count();
        long inProgress = list.stream().filter(t -> t.getStatus() == TicketStatus.IN_PROGRESS).count();
        long resolved = list.stream().filter(t -> t.getStatus() == TicketStatus.RESOLVED).count();
        long closed = list.stream().filter(t -> t.getStatus() == TicketStatus.CLOSED).count();
        long reopened = list.stream().filter(t -> t.getStatus() == TicketStatus.REOPENED).count();

        LocalDateTime now = LocalDateTime.now();
        long overdue = list.stream().filter(t -> {
            boolean isResolvedOrClosed = t.getStatus() == TicketStatus.RESOLVED || t.getStatus() == TicketStatus.CLOSED;
            return !isResolvedOrClosed && t.getSlaDueAt() != null && now.isAfter(t.getSlaDueAt());
        }).count();

        double slaCompliance = (total > 0) ? Math.max(0, Math.min(100.0, ((double) (total - overdue) / total) * 100.0)) : 100.0;

        double avgResolutionMinutes = list.stream()
                .filter(t -> t.getCreatedAt() != null && t.getResolvedAt() != null
                        && !t.getResolvedAt().isBefore(t.getCreatedAt()))
                .mapToLong(t -> java.time.Duration.between(t.getCreatedAt(), t.getResolvedAt()).toMinutes())
                .average()
                .orElse(0.0);

        Map<String, Long> countByFacility = list.stream()
                .filter(t -> t.getFacility() != null)
                .collect(Collectors.groupingBy(t -> t.getFacility().getName(), Collectors.counting()));

        Map<String, Long> countByCategory = list.stream()
                .filter(t -> t.getCategory() != null)
                .collect(Collectors.groupingBy(t -> t.getCategory().name(), Collectors.counting()));

        Map<String, Long> countByPriority = list.stream()
                .filter(t -> t.getPriority() != null)
                .collect(Collectors.groupingBy(SupportTicket::getPriority, Collectors.counting()));

        return SupportTicketStatsResponse.builder()
                .totalTickets(total)
                .openTickets(open)
                .inProgressTickets(inProgress)
                .resolvedTickets(resolved)
                .closedTickets(closed)
                .reopenedTickets(reopened)
                .overdueTickets(overdue)
                .slaCompliancePercent(Math.round(slaCompliance * 10.0) / 10.0)
                .avgResolutionMinutes(Math.round(avgResolutionMinutes * 10.0) / 10.0)
                .countByFacility(countByFacility)
                .countByCategory(countByCategory)
                .countByPriority(countByPriority)
                .build();
    }

    // =========================================================================
    // PRIVATE HELPERS & PERMISSION VALIDATORS
    // =========================================================================

    private void assertOperationalHandlerRole(String role, String actionDesc) {
        if ("BUSINESS_MANAGER".equalsIgnoreCase(role)) {
            throw new AppException(ErrorCode.FORBIDDEN, "Business Operations Manager chỉ có quyền xem báo cáo, không được " + actionDesc);
        }
        if ("ADMIN".equalsIgnoreCase(role)) {
            throw new AppException(ErrorCode.FORBIDDEN, "System Administrator chỉ có quyền xem báo cáo kiểm tra hệ thống, không được " + actionDesc);
        }
        if ("CUSTOMER".equalsIgnoreCase(role)) {
            throw new AppException(ErrorCode.FORBIDDEN, "Khách hàng không có quyền thực hiện thao tác nội bộ này");
        }
        if (!"STAFF".equalsIgnoreCase(role) && !"FACILITY_MANAGER".equalsIgnoreCase(role)) {
            throw new AppException(ErrorCode.FORBIDDEN);
        }
    }

    private void validateFacilityScope(SupportTicket ticket, User user) {
        if (ticket.getFacility() == null || user.getFacility() == null) {
            throw new AppException(ErrorCode.FACILITY_ACCESS_DENIED);
        }
        if (!ticket.getFacility().getId().equals(user.getFacility().getId())) {
            log.warn("[SECURITY] User {} (facility {}) attempted operation on ticket {} in facility {}",
                    user.getId(), user.getFacility().getId(), ticket.getId(), ticket.getFacility().getId());
            throw new AppException(ErrorCode.TICKET_FACILITY_MISMATCH);
        }
    }

    private void validateViewPermission(SupportTicket ticket) {
        UUID currentUserId = requestContext != null ? requestContext.currentUserId() : null;
        String currentUserRole = requestContext != null ? requestContext.currentUserRole() : null;

        if ("ADMIN".equalsIgnoreCase(currentUserRole) || "BUSINESS_MANAGER".equalsIgnoreCase(currentUserRole)) {
            return; // Read-only system-wide
        }

        if ("CUSTOMER".equalsIgnoreCase(currentUserRole)) {
            if (ticket.getCustomer() == null || !ticket.getCustomer().getId().equals(currentUserId)) {
                throw new AppException(ErrorCode.TICKET_NOT_FOUND);
            }
            return;
        }

        User currentUser = currentUserId != null ? userRepository.findById(currentUserId).orElse(null) : null;
        if (currentUser == null || currentUser.getFacility() == null || ticket.getFacility() == null) {
            throw new AppException(ErrorCode.FACILITY_ACCESS_DENIED);
        }
        if (!ticket.getFacility().getId().equals(currentUser.getFacility().getId())) {
            throw new AppException(ErrorCode.TICKET_FACILITY_MISMATCH);
        }
    }

    private void validateTransition(TicketStatus current, TicketStatus target, String role) {
        if ("STAFF".equalsIgnoreCase(role)) {
            // Staff can transition OPEN/REOPENED -> IN_PROGRESS -> RESOLVED
            if (target == TicketStatus.CLOSED) {
                throw new AppException(ErrorCode.FORBIDDEN, "Nhân viên không có quyền tự đóng ticket khi chưa có xác nhận từ khách hàng hoặc quản lý");
            }
        }
    }

    private LocalDateTime calculateSlaDueAt(LocalDateTime baseTime, String priority) {
        if (baseTime == null) baseTime = LocalDateTime.now();
        if ("URGENT".equalsIgnoreCase(priority)) {
            return baseTime.plusHours(2);
        } else if ("HIGH".equalsIgnoreCase(priority)) {
            return baseTime.plusHours(6);
        } else if ("LOW".equalsIgnoreCase(priority)) {
            return baseTime.plusHours(48);
        }
        return baseTime.plusHours(24); // MEDIUM default
    }

    private void logActivity(SupportTicket ticket, ActivityAction action, String oldValue, String newValue, String description) {
        try {
            UUID currentUserId = requestContext != null ? requestContext.currentUserId() : null;
            User user = currentUserId != null ? userRepository.findById(currentUserId).orElse(null) : null;

            ActivityLog logEntry = ActivityLog.builder()
                    .user(user)
                    .facility(ticket.getFacility())
                    .logType(ActivityLogType.DATA_ACTION)
                    .action(action)
                    .resourceType("SUPPORT_TICKET")
                    .resourceId(ticket.getId())
                    .oldValue(oldValue)
                    .newValue(newValue)
                    .description(description)
                    .status(ActivityLogStatus.SUCCESS)
                    .build();

            activityLogRepository.save(logEntry);
        } catch (Exception ex) {
            log.warn("Failed to write activity audit log for ticket {}: {}", ticket.getId(), ex.getMessage());
        }
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

        boolean isResolvedOrClosed = t.getStatus() == TicketStatus.RESOLVED || t.getStatus() == TicketStatus.CLOSED;
        boolean isOverdue = !isResolvedOrClosed && t.getSlaDueAt() != null && LocalDateTime.now().isAfter(t.getSlaDueAt());

        String unitCodeDisplay = "Chung";
        UUID storageUnitId = null;
        if (t.getStorageUnit() != null) {
            unitCodeDisplay = t.getStorageUnit().getUnitCode();
            storageUnitId = t.getStorageUnit().getId();
        } else if (t.getBooking() != null && t.getBooking().getStorageUnit() != null) {
            unitCodeDisplay = t.getBooking().getStorageUnit().getUnitCode();
            storageUnitId = t.getBooking().getStorageUnit().getId();
        }

        String staffName = t.getCreatedByStaff() != null ? t.getCreatedByStaff().getFullName() : null;
        String staffRole = (t.getCreatedByStaff() != null && t.getCreatedByStaff().getRole() != null)
                ? t.getCreatedByStaff().getRole().getName()
                : null;

        return SupportTicketResponse.builder()
                .id(t.getId())
                .ticketCode(t.getTicketCode())
                .customerId(t.getCustomer() != null ? t.getCustomer().getId() : null)
                .customerName(t.getCustomer() != null ? t.getCustomer().getFullName() : "Khách hàng Boxora")
                .customerPhone(t.getCustomer() != null ? t.getCustomer().getPhone() : "")
                .bookingId(t.getBooking() != null ? t.getBooking().getId() : null)
                .unitCode(t.getBooking() != null && t.getBooking().getStorageUnit() != null
                        ? t.getBooking().getStorageUnit().getUnitCode()
                        : "Chung")
                .facilityId(t.getFacility() != null ? t.getFacility().getId() : null)
                .facilityName(t.getFacility() != null ? t.getFacility().getName() : "Boxora Facility")
                .facilityCode(t.getFacility() != null ? t.getFacility().getCode() : "BOXORA")
                .assignedStaffId(t.getAssignedStaff() != null ? t.getAssignedStaff().getId() : null)
                .assignedStaffName(t.getAssignedStaff() != null ? t.getAssignedStaff().getFullName() : null)
                .assignedStaffPhone(t.getAssignedStaff() != null ? t.getAssignedStaff().getPhone() : null)
                .createdByStaffId(t.getCreatedByStaff() != null ? t.getCreatedByStaff().getId() : null)
                .createdByStaffName(staffName)
                .createdByStaffRole(staffRole)
                .isStaffRecorded(Boolean.TRUE.equals(t.getIsStaffRecorded()))
                .category(t.getCategory() != null ? t.getCategory().name() : null)
                .title(t.getTitle())
                .description(t.getDescription())
                .status(t.getStatus() != null ? t.getStatus().name() : TicketStatus.OPEN.name())
                .priority(t.getPriority() != null ? t.getPriority() : "MEDIUM")
                .imageEvidence(t.getImageEvidence())
                .evidenceUrls(evidenceUrls)
                .resolutionNote(t.getResolutionNote())
                .slaDueAt(t.getSlaDueAt())
                .isOverdue(isOverdue)
                .resolvedAt(t.getResolvedAt())
                .closedAt(t.getClosedAt())
                .createdAt(t.getCreatedAt())
                .build();
    }

    private SupportTicketContactLogResponse mapToContactLogResponse(SupportTicketContactLog log) {
        return SupportTicketContactLogResponse.builder()
                .id(log.getId())
                .ticketId(log.getTicket().getId())
                .ticketCode(log.getTicket().getTicketCode())
                .contactMethod(log.getContactMethod())
                .contactedById(log.getContactedBy().getId())
                .contactedByName(log.getContactedBy().getFullName())
                .targetRole(log.getTargetRole())
                .contactTarget(log.getContactTarget())
                .summary(log.getSummary())
                .result(log.getResult())
                .createdAt(log.getCreatedAt())
                .build();
    }
}

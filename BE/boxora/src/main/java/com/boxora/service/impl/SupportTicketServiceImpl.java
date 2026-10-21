package com.boxora.service.impl;

import com.boxora.dto.request.SupportTicketContactLogRequest;
import com.boxora.dto.request.SupportTicketRequest;
import com.boxora.dto.request.TicketAssignRequest;
import com.boxora.dto.request.TicketStatusUpdateRequest;
import com.boxora.dto.response.EscalationContactResponse;
import com.boxora.dto.response.FileUploadResponse;
import com.boxora.dto.response.SupportTicketContactLogResponse;
import com.boxora.dto.response.SupportTicketResponse;
import com.boxora.dto.response.SupportTicketStatsResponse;
import com.boxora.entity.ActivityLog;
import com.boxora.entity.Booking;
import com.boxora.entity.Facility;
import com.boxora.entity.NotificationLog;
import com.boxora.entity.SupportTicket;
import com.boxora.entity.SupportTicketContactLog;
import com.boxora.entity.User;
import com.boxora.enums.ActivityAction;
import com.boxora.enums.ActivityLogStatus;
import com.boxora.enums.ActivityLogType;
import com.boxora.enums.NotificationChannel;
import com.boxora.enums.NotificationType;
import com.boxora.enums.TicketCategory;
import com.boxora.enums.TicketStatus;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.repository.ActivityLogRepository;
import com.boxora.repository.BookingRepository;
import com.boxora.repository.FacilityRepository;
import com.boxora.repository.NotificationLogRepository;
import com.boxora.repository.SupportTicketContactLogRepository;
import com.boxora.repository.SupportTicketRepository;
import com.boxora.repository.UserRepository;
import com.boxora.security.RequestContext;
import com.boxora.service.FileStorageService;
import com.boxora.service.SupportTicketService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ThreadLocalRandom;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class SupportTicketServiceImpl implements SupportTicketService {

    private static final Set<String> PRIORITIES = Set.of("LOW", "MEDIUM", "HIGH", "URGENT");
    private static final int MAX_EVIDENCE_FILES = 10;
    private static final Set<String> CONTACT_TARGET_ROLES = Set.of("BUSINESS_MANAGER", "ADMIN");
    private static final java.time.format.DateTimeFormatter NOTE_TIME = java.time.format.DateTimeFormatter.ofPattern("dd/MM HH:mm");

    private final SupportTicketRepository supportTicketRepository;
    private final SupportTicketContactLogRepository contactLogRepository;
    private final UserRepository userRepository;
    private final BookingRepository bookingRepository;
    private final FacilityRepository facilityRepository;
    private final ActivityLogRepository activityLogRepository;
    private final FileStorageService fileStorageService;
    private final RequestContext requestContext;
    private final NotificationLogRepository notificationLogRepository;

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
                    .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND, "Không tìm thấy đơn đặt kho đã chọn"));

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
        }

        // If facility not resolved from booking, attempt to resolve from request or user
        if (facility == null && request.getFacilityId() != null) {
            facility = facilityRepository.findById(request.getFacilityId())
                    .orElseThrow(() -> new AppException(ErrorCode.FACILITY_NOT_FOUND, "Không tìm thấy cơ sở đã chọn"));
        }
        if (facility == null && isStaffOrManager && currentStaffOrManager != null) {
            facility = currentStaffOrManager.getFacility();
        }
        if (facility == null && !isStaffOrManager) {
            // "Not about a specific unit": route to the facility of the customer's latest booking.
            facility = bookingRepository.findFirstByCustomer_IdOrderByCreatedAtDesc(customer.getId())
                    .map(Booking::getStorageUnit)
                    .map(unit -> unit.getFacility())
                    .orElse(null);
        }
        if (facility == null) {
            // A ticket nobody's facility owns could never be worked, so ask instead of guessing a facility.
            throw new AppException(ErrorCode.TICKET_FACILITY_REQUIRED);
        }

        // Staff and facility managers can only create tickets within their assigned facility
        if (isStaffOrManager && currentStaffOrManager != null && currentStaffOrManager.getFacility() != null) {
            if (!facility.getId().equals(currentStaffOrManager.getFacility().getId())) {
                log.warn("[SECURITY] {} {} attempted to create ticket for non-assigned facility {}", currentUserRole, currentUserId, facility.getId());
                throw new AppException(ErrorCode.TICKET_FACILITY_MISMATCH);
            }
        }

        String ticketCode = generateUniqueTicketCode();

        TicketCategory category = parseCategory(request.getCategory());

        String priority = normalizePriority(request.getPriority());

        // Calculate SLA due timestamp
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime slaDueAt = calculateSlaDueAt(now, priority);

        String combinedEvidence = resolveImageEvidence(request.getImageEvidence(), request.getEvidenceUrls());
        requireUploadedEvidence(combinedEvidence);

        SupportTicket ticket = SupportTicket.builder()
                .ticketCode(ticketCode)
                .customer(customer)
                .booking(booking)
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

        log.info("Created support ticket {} for customer {} at facility {}", ticketCode, customer.getId(), facility.getCode());
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

        List<SupportTicket> rawList = loadScopedTickets(currentUserId, currentUserRole, facilityId);
        return mapAll(filterAndSort(rawList, status, category, priority));
    }

    /**
     * The tickets a role may see: customers their own, staff their facility's queue plus what is assigned to them,
     * facility managers their facility, BOM / admin everything (optionally narrowed to one facility).
     */
    private List<SupportTicket> loadScopedTickets(UUID currentUserId, String currentUserRole, UUID facilityId) {
        User currentUser = userRepository.findById(currentUserId).orElse(null);

        if ("CUSTOMER".equalsIgnoreCase(currentUserRole)) {
            // Customer only sees own tickets
            return supportTicketRepository.findByCustomer_Id(currentUserId);
        } else if ("STAFF".equalsIgnoreCase(currentUserRole)) {
            // Staff only sees tickets in their assigned facility or assigned to them
            if (currentUser == null || currentUser.getFacility() == null) {
                if (facilityId != null) {
                    throw new AppException(ErrorCode.FORBIDDEN, "Nhân viên chưa được phân công cơ sở");
                }
                return supportTicketRepository.findByAssignedStaff_Id(currentUserId);
            }
            if (facilityId != null && !facilityId.equals(currentUser.getFacility().getId())) {
                log.warn("[SECURITY] Staff {} attempted to access tickets of facility {}", currentUserId, facilityId);
                throw new AppException(ErrorCode.FORBIDDEN, "Nhân viên không có quyền truy cập dữ liệu của cơ sở khác");
            }
            return supportTicketRepository.findByFacility_IdOrAssignedStaff_Id(currentUser.getFacility().getId(), currentUserId);
        } else if ("FACILITY_MANAGER".equalsIgnoreCase(currentUserRole)) {
            // Facility manager only sees tickets in their facility
            if (currentUser == null || currentUser.getFacility() == null) {
                if (facilityId != null) {
                    throw new AppException(ErrorCode.FORBIDDEN, "Quản lý cơ sở chưa được phân công cơ sở");
                }
                return Collections.emptyList();
            }
            if (facilityId != null && !facilityId.equals(currentUser.getFacility().getId())) {
                log.warn("[SECURITY] Facility Manager {} attempted to access tickets of facility {}", currentUserId, facilityId);
                throw new AppException(ErrorCode.FORBIDDEN, "Quản lý cơ sở không có quyền truy cập dữ liệu của cơ sở khác");
            }
            return supportTicketRepository.findByFacility_Id(currentUser.getFacility().getId());
        } else if ("BUSINESS_MANAGER".equalsIgnoreCase(currentUserRole) || "ADMIN".equalsIgnoreCase(currentUserRole)) {
            // BOM & Admin: system-wide view with optional facility filter
            return facilityId != null
                    ? supportTicketRepository.findByFacility_Id(facilityId)
                    : supportTicketRepository.findAll();
        }
        return Collections.emptyList();
    }

    private List<SupportTicket> filterAndSort(List<SupportTicket> rawList, String status, String category, String priority) {
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
                .sorted(NEWEST_FIRST)
                .collect(Collectors.toList());
    }

    private static final Comparator<SupportTicket> NEWEST_FIRST = (t1, t2) -> {
        if (t1.getCreatedAt() != null && t2.getCreatedAt() != null) {
            return t2.getCreatedAt().compareTo(t1.getCreatedAt());
        }
        return 0;
    };

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
        if (currentUserId == null) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }

        boolean isCustomer = !("STAFF".equalsIgnoreCase(currentUserRole)
                || "FACILITY_MANAGER".equalsIgnoreCase(currentUserRole)
                || "BUSINESS_MANAGER".equalsIgnoreCase(currentUserRole)
                || "ADMIN".equalsIgnoreCase(currentUserRole));

        if (isCustomer) {
            if (customerId != null && !customerId.equals(currentUserId)) {
                log.warn("[SECURITY] Customer {} attempted to view tickets of {}", currentUserId, customerId);
                throw new AppException(ErrorCode.FORBIDDEN);
            }
            return mapAll(supportTicketRepository.findByCustomer_Id(currentUserId).stream()
                    .sorted(NEWEST_FIRST).collect(Collectors.toList()));
        }

        // Staff roles get the same scope as the queue (their facility, or everything for BOM / admin),
        // optionally narrowed to one customer. They no longer receive every ticket in the system.
        List<SupportTicket> scoped = loadScopedTickets(currentUserId, currentUserRole, null);
        if (customerId != null) {
            scoped = scoped.stream()
                    .filter(t -> t.getCustomer() != null && customerId.equals(t.getCustomer().getId()))
                    .collect(Collectors.toList());
        }
        return mapAll(scoped.stream().sorted(NEWEST_FIRST).collect(Collectors.toList()));
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
        if (ticket.getStatus() == TicketStatus.RESOLVED) {
            throw new AppException(ErrorCode.TICKET_INVALID_STATUS_TRANSITION,
                    "Phiếu đã xử lý xong, không cần nhận xử lý. Khách hoặc quản lý cơ sở có thể mở lại nếu sự cố chưa triệt để");
        }

        // A colleague's ticket is never taken silently: staff must ask the facility manager to reassign it.
        boolean assignedToSomeoneElse = ticket.getAssignedStaff() != null
                && !ticket.getAssignedStaff().getId().equals(currentUser.getId());
        if (assignedToSomeoneElse && !"FACILITY_MANAGER".equalsIgnoreCase(currentUserRole)) {
            throw new AppException(ErrorCode.TICKET_ALREADY_TAKEN,
                    "Phiếu đã được " + displayName(ticket.getAssignedStaff()) + " nhận xử lý. Nhờ quản lý cơ sở phân công lại nếu cần");
        }
        if (!assignedToSomeoneElse && ticket.getAssignedStaff() != null && ticket.getStatus() == TicketStatus.IN_PROGRESS) {
            return mapToResponse(ticket); // already yours: taking it twice changes nothing
        }

        TicketStatus oldStatus = ticket.getStatus();
        ticket.setAssignedStaff(currentUser);
        ticket.setStatus(TicketStatus.IN_PROGRESS);
        ticket = supportTicketRepository.save(ticket);

        logActivity(ticket, ActivityAction.SUPPORT_TICKET_ASSIGN, oldStatus.name(), ticket.getStatus().name(),
                currentUser.getFullName() + " đã tiếp nhận xử lý ticket tại cơ sở");
        notifyCustomerOfProgress(ticket, oldStatus);

        return mapToResponse(ticket);
    }

    @Override
    public SupportTicketResponse assignTicket(UUID id, UUID staffId) {
        return assignTicket(id, TicketAssignRequest.builder().staffId(staffId).build());
    }

    @Override
    public SupportTicketResponse assignTicket(UUID id, TicketAssignRequest request) {
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

        User targetStaff = userRepository.findById(request.getStaffId())
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        // Verify target user is active staff in the same facility
        if (targetStaff.getRole() == null || !"STAFF".equalsIgnoreCase(targetStaff.getRole().getName())) {
            throw new AppException(ErrorCode.TICKET_STAFF_NOT_IN_FACILITY, "Người được phân công phải là nhân viên vận hành (STAFF)");
        }
        if (ticket.getFacility() != null && targetStaff.getFacility() != null
                && !ticket.getFacility().getId().equals(targetStaff.getFacility().getId())) {
            throw new AppException(ErrorCode.TICKET_STAFF_NOT_IN_FACILITY, "Nhân viên không thuộc cơ sở xảy ra sự cố");
        }

        String newPriority = request.getPriority() != null && !request.getPriority().isBlank()
                ? normalizePriority(request.getPriority()) : null;

        TicketStatus oldStatus = ticket.getStatus();
        String oldPriority = ticket.getPriority();
        ticket.setAssignedStaff(targetStaff);
        if (ticket.getStatus() == TicketStatus.OPEN || ticket.getStatus() == TicketStatus.REOPENED) {
            ticket.setStatus(TicketStatus.IN_PROGRESS);
        }
        boolean priorityChanged = newPriority != null && !newPriority.equalsIgnoreCase(oldPriority);
        if (priorityChanged) {
            ticket.setPriority(newPriority);
            ticket.setSlaDueAt(recalculateSlaDueAt(ticket, oldStatus));
        }
        if (request.getNotes() != null && !request.getNotes().isBlank()) {
            appendNote(ticket, manager.getFullName(), "Chỉ đạo phân công: " + request.getNotes().trim());
        }
        ticket = supportTicketRepository.save(ticket);

        logActivity(ticket, ActivityAction.SUPPORT_TICKET_ASSIGN, oldStatus.name(), ticket.getStatus().name(),
                "Phân công cho nhân viên " + targetStaff.getFullName() + " bởi Quản lý " + manager.getFullName()
                        + (priorityChanged ? ". Đổi mức ưu tiên " + oldPriority + " -> " + newPriority : ""));
        notifyCustomerOfProgress(ticket, oldStatus);

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

        // Staff move only their own tickets. The one exception is claiming a free ticket (OPEN / REOPENED -> IN_PROGRESS),
        // which is the same thing as "take".
        boolean claimsFreeTicket = targetStatus == TicketStatus.IN_PROGRESS && ticket.getAssignedStaff() == null
                && (oldStatus == TicketStatus.OPEN || oldStatus == TicketStatus.REOPENED);
        if (claimsFreeTicket) {
            ticket.setAssignedStaff(currentUser);
        } else {
            requireHandler(ticket, currentUser, currentUserRole);
        }

        // Validate transition
        if (targetStatus != null && targetStatus != oldStatus) {
            validateTransition(oldStatus, targetStatus, currentUserRole);
            if (targetStatus == TicketStatus.RESOLVED && (request.getNote() == null || request.getNote().isBlank())) {
                throw new AppException(ErrorCode.TICKET_RESOLUTION_NOTE_REQUIRED);
            }
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
            ticket.setPriority(normalizePriority(request.getPriority()));
            ticket.setSlaDueAt(recalculateSlaDueAt(ticket, oldStatus));
        }

        // Update resolution/progress notes
        if (request.getNote() != null && !request.getNote().isBlank()) {
            appendNote(ticket, currentUser.getFullName(), request.getNote().trim());
        }

        // Append evidence urls if provided (only files this user uploaded)
        if (request.getEvidenceUrls() != null && !request.getEvidenceUrls().isEmpty()) {
            requireUploadedEvidence(resolveImageEvidence(null, request.getEvidenceUrls()));
            String combined = resolveImageEvidence(ticket.getImageEvidence(), request.getEvidenceUrls());
            ticket.setImageEvidence(combined);
        }

        ticket = supportTicketRepository.save(ticket);

        logActivity(ticket, ActivityAction.SUPPORT_TICKET_UPDATE, oldStatus.name(), ticket.getStatus().name(),
                "Cập nhật tiến độ: " + (request.getNote() != null ? request.getNote() : "Cập nhật thông tin xử lý"));
        notifyCustomerOfProgress(ticket, oldStatus);

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
        // Only a ticket somebody is working on can be resolved, and only by that person (or the facility manager).
        requireHandler(ticket, currentUser, currentUserRole);
        if (ticket.getStatus() != TicketStatus.IN_PROGRESS) {
            throw new AppException(ErrorCode.TICKET_NOT_IN_PROGRESS);
        }
        if (resolutionNote == null || resolutionNote.isBlank()) {
            throw new AppException(ErrorCode.TICKET_RESOLUTION_NOTE_REQUIRED);
        }

        TicketStatus oldStatus = ticket.getStatus();
        ticket.setStatus(TicketStatus.RESOLVED);
        ticket.setResolvedAt(LocalDateTime.now());

        String note = resolutionNote.trim();

        appendNote(ticket, currentUser.getFullName(), "Hoàn tất xử lý: " + note);

        ticket = supportTicketRepository.save(ticket);

        logActivity(ticket, ActivityAction.SUPPORT_TICKET_RESOLVE, oldStatus.name(), TicketStatus.RESOLVED.name(),
                "Giải quyết hoàn tất: " + note);
        notifyCustomerOfProgress(ticket, oldStatus);

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

        String closerName = null;
        if (isCustomer) {
            if (ticket.getCustomer() == null || !ticket.getCustomer().getId().equals(currentUserId)) {
                throw new AppException(ErrorCode.FORBIDDEN, "Khách hàng không thể đóng ticket của người khác");
            }
            closerName = ticket.getCustomer().getFullName();
        } else if (isManager) {
            User manager = userRepository.findById(currentUserId).orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
            validateFacilityScope(ticket, manager);
            closerName = manager.getFullName();
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
        appendNote(ticket, closerName, "Đóng phiếu: " + feedback);

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
        // Extend SLA window by 12h for reopened investigation; the ticket is open again, so it has no result time yet.
        ticket.setSlaDueAt(LocalDateTime.now().plusHours(12));
        ticket.setResolvedAt(null);
        ticket.setClosedAt(null);

        String reason = (reopenReason != null && !reopenReason.isBlank()) ? reopenReason.trim() : "Yêu cầu kiểm tra xử lý lại";
        ticket.setReopenCount((ticket.getReopenCount() != null ? ticket.getReopenCount() : 0) + 1);
        ticket.setReopenReason(reason);

        ticket = supportTicketRepository.save(ticket);

        logActivity(ticket, ActivityAction.SUPPORT_TICKET_REOPEN, oldStatus.name(), TicketStatus.REOPENED.name(),
                "Yêu cầu xử lý lại sự cố (lần " + ticket.getReopenCount() + "): " + reason);

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
                .targetRole(normalizeContactTargetRole(request.getTargetRole()))
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

    /** BUSINESS_OPERATIONS_MANAGER is the old name of the business manager role. */
    private String normalizeContactTargetRole(String role) {
        if (role == null || role.isBlank()) {
            return "BUSINESS_MANAGER";
        }
        String value = role.trim().toUpperCase();
        if ("BUSINESS_OPERATIONS_MANAGER".equals(value)) {
            return "BUSINESS_MANAGER";
        }
        if (!CONTACT_TARGET_ROLES.contains(value)) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Vai trò người được liên hệ chỉ có thể là quản lý vận hành (BUSINESS_MANAGER) hoặc quản trị viên (ADMIN)");
        }
        return value;
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
        if ("STAFF".equalsIgnoreCase(currentUserRole)) {
            if (currentUser != null && currentUser.getFacility() != null) {
                if (facilityId != null && !facilityId.equals(currentUser.getFacility().getId())) {
                    throw new AppException(ErrorCode.FORBIDDEN, "Nhân viên không có quyền xem thống kê của cơ sở khác");
                }
                targetFacilityId = currentUser.getFacility().getId();
            } else if (facilityId != null) {
                throw new AppException(ErrorCode.FORBIDDEN, "Nhân viên chưa được phân công cơ sở");
            }
        } else if ("FACILITY_MANAGER".equalsIgnoreCase(currentUserRole)) {
            if (currentUser != null && currentUser.getFacility() != null) {
                if (facilityId != null && !facilityId.equals(currentUser.getFacility().getId())) {
                    throw new AppException(ErrorCode.FORBIDDEN, "Quản lý cơ sở không có quyền xem thống kê của cơ sở khác");
                }
                targetFacilityId = currentUser.getFacility().getId();
            } else if (facilityId != null) {
                throw new AppException(ErrorCode.FORBIDDEN, "Quản lý cơ sở chưa được phân công cơ sở");
            }
        }

        List<SupportTicket> list = (targetFacilityId != null)
                ? supportTicketRepository.findByFacility_Id(targetFacilityId)
                : supportTicketRepository.findAll();

        long total = list.size();
        long open = list.stream().filter(t -> t.getStatus() == TicketStatus.OPEN).count();
        long inProgress = list.stream().filter(t -> t.getStatus() == TicketStatus.IN_PROGRESS).count();
        long resolved = list.stream().filter(t -> t.getStatus() == TicketStatus.RESOLVED).count();
        long closed = list.stream().filter(t -> t.getStatus() == TicketStatus.CLOSED).count();
        long reopened = list.stream().filter(t -> t.getStatus() == TicketStatus.REOPENED).count();

        LocalDateTime now = LocalDateTime.now();

        // Open tickets already past their SLA.
        long overdue = list.stream().filter(t -> !isFinished(t) && t.getSlaDueAt() != null && now.isAfter(t.getSlaDueAt())).count();

        // Finished tickets: late when the result time is after the SLA deadline.
        long resolvedLate = list.stream()
                .filter(t -> isFinished(t) && t.getResolvedAt() != null && t.getSlaDueAt() != null && t.getResolvedAt().isAfter(t.getSlaDueAt()))
                .count();
        long resolvedOnTime = list.stream().filter(this::isFinished).count() - resolvedLate;

        // SLA compliance covers every ticket: resolved late and open-but-overdue both count against it.
        Double slaCompliance = total > 0
                ? Math.round(((double) (total - overdue - resolvedLate) / total) * 1000.0) / 10.0
                : null;

        // Average time from creation to the result, over tickets that really were resolved.
        OptionalDouble avgMinutes = list.stream()
                .filter(t -> isFinished(t) && t.getResolvedAt() != null && t.getCreatedAt() != null)
                .mapToLong(t -> Math.max(0, Duration.between(t.getCreatedAt(), t.getResolvedAt()).toMinutes()))
                .average();
        Double avgResolutionMinutes = avgMinutes.isPresent() ? Math.round(avgMinutes.getAsDouble() * 10.0) / 10.0 : null;

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
                .resolvedOnTimeTickets(Math.max(0, resolvedOnTime))
                .resolvedLateTickets(resolvedLate)
                .slaCompliancePercent(slaCompliance)
                .avgResolutionMinutes(avgResolutionMinutes)
                .countByFacility(countByFacility)
                .countByCategory(countByCategory)
                .countByPriority(countByPriority)
                .build();
    }

    private boolean isFinished(SupportTicket t) {
        return t.getStatus() == TicketStatus.RESOLVED || t.getStatus() == TicketStatus.CLOSED;
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

    /**
     * Staff and facility managers only touch tickets of the facility they are assigned to. Fails closed: an account with
     * no facility, or a ticket with none, is refused instead of waved through.
     */
    private void validateFacilityScope(SupportTicket ticket, User user) {
        if (ticket.getFacility() == null || user.getFacility() == null) {
            log.warn("[SECURITY] User {} attempted operation on ticket {} without a facility scope (user facility: {}, ticket facility: {})",
                    user.getId(), ticket.getId(), user.getFacility() != null, ticket.getFacility() != null);
            throw new AppException(ErrorCode.TICKET_FACILITY_MISMATCH);
        }
        if (!ticket.getFacility().getId().equals(user.getFacility().getId())) {
            log.warn("[SECURITY] User {} (facility {}) attempted operation on ticket {} in facility {}",
                    user.getId(), user.getFacility().getId(), ticket.getId(), ticket.getFacility().getId());
            throw new AppException(ErrorCode.TICKET_FACILITY_MISMATCH);
        }
    }

    /**
     * Who may change an assigned ticket: its assignee, or the manager of its facility (the facility scope is checked
     * separately). Staff cannot touch a ticket nobody has taken yet or one a colleague works on.
     */
    private void requireHandler(SupportTicket ticket, User user, String role) {
        if ("FACILITY_MANAGER".equalsIgnoreCase(role)) {
            return;
        }
        User assignee = ticket.getAssignedStaff();
        if (assignee == null) {
            throw new AppException(ErrorCode.TICKET_NOT_ASSIGNED_TO_YOU, "Hãy nhận xử lý phiếu này trước khi cập nhật");
        }
        if (!assignee.getId().equals(user.getId())) {
            log.warn("[SECURITY] Staff {} attempted to change ticket {} assigned to {}", user.getId(), ticket.getId(), assignee.getId());
            throw new AppException(ErrorCode.TICKET_NOT_ASSIGNED_TO_YOU,
                    "Phiếu này đang do " + displayName(assignee) + " phụ trách. Chỉ người được phân công hoặc quản lý cơ sở mới xử lý được");
        }
    }

    private static String displayName(User user) {
        return user != null && user.getFullName() != null && !user.getFullName().isBlank() ? user.getFullName() : "nhân viên khác";
    }

    /** The category must be one of the known TicketCategory values (the legacy aliases the UI used to send are not accepted). */
    private TicketCategory parseCategory(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new AppException(ErrorCode.TICKET_INVALID_CATEGORY);
        }
        try {
            return TicketCategory.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new AppException(ErrorCode.TICKET_INVALID_CATEGORY);
        }
    }

    /** Evidence has to be files this user uploaded through POST /support-tickets/upload-evidence(s): no external links, no data: or javascript: URLs. */
    private void requireUploadedEvidence(String joinedEvidence) {
        if (joinedEvidence == null || joinedEvidence.isBlank()) {
            return;
        }
        List<String> paths = new ArrayList<>();
        for (String part : joinedEvidence.split(";")) {
            String value = part.trim();
            if (value.isEmpty()) {
                continue;
            }
            String path = UploadUrlSigner.normalizePath(value);
            if (path == null) {
                throw new AppException(ErrorCode.TICKET_EVIDENCE_INVALID);
            }
            paths.add(path);
        }
        if (paths.size() > MAX_EVIDENCE_FILES) {
            throw new AppException(ErrorCode.TICKET_EVIDENCE_INVALID, "Chỉ đính kèm tối đa " + MAX_EVIDENCE_FILES + " ảnh minh chứng cho mỗi phiếu");
        }
        fileStorageService.requireOwnUploads(paths, "tickets");
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
        if (currentUser == null) {
            throw new AppException(ErrorCode.TICKET_NOT_FOUND);
        }
        // A ticket assigned to the user stays visible even after a facility change.
        if (ticket.getAssignedStaff() != null && ticket.getAssignedStaff().getId().equals(currentUser.getId())) {
            return;
        }
        if (currentUser.getFacility() == null || ticket.getFacility() == null
                || !ticket.getFacility().getId().equals(currentUser.getFacility().getId())) {
            throw new AppException(ErrorCode.TICKET_FACILITY_MISMATCH);
        }
    }

    /**
     * The only moves PATCH /status allows: OPEN / REOPENED -> IN_PROGRESS, IN_PROGRESS -> RESOLVED, and (facility
     * manager only) RESOLVED -> CLOSED. Nothing goes back to OPEN: a finished ticket is reopened through /reopen.
     */
    private void validateTransition(TicketStatus current, TicketStatus target, String role) {
        if (target == TicketStatus.CLOSED && "STAFF".equalsIgnoreCase(role)) {
            throw new AppException(ErrorCode.FORBIDDEN, "Nhân viên không có quyền tự đóng ticket khi chưa có xác nhận từ khách hàng hoặc quản lý");
        }
        boolean allowed = switch (target) {
            case IN_PROGRESS -> current == TicketStatus.OPEN || current == TicketStatus.REOPENED;
            case RESOLVED -> current == TicketStatus.IN_PROGRESS;
            case CLOSED -> current == TicketStatus.RESOLVED;
            case OPEN, REOPENED -> false;
        };
        if (!allowed) {
            throw new AppException(ErrorCode.TICKET_INVALID_STATUS_TRANSITION,
                    "Không thể chuyển phiếu từ trạng thái hiện tại sang trạng thái này. Phiếu đã xử lý xong chỉ được mở lại bằng chức năng mở lại phiếu");
        }
    }

    /** LOW, MEDIUM (default), HIGH or URGENT; the legacy CRITICAL value maps to URGENT. */
    private String normalizePriority(String priority) {
        if (priority == null || priority.isBlank()) {
            return "MEDIUM";
        }
        String value = priority.trim().toUpperCase();
        if ("CRITICAL".equals(value)) {
            value = "URGENT";
        }
        if (!PRIORITIES.contains(value)) {
            throw new AppException(ErrorCode.TICKET_INVALID_PRIORITY);
        }
        return value;
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

    /**
     * New SLA deadline after the priority changed: counted from when the ticket was created, or from now for a
     * ticket that was reopened (its clock restarted).
     */
    private LocalDateTime recalculateSlaDueAt(SupportTicket ticket, TicketStatus statusBeforeChange) {
        boolean reopened = statusBeforeChange == TicketStatus.REOPENED || ticket.getStatus() == TicketStatus.REOPENED;
        LocalDateTime base = reopened || ticket.getCreatedAt() == null ? LocalDateTime.now() : ticket.getCreatedAt();
        return calculateSlaDueAt(base, ticket.getPriority());
    }

    /** One log line per update: "[dd/MM HH:mm - Name]: text". Safe when there is no note yet. */
    private void appendNote(SupportTicket ticket, String authorName, String text) {
        String entry = String.format("[%s - %s]: %s", LocalDateTime.now().format(NOTE_TIME),
                authorName != null && !authorName.isBlank() ? authorName : "Hệ thống", text);
        String current = ticket.getResolutionNote();
        ticket.setResolutionNote(current != null && !current.isBlank() ? current + "\n" + entry : entry);
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

    /**
     * Tells the customer who raised the ticket (and only a customer: staff-raised incidents have no one to tell) when it
     * is taken or resolved. The notice is an extra: a failure is logged and never undoes the change to the ticket.
     */
    private void notifyCustomerOfProgress(SupportTicket ticket, TicketStatus statusBefore) {
        TicketStatus now = ticket.getStatus();
        if (now == statusBefore || (now != TicketStatus.IN_PROGRESS && now != TicketStatus.RESOLVED)) {
            return;
        }
        User customer = ticket.getCustomer();
        boolean customerAccount = customer != null && customer.getRole() != null
                && "CUSTOMER".equalsIgnoreCase(customer.getRole().getName());
        if (!customerAccount || notificationLogRepository == null) {
            return;
        }
        try {
            String facilityName = ticket.getFacility() != null ? ticket.getFacility().getName() : null;
            boolean resolved = now == TicketStatus.RESOLVED;
            notificationLogRepository.save(NotificationLog.builder()
                    .recipient(customer)
                    .recipientEmail(customer.getEmail() != null ? customer.getEmail() : "")
                    .recipientName(customer.getFullName())
                    .facility(ticket.getFacility())
                    .channel(NotificationChannel.IN_APP)
                    .notificationType(NotificationType.TICKET_UPDATE)
                    .referenceType("SUPPORT_TICKET")
                    .referenceId(ticket.getId())
                    .title(resolved ? TicketMessageTemplates.resolvedTitle(ticket.getTicketCode())
                            : TicketMessageTemplates.takenTitle(ticket.getTicketCode()))
                    .content(resolved ? TicketMessageTemplates.resolvedContent(ticket.getTitle())
                            : TicketMessageTemplates.takenContent(displayName(ticket.getAssignedStaff()), ticket.getTitle(), facilityName))
                    .status("SENT")
                    .build());
        } catch (Exception e) {
            log.warn("Could not save the in-app notice for ticket {}: {}", ticket.getTicketCode(), e.getMessage());
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
                    urls.add(storedForm(part));
                }
            }
        }
        if (evidenceUrls != null) {
            for (String url : evidenceUrls) {
                if (url != null && !url.trim().isEmpty()) {
                    urls.add(storedForm(url));
                }
            }
        }
        return urls.isEmpty() ? null : String.join(";", urls);
    }

    /** An uploaded file is stored as its plain /uploads/... path, never with a signed-link query string. */
    private static String storedForm(String url) {
        String path = UploadUrlSigner.normalizePath(url);
        return path != null ? path : url.trim();
    }

    // =========================================================================
    // MAPPING
    // =========================================================================

    /** Maps a page of tickets with one grouped query for the contact-log counts instead of one query per ticket. */
    private List<SupportTicketResponse> mapAll(List<SupportTicket> tickets) {
        if (tickets.isEmpty()) {
            return List.of();
        }
        List<UUID> ids = tickets.stream().map(SupportTicket::getId).filter(Objects::nonNull).collect(Collectors.toList());
        Map<UUID, Integer> counts = new HashMap<>();
        if (!ids.isEmpty()) {
            List<Object[]> rows = contactLogRepository.countGroupedByTicketIds(ids);
            if (rows != null) {
                for (Object[] row : rows) {
                    counts.put((UUID) row[0], ((Number) row[1]).intValue());
                }
            }
        }
        return tickets.stream().map(t -> mapToResponse(t, counts.getOrDefault(t.getId(), 0))).collect(Collectors.toList());
    }

    private SupportTicketResponse mapToResponse(SupportTicket t) {
        int logCount = t.getId() != null ? (int) contactLogRepository.countByTicket_Id(t.getId()) : 0;
        return mapToResponse(t, logCount);
    }

    private SupportTicketResponse mapToResponse(SupportTicket t, int contactLogCount) {
        List<String> evidenceUrls = (t.getImageEvidence() != null && !t.getImageEvidence().isBlank())
                ? Arrays.stream(t.getImageEvidence().split(";"))
                        .map(String::trim)
                        .filter(s -> !s.isEmpty())
                        .collect(Collectors.toList())
                : List.of();

        boolean isOverdue = !isFinished(t) && t.getSlaDueAt() != null && LocalDateTime.now().isAfter(t.getSlaDueAt());

        // No invented placeholders: a ticket without a unit has a null unitCode and the UI says "Khu vực chung".
        return SupportTicketResponse.builder()
                .id(t.getId())
                .ticketCode(t.getTicketCode())
                .customerId(t.getCustomer() != null ? t.getCustomer().getId() : null)
                .customerName(t.getCustomer() != null ? t.getCustomer().getFullName() : null)
                .customerPhone(t.getCustomer() != null ? t.getCustomer().getPhone() : null)
                .bookingId(t.getBooking() != null ? t.getBooking().getId() : null)
                .unitCode(t.getBooking() != null && t.getBooking().getStorageUnit() != null
                        ? t.getBooking().getStorageUnit().getUnitCode()
                        : null)
                .facilityId(t.getFacility() != null ? t.getFacility().getId() : null)
                .facilityName(t.getFacility() != null ? t.getFacility().getName() : null)
                .facilityCode(t.getFacility() != null ? t.getFacility().getCode() : null)
                .assignedStaffId(t.getAssignedStaff() != null ? t.getAssignedStaff().getId() : null)
                .assignedStaffName(t.getAssignedStaff() != null ? t.getAssignedStaff().getFullName() : null)
                .assignedStaffPhone(t.getAssignedStaff() != null ? t.getAssignedStaff().getPhone() : null)
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
                .contactLogCount(contactLogCount)
                .reopenCount(t.getReopenCount() != null ? t.getReopenCount() : 0)
                .reopenReason(t.getReopenReason())
                .createdAt(t.getCreatedAt() != null ? t.getCreatedAt() : LocalDateTime.now())
                .updatedAt(t.getUpdatedAt())
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

package com.boxora.service.impl;

import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.ShiftHandoverAcknowledgeRequest;
import com.boxora.dto.request.ShiftHandoverCreateRequest;
import com.boxora.dto.request.ShiftHandoverDispatchRequest;
import com.boxora.dto.response.ShiftHandoverResponse;
import com.boxora.entity.Facility;
import com.boxora.entity.ShiftHandover;
import com.boxora.entity.StaffAssignment;
import com.boxora.entity.User;
import com.boxora.enums.ActivityAction;
import com.boxora.enums.ShiftHandoverStatus;
import com.boxora.enums.ShiftHandoverType;
import com.boxora.enums.StaffAssignmentStatus;
import com.boxora.enums.StaffShift;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.mapper.ShiftHandoverMapper;
import com.boxora.repository.FacilityRepository;
import com.boxora.repository.ShiftHandoverRepository;
import com.boxora.repository.StaffAssignmentRepository;
import com.boxora.repository.UserRepository;
import com.boxora.security.FacilityAccessGuard;
import com.boxora.security.RequestContext;
import com.boxora.service.ActivityLogService;
import com.boxora.service.ShiftHandoverService;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class ShiftHandoverServiceImpl implements ShiftHandoverService {

    private final ShiftHandoverRepository shiftHandoverRepository;
    private final FacilityRepository facilityRepository;
    private final UserRepository userRepository;
    private final StaffAssignmentRepository staffAssignmentRepository;
    private final ShiftHandoverMapper shiftHandoverMapper;
    private final ActivityLogService activityLogService;
    private final FacilityAccessGuard facilityAccessGuard;
    private final RequestContext requestContext;

    @Override
    public ShiftHandoverResponse createHandover(ShiftHandoverCreateRequest request) {
        log.info("Creating shift handover: facilityId={}, type={}, shift={}, date={}",
                request.getFacilityId(), request.getHandoverType(), request.getShift(), request.getHandoverDate());

        facilityAccessGuard.checkFacilityAccess(request.getFacilityId());

        if (!Boolean.TRUE.equals(request.getChecklistCompleted())) {
            throw new AppException(ErrorCode.SHIFT_HANDOVER_CHECKLIST_INCOMPLETE);
        }

        Facility facility = facilityRepository.findById(request.getFacilityId())
                .orElseThrow(() -> new AppException(ErrorCode.FACILITY_NOT_FOUND));

        UUID currentUserId = requestContext.currentUserId();
        User outgoingStaff = userRepository.findById(currentUserId)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        ShiftHandoverType handoverType = request.getHandoverType() != null
                ? request.getHandoverType()
                : ShiftHandoverType.ROUTINE;

        // Bàn giao đột xuất bắt buộc phải có lý do
        if (handoverType == ShiftHandoverType.EMERGENCY) {
            if (request.getEmergencyReason() == null || request.getEmergencyReason().trim().isEmpty()) {
                throw new AppException(ErrorCode.SHIFT_HANDOVER_EMERGENCY_REASON_REQUIRED);
            }
        }

        User incomingStaff = null;
        if (request.getIncomingStaffId() != null) {
            // Không được tự nhận chính mình
            if (request.getIncomingStaffId().equals(currentUserId)) {
                throw new AppException(ErrorCode.SHIFT_HANDOVER_SELF_RECEIVE_FORBIDDEN);
            }

            incomingStaff = userRepository.findById(request.getIncomingStaffId())
                    .orElseThrow(() -> new AppException(ErrorCode.STAFF_USER_NOT_FOUND));

            if (!Boolean.TRUE.equals(incomingStaff.getIsActive())) {
                throw new AppException(ErrorCode.USER_INACTIVE, "Tài khoản nhân sự tiếp nhận đã bị vô hiệu hóa");
            }

            // Kiểm tra quyền hạn của nhân sự tiếp nhận
            String roleName = incomingStaff.getRole() != null ? incomingStaff.getRole().getName() : "";
            if (!"STAFF".equalsIgnoreCase(roleName) && !"FACILITY_MANAGER".equalsIgnoreCase(roleName)) {
                throw new AppException(ErrorCode.SHIFT_HANDOVER_INVALID_RECIPIENT,
                        "Chỉ nhân viên (STAFF) hoặc Quản lý cơ sở (FACILITY_MANAGER) mới có quyền tiếp nhận bàn giao");
            }

            // Kiểm tra thuộc cơ sở phù hợp
            boolean belongsToFacility = isStaffBelongingToFacility(incomingStaff, facility.getId());
            if (!belongsToFacility) {
                throw new AppException(ErrorCode.SHIFT_HANDOVER_INVALID_RECIPIENT,
                        "Nhân sự tiếp nhận phải thuộc cùng chi nhánh cơ sở " + facility.getName());
            }
        } else {
            // Nếu không có người nhận:
            // Chỉ bàn giao đột xuất (EMERGENCY) mới cho phép lưu trạng thái Chờ Quản lý điều phối
            if (handoverType != ShiftHandoverType.EMERGENCY) {
                throw new AppException(ErrorCode.INVALID_REQUEST,
                        "Biên bản bàn giao định kỳ hoặc chuyển giao trách nhiệm bắt buộc phải chọn nhân sự tiếp nhận.");
            }
        }

        StaffAssignment outgoingAssignment = null;
        if (request.getOutgoingAssignmentId() != null) {
            outgoingAssignment = staffAssignmentRepository.findById(request.getOutgoingAssignmentId()).orElse(null);
        }

        StaffAssignment incomingAssignment = null;
        if (request.getIncomingAssignmentId() != null) {
            incomingAssignment = staffAssignmentRepository.findById(request.getIncomingAssignmentId()).orElse(null);
        }

        // Quyết định trạng thái khởi tạo
        ShiftHandoverStatus initialStatus;
        if (Boolean.TRUE.equals(request.getIsDraft())) {
            initialStatus = ShiftHandoverStatus.DRAFT;
        } else if (incomingStaff == null) {
            initialStatus = ShiftHandoverStatus.PENDING_DISPATCH;
        } else if (request.getCashDiscrepancy() != null && request.getCashDiscrepancy().compareTo(BigDecimal.ZERO) != 0) {
            initialStatus = ShiftHandoverStatus.DISCREPANCY;
        } else {
            initialStatus = ShiftHandoverStatus.SUBMITTED;
        }

        ShiftHandover handover = ShiftHandover.builder()
                .facility(facility)
                .handoverDate(request.getHandoverDate() != null ? request.getHandoverDate() : LocalDate.now())
                .shift(request.getShift())
                .targetShift(request.getTargetShift())
                .handoverType(handoverType)
                .outgoingStaff(outgoingStaff)
                .incomingStaff(incomingStaff)
                .outgoingAssignment(outgoingAssignment)
                .incomingAssignment(incomingAssignment)
                .emergencyReason(request.getEmergencyReason())
                .transferScope(request.getTransferScope())
                .pendingTasks(request.getPendingTasks())
                .pendingTicketsCount(request.getPendingTicketsCount() != null ? request.getPendingTicketsCount() : 0)
                .unresolvedBookingsCount(request.getUnresolvedBookingsCount() != null ? request.getUnresolvedBookingsCount() : 0)
                .cashInDrawer(request.getCashInDrawer() != null ? request.getCashInDrawer() : BigDecimal.ZERO)
                .cashCounted(request.getCashCounted())
                .cashDiscrepancy(request.getCashDiscrepancy() != null ? request.getCashDiscrepancy() : BigDecimal.ZERO)
                .cashDiscrepancyReason(request.getCashDiscrepancyReason())
                .facilityStatusNote(request.getFacilityStatusNote())
                .checklistCompleted(true)
                .notes(request.getNotes())
                .status(initialStatus)
                .build();

        ShiftHandover saved = shiftHandoverRepository.save(handover);

        activityLogService.record(
                facility.getId(),
                ActivityAction.SHIFT_HANDOVER_CREATE,
                "ShiftHandover",
                saved.getId(),
                String.format("Lập biên bản bàn giao [%s] ca %s tại %s bởi %s (Trạng thái: %s)",
                        saved.getHandoverType(), saved.getShift(), facility.getName(), outgoingStaff.getFullName(), saved.getStatus()),
                null,
                saved.getId().toString()
        );

        return shiftHandoverMapper.toResponse(saved);
    }

    @Override
    public ShiftHandoverResponse acknowledgeHandover(UUID handoverId, ShiftHandoverAcknowledgeRequest request) {
        log.info("Acknowledging shift handover id={} with status={}", handoverId, request.getStatus());

        ShiftHandover handover = shiftHandoverRepository.findById(handoverId)
                .orElseThrow(() -> new AppException(ErrorCode.SHIFT_HANDOVER_NOT_FOUND));

        facilityAccessGuard.checkFacilityAccess(handover.getFacility().getId());

        if (handover.getStatus() == ShiftHandoverStatus.ACKNOWLEDGED) {
            throw new AppException(ErrorCode.SHIFT_HANDOVER_ALREADY_ACKNOWLEDGED);
        }

        UUID currentUserId = requestContext.currentUserId();

        // Không cho phép người tạo tự xác nhận biên bản của chính mình
        if (currentUserId != null && handover.getOutgoingStaff() != null && currentUserId.equals(handover.getOutgoingStaff().getId())) {
            throw new AppException(ErrorCode.FORBIDDEN, "Người lập biên bản không thể tự xác nhận tiếp nhận bàn giao");
        }

        boolean isManagerOrAdmin = requestContext.hasAnyRole("FACILITY_MANAGER", "BUSINESS_MANAGER", "ADMIN");
        boolean isDesignatedIncoming = handover.getIncomingStaff() != null && currentUserId != null && currentUserId.equals(handover.getIncomingStaff().getId());

        // Nếu biên bản chưa có người nhận (ví dụ do PENDING_DISPATCH), nhân sự hiện tại đăng nhập có thể nhận
        if (handover.getIncomingStaff() == null && currentUserId != null) {
            User currentUser = userRepository.findById(currentUserId).orElse(null);
            if (currentUser != null && isStaffBelongingToFacility(currentUser, handover.getFacility().getId())) {
                handover.setIncomingStaff(currentUser);
                isDesignatedIncoming = true;
            }
        }

        if (!isDesignatedIncoming && !isManagerOrAdmin) {
            throw new AppException(ErrorCode.FORBIDDEN, "Chỉ nhân viên được chỉ định tiếp nhận hoặc Quản lý cơ sở mới có quyền xác nhận bàn giao");
        }

        // Cập nhật số tiền thực đếm và chênh lệch nếu có khai báo từ phía người nhận
        if (request.getCashCounted() != null) {
            handover.setCashCounted(request.getCashCounted());
        }
        if (request.getCashDiscrepancy() != null) {
            handover.setCashDiscrepancy(request.getCashDiscrepancy());
        }
        if (request.getCashDiscrepancyReason() != null && !request.getCashDiscrepancyReason().isBlank()) {
            handover.setCashDiscrepancyReason(request.getCashDiscrepancyReason());
        }

        ShiftHandoverStatus nextStatus = request.getStatus();
        // Nếu có chênh lệch tiền mặt mà người nhận tiếp nhận, đánh dấu DISCREPANCY để Quản lý nắm bắt
        if (nextStatus == ShiftHandoverStatus.ACKNOWLEDGED
                && handover.getCashDiscrepancy() != null
                && handover.getCashDiscrepancy().compareTo(BigDecimal.ZERO) != 0) {
            nextStatus = ShiftHandoverStatus.DISCREPANCY;
        }

        handover.setStatus(nextStatus);
        handover.setAcknowledgedAt(LocalDateTime.now());
        if (request.getNotes() != null && !request.getNotes().isBlank()) {
            String existingNotes = handover.getNotes() != null ? handover.getNotes() + "\n" : "";
            handover.setNotes(existingNotes + "[Tiếp nhận ca] " + request.getNotes());
        }

        ShiftHandover updated = shiftHandoverRepository.save(handover);

        ActivityAction action = nextStatus == ShiftHandoverStatus.REJECTED
                ? ActivityAction.SHIFT_HANDOVER_REJECT
                : ActivityAction.SHIFT_HANDOVER_ACKNOWLEDGE;

        activityLogService.record(
                handover.getFacility().getId(),
                action,
                "ShiftHandover",
                updated.getId(),
                String.format("Phản hồi biên bản bàn giao ca id=%s trạng thái: %s", updated.getId(), nextStatus),
                null,
                updated.getId().toString()
        );

        return shiftHandoverMapper.toResponse(updated);
    }

    @Override
    public ShiftHandoverResponse dispatchRecipient(UUID handoverId, ShiftHandoverDispatchRequest request) {
        log.info("Dispatching recipient for handover id={}, incomingStaffId={}", handoverId, request.getIncomingStaffId());

        if (!requestContext.hasAnyRole("FACILITY_MANAGER", "BUSINESS_MANAGER", "ADMIN")) {
            throw new AppException(ErrorCode.SHIFT_HANDOVER_DISPATCH_NOT_ALLOWED);
        }

        ShiftHandover handover = shiftHandoverRepository.findById(handoverId)
                .orElseThrow(() -> new AppException(ErrorCode.SHIFT_HANDOVER_NOT_FOUND));

        facilityAccessGuard.checkFacilityAccess(handover.getFacility().getId());

        if (handover.getStatus() == ShiftHandoverStatus.ACKNOWLEDGED) {
            throw new AppException(ErrorCode.SHIFT_HANDOVER_ALREADY_ACKNOWLEDGED);
        }

        UUID currentUserId = requestContext.currentUserId();
        User currentUser = userRepository.findById(currentUserId)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        if (request.getIncomingStaffId().equals(handover.getOutgoingStaff().getId())) {
            throw new AppException(ErrorCode.SHIFT_HANDOVER_SELF_RECEIVE_FORBIDDEN);
        }

        User incomingStaff = userRepository.findById(request.getIncomingStaffId())
                .orElseThrow(() -> new AppException(ErrorCode.STAFF_USER_NOT_FOUND));

        if (!Boolean.TRUE.equals(incomingStaff.getIsActive())) {
            throw new AppException(ErrorCode.USER_INACTIVE, "Tài khoản nhân sự tiếp nhận đã bị vô hiệu hóa");
        }

        if (!isStaffBelongingToFacility(incomingStaff, handover.getFacility().getId())) {
            throw new AppException(ErrorCode.SHIFT_HANDOVER_INVALID_RECIPIENT,
                    "Nhân sự tiếp nhận phải thuộc cùng chi nhánh cơ sở " + handover.getFacility().getName());
        }

        StaffAssignment incomingAssignment = null;
        if (request.getIncomingAssignmentId() != null) {
            incomingAssignment = staffAssignmentRepository.findById(request.getIncomingAssignmentId()).orElse(null);
        }

        handover.setIncomingStaff(incomingStaff);
        handover.setIncomingAssignment(incomingAssignment);
        handover.setDispatchedBy(currentUser);
        handover.setDispatchedAt(LocalDateTime.now());
        handover.setStatus(ShiftHandoverStatus.SUBMITTED);

        if (request.getNotes() != null && !request.getNotes().isBlank()) {
            String existingNotes = handover.getNotes() != null ? handover.getNotes() + "\n" : "";
            handover.setNotes(existingNotes + "[Quản lý điều phối] " + request.getNotes());
        }

        ShiftHandover updated = shiftHandoverRepository.save(handover);

        activityLogService.record(
                handover.getFacility().getId(),
                ActivityAction.SHIFT_HANDOVER_DISPATCH,
                "ShiftHandover",
                updated.getId(),
                String.format("Quản lý %s điều phối nhân sự %s tiếp nhận biên bản bàn giao ca id=%s",
                        currentUser.getFullName(), incomingStaff.getFullName(), updated.getId()),
                null,
                updated.getId().toString()
        );

        return shiftHandoverMapper.toResponse(updated);
    }

    private boolean isStaffBelongingToFacility(User user, UUID facilityId) {
        if (user.getFacility() != null && facilityId.equals(user.getFacility().getId())) {
            return true;
        }
        return staffAssignmentRepository.existsByStaff_IdAndFacility_Id(user.getId(), facilityId);
    }

    @Override
    @Transactional(readOnly = true)
    public ShiftHandoverResponse getById(UUID id) {
        ShiftHandover handover = shiftHandoverRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.SHIFT_HANDOVER_NOT_FOUND));

        facilityAccessGuard.checkFacilityAccess(handover.getFacility().getId());
        return shiftHandoverMapper.toResponse(handover);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<ShiftHandoverResponse> getHandovers(
            UUID facilityId,
            LocalDate date,
            ShiftHandoverStatus status,
            LocalDate fromDate,
            LocalDate toDate,
            int page,
            int size
    ) {
        if (fromDate != null && toDate != null && toDate.isBefore(fromDate)) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "toDate must be on or after fromDate");
        }

        UUID scopedFacilityId = facilityAccessGuard.isFacilityScoped()
                ? facilityAccessGuard.scopedFacilityIdOrNull()
                : facilityId;

        final UUID targetFacilityId = scopedFacilityId;
        final LocalDate targetDate = date;
        final ShiftHandoverStatus targetStatus = status;
        final LocalDate targetFromDate = fromDate;
        final LocalDate targetToDate = toDate;

        Specification<ShiftHandover> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (targetFacilityId != null) {
                predicates.add(cb.equal(root.get("facility").get("id"), targetFacilityId));
            }
            if (targetDate != null) {
                predicates.add(cb.equal(root.get("handoverDate"), targetDate));
            }
            if (targetStatus != null) {
                predicates.add(cb.equal(root.get("status"), targetStatus));
            }
            if (targetFromDate != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("handoverDate"), targetFromDate));
            }
            if (targetToDate != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("handoverDate"), targetToDate));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };

        Page<ShiftHandoverResponse> result = shiftHandoverRepository.findAll(
                spec,
                PageRequest.of(page, size, Sort.by("handoverDate").descending().and(Sort.by("createdAt").descending()))
        ).map(shiftHandoverMapper::toResponse);

        return PageResponse.from(result);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ShiftHandoverResponse> getRecentFacilityHandovers(UUID facilityId) {
        UUID scopedFacilityId = facilityAccessGuard.isFacilityScoped()
                ? facilityAccessGuard.scopedFacilityIdOrNull()
                : facilityId;

        if (scopedFacilityId == null) {
            return List.of();
        }

        return shiftHandoverRepository.findByFacility_IdOrderByHandoverDateDescCreatedAtDesc(scopedFacilityId)
                .stream()
                .limit(10)
                .map(shiftHandoverMapper::toResponse)
                .toList();
    }
}

package com.boxora.service.impl;

import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.ShiftSwapCreateRequest;
import com.boxora.dto.request.ShiftSwapReviewRequest;
import com.boxora.dto.request.ShiftSwapTargetRespondRequest;
import com.boxora.dto.response.ShiftSwapResponse;
import com.boxora.entity.ShiftSwapRequest;
import com.boxora.entity.StaffAssignment;
import com.boxora.entity.User;
import com.boxora.enums.ActivityAction;
import com.boxora.enums.ShiftSwapStatus;
import com.boxora.enums.StaffAssignmentStatus;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.mapper.ShiftSwapMapper;
import com.boxora.repository.ShiftSwapRequestRepository;
import com.boxora.repository.StaffAssignmentRepository;
import com.boxora.repository.UserRepository;
import com.boxora.security.FacilityAccessGuard;
import com.boxora.security.RequestContext;
import com.boxora.service.ActivityLogService;
import com.boxora.service.ShiftSwapService;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class ShiftSwapServiceImpl implements ShiftSwapService {

    private final ShiftSwapRequestRepository shiftSwapRequestRepository;
    private final StaffAssignmentRepository staffAssignmentRepository;
    private final UserRepository userRepository;
    private final ShiftSwapMapper shiftSwapMapper;
    private final ActivityLogService activityLogService;
    private final FacilityAccessGuard facilityAccessGuard;
    private final RequestContext requestContext;

    @Override
    public ShiftSwapResponse createSwapRequest(ShiftSwapCreateRequest request) {
        log.info("Creating shift swap request for assignmentId={}, targetStaffId={}",
                request.getAssignmentId(), request.getTargetStaffId());

        StaffAssignment assignment = staffAssignmentRepository.findById(request.getAssignmentId())
                .orElseThrow(() -> new AppException(ErrorCode.STAFF_ASSIGNMENT_NOT_FOUND));

        if (assignment.getStatus() == StaffAssignmentStatus.COMPLETED || assignment.getStatus() == StaffAssignmentStatus.CANCELLED) {
            throw new AppException(ErrorCode.SHIFT_SWAP_ALREADY_PROCESSED);
        }

        UUID currentUserId = requestContext.currentUserId();
        User requester = userRepository.findById(currentUserId)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        facilityAccessGuard.checkFacilityAccess(assignment.getFacility().getId());
        if ("STAFF".equalsIgnoreCase(requestContext.currentUserRole())
                && !requester.getId().equals(assignment.getStaff().getId())) {
            throw new AppException(ErrorCode.FORBIDDEN);
        }

        if (request.getTargetStaffId().equals(assignment.getStaff().getId())) {
            throw new AppException(ErrorCode.SHIFT_SWAP_INVALID_TARGET);
        }

        User targetStaff = userRepository.findById(request.getTargetStaffId())
                .orElseThrow(() -> new AppException(ErrorCode.STAFF_USER_NOT_FOUND));

        if (!Boolean.TRUE.equals(targetStaff.getIsActive())) {
            throw new AppException(ErrorCode.USER_NOT_FOUND);
        }
        String requesterRole = (assignment.getStaff() != null && assignment.getStaff().getRole() != null)
                ? assignment.getStaff().getRole().getName()
                : "STAFF";
        if (targetStaff.getRole() == null || !requesterRole.equalsIgnoreCase(targetStaff.getRole().getName())
                || targetStaff.getFacility() == null
                || !assignment.getFacility().getId().equals(targetStaff.getFacility().getId())) {
            throw new AppException(ErrorCode.STAFF_ASSIGNMENT_FACILITY_MISMATCH);
        }

        StaffAssignment targetAssignment = null;
        if (request.getTargetAssignmentId() != null) {
            targetAssignment = staffAssignmentRepository.findById(request.getTargetAssignmentId())
                    .orElseThrow(() -> new AppException(ErrorCode.STAFF_ASSIGNMENT_NOT_FOUND));
            if (targetAssignment == null
                    || targetAssignment.getStaff() == null
                    || !targetAssignment.getStaff().getId().equals(targetStaff.getId())
                    || targetAssignment.getFacility() == null
                    || !targetAssignment.getFacility().getId().equals(assignment.getFacility().getId())
                    || targetAssignment.getStatus() == StaffAssignmentStatus.COMPLETED
                    || targetAssignment.getStatus() == StaffAssignmentStatus.CANCELLED) {
                throw new AppException(ErrorCode.SHIFT_SWAP_INVALID_TARGET);
            }
        }

        // Do not treat the target's own assignment as a conflict when it is the shift being exchanged.
        boolean exchangingExistingShift = targetAssignment != null
                && targetAssignment.getAssignedDate().equals(assignment.getAssignedDate())
                && targetAssignment.getShift() == assignment.getShift();
        boolean targetBusy = exchangingExistingShift
                ? staffAssignmentRepository.existsByStaff_IdAndAssignedDateAndShiftAndIdNot(
                        targetStaff.getId(), assignment.getAssignedDate(), assignment.getShift(), targetAssignment.getId())
                : staffAssignmentRepository.existsByStaff_IdAndAssignedDateAndShift(
                        targetStaff.getId(), assignment.getAssignedDate(), assignment.getShift());
        if (targetBusy) {
            throw new AppException(ErrorCode.SHIFT_SWAP_TARGET_BUSY);
        }

        ShiftSwapRequest swap = ShiftSwapRequest.builder()
                .assignment(assignment)
                .targetAssignment(targetAssignment)
                .requester(assignment.getStaff())
                .targetStaff(targetStaff)
                .facility(assignment.getFacility())
                .reason(request.getReason())
                .status(ShiftSwapStatus.PENDING)
                .build();

        ShiftSwapRequest saved = shiftSwapRequestRepository.save(swap);

        activityLogService.record(
                assignment.getFacility().getId(),
                ActivityAction.SHIFT_SWAP_REQUEST,
                "ShiftSwapRequest",
                saved.getId(),
                String.format("Yêu cầu đổi ca: %s đề xuất đổi ca %s ngày %s cho %s",
                        assignment.getStaff().getFullName(),
                        assignment.getShift(),
                        assignment.getAssignedDate(),
                        targetStaff.getFullName()),
                null,
                saved.getId().toString()
        );

        return shiftSwapMapper.toResponse(saved);
    }

    @Override
    public ShiftSwapResponse reviewSwapRequest(UUID swapId, ShiftSwapReviewRequest request) {
        log.info("Reviewing shift swap request id={} with status={}", swapId, request.getStatus());

        ShiftSwapRequest swap = shiftSwapRequestRepository.findById(swapId)
                .orElseThrow(() -> new AppException(ErrorCode.SHIFT_SWAP_REQUEST_NOT_FOUND));

        facilityAccessGuard.checkFacilityAccess(swap.getFacility().getId());

        if (swap.getStatus() != ShiftSwapStatus.PENDING) {
            throw new AppException(ErrorCode.SHIFT_SWAP_ALREADY_PROCESSED);
        }

        UUID reviewerId = requestContext.currentUserId();
        if (reviewerId != null && ((swap.getRequester() != null && reviewerId.equals(swap.getRequester().getId()))
                || (swap.getTargetStaff() != null && reviewerId.equals(swap.getTargetStaff().getId())))) {
            throw new AppException(ErrorCode.FORBIDDEN, "Không thể tự phê duyệt hoặc xử lý yêu cầu đổi ca của chính mình");
        }

        String reviewerRole = requestContext.currentUserRole();
        String requesterRole = (swap.getRequester() != null && swap.getRequester().getRole() != null)
                ? swap.getRequester().getRole().getName()
                : "STAFF";

        if ("FACILITY_MANAGER".equalsIgnoreCase(reviewerRole)) {
            if ("FACILITY_MANAGER".equalsIgnoreCase(requesterRole)) {
                throw new AppException(ErrorCode.FORBIDDEN, "Yêu cầu đổi ca của Quản lý cơ sở phải do Business Manager phê duyệt");
            }
        } else if (!"BUSINESS_MANAGER".equalsIgnoreCase(reviewerRole)) {
            throw new AppException(ErrorCode.FORBIDDEN, "Tài khoản không có quyền phê duyệt yêu cầu đổi ca");
        }

        User reviewer = reviewerId != null ? userRepository.findById(reviewerId).orElse(null) : null;

        swap.setReviewedBy(reviewer);
        swap.setReviewedAt(LocalDateTime.now());
        swap.setManagerNotes(request.getManagerNotes());

        if (request.getStatus() == ShiftSwapStatus.APPROVED || request.getStatus() == ShiftSwapStatus.MANAGER_APPROVED) {
            swap.setStatus(ShiftSwapStatus.MANAGER_APPROVED);

            activityLogService.record(
                    swap.getFacility().getId(),
                    ActivityAction.SHIFT_SWAP_APPROVE,
                    "ShiftSwapRequest",
                    swap.getId(),
                    String.format("Quản lý duyệt đề xuất đổi ca: %s đề xuất đổi ca %s ngày %s cho %s, chuyển tiếp đến %s xác nhận",
                            swap.getRequester().getFullName(),
                            swap.getAssignment().getShift(),
                            swap.getAssignment().getAssignedDate(),
                            swap.getTargetStaff().getFullName(),
                            swap.getTargetStaff().getFullName()),
                    null,
                    swap.getId().toString()
            );
        } else {
            swap.setStatus(ShiftSwapStatus.REJECTED);

            activityLogService.record(
                    swap.getFacility().getId(),
                    ActivityAction.SHIFT_SWAP_REJECT,
                    "ShiftSwapRequest",
                    swap.getId(),
                    String.format("Quản lý từ chối yêu cầu đổi ca id=%s. Ghi chú: %s", swap.getId(), request.getManagerNotes()),
                    null,
                    swap.getId().toString()
            );
        }

        ShiftSwapRequest updated = shiftSwapRequestRepository.save(swap);
        return shiftSwapMapper.toResponse(updated);
    }

    @Override
    public ShiftSwapResponse respondToSwapRequest(UUID swapId, ShiftSwapTargetRespondRequest request) {
        log.info("Target staff responding to shift swap request id={} with accept={}", swapId, request.getAccept());

        ShiftSwapRequest swap = shiftSwapRequestRepository.findById(swapId)
                .orElseThrow(() -> new AppException(ErrorCode.SHIFT_SWAP_REQUEST_NOT_FOUND));

        facilityAccessGuard.checkFacilityAccess(swap.getFacility().getId());

        UUID currentUserId = requestContext.currentUserId();
        if (currentUserId == null || !currentUserId.equals(swap.getTargetStaff().getId())) {
            throw new AppException(ErrorCode.FORBIDDEN, "Chỉ nhân viên được đề xuất tiếp nhận mới có quyền phản hồi yêu cầu đổi ca này");
        }

        if (swap.getStatus() != ShiftSwapStatus.MANAGER_APPROVED) {
            throw new AppException(ErrorCode.SHIFT_SWAP_ALREADY_PROCESSED, "Yêu cầu đổi ca chưa được Quản lý duyệt hoặc đã được xử lý trước đó");
        }

        swap.setTargetStaffRespondedAt(LocalDateTime.now());
        swap.setTargetStaffNotes(request.getNotes());

        if (Boolean.TRUE.equals(request.getAccept())) {
            StaffAssignment assignment = swap.getAssignment();
            if (assignment.getStatus() == StaffAssignmentStatus.COMPLETED || assignment.getStatus() == StaffAssignmentStatus.CANCELLED) {
                throw new AppException(ErrorCode.SHIFT_SWAP_ALREADY_PROCESSED, "Ca làm việc gốc đã hoàn thành hoặc đã bị hủy");
            }
            if (swap.getTargetAssignment() != null) {
                StaffAssignment targetAss = swap.getTargetAssignment();
                if (targetAss.getStatus() == StaffAssignmentStatus.COMPLETED || targetAss.getStatus() == StaffAssignmentStatus.CANCELLED) {
                    throw new AppException(ErrorCode.SHIFT_SWAP_ALREADY_PROCESSED, "Ca làm việc đối ứng đã hoàn thành hoặc đã bị hủy");
                }
            }

            User oldStaff = assignment.getStaff();
            User newStaff = swap.getTargetStaff();

            // Nếu là hoán đổi ca 2 chiều
            if (swap.getTargetAssignment() != null) {
                StaffAssignment targetAss = swap.getTargetAssignment();
                targetAss.setStaff(oldStaff);
                staffAssignmentRepository.save(targetAss);
            }

            assignment.setStaff(newStaff);
            String existingNotes = assignment.getNotes() != null ? assignment.getNotes() + "\n" : "";
            assignment.setNotes(existingNotes + String.format("[Đổi ca] Nhân sự %s đã chấp thuận tiếp nhận ca từ %s (Quản lý duyệt: %s, Lý do: %s)",
                    newStaff.getFullName(),
                    oldStaff.getFullName(),
                    swap.getReviewedBy() != null ? swap.getReviewedBy().getFullName() : "Quản lý cơ sở",
                    swap.getReason()));
            staffAssignmentRepository.save(assignment);

            swap.setStatus(ShiftSwapStatus.APPROVED);

            activityLogService.record(
                    swap.getFacility().getId(),
                    ActivityAction.SHIFT_SWAP_APPROVE,
                    "ShiftSwapRequest",
                    swap.getId(),
                    String.format("Nhân sự %s đã chấp thuận tiếp nhận ca trực từ %s (Đổi ca thành công)",
                            newStaff.getFullName(), oldStaff.getFullName()),
                    null,
                    swap.getId().toString()
            );
        } else {
            swap.setStatus(ShiftSwapStatus.REJECTED);

            activityLogService.record(
                    swap.getFacility().getId(),
                    ActivityAction.SHIFT_SWAP_REJECT,
                    "ShiftSwapRequest",
                    swap.getId(),
                    String.format("Nhân sự %s từ chối tiếp nhận ca trực từ %s. Ghi chú: %s",
                            swap.getTargetStaff().getFullName(),
                            swap.getRequester().getFullName(),
                            request.getNotes()),
                    null,
                    swap.getId().toString()
            );
        }

        ShiftSwapRequest updated = shiftSwapRequestRepository.save(swap);
        return shiftSwapMapper.toResponse(updated);
    }

    @Override
    public ShiftSwapResponse cancelSwapRequest(UUID swapId) {
        ShiftSwapRequest swap = shiftSwapRequestRepository.findById(swapId)
                .orElseThrow(() -> new AppException(ErrorCode.SHIFT_SWAP_REQUEST_NOT_FOUND));

        UUID currentUserId = requestContext.currentUserId();
        boolean isRequester = currentUserId != null && currentUserId.equals(swap.getRequester().getId());
        facilityAccessGuard.checkFacilityAccess(swap.getFacility().getId());
        if ("STAFF".equalsIgnoreCase(requestContext.currentUserRole()) && !isRequester) {
            throw new AppException(ErrorCode.FORBIDDEN);
        }

        if (swap.getStatus() != ShiftSwapStatus.PENDING && swap.getStatus() != ShiftSwapStatus.MANAGER_APPROVED) {
            throw new AppException(ErrorCode.SHIFT_SWAP_ALREADY_PROCESSED);
        }

        swap.setStatus(ShiftSwapStatus.CANCELLED);
        ShiftSwapRequest updated = shiftSwapRequestRepository.save(swap);
        return shiftSwapMapper.toResponse(updated);
    }

    @Override
    @Transactional(readOnly = true)
    public ShiftSwapResponse getById(UUID id) {
        ShiftSwapRequest swap = shiftSwapRequestRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.SHIFT_SWAP_REQUEST_NOT_FOUND));

        facilityAccessGuard.checkFacilityAccess(swap.getFacility().getId());
        if ("STAFF".equalsIgnoreCase(requestContext.currentUserRole())) {
            UUID currentUserId = requestContext.currentUserId();
            boolean isRequester = currentUserId != null && currentUserId.equals(swap.getRequester().getId());
            boolean isTargetStaff = currentUserId != null && currentUserId.equals(swap.getTargetStaff().getId());
            if (!isRequester && !isTargetStaff) {
                throw new AppException(ErrorCode.FORBIDDEN);
            }
            if (isTargetStaff && !isRequester && swap.getStatus() == ShiftSwapStatus.PENDING) {
                throw new AppException(ErrorCode.FORBIDDEN, "Yêu cầu đổi ca đang chờ Quản lý phê duyệt");
            }
        }
        return shiftSwapMapper.toResponse(swap);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<ShiftSwapResponse> getSwapRequests(
            UUID facilityId,
            ShiftSwapStatus status,
            UUID staffId,
            java.time.LocalDate fromDate,
            java.time.LocalDate toDate,
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
        final ShiftSwapStatus targetStatus = status;
        final UUID targetStaffId = staffId;
        final java.time.LocalDate targetFromDate = fromDate;
        final java.time.LocalDate targetToDate = toDate;

        Specification<ShiftSwapRequest> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (targetFacilityId != null) {
                predicates.add(cb.equal(root.get("facility").get("id"), targetFacilityId));
            }
            if (targetStatus != null) {
                predicates.add(cb.equal(root.get("status"), targetStatus));
            }
            if (targetStaffId != null) {
                predicates.add(cb.or(
                        cb.equal(root.get("requester").get("id"), targetStaffId),
                        cb.equal(root.get("targetStaff").get("id"), targetStaffId)
                ));
            }
            if (targetFromDate != null) {
                predicates.add(cb.and(
                        cb.isNotNull(root.get("assignment")),
                        cb.greaterThanOrEqualTo(root.get("assignment").get("assignedDate"), targetFromDate)
                ));
            }
            if (targetToDate != null) {
                predicates.add(cb.and(
                        cb.isNotNull(root.get("assignment")),
                        cb.lessThanOrEqualTo(root.get("assignment").get("assignedDate"), targetToDate)
                ));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };

        Page<ShiftSwapResponse> result = shiftSwapRequestRepository.findAll(
                spec,
                PageRequest.of(page, size, Sort.by("createdAt").descending())
        ).map(shiftSwapMapper::toResponse);

        return PageResponse.from(result);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ShiftSwapResponse> getMySwapRequests() {
        UUID currentUserId = requestContext.currentUserId();
        if (currentUserId == null) {
            return List.of();
        }

        return shiftSwapRequestRepository.findByStaffInvolvement(currentUserId).stream()
                .map(shiftSwapMapper::toResponse)
                .toList();
    }
}

package com.boxora.service.impl;

import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.ShiftSwapCreateRequest;
import com.boxora.dto.request.ShiftSwapReviewRequest;
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
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
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

        // Nhân viên chỉ được tạo đơn đổi ca cho chính mình (trừ khi Quản lý tạo hộ)
        boolean isManager = facilityAccessGuard.isFacilityScoped() || !facilityAccessGuard.isFacilityScoped();
        if (!requester.getId().equals(assignment.getStaff().getId())) {
            facilityAccessGuard.checkFacilityAccess(assignment.getFacility().getId());
        }

        if (request.getTargetStaffId().equals(assignment.getStaff().getId())) {
            throw new AppException(ErrorCode.SHIFT_SWAP_INVALID_TARGET);
        }

        User targetStaff = userRepository.findById(request.getTargetStaffId())
                .orElseThrow(() -> new AppException(ErrorCode.STAFF_USER_NOT_FOUND));

        if (!Boolean.TRUE.equals(targetStaff.getIsActive())) {
            throw new AppException(ErrorCode.USER_NOT_FOUND);
        }

        // Kiểm tra nhân viên thay thế có bị trùng ca vào ngày đó không
        boolean targetBusy = staffAssignmentRepository.existsByStaff_IdAndAssignedDateAndShift(
                targetStaff.getId(), assignment.getAssignedDate(), assignment.getShift()
        );
        if (targetBusy) {
            throw new AppException(ErrorCode.SHIFT_SWAP_TARGET_BUSY);
        }

        StaffAssignment targetAssignment = null;
        if (request.getTargetAssignmentId() != null) {
            targetAssignment = staffAssignmentRepository.findById(request.getTargetAssignmentId())
                    .orElse(null);
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
        User reviewer = reviewerId != null ? userRepository.findById(reviewerId).orElse(null) : null;

        swap.setStatus(request.getStatus());
        swap.setReviewedBy(reviewer);
        swap.setReviewedAt(LocalDateTime.now());
        swap.setManagerNotes(request.getManagerNotes());

        if (request.getStatus() == ShiftSwapStatus.APPROVED) {
            StaffAssignment assignment = swap.getAssignment();
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
            assignment.setNotes(existingNotes + String.format("[Đổi ca] Duyệt bởi %s: chuyển giao từ %s sang %s (Lý do: %s)",
                    reviewer != null ? reviewer.getFullName() : "Quản lý",
                    oldStaff.getFullName(),
                    newStaff.getFullName(),
                    swap.getReason()));
            staffAssignmentRepository.save(assignment);

            activityLogService.record(
                    swap.getFacility().getId(),
                    ActivityAction.SHIFT_SWAP_APPROVE,
                    "ShiftSwapRequest",
                    swap.getId(),
                    String.format("Quản lý duyệt đổi ca: %s thay thế %s ca %s ngày %s",
                            newStaff.getFullName(), oldStaff.getFullName(), assignment.getShift(), assignment.getAssignedDate()),
                    null,
                    swap.getId().toString()
            );
        } else {
            activityLogService.record(
                    swap.getFacility().getId(),
                    ActivityAction.SHIFT_SWAP_REJECT,
                    "ShiftSwapRequest",
                    swap.getId(),
                    String.format("Từ chối yêu cầu đổi ca id=%s. Ghi chú: %s", swap.getId(), request.getManagerNotes()),
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
        if (!isRequester) {
            facilityAccessGuard.checkFacilityAccess(swap.getFacility().getId());
        }

        if (swap.getStatus() != ShiftSwapStatus.PENDING) {
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
        return shiftSwapMapper.toResponse(swap);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<ShiftSwapResponse> getSwapRequests(
            UUID facilityId,
            ShiftSwapStatus status,
            UUID staffId,
            int page,
            int size
    ) {
        UUID scopedFacilityId = facilityAccessGuard.isFacilityScoped()
                ? facilityAccessGuard.scopedFacilityIdOrNull()
                : facilityId;

        Page<ShiftSwapResponse> result = shiftSwapRequestRepository.findAllWithFilters(
                scopedFacilityId,
                status,
                staffId,
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

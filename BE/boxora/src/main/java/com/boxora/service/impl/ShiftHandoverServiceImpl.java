package com.boxora.service.impl;

import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.ShiftHandoverAcknowledgeRequest;
import com.boxora.dto.request.ShiftHandoverCreateRequest;
import com.boxora.dto.response.ShiftHandoverResponse;
import com.boxora.entity.Facility;
import com.boxora.entity.ShiftHandover;
import com.boxora.entity.StaffAssignment;
import com.boxora.entity.User;
import com.boxora.enums.ActivityAction;
import com.boxora.enums.ShiftHandoverStatus;
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
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
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
        log.info("Creating shift handover for facilityId={}, shift={}, date={}",
                request.getFacilityId(), request.getShift(), request.getHandoverDate());

        facilityAccessGuard.checkFacilityAccess(request.getFacilityId());

        if (!Boolean.TRUE.equals(request.getChecklistCompleted())) {
            throw new AppException(ErrorCode.SHIFT_HANDOVER_CHECKLIST_INCOMPLETE);
        }

        Facility facility = facilityRepository.findById(request.getFacilityId())
                .orElseThrow(() -> new AppException(ErrorCode.FACILITY_NOT_FOUND));

        UUID currentUserId = requestContext.currentUserId();
        User outgoingStaff = userRepository.findById(currentUserId)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        User incomingStaff = null;
        if (request.getIncomingStaffId() != null) {
            incomingStaff = userRepository.findById(request.getIncomingStaffId()).orElse(null);
        }

        StaffAssignment outgoingAssignment = null;
        if (request.getOutgoingAssignmentId() != null) {
            outgoingAssignment = staffAssignmentRepository.findById(request.getOutgoingAssignmentId()).orElse(null);
        }

        StaffAssignment incomingAssignment = null;
        if (request.getIncomingAssignmentId() != null) {
            incomingAssignment = staffAssignmentRepository.findById(request.getIncomingAssignmentId()).orElse(null);
        }

        ShiftHandover handover = ShiftHandover.builder()
                .facility(facility)
                .handoverDate(request.getHandoverDate() != null ? request.getHandoverDate() : LocalDate.now())
                .shift(request.getShift())
                .outgoingStaff(outgoingStaff)
                .incomingStaff(incomingStaff)
                .outgoingAssignment(outgoingAssignment)
                .incomingAssignment(incomingAssignment)
                .pendingTasks(request.getPendingTasks())
                .pendingTicketsCount(request.getPendingTicketsCount() != null ? request.getPendingTicketsCount() : 0)
                .unresolvedBookingsCount(request.getUnresolvedBookingsCount() != null ? request.getUnresolvedBookingsCount() : 0)
                .cashInDrawer(request.getCashInDrawer() != null ? request.getCashInDrawer() : BigDecimal.ZERO)
                .facilityStatusNote(request.getFacilityStatusNote())
                .checklistCompleted(true)
                .notes(request.getNotes())
                .status(ShiftHandoverStatus.SUBMITTED)
                .build();

        ShiftHandover saved = shiftHandoverRepository.save(handover);

        activityLogService.record(
                facility.getId(),
                ActivityAction.SHIFT_HANDOVER_CREATE,
                "ShiftHandover",
                saved.getId(),
                String.format("Bàn giao ca trực %s tại %s ngày %s bởi %s",
                        saved.getShift(), facility.getName(), saved.getHandoverDate(), outgoingStaff.getFullName()),
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
        User currentUser = currentUserId != null ? userRepository.findById(currentUserId).orElse(null) : null;

        if (handover.getIncomingStaff() == null && currentUser != null) {
            handover.setIncomingStaff(currentUser);
        }

        handover.setStatus(request.getStatus());
        handover.setAcknowledgedAt(LocalDateTime.now());
        if (request.getNotes() != null && !request.getNotes().isBlank()) {
            String existingNotes = handover.getNotes() != null ? handover.getNotes() + "\n" : "";
            handover.setNotes(existingNotes + "[Tiếp nhận ca] " + request.getNotes());
        }

        ShiftHandover updated = shiftHandoverRepository.save(handover);

        activityLogService.record(
                handover.getFacility().getId(),
                ActivityAction.SHIFT_HANDOVER_ACKNOWLEDGE,
                "ShiftHandover",
                updated.getId(),
                String.format("Tiếp nhận bàn giao ca trực id=%s trạng thái: %s", updated.getId(), request.getStatus()),
                null,
                updated.getId().toString()
        );

        return shiftHandoverMapper.toResponse(updated);
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
            int page,
            int size
    ) {
        UUID scopedFacilityId = facilityAccessGuard.isFacilityScoped()
                ? facilityAccessGuard.scopedFacilityIdOrNull()
                : facilityId;

        Page<ShiftHandoverResponse> result = shiftHandoverRepository.findAllWithFilters(
                scopedFacilityId,
                date,
                status,
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

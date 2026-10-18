package com.boxora.service.impl;

import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.StaffAssignmentCreateRequest;
import com.boxora.dto.request.StaffAssignmentStatusUpdateRequest;
import com.boxora.dto.request.StaffAssignmentUpdateRequest;
import com.boxora.dto.request.StaffCheckInRequest;
import com.boxora.dto.request.StaffCheckOutRequest;
import com.boxora.dto.response.StaffAssignmentResponse;
import com.boxora.entity.Facility;
import com.boxora.entity.StaffAssignment;
import com.boxora.entity.User;
import com.boxora.enums.ActivityAction;
import com.boxora.enums.StaffAssignmentStatus;
import com.boxora.enums.StaffShift;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.mapper.StaffAssignmentMapper;
import com.boxora.repository.FacilityRepository;
import com.boxora.repository.StaffAssignmentRepository;
import com.boxora.repository.UserRepository;
import com.boxora.security.FacilityAccessGuard;
import com.boxora.security.RequestContext;
import com.boxora.service.ActivityLogService;
import com.boxora.service.StaffAssignmentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class StaffAssignmentServiceImpl implements StaffAssignmentService {

    private final StaffAssignmentRepository staffAssignmentRepository;
    private final UserRepository userRepository;
    private final FacilityRepository facilityRepository;
    private final StaffAssignmentMapper staffAssignmentMapper;
    private final ActivityLogService activityLogService;
    private final FacilityAccessGuard facilityAccessGuard;
    private final RequestContext requestContext;

    @Override
    public StaffAssignmentResponse createAssignment(StaffAssignmentCreateRequest request) {
        log.info("Creating staff assignment for staffId={} at facilityId={}, date={}, shift={}",
                request.getStaffId(), request.getFacilityId(), request.getAssignedDate(), request.getShift());

        // 1. Kiểm tra ngày phân công (không được phân công cho ngày trong quá khứ)
        if (request.getAssignedDate().isBefore(LocalDate.now())) {
            throw new AppException(ErrorCode.INVALID_ASSIGNMENT_DATE);
        }

        // 2. Kiểm tra cơ sở tồn tại và phân quyền quản lý cơ sở
        Facility facility = facilityRepository.findById(request.getFacilityId())
                .orElseThrow(() -> new AppException(ErrorCode.FACILITY_NOT_FOUND));
        facilityAccessGuard.checkFacilityAccess(facility.getId());

        // 3. Kiểm tra nhân viên tồn tại, kích hoạt và đúng vai trò STAFF
        User staff = userRepository.findById(request.getStaffId())
                .orElseThrow(() -> new AppException(ErrorCode.STAFF_USER_NOT_FOUND));

        if (!Boolean.TRUE.equals(staff.getIsActive())) {
            throw new AppException(ErrorCode.USER_NOT_FOUND);
        }

        if (staff.getRole() == null || !"STAFF".equalsIgnoreCase(staff.getRole().getName())) {
            throw new AppException(ErrorCode.USER_NOT_A_STAFF);
        }

        // Kiểm tra cơ sở trực thuộc của nhân viên nếu đã được gán cơ sở cố định
        if (staff.getFacility() != null && !staff.getFacility().getId().equals(facility.getId())) {
            throw new AppException(ErrorCode.STAFF_ASSIGNMENT_FACILITY_MISMATCH);
        }

        // 4. Kiểm tra trùng ca trực trong ngày của nhân viên
        boolean alreadyAssigned = staffAssignmentRepository.existsByStaff_IdAndAssignedDateAndShift(
                staff.getId(), request.getAssignedDate(), request.getShift()
        );
        if (alreadyAssigned) {
            throw new AppException(ErrorCode.STAFF_ALREADY_ASSIGNED_SHIFT);
        }

        // 5. Xác định người phân công (quản lý / admin hiện tại)
        User assignedBy = null;
        UUID currentUserId = requestContext.currentUserId();
        if (currentUserId != null) {
            assignedBy = userRepository.findById(currentUserId).orElse(null);
        }

        // 6. Xác định giờ bắt đầu / kết thúc ca (hỗ trợ ca qua đêm)
        java.time.LocalTime startTime = request.getStartTime();
        java.time.LocalTime endTime = request.getEndTime();
        if (startTime == null || endTime == null) {
            switch (request.getShift()) {
                case MORNING -> {
                    startTime = java.time.LocalTime.of(6, 0);
                    endTime = java.time.LocalTime.of(14, 0);
                }
                case AFTERNOON -> {
                    startTime = java.time.LocalTime.of(14, 0);
                    endTime = java.time.LocalTime.of(22, 0);
                }
                case NIGHT -> {
                    startTime = java.time.LocalTime.of(22, 0);
                    endTime = java.time.LocalTime.of(6, 0);
                }
                case FULL_DAY -> {
                    startTime = java.time.LocalTime.of(8, 0);
                    endTime = java.time.LocalTime.of(17, 0);
                }
            }
        }

        // 7. Tạo thực thể phân công ca
        StaffAssignment assignment = StaffAssignment.builder()
                .staff(staff)
                .facility(facility)
                .assignedDate(request.getAssignedDate())
                .shift(request.getShift())
                .startTime(startTime)
                .endTime(endTime)
                .assignedZone(request.getAssignedZone())
                .roleInShift(request.getRoleInShift() != null && !request.getRoleInShift().isBlank()
                        ? request.getRoleInShift() : "PRIMARY_STAFF")
                .status(StaffAssignmentStatus.ASSIGNED)
                .assignedBy(assignedBy)
                .notes(request.getNotes())
                .build();

        StaffAssignment saved = staffAssignmentRepository.save(assignment);

        // 7. Ghi nhật ký hoạt động
        activityLogService.record(
                facility.getId(),
                ActivityAction.STAFF_ASSIGNMENT_CREATE,
                "StaffAssignment",
                saved.getId(),
                String.format("Phân công nhân viên %s ca %s tại %s ngày %s",
                        staff.getFullName() != null ? staff.getFullName() : staff.getUsername(),
                        saved.getShift(),
                        facility.getName(),
                        saved.getAssignedDate()),
                null,
                saved.getId().toString()
        );

        return staffAssignmentMapper.toResponse(saved);
    }

    @Override
    public StaffAssignmentResponse updateAssignment(UUID id, StaffAssignmentUpdateRequest request) {
        log.info("Updating staff assignment id={}", id);

        StaffAssignment assignment = staffAssignmentRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.STAFF_ASSIGNMENT_NOT_FOUND));

        // Kiểm tra quyền cơ sở
        facilityAccessGuard.checkFacilityAccess(assignment.getFacility().getId());

        // Kiểm tra trùng ca nếu có thay đổi shift
        if (request.getShift() != null && request.getShift() != assignment.getShift()) {
            boolean duplicate = staffAssignmentRepository.existsByStaff_IdAndAssignedDateAndShiftAndIdNot(
                    assignment.getStaff().getId(),
                    assignment.getAssignedDate(),
                    request.getShift(),
                    assignment.getId()
            );
            if (duplicate) {
                throw new AppException(ErrorCode.STAFF_ALREADY_ASSIGNED_SHIFT);
            }
            assignment.setShift(request.getShift());
        }

        if (request.getStartTime() != null) {
            assignment.setStartTime(request.getStartTime());
        }

        if (request.getEndTime() != null) {
            assignment.setEndTime(request.getEndTime());
        }

        if (request.getAssignedZone() != null) {
            assignment.setAssignedZone(request.getAssignedZone());
        }

        if (request.getRoleInShift() != null && !request.getRoleInShift().isBlank()) {
            assignment.setRoleInShift(request.getRoleInShift());
        }

        if (request.getStatus() != null) {
            assignment.setStatus(request.getStatus());
        }

        if (request.getNotes() != null) {
            assignment.setNotes(request.getNotes());
        }

        StaffAssignment updated = staffAssignmentRepository.save(assignment);

        activityLogService.record(
                updated.getFacility().getId(),
                ActivityAction.STAFF_ASSIGNMENT_UPDATE,
                "StaffAssignment",
                updated.getId(),
                "Cập nhật thông tin phân công ca trực",
                null,
                updated.getId().toString()
        );

        return staffAssignmentMapper.toResponse(updated);
    }

    @Override
    public StaffAssignmentResponse checkIn(UUID id, StaffCheckInRequest request) {
        log.info("Staff check-in for assignment id={}", id);

        StaffAssignment assignment = staffAssignmentRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.STAFF_ASSIGNMENT_NOT_FOUND));

        // Kiểm tra quyền: Chỉ chính nhân viên được phân công HOẶC Quản lý cơ sở mới được check-in
        UUID currentUserId = requestContext.currentUserId();
        boolean isSelf = currentUserId != null && currentUserId.equals(assignment.getStaff().getId());
        if (!isSelf) {
            facilityAccessGuard.checkFacilityAccess(assignment.getFacility().getId());
        }

        if (assignment.getStatus() == StaffAssignmentStatus.CHECKED_IN) {
            throw new AppException(ErrorCode.STAFF_ALREADY_CHECKED_IN);
        }

        if (assignment.getStatus() == StaffAssignmentStatus.COMPLETED) {
            throw new AppException(ErrorCode.STAFF_ALREADY_CHECKED_OUT);
        }

        assignment.setStatus(StaffAssignmentStatus.CHECKED_IN);
        assignment.setCheckedInAt(java.time.LocalDateTime.now());
        if (request != null && request.getNotes() != null && !request.getNotes().isBlank()) {
            assignment.setCheckInNote(request.getNotes());
        }

        StaffAssignment updated = staffAssignmentRepository.save(assignment);

        activityLogService.record(
                updated.getFacility().getId(),
                ActivityAction.STAFF_CHECKIN,
                "StaffAssignment",
                updated.getId(),
                String.format("Nhân viên %s điểm danh vào ca %s ngày %s",
                        updated.getStaff().getFullName() != null ? updated.getStaff().getFullName() : updated.getStaff().getUsername(),
                        updated.getShift(),
                        updated.getAssignedDate()),
                null,
                updated.getId().toString()
        );

        return staffAssignmentMapper.toResponse(updated);
    }

    @Override
    public StaffAssignmentResponse checkOut(UUID id, StaffCheckOutRequest request) {
        log.info("Staff check-out for assignment id={}", id);

        StaffAssignment assignment = staffAssignmentRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.STAFF_ASSIGNMENT_NOT_FOUND));

        UUID currentUserId = requestContext.currentUserId();
        boolean isSelf = currentUserId != null && currentUserId.equals(assignment.getStaff().getId());
        if (!isSelf) {
            facilityAccessGuard.checkFacilityAccess(assignment.getFacility().getId());
        }

        if (assignment.getStatus() != StaffAssignmentStatus.CHECKED_IN) {
            if (assignment.getStatus() == StaffAssignmentStatus.COMPLETED) {
                throw new AppException(ErrorCode.STAFF_ALREADY_CHECKED_OUT);
            }
            throw new AppException(ErrorCode.STAFF_NOT_CHECKED_IN);
        }

        assignment.setStatus(StaffAssignmentStatus.COMPLETED);
        assignment.setCheckedOutAt(java.time.LocalDateTime.now());
        if (request != null && request.getNotes() != null && !request.getNotes().isBlank()) {
            assignment.setCheckOutNote(request.getNotes());
        }

        StaffAssignment updated = staffAssignmentRepository.save(assignment);

        activityLogService.record(
                updated.getFacility().getId(),
                ActivityAction.STAFF_CHECKOUT,
                "StaffAssignment",
                updated.getId(),
                String.format("Nhân viên %s hoàn thành ca trực %s ngày %s",
                        updated.getStaff().getFullName() != null ? updated.getStaff().getFullName() : updated.getStaff().getUsername(),
                        updated.getShift(),
                        updated.getAssignedDate()),
                null,
                updated.getId().toString()
        );

        return staffAssignmentMapper.toResponse(updated);
    }

    @Override
    public StaffAssignmentResponse updateStatus(UUID id, StaffAssignmentStatusUpdateRequest request) {
        log.info("Updating status for staff assignment id={} to status={}", id, request.getStatus());

        StaffAssignment assignment = staffAssignmentRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.STAFF_ASSIGNMENT_NOT_FOUND));

        // Cho phép quản lý cơ sở HOẶC chính nhân viên được phân công tự cập nhật trạng thái (check-in/hoàn thành)
        UUID currentUserId = requestContext.currentUserId();
        boolean isSelf = currentUserId != null && currentUserId.equals(assignment.getStaff().getId());
        if (!isSelf) {
            facilityAccessGuard.checkFacilityAccess(assignment.getFacility().getId());
        }

        assignment.setStatus(request.getStatus());
        if (request.getNotes() != null && !request.getNotes().isBlank()) {
            String existingNotes = assignment.getNotes() != null ? assignment.getNotes() + "\n" : "";
            assignment.setNotes(existingNotes + "[" + request.getStatus() + "] " + request.getNotes());
        }

        StaffAssignment updated = staffAssignmentRepository.save(assignment);

        activityLogService.record(
                updated.getFacility().getId(),
                ActivityAction.STAFF_ASSIGNMENT_UPDATE,
                "StaffAssignment",
                updated.getId(),
                "Cập nhật trạng thái ca trực thành: " + request.getStatus(),
                null,
                request.getStatus().name()
        );

        return staffAssignmentMapper.toResponse(updated);
    }

    @Override
    public void deleteAssignment(UUID id) {
        log.info("Deleting staff assignment id={}", id);

        StaffAssignment assignment = staffAssignmentRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.STAFF_ASSIGNMENT_NOT_FOUND));

        facilityAccessGuard.checkFacilityAccess(assignment.getFacility().getId());

        staffAssignmentRepository.delete(assignment);

        activityLogService.record(
                assignment.getFacility().getId(),
                ActivityAction.STAFF_ASSIGNMENT_REMOVE,
                "StaffAssignment",
                assignment.getId(),
                String.format("Hủy phân công ca trực của nhân viên %s ngày %s ca %s",
                        assignment.getStaff().getFullName(),
                        assignment.getAssignedDate(),
                        assignment.getShift()),
                assignment.getId().toString(),
                null
        );
    }

    @Override
    @Transactional(readOnly = true)
    public StaffAssignmentResponse getById(UUID id) {
        StaffAssignment assignment = staffAssignmentRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.STAFF_ASSIGNMENT_NOT_FOUND));

        facilityAccessGuard.checkFacilityAccess(assignment.getFacility().getId());

        return staffAssignmentMapper.toResponse(assignment);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<StaffAssignmentResponse> getAllAssignments(
            UUID facilityId,
            UUID staffId,
            LocalDate assignedDate,
            StaffShift shift,
            StaffAssignmentStatus status,
            LocalDate fromDate,
            LocalDate toDate,
            int page,
            int size,
            String sortBy,
            String sortDir
    ) {
        UUID scopedFacilityId = facilityAccessGuard.isFacilityScoped()
                ? facilityAccessGuard.scopedFacilityIdOrNull()
                : facilityId;

        Sort sort = "asc".equalsIgnoreCase(sortDir)
                ? Sort.by(sortBy).ascending()
                : Sort.by(sortBy).descending();

        Pageable pageable = PageRequest.of(page, size, sort);

        Page<StaffAssignmentResponse> result = staffAssignmentRepository.findAllWithFilters(
                scopedFacilityId,
                staffId,
                assignedDate,
                shift,
                status,
                fromDate,
                toDate,
                pageable
        ).map(staffAssignmentMapper::toResponse);

        return PageResponse.from(result);
    }

    @Override
    @Transactional(readOnly = true)
    public List<StaffAssignmentResponse> getDailyBoard(UUID facilityId, LocalDate date) {
        UUID targetFacilityId = facilityAccessGuard.isFacilityScoped()
                ? facilityAccessGuard.scopedFacilityIdOrNull()
                : facilityId;

        if (targetFacilityId == null) {
            throw new AppException(ErrorCode.FACILITY_NOT_FOUND);
        }

        facilityAccessGuard.checkFacilityAccess(targetFacilityId);

        LocalDate targetDate = (date != null) ? date : LocalDate.now();

        List<StaffAssignment> list = staffAssignmentRepository
                .findByFacility_IdAndAssignedDateOrderByShiftAscCreatedAtAsc(targetFacilityId, targetDate);

        return list.stream()
                .map(staffAssignmentMapper::toResponse)
                .toList();
    }
}

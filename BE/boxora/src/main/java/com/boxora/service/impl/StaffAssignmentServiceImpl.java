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
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class StaffAssignmentServiceImpl implements StaffAssignmentService {

    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

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
        if (request.getAssignedDate().isBefore(LocalDate.now(BUSINESS_ZONE))) {
            throw new AppException(ErrorCode.INVALID_ASSIGNMENT_DATE);
        }

        // 2. Kiểm tra cơ sở tồn tại và phân quyền quản lý cơ sở
        Facility facility = facilityRepository.findById(request.getFacilityId())
                .orElseThrow(() -> new AppException(ErrorCode.FACILITY_NOT_FOUND));
        facilityAccessGuard.checkFacilityAccess(facility.getId());

        // 3. Kiểm tra nhân viên tồn tại, kích hoạt và đúng vai trò
        User staff = userRepository.findById(request.getStaffId())
                .orElseThrow(() -> new AppException(ErrorCode.STAFF_USER_NOT_FOUND));

        if (!Boolean.TRUE.equals(staff.getIsActive())) {
            throw new AppException(ErrorCode.USER_NOT_FOUND);
        }

        String callerRole = requestContext.currentUserRole();
        UUID currentUserId = requestContext.currentUserId();

        if ("FACILITY_MANAGER".equalsIgnoreCase(callerRole)) {
            // FM cannot self-assign
            if (staff.getId().equals(currentUserId)) {
                throw new AppException(ErrorCode.FORBIDDEN, "Quản lý cơ sở không được tự phân ca cho chính mình");
            }
            // FM cannot assign FM
            if (staff.getRole() != null && "FACILITY_MANAGER".equalsIgnoreCase(staff.getRole().getName())) {
                throw new AppException(ErrorCode.FORBIDDEN, "Quản lý cơ sở không được phân ca cho Quản lý cơ sở khác");
            }
            // FM can ONLY assign STAFF
            if (staff.getRole() == null || !"STAFF".equalsIgnoreCase(staff.getRole().getName())) {
                throw new AppException(ErrorCode.USER_NOT_A_STAFF);
            }
            // Kiểm tra cơ sở trực thuộc của nhân viên
            if (staff.getFacility() != null && !staff.getFacility().getId().equals(facility.getId())) {
                throw new AppException(ErrorCode.STAFF_ASSIGNMENT_FACILITY_MISMATCH);
            }
        } else if ("BUSINESS_MANAGER".equalsIgnoreCase(callerRole)) {
            // Business Manager có thể phân công ca cho cả Quản lý cơ sở (FACILITY_MANAGER) và Nhân viên (STAFF)
            if (staff.getRole() == null || (!"FACILITY_MANAGER".equalsIgnoreCase(staff.getRole().getName()) && !"STAFF".equalsIgnoreCase(staff.getRole().getName()))) {
                throw new AppException(ErrorCode.FORBIDDEN, "Business Manager chỉ được phân công ca cho Quản lý cơ sở hoặc Nhân viên");
            }
            // Kiểm tra cơ sở trực thuộc của Quản lý cơ sở / Nhân viên
            if (staff.getFacility() != null && !staff.getFacility().getId().equals(facility.getId())) {
                throw new AppException(ErrorCode.STAFF_ASSIGNMENT_FACILITY_MISMATCH);
            }
        } else if ("ADMIN".equalsIgnoreCase(callerRole) || "SYSTEM_ADMIN".equalsIgnoreCase(callerRole)) {
            throw new AppException(ErrorCode.FORBIDDEN, "Admin chỉ có quyền xem, giám sát ca trực toàn hệ thống và không được tạo phân công ca trực.");
        } else {
            throw new AppException(ErrorCode.FORBIDDEN, "Tài khoản không có quyền tạo phân công ca trực");
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
        if (currentUserId != null) {
            assignedBy = userRepository.findById(currentUserId).orElse(null);
        }

        // 6. Xác định giờ bắt đầu / kết thúc ca chuẩn hóa
        if (request.getShift() == StaffShift.FULL_DAY) {
            throw new AppException(ErrorCode.INVALID_REQUEST,
                    "Hệ thống chỉ cho phép phân công 3 ca chuẩn: Ca Sáng (06:00 - 14:00), Ca Chiều (14:00 - 22:00), Ca Đêm (22:00 - 06:00)");
        }
        java.time.LocalTime standardStart = request.getShift().getDefaultStartTime();
        java.time.LocalTime standardEnd = request.getShift().getDefaultEndTime();
        if (request.getStartTime() != null && !request.getStartTime().equals(standardStart)) {
            throw new AppException(ErrorCode.INVALID_REQUEST,
                    String.format("Giờ bắt đầu cho ca %s phải là %s", request.getShift().getDisplayName(), standardStart));
        }
        if (request.getEndTime() != null && !request.getEndTime().equals(standardEnd)) {
            throw new AppException(ErrorCode.INVALID_REQUEST,
                    String.format("Giờ kết thúc cho ca %s phải là %s", request.getShift().getDisplayName(), standardEnd));
        }
        java.time.LocalTime startTime = standardStart;
        java.time.LocalTime endTime = standardEnd;
        validateShiftNotInPast(request.getAssignedDate(), startTime, endTime, request.getShift());
        ensureNoOverlappingAssignment(staff.getId(), request.getAssignedDate(), startTime, endTime, null);

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

        String callerRole = requestContext.currentUserRole();
        UUID currentUserId = requestContext.currentUserId();

        if ("FACILITY_MANAGER".equalsIgnoreCase(callerRole)) {
            if (assignment.getStaff().getRole() == null || !"STAFF".equalsIgnoreCase(assignment.getStaff().getRole().getName())) {
                throw new AppException(ErrorCode.FORBIDDEN, "Quản lý cơ sở chỉ được cập nhật lịch của nhân viên (STAFF)");
            }
            if (assignment.getStaff().getId().equals(currentUserId)) {
                throw new AppException(ErrorCode.FORBIDDEN, "Quản lý cơ sở không được chỉnh sửa lịch của chính mình");
            }
        } else if ("BUSINESS_MANAGER".equalsIgnoreCase(callerRole)) {
            if (assignment.getStaff().getRole() == null || !"FACILITY_MANAGER".equalsIgnoreCase(assignment.getStaff().getRole().getName())) {
                throw new AppException(ErrorCode.FORBIDDEN, "Business Manager chỉ được cập nhật lịch của Quản lý cơ sở (FACILITY_MANAGER)");
            }
        } else {
            throw new AppException(ErrorCode.FORBIDDEN, "Tài khoản không có quyền cập nhật phân công ca trực");
        }

        if (assignment.getStatus() != StaffAssignmentStatus.ASSIGNED) {
            throw new AppException(ErrorCode.INVALID_REQUEST,
                    "Attendance records cannot be edited as a schedule");
        }

        if (request.getShift() == StaffShift.FULL_DAY) {
            throw new AppException(ErrorCode.INVALID_REQUEST,
                    "Hệ thống chỉ cho phép phân công 3 ca chuẩn: Ca Sáng (06:00 - 14:00), Ca Chiều (14:00 - 22:00), Ca Đêm (22:00 - 06:00)");
        }
        StaffShift effectiveShift = request.getShift() != null ? request.getShift() : assignment.getShift();
        java.time.LocalTime standardStart = effectiveShift.getDefaultStartTime();
        java.time.LocalTime standardEnd = effectiveShift.getDefaultEndTime();
        if (request.getStartTime() != null && !request.getStartTime().equals(standardStart)) {
            throw new AppException(ErrorCode.INVALID_REQUEST,
                    String.format("Giờ bắt đầu cho ca %s phải là %s", effectiveShift.getDisplayName(), standardStart));
        }
        if (request.getEndTime() != null && !request.getEndTime().equals(standardEnd)) {
            throw new AppException(ErrorCode.INVALID_REQUEST,
                    String.format("Giờ kết thúc cho ca %s phải là %s", effectiveShift.getDisplayName(), standardEnd));
        }


        java.time.LocalTime effectiveStartTime = standardStart;
        java.time.LocalTime effectiveEndTime = standardEnd;
        validateShiftNotInPast(assignment.getAssignedDate(), effectiveStartTime, effectiveEndTime, effectiveShift);

        ensureNoOverlappingAssignment(
                assignment.getStaff().getId(), assignment.getAssignedDate(),
                effectiveStartTime, effectiveEndTime, assignment.getId());

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

        assignment.setStartTime(effectiveStartTime);
        assignment.setEndTime(effectiveEndTime);

        if (request.getAssignedZone() != null) {
            assignment.setAssignedZone(request.getAssignedZone());
        }

        if (request.getRoleInShift() != null && !request.getRoleInShift().isBlank()) {
            assignment.setRoleInShift(request.getRoleInShift());
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

        UUID currentUserId = requestContext.currentUserId();
        boolean isSelf = currentUserId != null && currentUserId.equals(assignment.getStaff().getId());
        facilityAccessGuard.checkFacilityAccess(assignment.getFacility().getId());
        if (!isSelf) {
            throw new AppException(ErrorCode.FORBIDDEN, "Chỉ được check-in ca trực của chính mình");
        }

        if (assignment.getStatus() == StaffAssignmentStatus.CHECKED_IN) {
            throw new AppException(ErrorCode.STAFF_ALREADY_CHECKED_IN);
        }

        if (assignment.getStatus() == StaffAssignmentStatus.COMPLETED) {
            throw new AppException(ErrorCode.STAFF_ALREADY_CHECKED_OUT);
        }

        if (assignment.getStatus() != StaffAssignmentStatus.ASSIGNED) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Only an assigned shift can be checked in");
        }

        java.time.LocalTime startTime = assignment.getStartTime();
        java.time.LocalTime endTime = assignment.getEndTime();
        if (startTime == null || endTime == null) {
            java.time.LocalTime[] defaults = defaultShiftTimes(assignment.getShift());
            startTime = defaults[0];
            endTime = defaults[1];
        }
        if (startTime.equals(endTime)) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "The assigned shift has no valid check-in window");
        }
        java.time.LocalDateTime shiftStart = assignment.getAssignedDate().atTime(startTime);
        java.time.LocalDateTime shiftEnd = assignment.getAssignedDate().atTime(endTime);
        if (!endTime.isAfter(startTime)) {
            shiftEnd = shiftEnd.plusDays(1);
        }
        java.time.LocalDateTime now = java.time.LocalDateTime.now(BUSINESS_ZONE);
        if (now.isBefore(shiftStart) || !now.isBefore(shiftEnd)) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Check-in is only available during the assigned shift window");
        }

        assignment.setStatus(StaffAssignmentStatus.CHECKED_IN);
        assignment.setCheckedInAt(now);
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
        facilityAccessGuard.checkFacilityAccess(assignment.getFacility().getId());
        if (!isSelf) {
            throw new AppException(ErrorCode.FORBIDDEN, "Chỉ được check-out ca trực của chính mình");
        }

        if (assignment.getStatus() != StaffAssignmentStatus.CHECKED_IN) {
            if (assignment.getStatus() == StaffAssignmentStatus.COMPLETED) {
                throw new AppException(ErrorCode.STAFF_ALREADY_CHECKED_OUT);
            }
            if (assignment.getStatus() == StaffAssignmentStatus.ABSENT) {
                throw new AppException(ErrorCode.INVALID_REQUEST, "Ca trực này đã bị ghi nhận không đi làm (vắng mặt) do quá hạn ngày làm việc.");
            }
            throw new AppException(ErrorCode.STAFF_NOT_CHECKED_IN);
        }

        LocalDate assignedDate = assignment.getAssignedDate();
        LocalDate todayDate = LocalDate.now(BUSINESS_ZONE);
        boolean isNight = assignment.getShift() == StaffShift.NIGHT;
        LocalDate maxCheckoutDay = isNight ? assignedDate.plusDays(1) : assignedDate;
        if (todayDate.isAfter(maxCheckoutDay)) {
            assignment.setStatus(StaffAssignmentStatus.ABSENT);
            assignment.setNotes((assignment.getNotes() != null ? assignment.getNotes() + "\n" : "") +
                    "[HỆ THỐNG]: Quên ra ca trong ngày làm việc -> Ghi nhận không đi làm (vắng mặt - 0 công)");
            staffAssignmentRepository.save(assignment);
            throw new AppException(ErrorCode.INVALID_REQUEST,
                    "Ca trực này đã quá hạn trong ngày làm việc. Hệ thống đã tự động ghi nhận không đi làm do quên ra ca.");
        }

        assignment.setStatus(StaffAssignmentStatus.COMPLETED);
        assignment.setCheckedOutAt(java.time.LocalDateTime.now(BUSINESS_ZONE));
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

        String currentRole = requestContext.currentUserRole();
        if (request.getStatus() == StaffAssignmentStatus.CHECKED_IN) {
            return checkIn(id, new StaffCheckInRequest(request.getNotes()));
        }
        if (request.getStatus() == StaffAssignmentStatus.COMPLETED) {
            return checkOut(id, new com.boxora.dto.request.StaffCheckOutRequest(request.getNotes()));
        }
        if (!"FACILITY_MANAGER".equalsIgnoreCase(currentRole)) {
            throw new AppException(ErrorCode.FORBIDDEN);
        }

        StaffAssignment assignment = staffAssignmentRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.STAFF_ASSIGNMENT_NOT_FOUND));

        // Cho phép quản lý cơ sở HOẶC chính nhân viên được phân công tự cập nhật trạng thái (check-in/hoàn thành)
        facilityAccessGuard.checkFacilityAccess(assignment.getFacility().getId());

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

        String callerRole = requestContext.currentUserRole();
        UUID currentUserId = requestContext.currentUserId();

        if ("FACILITY_MANAGER".equalsIgnoreCase(callerRole)) {
            if (assignment.getStaff().getRole() == null || !"STAFF".equalsIgnoreCase(assignment.getStaff().getRole().getName())) {
                throw new AppException(ErrorCode.FORBIDDEN, "Quản lý cơ sở chỉ được hủy phân công của nhân viên (STAFF)");
            }
            if (assignment.getStaff().getId().equals(currentUserId)) {
                throw new AppException(ErrorCode.FORBIDDEN, "Quản lý cơ sở không được hủy lịch của chính mình");
            }
        } else if ("BUSINESS_MANAGER".equalsIgnoreCase(callerRole)) {
            if (assignment.getStaff().getRole() == null || !"FACILITY_MANAGER".equalsIgnoreCase(assignment.getStaff().getRole().getName())) {
                throw new AppException(ErrorCode.FORBIDDEN, "Business Manager chỉ được hủy phân công của Quản lý cơ sở (FACILITY_MANAGER)");
            }
        } else {
            throw new AppException(ErrorCode.FORBIDDEN, "Tài khoản không có quyền hủy phân công ca trực");
        }

        if (assignment.getStatus() != StaffAssignmentStatus.ASSIGNED) {
            throw new AppException(ErrorCode.INVALID_REQUEST,
                    "Attendance history cannot be deleted or cancelled");
        }

        assignment.setStatus(StaffAssignmentStatus.CANCELLED);
        staffAssignmentRepository.save(assignment);

        activityLogService.record(
                assignment.getFacility().getId(),
                ActivityAction.STAFF_ASSIGNMENT_REMOVE,
                "StaffAssignment",
                assignment.getId(),
                String.format("Hủy phân công ca trực của nhân viên %s ngày %s ca %s",
                        assignment.getStaff().getFullName(),
                        assignment.getAssignedDate(),
                        assignment.getShift()),
                StaffAssignmentStatus.ASSIGNED.name(),
                StaffAssignmentStatus.CANCELLED.name()
        );
    }

    @Override
    @Transactional(readOnly = true)
    public StaffAssignmentResponse getById(UUID id) {
        StaffAssignment assignment = staffAssignmentRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.STAFF_ASSIGNMENT_NOT_FOUND));

        facilityAccessGuard.checkFacilityAccess(assignment.getFacility().getId());
        if ("STAFF".equalsIgnoreCase(requestContext.currentUserRole())
                && !assignment.getStaff().getId().equals(requestContext.currentUserId())) {
            throw new AppException(ErrorCode.FORBIDDEN);
        }

        return staffAssignmentMapper.toResponse(assignment);
    }

    @org.springframework.scheduling.annotation.Scheduled(fixedDelay = 60_000L)
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.REQUIRES_NEW)
    public void autoMarkAbsentShifts() {
        LocalDate today = LocalDate.now(BUSINESS_ZONE);
        LocalDate yesterday = today.minusDays(1);
        java.time.LocalTime nowTime = java.time.LocalTime.now(BUSINESS_ZONE);
        try {
            int priorCount = staffAssignmentRepository.markPriorToYesterdayUncheckedInAsAbsent(yesterday);
            int yesterdayCount = staffAssignmentRepository.markYesterdayEndedUncheckedInAsAbsent(yesterday, nowTime);
            int todayCount = staffAssignmentRepository.markTodayEndedUncheckedInAsAbsent(today, nowTime);
            int overdueCheckedInCount = staffAssignmentRepository.markOverdueCheckedInAsAbsent(today, yesterday, nowTime);
            if (priorCount > 0 || yesterdayCount > 0 || todayCount > 0 || overdueCheckedInCount > 0) {
                log.info("Auto-marked unchecked-in or overdue shifts as ABSENT: {} prior, {} yesterday, {} today, {} overdue checked-in",
                        priorCount, yesterdayCount, todayCount, overdueCheckedInCount);
            }
        } catch (Exception e) {
            log.warn("Failed to auto-mark absent shifts: {}", e.getMessage());
        }
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
        if (fromDate != null && toDate != null && toDate.isBefore(fromDate)) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "toDate must be on or after fromDate");
        }

        UUID scopedFacilityId = facilityAccessGuard.isFacilityScoped()
                ? facilityAccessGuard.scopedFacilityIdOrNull()
                : facilityId;

        UUID effectiveStaffId = staffId;
        if ("STAFF".equalsIgnoreCase(requestContext.currentUserRole())) {
            effectiveStaffId = requestContext.currentUserId();
            if (effectiveStaffId == null) {
                throw new AppException(ErrorCode.UNAUTHORIZED);
            }
        }

        Sort sort = "asc".equalsIgnoreCase(sortDir)
                ? Sort.by(sortBy).ascending()
                : Sort.by(sortBy).descending();

        Pageable pageable = PageRequest.of(page, size, sort);

        final UUID targetFacilityId = scopedFacilityId;
        final UUID targetStaffId = effectiveStaffId;

        Specification<StaffAssignment> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (targetFacilityId != null) {
                predicates.add(cb.equal(root.get("facility").get("id"), targetFacilityId));
            }
            if (targetStaffId != null) {
                predicates.add(cb.equal(root.get("staff").get("id"), targetStaffId));
            }
            if (assignedDate != null) {
                predicates.add(cb.equal(root.get("assignedDate"), assignedDate));
            }
            if (shift != null) {
                predicates.add(cb.equal(root.get("shift"), shift));
            }
            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            if (fromDate != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("assignedDate"), fromDate));
            }
            if (toDate != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("assignedDate"), toDate));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };

        Page<StaffAssignmentResponse> result = staffAssignmentRepository.findAll(spec, pageable)
                .map(staffAssignmentMapper::toResponse);

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

        LocalDate targetDate = (date != null) ? date : LocalDate.now(BUSINESS_ZONE);

        List<StaffAssignment> list = staffAssignmentRepository
                .findByFacility_IdAndAssignedDateOrderByShiftAscCreatedAtAsc(targetFacilityId, targetDate);
        if ("STAFF".equalsIgnoreCase(requestContext.currentUserRole())) {
            list = staffAssignmentRepository.findByStaff_IdAndAssignedDate(requestContext.currentUserId(), targetDate)
                    .stream()
                    .filter(assignment -> assignment.getFacility() != null
                            && targetFacilityId.equals(assignment.getFacility().getId()))
                    .toList();
        }

        return list.stream()
                .map(staffAssignmentMapper::toResponse)
                .toList();
    }

    private void ensureNoOverlappingAssignment(
            UUID staffId,
            LocalDate assignedDate,
            java.time.LocalTime startTime,
            java.time.LocalTime endTime,
            UUID excludedAssignmentId
    ) {
        if (startTime == null || endTime == null || startTime.equals(endTime)) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Shift start and end times must define a non-empty interval");
        }

        java.time.LocalDateTime candidateStart = assignedDate.atTime(startTime);
        java.time.LocalDateTime candidateEnd = assignedDate.atTime(endTime);
        if (!endTime.isAfter(startTime)) {
            candidateEnd = candidateEnd.plusDays(1);
        }

        List<StaffAssignment> nearbyAssignments = staffAssignmentRepository.findByStaff_IdAndAssignedDateBetween(
                staffId, assignedDate.minusDays(1), assignedDate.plusDays(1));
        for (StaffAssignment existing : nearbyAssignments) {
            if (java.util.Objects.equals(existing.getId(), excludedAssignmentId)
                    || existing.getStatus() == StaffAssignmentStatus.CANCELLED) {
                continue;
            }

            java.time.LocalTime existingStartTime = existing.getStartTime();
            java.time.LocalTime existingEndTime = existing.getEndTime();
            if (existingStartTime == null || existingEndTime == null) {
                java.time.LocalTime[] times = defaultShiftTimes(existing.getShift());
                existingStartTime = times[0];
                existingEndTime = times[1];
            }
            if (existingStartTime.equals(existingEndTime)) {
                throw new AppException(ErrorCode.STAFF_ALREADY_ASSIGNED_SHIFT);
            }

            java.time.LocalDateTime existingStart = existing.getAssignedDate().atTime(existingStartTime);
            java.time.LocalDateTime existingEnd = existing.getAssignedDate().atTime(existingEndTime);
            if (!existingEndTime.isAfter(existingStartTime)) {
                existingEnd = existingEnd.plusDays(1);
            }

            if (candidateStart.isBefore(existingEnd) && existingStart.isBefore(candidateEnd)) {
                throw new AppException(ErrorCode.STAFF_ALREADY_ASSIGNED_SHIFT);
            }
        }
    }

    private void validateShiftNotInPast(
            LocalDate assignedDate,
            java.time.LocalTime startTime,
            java.time.LocalTime endTime,
            StaffShift shift
    ) {
        LocalDate today = LocalDate.now(BUSINESS_ZONE);
        if (assignedDate == null || assignedDate.isBefore(today)) {
            throw new AppException(ErrorCode.INVALID_ASSIGNMENT_DATE);
        }
        java.time.LocalDateTime now = java.time.LocalDateTime.now(BUSINESS_ZONE);
        java.time.LocalDateTime shiftEnd = assignedDate.atTime(endTime);
        if (!endTime.isAfter(startTime)) {
            shiftEnd = shiftEnd.plusDays(1);
        }
        if (!now.isBefore(shiftEnd)) {
            String shiftName = shift != null ? shift.getDisplayName() : "Ca trực";
            throw new AppException(ErrorCode.INVALID_ASSIGNMENT_DATE,
                    String.format("Không thể phân công %s (%s - %s) ngày %s vì khung giờ ca trực này đã trôi qua. Chỉ được phân ca cho thời gian hiện tại đến tương lai.",
                            shiftName, startTime, endTime, assignedDate));
        }
    }

    private java.time.LocalTime[] defaultShiftTimes(StaffShift shift) {
        if (shift == null) {
            return new java.time.LocalTime[]{java.time.LocalTime.of(6, 0), java.time.LocalTime.of(14, 0)};
        }
        return new java.time.LocalTime[]{shift.getDefaultStartTime(), shift.getDefaultEndTime()};
    }
}

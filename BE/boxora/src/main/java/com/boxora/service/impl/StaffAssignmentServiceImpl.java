package com.boxora.service.impl;

import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.StaffAssignmentCreateRequest;
import com.boxora.dto.request.StaffAssignmentStatusUpdateRequest;
import com.boxora.dto.request.StaffAssignmentUpdateRequest;
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
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
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
            throw new AppException(ErrorCode.INVALID_ASSIGNMENT_DATE, "Không thể phân công ca trực cho ngày đã qua");
        }

        // 2. Kiểm tra cơ sở tồn tại và phân quyền quản lý cơ sở
        Facility facility = facilityRepository.findById(request.getFacilityId())
                .orElseThrow(() -> new AppException(ErrorCode.FACILITY_NOT_FOUND, "Không tìm thấy cơ sở"));
        checkFacility(facility.getId());

        // 3. Kiểm tra nhân viên tồn tại, kích hoạt và đúng vai trò STAFF
        // The staff row is locked so two concurrent requests cannot both pass the overlap check below.
        User staff = userRepository.findByIdForUpdate(request.getStaffId())
                .orElseThrow(() -> new AppException(ErrorCode.STAFF_USER_NOT_FOUND, "Không tìm thấy nhân viên"));

        if (!Boolean.TRUE.equals(staff.getIsActive())) {
            throw new AppException(ErrorCode.USER_NOT_FOUND, "Tài khoản nhân viên đang ngừng hoạt động");
        }

        if (staff.getRole() == null || !"STAFF".equalsIgnoreCase(staff.getRole().getName())) {
            throw new AppException(ErrorCode.USER_NOT_A_STAFF, "Chỉ phân công ca trực cho tài khoản nhân viên");
        }

        // Kiểm tra cơ sở trực thuộc của nhân viên nếu đã được gán cơ sở cố định
        if (staff.getFacility() != null && !staff.getFacility().getId().equals(facility.getId())) {
            throw new AppException(ErrorCode.STAFF_ASSIGNMENT_FACILITY_MISMATCH, "Nhân viên không thuộc cơ sở được chọn");
        }

        // 4. Kiểm tra trùng / chồng giờ ca trực trong ngày của nhân viên (ca cả ngày chồng lên mọi ca khác)
        assertNoShiftConflict(staff.getId(), request.getAssignedDate(), request.getShift(), null);

        // 5. Xác định người phân công (quản lý / admin hiện tại)
        User assignedBy = null;
        UUID currentUserId = requestContext.currentUserId();
        if (currentUserId != null) {
            assignedBy = userRepository.findById(currentUserId).orElse(null);
        }

        // 6. Tạo thực thể phân công ca
        StaffAssignment assignment = StaffAssignment.builder()
                .staff(staff)
                .facility(facility)
                .assignedDate(request.getAssignedDate())
                .shift(request.getShift())
                .assignedZone(blankToNull(request.getAssignedZone()))
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
                String.format("Phân công nhân viên %s %s tại %s ngày %s",
                        staff.getFullName() != null ? staff.getFullName() : staff.getUsername(),
                        shiftLabel(saved.getShift()),
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
                .orElseThrow(() -> new AppException(ErrorCode.STAFF_ASSIGNMENT_NOT_FOUND, "Không tìm thấy lượt phân công ca trực"));

        // Kiểm tra quyền cơ sở
        checkFacility(assignment.getFacility().getId());

        boolean shiftChanged = request.getShift() != null && request.getShift() != assignment.getShift();
        boolean zoneChanged = request.getAssignedZone() != null
                && !Objects.equals(blankToNull(request.getAssignedZone()), blankToNull(assignment.getAssignedZone()));
        boolean roleChanged = request.getRoleInShift() != null && !request.getRoleInShift().isBlank()
                && !request.getRoleInShift().equals(assignment.getRoleInShift());

        // Ca đã diễn ra / đã điểm danh / đã hoàn thành chỉ còn sửa được ghi chú và trạng thái
        if ((shiftChanged || zoneChanged || roleChanged) && !isStructurallyEditable(assignment)) {
            throw new AppException(ErrorCode.STAFF_ASSIGNMENT_LOCKED);
        }

        if (shiftChanged) {
            // Khóa dòng nhân viên để hai yêu cầu đồng thời không cùng vượt qua kiểm tra chồng giờ
            userRepository.findByIdForUpdate(assignment.getStaff().getId());
            assertNoShiftConflict(assignment.getStaff().getId(), assignment.getAssignedDate(), request.getShift(), assignment.getId());
            assignment.setShift(request.getShift());
        }

        if (zoneChanged) {
            assignment.setAssignedZone(blankToNull(request.getAssignedZone()));
        }

        if (roleChanged) {
            assignment.setRoleInShift(request.getRoleInShift());
        }

        if (request.getStatus() != null) {
            applyStatus(assignment, request.getStatus(), false);
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
    public StaffAssignmentResponse updateStatus(UUID id, StaffAssignmentStatusUpdateRequest request) {
        log.info("Updating status for staff assignment id={} to status={}", id, request.getStatus());

        StaffAssignment assignment = staffAssignmentRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.STAFF_ASSIGNMENT_NOT_FOUND, "Không tìm thấy lượt phân công ca trực"));

        // Cho phép quản lý cơ sở HOẶC chính nhân viên được phân công tự cập nhật trạng thái (check-in/hoàn thành)
        UUID currentUserId = requestContext.currentUserId();
        boolean isSelf = currentUserId != null && currentUserId.equals(assignment.getStaff().getId());
        if (!isSelf) {
            checkFacility(assignment.getFacility().getId());
        }

        applyStatus(assignment, request.getStatus(), isSelf);
        if (request.getNotes() != null && !request.getNotes().isBlank()) {
            String existingNotes = assignment.getNotes() != null ? assignment.getNotes() + "\n" : "";
            assignment.setNotes(existingNotes + "[" + statusLabel(request.getStatus()) + "] " + request.getNotes());
        }

        StaffAssignment updated = staffAssignmentRepository.save(assignment);

        activityLogService.record(
                updated.getFacility().getId(),
                ActivityAction.STAFF_ASSIGNMENT_UPDATE,
                "StaffAssignment",
                updated.getId(),
                "Cập nhật trạng thái " + shiftLabel(assignment.getShift()) + " ngày " + assignment.getAssignedDate() + ": " + statusLabel(assignment.getStatus()),
                null,
                request.getStatus().name()
        );

        return staffAssignmentMapper.toResponse(updated);
    }

    @Override
    public void deleteAssignment(UUID id) {
        log.info("Deleting staff assignment id={}", id);

        StaffAssignment assignment = staffAssignmentRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.STAFF_ASSIGNMENT_NOT_FOUND, "Không tìm thấy lượt phân công ca trực"));

        checkFacility(assignment.getFacility().getId());

        staffAssignmentRepository.delete(assignment);

        activityLogService.record(
                assignment.getFacility().getId(),
                ActivityAction.STAFF_ASSIGNMENT_REMOVE,
                "StaffAssignment",
                assignment.getId(),
                String.format("Hủy phân công %s của nhân viên %s ngày %s",
                        shiftLabel(assignment.getShift()),
                        assignment.getStaff().getFullName(),
                        assignment.getAssignedDate()),
                assignment.getId().toString(),
                null
        );
    }

    @Override
    @Transactional(readOnly = true)
    public StaffAssignmentResponse getById(UUID id) {
        StaffAssignment assignment = staffAssignmentRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.STAFF_ASSIGNMENT_NOT_FOUND, "Không tìm thấy lượt phân công ca trực"));

        checkFacility(assignment.getFacility().getId());

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
        UUID scopedFacilityId = resolveScope(facilityId);

        String sortProperty = SORTABLE_FIELDS.contains(sortBy) ? sortBy : "assignedDate";
        Sort sort = "asc".equalsIgnoreCase(sortDir)
                ? Sort.by(sortProperty).ascending()
                : Sort.by(sortProperty).descending();

        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 200), sort);

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
        UUID targetFacilityId = resolveScope(facilityId);
        LocalDate targetDate = (date != null) ? date : LocalDate.now();

        // System-wide roles in the "all facilities" scope get every facility's board for the day.
        List<StaffAssignment> list = targetFacilityId == null
                ? staffAssignmentRepository.findAllFacilitiesBoard(targetDate)
                : staffAssignmentRepository.findByFacility_IdAndAssignedDateOrderByShiftAscCreatedAtAsc(targetFacilityId, targetDate);

        return list.stream()
                .map(staffAssignmentMapper::toResponse)
                .toList();
    }

    private static final java.util.Set<String> SORTABLE_FIELDS =
            java.util.Set.of("assignedDate", "shift", "status", "createdAt", "updatedAt");

    /** Facility-scoped roles always see their own facility; a scoped account without a facility sees nothing. */
    private UUID resolveScope(UUID requested) {
        if (facilityAccessGuard.isFacilityScoped()) {
            UUID own = requestContext.currentUserFacilityId();
            if (own == null || (requested != null && !requested.equals(own))) {
                throw new AppException(ErrorCode.FACILITY_ACCESS_DENIED);
            }
            return own;
        }
        return requested;
    }

    private void checkFacility(UUID facilityId) {
        if (facilityAccessGuard.isFacilityScoped() && requestContext.currentUserFacilityId() == null) {
            throw new AppException(ErrorCode.FACILITY_ACCESS_DENIED);
        }
        facilityAccessGuard.checkFacilityAccess(facilityId);
    }

    // ------------------------------------------------------------------ shift overlap & status rules

    /**
     * Allowed moves: ASSIGNED to CHECKED_IN or ABSENT; CHECKED_IN to COMPLETED; ABSENT back to ASSIGNED or on to CHECKED_IN
     * (late arrival); COMPLETED is final.
     */
    private static final Map<StaffAssignmentStatus, Set<StaffAssignmentStatus>> ALLOWED_TRANSITIONS = new EnumMap<>(Map.of(
            StaffAssignmentStatus.ASSIGNED, EnumSet.of(StaffAssignmentStatus.CHECKED_IN, StaffAssignmentStatus.ABSENT),
            StaffAssignmentStatus.CHECKED_IN, EnumSet.of(StaffAssignmentStatus.COMPLETED),
            StaffAssignmentStatus.ABSENT, EnumSet.of(StaffAssignmentStatus.ASSIGNED, StaffAssignmentStatus.CHECKED_IN),
            StaffAssignmentStatus.COMPLETED, EnumSet.noneOf(StaffAssignmentStatus.class)
    ));

    /** Two different shifts overlap only when one of them is FULL_DAY (morning, afternoon and night do not overlap). */
    static boolean shiftsOverlap(StaffShift a, StaffShift b) {
        return a != null && b != null && a != b && (a == StaffShift.FULL_DAY || b == StaffShift.FULL_DAY);
    }

    /**
     * Rejects a shift the staff member cannot work: the identical shift twice, or a full-day shift together with any other
     * shift on the same day (in any facility). A shift already marked absent no longer blocks a replacement shift.
     */
    private void assertNoShiftConflict(UUID staffId, LocalDate date, StaffShift shift, UUID excludeAssignmentId) {
        List<StaffAssignment> sameDay = staffAssignmentRepository.findByStaff_IdAndAssignedDate(staffId, date);
        if (sameDay == null) {
            return;
        }
        for (StaffAssignment other : sameDay) {
            if (excludeAssignmentId != null && excludeAssignmentId.equals(other.getId())) {
                continue;
            }
            if (other.getShift() == shift) {
                throw new AppException(ErrorCode.STAFF_ALREADY_ASSIGNED_SHIFT, "Nhân viên đã được phân công ca này trong ngày");
            }
            if (other.getStatus() != StaffAssignmentStatus.ABSENT && shiftsOverlap(shift, other.getShift())) {
                String message = shift == StaffShift.FULL_DAY
                        ? "Ca cả ngày trùng giờ với " + shiftLabel(other.getShift())
                                + " đã phân công cho nhân viên này. Hãy hủy ca đó trước hoặc chọn ca khác."
                        : "Nhân viên đã có ca cả ngày nên không thể thêm " + shiftLabel(shift) + " trong cùng ngày.";
                throw new AppException(ErrorCode.STAFF_SHIFT_OVERLAP, message);
            }
        }
    }

    /** Shift, zone and role only change while the shift is still upcoming: not checked in, completed or in a past day. */
    private static boolean isStructurallyEditable(StaffAssignment assignment) {
        return assignment.getStatus() == StaffAssignmentStatus.ASSIGNED
                && assignment.getAssignedDate() != null
                && !assignment.getAssignedDate().isBefore(LocalDate.now());
    }

    /**
     * Applies a status change when both the transition and the date allow it: check-in only on the shift day, completion or
     * absence not before it, nothing out of a completed shift.
     */
    private void applyStatus(StaffAssignment assignment, StaffAssignmentStatus target, boolean selfService) {
        StaffAssignmentStatus current = assignment.getStatus() != null ? assignment.getStatus() : StaffAssignmentStatus.ASSIGNED;
        if (target == current) {
            return;
        }
        if (!ALLOWED_TRANSITIONS.getOrDefault(current, Set.of()).contains(target)) {
            throw new AppException(ErrorCode.STAFF_ASSIGNMENT_STATUS_INVALID, String.format(
                    "Không thể chuyển ca trực từ \"%s\" sang \"%s\".", statusLabel(current), statusLabel(target)));
        }
        LocalDate today = LocalDate.now();
        LocalDate shiftDay = assignment.getAssignedDate();
        if (shiftDay != null) {
            if (target == StaffAssignmentStatus.CHECKED_IN && !shiftDay.equals(today)) {
                throw new AppException(ErrorCode.STAFF_ASSIGNMENT_STATUS_INVALID, shiftDay.isAfter(today)
                        ? "Chưa đến ngày trực nên chưa thể vào ca."
                        : "Ca trực đã qua ngày nên không thể vào ca bổ sung.");
            }
            if ((target == StaffAssignmentStatus.COMPLETED || target == StaffAssignmentStatus.ABSENT) && shiftDay.isAfter(today)) {
                throw new AppException(ErrorCode.STAFF_ASSIGNMENT_STATUS_INVALID,
                        "Chưa đến ngày trực nên chưa thể ghi nhận ca " + statusLabel(target) + ".");
            }
            if (target == StaffAssignmentStatus.ASSIGNED && shiftDay.isBefore(today)) {
                throw new AppException(ErrorCode.STAFF_ASSIGNMENT_STATUS_INVALID,
                        "Ca trực đã qua ngày nên không thể đưa về trạng thái đã phân công.");
            }
        }
        if (selfService && target == StaffAssignmentStatus.ASSIGNED) {
            throw new AppException(ErrorCode.STAFF_ASSIGNMENT_STATUS_INVALID, "Chỉ quản lý được hoàn tác trạng thái vắng mặt.");
        }
        assignment.setStatus(target);
    }

    private static String statusLabel(StaffAssignmentStatus status) {
        return switch (status) {
            case ASSIGNED -> "đã phân công";
            case CHECKED_IN -> "đã vào ca";
            case COMPLETED -> "hoàn thành";
            case ABSENT -> "vắng mặt";
        };
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static String shiftLabel(StaffShift shift) {
        if (shift == null) {
            return "ca trực";
        }
        return switch (shift.name()) {
            case "MORNING" -> "ca sáng";
            case "AFTERNOON" -> "ca chiều";
            case "NIGHT" -> "ca đêm";
            case "FULL_DAY" -> "ca cả ngày";
            default -> "ca " + shift.name();
        };
    }
}

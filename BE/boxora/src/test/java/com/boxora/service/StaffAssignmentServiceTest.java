package com.boxora.service;

import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.StaffAssignmentCreateRequest;
import com.boxora.dto.request.StaffAssignmentStatusUpdateRequest;
import com.boxora.dto.request.StaffAssignmentUpdateRequest;
import com.boxora.dto.response.StaffAssignmentResponse;
import com.boxora.entity.Facility;
import com.boxora.entity.Role;
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
import com.boxora.service.impl.StaffAssignmentServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class StaffAssignmentServiceTest {

    @Mock
    private StaffAssignmentRepository staffAssignmentRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private FacilityRepository facilityRepository;

    @Mock
    private StaffAssignmentMapper staffAssignmentMapper;

    @Mock
    private ActivityLogService activityLogService;

    @Mock
    private FacilityAccessGuard facilityAccessGuard;

    @Mock
    private RequestContext requestContext;

    @InjectMocks
    private StaffAssignmentServiceImpl staffAssignmentService;

    private UUID facilityId;
    private UUID staffId;
    private UUID managerId;
    private Facility facility;
    private Role staffRole;
    private User staffUser;
    private User managerUser;

    @BeforeEach
    void setUp() {
        facilityId = UUID.randomUUID();
        staffId = UUID.randomUUID();
        managerId = UUID.randomUUID();

        facility = Facility.builder()
                .name("Boxora D1")
                .code("HCM-D1")
                .build();
        facility.setId(facilityId);

        staffRole = Role.builder()
                .name("STAFF")
                .description("Nhân viên vận hành")
                .build();

        staffUser = User.builder()
                .username("staff_nguyen")
                .fullName("Nguyen Van Staff")
                .email("staff@boxora.com")
                .role(staffRole)
                .facility(facility)
                .isActive(true)
                .build();
        staffUser.setId(staffId);

        Role managerRole = Role.builder().name("FACILITY_MANAGER").build();
        managerUser = User.builder()
                .username("manager_tran")
                .fullName("Tran Van Quan Ly")
                .role(managerRole)
                .facility(facility)
                .isActive(true)
                .build();
        managerUser.setId(managerId);

        lenient().when(requestContext.currentUserRole()).thenReturn("FACILITY_MANAGER");
        lenient().when(requestContext.currentUserId()).thenReturn(managerId);
    }

    @Nested
    @DisplayName("createAssignment Tests")
    class CreateAssignmentTests {

        @Test
        @DisplayName("Tạo phân công ca trực thành công")
        void shouldCreateAssignmentSuccessfully() {
            LocalDate tomorrow = LocalDate.now().plusDays(1);
            StaffAssignmentCreateRequest request = StaffAssignmentCreateRequest.builder()
                    .staffId(staffId)
                    .facilityId(facilityId)
                    .assignedDate(tomorrow)
                    .shift(StaffShift.MORNING)
                    .assignedZone("Zone A")
                    .roleInShift("PRIMARY_STAFF")
                    .notes("Ca trực sáng đón khách")
                    .build();

            when(facilityRepository.findById(facilityId)).thenReturn(Optional.of(facility));
            when(userRepository.findById(staffId)).thenReturn(Optional.of(staffUser));
            when(staffAssignmentRepository.existsByStaff_IdAndAssignedDateAndShift(staffId, tomorrow, StaffShift.MORNING))
                    .thenReturn(false);
            when(requestContext.currentUserId()).thenReturn(managerId);
            when(userRepository.findById(managerId)).thenReturn(Optional.of(managerUser));

            StaffAssignment savedAssignment = StaffAssignment.builder()
                    .staff(staffUser)
                    .facility(facility)
                    .assignedDate(tomorrow)
                    .shift(StaffShift.MORNING)
                    .assignedZone("Zone A")
                    .roleInShift("PRIMARY_STAFF")
                    .status(StaffAssignmentStatus.ASSIGNED)
                    .assignedBy(managerUser)
                    .notes("Ca trực sáng đón khách")
                    .build();
            savedAssignment.setId(UUID.randomUUID());

            when(staffAssignmentRepository.save(any(StaffAssignment.class))).thenReturn(savedAssignment);

            StaffAssignmentResponse expectedResponse = StaffAssignmentResponse.builder()
                    .id(savedAssignment.getId())
                    .staffId(staffId)
                    .staffFullName("Nguyen Van Staff")
                    .facilityId(facilityId)
                    .facilityName("Boxora D1")
                    .assignedDate(tomorrow)
                    .shift(StaffShift.MORNING)
                    .status(StaffAssignmentStatus.ASSIGNED)
                    .build();

            when(staffAssignmentMapper.toResponse(savedAssignment)).thenReturn(expectedResponse);

            StaffAssignmentResponse actualResponse = staffAssignmentService.createAssignment(request);

            assertThat(actualResponse).isNotNull();
            assertThat(actualResponse.getStaffId()).isEqualTo(staffId);
            assertThat(actualResponse.getShift()).isEqualTo(StaffShift.MORNING);
            assertThat(actualResponse.getStatus()).isEqualTo(StaffAssignmentStatus.ASSIGNED);

            verify(facilityAccessGuard).checkFacilityAccess(facilityId);
            verify(activityLogService).record(eq(facilityId), eq(ActivityAction.STAFF_ASSIGNMENT_CREATE),
                    eq("StaffAssignment"), any(), any(), isNull(), any());
        }

        @Test
        @DisplayName("Lỗi nếu ngày phân công là trong quá khứ")
        void shouldThrowWhenDateIsInThePast() {
            LocalDate yesterday = LocalDate.now().minusDays(1);
            StaffAssignmentCreateRequest request = StaffAssignmentCreateRequest.builder()
                    .staffId(staffId)
                    .facilityId(facilityId)
                    .assignedDate(yesterday)
                    .shift(StaffShift.MORNING)
                    .build();

            AppException ex = assertThrows(AppException.class,
                    () -> staffAssignmentService.createAssignment(request));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.INVALID_ASSIGNMENT_DATE);
        }

        @Test
        @DisplayName("Lỗi nếu nhân viên không phải role STAFF")
        void shouldThrowWhenUserIsNotStaff() {
            Role customerRole = Role.builder().name("CUSTOMER").build();
            staffUser.setRole(customerRole);

            LocalDate tomorrow = LocalDate.now().plusDays(1);
            StaffAssignmentCreateRequest request = StaffAssignmentCreateRequest.builder()
                    .staffId(staffId)
                    .facilityId(facilityId)
                    .assignedDate(tomorrow)
                    .shift(StaffShift.MORNING)
                    .build();

            when(facilityRepository.findById(facilityId)).thenReturn(Optional.of(facility));
            when(userRepository.findById(staffId)).thenReturn(Optional.of(staffUser));

            AppException ex = assertThrows(AppException.class,
                    () -> staffAssignmentService.createAssignment(request));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.USER_NOT_A_STAFF);
        }

        @Test
        @DisplayName("Lỗi nếu nhân viên đã được phân công ca trực này trong ngày")
        void shouldThrowWhenDuplicateShiftAssigned() {
            LocalDate tomorrow = LocalDate.now().plusDays(1);
            StaffAssignmentCreateRequest request = StaffAssignmentCreateRequest.builder()
                    .staffId(staffId)
                    .facilityId(facilityId)
                    .assignedDate(tomorrow)
                    .shift(StaffShift.MORNING)
                    .build();

            when(facilityRepository.findById(facilityId)).thenReturn(Optional.of(facility));
            when(userRepository.findById(staffId)).thenReturn(Optional.of(staffUser));
            when(staffAssignmentRepository.existsByStaff_IdAndAssignedDateAndShift(staffId, tomorrow, StaffShift.MORNING))
                    .thenReturn(true);

            AppException ex = assertThrows(AppException.class,
                    () -> staffAssignmentService.createAssignment(request));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.STAFF_ALREADY_ASSIGNED_SHIFT);
        }

        @Test
        @DisplayName("Rejects overlapping custom shift times even when shift labels differ")
        void shouldThrowWhenCustomShiftTimesOverlap() {
            LocalDate tomorrow = LocalDate.now().plusDays(1);
            StaffAssignmentCreateRequest request = StaffAssignmentCreateRequest.builder()
                    .staffId(staffId)
                    .facilityId(facilityId)
                    .assignedDate(tomorrow)
                    .shift(StaffShift.MORNING)
                    .build();
            StaffAssignment existing = StaffAssignment.builder()
                    .staff(staffUser)
                    .facility(facility)
                    .assignedDate(tomorrow)
                    .shift(StaffShift.FULL_DAY)
                    .startTime(java.time.LocalTime.of(10, 0))
                    .endTime(java.time.LocalTime.of(18, 0))
                    .status(StaffAssignmentStatus.ASSIGNED)
                    .build();
            existing.setId(UUID.randomUUID());

            when(facilityRepository.findById(facilityId)).thenReturn(Optional.of(facility));
            when(userRepository.findById(staffId)).thenReturn(Optional.of(staffUser));
            when(staffAssignmentRepository.findByStaff_IdAndAssignedDateBetween(
                    staffId, tomorrow.minusDays(1), tomorrow.plusDays(1))).thenReturn(List.of(existing));

            AppException ex = assertThrows(AppException.class,
                    () -> staffAssignmentService.createAssignment(request));

            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.STAFF_ALREADY_ASSIGNED_SHIFT);
            verify(staffAssignmentRepository, never()).save(any());
        }
    }

    @Nested
    @DisplayName("updateAssignment Tests")
    class UpdateAssignmentTests {

        @Test
        @DisplayName("Cập nhật ca trực thành công")
        void shouldUpdateAssignmentSuccessfully() {
            UUID assignmentId = UUID.randomUUID();
            LocalDate date = LocalDate.now().plusDays(2);
            StaffAssignment assignment = StaffAssignment.builder()
                    .staff(staffUser)
                    .facility(facility)
                    .assignedDate(date)
                    .shift(StaffShift.MORNING)
                    .assignedZone("Zone A")
                    .status(StaffAssignmentStatus.ASSIGNED)
                    .build();
            assignment.setId(assignmentId);

            StaffAssignmentUpdateRequest updateRequest = StaffAssignmentUpdateRequest.builder()
                    .shift(StaffShift.AFTERNOON)
                    .assignedZone("Zone B")
                    .notes("Đổi ca trực chiều")
                    .build();

            when(staffAssignmentRepository.findById(assignmentId)).thenReturn(Optional.of(assignment));
            when(staffAssignmentRepository.existsByStaff_IdAndAssignedDateAndShiftAndIdNot(
                    staffId, date, StaffShift.AFTERNOON, assignmentId)).thenReturn(false);
            when(staffAssignmentRepository.save(any(StaffAssignment.class))).thenReturn(assignment);

            StaffAssignmentResponse response = StaffAssignmentResponse.builder()
                    .id(assignmentId)
                    .shift(StaffShift.AFTERNOON)
                    .assignedZone("Zone B")
                    .build();
            when(staffAssignmentMapper.toResponse(assignment)).thenReturn(response);

            StaffAssignmentResponse result = staffAssignmentService.updateAssignment(assignmentId, updateRequest);

            assertThat(result.getShift()).isEqualTo(StaffShift.AFTERNOON);
            verify(facilityAccessGuard).checkFacilityAccess(facilityId);
            verify(activityLogService).record(eq(facilityId), eq(ActivityAction.STAFF_ASSIGNMENT_UPDATE),
                    eq("StaffAssignment"), eq(assignmentId), any(), isNull(), any());
        }
    }

    @Nested
    @DisplayName("updateStatus Tests")
    class UpdateStatusTests {

        @Test
        @DisplayName("Cập nhật trạng thái CHECKED_IN thành công")
        void shouldUpdateStatusToCheckedIn() {
            UUID assignmentId = UUID.randomUUID();
            LocalDateTime windowStart = LocalDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh")).minusMinutes(2);
            LocalDateTime windowEnd = LocalDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh")).plusMinutes(2);
            StaffAssignment assignment = StaffAssignment.builder()
                    .staff(staffUser)
                    .facility(facility)
                    .assignedDate(windowStart.toLocalDate())
                    .shift(StaffShift.MORNING)
                    .startTime(windowStart.toLocalTime())
                    .endTime(windowEnd.toLocalTime())
                    .status(StaffAssignmentStatus.ASSIGNED)
                    .build();
            assignment.setId(assignmentId);

            StaffAssignmentStatusUpdateRequest statusRequest = StaffAssignmentStatusUpdateRequest.builder()
                    .status(StaffAssignmentStatus.CHECKED_IN)
                    .notes("Có mặt lúc 7:55 AM")
                    .build();

            when(staffAssignmentRepository.findById(assignmentId)).thenReturn(Optional.of(assignment));
            when(requestContext.currentUserId()).thenReturn(staffId); // Self check-in
            when(staffAssignmentRepository.save(any(StaffAssignment.class))).thenReturn(assignment);

            StaffAssignmentResponse response = StaffAssignmentResponse.builder()
                    .id(assignmentId)
                    .status(StaffAssignmentStatus.CHECKED_IN)
                    .build();
            when(staffAssignmentMapper.toResponse(assignment)).thenReturn(response);

            StaffAssignmentResponse result = staffAssignmentService.updateStatus(assignmentId, statusRequest);

            assertThat(result.getStatus()).isEqualTo(StaffAssignmentStatus.CHECKED_IN);
            assertThat(assignment.getCheckedInAt()).isNotNull();
            verify(staffAssignmentRepository).save(assignment);
        }

        @Test
        @DisplayName("Staff cannot set an arbitrary attendance state such as ABSENT")
        void staffCannotSetArbitraryAttendanceState() {
            UUID assignmentId = UUID.randomUUID();
            StaffAssignmentStatusUpdateRequest request = StaffAssignmentStatusUpdateRequest.builder()
                    .status(StaffAssignmentStatus.ABSENT)
                    .notes("manual override")
                    .build();
            when(requestContext.currentUserRole()).thenReturn("STAFF");

            AppException ex = assertThrows(AppException.class,
                    () -> staffAssignmentService.updateStatus(assignmentId, request));

            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.FORBIDDEN);
            verify(staffAssignmentRepository, never()).findById(any());
            verify(staffAssignmentRepository, never()).save(any());
        }

        @Test
        @DisplayName("Attendance history cannot be removed through schedule cancellation")
        void checkedInAssignmentCannotBeCancelled() {
            UUID assignmentId = UUID.randomUUID();
            StaffAssignment assignment = StaffAssignment.builder()
                    .staff(staffUser)
                    .facility(facility)
                    .assignedDate(LocalDate.now())
                    .shift(StaffShift.MORNING)
                    .status(StaffAssignmentStatus.CHECKED_IN)
                    .build();
            assignment.setId(assignmentId);
            when(staffAssignmentRepository.findById(assignmentId)).thenReturn(Optional.of(assignment));
            when(requestContext.currentUserRole()).thenReturn("FACILITY_MANAGER");

            AppException ex = assertThrows(AppException.class,
                    () -> staffAssignmentService.deleteAssignment(assignmentId));

            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.INVALID_REQUEST);
            assertThat(assignment.getStatus()).isEqualTo(StaffAssignmentStatus.CHECKED_IN);
            verify(staffAssignmentRepository, never()).delete(any(StaffAssignment.class));
            verify(staffAssignmentRepository, never()).save(any());
        }
    }

    @Nested
    @DisplayName("deleteAssignment & getDailyBoard Tests")
    class OtherOperationsTests {

        @Test
        @DisplayName("Xóa ca trực thành công")
        void shouldDeleteAssignmentSuccessfully() {
            UUID assignmentId = UUID.randomUUID();
            StaffAssignment assignment = StaffAssignment.builder()
                    .staff(staffUser)
                    .facility(facility)
                    .assignedDate(LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).plusDays(1))
                    .shift(StaffShift.MORNING)
                    .build();
            assignment.setId(assignmentId);

            when(staffAssignmentRepository.findById(assignmentId)).thenReturn(Optional.of(assignment));
            when(requestContext.currentUserRole()).thenReturn("FACILITY_MANAGER");

            staffAssignmentService.deleteAssignment(assignmentId);

            verify(facilityAccessGuard).checkFacilityAccess(facilityId);
            assertThat(assignment.getStatus()).isEqualTo(StaffAssignmentStatus.CANCELLED);
            verify(staffAssignmentRepository).save(assignment);
            verify(staffAssignmentRepository, never()).delete(any(StaffAssignment.class));
            verify(activityLogService).record(eq(facilityId), eq(ActivityAction.STAFF_ASSIGNMENT_REMOVE),
                    eq("StaffAssignment"), eq(assignmentId), any(),
                    eq(StaffAssignmentStatus.ASSIGNED.name()), eq(StaffAssignmentStatus.CANCELLED.name()));
        }

        @Test
        @DisplayName("Lấy danh sách ca trực theo Daily Board")
        void shouldGetDailyBoard() {
            LocalDate today = LocalDate.now();
            StaffAssignment assignment = StaffAssignment.builder()
                    .staff(staffUser)
                    .facility(facility)
                    .assignedDate(today)
                    .shift(StaffShift.MORNING)
                    .status(StaffAssignmentStatus.CHECKED_IN)
                    .build();

            when(facilityAccessGuard.isFacilityScoped()).thenReturn(false);
            when(staffAssignmentRepository.findByFacility_IdAndAssignedDateOrderByShiftAscCreatedAtAsc(facilityId, today))
                    .thenReturn(List.of(assignment));

            StaffAssignmentResponse resp = StaffAssignmentResponse.builder()
                    .id(assignment.getId())
                    .shift(StaffShift.MORNING)
                    .status(StaffAssignmentStatus.CHECKED_IN)
                    .build();
            when(staffAssignmentMapper.toResponse(assignment)).thenReturn(resp);

            List<StaffAssignmentResponse> board = staffAssignmentService.getDailyBoard(facilityId, today);

            assertThat(board).hasSize(1);
            assertThat(board.get(0).getStatus()).isEqualTo(StaffAssignmentStatus.CHECKED_IN);
        }

        @Test
        @DisplayName("Điểm danh vào ca trực thành công")
        void shouldCheckInSuccessfully() {
            UUID assignmentId = UUID.randomUUID();
            LocalDateTime windowStart = LocalDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh")).minusMinutes(2);
            LocalDateTime windowEnd = LocalDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh")).plusMinutes(2);
            StaffAssignment assignment = StaffAssignment.builder()
                    .staff(staffUser)
                    .facility(facility)
                    .assignedDate(windowStart.toLocalDate())
                    .shift(StaffShift.MORNING)
                    .startTime(windowStart.toLocalTime())
                    .endTime(windowEnd.toLocalTime())
                    .status(StaffAssignmentStatus.ASSIGNED)
                    .build();
            assignment.setId(assignmentId);

            when(staffAssignmentRepository.findById(assignmentId)).thenReturn(Optional.of(assignment));
            when(requestContext.currentUserId()).thenReturn(staffId);
            when(staffAssignmentRepository.save(any(StaffAssignment.class))).thenAnswer(inv -> inv.getArgument(0));

            StaffAssignmentResponse resp = StaffAssignmentResponse.builder()
                    .id(assignmentId)
                    .status(StaffAssignmentStatus.CHECKED_IN)
                    .build();
            when(staffAssignmentMapper.toResponse(any(StaffAssignment.class))).thenReturn(resp);

            StaffAssignmentResponse res = staffAssignmentService.checkIn(assignmentId, new com.boxora.dto.request.StaffCheckInRequest("Vào ca"));

            assertThat(res.getStatus()).isEqualTo(StaffAssignmentStatus.CHECKED_IN);
            assertThat(assignment.getCheckedInAt()).isNotNull();
            verify(activityLogService).record(eq(facilityId), eq(ActivityAction.STAFF_CHECKIN), eq("StaffAssignment"), eq(assignmentId), any(), any(), any());
        }

        @Test
        @DisplayName("Staff cannot check in before the assigned shift window")
        void shouldRejectCheckInOutsideAssignedWindow() {
            UUID assignmentId = UUID.randomUUID();
            StaffAssignment assignment = StaffAssignment.builder()
                    .staff(staffUser)
                    .facility(facility)
                    .assignedDate(LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).plusDays(1))
                    .shift(StaffShift.MORNING)
                    .startTime(LocalTime.of(6, 0))
                    .endTime(LocalTime.of(14, 0))
                    .status(StaffAssignmentStatus.ASSIGNED)
                    .build();
            assignment.setId(assignmentId);

            when(staffAssignmentRepository.findById(assignmentId)).thenReturn(Optional.of(assignment));
            when(requestContext.currentUserId()).thenReturn(staffId);

            AppException exception = assertThrows(AppException.class,
                    () -> staffAssignmentService.checkIn(assignmentId,
                            new com.boxora.dto.request.StaffCheckInRequest("Too early")));

            assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.INVALID_REQUEST);
            verify(staffAssignmentRepository, never()).save(any());
            verify(activityLogService, never()).record(any(), any(), any(), any(), any(), any(), any());
        }

        @Test
        @DisplayName("Điểm danh vào ca thất bại khi đã điểm danh trước đó")
        void shouldFailCheckInWhenAlreadyCheckedIn() {
            UUID assignmentId = UUID.randomUUID();
            StaffAssignment assignment = StaffAssignment.builder()
                    .staff(staffUser)
                    .facility(facility)
                    .assignedDate(LocalDate.now())
                    .shift(StaffShift.MORNING)
                    .status(StaffAssignmentStatus.CHECKED_IN)
                    .build();
            assignment.setId(assignmentId);

            when(staffAssignmentRepository.findById(assignmentId)).thenReturn(Optional.of(assignment));
            when(requestContext.currentUserId()).thenReturn(staffId);

            AppException ex = assertThrows(AppException.class, () ->
                    staffAssignmentService.checkIn(assignmentId, new com.boxora.dto.request.StaffCheckInRequest("Vào ca"))
            );
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.STAFF_ALREADY_CHECKED_IN);
        }

        @Test
        @DisplayName("Kết thúc ca trực (Check-out) thành công")
        void shouldCheckOutSuccessfully() {
            UUID assignmentId = UUID.randomUUID();
            StaffAssignment assignment = StaffAssignment.builder()
                    .staff(staffUser)
                    .facility(facility)
                    .assignedDate(LocalDate.now())
                    .shift(StaffShift.MORNING)
                    .status(StaffAssignmentStatus.CHECKED_IN)
                    .build();
            assignment.setId(assignmentId);

            when(staffAssignmentRepository.findById(assignmentId)).thenReturn(Optional.of(assignment));
            when(requestContext.currentUserId()).thenReturn(staffId);
            when(staffAssignmentRepository.save(any(StaffAssignment.class))).thenAnswer(inv -> inv.getArgument(0));

            StaffAssignmentResponse resp = StaffAssignmentResponse.builder()
                    .id(assignmentId)
                    .status(StaffAssignmentStatus.COMPLETED)
                    .build();
            when(staffAssignmentMapper.toResponse(any(StaffAssignment.class))).thenReturn(resp);

            StaffAssignmentResponse res = staffAssignmentService.checkOut(assignmentId, new com.boxora.dto.request.StaffCheckOutRequest("Xong ca"));

            assertThat(res.getStatus()).isEqualTo(StaffAssignmentStatus.COMPLETED);
            assertThat(assignment.getCheckedOutAt()).isNotNull();
            verify(activityLogService).record(eq(facilityId), eq(ActivityAction.STAFF_CHECKOUT), eq("StaffAssignment"), eq(assignmentId), any(), any(), any());
        }

        @Test
        @DisplayName("Kết thúc ca thất bại khi chưa điểm danh vào ca")
        void shouldFailCheckOutWhenNotCheckedIn() {
            UUID assignmentId = UUID.randomUUID();
            StaffAssignment assignment = StaffAssignment.builder()
                    .staff(staffUser)
                    .facility(facility)
                    .assignedDate(LocalDate.now())
                    .shift(StaffShift.MORNING)
                    .status(StaffAssignmentStatus.ASSIGNED)
                    .build();

            when(staffAssignmentRepository.findById(assignmentId)).thenReturn(Optional.of(assignment));
            when(requestContext.currentUserId()).thenReturn(staffId);

            AppException ex = assertThrows(AppException.class, () ->
                    staffAssignmentService.checkOut(assignmentId, new com.boxora.dto.request.StaffCheckOutRequest("Xong ca"))
            );
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.STAFF_NOT_CHECKED_IN);
        }
    }
}

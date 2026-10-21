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
    }

    /** An assignment of the fixture staff member (random id) on the given day. */
    private StaffAssignment existing(LocalDate date, StaffShift shift, StaffAssignmentStatus status) {
        StaffAssignment assignment = StaffAssignment.builder()
                .staff(staffUser).facility(facility).assignedDate(date).shift(shift).status(status)
                .roleInShift("PRIMARY_STAFF").build();
        assignment.setId(UUID.randomUUID());
        return assignment;
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
            when(userRepository.findByIdForUpdate(staffId)).thenReturn(Optional.of(staffUser));
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
            when(userRepository.findByIdForUpdate(staffId)).thenReturn(Optional.of(staffUser));

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
            when(userRepository.findByIdForUpdate(staffId)).thenReturn(Optional.of(staffUser));
            when(staffAssignmentRepository.findByStaff_IdAndAssignedDate(staffId, tomorrow))
                    .thenReturn(List.of(existing(tomorrow, StaffShift.MORNING, StaffAssignmentStatus.ASSIGNED)));

            AppException ex = assertThrows(AppException.class,
                    () -> staffAssignmentService.createAssignment(request));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.STAFF_ALREADY_ASSIGNED_SHIFT);
        }

        private StaffAssignmentCreateRequest request(LocalDate date, StaffShift shift) {
            return StaffAssignmentCreateRequest.builder()
                    .staffId(staffId).facilityId(facilityId).assignedDate(date).shift(shift).build();
        }

        private void stubCreateDependencies(LocalDate date, StaffAssignment... sameDay) {
            when(facilityRepository.findById(facilityId)).thenReturn(Optional.of(facility));
            when(userRepository.findByIdForUpdate(staffId)).thenReturn(Optional.of(staffUser));
            when(staffAssignmentRepository.findByStaff_IdAndAssignedDate(staffId, date)).thenReturn(List.of(sameDay));
        }

        @Test
        @DisplayName("Ca cả ngày bị từ chối (409) khi nhân viên đã có bất kỳ ca nào trong ngày")
        void fullDayRejectedWhenAnotherShiftExists() {
            LocalDate date = LocalDate.now().plusDays(3);
            stubCreateDependencies(date, existing(date, StaffShift.MORNING, StaffAssignmentStatus.ASSIGNED));

            AppException ex = assertThrows(AppException.class,
                    () -> staffAssignmentService.createAssignment(request(date, StaffShift.FULL_DAY)));

            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.STAFF_SHIFT_OVERLAP);
            assertThat(ex.getMessage()).contains("ca sáng");
            verify(staffAssignmentRepository, never()).save(any(StaffAssignment.class));
        }

        @Test
        @DisplayName("Ca sáng/chiều/đêm bị từ chối khi nhân viên đã có ca cả ngày")
        void anyShiftRejectedWhenFullDayExists() {
            LocalDate date = LocalDate.now().plusDays(3);
            for (StaffShift shift : List.of(StaffShift.MORNING, StaffShift.AFTERNOON, StaffShift.NIGHT)) {
                stubCreateDependencies(date, existing(date, StaffShift.FULL_DAY, StaffAssignmentStatus.ASSIGNED));

                AppException ex = assertThrows(AppException.class,
                        () -> staffAssignmentService.createAssignment(request(date, shift)));

                assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.STAFF_SHIFT_OVERLAP);
                assertThat(ex.getMessage()).contains("ca cả ngày");
            }
            verify(staffAssignmentRepository, never()).save(any(StaffAssignment.class));
        }

        @Test
        @DisplayName("Ba ca không chồng giờ (sáng, chiều, đêm) có thể cùng tồn tại trong một ngày")
        void morningAfternoonNightCanCoexist() {
            LocalDate date = LocalDate.now().plusDays(3);
            stubCreateDependencies(date,
                    existing(date, StaffShift.MORNING, StaffAssignmentStatus.ASSIGNED),
                    existing(date, StaffShift.NIGHT, StaffAssignmentStatus.ASSIGNED));
            when(requestContext.currentUserId()).thenReturn(managerId);
            when(userRepository.findById(managerId)).thenReturn(Optional.of(managerUser));
            StaffAssignment saved = existing(date, StaffShift.AFTERNOON, StaffAssignmentStatus.ASSIGNED);
            saved.setId(UUID.randomUUID());
            when(staffAssignmentRepository.save(any(StaffAssignment.class))).thenReturn(saved);
            when(staffAssignmentMapper.toResponse(saved)).thenReturn(StaffAssignmentResponse.builder().id(saved.getId()).build());

            assertThat(staffAssignmentService.createAssignment(request(date, StaffShift.AFTERNOON))).isNotNull();
            verify(staffAssignmentRepository).save(any(StaffAssignment.class));
        }

        @Test
        @DisplayName("Ca đã đánh dấu vắng mặt không chặn ca cả ngày thay thế, nhưng cùng một ca vẫn bị chặn")
        void absentShiftDoesNotBlockReplacement() {
            LocalDate date = LocalDate.now().plusDays(0);
            stubCreateDependencies(date, existing(date, StaffShift.MORNING, StaffAssignmentStatus.ABSENT));
            when(requestContext.currentUserId()).thenReturn(managerId);
            when(userRepository.findById(managerId)).thenReturn(Optional.of(managerUser));
            StaffAssignment saved = existing(date, StaffShift.FULL_DAY, StaffAssignmentStatus.ASSIGNED);
            saved.setId(UUID.randomUUID());
            when(staffAssignmentRepository.save(any(StaffAssignment.class))).thenReturn(saved);
            when(staffAssignmentMapper.toResponse(saved)).thenReturn(StaffAssignmentResponse.builder().id(saved.getId()).build());

            assertThat(staffAssignmentService.createAssignment(request(date, StaffShift.FULL_DAY))).isNotNull();

            AppException duplicate = assertThrows(AppException.class,
                    () -> staffAssignmentService.createAssignment(request(date, StaffShift.MORNING)));
            assertThat(duplicate.getErrorCode()).isEqualTo(ErrorCode.STAFF_ALREADY_ASSIGNED_SHIFT);
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
            when(staffAssignmentRepository.findByStaff_IdAndAssignedDate(staffId, date)).thenReturn(List.of(assignment));
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

        @Test
        @DisplayName("Đổi sang ca cả ngày bị từ chối khi nhân viên còn ca khác trong ngày")
        void shouldRejectChangeToFullDayWhenOtherShiftExists() {
            LocalDate date = LocalDate.now().plusDays(2);
            StaffAssignment morning = existing(date, StaffShift.MORNING, StaffAssignmentStatus.ASSIGNED);
            StaffAssignment night = existing(date, StaffShift.NIGHT, StaffAssignmentStatus.ASSIGNED);
            when(staffAssignmentRepository.findById(morning.getId())).thenReturn(Optional.of(morning));
            when(staffAssignmentRepository.findByStaff_IdAndAssignedDate(staffId, date)).thenReturn(List.of(morning, night));

            AppException ex = assertThrows(AppException.class, () -> staffAssignmentService.updateAssignment(
                    morning.getId(), StaffAssignmentUpdateRequest.builder().shift(StaffShift.FULL_DAY).build()));

            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.STAFF_SHIFT_OVERLAP);
            assertThat(morning.getShift()).isEqualTo(StaffShift.MORNING);
        }

        @Test
        @DisplayName("Ca của chính nó không tính là xung đột khi sửa khu vực hoặc ghi chú")
        void shouldAllowEditingZoneAndNotesOfUpcomingShift() {
            LocalDate date = LocalDate.now().plusDays(2);
            StaffAssignment morning = existing(date, StaffShift.MORNING, StaffAssignmentStatus.ASSIGNED);
            when(staffAssignmentRepository.findById(morning.getId())).thenReturn(Optional.of(morning));
            when(staffAssignmentRepository.save(morning)).thenReturn(morning);
            when(staffAssignmentMapper.toResponse(morning)).thenReturn(StaffAssignmentResponse.builder().id(morning.getId()).build());

            staffAssignmentService.updateAssignment(morning.getId(), StaffAssignmentUpdateRequest.builder()
                    .shift(StaffShift.MORNING).assignedZone("Quầy tiếp đón").notes("Đổi khu vực").build());

            assertThat(morning.getAssignedZone()).isEqualTo("Quầy tiếp đón");
            assertThat(morning.getNotes()).isEqualTo("Đổi khu vực");
        }

        @Test
        @DisplayName("Ca đã vào ca hoặc đã qua ngày chỉ còn sửa được ghi chú: đổi ca bị từ chối")
        void shouldLockStructuralEditsOnceShiftHasStarted() {
            StaffAssignment checkedIn = existing(LocalDate.now(), StaffShift.MORNING, StaffAssignmentStatus.CHECKED_IN);
            StaffAssignment past = existing(LocalDate.now().minusDays(1), StaffShift.MORNING, StaffAssignmentStatus.ASSIGNED);
            when(staffAssignmentRepository.findById(checkedIn.getId())).thenReturn(Optional.of(checkedIn));
            when(staffAssignmentRepository.findById(past.getId())).thenReturn(Optional.of(past));

            for (StaffAssignment locked : List.of(checkedIn, past)) {
                AppException ex = assertThrows(AppException.class, () -> staffAssignmentService.updateAssignment(
                        locked.getId(), StaffAssignmentUpdateRequest.builder().shift(StaffShift.AFTERNOON).build()));
                assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.STAFF_ASSIGNMENT_LOCKED);
            }
            verify(staffAssignmentRepository, never()).save(any(StaffAssignment.class));
        }

        @Test
        @DisplayName("PUT với trạng thái COMPLETED cho ca ngày mai bị từ chối")
        void shouldRejectCompletedStatusOnFutureShiftThroughUpdate() {
            StaffAssignment future = existing(LocalDate.now().plusDays(1), StaffShift.MORNING, StaffAssignmentStatus.ASSIGNED);
            when(staffAssignmentRepository.findById(future.getId())).thenReturn(Optional.of(future));

            AppException ex = assertThrows(AppException.class, () -> staffAssignmentService.updateAssignment(
                    future.getId(), StaffAssignmentUpdateRequest.builder().status(StaffAssignmentStatus.COMPLETED).build()));

            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.STAFF_ASSIGNMENT_STATUS_INVALID);
            assertThat(future.getStatus()).isEqualTo(StaffAssignmentStatus.ASSIGNED);
        }
    }

    @Nested
    @DisplayName("updateStatus Tests")
    class UpdateStatusTests {

        private AppException statusError(StaffAssignment assignment, StaffAssignmentStatus target) {
            when(staffAssignmentRepository.findById(assignment.getId())).thenReturn(Optional.of(assignment));
            AppException ex = assertThrows(AppException.class, () -> staffAssignmentService.updateStatus(
                    assignment.getId(), StaffAssignmentStatusUpdateRequest.builder().status(target).build()));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.STAFF_ASSIGNMENT_STATUS_INVALID);
            return ex;
        }

        @Test
        @DisplayName("Ca ở tương lai không thể CHECKED_IN, COMPLETED hay ABSENT")
        void futureShiftCannotChangeStatus() {
            StaffAssignment future = existing(LocalDate.now().plusDays(2), StaffShift.MORNING, StaffAssignmentStatus.ASSIGNED);
            for (StaffAssignmentStatus target : List.of(StaffAssignmentStatus.CHECKED_IN, StaffAssignmentStatus.COMPLETED,
                    StaffAssignmentStatus.ABSENT)) {
                statusError(future, target);
            }
            assertThat(future.getStatus()).isEqualTo(StaffAssignmentStatus.ASSIGNED);
            verify(staffAssignmentRepository, never()).save(any(StaffAssignment.class));
        }

        @Test
        @DisplayName("Phải vào ca trước khi hoàn thành: ASSIGNED sang COMPLETED bị từ chối")
        void cannotCompleteWithoutCheckIn() {
            StaffAssignment today = existing(LocalDate.now(), StaffShift.MORNING, StaffAssignmentStatus.ASSIGNED);
            AppException ex = statusError(today, StaffAssignmentStatus.COMPLETED);
            assertThat(ex.getMessage()).contains("đã phân công").contains("hoàn thành");
        }

        @Test
        @DisplayName("Ca đã qua ngày không thể vào ca bổ sung; ca đã hoàn thành là trạng thái cuối")
        void pastShiftCannotCheckInAndCompletedIsFinal() {
            statusError(existing(LocalDate.now().minusDays(1), StaffShift.MORNING, StaffAssignmentStatus.ASSIGNED),
                    StaffAssignmentStatus.CHECKED_IN);
            statusError(existing(LocalDate.now(), StaffShift.MORNING, StaffAssignmentStatus.COMPLETED),
                    StaffAssignmentStatus.CHECKED_IN);
        }

        @Test
        @DisplayName("Trong ngày trực: ASSIGNED sang CHECKED_IN sang COMPLETED hợp lệ")
        void fullHappyPathOnShiftDay() {
            StaffAssignment today = existing(LocalDate.now(), StaffShift.AFTERNOON, StaffAssignmentStatus.ASSIGNED);
            when(staffAssignmentRepository.findById(today.getId())).thenReturn(Optional.of(today));
            when(requestContext.currentUserId()).thenReturn(staffId);
            when(staffAssignmentRepository.save(today)).thenReturn(today);
            when(staffAssignmentMapper.toResponse(today)).thenReturn(StaffAssignmentResponse.builder().id(today.getId()).build());

            staffAssignmentService.updateStatus(today.getId(),
                    StaffAssignmentStatusUpdateRequest.builder().status(StaffAssignmentStatus.CHECKED_IN).build());
            assertThat(today.getStatus()).isEqualTo(StaffAssignmentStatus.CHECKED_IN);

            staffAssignmentService.updateStatus(today.getId(),
                    StaffAssignmentStatusUpdateRequest.builder().status(StaffAssignmentStatus.COMPLETED).build());
            assertThat(today.getStatus()).isEqualTo(StaffAssignmentStatus.COMPLETED);
        }

        @Test
        @DisplayName("Nhân viên tự cập nhật không được hoàn tác trạng thái vắng mặt")
        void staffCannotRevertOwnAbsence() {
            StaffAssignment absent = existing(LocalDate.now(), StaffShift.MORNING, StaffAssignmentStatus.ABSENT);
            when(requestContext.currentUserId()).thenReturn(staffId);
            statusError(absent, StaffAssignmentStatus.ASSIGNED);
        }

        @Test
        @DisplayName("Cập nhật trạng thái CHECKED_IN thành công")
        void shouldUpdateStatusToCheckedIn() {
            UUID assignmentId = UUID.randomUUID();
            StaffAssignment assignment = StaffAssignment.builder()
                    .staff(staffUser)
                    .facility(facility)
                    .assignedDate(LocalDate.now())
                    .shift(StaffShift.MORNING)
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
            verify(staffAssignmentRepository).save(assignment);
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
                    .assignedDate(LocalDate.now().plusDays(1))
                    .shift(StaffShift.MORNING)
                    .build();
            assignment.setId(assignmentId);

            when(staffAssignmentRepository.findById(assignmentId)).thenReturn(Optional.of(assignment));

            staffAssignmentService.deleteAssignment(assignmentId);

            verify(facilityAccessGuard).checkFacilityAccess(facilityId);
            verify(staffAssignmentRepository).delete(assignment);
            verify(activityLogService).record(eq(facilityId), eq(ActivityAction.STAFF_ASSIGNMENT_REMOVE),
                    eq("StaffAssignment"), eq(assignmentId), any(), any(), isNull());
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
        @DisplayName("Admin/BM ở phạm vi tất cả cơ sở: daily board trả lịch trực của mọi cơ sở thay vì 404")
        void shouldReturnEveryFacilityBoardForSystemWideRole() {
            LocalDate today = LocalDate.now();
            StaffAssignment assignment = StaffAssignment.builder()
                    .staff(staffUser)
                    .facility(facility)
                    .assignedDate(today)
                    .shift(StaffShift.AFTERNOON)
                    .status(StaffAssignmentStatus.ASSIGNED)
                    .build();

            when(facilityAccessGuard.isFacilityScoped()).thenReturn(false);
            when(staffAssignmentRepository.findAllFacilitiesBoard(today))
                    .thenReturn(List.of(assignment));
            when(staffAssignmentMapper.toResponse(assignment)).thenReturn(StaffAssignmentResponse.builder()
                    .shift(StaffShift.AFTERNOON).staffFullName("Lê Nhân Viên").build());

            List<StaffAssignmentResponse> board = staffAssignmentService.getDailyBoard(null, today);

            assertThat(board).hasSize(1);
            assertThat(board.get(0).getStaffFullName()).isEqualTo("Lê Nhân Viên");
            verify(staffAssignmentRepository, never()).findByFacility_IdAndAssignedDateOrderByShiftAscCreatedAtAsc(any(), any());
        }

        @Test
        @DisplayName("Nhân viên/quản lý cơ sở chưa được gán cơ sở: bị từ chối thay vì thấy dữ liệu toàn hệ thống")
        void shouldDenyScopedRoleWithoutFacility() {
            when(facilityAccessGuard.isFacilityScoped()).thenReturn(true);
            when(requestContext.currentUserFacilityId()).thenReturn(null);

            AppException ex = assertThrows(AppException.class,
                    () -> staffAssignmentService.getDailyBoard(null, LocalDate.now()));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.FACILITY_ACCESS_DENIED);
        }
    }
}

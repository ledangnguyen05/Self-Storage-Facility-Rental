package com.boxora.service;

import com.boxora.dto.request.ShiftSwapCreateRequest;
import com.boxora.dto.request.ShiftSwapReviewRequest;
import com.boxora.dto.request.ShiftSwapTargetRespondRequest;
import com.boxora.dto.response.ShiftSwapResponse;
import com.boxora.entity.Facility;
import com.boxora.entity.Role;
import com.boxora.entity.ShiftSwapRequest;
import com.boxora.entity.StaffAssignment;
import com.boxora.entity.User;
import com.boxora.enums.ActivityAction;
import com.boxora.enums.ShiftSwapStatus;
import com.boxora.enums.StaffAssignmentStatus;
import com.boxora.enums.StaffShift;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.mapper.ShiftSwapMapper;
import com.boxora.repository.ShiftSwapRequestRepository;
import com.boxora.repository.StaffAssignmentRepository;
import com.boxora.repository.UserRepository;
import com.boxora.security.FacilityAccessGuard;
import com.boxora.security.RequestContext;
import com.boxora.service.impl.ShiftSwapServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ShiftSwapServiceTest {

    @Mock
    private ShiftSwapRequestRepository shiftSwapRequestRepository;

    @Mock
    private StaffAssignmentRepository staffAssignmentRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private ShiftSwapMapper shiftSwapMapper;

    @Mock
    private ActivityLogService activityLogService;

    @Mock
    private FacilityAccessGuard facilityAccessGuard;

    @Mock
    private RequestContext requestContext;

    @InjectMocks
    private ShiftSwapServiceImpl shiftSwapService;

    private UUID facilityId;
    private UUID staff1Id;
    private UUID staff2Id;
    private UUID managerId;
    private Facility facility;
    private User staff1;
    private User staff2;
    private User manager;
    private StaffAssignment assignment;

    @BeforeEach
    void setUp() {
        facilityId = UUID.randomUUID();
        staff1Id = UUID.randomUUID();
        staff2Id = UUID.randomUUID();
        managerId = UUID.randomUUID();

        facility = Facility.builder().name("Boxora Tan Binh").code("HCM-TB").build();
        facility.setId(facilityId);

        Role staffRole = Role.builder().name("STAFF").build();

        staff1 = User.builder().username("staff1").fullName("Staff One").isActive(true).role(staffRole).facility(facility).build();
        staff1.setId(staff1Id);

        staff2 = User.builder().username("staff2").fullName("Staff Two").isActive(true).role(staffRole).facility(facility).build();
        staff2.setId(staff2Id);

        manager = User.builder().username("manager1").fullName("Manager One").isActive(true).build();
        manager.setId(managerId);

        assignment = StaffAssignment.builder()
                .staff(staff1)
                .facility(facility)
                .assignedDate(LocalDate.now().plusDays(1))
                .shift(StaffShift.MORNING)
                .status(StaffAssignmentStatus.ASSIGNED)
                .build();
        assignment.setId(UUID.randomUUID());
    }

    @Test
    @DisplayName("Tạo yêu cầu đổi ca thành công")
    void shouldCreateSwapRequestSuccessfully() {
        ShiftSwapCreateRequest req = ShiftSwapCreateRequest.builder()
                .assignmentId(assignment.getId())
                .targetStaffId(staff2Id)
                .reason("Bận việc đột xuất")
                .build();

        when(staffAssignmentRepository.findById(assignment.getId())).thenReturn(Optional.of(assignment));
        when(requestContext.currentUserId()).thenReturn(staff1Id);
        when(userRepository.findById(staff1Id)).thenReturn(Optional.of(staff1));
        when(userRepository.findById(staff2Id)).thenReturn(Optional.of(staff2));
        when(staffAssignmentRepository.existsByStaff_IdAndAssignedDateAndShift(staff2Id, assignment.getAssignedDate(), assignment.getShift()))
                .thenReturn(false);

        ShiftSwapRequest saved = ShiftSwapRequest.builder()
                .assignment(assignment)
                .requester(staff1)
                .targetStaff(staff2)
                .facility(facility)
                .reason(req.getReason())
                .status(ShiftSwapStatus.PENDING)
                .build();
        saved.setId(UUID.randomUUID());
        when(shiftSwapRequestRepository.save(any(ShiftSwapRequest.class))).thenReturn(saved);

        ShiftSwapResponse resp = ShiftSwapResponse.builder().id(saved.getId()).status(ShiftSwapStatus.PENDING).build();
        when(shiftSwapMapper.toResponse(saved)).thenReturn(resp);

        ShiftSwapResponse res = shiftSwapService.createSwapRequest(req);

        assertThat(res.getStatus()).isEqualTo(ShiftSwapStatus.PENDING);
        verify(activityLogService).record(eq(facilityId), eq(ActivityAction.SHIFT_SWAP_REQUEST), eq("ShiftSwapRequest"), eq(saved.getId()), any(), any(), any());
    }

    @Test
    @DisplayName("Tạo yêu cầu đổi ca thất bại khi nhân viên thay thế bị trùng ca")
    void shouldFailWhenTargetStaffBusy() {
        ShiftSwapCreateRequest req = ShiftSwapCreateRequest.builder()
                .assignmentId(assignment.getId())
                .targetStaffId(staff2Id)
                .reason("Bận việc đột xuất")
                .build();

        when(staffAssignmentRepository.findById(assignment.getId())).thenReturn(Optional.of(assignment));
        when(requestContext.currentUserId()).thenReturn(staff1Id);
        when(userRepository.findById(staff1Id)).thenReturn(Optional.of(staff1));
        when(userRepository.findById(staff2Id)).thenReturn(Optional.of(staff2));
        when(staffAssignmentRepository.existsByStaff_IdAndAssignedDateAndShift(staff2Id, assignment.getAssignedDate(), assignment.getShift()))
                .thenReturn(true);

        AppException ex = assertThrows(AppException.class, () -> shiftSwapService.createSwapRequest(req));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.SHIFT_SWAP_TARGET_BUSY);
    }

    @Test
    @DisplayName("Tạo yêu cầu đổi ca thất bại khi target trùng chính người yêu cầu")
    void shouldFailWhenTargetIsSame() {
        ShiftSwapCreateRequest req = ShiftSwapCreateRequest.builder()
                .assignmentId(assignment.getId())
                .targetStaffId(staff1Id)
                .reason("Bận việc")
                .build();

        when(staffAssignmentRepository.findById(assignment.getId())).thenReturn(Optional.of(assignment));
        when(requestContext.currentUserId()).thenReturn(staff1Id);
        when(userRepository.findById(staff1Id)).thenReturn(Optional.of(staff1));

        AppException ex = assertThrows(AppException.class, () -> shiftSwapService.createSwapRequest(req));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.SHIFT_SWAP_INVALID_TARGET);
    }

    @Test
    @DisplayName("Quản lý duyệt đổi ca thành công, chuyển trạng thái sang MANAGER_APPROVED chờ nhân viên tiếp nhận xác nhận")
    void shouldApproveSwapRequestSuccessfully() {
        UUID swapId = UUID.randomUUID();
        ShiftSwapRequest swap = ShiftSwapRequest.builder()
                .assignment(assignment)
                .requester(staff1)
                .targetStaff(staff2)
                .facility(facility)
                .reason("Đổi ca")
                .status(ShiftSwapStatus.PENDING)
                .build();
        swap.setId(swapId);

        when(shiftSwapRequestRepository.findById(swapId)).thenReturn(Optional.of(swap));
        when(requestContext.currentUserId()).thenReturn(managerId);
        when(requestContext.currentUserRole()).thenReturn("FACILITY_MANAGER");
        when(userRepository.findById(managerId)).thenReturn(Optional.of(manager));
        when(shiftSwapRequestRepository.save(any(ShiftSwapRequest.class))).thenAnswer(inv -> inv.getArgument(0));

        ShiftSwapResponse resp = ShiftSwapResponse.builder().id(swapId).status(ShiftSwapStatus.MANAGER_APPROVED).build();
        when(shiftSwapMapper.toResponse(any(ShiftSwapRequest.class))).thenReturn(resp);

        ShiftSwapReviewRequest reviewReq = ShiftSwapReviewRequest.builder()
                .status(ShiftSwapStatus.APPROVED)
                .managerNotes("Đồng ý đổi ca")
                .build();

        ShiftSwapResponse res = shiftSwapService.reviewSwapRequest(swapId, reviewReq);

        assertThat(res.getStatus()).isEqualTo(ShiftSwapStatus.MANAGER_APPROVED);
        assertThat(assignment.getStaff()).isEqualTo(staff1); // Not changed yet!
        verify(staffAssignmentRepository, never()).save(assignment);
        verify(activityLogService).record(eq(facilityId), eq(ActivityAction.SHIFT_SWAP_APPROVE), eq("ShiftSwapRequest"), eq(swapId), any(), any(), any());
    }

    @Test
    @DisplayName("Nhân sự tiếp nhận đồng ý nhận ca, chuyển trạng thái APPROVED và cập nhật phân công ca trực")
    void shouldTargetStaffAcceptSwapRequestSuccessfully() {
        UUID swapId = UUID.randomUUID();
        ShiftSwapRequest swap = ShiftSwapRequest.builder()
                .assignment(assignment)
                .requester(staff1)
                .targetStaff(staff2)
                .facility(facility)
                .reason("Đổi ca")
                .status(ShiftSwapStatus.MANAGER_APPROVED)
                .reviewedBy(manager)
                .build();
        swap.setId(swapId);

        when(shiftSwapRequestRepository.findById(swapId)).thenReturn(Optional.of(swap));
        when(requestContext.currentUserId()).thenReturn(staff2Id);
        when(shiftSwapRequestRepository.save(any(ShiftSwapRequest.class))).thenAnswer(inv -> inv.getArgument(0));

        ShiftSwapResponse resp = ShiftSwapResponse.builder().id(swapId).status(ShiftSwapStatus.APPROVED).build();
        when(shiftSwapMapper.toResponse(any(ShiftSwapRequest.class))).thenReturn(resp);

        ShiftSwapTargetRespondRequest respondReq = ShiftSwapTargetRespondRequest.builder()
                .accept(true)
                .notes("Tôi đồng ý trực thay")
                .build();

        ShiftSwapResponse res = shiftSwapService.respondToSwapRequest(swapId, respondReq);

        assertThat(res.getStatus()).isEqualTo(ShiftSwapStatus.APPROVED);
        assertThat(assignment.getStaff()).isEqualTo(staff2); // Updated to staff2!
        verify(staffAssignmentRepository).save(assignment);
        verify(activityLogService).record(eq(facilityId), eq(ActivityAction.SHIFT_SWAP_APPROVE), eq("ShiftSwapRequest"), eq(swapId), any(), any(), any());
    }

    @Test
    @DisplayName("Nhân sự tiếp nhận từ chối nhận ca, chuyển trạng thái REJECTED và không thay đổi ca trực")
    void shouldTargetStaffRejectSwapRequestSuccessfully() {
        UUID swapId = UUID.randomUUID();
        ShiftSwapRequest swap = ShiftSwapRequest.builder()
                .assignment(assignment)
                .requester(staff1)
                .targetStaff(staff2)
                .facility(facility)
                .reason("Đổi ca")
                .status(ShiftSwapStatus.MANAGER_APPROVED)
                .reviewedBy(manager)
                .build();
        swap.setId(swapId);

        when(shiftSwapRequestRepository.findById(swapId)).thenReturn(Optional.of(swap));
        when(requestContext.currentUserId()).thenReturn(staff2Id);
        when(shiftSwapRequestRepository.save(any(ShiftSwapRequest.class))).thenAnswer(inv -> inv.getArgument(0));

        ShiftSwapResponse resp = ShiftSwapResponse.builder().id(swapId).status(ShiftSwapStatus.REJECTED).build();
        when(shiftSwapMapper.toResponse(any(ShiftSwapRequest.class))).thenReturn(resp);

        ShiftSwapTargetRespondRequest respondReq = ShiftSwapTargetRespondRequest.builder()
                .accept(false)
                .notes("Bận lịch học không trực thay được")
                .build();

        ShiftSwapResponse res = shiftSwapService.respondToSwapRequest(swapId, respondReq);

        assertThat(res.getStatus()).isEqualTo(ShiftSwapStatus.REJECTED);
        assertThat(assignment.getStaff()).isEqualTo(staff1); // Not changed!
        verify(staffAssignmentRepository, never()).save(assignment);
        verify(activityLogService).record(eq(facilityId), eq(ActivityAction.SHIFT_SWAP_REJECT), eq("ShiftSwapRequest"), eq(swapId), any(), any(), any());
    }

    @Test
    @DisplayName("Nhân sự tiếp nhận không thể phản hồi khi đơn chưa được Quản lý duyệt")
    void shouldFailTargetStaffRespondWhenNotManagerApproved() {
        UUID swapId = UUID.randomUUID();
        ShiftSwapRequest swap = ShiftSwapRequest.builder()
                .assignment(assignment)
                .requester(staff1)
                .targetStaff(staff2)
                .facility(facility)
                .reason("Đổi ca")
                .status(ShiftSwapStatus.PENDING)
                .build();
        swap.setId(swapId);

        when(shiftSwapRequestRepository.findById(swapId)).thenReturn(Optional.of(swap));
        when(requestContext.currentUserId()).thenReturn(staff2Id);

        ShiftSwapTargetRespondRequest respondReq = ShiftSwapTargetRespondRequest.builder()
                .accept(true)
                .build();

        AppException ex = assertThrows(AppException.class, () -> shiftSwapService.respondToSwapRequest(swapId, respondReq));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.SHIFT_SWAP_ALREADY_PROCESSED);
    }

    @Test
    @DisplayName("Quản lý từ chối yêu cầu đổi ca")
    void shouldRejectSwapRequestSuccessfully() {
        UUID swapId = UUID.randomUUID();
        ShiftSwapRequest swap = ShiftSwapRequest.builder()
                .assignment(assignment)
                .requester(staff1)
                .targetStaff(staff2)
                .facility(facility)
                .reason("Đổi ca")
                .status(ShiftSwapStatus.PENDING)
                .build();
        swap.setId(swapId);

        when(shiftSwapRequestRepository.findById(swapId)).thenReturn(Optional.of(swap));
        when(requestContext.currentUserId()).thenReturn(managerId);
        when(requestContext.currentUserRole()).thenReturn("FACILITY_MANAGER");
        when(userRepository.findById(managerId)).thenReturn(Optional.of(manager));
        when(shiftSwapRequestRepository.save(any(ShiftSwapRequest.class))).thenAnswer(inv -> inv.getArgument(0));

        ShiftSwapResponse resp = ShiftSwapResponse.builder().id(swapId).status(ShiftSwapStatus.REJECTED).build();
        when(shiftSwapMapper.toResponse(any(ShiftSwapRequest.class))).thenReturn(resp);

        ShiftSwapReviewRequest reviewReq = ShiftSwapReviewRequest.builder()
                .status(ShiftSwapStatus.REJECTED)
                .managerNotes("Không đủ nhân sự thay thế")
                .build();

        ShiftSwapResponse res = shiftSwapService.reviewSwapRequest(swapId, reviewReq);

        assertThat(res.getStatus()).isEqualTo(ShiftSwapStatus.REJECTED);
        assertThat(assignment.getStaff()).isEqualTo(staff1); // Not changed!
        verify(activityLogService).record(eq(facilityId), eq(ActivityAction.SHIFT_SWAP_REJECT), eq("ShiftSwapRequest"), eq(swapId), any(), any(), any());
    }
}

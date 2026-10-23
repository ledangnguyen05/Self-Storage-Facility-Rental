package com.boxora.service;

import com.boxora.dto.request.ShiftHandoverAcknowledgeRequest;
import com.boxora.dto.request.ShiftHandoverCreateRequest;
import com.boxora.dto.request.ShiftHandoverDispatchRequest;
import com.boxora.dto.response.ShiftHandoverResponse;
import com.boxora.entity.Facility;
import com.boxora.entity.Role;
import com.boxora.entity.ShiftHandover;
import com.boxora.entity.User;
import com.boxora.enums.ActivityAction;
import com.boxora.enums.ShiftHandoverStatus;
import com.boxora.enums.ShiftHandoverType;
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
import com.boxora.service.impl.ShiftHandoverServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ShiftHandoverServiceTest {

    @Mock
    private ShiftHandoverRepository shiftHandoverRepository;

    @Mock
    private FacilityRepository facilityRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private StaffAssignmentRepository staffAssignmentRepository;

    @Mock
    private ShiftHandoverMapper shiftHandoverMapper;

    @Mock
    private ActivityLogService activityLogService;

    @Mock
    private FacilityAccessGuard facilityAccessGuard;

    @Mock
    private RequestContext requestContext;

    @InjectMocks
    private ShiftHandoverServiceImpl shiftHandoverService;

    private UUID facilityId;
    private UUID staff1Id;
    private UUID staff2Id;
    private UUID managerId;
    private Facility facility;
    private User staff1;
    private User staff2;
    private User manager;
    private Role staffRole;
    private Role managerRole;

    @BeforeEach
    void setUp() {
        facilityId = UUID.randomUUID();
        staff1Id = UUID.randomUUID();
        staff2Id = UUID.randomUUID();
        managerId = UUID.randomUUID();

        facility = Facility.builder().name("Boxora Tan Binh").code("HCM-TB").build();
        facility.setId(facilityId);

        staffRole = Role.builder().name("STAFF").build();
        managerRole = Role.builder().name("FACILITY_MANAGER").build();

        staff1 = User.builder().username("staff1").fullName("Staff One").role(staffRole).facility(facility).isActive(true).build();
        staff1.setId(staff1Id);

        staff2 = User.builder().username("staff2").fullName("Staff Two").role(staffRole).facility(facility).isActive(true).build();
        staff2.setId(staff2Id);

        manager = User.builder().username("manager1").fullName("Facility Manager").role(managerRole).facility(facility).isActive(true).build();
        manager.setId(managerId);
    }

    @Test
    @DisplayName("1. Lập biên bản bàn giao ca định kỳ thành công")
    void shouldCreateRoutineHandoverSuccessfully() {
        ShiftHandoverCreateRequest req = ShiftHandoverCreateRequest.builder()
                .facilityId(facilityId)
                .handoverDate(LocalDate.now())
                .shift(StaffShift.MORNING)
                .targetShift(StaffShift.AFTERNOON)
                .handoverType(ShiftHandoverType.ROUTINE)
                .incomingStaffId(staff2Id)
                .pendingTasks("Kiểm tra pin SmartLock buồng B104")
                .pendingTicketsCount(1)
                .unresolvedBookingsCount(0)
                .cashInDrawer(new BigDecimal("1000000"))
                .checklistCompleted(true)
                .build();

        when(facilityRepository.findById(facilityId)).thenReturn(Optional.of(facility));
        when(requestContext.currentUserId()).thenReturn(staff1Id);
        when(userRepository.findById(staff1Id)).thenReturn(Optional.of(staff1));
        when(userRepository.findById(staff2Id)).thenReturn(Optional.of(staff2));

        ShiftHandover saved = ShiftHandover.builder()
                .facility(facility)
                .handoverDate(req.getHandoverDate())
                .shift(StaffShift.MORNING)
                .targetShift(StaffShift.AFTERNOON)
                .handoverType(ShiftHandoverType.ROUTINE)
                .outgoingStaff(staff1)
                .incomingStaff(staff2)
                .checklistCompleted(true)
                .status(ShiftHandoverStatus.SUBMITTED)
                .build();
        saved.setId(UUID.randomUUID());
        when(shiftHandoverRepository.save(any(ShiftHandover.class))).thenReturn(saved);

        ShiftHandoverResponse resp = ShiftHandoverResponse.builder()
                .id(saved.getId())
                .handoverType(ShiftHandoverType.ROUTINE)
                .status(ShiftHandoverStatus.SUBMITTED)
                .build();
        when(shiftHandoverMapper.toResponse(saved)).thenReturn(resp);

        ShiftHandoverResponse res = shiftHandoverService.createHandover(req);

        assertThat(res.getStatus()).isEqualTo(ShiftHandoverStatus.SUBMITTED);
        assertThat(res.getHandoverType()).isEqualTo(ShiftHandoverType.ROUTINE);
        verify(activityLogService).record(eq(facilityId), eq(ActivityAction.SHIFT_HANDOVER_CREATE), eq("ShiftHandover"), eq(saved.getId()), any(), any(), any());
    }

    @Test
    @DisplayName("2. Bàn giao đột xuất khi chưa có người nhận chuyển sang PENDING_DISPATCH")
    void shouldCreateEmergencyHandoverWithPendingDispatch() {
        ShiftHandoverCreateRequest req = ShiftHandoverCreateRequest.builder()
                .facilityId(facilityId)
                .handoverDate(LocalDate.now())
                .shift(StaffShift.MORNING)
                .handoverType(ShiftHandoverType.EMERGENCY)
                .emergencyReason("Nhân viên bị sốt cao cần đi viện cấp cứu")
                .incomingStaffId(null) // Chưa có người nhận tại chỗ
                .cashInDrawer(new BigDecimal("500000"))
                .checklistCompleted(true)
                .build();

        when(facilityRepository.findById(facilityId)).thenReturn(Optional.of(facility));
        when(requestContext.currentUserId()).thenReturn(staff1Id);
        when(userRepository.findById(staff1Id)).thenReturn(Optional.of(staff1));

        ShiftHandover saved = ShiftHandover.builder()
                .facility(facility)
                .handoverDate(req.getHandoverDate())
                .shift(StaffShift.MORNING)
                .handoverType(ShiftHandoverType.EMERGENCY)
                .outgoingStaff(staff1)
                .incomingStaff(null)
                .checklistCompleted(true)
                .status(ShiftHandoverStatus.PENDING_DISPATCH)
                .build();
        saved.setId(UUID.randomUUID());
        when(shiftHandoverRepository.save(any(ShiftHandover.class))).thenReturn(saved);

        ShiftHandoverResponse resp = ShiftHandoverResponse.builder()
                .id(saved.getId())
                .status(ShiftHandoverStatus.PENDING_DISPATCH)
                .handoverType(ShiftHandoverType.EMERGENCY)
                .build();
        when(shiftHandoverMapper.toResponse(saved)).thenReturn(resp);

        ShiftHandoverResponse res = shiftHandoverService.createHandover(req);

        assertThat(res.getStatus()).isEqualTo(ShiftHandoverStatus.PENDING_DISPATCH);
    }

    @Test
    @DisplayName("3. Bàn giao đột xuất thiếu lý do phải báo lỗi SHIFT_HANDOVER_EMERGENCY_REASON_REQUIRED")
    void shouldFailWhenEmergencyReasonMissing() {
        ShiftHandoverCreateRequest req = ShiftHandoverCreateRequest.builder()
                .facilityId(facilityId)
                .handoverDate(LocalDate.now())
                .shift(StaffShift.MORNING)
                .handoverType(ShiftHandoverType.EMERGENCY)
                .emergencyReason("   ") // Rỗng
                .checklistCompleted(true)
                .build();

        when(facilityRepository.findById(facilityId)).thenReturn(Optional.of(facility));
        when(requestContext.currentUserId()).thenReturn(staff1Id);
        when(userRepository.findById(staff1Id)).thenReturn(Optional.of(staff1));

        AppException ex = assertThrows(AppException.class, () -> shiftHandoverService.createHandover(req));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.SHIFT_HANDOVER_EMERGENCY_REASON_REQUIRED);
    }

    @Test
    @DisplayName("4. Không cho phép nhân viên tự nhận bàn giao của chính mình")
    void shouldFailWhenSelfReceiving() {
        ShiftHandoverCreateRequest req = ShiftHandoverCreateRequest.builder()
                .facilityId(facilityId)
                .handoverDate(LocalDate.now())
                .shift(StaffShift.MORNING)
                .incomingStaffId(staff1Id) // Chính mình
                .checklistCompleted(true)
                .build();

        when(facilityRepository.findById(facilityId)).thenReturn(Optional.of(facility));
        when(requestContext.currentUserId()).thenReturn(staff1Id);
        when(userRepository.findById(staff1Id)).thenReturn(Optional.of(staff1));

        AppException ex = assertThrows(AppException.class, () -> shiftHandoverService.createHandover(req));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.SHIFT_HANDOVER_SELF_RECEIVE_FORBIDDEN);
    }

    @Test
    @DisplayName("5. Quản lý điều phối nhân sự tiếp nhận bàn giao thành công")
    void shouldDispatchRecipientSuccessfully() {
        UUID handoverId = UUID.randomUUID();
        ShiftHandover handover = ShiftHandover.builder()
                .facility(facility)
                .handoverDate(LocalDate.now())
                .shift(StaffShift.MORNING)
                .outgoingStaff(staff1)
                .incomingStaff(null)
                .status(ShiftHandoverStatus.PENDING_DISPATCH)
                .build();
        handover.setId(handoverId);

        when(requestContext.hasAnyRole("FACILITY_MANAGER", "BUSINESS_MANAGER", "ADMIN")).thenReturn(true);
        when(shiftHandoverRepository.findById(handoverId)).thenReturn(Optional.of(handover));
        when(requestContext.currentUserId()).thenReturn(managerId);
        when(userRepository.findById(managerId)).thenReturn(Optional.of(manager));
        when(userRepository.findById(staff2Id)).thenReturn(Optional.of(staff2));
        when(shiftHandoverRepository.save(any(ShiftHandover.class))).thenAnswer(inv -> inv.getArgument(0));

        ShiftHandoverResponse resp = ShiftHandoverResponse.builder()
                .id(handoverId)
                .status(ShiftHandoverStatus.SUBMITTED)
                .incomingStaffId(staff2Id)
                .dispatchedById(managerId)
                .build();
        when(shiftHandoverMapper.toResponse(any(ShiftHandover.class))).thenReturn(resp);

        ShiftHandoverDispatchRequest dispatchReq = ShiftHandoverDispatchRequest.builder()
                .incomingStaffId(staff2Id)
                .notes("Quản lý cơ sở điều động thay thế ca sáng")
                .build();

        ShiftHandoverResponse res = shiftHandoverService.dispatchRecipient(handoverId, dispatchReq);

        assertThat(res.getStatus()).isEqualTo(ShiftHandoverStatus.SUBMITTED);
        assertThat(handover.getDispatchedBy()).isEqualTo(manager);
        assertThat(handover.getDispatchedAt()).isNotNull();
        verify(activityLogService).record(eq(facilityId), eq(ActivityAction.SHIFT_HANDOVER_DISPATCH), eq("ShiftHandover"), eq(handoverId), any(), any(), any());
    }

    @Test
    @DisplayName("6. Nhân viên không có quyền điều phối nhân sự (báo lỗi SHIFT_HANDOVER_DISPATCH_NOT_ALLOWED)")
    void shouldFailWhenStaffAttemptsDispatch() {
        UUID handoverId = UUID.randomUUID();
        when(requestContext.hasAnyRole("FACILITY_MANAGER", "BUSINESS_MANAGER", "ADMIN")).thenReturn(false);

        ShiftHandoverDispatchRequest dispatchReq = ShiftHandoverDispatchRequest.builder()
                .incomingStaffId(staff2Id)
                .build();

        AppException ex = assertThrows(AppException.class, () -> shiftHandoverService.dispatchRecipient(handoverId, dispatchReq));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.SHIFT_HANDOVER_DISPATCH_NOT_ALLOWED);
    }

    @Test
    @DisplayName("7. Người lập biên bản không thể tự bấm xác nhận tiếp nhận")
    void shouldPreventSelfAcknowledgment() {
        UUID handoverId = UUID.randomUUID();
        ShiftHandover handover = ShiftHandover.builder()
                .facility(facility)
                .handoverDate(LocalDate.now())
                .shift(StaffShift.MORNING)
                .outgoingStaff(staff1)
                .incomingStaff(staff2)
                .status(ShiftHandoverStatus.SUBMITTED)
                .build();
        handover.setId(handoverId);

        when(shiftHandoverRepository.findById(handoverId)).thenReturn(Optional.of(handover));
        when(requestContext.currentUserId()).thenReturn(staff1Id); // Outgoing staff cố tự nhận!

        ShiftHandoverAcknowledgeRequest ackReq = ShiftHandoverAcknowledgeRequest.builder()
                .status(ShiftHandoverStatus.ACKNOWLEDGED)
                .build();

        AppException ex = assertThrows(AppException.class, () -> shiftHandoverService.acknowledgeHandover(handoverId, ackReq));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.FORBIDDEN);
    }

    @Test
    @DisplayName("8. Tiếp nhận ca với chênh lệch quỹ chuyển sang trạng thái DISCREPANCY")
    void shouldTrackCashDiscrepancyOnAcknowledge() {
        UUID handoverId = UUID.randomUUID();
        ShiftHandover handover = ShiftHandover.builder()
                .facility(facility)
                .handoverDate(LocalDate.now())
                .shift(StaffShift.MORNING)
                .outgoingStaff(staff1)
                .incomingStaff(staff2)
                .cashInDrawer(new BigDecimal("1000000"))
                .status(ShiftHandoverStatus.SUBMITTED)
                .build();
        handover.setId(handoverId);

        when(shiftHandoverRepository.findById(handoverId)).thenReturn(Optional.of(handover));
        when(requestContext.currentUserId()).thenReturn(staff2Id);
        when(shiftHandoverRepository.save(any(ShiftHandover.class))).thenAnswer(inv -> inv.getArgument(0));

        ShiftHandoverResponse resp = ShiftHandoverResponse.builder()
                .id(handoverId)
                .status(ShiftHandoverStatus.DISCREPANCY)
                .cashDiscrepancy(new BigDecimal("-50000"))
                .build();
        when(shiftHandoverMapper.toResponse(any(ShiftHandover.class))).thenReturn(resp);

        ShiftHandoverAcknowledgeRequest ackReq = ShiftHandoverAcknowledgeRequest.builder()
                .status(ShiftHandoverStatus.ACKNOWLEDGED)
                .cashCounted(new BigDecimal("950000"))
                .cashDiscrepancy(new BigDecimal("-50000"))
                .cashDiscrepancyReason("Thiếu 50,000 đ so với sổ sách")
                .notes("Đã đối soát két quầy, ghi nhận thiếu tiền")
                .build();

        ShiftHandoverResponse res = shiftHandoverService.acknowledgeHandover(handoverId, ackReq);

        assertThat(res.getStatus()).isEqualTo(ShiftHandoverStatus.DISCREPANCY);
        assertThat(handover.getStatus()).isEqualTo(ShiftHandoverStatus.DISCREPANCY);
        assertThat(handover.getCashDiscrepancy()).isEqualTo(new BigDecimal("-50000"));
    }
}

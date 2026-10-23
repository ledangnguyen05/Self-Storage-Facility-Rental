package com.boxora.service;

import com.boxora.dto.request.ShiftHandoverAcknowledgeRequest;
import com.boxora.dto.request.ShiftHandoverCreateRequest;
import com.boxora.dto.response.ShiftHandoverResponse;
import com.boxora.entity.Facility;
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
    private Facility facility;
    private User staff1;
    private User staff2;

    @BeforeEach
    void setUp() {
        facilityId = UUID.randomUUID();
        staff1Id = UUID.randomUUID();
        staff2Id = UUID.randomUUID();
        managerId = UUID.randomUUID();

        facility = Facility.builder().name("Boxora Tan Binh").code("HCM-TB").build();
        facility.setId(facilityId);

        staff1 = User.builder().username("staff1").fullName("Staff One").isActive(true).build();
        staff1.setId(staff1Id);

        staff2 = User.builder().username("staff2").fullName("Staff Two").isActive(true).build();
        staff2.setId(staff2Id);
    }

    @Test
    @DisplayName("Lập biên bản bàn giao ca thành công khi checklist hoàn tất")
    void shouldCreateHandoverSuccessfully() {
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

        ShiftHandoverResponse resp = ShiftHandoverResponse.builder().id(saved.getId()).status(ShiftHandoverStatus.SUBMITTED).build();
        when(shiftHandoverMapper.toResponse(saved)).thenReturn(resp);

        ShiftHandoverResponse res = shiftHandoverService.createHandover(req);

        assertThat(res.getStatus()).isEqualTo(ShiftHandoverStatus.SUBMITTED);
        assertThat(res.getHandoverType()).isEqualTo(ShiftHandoverType.ROUTINE);
        verify(activityLogService).record(eq(facilityId), eq(ActivityAction.SHIFT_HANDOVER_CREATE), eq("ShiftHandover"), eq(saved.getId()), any(), any(), any());
    }

    @Test
    @DisplayName("Lập biên bản bàn giao thất bại nếu chưa hoàn tất checklist bắt buộc")
    void shouldFailWhenChecklistNotCompleted() {
        ShiftHandoverCreateRequest req = ShiftHandoverCreateRequest.builder()
                .facilityId(facilityId)
                .handoverDate(LocalDate.now())
                .shift(StaffShift.MORNING)
                .checklistCompleted(false)
                .build();

        AppException ex = assertThrows(AppException.class, () -> shiftHandoverService.createHandover(req));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.SHIFT_HANDOVER_CHECKLIST_INCOMPLETE);
    }

    @Test
    @DisplayName("Tiếp nhận và xác nhận biên bản bàn giao ca thành công")
    void shouldAcknowledgeHandoverSuccessfully() {
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
        when(requestContext.currentUserId()).thenReturn(staff2Id);
        when(userRepository.findById(staff2Id)).thenReturn(Optional.of(staff2));
        when(shiftHandoverRepository.save(any(ShiftHandover.class))).thenAnswer(inv -> inv.getArgument(0));

        ShiftHandoverResponse resp = ShiftHandoverResponse.builder().id(handoverId).status(ShiftHandoverStatus.ACKNOWLEDGED).build();
        when(shiftHandoverMapper.toResponse(any(ShiftHandover.class))).thenReturn(resp);

        ShiftHandoverAcknowledgeRequest ackReq = ShiftHandoverAcknowledgeRequest.builder()
                .status(ShiftHandoverStatus.ACKNOWLEDGED)
                .notes("Đã nhận đủ tiền và kiểm tra kho")
                .build();

        ShiftHandoverResponse res = shiftHandoverService.acknowledgeHandover(handoverId, ackReq);

        assertThat(res.getStatus()).isEqualTo(ShiftHandoverStatus.ACKNOWLEDGED);
        assertThat(handover.getAcknowledgedAt()).isNotNull();
        verify(activityLogService).record(eq(facilityId), eq(ActivityAction.SHIFT_HANDOVER_ACKNOWLEDGE), eq("ShiftHandover"), eq(handoverId), any(), any(), any());
    }
}

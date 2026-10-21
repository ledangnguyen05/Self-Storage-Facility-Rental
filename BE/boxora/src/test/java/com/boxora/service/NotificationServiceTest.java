package com.boxora.service;

import com.boxora.dto.response.NotificationLogResponse;
import com.boxora.dto.response.RenewalReminderScanResponse;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import org.mockito.ArgumentCaptor;
import com.boxora.entity.Facility;
import com.boxora.entity.NotificationLog;
import com.boxora.entity.RentalContract;
import com.boxora.entity.StorageUnit;
import com.boxora.entity.User;
import com.boxora.enums.NotificationType;
import com.boxora.enums.RentalContractStatus;
import com.boxora.repository.NotificationLogRepository;
import com.boxora.repository.RentalContractRepository;
import com.boxora.security.FacilityAccessGuard;
import com.boxora.security.RequestContext;
import com.boxora.service.impl.NotificationServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertThrows;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class NotificationServiceTest {

    @Mock
    private NotificationLogRepository notificationLogRepository;

    @Mock
    private RentalContractRepository rentalContractRepository;

    @Mock
    private EmailService emailService;

    @Mock
    private ActivityLogService activityLogService;

    @Mock
    private FacilityAccessGuard facilityAccessGuard;

    @Mock
    private RequestContext requestContext;

    @InjectMocks
    private NotificationServiceImpl notificationService;

    private User mockCustomer;
    private Facility mockFacility;
    private StorageUnit mockUnit;
    private RentalContract contract7d;
    private RentalContract contract3d;
    private RentalContract contractFar;

    @BeforeEach
    void setUp() {
        mockFacility = Facility.builder().name("Boxora Bình Thạnh").build();
        mockFacility.setId(UUID.randomUUID());

        mockUnit = StorageUnit.builder().unitCode("BT-202").facility(mockFacility).build();
        mockCustomer = User.builder().fullName("Vũ Hoàng D").email("d.vu@example.com").build();
        mockCustomer.setId(UUID.randomUUID());

        LocalDate today = LocalDate.now();

        // Hợp đồng còn đúng 7 ngày
        contract7d = RentalContract.builder()
                .contractCode("CTR-7D")
                .customer(mockCustomer)
                .facility(mockFacility)
                .unit(mockUnit)
                .monthlyFee(new BigDecimal("2000000"))
                .status(RentalContractStatus.ACTIVE)
                .endDate(today.plusDays(7))
                .build();
        contract7d.setId(UUID.randomUUID());

        // Hợp đồng còn đúng 3 ngày (khẩn cấp)
        contract3d = RentalContract.builder()
                .contractCode("CTR-3D")
                .customer(mockCustomer)
                .facility(mockFacility)
                .unit(mockUnit)
                .monthlyFee(new BigDecimal("2000000"))
                .status(RentalContractStatus.ACTIVE)
                .endDate(today.plusDays(3))
                .build();
        contract3d.setId(UUID.randomUUID());

        // Hợp đồng còn xa (30 ngày)
        contractFar = RentalContract.builder()
                .contractCode("CTR-30D")
                .customer(mockCustomer)
                .facility(mockFacility)
                .unit(mockUnit)
                .monthlyFee(new BigDecimal("2000000"))
                .status(RentalContractStatus.ACTIVE)
                .endDate(today.plusDays(30))
                .build();
        contractFar.setId(UUID.randomUUID());
    }

    @Test
    @DisplayName("scanAndSendRenewalReminders should send 7d and 3d reminders and prevent duplicate sending")
    void testScanAndSendRenewalReminders() {
        when(rentalContractRepository.findByStatus(RentalContractStatus.ACTIVE))
                .thenReturn(List.of(contract7d, contract3d, contractFar));

        when(emailService.isMailConfigured()).thenReturn(true);
        when(notificationLogRepository.save(any(NotificationLog.class))).thenAnswer(inv -> inv.getArgument(0));

        // contract7d chưa gửi mốc 7d
        when(notificationLogRepository.existsByNotificationTypeAndReferenceIdAndStatus(eq(NotificationType.RENEWAL_REMINDER_7D), eq(contract7d.getId()), eq("SENT")))
                .thenReturn(false);

        // contract3d chưa gửi mốc 3d
        when(notificationLogRepository.existsByNotificationTypeAndReferenceIdAndStatus(eq(NotificationType.RENEWAL_REMINDER_3D), eq(contract3d.getId()), eq("SENT")))
                .thenReturn(false);

        RenewalReminderScanResponse response = notificationService.scanAndSendRenewalReminders();

        assertThat(response.getScannedContractsCount()).isEqualTo(3);
        assertThat(response.getSevenDayRemindersSent()).isEqualTo(1);
        assertThat(response.getThreeDayRemindersSent()).isEqualTo(1);

        // Verify the mails were sent synchronously (1 for 7d, 1 for 3d)
        verify(emailService, times(2)).sendNow(eq("d.vu@example.com"), anyString(), anyString());
        // Verify notificationLog saved twice
        verify(notificationLogRepository, times(2)).save(any(NotificationLog.class));
    }

    @Test
    @DisplayName("scanAndSendRenewalReminders should skip contracts that have already been reminded")
    void testScanAndSendRenewalRemindersIdempotent() {
        when(rentalContractRepository.findByStatus(RentalContractStatus.ACTIVE))
                .thenReturn(List.of(contract7d));

        // contract7d ĐÃ gửi trước đó
        when(notificationLogRepository.existsByNotificationTypeAndReferenceIdAndStatus(eq(NotificationType.RENEWAL_REMINDER_7D), eq(contract7d.getId()), eq("SENT")))
                .thenReturn(true);

        RenewalReminderScanResponse response = notificationService.scanAndSendRenewalReminders();

        assertThat(response.getScannedContractsCount()).isEqualTo(1);
        assertThat(response.getSevenDayRemindersSent()).isEqualTo(0);

        verify(emailService, never()).sendNow(anyString(), anyString(), anyString());
        verify(notificationLogRepository, never()).save(any(NotificationLog.class));
    }

    @Test
    @DisplayName("Chưa cấu hình SMTP: không báo đã gửi, ghi nhận FAILED kèm lý do và không tính vào số email đã gửi")
    void testScanWithoutMailConfigurationDoesNotClaimSuccess() {
        when(rentalContractRepository.findByStatus(RentalContractStatus.ACTIVE)).thenReturn(List.of(contract7d));
        when(emailService.isMailConfigured()).thenReturn(false);
        when(notificationLogRepository.save(any(NotificationLog.class))).thenAnswer(inv -> inv.getArgument(0));

        RenewalReminderScanResponse response = notificationService.scanAndSendRenewalReminders();

        assertThat(response.getSevenDayRemindersSent()).isEqualTo(0);
        ArgumentCaptor<NotificationLog> saved = ArgumentCaptor.forClass(NotificationLog.class);
        verify(notificationLogRepository).save(saved.capture());
        assertThat(saved.getValue().getStatus()).isEqualTo("FAILED");
        assertThat(saved.getValue().getErrorMessage()).contains("SMTP");
        verify(emailService, never()).sendNow(anyString(), anyString(), anyString());
    }

    @Test
    @DisplayName("Gửi nhắc gia hạn thủ công: lỗi gửi thư trả về bản ghi FAILED thay vì báo thành công")
    void testManualReminderReportsFailure() {
        when(rentalContractRepository.findById(contract7d.getId())).thenReturn(Optional.of(contract7d));
        when(emailService.isMailConfigured()).thenReturn(true);
        doThrow(new AppException(ErrorCode.EMAIL_SEND_FAILED)).when(emailService).sendNow(anyString(), anyString(), anyString());
        when(notificationLogRepository.save(any(NotificationLog.class))).thenAnswer(inv -> inv.getArgument(0));

        NotificationLogResponse response = notificationService.sendSingleContractRenewalReminder(contract7d.getId());

        assertThat(response.getStatus()).isEqualTo("FAILED");
        assertThat(response.getErrorMessage()).isNotBlank();
    }

    @Test
    @DisplayName("Đánh dấu đã đọc: chỉ thông báo của chính mình, gọi lại không đổi thời điểm đọc")
    void testMarkReadOnlyOwnNotification() {
        UUID me = mockCustomer.getId();
        NotificationLog mine = NotificationLog.builder().recipient(mockCustomer).recipientEmail("d.vu@example.com")
                .notificationType(NotificationType.HANDOVER_PIN).title("Bàn giao kho").build();
        mine.setId(UUID.randomUUID());
        User other = User.builder().fullName("Người khác").build();
        other.setId(UUID.randomUUID());
        NotificationLog notMine = NotificationLog.builder().recipient(other).recipientEmail("x@example.com")
                .notificationType(NotificationType.HANDOVER_PIN).title("Của người khác").build();
        notMine.setId(UUID.randomUUID());

        when(requestContext.currentUserId()).thenReturn(me);
        when(notificationLogRepository.findById(mine.getId())).thenReturn(Optional.of(mine));
        when(notificationLogRepository.findById(notMine.getId())).thenReturn(Optional.of(notMine));
        when(notificationLogRepository.save(any(NotificationLog.class))).thenAnswer(inv -> inv.getArgument(0));

        NotificationLogResponse first = notificationService.markRead(mine.getId());
        assertThat(first.isRead()).isTrue();
        assertThat(first.getReadAt()).isNotNull();
        java.time.LocalDateTime firstReadAt = mine.getReadAt();
        notificationService.markRead(mine.getId());
        assertThat(mine.getReadAt()).isEqualTo(firstReadAt);

        AppException ex = assertThrows(AppException.class, () -> notificationService.markRead(notMine.getId()));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.NOTIFICATION_NOT_FOUND);
        assertThat(notMine.getReadAt()).isNull();
    }

    @Test
    @DisplayName("Khách không đọc được thông báo của người khác theo ID")
    void testCustomerCannotReadOthersNotificationById() {
        User other = User.builder().fullName("Người khác").build();
        other.setId(UUID.randomUUID());
        NotificationLog notMine = NotificationLog.builder().recipient(other).recipientEmail("x@example.com")
                .notificationType(NotificationType.REFUND_STATUS).title("Hoàn tiền").build();
        notMine.setId(UUID.randomUUID());
        when(requestContext.currentUserRole()).thenReturn("CUSTOMER");
        when(requestContext.currentUserId()).thenReturn(mockCustomer.getId());
        when(notificationLogRepository.findById(notMine.getId())).thenReturn(Optional.of(notMine));

        AppException ex = assertThrows(AppException.class, () -> notificationService.getById(notMine.getId()));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.NOTIFICATION_NOT_FOUND);
    }

    @Test
    @DisplayName("Số chưa đọc và đọc tất cả dùng id của tài khoản đang đăng nhập")
    void testUnreadCountAndReadAll() {
        UUID me = mockCustomer.getId();
        when(requestContext.currentUserId()).thenReturn(me);
        when(notificationLogRepository.countByRecipient_IdAndReadAtIsNull(me)).thenReturn(3L);
        when(notificationLogRepository.markAllRead(eq(me), any())).thenReturn(3);

        assertThat(notificationService.countMyUnread()).isEqualTo(3L);
        assertThat(notificationService.markAllRead()).isEqualTo(3);
    }
}

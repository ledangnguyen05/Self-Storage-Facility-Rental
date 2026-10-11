package com.boxora.service;

import com.boxora.dto.request.BookingCancelRequest;
import com.boxora.dto.response.AutoCancelResult;
import com.boxora.dto.response.BookingCancelResponse;
import com.boxora.dto.response.BookingCancellationPreviewResponse;
import com.boxora.entity.*;
import com.boxora.enums.ActivityAction;
import com.boxora.enums.BookingStatus;
import com.boxora.enums.PaymentStatus;
import com.boxora.enums.PaymentType;
import com.boxora.enums.UnitStatus;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.repository.BookingRepository;
import com.boxora.repository.FacilityPolicyRepository;
import com.boxora.repository.PaymentRepository;
import com.boxora.repository.StorageUnitRepository;
import com.boxora.security.RequestContext;
import com.boxora.service.impl.BookingCancellationServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BookingCancellationServiceTest {

    @Mock
    private BookingRepository bookingRepository;

    @Mock
    private StorageUnitRepository storageUnitRepository;

    @Mock
    private FacilityPolicyRepository facilityPolicyRepository;

    @Mock
    private PaymentRepository paymentRepository;

    @Mock
    private ActivityLogService activityLogService;

    @Mock
    private RequestContext requestContext;

    @InjectMocks
    private BookingCancellationServiceImpl cancellationService;

    private Facility testFacility;
    private FacilityPolicy testPolicy;
    private StorageUnit testUnit;
    private User testCustomer;
    private Booking testBooking;
    private UUID bookingId;
    private UUID customerId;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(cancellationService, "defaultPendingPaymentTimeoutMinutes", 15);

        customerId = UUID.randomUUID();
        bookingId = UUID.randomUUID();

        testCustomer = User.builder()
                .email("customer@example.com")
                .fullName("Nguyen Van Khach")
                .build();
        testCustomer.setId(customerId);

        testFacility = Facility.builder()
                .name("Boxora Ho Chi Minh Central")
                .build();
        testFacility.setId(UUID.randomUUID());

        testPolicy = FacilityPolicy.builder()
                .facility(testFacility)
                .cancellationFullRefundHours(48)
                .cancellationPartialRefundHours(24)
                .cancellationPartialRefundPercent(50.0)
                .build();

        testUnit = StorageUnit.builder()
                .unitCode("U-101")
                .facility(testFacility)
                .status(UnitStatus.OCCUPIED)
                .build();
        testUnit.setId(UUID.randomUUID());

        testBooking = Booking.builder()
                .bookingCode("BK-20261011-0001")
                .customer(testCustomer)
                .storageUnit(testUnit)
                .startDate(LocalDate.now().plusDays(4))
                .endDate(LocalDate.now().plusDays(34))
                .rentalMonths(1)
                .totalRentalFee(new BigDecimal("2000000.00"))
                .depositPaid(new BigDecimal("1000000.00"))
                .status(BookingStatus.CONFIRMED)
                .accessPin("123456")
                .qrAccessToken("VALID_TOKEN")
                .build();
        testBooking.setId(bookingId);
    }

    @Nested
    @DisplayName("Preview Refund Tests (3 Mốc)")
    class PreviewRefundTests {

        @Test
        @DisplayName("Mốc 1 (>= 48h): Hoàn 100% tiền cọc")
        void preview_Stage1_FullRefund() {
            // >= 48h trước check-in
            testBooking.setStartDate(LocalDate.now().plusDays(4));
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(facilityPolicyRepository.findByFacility_Id(testFacility.getId()))
                    .thenReturn(Optional.of(testPolicy));

            BookingCancellationPreviewResponse preview = cancellationService.previewCancellationRefund(bookingId);

            assertThat(preview).isNotNull();
            assertThat(preview.getMilestoneStage()).isEqualTo("STAGE_1_FULL_REFUND");
            assertThat(preview.getRefundPercentage()).isEqualTo(100.0);
            assertThat(preview.getRefundAmount()).isEqualByComparingTo(new BigDecimal("1000000.00"));
            assertThat(preview.getPenaltyAmount()).isEqualByComparingTo(BigDecimal.ZERO);
            assertThat(preview.isRefundable()).isTrue();
        }

        @Test
        @DisplayName("Mốc 2 (24h - 48h): Hoàn 50% tiền cọc, phạt 50%")
        void preview_Stage2_PartialRefund() {
            // 24h - 48h trước check-in (ngày T+2 cách now từ 24h đến dưới 48h)
            testBooking.setStartDate(LocalDate.now().plusDays(2));
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(facilityPolicyRepository.findByFacility_Id(testFacility.getId()))
                    .thenReturn(Optional.of(testPolicy));

            BookingCancellationPreviewResponse preview = cancellationService.previewCancellationRefund(bookingId);

            assertThat(preview).isNotNull();
            assertThat(preview.getMilestoneStage()).isEqualTo("STAGE_2_PARTIAL_REFUND");
            assertThat(preview.getRefundPercentage()).isEqualTo(50.0);
            assertThat(preview.getRefundAmount()).isEqualByComparingTo(new BigDecimal("500000.00"));
            assertThat(preview.getPenaltyAmount()).isEqualByComparingTo(new BigDecimal("500000.00"));
            assertThat(preview.isRefundable()).isTrue();
        }

        @Test
        @DisplayName("Mốc 3 (< 24h): Hoàn 0% tiền cọc, khấu trừ 100%")
        void preview_Stage3_NoRefund() {
            // < 24h trước check-in (ngày T+1 cách now dưới 24h)
            testBooking.setStartDate(LocalDate.now().plusDays(1));
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(facilityPolicyRepository.findByFacility_Id(testFacility.getId()))
                    .thenReturn(Optional.of(testPolicy));

            BookingCancellationPreviewResponse preview = cancellationService.previewCancellationRefund(bookingId);

            assertThat(preview).isNotNull();
            assertThat(preview.getMilestoneStage()).isEqualTo("STAGE_3_NO_REFUND");
            assertThat(preview.getRefundPercentage()).isEqualTo(0.0);
            assertThat(preview.getRefundAmount()).isEqualByComparingTo(BigDecimal.ZERO);
            assertThat(preview.getPenaltyAmount()).isEqualByComparingTo(new BigDecimal("1000000.00"));
            assertThat(preview.isRefundable()).isFalse();
        }

        @Test
        @DisplayName("Đơn đang PENDING_PAYMENT: Không hoàn và không phạt tiền")
        void preview_PendingPayment() {
            testBooking.setStatus(BookingStatus.PENDING_PAYMENT);
            testBooking.setDepositPaid(BigDecimal.ZERO);
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(facilityPolicyRepository.findByFacility_Id(testFacility.getId()))
                    .thenReturn(Optional.of(testPolicy));

            BookingCancellationPreviewResponse preview = cancellationService.previewCancellationRefund(bookingId);

            assertThat(preview.getMilestoneStage()).isEqualTo("STAGE_PENDING_NO_PAYMENT");
            assertThat(preview.getRefundAmount()).isEqualByComparingTo(BigDecimal.ZERO);
            assertThat(preview.getPenaltyAmount()).isEqualByComparingTo(BigDecimal.ZERO);
            assertThat(preview.isRefundable()).isFalse();
        }

        @Test
        @DisplayName("Đơn đã CANCELLED: Ném BOOKING_ALREADY_CANCELLED")
        void preview_AlreadyCancelled_ThrowsException() {
            testBooking.setStatus(BookingStatus.CANCELLED);
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));

            AppException ex = assertThrows(AppException.class, () ->
                    cancellationService.previewCancellationRefund(bookingId));

            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.BOOKING_ALREADY_CANCELLED);
        }

        @Test
        @DisplayName("Đơn đã COMPLETED: Ném BOOKING_ALREADY_COMPLETED")
        void preview_AlreadyCompleted_ThrowsException() {
            testBooking.setStatus(BookingStatus.COMPLETED);
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));

            AppException ex = assertThrows(AppException.class, () ->
                    cancellationService.previewCancellationRefund(bookingId));

            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.BOOKING_ALREADY_COMPLETED);
        }
    }

    @Nested
    @DisplayName("Cancel Booking Execution Tests")
    class CancelExecutionTests {

        @Test
        @DisplayName("Hủy đơn thành công Mốc 1: Tạo Payment REFUNDED, giải phóng kho và revoke PIN")
        void cancelBooking_Stage1_Success() {
            testBooking.setStartDate(LocalDate.now().plusDays(4));
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(facilityPolicyRepository.findByFacility_Id(testFacility.getId()))
                    .thenReturn(Optional.of(testPolicy));
            when(requestContext.currentUserId()).thenReturn(customerId);
            when(requestContext.currentUserRole()).thenReturn("CUSTOMER");

            BookingCancelRequest request = BookingCancelRequest.builder()
                    .cancellationReason("Thay đổi kế hoạch kinh doanh")
                    .build();

            BookingCancelResponse response = cancellationService.cancelBooking(bookingId, request);

            assertThat(response).isNotNull();
            assertThat(response.getStatus()).isEqualTo(BookingStatus.CANCELLED);
            assertThat(response.getMilestoneStage()).isEqualTo("STAGE_1_FULL_REFUND");
            assertThat(response.getRefundAmount()).isEqualByComparingTo(new BigDecimal("1000000.00"));
            assertThat(response.isUnitReleased()).isTrue();
            assertThat(response.getRefundTransactionId()).startsWith("REFUND-");

            // Verify entity updates
            assertThat(testBooking.getStatus()).isEqualTo(BookingStatus.CANCELLED);
            assertThat(testBooking.getAccessPin()).isNull();
            assertThat(testBooking.getQrAccessToken()).isEqualTo("REVOKED_CANCELLED");
            assertThat(testUnit.getStatus()).isEqualTo(UnitStatus.AVAILABLE);

            // Verify Payment creation
            verify(paymentRepository, times(1)).save(argThat(payment ->
                    payment.getAmount().compareTo(new BigDecimal("1000000.00")) == 0
                            && payment.getStatus() == PaymentStatus.REFUNDED
                            && payment.getPaymentType() == PaymentType.DEPOSIT
            ));

            // Verify Activity Log calls
            verify(activityLogService).record(
                    eq(testFacility.getId()),
                    eq(ActivityAction.RESERVATION_CANCEL),
                    eq("Booking"),
                    eq(bookingId),
                    anyString(),
                    eq(BookingStatus.CONFIRMED),
                    eq(BookingStatus.CANCELLED)
            );
            verify(activityLogService).record(
                    eq(testFacility.getId()),
                    eq(ActivityAction.STORAGE_UNIT_RELEASE),
                    eq("StorageUnit"),
                    eq(testUnit.getId()),
                    anyString(),
                    isNull(),
                    eq(UnitStatus.AVAILABLE)
            );
        }

        @Test
        @DisplayName("Hủy đơn Mốc 3 (< 24h): Không hoàn cọc, không tạo Payment REFUNDED")
        void cancelBooking_Stage3_NoRefund_DoesNotCreatePayment() {
            testBooking.setStartDate(LocalDate.now().plusDays(1));
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(facilityPolicyRepository.findByFacility_Id(testFacility.getId()))
                    .thenReturn(Optional.of(testPolicy));
            when(requestContext.currentUserId()).thenReturn(customerId);
            when(requestContext.currentUserRole()).thenReturn("CUSTOMER");

            BookingCancelRequest request = BookingCancelRequest.builder()
                    .cancellationReason("Bận việc gấp")
                    .build();

            BookingCancelResponse response = cancellationService.cancelBooking(bookingId, request);

            assertThat(response.getMilestoneStage()).isEqualTo("STAGE_3_NO_REFUND");
            assertThat(response.getRefundAmount()).isEqualByComparingTo(BigDecimal.ZERO);
            assertThat(response.getPenaltyAmount()).isEqualByComparingTo(new BigDecimal("1000000.00"));
            assertThat(response.getRefundTransactionId()).isNull();

            // Unit vẫn được giải phóng về AVAILABLE
            assertThat(testUnit.getStatus()).isEqualTo(UnitStatus.AVAILABLE);
            // Không tạo Payment refund
            verify(paymentRepository, never()).save(any(Payment.class));
        }

        @Test
        @DisplayName("Customer khác cố hủy booking của người khác: Ném FORBIDDEN")
        void cancelBooking_OtherCustomer_ThrowsForbidden() {
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(requestContext.currentUserId()).thenReturn(UUID.randomUUID()); // Khác customerId
            when(requestContext.currentUserRole()).thenReturn("CUSTOMER");

            BookingCancelRequest request = new BookingCancelRequest();

            AppException ex = assertThrows(AppException.class, () ->
                    cancellationService.cancelBooking(bookingId, request));

            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.FORBIDDEN);
        }
    }

    @Nested
    @DisplayName("Auto-Cancel Cron Tests (15 Phút)")
    class AutoCancelCronTests {

        @Test
        @DisplayName("Trigger auto-cancel quét và hủy thành công các booking PENDING_PAYMENT quá hạn")
        void triggerAutoCancel_Success() {
            Booking expiredBooking1 = Booking.builder()
                    .bookingCode("BK-PENDING-001")
                    .status(BookingStatus.PENDING_PAYMENT)
                    .storageUnit(testUnit)
                    .customer(testCustomer)
                    .startDate(LocalDate.now().plusDays(2))
                    .build();
            expiredBooking1.setId(UUID.randomUUID());
            expiredBooking1.setCreatedAt(LocalDateTime.now().minusMinutes(20));

            StorageUnit unit2 = StorageUnit.builder()
                    .unitCode("U-102")
                    .facility(testFacility)
                    .status(UnitStatus.RESERVED)
                    .build();
            unit2.setId(UUID.randomUUID());

            Booking expiredBooking2 = Booking.builder()
                    .bookingCode("BK-PENDING-002")
                    .status(BookingStatus.PENDING_PAYMENT)
                    .storageUnit(unit2)
                    .customer(testCustomer)
                    .startDate(LocalDate.now().minusDays(1)) // Đã qua ngày bắt đầu
                    .build();
            expiredBooking2.setId(UUID.randomUUID());
            expiredBooking2.setCreatedAt(LocalDateTime.now().minusHours(2));

            when(bookingRepository.findExpiredPendingBookings(
                    eq(BookingStatus.PENDING_PAYMENT), any(LocalDateTime.class), any(LocalDate.class)))
                    .thenReturn(List.of(expiredBooking1, expiredBooking2));

            AutoCancelResult result = cancellationService.triggerAutoCancel(15);

            assertThat(result).isNotNull();
            assertThat(result.getScannedCount()).isEqualTo(2);
            assertThat(result.getCancelledCount()).isEqualTo(2);
            assertThat(result.getUnitsReleasedCount()).isEqualTo(2);

            // Kiểm tra trạng thái cả 2 booking và units
            assertThat(expiredBooking1.getStatus()).isEqualTo(BookingStatus.CANCELLED);
            assertThat(testUnit.getStatus()).isEqualTo(UnitStatus.AVAILABLE);

            assertThat(expiredBooking2.getStatus()).isEqualTo(BookingStatus.CANCELLED);
            assertThat(unit2.getStatus()).isEqualTo(UnitStatus.AVAILABLE);

            // Verify activity logs hệ thống
            verify(activityLogService, times(2)).recordSystem(
                    eq(testFacility.getId()),
                    eq(ActivityAction.RESERVATION_EXPIRE),
                    eq("Booking"),
                    any(UUID.class),
                    anyString()
            );
        }

        @Test
        @DisplayName("Không có booking nào hết hạn: Kết quả cancelledCount = 0")
        void triggerAutoCancel_NoExpiredBookings() {
            when(bookingRepository.findExpiredPendingBookings(
                    eq(BookingStatus.PENDING_PAYMENT), any(LocalDateTime.class), any(LocalDate.class)))
                    .thenReturn(List.of());

            AutoCancelResult result = cancellationService.triggerAutoCancel(15);

            assertThat(result.getScannedCount()).isEqualTo(0);
            assertThat(result.getCancelledCount()).isEqualTo(0);
            assertThat(result.getUnitsReleasedCount()).isEqualTo(0);
            verify(bookingRepository, never()).save(any(Booking.class));
        }
    }
}


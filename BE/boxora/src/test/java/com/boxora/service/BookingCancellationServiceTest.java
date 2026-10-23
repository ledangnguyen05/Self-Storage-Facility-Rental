package com.boxora.service;

import com.boxora.dto.request.BookingCancelRequest;
import com.boxora.dto.response.AutoCancelResult;
import com.boxora.dto.response.BookingCancelResponse;
import com.boxora.dto.response.BookingCancellationPreviewResponse;
import com.boxora.entity.*;
import com.boxora.enums.ActivityAction;
import com.boxora.enums.BookingStatus;
import com.boxora.enums.PaymentStatus;
import com.boxora.enums.RefundStatus;
import com.boxora.enums.UnitStatus;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.repository.*;
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
    private RentalContractRepository rentalContractRepository;

    @Mock
    private RefundRequestRepository refundRequestRepository;

    @Mock
    private HandoverRecordRepository handoverRecordRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private ActivityLogService activityLogService;

    @Mock
    private RequestContext requestContext;

    @Mock
    private StorageUnitLockService storageUnitLockService;

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
            testBooking.setStartDate(LocalDate.now().plusDays(4));
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(testFacility.getId()))
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
            testBooking.setStartDate(LocalDate.now().plusDays(2));
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(testFacility.getId()))
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
            // Lịch hẹn nhận kho trong vòng 10 giờ tới (< 24h)
            testBooking.setExpectedCheckInAt(LocalDateTime.now().plusHours(10));
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(testFacility.getId()))
                    .thenReturn(Optional.of(testPolicy));

            BookingCancellationPreviewResponse preview = cancellationService.previewCancellationRefund(bookingId);

            assertThat(preview).isNotNull();
            assertThat(preview.getMilestoneStage()).isEqualTo("STAGE_3_NO_REFUND");
            assertThat(preview.getRefundPercentage()).isEqualTo(0.0);
            assertThat(preview.getRefundAmount()).isEqualByComparingTo(BigDecimal.ZERO);
            assertThat(preview.getPenaltyAmount()).isEqualByComparingTo(new BigDecimal("1000000.00"));
            assertThat(preview.isRefundable()).isFalse();
            assertThat(preview.getTimeRemainingLabel()).isEqualTo("Lịch hẹn còn dưới 24 giờ");
        }

        @Test
        @DisplayName("Đơn vừa tạo, thanh toán cọc và có lịch hẹn sau 3 ngày: Hoàn 100% tiền cọc (Mốc 1), không bị rơi vào Mốc 3")
        void preview_NewlyCreatedBooking_WithFutureAppointment_FullRefund() {
            // Đơn có startDate là hôm nay nhưng lịch hẹn nhận kho là 3 ngày sau lúc 14:00 (khoảng 72h)
            testBooking.setStartDate(LocalDate.now());
            testBooking.setExpectedCheckInAt(LocalDateTime.now().plusDays(3));
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(testFacility.getId()))
                    .thenReturn(Optional.of(testPolicy));

            BookingCancellationPreviewResponse preview = cancellationService.previewCancellationRefund(bookingId);

            assertThat(preview).isNotNull();
            assertThat(preview.getMilestoneStage()).isEqualTo("STAGE_1_FULL_REFUND");
            assertThat(preview.getRefundPercentage()).isEqualTo(100.0);
            assertThat(preview.getRefundAmount()).isEqualByComparingTo(new BigDecimal("1000000.00"));
            assertThat(preview.getPenaltyAmount()).isEqualByComparingTo(BigDecimal.ZERO);
            assertThat(preview.isRefundable()).isTrue();
            assertThat(preview.getTimeRemainingLabel()).contains("đến lịch hẹn nhận kho");
        }

        @Test
        @DisplayName("Mốc 1: Còn 49 giờ (> 48h) -> Hoàn 100%")
        void preview_49Hours_Stage1_FullRefund() {
            testBooking.setExpectedCheckInAt(LocalDateTime.now().plusHours(49).plusMinutes(1));
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(testFacility.getId()))
                    .thenReturn(Optional.of(testPolicy));

            BookingCancellationPreviewResponse preview = cancellationService.previewCancellationRefund(bookingId);

            assertThat(preview.getMilestoneStage()).isEqualTo("STAGE_1_FULL_REFUND");
            assertThat(preview.getRefundPercentage()).isEqualTo(100.0);
            assertThat(preview.getRefundAmount()).isEqualByComparingTo(new BigDecimal("1000000.00"));
        }

        @Test
        @DisplayName("Ranh giới chính xác 48 giờ: Thuộc nhóm Mốc 1 hoàn 100%")
        void preview_Exact48Hours_Stage1_FullRefund() {
            testBooking.setExpectedCheckInAt(LocalDateTime.now().plusHours(48).plusMinutes(1));
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(testFacility.getId()))
                    .thenReturn(Optional.of(testPolicy));

            BookingCancellationPreviewResponse preview = cancellationService.previewCancellationRefund(bookingId);

            assertThat(preview.getMilestoneStage()).isEqualTo("STAGE_1_FULL_REFUND");
            assertThat(preview.getRefundPercentage()).isEqualTo(100.0);
            assertThat(preview.getRefundAmount()).isEqualByComparingTo(new BigDecimal("1000000.00"));
        }

        @Test
        @DisplayName("Mốc 2: Còn 47 giờ (< 48h và >= 24h) -> Hoàn 50%")
        void preview_47Hours_Stage2_PartialRefund() {
            testBooking.setExpectedCheckInAt(LocalDateTime.now().plusHours(47).plusMinutes(1));
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(testFacility.getId()))
                    .thenReturn(Optional.of(testPolicy));

            BookingCancellationPreviewResponse preview = cancellationService.previewCancellationRefund(bookingId);

            assertThat(preview.getMilestoneStage()).isEqualTo("STAGE_2_PARTIAL_REFUND");
            assertThat(preview.getRefundPercentage()).isEqualTo(50.0);
            assertThat(preview.getRefundAmount()).isEqualByComparingTo(new BigDecimal("500000.00"));
        }

        @Test
        @DisplayName("Mốc 2: Còn 25 giờ (> 24h và < 48h) -> Hoàn 50%")
        void preview_25Hours_Stage2_PartialRefund() {
            testBooking.setExpectedCheckInAt(LocalDateTime.now().plusHours(25).plusMinutes(1));
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(testFacility.getId()))
                    .thenReturn(Optional.of(testPolicy));

            BookingCancellationPreviewResponse preview = cancellationService.previewCancellationRefund(bookingId);

            assertThat(preview.getMilestoneStage()).isEqualTo("STAGE_2_PARTIAL_REFUND");
            assertThat(preview.getRefundPercentage()).isEqualTo(50.0);
            assertThat(preview.getRefundAmount()).isEqualByComparingTo(new BigDecimal("500000.00"));
        }

        @Test
        @DisplayName("Ranh giới chính xác 24 giờ: Thuộc nhóm Mốc 2 hoàn 50%")
        void preview_Exact24Hours_Stage2_PartialRefund() {
            testBooking.setExpectedCheckInAt(LocalDateTime.now().plusHours(24).plusMinutes(1));
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(testFacility.getId()))
                    .thenReturn(Optional.of(testPolicy));

            BookingCancellationPreviewResponse preview = cancellationService.previewCancellationRefund(bookingId);

            assertThat(preview.getMilestoneStage()).isEqualTo("STAGE_2_PARTIAL_REFUND");
            assertThat(preview.getRefundPercentage()).isEqualTo(50.0);
            assertThat(preview.getRefundAmount()).isEqualByComparingTo(new BigDecimal("500000.00"));
        }

        @Test
        @DisplayName("Mốc 3: Còn 23 giờ (< 24h) -> Hoàn 0%, khấu trừ 100%")
        void preview_23Hours_Stage3_NoRefund() {
            testBooking.setExpectedCheckInAt(LocalDateTime.now().plusHours(23).plusMinutes(30));
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(testFacility.getId()))
                    .thenReturn(Optional.of(testPolicy));

            BookingCancellationPreviewResponse preview = cancellationService.previewCancellationRefund(bookingId);

            assertThat(preview.getMilestoneStage()).isEqualTo("STAGE_3_NO_REFUND");
            assertThat(preview.getRefundPercentage()).isEqualTo(0.0);
            assertThat(preview.getRefundAmount()).isEqualByComparingTo(BigDecimal.ZERO);
            assertThat(preview.getPenaltyAmount()).isEqualByComparingTo(new BigDecimal("1000000.00"));
        }

        @Test
        @DisplayName("Đã qua lịch hẹn nhận kho (quá khứ) -> Mốc 3, hoàn 0%")
        void preview_PastAppointment_Stage3_NoRefund() {
            testBooking.setExpectedCheckInAt(LocalDateTime.now().minusHours(2));
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(testFacility.getId()))
                    .thenReturn(Optional.of(testPolicy));

            BookingCancellationPreviewResponse preview = cancellationService.previewCancellationRefund(bookingId);

            assertThat(preview.getMilestoneStage()).isEqualTo("STAGE_3_NO_REFUND");
            assertThat(preview.getRefundPercentage()).isEqualTo(0.0);
            assertThat(preview.getRefundAmount()).isEqualByComparingTo(BigDecimal.ZERO);
            assertThat(preview.getTimeRemainingLabel()).isEqualTo("Đã qua lịch hẹn nhận kho");
        }

        @Test
        @DisplayName("Kiểm tra làm tròn và số tiền lẻ: Cọc 450.000 ₫ hoàn 50% = 225.000 ₫")
        void preview_OddDepositAmount_RoundingCorrectness() {
            testBooking.setDepositPaid(new BigDecimal("450000.00"));
            testBooking.setExpectedCheckInAt(LocalDateTime.now().plusHours(30));
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(testFacility.getId()))
                    .thenReturn(Optional.of(testPolicy));

            BookingCancellationPreviewResponse preview = cancellationService.previewCancellationRefund(bookingId);

            assertThat(preview.getMilestoneStage()).isEqualTo("STAGE_2_PARTIAL_REFUND");
            assertThat(preview.getRefundAmount()).isEqualByComparingTo(new BigDecimal("225000.00"));
            assertThat(preview.getPenaltyAmount()).isEqualByComparingTo(new BigDecimal("225000.00"));
            assertThat(preview.getRefundAmount().add(preview.getPenaltyAmount()))
                    .isEqualByComparingTo(new BigDecimal("450000.00"));
        }

        @Test
        @DisplayName("Đơn đang PENDING_PAYMENT: Không hoàn và không phạt tiền")
        void preview_PendingPayment() {
            testBooking.setStatus(BookingStatus.PENDING_PAYMENT);
            testBooking.setDepositPaid(BigDecimal.ZERO);
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(testFacility.getId()))
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

        @Test
        @DisplayName("Đơn đang ACTIVE hoặc đã CHECK_IN: Ném BOOKING_CANNOT_BE_CANCELLED")
        void preview_ActiveOrCheckedIn_ThrowsException() {
            testBooking.setStatus(BookingStatus.ACTIVE);
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));

            AppException ex = assertThrows(AppException.class, () ->
                    cancellationService.previewCancellationRefund(bookingId));

            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.BOOKING_CANNOT_BE_CANCELLED);
        }
    }

    @Nested
    @DisplayName("Cancel Booking Execution Tests")
    class CancelExecutionTests {

        @Test
        @DisplayName("Hủy đơn thành công Mốc 1: Khởi tạo RefundRequest PENDING_REVIEW, giải phóng kho và revoke PIN")
        void cancelBooking_Stage1_Success() {
            testBooking.setStartDate(LocalDate.now().plusDays(4));
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(testFacility.getId()))
                    .thenReturn(Optional.of(testPolicy));
            when(requestContext.currentUserId()).thenReturn(customerId);
            when(requestContext.currentUserRole()).thenReturn("CUSTOMER");
            when(userRepository.findById(customerId)).thenReturn(Optional.of(testCustomer));

            UUID generatedRefundId = UUID.randomUUID();
            when(refundRequestRepository.save(any(RefundRequest.class))).thenAnswer(invocation -> {
                RefundRequest r = invocation.getArgument(0);
                r.setId(generatedRefundId);
                return r;
            });

            BookingCancelRequest request = BookingCancelRequest.builder()
                    .cancellationReason("Thay đổi kế hoạch kinh doanh")
                    .bankName("Vietcombank")
                    .bankAccountNumber("0123456789")
                    .bankAccountName("NGUYEN VAN KHACH")
                    .build();

            BookingCancelResponse response = cancellationService.cancelBooking(bookingId, request);

            assertThat(response).isNotNull();
            assertThat(response.getStatus()).isEqualTo(BookingStatus.CANCELLED);
            assertThat(response.getMilestoneStage()).isEqualTo("STAGE_1_FULL_REFUND");
            assertThat(response.getRefundAmount()).isEqualByComparingTo(new BigDecimal("1000000.00"));
            assertThat(response.isUnitReleased()).isTrue();
            assertThat(response.getRefundRequestId()).isEqualTo(generatedRefundId);
            assertThat(response.getRefundRequestCode()).startsWith("REF-");
            assertThat(response.getCancellationReason()).isEqualTo("Thay đổi kế hoạch kinh doanh");

            // Verify entity updates
            assertThat(testBooking.getStatus()).isEqualTo(BookingStatus.CANCELLED);
            assertThat(testBooking.getCancellationReason()).isEqualTo("Thay đổi kế hoạch kinh doanh");
            assertThat(testBooking.getCancelledBy()).isEqualTo(testCustomer);
            assertThat(testBooking.getCancelledAt()).isNotNull();
            assertThat(testBooking.getAccessPin()).isNull();
            assertThat(testBooking.getQrAccessToken()).isEqualTo("REVOKED_CANCELLED");
            assertThat(testUnit.getStatus()).isEqualTo(UnitStatus.AVAILABLE);

            // Verify RefundRequest created in PENDING_REVIEW state (never a fake payment)
            verify(refundRequestRepository, times(1)).save(argThat(r ->
                    r.getFinalRefundAmount().compareTo(new BigDecimal("1000000.00")) == 0
                            && r.getStatus() == RefundStatus.PENDING_REVIEW
                            && r.getBankName().equals("Vietcombank")
                            && r.getBankAccountNumber().equals("0123456789")
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
        @DisplayName("Hủy đơn Mốc 3 (< 24h): Không hoàn cọc, không tạo RefundRequest")
        void cancelBooking_Stage3_NoRefund_DoesNotCreateRefundRequest() {
            testBooking.setStartDate(LocalDate.now().plusDays(1));
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(testFacility.getId()))
                    .thenReturn(Optional.of(testPolicy));
            when(requestContext.currentUserId()).thenReturn(customerId);
            when(requestContext.currentUserRole()).thenReturn("CUSTOMER");
            when(userRepository.findById(customerId)).thenReturn(Optional.of(testCustomer));

            BookingCancelRequest request = BookingCancelRequest.builder()
                    .cancellationReason("Bận việc gấp")
                    .build();

            BookingCancelResponse response = cancellationService.cancelBooking(bookingId, request);

            assertThat(response.getMilestoneStage()).isEqualTo("STAGE_3_NO_REFUND");
            assertThat(response.getRefundAmount()).isEqualByComparingTo(BigDecimal.ZERO);
            assertThat(response.getPenaltyAmount()).isEqualByComparingTo(new BigDecimal("1000000.00"));
            assertThat(response.getRefundRequestId()).isNull();

            // Unit vẫn được giải phóng về AVAILABLE
            assertThat(testUnit.getStatus()).isEqualTo(UnitStatus.AVAILABLE);
            // Không tạo RefundRequest
            verify(refundRequestRepository, never()).save(any(RefundRequest.class));
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
            testUnit.setStatus(UnitStatus.RESERVED);
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
                    .startDate(LocalDate.now().minusDays(1))
                    .build();
            expiredBooking2.setId(UUID.randomUUID());
            expiredBooking2.setCreatedAt(LocalDateTime.now().minusHours(2));

            when(bookingRepository.findExpiredPendingBookings(
                    eq(BookingStatus.PENDING_PAYMENT), any(LocalDateTime.class), any(LocalDate.class)))
                    .thenReturn(List.of(expiredBooking1, expiredBooking2));
            when(bookingRepository.findByIdForUpdate(expiredBooking1.getId())).thenReturn(Optional.of(expiredBooking1));
            when(bookingRepository.findByIdForUpdate(expiredBooking2.getId())).thenReturn(Optional.of(expiredBooking2));
            when(storageUnitRepository.findWithDetailsByIdForUpdate(testUnit.getId())).thenReturn(Optional.of(testUnit));
            when(storageUnitRepository.findWithDetailsByIdForUpdate(unit2.getId())).thenReturn(Optional.of(unit2));

            AutoCancelResult result = cancellationService.triggerAutoCancel(15);

            assertThat(result).isNotNull();
            assertThat(result.getScannedCount()).isEqualTo(2);
            assertThat(result.getCancelledCount()).isEqualTo(2);
            assertThat(result.getUnitsReleasedCount()).isEqualTo(2);

            assertThat(expiredBooking1.getStatus()).isEqualTo(BookingStatus.CANCELLED);
            assertThat(testUnit.getStatus()).isEqualTo(UnitStatus.AVAILABLE);

            assertThat(expiredBooking2.getStatus()).isEqualTo(BookingStatus.CANCELLED);
            assertThat(unit2.getStatus()).isEqualTo(UnitStatus.AVAILABLE);

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

        @Test
        @DisplayName("triggerAutoCancel: Idempotent - Booking đã bị CANCELLED được bỏ qua an toàn")
        void triggerAutoCancel_Idempotent_AlreadyCancelledBooking_SkippedSafely() {
            testBooking.setStatus(BookingStatus.CANCELLED);
            when(bookingRepository.findExpiredPendingBookings(
                    eq(BookingStatus.PENDING_PAYMENT), any(LocalDateTime.class), any(LocalDate.class)))
                    .thenReturn(List.of(testBooking));
            when(bookingRepository.findByIdForUpdate(testBooking.getId())).thenReturn(Optional.of(testBooking));

            AutoCancelResult result = cancellationService.triggerAutoCancel(15);

            assertThat(result.getCancelledCount()).isEqualTo(0);
            assertThat(result.getUnitsReleasedCount()).isEqualTo(0);
            verify(storageUnitRepository, never()).save(any(StorageUnit.class));
        }

        @Test
        @DisplayName("triggerAutoCancel: Race condition với Payment - Đơn đã PAID được chuyển CONFIRMED thay vì hủy")
        void triggerAutoCancel_RaceWithPayment_PaidBookingReconcilesToConfirmed() {
            testBooking.setStatus(BookingStatus.PENDING_PAYMENT);
            when(bookingRepository.findExpiredPendingBookings(
                    eq(BookingStatus.PENDING_PAYMENT), any(LocalDateTime.class), any(LocalDate.class)))
                    .thenReturn(List.of(testBooking));
            when(bookingRepository.findByIdForUpdate(testBooking.getId())).thenReturn(Optional.of(testBooking));
            when(paymentRepository.existsByBooking_IdAndStatus(testBooking.getId(), PaymentStatus.PAID)).thenReturn(true);

            AutoCancelResult result = cancellationService.triggerAutoCancel(15);

            assertThat(result.getCancelledCount()).isEqualTo(0);
            assertThat(testBooking.getStatus()).isEqualTo(BookingStatus.CONFIRMED);
            assertThat(testBooking.getPaymentExpiresAt()).isNull();
            verify(bookingRepository).save(testBooking);
            verify(storageUnitLockService).releaseLock(testUnit.getId());
        }
    }
}

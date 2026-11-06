package com.boxora.service;

import com.boxora.dto.response.FacilityRevenueResponse;
import com.boxora.dto.response.RevenueReportResponse;
import com.boxora.dto.response.SystemRevenueSummaryResponse;
import com.boxora.entity.*;
import com.boxora.enums.*;
import com.boxora.repository.*;
import com.boxora.security.FacilityAccessGuard;
import com.boxora.service.impl.ReportServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BusinessManagerFinancialReportRestructureTest {

    @Mock private PaymentRepository paymentRepository;
    @Mock private StorageUnitRepository storageUnitRepository;
    @Mock private FacilityRepository facilityRepository;
    @Mock private RentalContractRepository rentalContractRepository;
    @Mock private FacilityPolicyRepository facilityPolicyRepository;
    @Mock private BookingRepository bookingRepository;
    @Mock private EmailService emailService;
    @Mock private ActivityLogService activityLogService;
    @Mock private FacilityAccessGuard facilityAccessGuard;
    @Mock private RefundRequestRepository refundRequestRepository;
    @Mock private HandoverRecordRepository handoverRecordRepository;
    @Mock private OverdueDebtCalculationService overdueDebtCalculationService;

    @InjectMocks
    private ReportServiceImpl reportService;

    private Facility facilityA;
    private Facility facilityB;

    @BeforeEach
    void setUp() {
        facilityA = Facility.builder().name("Boxora Quan 2").build();
        facilityA.setId(UUID.fromString("11111111-1111-1111-1111-111111111111"));

        facilityB = Facility.builder().name("Boxora Thu Duc").build();
        facilityB.setId(UUID.fromString("22222222-2222-2222-2222-222222222222"));

        lenient().when(facilityAccessGuard.isFacilityScoped()).thenReturn(false);
    }

    @Test
    @DisplayName("TC01: Khách thanh toán online HĐ mới (thuê 2M + cọc 2M) -> CashIn=4M, NetRevenue=2M, HeldDeposit=2M")
    void tc01_onlinePaymentContract_cashInAndNetRevAndDeposit() {
        LocalDate from = LocalDate.of(2026, 3, 1);
        LocalDate to = LocalDate.of(2026, 3, 31);
        LocalDateTime fromDt = from.atStartOfDay();
        LocalDateTime toDt = to.atTime(LocalTime.MAX);

        when(paymentRepository.sumSystemRevenue(fromDt, toDt, null)).thenReturn(
                new SystemRevenueSummaryResponse(
                        new BigDecimal("4000000"), // totalRevenue
                        new BigDecimal("2000000"), // depositRevenue
                        new BigDecimal("2000000"), // rentalFeeRevenue
                        BigDecimal.ZERO,           // renewalFeeRevenue
                        BigDecimal.ZERO,           // extraChargeRevenue
                        BigDecimal.ZERO,           // bookingPaymentRevenue
                        BigDecimal.ZERO,           // returnCompensationRevenue
                        new BigDecimal("4000000"), // totalCashIn
                        2L                         // paymentCount
                )
        );
        when(facilityRepository.findAll()).thenReturn(List.of(facilityA));
        when(paymentRepository.sumRevenueByFacility(fromDt, toDt, null)).thenReturn(List.of(
                new FacilityRevenueResponse(
                        facilityA.getId(),
                        facilityA.getName(),
                        new BigDecimal("4000000"),
                        new BigDecimal("2000000"),
                        new BigDecimal("2000000"),
                        BigDecimal.ZERO,
                        BigDecimal.ZERO,
                        BigDecimal.ZERO,
                        BigDecimal.ZERO,
                        new BigDecimal("4000000"),
                        2L
                )
        ));
        when(paymentRepository.sumRevenueByMonth(fromDt, toDt, null)).thenReturn(Collections.emptyList());
        when(paymentRepository.countPaidPaymentsByMethod(fromDt, toDt, null)).thenReturn(Collections.emptyList());
        when(rentalContractRepository.findAll()).thenReturn(Collections.emptyList());
        when(refundRequestRepository.findAll()).thenReturn(Collections.emptyList());
        when(handoverRecordRepository.findAll()).thenReturn(Collections.emptyList());

        RevenueReportResponse report = reportService.getRevenueReport(from, to, null);

        assertThat(report.getSystemSummary().getTotalCashIn()).isEqualByComparingTo("4000000");
        assertThat(report.getSystemSummary().getNetRevenue()).isEqualByComparingTo("2000000");
        assertThat(report.getSystemSummary().getRentalRevenue()).isEqualByComparingTo("2000000");
        assertThat(report.getSystemSummary().getDepositsHeld()).isEqualByComparingTo("2000000");
    }

    @Test
    @DisplayName("TC02: Check-in tại quầy sau khi đã thanh toán online -> Không tăng gấp đôi tiền (idempotency)")
    void tc02_checkInAtCounterAfterOnlinePayment_noDoubleCounting() {
        LocalDate from = LocalDate.of(2026, 3, 1);
        LocalDate to = LocalDate.of(2026, 3, 31);
        LocalDateTime fromDt = from.atStartOfDay();
        LocalDateTime toDt = to.atTime(LocalTime.MAX);

        when(paymentRepository.sumSystemRevenue(fromDt, toDt, null)).thenReturn(
                new SystemRevenueSummaryResponse(
                        new BigDecimal("4000000"),
                        new BigDecimal("2000000"),
                        new BigDecimal("2000000"),
                        BigDecimal.ZERO,
                        BigDecimal.ZERO,
                        BigDecimal.ZERO,
                        BigDecimal.ZERO,
                        new BigDecimal("4000000"),
                        2L
                )
        );
        when(facilityRepository.findAll()).thenReturn(List.of(facilityA));
        when(paymentRepository.sumRevenueByFacility(fromDt, toDt, null)).thenReturn(List.of());
        when(paymentRepository.sumRevenueByMonth(fromDt, toDt, null)).thenReturn(Collections.emptyList());
        when(paymentRepository.countPaidPaymentsByMethod(fromDt, toDt, null)).thenReturn(Collections.emptyList());
        when(rentalContractRepository.findAll()).thenReturn(Collections.emptyList());
        when(refundRequestRepository.findAll()).thenReturn(Collections.emptyList());
        when(handoverRecordRepository.findAll()).thenReturn(Collections.emptyList());

        RevenueReportResponse report = reportService.getRevenueReport(from, to, null);

        assertThat(report.getSystemSummary().getTotalCashIn()).isEqualByComparingTo("4000000");
        assertThat(report.getSystemSummary().getNetRevenue()).isEqualByComparingTo("2000000");
    }

    @Test
    @DisplayName("TC03: Hủy đơn online đã thanh toán, BM chưa duyệt hoàn tiền -> Pending refund ghi nhận vào Group B, NetRev chưa bị trừ")
    void tc03_cancelledBookingPendingRefund_inGroupB_netRevNotDeductedYet() {
        LocalDate from = LocalDate.of(2026, 3, 1);
        LocalDate to = LocalDate.of(2026, 3, 31);
        LocalDateTime fromDt = from.atStartOfDay();
        LocalDateTime toDt = to.atTime(LocalTime.MAX);

        when(paymentRepository.sumSystemRevenue(fromDt, toDt, null)).thenReturn(
                new SystemRevenueSummaryResponse(
                        new BigDecimal("4000000"),
                        new BigDecimal("2000000"),
                        new BigDecimal("2000000"),
                        BigDecimal.ZERO,
                        BigDecimal.ZERO,
                        BigDecimal.ZERO,
                        BigDecimal.ZERO,
                        new BigDecimal("4000000"),
                        2L
                )
        );
        when(facilityRepository.findAll()).thenReturn(List.of(facilityA));
        when(paymentRepository.sumRevenueByFacility(fromDt, toDt, null)).thenReturn(List.of());
        when(paymentRepository.sumRevenueByMonth(fromDt, toDt, null)).thenReturn(Collections.emptyList());
        when(paymentRepository.countPaidPaymentsByMethod(fromDt, toDt, null)).thenReturn(Collections.emptyList());
        when(rentalContractRepository.findAll()).thenReturn(Collections.emptyList());
        when(handoverRecordRepository.findAll()).thenReturn(Collections.emptyList());

        RefundRequest pendingRefund = RefundRequest.builder()
                .requestedAmount(new BigDecimal("4000000"))
                .finalRefundAmount(new BigDecimal("4000000"))
                .status(RefundStatus.PENDING_REVIEW)
                .facility(facilityA)
                .build();
        pendingRefund.setCreatedAt(LocalDateTime.of(2026, 3, 15, 10, 0));
        when(refundRequestRepository.findAll()).thenReturn(List.of(pendingRefund));

        RevenueReportResponse report = reportService.getRevenueReport(from, to, null);

        // Net revenue still recognized because refund is NOT completed yet
        assertThat(report.getSystemSummary().getNetRevenue()).isEqualByComparingTo("2000000");
        // Pending refund is tracked in Group B / pendingRefundAmount
        assertThat(report.getSystemSummary().getPendingRefundAmount()).isEqualByComparingTo("4000000");
        assertThat(report.getRefundBreakdown().getPendingReviewAmount()).isEqualByComparingTo("4000000");
        // Deposit still held until transfer confirmed
        assertThat(report.getSystemSummary().getDepositsHeld()).isEqualByComparingTo("2000000");
    }

    @Test
    @DisplayName("TC04: Hủy đơn online, BM xác nhận hoàn tiền 100% tiền thuê -> Net Revenue trừ tiền thuê, Total CashIn không đổi")
    void tc04_cancelledBookingCompletedRentalRefund_netRevDeducted_cashInConstant() {
        LocalDate from = LocalDate.of(2026, 3, 1);
        LocalDate to = LocalDate.of(2026, 3, 31);
        LocalDateTime fromDt = from.atStartOfDay();
        LocalDateTime toDt = to.atTime(LocalTime.MAX);

        when(paymentRepository.sumSystemRevenue(fromDt, toDt, null)).thenReturn(
                new SystemRevenueSummaryResponse(
                        new BigDecimal("4000000"),
                        new BigDecimal("2000000"),
                        new BigDecimal("2000000"),
                        BigDecimal.ZERO,
                        BigDecimal.ZERO,
                        BigDecimal.ZERO,
                        BigDecimal.ZERO,
                        new BigDecimal("4000000"),
                        2L
                )
        );
        when(facilityRepository.findAll()).thenReturn(List.of(facilityA));
        when(paymentRepository.sumRevenueByFacility(fromDt, toDt, null)).thenReturn(List.of());
        when(paymentRepository.sumRevenueByMonth(fromDt, toDt, null)).thenReturn(Collections.emptyList());
        when(paymentRepository.countPaidPaymentsByMethod(fromDt, toDt, null)).thenReturn(Collections.emptyList());
        when(rentalContractRepository.findAll()).thenReturn(Collections.emptyList());
        when(handoverRecordRepository.findAll()).thenReturn(Collections.emptyList());

        Booking booking = Booking.builder().facility(facilityA).build();
        RefundRequest completedRentalRefund = RefundRequest.builder()
                .requestedAmount(new BigDecimal("2000000"))
                .finalRefundAmount(new BigDecimal("2000000"))
                .status(RefundStatus.COMPLETED)
                .booking(booking)
                .reason("Cancel booking 100% rental fee refund")
                .facility(facilityA)
                .build();
        completedRentalRefund.setCreatedAt(LocalDateTime.of(2026, 3, 16, 10, 0));
        when(refundRequestRepository.findAll()).thenReturn(List.of(completedRentalRefund));

        RevenueReportResponse report = reportService.getRevenueReport(from, to, null);

        // Net revenue deducted by 2,000,000 -> 0
        assertThat(report.getSystemSummary().getNetRevenue()).isEqualByComparingTo("0");
        // Total cash-in remains 4,000,000 (cash-in records historical inflows)
        assertThat(report.getSystemSummary().getTotalCashIn()).isEqualByComparingTo("4000000");
        // Group A completed refunds = 2,000,000
        assertThat(report.getSystemSummary().getRefundedAmount()).isEqualByComparingTo("2000000");
    }

    @Test
    @DisplayName("TC05: Trả kho Case A (hoàn 100% cọc) -> Net Revenue giữ nguyên, Held Deposits giảm, Group A tăng")
    void tc05_returnCheckout100PercentDepositRefund_netRevUnchanged_depositHeldDecreased() {
        LocalDate from = LocalDate.of(2026, 3, 1);
        LocalDate to = LocalDate.of(2026, 3, 31);
        LocalDateTime fromDt = from.atStartOfDay();
        LocalDateTime toDt = to.atTime(LocalTime.MAX);

        when(paymentRepository.sumSystemRevenue(fromDt, toDt, null)).thenReturn(
                new SystemRevenueSummaryResponse(
                        new BigDecimal("4000000"),
                        new BigDecimal("2000000"),
                        new BigDecimal("2000000"),
                        BigDecimal.ZERO,
                        BigDecimal.ZERO,
                        BigDecimal.ZERO,
                        BigDecimal.ZERO,
                        new BigDecimal("4000000"),
                        2L
                )
        );
        when(facilityRepository.findAll()).thenReturn(List.of(facilityA));
        when(paymentRepository.sumRevenueByFacility(fromDt, toDt, null)).thenReturn(List.of());
        when(paymentRepository.sumRevenueByMonth(fromDt, toDt, null)).thenReturn(Collections.emptyList());
        when(paymentRepository.countPaidPaymentsByMethod(fromDt, toDt, null)).thenReturn(Collections.emptyList());

        Booking booking = Booking.builder().facility(facilityA).build();
        booking.setId(UUID.randomUUID());
        RentalContract contract = RentalContract.builder().facility(facilityA).booking(booking).depositHeld(new BigDecimal("2000000")).build();
        contract.setId(UUID.randomUUID());
        when(rentalContractRepository.findAll()).thenReturn(List.of(contract));

        RefundRequest returnRefund = RefundRequest.builder()
                .requestedAmount(new BigDecimal("2000000"))
                .finalRefundAmount(new BigDecimal("2000000"))
                .status(RefundStatus.COMPLETED)
                .contract(contract)
                .reason("Checkout 100% deposit return")
                .facility(facilityA)
                .build();
        returnRefund.setCreatedAt(LocalDateTime.of(2026, 3, 20, 14, 0));
        when(refundRequestRepository.findAll()).thenReturn(List.of(returnRefund));
        when(handoverRecordRepository.findAll()).thenReturn(Collections.emptyList());

        RevenueReportResponse report = reportService.getRevenueReport(from, to, null);

        // Net Revenue is NOT affected by returning customer deposit
        assertThat(report.getSystemSummary().getNetRevenue()).isEqualByComparingTo("2000000");
        // Held deposits decreased from 2M to 0
        assertThat(report.getSystemSummary().getDepositsHeld()).isEqualByComparingTo("0");
        // Group A completed refunds = 2,000,000
        assertThat(report.getSystemSummary().getRefundedAmount()).isEqualByComparingTo("2000000");
    }

    @Test
    @DisplayName("TC06: Trả kho Case B (cọc 2M, khấu trừ 500k hư hại, hoàn 1.5M) -> Net Revenue tăng 500k, Held Deposits giảm 2M")
    void tc06_returnCheckoutWithDamageDeduction_netRevenueIncreases_heldDepositZero() {
        LocalDate from = LocalDate.of(2026, 3, 1);
        LocalDate to = LocalDate.of(2026, 3, 31);
        LocalDateTime fromDt = from.atStartOfDay();
        LocalDateTime toDt = to.atTime(LocalTime.MAX);

        when(paymentRepository.sumSystemRevenue(fromDt, toDt, null)).thenReturn(
                new SystemRevenueSummaryResponse(
                        new BigDecimal("4500000"), // totalRevenue
                        new BigDecimal("2000000"), // depositRevenue
                        new BigDecimal("2000000"), // rentalFeeRevenue
                        BigDecimal.ZERO,           // renewalFeeRevenue
                        BigDecimal.ZERO,           // extraChargeRevenue
                        BigDecimal.ZERO,           // bookingPaymentRevenue
                        new BigDecimal("500000"),  // returnCompensationRevenue
                        new BigDecimal("4500000"), // totalCashIn
                        3L
                )
        );
        when(facilityRepository.findAll()).thenReturn(List.of(facilityA));
        when(paymentRepository.sumRevenueByFacility(fromDt, toDt, null)).thenReturn(List.of());
        when(paymentRepository.sumRevenueByMonth(fromDt, toDt, null)).thenReturn(Collections.emptyList());
        when(paymentRepository.countPaidPaymentsByMethod(fromDt, toDt, null)).thenReturn(Collections.emptyList());

        Booking booking = Booking.builder().facility(facilityA).build();
        booking.setId(UUID.randomUUID());
        RentalContract contract = RentalContract.builder().facility(facilityA).booking(booking).depositHeld(new BigDecimal("2000000")).build();
        contract.setId(UUID.randomUUID());
        when(rentalContractRepository.findAll()).thenReturn(List.of(contract));

        RefundRequest returnRefund = RefundRequest.builder()
                .requestedAmount(new BigDecimal("1500000"))
                .finalRefundAmount(new BigDecimal("1500000"))
                .status(RefundStatus.COMPLETED)
                .contract(contract)
                .reason("Checkout deposit return after 500k repair deduction")
                .facility(facilityA)
                .build();
        returnRefund.setCreatedAt(LocalDateTime.of(2026, 3, 20, 14, 0));
        when(refundRequestRepository.findAll()).thenReturn(List.of(returnRefund));

        HandoverRecord handover = HandoverRecord.builder()
                .booking(booking)
                .deductionAmount(new BigDecimal("500000"))
                .refundAmount(new BigDecimal("1500000"))
                .build();
        when(handoverRecordRepository.findAll()).thenReturn(List.of(handover));
        lenient().when(handoverRecordRepository.findTopByBooking_IdAndRecordTypeOrderByRecordedAtDesc(any(), any()))
                .thenReturn(Optional.of(handover));

        RevenueReportResponse report = reportService.getRevenueReport(from, to, null);

        // Net revenue = 2,000,000 rent + 500,000 return compensation = 2,500,000
        assertThat(report.getSystemSummary().getNetRevenue()).isEqualByComparingTo("2500000");
        // Held deposits: 2,000,000 received - 1,500,000 refunded - 500,000 deducted = 0
        assertThat(report.getSystemSummary().getDepositsHeld()).isEqualByComparingTo("0");
        // Completed refund = 1,500,000
        assertThat(report.getSystemSummary().getRefundedAmount()).isEqualByComparingTo("1500000");
    }

    @Test
    @DisplayName("TC07: Trả kho Case C (khách nợ thêm chi phí hư hại) -> Ghi nhận vào Công nợ phải thu (KPI 4)")
    void tc07_returnCheckoutWithCustomerAdditionalDue_unpaidInOverdueDebt() {
        LocalDate from = LocalDate.of(2026, 3, 1);
        LocalDate to = LocalDate.of(2026, 3, 31);
        LocalDateTime fromDt = from.atStartOfDay();
        LocalDateTime toDt = to.atTime(LocalTime.MAX);

        when(paymentRepository.sumSystemRevenue(fromDt, toDt, null)).thenReturn(
                new SystemRevenueSummaryResponse(
                        new BigDecimal("2000000"),
                        BigDecimal.ZERO,
                        new BigDecimal("2000000"),
                        BigDecimal.ZERO,
                        BigDecimal.ZERO,
                        BigDecimal.ZERO,
                        BigDecimal.ZERO,
                        new BigDecimal("2000000"),
                        1L
                )
        );
        when(facilityRepository.findAll()).thenReturn(List.of(facilityA));
        when(paymentRepository.sumRevenueByFacility(fromDt, toDt, null)).thenReturn(List.of());
        when(paymentRepository.sumRevenueByMonth(fromDt, toDt, null)).thenReturn(Collections.emptyList());
        when(paymentRepository.countPaidPaymentsByMethod(fromDt, toDt, null)).thenReturn(Collections.emptyList());
        when(rentalContractRepository.findAll()).thenReturn(Collections.emptyList());
        when(refundRequestRepository.findAll()).thenReturn(Collections.emptyList());

        Booking booking = Booking.builder().facility(facilityA).build();
        HandoverRecord handover = HandoverRecord.builder()
                .booking(booking)
                .additionalAmountDue(new BigDecimal("800000"))
                .additionalPaymentStatus("UNPAID")
                .build();
        when(handoverRecordRepository.findAll()).thenReturn(List.of(handover));

        RevenueReportResponse report = reportService.getRevenueReport(from, to, null);

        // Overdue debt KPI 4 must include the 800,000 unpaid additional amount
        assertThat(report.getSystemSummary().getTotalOverdueDebt()).isEqualByComparingTo("800000");
    }

    @Test
    @DisplayName("TC08: Xử lý công nợ quá hạn bằng nút 'Đã xong' -> Xóa khỏi công nợ, chuyển vào Doanh thu thuần & Tiền thực thu")
    void tc08_overdueDebtSettledViaCompletedButton_removesFromDebt_addsToCashAndNetRev() {
        LocalDate from = LocalDate.of(2026, 3, 1);
        LocalDate to = LocalDate.of(2026, 3, 31);
        LocalDateTime fromDt = from.atStartOfDay();
        LocalDateTime toDt = to.atTime(LocalTime.MAX);

        when(paymentRepository.sumSystemRevenue(fromDt, toDt, null)).thenReturn(
                new SystemRevenueSummaryResponse(
                        new BigDecimal("1500000"),
                        BigDecimal.ZERO,
                        new BigDecimal("1500000"),
                        BigDecimal.ZERO,
                        BigDecimal.ZERO,
                        BigDecimal.ZERO,
                        BigDecimal.ZERO,
                        new BigDecimal("1500000"),
                        1L
                )
        );
        when(facilityRepository.findAll()).thenReturn(List.of(facilityA));
        when(paymentRepository.sumRevenueByFacility(fromDt, toDt, null)).thenReturn(List.of());
        when(paymentRepository.sumRevenueByMonth(fromDt, toDt, null)).thenReturn(Collections.emptyList());
        when(paymentRepository.countPaidPaymentsByMethod(fromDt, toDt, null)).thenReturn(Collections.emptyList());
        when(refundRequestRepository.findAll()).thenReturn(Collections.emptyList());
        when(handoverRecordRepository.findAll()).thenReturn(Collections.emptyList());

        RentalContract settledContract = RentalContract.builder()
                .facility(facilityA)
                .status(RentalContractStatus.TERMINATED)
                .monthlyFee(new BigDecimal("1500000"))
                .build();
        when(rentalContractRepository.findAll()).thenReturn(List.of(settledContract));

        RevenueReportResponse report = reportService.getRevenueReport(from, to, null);

        // Debt is 0
        assertThat(report.getSystemSummary().getTotalOverdueDebt()).isEqualByComparingTo("0");
        // Net Revenue has the 1.5M
        assertThat(report.getSystemSummary().getNetRevenue()).isEqualByComparingTo("1500000");
        // Total cash-in has the 1.5M
        assertThat(report.getSystemSummary().getTotalCashIn()).isEqualByComparingTo("1500000");
    }

    @Test
    @DisplayName("TC09: Khách hủy đơn theo chính sách cọc 70% hoặc 50% -> Tiền phạt cọc giữ lại ghi nhận Doanh thu thuần, tiền hoàn ghi nhận Group A")
    void tc09_bookingCancellationPartialDepositRefund_forfeitedRetainedInRevenue() {
        LocalDate from = LocalDate.of(2026, 3, 1);
        LocalDate to = LocalDate.of(2026, 3, 31);
        LocalDateTime fromDt = from.atStartOfDay();
        LocalDateTime toDt = to.atTime(LocalTime.MAX);

        when(paymentRepository.sumSystemRevenue(fromDt, toDt, null)).thenReturn(
                new SystemRevenueSummaryResponse(
                        new BigDecimal("3000000"), // 2M deposit + 1M forfeited charge
                        new BigDecimal("2000000"), // depositRevenue
                        BigDecimal.ZERO,           // rentalFeeRevenue
                        BigDecimal.ZERO,           // renewalFeeRevenue
                        new BigDecimal("1000000"), // extraChargeRevenue (retained deposit fee)
                        BigDecimal.ZERO,
                        BigDecimal.ZERO,
                        new BigDecimal("3000000"),
                        2L
                )
        );
        when(facilityRepository.findAll()).thenReturn(List.of(facilityA));
        when(paymentRepository.sumRevenueByFacility(fromDt, toDt, null)).thenReturn(List.of());
        when(paymentRepository.sumRevenueByMonth(fromDt, toDt, null)).thenReturn(Collections.emptyList());
        when(paymentRepository.countPaidPaymentsByMethod(fromDt, toDt, null)).thenReturn(Collections.emptyList());
        when(rentalContractRepository.findAll()).thenReturn(Collections.emptyList());
        when(handoverRecordRepository.findAll()).thenReturn(Collections.emptyList());

        RefundRequest completedDepositRefund = RefundRequest.builder()
                .requestedAmount(new BigDecimal("1000000"))
                .finalRefundAmount(new BigDecimal("1000000"))
                .status(RefundStatus.COMPLETED)
                .facility(facilityA)
                .reason("Cancel booking 50% deposit policy")
                .build();
        completedDepositRefund.setCreatedAt(LocalDateTime.of(2026, 3, 10, 10, 0));
        when(refundRequestRepository.findAll()).thenReturn(List.of(completedDepositRefund));

        RevenueReportResponse report = reportService.getRevenueReport(from, to, null);

        // Net revenue retains the 1M extra charge/forfeited deposit
        assertThat(report.getSystemSummary().getNetRevenue()).isEqualByComparingTo("1000000");
        // Completed refund = 1,000,000
        assertThat(report.getSystemSummary().getRefundedAmount()).isEqualByComparingTo("1000000");
        // Deposits held = 2M - 1M refunded = 1M
        assertThat(report.getSystemSummary().getDepositsHeld()).isEqualByComparingTo("1000000");
    }

    @Test
    @DisplayName("TC10: Đa cơ sở -> Tổng số liệu các cơ sở cộng lại khớp chính xác số liệu toàn hệ thống")
    void tc10_multiFacilitySumConsistency_matchesSystemSummaryExactly() {
        LocalDate from = LocalDate.of(2026, 3, 1);
        LocalDate to = LocalDate.of(2026, 3, 31);
        LocalDateTime fromDt = from.atStartOfDay();
        LocalDateTime toDt = to.atTime(LocalTime.MAX);

        when(paymentRepository.sumSystemRevenue(fromDt, toDt, null)).thenReturn(
                new SystemRevenueSummaryResponse(
                        new BigDecimal("5000000"),
                        new BigDecimal("1500000"),
                        new BigDecimal("3500000"),
                        BigDecimal.ZERO,
                        BigDecimal.ZERO,
                        BigDecimal.ZERO,
                        BigDecimal.ZERO,
                        new BigDecimal("5000000"),
                        4L
                )
        );
        when(facilityRepository.findAll()).thenReturn(List.of(facilityA, facilityB));
        when(paymentRepository.sumRevenueByFacility(fromDt, toDt, null)).thenReturn(List.of(
                new FacilityRevenueResponse(
                        facilityA.getId(),
                        facilityA.getName(),
                        new BigDecimal("3000000"),
                        new BigDecimal("1000000"),
                        new BigDecimal("2000000"),
                        BigDecimal.ZERO,
                        BigDecimal.ZERO,
                        BigDecimal.ZERO,
                        BigDecimal.ZERO,
                        new BigDecimal("3000000"),
                        2L
                ),
                new FacilityRevenueResponse(
                        facilityB.getId(),
                        facilityB.getName(),
                        new BigDecimal("2000000"),
                        new BigDecimal("500000"),
                        new BigDecimal("1500000"),
                        BigDecimal.ZERO,
                        BigDecimal.ZERO,
                        BigDecimal.ZERO,
                        BigDecimal.ZERO,
                        new BigDecimal("2000000"),
                        2L
                )
        ));
        when(paymentRepository.sumRevenueByMonth(fromDt, toDt, null)).thenReturn(Collections.emptyList());
        when(paymentRepository.countPaidPaymentsByMethod(fromDt, toDt, null)).thenReturn(Collections.emptyList());
        when(rentalContractRepository.findAll()).thenReturn(Collections.emptyList());
        when(refundRequestRepository.findAll()).thenReturn(Collections.emptyList());
        when(handoverRecordRepository.findAll()).thenReturn(Collections.emptyList());

        RevenueReportResponse report = reportService.getRevenueReport(from, to, null);

        assertThat(report.getByFacility()).hasSize(2);

        BigDecimal sumFacilityCashIn = report.getByFacility().stream()
                .map(f -> f.getTotalCashIn() != null ? f.getTotalCashIn() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal sumFacilityNetRev = report.getByFacility().stream()
                .map(f -> f.getNetRevenue() != null ? f.getNetRevenue() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal sumFacilityDepositsHeld = report.getByFacility().stream()
                .map(f -> f.getDepositsHeld() != null ? f.getDepositsHeld() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        assertThat(sumFacilityCashIn).isEqualByComparingTo(report.getSystemSummary().getTotalCashIn());
        assertThat(sumFacilityNetRev).isEqualByComparingTo(report.getSystemSummary().getNetRevenue());
        assertThat(sumFacilityDepositsHeld).isEqualByComparingTo(report.getSystemSummary().getDepositsHeld());
    }

    @Test
    @DisplayName("TC11: Lọc theo kỳ báo cáo -> Chỉ các giao dịch và sự kiện phát sinh trong kỳ được tính vào báo cáo kỳ đó")
    void tc11_reportingPeriodFiltering_onlyInPeriodEventsCalculated() {
        LocalDate marchFrom = LocalDate.of(2026, 3, 1);
        LocalDate marchTo = LocalDate.of(2026, 3, 31);
        LocalDateTime marchFromDt = marchFrom.atStartOfDay();
        LocalDateTime marchToDt = marchTo.atTime(LocalTime.MAX);

        when(paymentRepository.sumSystemRevenue(marchFromDt, marchToDt, null)).thenReturn(
                new SystemRevenueSummaryResponse(
                        new BigDecimal("2000000"),
                        BigDecimal.ZERO,
                        new BigDecimal("2000000"),
                        BigDecimal.ZERO,
                        BigDecimal.ZERO,
                        BigDecimal.ZERO,
                        BigDecimal.ZERO,
                        new BigDecimal("2000000"),
                        1L
                )
        );
        when(facilityRepository.findAll()).thenReturn(List.of(facilityA));
        when(paymentRepository.sumRevenueByFacility(marchFromDt, marchToDt, null)).thenReturn(List.of());
        when(paymentRepository.sumRevenueByMonth(marchFromDt, marchToDt, null)).thenReturn(Collections.emptyList());
        when(paymentRepository.countPaidPaymentsByMethod(marchFromDt, marchToDt, null)).thenReturn(Collections.emptyList());
        when(rentalContractRepository.findAll()).thenReturn(Collections.emptyList());
        when(handoverRecordRepository.findAll()).thenReturn(Collections.emptyList());

        // Refund request created in February (outside March period)
        RefundRequest febRefund = RefundRequest.builder()
                .requestedAmount(new BigDecimal("1000000"))
                .finalRefundAmount(new BigDecimal("1000000"))
                .status(RefundStatus.COMPLETED)
                .facility(facilityA)
                .build();
        febRefund.setCreatedAt(LocalDateTime.of(2026, 2, 15, 10, 0));

        // Refund request created in March (inside period)
        RefundRequest marchRefund = RefundRequest.builder()
                .requestedAmount(new BigDecimal("500000"))
                .finalRefundAmount(new BigDecimal("500000"))
                .status(RefundStatus.COMPLETED)
                .facility(facilityA)
                .build();
        marchRefund.setCreatedAt(LocalDateTime.of(2026, 3, 10, 10, 0));

        when(refundRequestRepository.findAll()).thenReturn(List.of(febRefund, marchRefund));

        RevenueReportResponse report = reportService.getRevenueReport(marchFrom, marchTo, null);

        // In March report, only marchRefund (500,000) is included; febRefund is excluded
        assertThat(report.getSystemSummary().getRefundedAmount()).isEqualByComparingTo("500000");
    }

    @Test
    @DisplayName("TC12: Đơn ký và thanh toán tại quầy chưa tiếp nhận (depositPaid=0, contract PENDING_SIGNATURE) không tính vào depositsHeld; chỉ tính đơn online đã thanh toán cọc")
    void tc12_counterBookingUnactivatedDoesNotHoldDepositUntilHandoverCheckin() {
        LocalDate from = LocalDate.of(2026, 3, 1);
        LocalDate to = LocalDate.of(2026, 3, 31);
        LocalDateTime fromDt = from.atStartOfDay();
        LocalDateTime toDt = to.atTime(LocalTime.MAX);

        when(paymentRepository.sumSystemRevenue(fromDt, toDt, null)).thenReturn(
                new SystemRevenueSummaryResponse(
                        new BigDecimal("22051250"),
                        new BigDecimal("5750000"),
                        BigDecimal.ZERO,
                        BigDecimal.ZERO,
                        BigDecimal.ZERO,
                        new BigDecimal("16301250"),
                        BigDecimal.ZERO,
                        new BigDecimal("22051250"),
                        2L
                )
        );
        when(facilityRepository.findAll()).thenReturn(List.of(facilityA));
        when(paymentRepository.sumRevenueByFacility(fromDt, toDt, null)).thenReturn(List.of());
        when(paymentRepository.sumRevenueByMonth(fromDt, toDt, null)).thenReturn(Collections.emptyList());
        when(paymentRepository.countPaidPaymentsByMethod(fromDt, toDt, null)).thenReturn(Collections.emptyList());
        when(refundRequestRepository.findAll()).thenReturn(Collections.emptyList());
        when(handoverRecordRepository.findAll()).thenReturn(Collections.emptyList());

        // Đơn 1: Online booking đã thanh toán cọc 4.500.000
        Booking onlineBooking1 = Booking.builder().facility(facilityA).depositPaid(new BigDecimal("4500000")).build();
        onlineBooking1.setId(UUID.randomUUID());
        RentalContract onlineContract1 = RentalContract.builder()
                .facility(facilityA)
                .booking(onlineBooking1)
                .depositHeld(new BigDecimal("4500000"))
                .status(RentalContractStatus.PENDING_ACTIVATION)
                .build();
        onlineContract1.setId(UUID.randomUUID());

        // Đơn 2: Online booking đã thanh toán cọc 1.250.000
        Booking onlineBooking2 = Booking.builder().facility(facilityA).depositPaid(new BigDecimal("1250000")).build();
        onlineBooking2.setId(UUID.randomUUID());
        RentalContract onlineContract2 = RentalContract.builder()
                .facility(facilityA)
                .booking(onlineBooking2)
                .depositHeld(new BigDecimal("1250000"))
                .status(RentalContractStatus.PENDING_ACTIVATION)
                .build();
        onlineContract2.setId(UUID.randomUUID());

        // Đơn 3: Đơn ký giấy tại quầy chưa tiếp nhận (depositPaid = 0, draft contract depositHeld = 1.250.000)
        Booking counterBooking = Booking.builder().facility(facilityA).depositPaid(BigDecimal.ZERO).build();
        counterBooking.setId(UUID.randomUUID());
        RentalContract counterContract = RentalContract.builder()
                .facility(facilityA)
                .booking(counterBooking)
                .depositHeld(new BigDecimal("1250000"))
                .status(RentalContractStatus.PENDING_SIGNATURE)
                .build();
        counterContract.setId(UUID.randomUUID());

        when(rentalContractRepository.findAll()).thenReturn(List.of(onlineContract1, onlineContract2, counterContract));
        when(bookingRepository.findAll()).thenReturn(List.of(onlineBooking1, onlineBooking2, counterBooking));

        RevenueReportResponse report = reportService.getRevenueReport(from, to, null);

        // Tiền cọc đang giữ CHỈ tính 2 đơn online: 4.500.000 + 1.250.000 = 5.750.000 (KHÔNG tính 1.250.000 của đơn quầy)
        assertThat(report.getSystemSummary().getDepositsHeld()).isEqualByComparingTo("5750000");
        // Phần phí thuê trong BOOKING_PAYMENT (22.051.250 - 5.750.000 = 16.301.250) phải được ghi nhận vào Doanh thu cho thuê và Doanh thu thuần
        assertThat(report.getSystemSummary().getRentalRevenue()).isEqualByComparingTo("16301250");
        assertThat(report.getSystemSummary().getNetRevenue()).isEqualByComparingTo("16301250");
        assertThat(report.getSystemSummary().getTotalCashIn()).isEqualByComparingTo("22051250");

        // Sau khi hoàn tất 4 bước check-in và kích hoạt bàn giao, hợp đồng quầy trở thành ACTIVE
        counterContract.setStatus(RentalContractStatus.ACTIVE);
        RevenueReportResponse reportAfterHandover = reportService.getRevenueReport(from, to, null);
        assertThat(reportAfterHandover.getSystemSummary().getDepositsHeld()).isEqualByComparingTo("7000000");
    }

    @Test
    @DisplayName("TC13: Giao dịch bồi thường trả kho 2.250.000đ được ghi nhận vào NetRevenue, MonthlyRevenue và RefundBreakdown")
    void tc13_returnCompensationIncludedInNetRevenueAndMonthlyAndRefundBreakdown() {
        LocalDate from = LocalDate.of(2026, 11, 1);
        LocalDate to = LocalDate.of(2026, 11, 30);
        LocalDateTime fromDt = from.atStartOfDay();
        LocalDateTime toDt = to.atTime(LocalTime.MAX);

        when(paymentRepository.sumSystemRevenue(fromDt, toDt, null)).thenReturn(
                new SystemRevenueSummaryResponse(
                        new BigDecimal("24301250"), // totalRevenue
                        new BigDecimal("5750000"),  // depositRevenue
                        new BigDecimal("16301250"), // rentalFeeRevenue
                        BigDecimal.ZERO,           // renewalFeeRevenue
                        BigDecimal.ZERO,           // extraChargeRevenue
                        BigDecimal.ZERO,           // bookingPaymentRevenue
                        new BigDecimal("2250000"), // returnCompensationRevenue
                        new BigDecimal("24301250"), // totalCashIn
                        3L                         // paymentCount
                )
        );
        when(facilityRepository.findAll()).thenReturn(List.of(facilityA));
        when(paymentRepository.sumRevenueByFacility(fromDt, toDt, null)).thenReturn(List.of(
                new FacilityRevenueResponse(
                        facilityA.getId(),
                        facilityA.getName(),
                        new BigDecimal("24301250"),
                        new BigDecimal("5750000"),
                        new BigDecimal("16301250"),
                        BigDecimal.ZERO,
                        BigDecimal.ZERO,
                        BigDecimal.ZERO,
                        new BigDecimal("2250000"),
                        new BigDecimal("24301250"),
                        3L
                )
        ));

        // sumRevenueByMonth: year=2026, month=11, rental=16301250, dep=5750000, ren=0, ext=0, book=0, retComp=2250000, total=24301250, count=3
        Object[] monthRow = new Object[]{
                2026, 11,
                new BigDecimal("16301250"),
                new BigDecimal("5750000"),
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                new BigDecimal("2250000"),
                new BigDecimal("24301250"),
                3L
        };
        when(paymentRepository.sumRevenueByMonth(fromDt, toDt, null)).thenReturn(Collections.singletonList(monthRow));
        when(paymentRepository.countPaidPaymentsByMethod(fromDt, toDt, null)).thenReturn(Collections.emptyList());
        when(rentalContractRepository.findAll()).thenReturn(Collections.emptyList());
        when(bookingRepository.findAll()).thenReturn(Collections.emptyList());
        when(refundRequestRepository.findAll()).thenReturn(Collections.emptyList());

        RevenueReportResponse report = reportService.getRevenueReport(from, to, null);

        // SystemSummary: NetRevenue = 16.301.250 + 2.250.000 = 18.551.250
        assertThat(report.getSystemSummary().getNetRevenue()).isEqualByComparingTo("18551250");
        assertThat(report.getSystemSummary().getReturnCompensationRevenue()).isEqualByComparingTo("2250000");

        // MonthlyRevenue: NetRevenue of 2026-11 = 18.551.250
        assertThat(report.getMonthlyRevenue()).hasSize(1);
        assertThat(report.getMonthlyRevenue().get(0).getReturnCompensationRevenue()).isEqualByComparingTo("2250000");
        assertThat(report.getMonthlyRevenue().get(0).getNetRevenue()).isEqualByComparingTo("18551250");

        // RefundBreakdown: returnCompensationAmount = 2.250.000
        assertThat(report.getRefundBreakdown().getReturnCompensationAmount()).isEqualByComparingTo("2250000");
    }

    @Test
    @DisplayName("TC14: Hủy đơn hỗn hợp (tiền thuê + cọc), FM đã chuyển khoản (AWAITING_CUSTOMER_CONFIRMATION) -> Tiền cọc đang giữ giảm đúng số cọc hoàn, NetRev chỉ trừ phần tiền thuê")
    void tc14_cancelledBookingRefundAwaitingCustomerConfirmation_decreasesDepositsHeldAndDeductsRentalPortion() {
        LocalDate from = LocalDate.of(2026, 11, 1);
        LocalDate to = LocalDate.of(2026, 11, 30);
        LocalDateTime fromDt = from.atStartOfDay();
        LocalDateTime toDt = to.atTime(LocalTime.MAX);

        when(paymentRepository.sumSystemRevenue(fromDt, toDt, null)).thenReturn(
                new SystemRevenueSummaryResponse(
                        new BigDecimal("1347500"), // totalRevenue
                        new BigDecimal("350000"),  // depositRevenue
                        new BigDecimal("997500"),  // rentalFeeRevenue
                        BigDecimal.ZERO,
                        BigDecimal.ZERO,
                        BigDecimal.ZERO,
                        BigDecimal.ZERO,
                        new BigDecimal("1347500"),
                        2L
                )
        );
        when(facilityRepository.findAll()).thenReturn(List.of(facilityA));
        when(paymentRepository.sumRevenueByFacility(fromDt, toDt, null)).thenReturn(List.of());
        when(paymentRepository.sumRevenueByMonth(fromDt, toDt, null)).thenReturn(Collections.emptyList());
        when(paymentRepository.countPaidPaymentsByMethod(fromDt, toDt, null)).thenReturn(Collections.emptyList());

        Booking booking = Booking.builder()
                .facility(facilityA)
                .bookingCode("BX-2026-5359")
                .depositPaid(new BigDecimal("350000"))
                .status(BookingStatus.CANCELLED)
                .build();
        booking.setId(UUID.randomUUID());
        when(bookingRepository.findAll()).thenReturn(List.of(booking));
        when(rentalContractRepository.findAll()).thenReturn(Collections.emptyList());

        RefundRequest cancellationRefund = RefundRequest.builder()
                .booking(booking)
                .requestedAmount(new BigDecimal("1347500"))
                .finalRefundAmount(new BigDecimal("1347500"))
                .deductionAmount(BigDecimal.ZERO)
                .status(RefundStatus.AWAITING_CUSTOMER_CONFIRMATION)
                .reason("Hoàn tiền khi hủy đơn BX-2026-5359. Tiền thuê hoàn: 997500.00 đ, Cọc: 350000.00 đ (Khấu trừ: 0 đ). Lý do: Cần đổi sang kích thước ngăn kho khác")
                .facility(facilityA)
                .build();
        cancellationRefund.setCreatedAt(LocalDateTime.of(2026, 11, 6, 13, 42));
        when(refundRequestRepository.findAll()).thenReturn(List.of(cancellationRefund));

        RevenueReportResponse report = reportService.getRevenueReport(from, to, null);

        // 1. Tiền cọc đang giữ: Giảm từ 350.000 về 0 vì đã hoàn tiền chuyển khoản xong
        assertThat(report.getSystemSummary().getDepositsHeld()).isEqualByComparingTo("0");

        // 2. Doanh thu thuần (Net Revenue): 997.500 - 997.500 (chỉ trừ phần tiền thuê, KHÔNG trừ 1.347.500) = 0
        assertThat(report.getSystemSummary().getNetRevenue()).isEqualByComparingTo("0");

        // 3. Hoàn tiền đã chi trả (Group A): 1.347.500
        assertThat(report.getSystemSummary().getRefundedAmount()).isEqualByComparingTo("1347500");
    }
}

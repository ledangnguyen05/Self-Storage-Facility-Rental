package com.boxora.service.impl;

import com.boxora.dto.request.BookingCancelRequest;
import com.boxora.dto.response.AutoCancelDetail;
import com.boxora.dto.response.AutoCancelResult;
import com.boxora.dto.response.BookingCancelResponse;
import com.boxora.dto.response.BookingCancellationPreviewResponse;
import com.boxora.entity.*;
import com.boxora.enums.*;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.repository.*;
import com.boxora.security.RequestContext;
import com.boxora.service.ActivityLogService;
import com.boxora.service.BookingCancellationService;
import com.boxora.service.EmailService;
import com.boxora.service.StorageUnitLockService;
import com.boxora.util.VNPayUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class BookingCancellationServiceImpl implements BookingCancellationService {

    private final BookingRepository bookingRepository;
    private final StorageUnitRepository storageUnitRepository;
    private final FacilityPolicyRepository facilityPolicyRepository;
    private final PaymentRepository paymentRepository;
    private final RentalContractRepository rentalContractRepository;
    private final RefundRequestRepository refundRequestRepository;
    private final HandoverRecordRepository handoverRecordRepository;
    private final UserRepository userRepository;
    private final ActivityLogService activityLogService;
    private final RequestContext requestContext;
    private final StorageUnitLockService storageUnitLockService;
    private final com.boxora.security.FacilityAccessGuard facilityAccessGuard;
    private final EmailService emailService;

    @Value("${app.scheduling.pending-payment-timeout-minutes:15}")
    private int defaultPendingPaymentTimeoutMinutes;

    @Value("${app.booking.approval-timeout-hours:24}")
    private int pendingApprovalTimeoutHours;

    /**
     * Tự động quét và hủy các booking PENDING_PAYMENT quá hạn mỗi 15 phút (0 *\/15 * * * ?).
     */
    @Scheduled(cron = "${app.scheduling.auto-cancel-cron:0 */15 * * * ?}")
    @Transactional
    public void runAutoCancelCron() {
        log.info("[CRON] Starting 15-minute automated pending payment booking cancellation...");
        try {
            AutoCancelResult result = triggerAutoCancel(defaultPendingPaymentTimeoutMinutes);
            if (result.getCancelledCount() > 0) {
                log.info("[CRON] Auto-cancel completed. Expired cancelled: {}, Units released: {}",
                        result.getCancelledCount(), result.getUnitsReleasedCount());
            } else {
                log.debug("[CRON] Auto-cancel completed. No expired pending bookings found.");
            }
        } catch (Exception e) {
            log.error("[CRON] Error during automated pending booking cancellation", e);
        }
    }

    /**
     * Xem trước thông tin hoàn tiền theo chính sách 3 mốc:
     * - Mốc 1 (>= 48h): Hoàn 100% tiền cọc
     * - Mốc 2 (24h - 48h): Hoàn 50% tiền cọc (giữ lại 50% phí hủy)
     * - Mốc 3 (< 24h hoặc sau check-in): Hoàn 0% (khấu trừ 100% tiền cọc)
     */
    @Override
    @Transactional(readOnly = true)
    public BookingCancellationPreviewResponse previewCancellationRefund(UUID bookingId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        validateBookingForCancellation(booking);

        FacilityPolicy policy = getFacilityPolicy(booking);
        int fullRefundHours = (policy != null && policy.getCancellationFullRefundHours() != null)
                ? policy.getCancellationFullRefundHours() : 48;
        int partialRefundHours = (policy != null && policy.getCancellationPartialRefundHours() != null)
                ? policy.getCancellationPartialRefundHours() : 24;
        double partialRefundPercent = (policy != null && policy.getCancellationPartialRefundPercent() != null)
                ? policy.getCancellationPartialRefundPercent() : 50.0;

        String unitCode = booking.getStorageUnit() != null ? booking.getStorageUnit().getUnitCode() : null;
        BigDecimal depositPaid = booking.getDepositPaid() != null ? booking.getDepositPaid() : BigDecimal.ZERO;
        BigDecimal totalRentalFee = booking.getTotalRentalFee() != null ? booking.getTotalRentalFee() : BigDecimal.ZERO;

        // Xác định mốc thời gian nhận kho chuẩn xác:
        // Ưu tiên expectedCheckInAt của booking (lịch hẹn nhận kho đang có hiệu lực).
        // Nếu không có, dùng ngày bắt đầu thuê (startDate) kết hợp giờ mở cửa của cơ sở (mặc định 08:00 sáng).
        LocalDateTime checkinDateTime = resolveEffectiveCheckInDateTime(booking);
        LocalDateTime now = LocalDateTime.now();
        Duration durationUntilCheckin = Duration.between(now, checkinDateTime);
        long hoursUntilCheckin = durationUntilCheckin.toHours();
        String timeRemainingLabel = formatCalmRemainingTime(durationUntilCheckin, hoursUntilCheckin);

        // Nếu booking ở trạng thái PENDING_PAYMENT hoặc PENDING_APPROVAL: chưa thanh toán cọc -> không có tiền hoàn và không phạt
        if (booking.getStatus() == BookingStatus.PENDING_PAYMENT || booking.getStatus() == BookingStatus.PENDING_APPROVAL) {
            return BookingCancellationPreviewResponse.builder()
                    .bookingId(booking.getId())
                    .bookingCode(booking.getBookingCode())
                    .unitCode(unitCode)
                    .startDate(booking.getStartDate())
                    .checkInDateTime(checkinDateTime)
                    .depositPaid(depositPaid)
                    .totalRentalFee(totalRentalFee)
                    .hoursUntilCheckin(hoursUntilCheckin)
                    .timeRemainingLabel(timeRemainingLabel)
                    .milestoneStage("STAGE_PENDING_NO_PAYMENT")
                    .refundPercentage(0.0)
                    .refundAmount(BigDecimal.ZERO)
                    .penaltyAmount(BigDecimal.ZERO)
                    .policyDescription("Đơn đặt kho đang chờ thanh toán. Hủy đơn không phát sinh chi phí và không hoàn tiền.")
                    .refundable(false)
                    .build();
        }

        String milestoneStage;
        double refundPercentage;
        BigDecimal refundAmount;
        BigDecimal penaltyAmount;
        String policyDescription;

        if (hoursUntilCheckin >= fullRefundHours) {
            // MỐC 1: >= 48h trước lịch hẹn nhận kho -> Hoàn 100% tiền cọc
            milestoneStage = "STAGE_1_FULL_REFUND";
            refundPercentage = 100.0;
            refundAmount = depositPaid;
            penaltyAmount = BigDecimal.ZERO;
            policyDescription = String.format("Mốc 1: Hủy trước giờ hẹn nhận kho từ %d giờ trở lên. Hoàn 100%% tiền cọc đã đóng.", fullRefundHours);
        } else if (hoursUntilCheckin >= partialRefundHours) {
            // MỐC 2: Từ 24h đến dưới 48h trước lịch hẹn nhận kho -> Hoàn 50% tiền cọc
            milestoneStage = "STAGE_2_PARTIAL_REFUND";
            refundPercentage = partialRefundPercent;
            refundAmount = depositPaid.multiply(BigDecimal.valueOf(partialRefundPercent / 100.0))
                    .setScale(2, RoundingMode.HALF_UP);
            penaltyAmount = depositPaid.subtract(refundAmount);
            policyDescription = String.format("Mốc 2: Hủy trước giờ hẹn nhận kho từ %d đến dưới %d giờ. Hoàn %.0f%% tiền cọc, khấu trừ %.0f%% chi phí giữ chỗ.",
                    partialRefundHours, fullRefundHours, partialRefundPercent, 100.0 - partialRefundPercent);
        } else {
            // MỐC 3: Dưới 24h trước lịch hẹn nhận kho hoặc đã qua lịch hẹn -> Áp dụng chính sách hủy sát giờ
            milestoneStage = "STAGE_3_NO_REFUND";
            refundPercentage = 0.0;
            refundAmount = BigDecimal.ZERO;
            penaltyAmount = depositPaid;
            policyDescription = String.format("Mốc 3: Hủy dưới %d giờ trước giờ hẹn nhận kho hoặc đã qua giờ hẹn. Khấu trừ 100%% tiền cọc theo điều khoản hủy sát giờ.",
                    partialRefundHours);
        }

        boolean refundable = refundAmount.compareTo(BigDecimal.ZERO) > 0;

        return BookingCancellationPreviewResponse.builder()
                .bookingId(booking.getId())
                .bookingCode(booking.getBookingCode())
                .unitCode(unitCode)
                .startDate(booking.getStartDate())
                .checkInDateTime(checkinDateTime)
                .depositPaid(depositPaid)
                .totalRentalFee(totalRentalFee)
                .hoursUntilCheckin(hoursUntilCheckin)
                .timeRemainingLabel(timeRemainingLabel)
                .milestoneStage(milestoneStage)
                .refundPercentage(refundPercentage)
                .refundAmount(refundAmount)
                .penaltyAmount(penaltyAmount)
                .policyDescription(policyDescription)
                .refundable(refundable)
                .build();
    }

    /**
     * Thực hiện hủy booking theo chính sách hoàn tiền 3 mốc:
     * - Chỉ giải phóng kho khi đơn ở trạng thái hợp lệ và chưa check-in kho.
     * - Lưu lịch sử lý do hủy, người hủy và thời điểm hủy vào booking.
     * - Nếu có hoàn cọc, khởi tạo quy trình RefundRequest hợp lệ (PENDING_REVIEW), không tạo Payment hoàn tiền giả mạo.
     */
    @Override
    @Transactional
    public BookingCancelResponse cancelBooking(UUID bookingId, BookingCancelRequest request) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        validateBookingForCancellation(booking);

        // Kiểm tra quyền: nếu là CUSTOMER thì chỉ được hủy booking của chính mình
        UUID currentUserId = requestContext.currentUserId();
        String currentRole = requestContext.currentUserRole();
        if ("CUSTOMER".equalsIgnoreCase(currentRole) && booking.getCustomer() != null
                && currentUserId != null && !booking.getCustomer().getId().equals(currentUserId)) {
            throw new AppException(ErrorCode.FORBIDDEN);
        }

        // Kiểm tra phạm vi cơ sở nếu người thao tác là nhân sự nội bộ (STAFF / FACILITY_MANAGER)
        if (!"CUSTOMER".equalsIgnoreCase(currentRole) && facilityAccessGuard != null && facilityAccessGuard.isFacilityScoped()) {
            UUID facilityId = (booking.getStorageUnit() != null && booking.getStorageUnit().getFacility() != null)
                    ? booking.getStorageUnit().getFacility().getId()
                    : (booking.getFacility() != null ? booking.getFacility().getId() : null);
            if (facilityId != null) {
                facilityAccessGuard.checkFacilityAccess(facilityId);
            }
        }

        User cancelledByUser = currentUserId != null
                ? userRepository.findById(currentUserId).orElse(null)
                : booking.getCustomer();

        BookingCancellationPreviewResponse preview = previewCancellationRefund(bookingId);

        // Cập nhật trạng thái Booking và lưu thông tin hủy
        BookingStatus oldStatus = booking.getStatus();
        LocalDateTime cancelNow = LocalDateTime.now();
        String reason = (request != null && request.getCancellationReason() != null && !request.getCancellationReason().isBlank())
                ? request.getCancellationReason().trim() : "Khách hàng yêu cầu hủy";

        booking.setStatus(BookingStatus.CANCELLED);
        booking.setCancellationReason(reason);
        booking.setCancelledBy(cancelledByUser);
        booking.setCancelledAt(cancelNow);
        booking.setAccessPin(null); // Thu hồi PIN
        booking.setQrAccessToken("REVOKED_CANCELLED"); // Thu hồi QR token

        // Giải phóng StorageUnit về AVAILABLE nếu không còn booking active nào khác
        boolean unitReleased = false;
        StorageUnit unit = booking.getStorageUnit();
        if (unit != null) {
            unit.setStatus(UnitStatus.AVAILABLE);
            storageUnitRepository.save(unit);
            storageUnitLockService.releaseLock(unit.getId());
            unitReleased = true;
        }

        // Hủy hợp đồng thuê liên kết nếu đang ở trạng thái chờ ký hoặc chờ kích hoạt nhận kho
        RentalContract linkedContract = rentalContractRepository.findByBookingId(booking.getId()).orElse(null);
        if (linkedContract != null) {
            if (linkedContract.getStatus() == RentalContractStatus.PENDING_SIGNATURE
                    || linkedContract.getStatus() == RentalContractStatus.PENDING_ACTIVATION) {
                linkedContract.setStatus(RentalContractStatus.CANCELLED);
                rentalContractRepository.save(linkedContract);
            }
        }

        // Nếu có hoàn tiền cọc (refundAmount > 0), khởi tạo RefundRequest chính thức thay vì ghi nhận thanh toán giả
        UUID refundRequestId = null;
        String refundRequestCode = null;
        if (preview.getRefundAmount() != null && preview.getRefundAmount().compareTo(BigDecimal.ZERO) > 0) {
            Facility facility = (unit != null) ? unit.getFacility() : null;
            if (facility == null && linkedContract != null) {
                facility = linkedContract.getFacility();
            }

            String bankName = (request != null && request.getBankName() != null && !request.getBankName().isBlank())
                    ? request.getBankName().trim() : "CHỜ_CẬP_NHẬT";
            String bankAccountNumber = (request != null && request.getBankAccountNumber() != null && !request.getBankAccountNumber().isBlank())
                    ? request.getBankAccountNumber().trim() : "CHỜ_CẬP_NHẬT";
            String bankAccountName = (request != null && request.getBankAccountName() != null && !request.getBankAccountName().isBlank())
                    ? request.getBankAccountName().trim()
                    : (booking.getCustomer() != null && booking.getCustomer().getFullName() != null
                    ? booking.getCustomer().getFullName() : "KHACH_HANG");

            refundRequestCode = "REF-" + System.currentTimeMillis() + "-" + VNPayUtil.randomAlphaNumeric(4).toUpperCase();
            RefundRequest refundRequest = RefundRequest.builder()
                    .requestCode(refundRequestCode)
                    .customer(booking.getCustomer())
                    .facility(facility)
                    .booking(booking)
                    .contract(linkedContract)
                    .requestedAmount(booking.getDepositPaid() != null ? booking.getDepositPaid() : preview.getRefundAmount())
                    .deductionAmount(preview.getPenaltyAmount())
                    .finalRefundAmount(preview.getRefundAmount())
                    .bankName(bankName)
                    .bankAccountNumber(bankAccountNumber)
                    .bankAccountName(bankAccountName)
                    .reason(String.format("Hoàn cọc khi hủy đơn %s (%s). Lý do: %s",
                            booking.getBookingCode(), preview.getMilestoneStage(), reason))
                    .status(RefundStatus.PENDING_REVIEW)
                    .requestedBy(cancelledByUser != null ? cancelledByUser : booking.getCustomer())
                    .build();

            refundRequest = refundRequestRepository.save(refundRequest);
            refundRequestId = refundRequest.getId();
        }

        bookingRepository.save(booking);

        // Ghi Audit Trail ActivityLog
        UUID facilityId = (unit != null && unit.getFacility() != null)
                ? unit.getFacility().getId()
                : (booking.getFacility() != null ? booking.getFacility().getId() : null);

        activityLogService.record(
                facilityId,
                ActivityAction.RESERVATION_CANCEL,
                "Booking",
                booking.getId(),
                String.format("Hủy đơn đặt kho %s theo %s. Hoàn cọc: %s VNĐ, Phạt giữ chỗ: %s VNĐ. Lý do: %s",
                        booking.getBookingCode(), preview.getMilestoneStage(), preview.getRefundAmount(), preview.getPenaltyAmount(), reason),
                oldStatus,
                BookingStatus.CANCELLED
        );

        if (unitReleased) {
            activityLogService.record(
                    facilityId,
                    ActivityAction.STORAGE_UNIT_RELEASE,
                    "StorageUnit",
                    unit.getId(),
                    String.format("Giải phóng ngăn kho %s về trạng thái AVAILABLE do đơn đặt kho %s bị hủy",
                            unit.getUnitCode(), booking.getBookingCode()),
                    null,
                    UnitStatus.AVAILABLE
            );
        }

        activityLogService.record(
                facilityId,
                ActivityAction.ACCESS_CREDENTIAL_REVOKE,
                "Booking",
                booking.getId(),
                String.format("Thu hồi mã PIN và mã QR của đơn %s do đơn đã bị hủy", booking.getBookingCode()),
                null,
                null
        );

        if (refundRequestId != null) {
            activityLogService.record(
                    facilityId,
                    ActivityAction.REFUND_REQUEST_CREATE,
                    "RefundRequest",
                    refundRequestId,
                    String.format("Khởi tạo yêu cầu hoàn cọc %s cho đơn %s (Số tiền: %s VNĐ, Mốc: %s)",
                            refundRequestCode, booking.getBookingCode(), preview.getRefundAmount(), preview.getMilestoneStage()),
                    null,
                    RefundStatus.PENDING_REVIEW.name()
            );
        }

        // Gửi email thông báo hủy / từ chối đặt kho tới khách hàng
        try {
            if (booking.getCustomer() != null && booking.getCustomer().getEmail() != null && !booking.getCustomer().getEmail().isBlank()) {
                String custEmail = booking.getCustomer().getEmail().trim();
                String custName = booking.getCustomer().getFullName() != null && !booking.getCustomer().getFullName().isBlank()
                        ? booking.getCustomer().getFullName() : booking.getCustomer().getUsername();
                String facName = (booking.getStorageUnit() != null && booking.getStorageUnit().getFacility() != null)
                        ? booking.getStorageUnit().getFacility().getName()
                        : (booking.getFacility() != null ? booking.getFacility().getName() : "Hệ thống Boxora");
                String uCode = booking.getStorageUnit() != null
                        ? booking.getStorageUnit().getUnitCode()
                        : (booking.getUnitType() != null ? booking.getUnitType().getTypeName() : "Kho tự quản");
                boolean isRejectedByStaff = !"CUSTOMER".equalsIgnoreCase(currentRole);
                emailService.sendBookingCancellationEmail(
                        custEmail,
                        custName,
                        booking.getBookingCode(),
                        facName,
                        uCode,
                        reason,
                        isRejectedByStaff,
                        preview != null ? preview.getRefundAmount() : BigDecimal.ZERO
                );
            }
        } catch (Exception ex) {
            log.error("[EMAIL_DISPATCH_FAILED] Không thể gửi email thông báo hủy/từ chối đơn {}: {}", booking.getBookingCode(), ex.getMessage(), ex);
        }

        return BookingCancelResponse.builder()
                .bookingId(booking.getId())
                .bookingCode(booking.getBookingCode())
                .status(BookingStatus.CANCELLED)
                .milestoneStage(preview.getMilestoneStage())
                .refundPercentage(preview.getRefundPercentage())
                .refundAmount(preview.getRefundAmount())
                .penaltyAmount(preview.getPenaltyAmount())
                .refundRequestId(refundRequestId)
                .refundRequestCode(refundRequestCode)
                .unitReleased(unitReleased)
                .cancelledAt(cancelNow)
                .cancellationReason(reason)
                .message("Đã hủy đơn đặt kho thành công. " + preview.getPolicyDescription())
                .build();
    }

    @Override
    @Transactional
    public BookingCancelResponse cancelBookingByCode(String bookingCode, BookingCancelRequest request) {
        if (bookingCode == null || bookingCode.isBlank()) {
            throw new AppException(ErrorCode.BOOKING_NOT_FOUND);
        }
        Booking booking = bookingRepository.findByBookingCodeForUpdate(bookingCode.trim())
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));
        return cancelBooking(booking.getId(), request);
    }

    /**
     * Kích hoạt quét tự động hủy các booking PENDING_PAYMENT quá hạn thanh toán.
     */
    @Override
    @Transactional
    public AutoCancelResult triggerAutoCancel(Integer timeoutMinutes) {
        int timeout = (timeoutMinutes != null && timeoutMinutes > 0)
                ? timeoutMinutes : defaultPendingPaymentTimeoutMinutes;
        LocalDateTime threshold = LocalDateTime.now().minusMinutes(timeout);
        LocalDate today = LocalDate.now();

        List<Booking> expiredBookings = new ArrayList<>(bookingRepository.findExpiredPendingBookings(
                BookingStatus.PENDING_PAYMENT, threshold, today));
        expiredBookings.addAll(bookingRepository.findExpiredPendingBookings(
                BookingStatus.PENDING_APPROVAL, LocalDateTime.now().minusHours(pendingApprovalTimeoutHours), today));

        log.info("[AUTO-CANCEL] Found {} pending payment bookings exceeding {} minutes or start date",
                expiredBookings.size(), timeout);

        int cancelledCount = 0;
        int unitsReleasedCount = 0;
        List<AutoCancelDetail> detailList = new ArrayList<>();

        for (Booking candidate : expiredBookings) {
            Booking booking = bookingRepository.findByIdForUpdate(candidate.getId()).orElse(null);
            if (booking == null) {
                continue;
            }

            if (booking.getStatus() == BookingStatus.CANCELLED) {
                continue;
            }
            if (booking.getStatus() != BookingStatus.PENDING_PAYMENT && booking.getStatus() != BookingStatus.PENDING_APPROVAL) {
                continue;
            }

            boolean hasPaidPayment = paymentRepository.existsByBooking_IdAndStatus(booking.getId(), PaymentStatus.PAID);
            if (hasPaidPayment) {
                log.info("[AUTO-CANCEL_RECONCILE] Booking {} has PAID payment; reconciling to CONFIRMED instead of CANCELLED", booking.getBookingCode());
                booking.setStatus(BookingStatus.CONFIRMED);
                booking.setPaymentExpiresAt(null);
                bookingRepository.save(booking);
                if (booking.getStorageUnit() != null) {
                    storageUnitLockService.releaseLock(booking.getStorageUnit().getId());
                }
                continue;
            }

            booking.setStatus(BookingStatus.CANCELLED);
            booking.setCancellationReason("Hệ thống tự động hủy do quá hạn thanh toán");
            booking.setCancelledAt(LocalDateTime.now());
            booking.setPaymentExpiresAt(null);
            booking.setHoldExpiresAt(null);
            booking.setPaymentStatus("UNPAID");
            booking.setAccessPin(null);
            booking.setQrAccessToken("REVOKED_AUTO_CANCEL");

            boolean released = false;
            StorageUnit unit = booking.getStorageUnit();
            if (unit != null) {
                UUID unitId = unit.getId();
                StorageUnit lockedUnit = storageUnitRepository.findWithDetailsByIdForUpdate(unitId).orElse(null);
                if (lockedUnit != null) {
                    boolean hasOtherActive = bookingRepository.existsByStorageUnit_IdAndStatusInAndIdNot(
                            unitId,
                            List.of(BookingStatus.ACTIVE, BookingStatus.CONFIRMED, BookingStatus.PENDING_PAYMENT, BookingStatus.PENDING_APPROVAL),
                            booking.getId()
                    );
                    if (!hasOtherActive && lockedUnit.getStatus() == UnitStatus.RESERVED) {
                        lockedUnit.setStatus(UnitStatus.AVAILABLE);
                        storageUnitRepository.save(lockedUnit);
                        storageUnitLockService.releaseLock(unitId);
                        released = true;
                        unitsReleasedCount++;
                    }
                }
            }

            bookingRepository.save(booking);
            cancelledCount++;

            UUID facilityId = (unit != null && unit.getFacility() != null) ? unit.getFacility().getId() : null;
            String reason = String.format("Quá hạn thanh toán %d phút (Tạo lúc: %s, Ngày bắt đầu: %s)",
                    timeout, booking.getCreatedAt(), booking.getStartDate());

            activityLogService.recordSystem(
                    facilityId,
                    ActivityAction.RESERVATION_EXPIRE,
                    "Booking",
                    booking.getId(),
                    String.format("[AUTO-CANCEL] Tự động hủy đơn đặt kho %s do %s. Đã giải phóng kho.",
                            booking.getBookingCode(), reason)
            );

            detailList.add(AutoCancelDetail.builder()
                    .bookingId(booking.getId())
                    .bookingCode(booking.getBookingCode())
                    .customerEmail(booking.getCustomer() != null ? booking.getCustomer().getEmail() : null)
                    .unitCode(unit != null ? unit.getUnitCode() : null)
                    .createdAt(booking.getCreatedAt())
                    .reason(reason)
                    .build());
        }

        return AutoCancelResult.builder()
                .executedAt(LocalDateTime.now())
                .scannedCount(expiredBookings.size())
                .cancelledCount(cancelledCount)
                .unitsReleasedCount(unitsReleasedCount)
                .cancelledBookings(detailList)
                .build();
    }

    private void validateBookingForCancellation(Booking booking) {
        if (booking.getStatus() == BookingStatus.CANCELLED) {
            throw new AppException(ErrorCode.BOOKING_ALREADY_CANCELLED);
        }
        if (booking.getStatus() == BookingStatus.COMPLETED) {
            throw new AppException(ErrorCode.BOOKING_ALREADY_COMPLETED);
        }
        // Đơn đang ACTIVE hoặc đã check-in không được hủy trực tiếp mà phải qua quy trình thanh lý trả kho
        if (booking.getStatus() == BookingStatus.ACTIVE
                || (booking.getId() != null && handoverRecordRepository.existsByBooking_IdAndRecordType(booking.getId(), "CHECK_IN"))) {
            throw new AppException(ErrorCode.BOOKING_CANNOT_BE_CANCELLED,
                    "Đơn kho đã nhận bàn giao kho (ACTIVE / CHECK_IN). Vui lòng thực hiện thủ tục trả kho thay vì hủy đơn.");
        }
        List<BookingStatus> cancellableStatuses = List.of(
                BookingStatus.CONFIRMED,
                BookingStatus.PENDING_PAYMENT,
                BookingStatus.PENDING_APPROVAL,
                BookingStatus.PENDING_CONTACT,
                BookingStatus.PENDING_SIGNATURE,
                BookingStatus.SIGNED_PENDING_PAYMENT,
                BookingStatus.PAID_PENDING_ASSIGNMENT,
                BookingStatus.PAID_AND_SIGNED,
                BookingStatus.READY_FOR_CHECKIN
        );
        if (!cancellableStatuses.contains(booking.getStatus())) {
            throw new AppException(ErrorCode.BOOKING_CANNOT_BE_CANCELLED);
        }
    }

    private FacilityPolicy getFacilityPolicy(Booking booking) {
        if (booking.getStorageUnit() != null && booking.getStorageUnit().getFacility() != null) {
            return facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(booking.getStorageUnit().getFacility().getId())
                    .orElse(null);
        }
        if (booking.getFacility() != null) {
            return facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(booking.getFacility().getId())
                    .orElse(null);
        }
        return null;
    }

    /**
     * Xác định mốc thời gian nhận kho có hiệu lực:
     * 1. Ưu tiên expectedCheckInAt nếu khách đã đặt lịch hẹn nhận kho.
     * 2. Nếu không có lịch hẹn, lấy ngày startDate kết hợp với giờ mở cửa của cơ sở (hoặc mặc định 08:00 sáng).
     */
    private LocalDateTime resolveEffectiveCheckInDateTime(Booking booking) {
        if (booking.getExpectedCheckInAt() != null) {
            return booking.getExpectedCheckInAt();
        }

        if (booking.getStartDate() != null) {
            LocalTime openTime = LocalTime.of(8, 0);
            if (booking.getStorageUnit() != null
                    && booking.getStorageUnit().getFacility() != null
                    && booking.getStorageUnit().getFacility().getOpenTime() != null) {
                openTime = booking.getStorageUnit().getFacility().getOpenTime();
            }
            return booking.getStartDate().atTime(openTime);
        }

        // Fallback an toàn nếu thiếu cả startDate: lấy ngày tạo đơn cộng 1 ngày lúc 08:00
        return LocalDateTime.now().plusDays(1).withHour(8).withMinute(0).withSecond(0);
    }

    /**
     * Định dạng thời gian còn lại nhẹ nhàng, không gây áp lực theo tiêu chuẩn UX Boxora.
     */
    private String formatCalmRemainingTime(Duration duration, long hoursUntilCheckin) {
        if (duration.isNegative() || hoursUntilCheckin < 0) {
            return "Đã qua lịch hẹn nhận kho";
        }
        if (hoursUntilCheckin < 24) {
            return "Lịch hẹn còn dưới 24 giờ";
        }
        long days = duration.toDays();
        long remainingHours = duration.toHours() % 24;
        if (remainingHours > 0) {
            return String.format("Còn khoảng %d ngày %d giờ đến lịch hẹn nhận kho", days, remainingHours);
        } else {
            return String.format("Còn khoảng %d ngày đến lịch hẹn nhận kho", days);
        }
    }
}

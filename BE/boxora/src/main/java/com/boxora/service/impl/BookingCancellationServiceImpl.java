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
     * Xem trước thông tin hoàn tiền theo chính sách 3 mốc tính từ thời gian đặt kho:
     * - Mốc 1 (trong vòng <= 24h kể từ khi đặt kho): Hoàn 100% tiền cọc
     * - Mốc 2 (trong khoảng 24h - 48h kể từ khi đặt kho): Hoàn 70% tiền cọc (khấu trừ 30% phí giữ chỗ)
     * - Mốc 3 (quá > 48h kể từ khi đặt kho): Hoàn 50% tiền cọc (khấu trừ 50% chi phí cam kết giữ chỗ)
     */
    @Override
    @Transactional(readOnly = true)
    public BookingCancellationPreviewResponse previewCancellationRefund(UUID bookingId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        validateBookingForCancellation(booking);

        FacilityPolicy policy = getFacilityPolicy(booking);
        int fullRefundHours = (policy != null && policy.getCancellationFullRefundHours() != null)
                ? policy.getCancellationFullRefundHours() : 24;
        int partialRefundHours = (policy != null && policy.getCancellationPartialRefundHours() != null)
                ? policy.getCancellationPartialRefundHours() : 48;
        double partialRefundPercent = (policy != null && policy.getCancellationPartialRefundPercent() != null)
                ? policy.getCancellationPartialRefundPercent() : 70.0;

        String unitCode = booking.getStorageUnit() != null ? booking.getStorageUnit().getUnitCode() : null;
        BigDecimal depositPaid = booking.getDepositPaid() != null ? booking.getDepositPaid() : BigDecimal.ZERO;
        BigDecimal totalRentalFee = booking.getTotalRentalFee() != null ? booking.getTotalRentalFee() : BigDecimal.ZERO;

        LocalDateTime checkinDateTime = resolveEffectiveCheckInDateTime(booking);
        LocalDateTime now = LocalDateTime.now();
        Duration durationUntilCheckin = Duration.between(now, checkinDateTime);
        long hoursUntilCheckin = durationUntilCheckin.toHours();

        // Căn cứ tính chính sách hủy đặt kho: thời gian kể từ khi đặt kho (booking.getCreatedAt())
        LocalDateTime bookingCreatedAt = booking.getCreatedAt() != null ? booking.getCreatedAt() : now;
        Duration durationSinceBooking = Duration.between(bookingCreatedAt, now);
        long hoursSinceBooking = Math.max(0, durationSinceBooking.toHours());
        String timeRemainingLabel = formatBookingCancellationTimeLabel(durationSinceBooking, hoursSinceBooking, fullRefundHours, partialRefundHours);

        // Nếu booking chưa thanh toán cọc trực tuyến (depositPaid == 0) hoặc ở trạng thái PENDING_CONTACT / PENDING_PAYMENT / IN_PERSON:
        boolean hasPaidDeposit = depositPaid != null && depositPaid.compareTo(BigDecimal.ZERO) > 0;
        boolean isUnpaidMethod = !hasPaidDeposit
                || booking.getStatus() == BookingStatus.PENDING_PAYMENT
                || booking.getStatus() == BookingStatus.PENDING_APPROVAL
                || booking.getStatus() == BookingStatus.PENDING_CONTACT
                || booking.getStatus() == BookingStatus.PENDING_SIGNATURE
                || (booking.getSigningMethod() != null && booking.getSigningMethod().equalsIgnoreCase("IN_PERSON"));

        if (isUnpaidMethod) {
            return BookingCancellationPreviewResponse.builder()
                    .bookingId(booking.getId())
                    .bookingCode(booking.getBookingCode())
                    .unitCode(unitCode)
                    .startDate(booking.getStartDate())
                    .bookingDateTime(bookingCreatedAt)
                    .checkInDateTime(checkinDateTime)
                    .depositPaid(BigDecimal.ZERO)
                    .totalRentalFee(totalRentalFee)
                    .hoursUntilCheckin(hoursUntilCheckin)
                    .hoursSinceBooking(hoursSinceBooking)
                    .timeRemainingLabel(timeRemainingLabel)
                    .milestoneStage("STAGE_PENDING_NO_PAYMENT")
                    .refundPercentage(0.0)
                    .refundAmount(BigDecimal.ZERO)
                    .penaltyAmount(BigDecimal.ZERO)
                    .policyDescription("Đơn đặt giữ chỗ trả sau tại cơ sở (0 ₫ hôm nay). Hủy đơn không phát sinh chi phí và không có hoàn cọc.")
                    .refundable(false)
                    .build();
        }

        String milestoneStage;
        double refundPercentage;
        BigDecimal refundAmount;
        BigDecimal penaltyAmount;
        String policyDescription;

        BigDecimal depositRefund;
        if (hoursSinceBooking <= fullRefundHours) {
            // MỐC 1: Trong vòng 24h kể từ thời gian đặt kho -> Hoàn 100% tiền cọc
            milestoneStage = "STAGE_1_FULL_REFUND";
            refundPercentage = 100.0;
            depositRefund = depositPaid;
            penaltyAmount = BigDecimal.ZERO;
            policyDescription = String.format("Mốc 1: Hủy trong vòng %d giờ kể từ thời gian đặt kho. Hoàn 100%% tiền cọc và 100%% tiền thuê kho đã thanh toán.", fullRefundHours);
        } else if (hoursSinceBooking <= partialRefundHours) {
            // MỐC 2: Từ 24h đến 48h kể từ thời gian đặt kho -> Hoàn 70% tiền cọc
            milestoneStage = "STAGE_2_PARTIAL_REFUND";
            refundPercentage = partialRefundPercent;
            depositRefund = depositPaid.multiply(BigDecimal.valueOf(partialRefundPercent / 100.0))
                    .setScale(2, RoundingMode.HALF_UP);
            penaltyAmount = depositPaid.subtract(depositRefund);
            policyDescription = String.format("Mốc 2: Hủy trong khoảng từ %d đến %d giờ kể từ thời gian đặt kho. Hoàn %.0f%% tiền cọc (khấu trừ %.0f%%) và 100%% tiền thuê kho.",
                    fullRefundHours, partialRefundHours, partialRefundPercent, 100.0 - partialRefundPercent);
        } else {
            // MỐC 3: Quá 48h kể từ thời gian đặt kho -> Hoàn 50% tiền cọc
            milestoneStage = "STAGE_3_OVER_48H_REFUND";
            refundPercentage = 50.0;
            depositRefund = depositPaid.multiply(BigDecimal.valueOf(50.0 / 100.0))
                    .setScale(2, RoundingMode.HALF_UP);
            penaltyAmount = depositPaid.subtract(depositRefund);
            policyDescription = String.format("Mốc 3: Hủy quá %d giờ kể từ thời gian đặt kho. Hoàn 50%% tiền cọc (khấu trừ 50%%) và 100%% tiền thuê kho.",
                    partialRefundHours);
        }

        // Tổng tiền hoàn trả = 100% tiền thuê kho (do chưa nhận kho) + tiền cọc hoàn trả theo mốc
        refundAmount = depositRefund.add(totalRentalFee);

        boolean refundable = refundAmount.compareTo(BigDecimal.ZERO) > 0;

        return BookingCancellationPreviewResponse.builder()
                .bookingId(booking.getId())
                .bookingCode(booking.getBookingCode())
                .unitCode(unitCode)
                .startDate(booking.getStartDate())
                .bookingDateTime(bookingCreatedAt)
                .checkInDateTime(checkinDateTime)
                .depositPaid(depositPaid)
                .totalRentalFee(totalRentalFee)
                .hoursUntilCheckin(hoursUntilCheckin)
                .hoursSinceBooking(hoursSinceBooking)
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

        booking.setCancellationReason(reason);
        booking.setCancelledBy(cancelledByUser);
        booking.setCancelledAt(cancelNow);

        boolean hasRefund = (preview.getRefundAmount() != null && preview.getRefundAmount().compareTo(BigDecimal.ZERO) > 0)
                || (request != null && request.getBankAccountNumber() != null && !request.getBankAccountNumber().isBlank());

        boolean unitReleased = false;
        StorageUnit unit = booking.getStorageUnit();
        RentalContract linkedContract = rentalContractRepository.findByBookingId(booking.getId()).orElse(null);

        if (hasRefund) {
            // Khi gửi yêu cầu hủy đơn và hoàn cọc: KHÔNG chuyển trạng thái hợp đồng và booking sang CANCELLED ngay.
            // Đơn chuyển paymentStatus sang "REFUND_PENDING" để chờ Quản lý cơ sở đối soát và chi trả.
            // Chỉ khi Quản lý cơ sở thực hiện chuyển tiền thành công thì mới chuyển booking và hợp đồng sang CANCELLED.
            booking.setPaymentStatus("REFUND_PENDING");
        } else {
            booking.setStatus(BookingStatus.CANCELLED);
            booking.setAccessPin(null); // Thu hồi PIN
            booking.setQrAccessToken("REVOKED_CANCELLED"); // Thu hồi QR token

            if (unit != null) {
                unit.setStatus(UnitStatus.AVAILABLE);
                storageUnitRepository.save(unit);
                storageUnitLockService.releaseLock(unit.getId());
                unitReleased = true;
            }

            if (linkedContract != null) {
                if (linkedContract.getStatus() == RentalContractStatus.PENDING_SIGNATURE
                        || linkedContract.getStatus() == RentalContractStatus.PENDING_ACTIVATION) {
                    linkedContract.setStatus(RentalContractStatus.CANCELLED);
                    rentalContractRepository.save(linkedContract);
                }
            }
        }

        // Nếu có hoàn tiền cọc (refundAmount > 0), khởi tạo RefundRequest chính thức thay vì ghi nhận thanh toán giả
        UUID refundRequestId = null;
        String refundRequestCode = null;
        if ((preview.getRefundAmount() != null && preview.getRefundAmount().compareTo(BigDecimal.ZERO) > 0)
                || (request != null && request.getBankAccountNumber() != null && !request.getBankAccountNumber().isBlank())) {
            Facility facility = (unit != null) ? unit.getFacility() : null;
            if (facility == null && linkedContract != null) {
                facility = linkedContract.getFacility();
            }
            if (facility == null) {
                facility = booking.getFacility();
            }

            String bankName = (request != null && request.getBankName() != null && !request.getBankName().isBlank())
                    ? request.getBankName().trim() : "CHO_CAP_NHAT";
            String bankAccountNumber = (request != null && request.getBankAccountNumber() != null && !request.getBankAccountNumber().isBlank())
                    ? request.getBankAccountNumber().trim() : "CHO_CAP_NHAT";
            String bankAccountName = (request != null && request.getBankAccountName() != null && !request.getBankAccountName().isBlank())
                    ? request.getBankAccountName().trim()
                    : (booking.getCustomer() != null && booking.getCustomer().getFullName() != null
                    ? booking.getCustomer().getFullName() : "KHACH_HANG");

            BigDecimal finalRefund = preview.getRefundAmount() != null ? preview.getRefundAmount() : BigDecimal.ZERO;
            BigDecimal penalty = preview.getPenaltyAmount() != null ? preview.getPenaltyAmount() : BigDecimal.ZERO;
            BigDecimal rentPaid = booking.getTotalRentalFee() != null ? booking.getTotalRentalFee() : BigDecimal.ZERO;
            BigDecimal depPaid = booking.getDepositPaid() != null ? booking.getDepositPaid() : BigDecimal.ZERO;
            BigDecimal requested = depPaid.add(rentPaid);
            if (requested.compareTo(BigDecimal.ZERO) <= 0) {
                requested = finalRefund;
            }

            refundRequestCode = "REF-" + System.currentTimeMillis() + "-" + VNPayUtil.randomAlphaNumeric(4).toUpperCase();
            RefundRequest refundRequest = RefundRequest.builder()
                    .requestCode(refundRequestCode)
                    .customer(booking.getCustomer())
                    .facility(facility)
                    .booking(booking)
                    .contract(linkedContract)
                    .requestedAmount(requested)
                    .deductionAmount(penalty)
                    .finalRefundAmount(finalRefund)
                    .bankName(bankName)
                    .bankAccountNumber(bankAccountNumber)
                    .bankAccountName(bankAccountName)
                    .reason(String.format("Hoàn tiền khi hủy đơn %s. Tiền thuê hoàn: %s đ, Cọc: %s đ (Khấu trừ: %s đ). Lý do: %s",
                            booking.getBookingCode(), rentPaid, depPaid.subtract(penalty), penalty, reason))
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
                hasRefund ? ActivityAction.REFUND_REQUEST_CREATE : ActivityAction.RESERVATION_CANCEL,
                "Booking",
                booking.getId(),
                String.format("Yêu cầu hủy đơn đặt kho %s theo %s. Hoàn cọc: %s VNĐ, Phạt giữ chỗ: %s VNĐ. Lý do: %s",
                        booking.getBookingCode(), preview.getMilestoneStage(), preview.getRefundAmount(), preview.getPenaltyAmount(), reason),
                oldStatus,
                booking.getStatus()
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
        } else if (booking.getUnitType() != null) {
            activityLogService.record(
                    facilityId,
                    ActivityAction.STORAGE_UNIT_RELEASE,
                    "Booking",
                    booking.getId(),
                    String.format("Giải phóng 1 suất kho %s về kho khả dụng do đơn đặt kho %s bị hủy",
                            booking.getUnitType().getTypeName(), booking.getBookingCode()),
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
                .status(booking.getStatus())
                .milestoneStage(preview.getMilestoneStage())
                .refundPercentage(preview.getRefundPercentage())
                .refundAmount(preview.getRefundAmount())
                .penaltyAmount(preview.getPenaltyAmount())
                .refundRequestId(refundRequestId)
                .refundRequestCode(refundRequestCode)
                .unitReleased(unitReleased || booking.getUnitType() != null)
                .cancelledAt(cancelNow)
                .cancellationReason(reason)
                .message(refundRequestId != null ? "Đã gửi yêu cầu hủy đơn và hoàn tiền cọc (" + refundRequestCode + ") đến Quản lý cơ sở để xử lý hoàn tiền." : ("Đã hủy đơn đặt giữ chỗ thành công. " + (preview.getPolicyDescription() != null ? preview.getPolicyDescription() : "")))
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

    @Override
    @Transactional
    public BookingCancelResponse revokeCancellation(UUID bookingId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        List<RefundRequest> refunds = refundRequestRepository.findByBookingId(booking.getId());
        for (RefundRequest refund : refunds) {
            if (refund.getStatus() == RefundStatus.PROCESSED
                    || refund.getStatus() == RefundStatus.COMPLETED
                    || refund.getStatus() == RefundStatus.RECONCILED
                    || refund.getStatus() == RefundStatus.AWAITING_CUSTOMER_CONFIRMATION
                    || refund.getStatus() == RefundStatus.PROCESSING_TRANSFER) {
                throw new AppException(ErrorCode.BOOKING_REFUND_ALREADY_PROCESSED);
            }
        }

        boolean isCancellationPending = booking.getStatus() == BookingStatus.CANCELLED
                || "REFUND_PENDING".equalsIgnoreCase(booking.getPaymentStatus())
                || !refunds.isEmpty();

        if (!isCancellationPending) {
            throw new AppException(ErrorCode.BOOKING_CANNOT_REVOKE_CANCEL);
        }

        UUID currentUserId = requestContext.currentUserId();
        String currentRole = requestContext.currentUserRole();
        if ("CUSTOMER".equalsIgnoreCase(currentRole) && booking.getCustomer() != null
                && currentUserId != null && !booking.getCustomer().getId().equals(currentUserId)) {
            throw new AppException(ErrorCode.FORBIDDEN);
        }

        if (!refunds.isEmpty()) {
            refundRequestRepository.deleteAll(refunds);
        }

        BookingStatus oldStatus = booking.getStatus();
        StorageUnit unit = booking.getStorageUnit();
        boolean unitReassigned = false;

        if (booking.getStatus() == BookingStatus.CANCELLED) {
            if (unit != null) {
                if (unit.getStatus() == UnitStatus.AVAILABLE) {
                    unit.setStatus(UnitStatus.RESERVED);
                    storageUnitRepository.save(unit);
                    booking.setStatus(BookingStatus.CONFIRMED);
                    unitReassigned = true;
                } else {
                    booking.setStorageUnit(null);
                    booking.setStatus(BookingStatus.PAID_PENDING_ASSIGNMENT);
                }
            } else {
                boolean hasDeposit = booking.getDepositPaid() != null && booking.getDepositPaid().compareTo(BigDecimal.ZERO) > 0;
                if (hasDeposit || "PAID".equalsIgnoreCase(booking.getPaymentStatus())) {
                    booking.setStatus(BookingStatus.PAID_AND_SIGNED);
                } else {
                    booking.setStatus(BookingStatus.PENDING_CONTACT);
                }
            }
        }

        booking.setCancellationReason(null);
        booking.setCancelledAt(null);
        booking.setCancelledBy(null);
        if ("REVOKED_CANCELLED".equals(booking.getQrAccessToken()) || booking.getQrAccessToken() == null) {
            booking.setQrAccessToken(UUID.randomUUID().toString());
        }
        if ("REFUND_PENDING".equalsIgnoreCase(booking.getPaymentStatus())) {
            booking.setPaymentStatus("PAID");
        }
        bookingRepository.save(booking);

        RentalContract linkedContract = rentalContractRepository.findByBookingId(booking.getId()).orElse(null);
        if (linkedContract != null && linkedContract.getStatus() == RentalContractStatus.CANCELLED) {
            linkedContract.setStatus(RentalContractStatus.PENDING_ACTIVATION);
            rentalContractRepository.save(linkedContract);
        }

        UUID facilityId = (unit != null && unit.getFacility() != null)
                ? unit.getFacility().getId()
                : (booking.getFacility() != null ? booking.getFacility().getId() : null);

        activityLogService.record(
                facilityId,
                ActivityAction.RESERVATION_UPDATE,
                "Booking",
                booking.getId(),
                String.format("Khách hàng đã hủy yêu cầu trả kho / rút lại đơn hủy cho mã đặt chỗ %s. Trạng thái đã khôi phục về %s.",
                        booking.getBookingCode(), booking.getStatus()),
                oldStatus,
                booking.getStatus()
        );

        return BookingCancelResponse.builder()
                .bookingId(booking.getId())
                .bookingCode(booking.getBookingCode())
                .status(booking.getStatus())
                .milestoneStage("REVOKED")
                .refundPercentage(0.0)
                .refundAmount(BigDecimal.ZERO)
                .penaltyAmount(BigDecimal.ZERO)
                .unitReleased(!unitReassigned)
                .cancelledAt(null)
                .cancellationReason(null)
                .message("Đã hủy yêu cầu trả kho thành công! Đơn đặt chỗ đã được khôi phục.")
                .build();
    }

    @Override
    @Transactional
    public BookingCancelResponse revokeCancellationByCode(String bookingCode) {
        if (bookingCode == null || bookingCode.isBlank()) {
            throw new AppException(ErrorCode.BOOKING_NOT_FOUND);
        }
        Booking booking = bookingRepository.findByBookingCodeForUpdate(bookingCode.trim())
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));
        return revokeCancellation(booking.getId());
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
        if ("REFUND_PENDING".equalsIgnoreCase(booking.getPaymentStatus())) {
            throw new AppException(ErrorCode.BOOKING_CANNOT_BE_CANCELLED,
                    "Đơn đặt kho đang có yêu cầu hoàn tiền chờ Quản lý cơ sở xử lý. Quý khách có thể hủy yêu cầu hoàn cọc nếu muốn giữ lại đơn.");
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
     * Định dạng nhãn thời gian tính từ khi đặt kho phục vụ hiển thị chính sách hủy:
     */
    private String formatBookingCancellationTimeLabel(Duration durationSinceBooking, long hoursSinceBooking, int fullRefundHours, int partialRefundHours) {
        if (hoursSinceBooking < 1) {
            long minutes = Math.max(1, durationSinceBooking.toMinutes());
            return String.format("Đã đặt kho %d phút trước (Trong khung %dh đầu - Hoàn 100%% cọc)", minutes, fullRefundHours);
        }
        if (hoursSinceBooking <= fullRefundHours) {
            return String.format("Đã đặt kho %d giờ (Trong khung %dh đầu - Hoàn 100%% cọc)", hoursSinceBooking, fullRefundHours);
        }
        if (hoursSinceBooking <= partialRefundHours) {
            return String.format("Đã đặt kho %d giờ (Khung %dh - %dh - Hoàn 70%% cọc)", hoursSinceBooking, fullRefundHours, partialRefundHours);
        }
        long days = durationSinceBooking.toDays();
        long remainingHours = hoursSinceBooking % 24;
        if (days >= 1) {
            return String.format("Đã đặt kho %d ngày %d giờ (Quá %dh - Hoàn 50%% cọc)", days, remainingHours, partialRefundHours);
        }
        return String.format("Đã đặt kho %d giờ (Quá %dh - Hoàn 50%% cọc)", hoursSinceBooking, partialRefundHours);
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

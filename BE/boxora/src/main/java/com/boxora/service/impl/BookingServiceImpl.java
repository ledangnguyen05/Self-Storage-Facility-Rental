package com.boxora.service.impl;

import com.boxora.dto.request.BookingCreateRequest;
import com.boxora.dto.request.UpdatePinRequest;
import com.boxora.dto.response.BookingAccessCredentialsResponse;
import com.boxora.dto.response.BookingPinResponse;
import com.boxora.dto.response.BookingResponse;
import com.boxora.entity.Booking;
import com.boxora.entity.FacilityPolicy;
import com.boxora.entity.StorageUnit;
import com.boxora.entity.User;
import com.boxora.enums.ActivityAction;
import com.boxora.enums.BookingStatus;
import com.boxora.enums.FacilityStatus;
import com.boxora.enums.RefundStatus;
import com.boxora.enums.UnitStatus;
import com.boxora.enums.PaymentStatus;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.repository.BookingRepository;
import com.boxora.repository.FacilityPolicyRepository;
import com.boxora.repository.PaymentRepository;
import com.boxora.repository.StorageUnitRepository;
import com.boxora.repository.UserRepository;
import com.boxora.security.FacilityAccessGuard;
import com.boxora.security.RequestContext;
import com.boxora.service.ActivityLogService;
import com.boxora.service.BookingService;
import com.boxora.service.EncryptionService;
import com.boxora.service.PricingService;
import com.boxora.service.StorageUnitLockService;
import com.boxora.dto.request.BookingRescheduleRequest;
import com.boxora.dto.response.BookingRescheduleEligibilityResponse;
import com.boxora.dto.response.BookingRescheduleHistoryResponse;
import com.boxora.dto.response.BookingRescheduleResponse;
import com.boxora.entity.BookingRescheduleHistory;
import com.boxora.entity.Facility;
import com.boxora.entity.RentalContract;
import com.boxora.enums.RentalContractStatus;
import com.boxora.repository.BookingRescheduleHistoryRepository;
import com.boxora.repository.RentalContractRepository;
import com.boxora.common.response.PageResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class BookingServiceImpl implements BookingService {

    private final BookingRepository bookingRepository;
    private final StorageUnitRepository storageUnitRepository;
    private final UserRepository userRepository;
    private final FacilityPolicyRepository facilityPolicyRepository;
    private final StorageUnitLockService storageUnitLockService;
    private final ActivityLogService activityLogService;
    private final PaymentRepository paymentRepository;
    private final FacilityAccessGuard facilityAccessGuard;
    private final EncryptionService encryptionService;
    private final PricingService pricingService;
    private final RequestContext requestContext;
    private final org.springframework.beans.factory.ObjectProvider<com.boxora.service.ContractSigningService> contractSigningServiceProvider;
    private final BookingRescheduleHistoryRepository bookingRescheduleHistoryRepository;
    private final RentalContractRepository rentalContractRepository;
    private final com.boxora.repository.RefundRequestRepository refundRequestRepository;

    @Value("${app.booking.soft-lock-hours:24}")
    private long softLockHours;

    @Value("${app.booking.max-advance-days:30}")
    private int maxAdvanceDays;

    @Value("${app.booking.approval-timeout-hours:24}")
    private long approvalTimeoutHours;

    @Value("${app.booking.payment-timeout-minutes:15}")
    private int paymentTimeoutMinutes;

    @Override
    public BookingResponse createBooking(BookingCreateRequest request) {
        // 1. Khóa và kiểm tra nguyên tử bản ghi kho trong database (Pessimistic Write Lock)
        StorageUnit unit = storageUnitRepository.findWithDetailsByIdForUpdate(request.getStorageUnitId())
                .orElseThrow(() -> new AppException(ErrorCode.STORAGE_UNIT_NOT_FOUND));

        String currentRole = requestContext != null ? requestContext.currentUserRole() : null;
        boolean isStaffOrAdmin = isStaffRole(currentRole);
        Facility unitFacility = unit.getFacility();
        // Staff / facility managers may only book units of the facility they are assigned to.
        if (isStaffOrAdmin && unitFacility != null) {
            facilityAccessGuard.checkFacilityAccess(unitFacility.getId());
        }
        // A facility under maintenance or closed takes no new reservations, whoever creates them.
        if (unitFacility != null && unitFacility.getStatus() != null && unitFacility.getStatus() != FacilityStatus.ACTIVE) {
            throw new AppException(ErrorCode.BOOKING_FACILITY_NOT_OPERATING);
        }

        if (unit.getStatus() != UnitStatus.AVAILABLE) {
            log.warn("[UNIT_LOCK] Storage unit {} status is {}, not AVAILABLE", unit.getUnitCode(), unit.getStatus());
            throw new AppException(ErrorCode.STORAGE_UNIT_NOT_AVAILABLE);
        }

        // 2. Kiểm tra không có reservation/hợp đồng nào còn hiệu lực đang chiếm kho
        boolean alreadyOccupied = bookingRepository.existsByStorageUnit_IdAndStatusIn(
                unit.getId(),
                List.of(BookingStatus.ACTIVE, BookingStatus.CONFIRMED, BookingStatus.PENDING_PAYMENT, BookingStatus.PENDING_APPROVAL)
        );
        if (alreadyOccupied) {
            log.warn("[UNIT_LOCK] Storage unit {} already has an active reservation in DB", unit.getUnitCode());
            throw new AppException(ErrorCode.STORAGE_UNIT_NOT_AVAILABLE);
        }

        // 3. Kiểm tra Soft-lock trong Redis (tối ưu hóa - bắt lỗi an toàn nếu Redis không phản hồi)
        try {
            if (storageUnitLockService.isUnitLocked(unit.getId())) {
                log.warn("[SOFT_LOCK] Storage unit {} is already locked in Redis", unit.getId());
                throw new AppException(ErrorCode.STORAGE_UNIT_SOFT_LOCKED);
            }
        } catch (AppException e) {
            throw e;
        } catch (Exception e) {
            log.warn("[REDIS_OPTIMIZATION_BYPASS] Redis lock check error for unit {}: {}. Proceeding with authoritative DB pessimistic lock.",
                    unit.getId(), e.getMessage());
        }

        // 4. Validation ngày bắt đầu (< 30 ngày so với hôm nay và >= hôm nay)
        LocalDate startDate = request.getStartDate() != null ? request.getStartDate() : LocalDate.now();
        LocalDate today = LocalDate.now();

        if (startDate.isBefore(today)) {
            throw new AppException(ErrorCode.BOOKING_START_DATE_PAST);
        }

        if (startDate.isAfter(today.plusDays(maxAdvanceDays))) {
            throw new AppException(ErrorCode.BOOKING_ADVANCE_NOTICE_EXCEEDED);
        }

        // 5. Validation thời gian thuê (rentalMonths >= 1 và tuân theo chính sách cơ sở)
        int months = request.getRentalMonths() != null ? request.getRentalMonths() : 1;
        if (months < 1) {
            throw new AppException(ErrorCode.BOOKING_MINIMUM_DURATION_INVALID);
        }

        FacilityPolicy activePolicy = unit.getFacility() == null
                ? null
                : facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(unit.getFacility().getId()).orElse(null);
        if (activePolicy != null && activePolicy.getMinimumRentalMonths() != null
                && months < activePolicy.getMinimumRentalMonths()) {
            throw new AppException(ErrorCode.BOOKING_MINIMUM_DURATION_INVALID);
        }

        LocalDate endDate = startDate.plusMonths(months);

        // 6. Xác định khách hàng từ Context hoặc Request
        User customer;
        if (isStaffOrAdmin) {
            // Staff book on behalf of a customer: the booking must be in a real, active customer account.
            if (request.getCustomerId() == null) {
                throw new AppException(ErrorCode.BOOKING_CUSTOMER_REQUIRED);
            }
            customer = userRepository.findById(request.getCustomerId())
                    .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
            String customerRole = customer.getRole() != null ? customer.getRole().getName() : null;
            if (!"CUSTOMER".equalsIgnoreCase(customerRole)) {
                throw new AppException(ErrorCode.BOOKING_CUSTOMER_REQUIRED,
                        "Tài khoản được chọn không phải tài khoản khách hàng nên không thể đứng tên đơn đặt kho.");
            }
            if (Boolean.FALSE.equals(customer.getIsActive())) {
                throw new AppException(ErrorCode.USER_INACTIVE, "Tài khoản khách hàng đang bị khóa nên không thể đặt kho.");
            }
        } else if (requestContext != null && requestContext.currentUserId() != null) {
            customer = userRepository.findById(requestContext.currentUserId())
                    .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        } else if (request.getCustomerId() != null) {
            customer = userRepository.findById(request.getCustomerId())
                    .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        } else {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }

        // 7. Một nguồn tính giá duy nhất: Sử dụng PricingService (không nhận giá do client tự gửi)
        com.boxora.dto.request.PricingQuoteRequest quoteRequest = com.boxora.dto.request.PricingQuoteRequest.builder()
                .storageUnitId(unit.getId())
                .rentalMonths(months)
                .discountCode(request.getDiscountCode())
                .startDate(startDate)
                .build();
        com.boxora.dto.response.PricingQuoteResponse quote = pricingService.calculateQuote(quoteRequest);

        BigDecimal totalFee = quote.getTotalRentalFee();
        BigDecimal deposit = quote.getDepositAmount();

        // 8. Tạo mã đặt kho duy nhất (BX-<năm>-<6 ký tự>, kiểm tra trùng và thử lại)
        String code = generateBookingCode();

        // 9. Xác định ngày/giờ nhận kho dự kiến (expectedCheckInAt)
        LocalDateTime expectedCheckInAt = request.getExpectedCheckInAt();
        if (expectedCheckInAt == null) {
            if (request.getCheckInTime() != null && !request.getCheckInTime().isBlank()) {
                try {
                    String[] parts = request.getCheckInTime().trim().split(":");
                    int hour = Integer.parseInt(parts[0]);
                    int minute = parts.length > 1 ? Integer.parseInt(parts[1]) : 0;
                    expectedCheckInAt = startDate.atTime(hour, minute);
                } catch (Exception ex) {
                    expectedCheckInAt = startDate.atTime(14, 0);
                }
            } else {
                expectedCheckInAt = startDate.atTime(14, 0);
            }
        }

        // 10. Xác định chính sách giữ chỗ và thời hạn giữ chỗ (holdExpiresAt)
        int holdGraceHours = (activePolicy != null && activePolicy.getHoldGraceHours() != null)
                ? activePolicy.getHoldGraceHours()
                : 24;
        int policyMaxHoldDays = (activePolicy != null && activePolicy.getMaxHoldDays() != null)
                ? activePolicy.getMaxHoldDays()
                : maxAdvanceDays;

        // Two signing methods only: IN_PERSON (free hold, contract signed at the counter; "DIRECT" is a legacy alias)
        // and ONLINE (pay now through VNPay, sign electronically). A booking created by staff at the counter without
        // an explicit choice is a counter booking.
        String requestedMethod = request.getSigningMethod() != null ? request.getSigningMethod().trim() : "";
        boolean isDirect = "DIRECT".equalsIgnoreCase(requestedMethod) || "IN_PERSON".equalsIgnoreCase(requestedMethod)
                || (requestedMethod.isEmpty() && isStaffOrAdmin);
        BookingStatus initialStatus = isDirect ? BookingStatus.CONFIRMED : BookingStatus.PENDING_PAYMENT;
        String resolvedSigningMethod = isDirect ? "IN_PERSON" : "ONLINE";

        Instant now = Instant.now();
        Instant holdStartedAt = now;
        Instant holdExpiresAt;

        if (isDirect) {
            // Giữ chỗ miễn phí theo lịch hẹn: giữ đến giờ hẹn cộng khoảng gia hạn chính sách
            Instant appointmentInstant = expectedCheckInAt.atZone(java.time.ZoneId.systemDefault()).toInstant();
            holdExpiresAt = appointmentInstant.plus(java.time.Duration.ofHours(holdGraceHours));
            // Đảm bảo giữ tối thiểu 24h từ lúc tạo (đặc biệt khi khách đặt nhận trong ngày)
            if (holdExpiresAt.isBefore(now.plus(java.time.Duration.ofHours(24)))) {
                holdExpiresAt = now.plus(java.time.Duration.ofHours(24));
            }
            // Giới hạn tối đa theo chính sách cơ sở
            Instant maxHoldLimit = now.plus(java.time.Duration.ofDays(policyMaxHoldDays));
            if (holdExpiresAt.isAfter(maxHoldLimit)) {
                holdExpiresAt = maxHoldLimit;
            }
        } else {
            // Thanh toán ngay qua trực tuyến: hạn giữ chỗ theo timeout thanh toán
            long timeoutSec = (paymentTimeoutMinutes > 0 ? (long) paymentTimeoutMinutes * 60L : softLockHours * 3600L);
            holdExpiresAt = now.plusSeconds(timeoutSec);
        }

        Booking booking = Booking.builder()
                .bookingCode(code)
                .customer(customer)
                .storageUnit(unit)
                .startDate(startDate)
                .endDate(endDate)
                .rentalMonths(months)
                .totalRentalFee(totalFee)
                .depositPaid(BigDecimal.ZERO)
                .depositAmount(deposit)
                .holdStartedAt(holdStartedAt)
                .holdExpiresAt(holdExpiresAt)
                .expectedCheckInAt(expectedCheckInAt)
                .paymentStatus("UNPAID")
                .paymentExpiresAt(holdExpiresAt)
                .status(initialStatus)
                .signingMethod(resolvedSigningMethod)
                .accessPin(null) // Chưa cấp PIN trước khi bàn giao
                .qrAccessToken(null) // Chưa cấp QR trước khi bàn giao
                .build();

        // 11. Chuyển ngăn kho sang RESERVED để giữ chỗ mềm
        unit.setStatus(UnitStatus.RESERVED);
        storageUnitRepository.save(unit);

        booking = bookingRepository.save(booking);

        if (isDirect) {
            try {
                var contractService = contractSigningServiceProvider.getIfAvailable();
                if (contractService != null) {
                    contractService.ensureContractForBooking(booking);
                }
            } catch (Exception ex) {
                log.warn("Could not auto-ensure contract for direct booking {}: {}", booking.getBookingCode(), ex.getMessage());
            }
        }

        // 12. Thực hiện Soft-lock trên Redis cho ngăn kho theo thời hạn giữ chỗ
        long lockHours = Math.max(1, java.time.Duration.between(now, holdExpiresAt).toHours() + 1);
        try {
            storageUnitLockService.tryLockUnit(unit.getId(), booking.getId(), lockHours);
        } catch (Exception e) {
            log.warn("[REDIS_OPTIMIZATION_BYPASS] Redis lock acquisition error for unit {}: {}. Authoritative DB lock and RESERVED status are active.",
                    unit.getId(), e.getMessage());
        }

        // 13. Ghi Activity Log
        UUID facilityId = (unit.getFacility() != null) ? unit.getFacility().getId() : null;
        activityLogService.record(
                facilityId,
                ActivityAction.RESERVATION_CREATE,
                "Booking",
                booking.getId(),
                String.format("Tạo yêu cầu thuê kho %s thành công (%s). Dự kiến nhận kho: %s. Hạn chót giữ chỗ: %s.",
                        code, signingMethodLabel(resolvedSigningMethod), formatDateTime(expectedCheckInAt), formatInstant(holdExpiresAt)),
                null,
                booking.getStatus()
        );

        return mapToResponse(booking);
    }

    @Override
    @Transactional(readOnly = true)
    public List<BookingResponse> getMyBookingRequests() {
        UUID customerId = requestContext != null ? requestContext.currentUserId() : null;
        if (customerId == null) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }
        return bookingRepository.findByCustomer_Id(customerId).stream()
                .filter(booking -> booking.getStatus() == BookingStatus.PENDING_APPROVAL
                        || booking.getStatus() == BookingStatus.PENDING_PAYMENT
                        || booking.getStatus() == BookingStatus.CANCELLED)
                .sorted((left, right) -> right.getCreatedAt().compareTo(left.getCreatedAt()))
                .map(booking -> {
                    BookingResponse response = mapToResponse(booking);
                    response.setAccessPin(null);
                    response.setQrAccessToken(null);
                    return response;
                })
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<BookingResponse> getPendingApprovalRequests() {
        requireStaffRole();
        UUID scopedFacilityId = facilityAccessGuard.scopedFacilityIdOrNull();
        if (facilityAccessGuard.isFacilityScoped() && scopedFacilityId == null) {
            return List.of();
        }
        return bookingRepository.findByStatusOrderByCreatedAtAsc(BookingStatus.PENDING_APPROVAL).stream()
                .filter(booking -> scopedFacilityId == null
                        || (booking.getStorageUnit() != null
                        && booking.getStorageUnit().getFacility() != null
                        && scopedFacilityId.equals(booking.getStorageUnit().getFacility().getId())))
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Override
    public BookingResponse reviewBookingRequest(UUID id, boolean approved) {
        return reviewBookingRequest(id, approved, null, null);
    }

    @Override
    // The expiry branch cancels the request and then reports it: that cancellation must be kept. Every other
    // AppException of this method is thrown before anything is changed.
    @Transactional(noRollbackFor = AppException.class)
    public BookingResponse reviewBookingRequest(UUID id, boolean approved, UUID assignedStaffId, String notes) {
        requireStaffRole();
        Booking booking = bookingRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));
        if (booking.getStatus() != BookingStatus.PENDING_APPROVAL && booking.getStatus() != BookingStatus.CONFIRMED) {
            throw new AppException(ErrorCode.BOOKING_REQUEST_NOT_PENDING_APPROVAL);
        }
        // A confirmed (possibly paid) reservation is cancelled through the cancellation flow, which applies the refund
        // policy; "reject" only applies to requests that still wait for a decision.
        if (!approved && booking.getStatus() != BookingStatus.PENDING_APPROVAL) {
            throw new AppException(ErrorCode.BOOKING_REQUEST_NOT_PENDING_APPROVAL,
                    "Đơn đã được xác nhận nên không thể từ chối. Hãy dùng chức năng hủy đơn để áp dụng chính sách hoàn tiền.");
        }

        StorageUnit unit = booking.getStorageUnit();
        UUID facilityId = unit != null && unit.getFacility() != null ? unit.getFacility().getId() : null;
        if (facilityId != null) {
            facilityAccessGuard.checkFacilityAccess(facilityId);
        }
        if (approved && assignedStaffId != null) {
            validateReceivingStaff(assignedStaffId, facilityId);
        }

        Instant now = Instant.now();
        if (booking.getStatus() == BookingStatus.PENDING_APPROVAL && isApprovalRequestExpired(booking, now)) {
            booking.setStatus(BookingStatus.CANCELLED);
            booking.setPaymentExpiresAt(null);
            booking.setCancelledAt(LocalDateTime.now());
            booking.setCancellationReason("Yêu cầu thuê kho đã hết hạn trước khi được duyệt");
            cancelUnsignedContract(booking);
            if (unit != null) {
                unit.setStatus(UnitStatus.AVAILABLE);
                storageUnitRepository.save(unit);
                storageUnitLockService.releaseLock(unit.getId());
            }
            booking = bookingRepository.save(booking);
            activityLogService.record(
                    facilityId,
                    ActivityAction.RESERVATION_CANCEL,
                    "Booking",
                    booking.getId(),
                    String.format("Yêu cầu thuê kho %s đã hết hạn trước khi được duyệt; kho đã được giải phóng.", booking.getBookingCode()),
                    null,
                    booking.getStatus()
            );
            // Never answer 200 here: the caller asked to approve or reject and neither happened.
            throw new AppException(ErrorCode.BOOKING_REQUEST_EXPIRED, String.format(
                    "Yêu cầu thuê kho %s đã hết hạn và đã được hủy tự động, kho đã được mở lại cho khách khác.",
                    booking.getBookingCode()));
        }

        if (approved) {
            if (assignedStaffId != null) {
                booking.setHandedOverByStaffId(assignedStaffId);
            }
            if (notes != null && !notes.isBlank()) {
                booking.setStaffAssignmentNotes(notes);
            }

            if (booking.getStatus() == BookingStatus.CONFIRMED) {
                // Booking already confirmed via online payment; manager assigns staff and notes
            } else {
                boolean isInPerson = "IN_PERSON".equalsIgnoreCase(booking.getSigningMethod());
                if (isInPerson) {
                    // Khách chọn ký trực tiếp tại quầy khi tới xem kho
                    booking.setStatus(BookingStatus.CONFIRMED);
                    booking.setPaymentExpiresAt(null);
                    try {
                        var contractService = contractSigningServiceProvider.getIfAvailable();
                        if (contractService != null) {
                            contractService.ensureContractForBooking(booking);
                        }
                    } catch (Exception ex) {
                        log.warn("Notice: could not ensure contract for in-person booking {}: {}", booking.getBookingCode(), ex.getMessage());
                    }
                } else {
                    // Khách chọn ký online: chuyển sang chờ thanh toán trước tại sandbox VNPay
                    booking.setStatus(BookingStatus.PENDING_PAYMENT);
                    booking.setPaymentExpiresAt(Instant.now().plusSeconds(paymentTimeoutMinutes * 60L));
                }
            }
        } else {
            booking.setStatus(BookingStatus.CANCELLED);
            booking.setPaymentExpiresAt(null);
            booking.setCancelledAt(LocalDateTime.now());
            booking.setCancellationReason(notes != null && !notes.isBlank()
                    ? "Cơ sở từ chối yêu cầu thuê kho: " + notes.trim()
                    : "Cơ sở từ chối yêu cầu thuê kho");
            cancelUnsignedContract(booking);
            if (unit != null) {
                unit.setStatus(UnitStatus.AVAILABLE);
                storageUnitRepository.save(unit);
                storageUnitLockService.releaseLock(unit.getId());
            }
        }

        booking = bookingRepository.save(booking);
        activityLogService.record(
                facilityId,
                approved ? ActivityAction.RESERVATION_CREATE : ActivityAction.RESERVATION_CANCEL,
                "Booking",
                booking.getId(),
                approved
                        ? String.format("Yêu cầu thuê kho %s đã được duyệt (%s); phân công nhân sự chuẩn bị tiếp đón.",
                                booking.getBookingCode(),
                                "IN_PERSON".equalsIgnoreCase(booking.getSigningMethod()) ? "Ký trực tiếp tại quầy" : "Ký online qua DocuSeal")
                        : String.format("Yêu cầu thuê kho %s đã bị từ chối; kho đã được giải phóng.", booking.getBookingCode()),
                null,
                booking.getStatus()
        );
        return mapToResponse(booking);
    }

    @Override
    @Transactional
    public List<BookingResponse> getMyBookings(UUID customerId) {
        try {
            expireUnpaidBookings();
        } catch (Exception e) {
            log.warn("[AUTO_EXPIRE] Realtime hold expiration check caught error: {}", e.getMessage());
        }

        List<Booking> bookings = customerBookingsInScope(customerId);
        return bookings.stream()
                .sorted((b1, b2) -> {
                    if (b1.getCreatedAt() != null && b2.getCreatedAt() != null) {
                        return b2.getCreatedAt().compareTo(b1.getCreatedAt());
                    }
                    return 0;
                })
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<BookingResponse> getMyActiveBookings(UUID customerId) {
        List<Booking> bookings = customerBookingsInScope(customerId);
        return bookings.stream()
                .filter(b -> b.getStatus() == BookingStatus.CONFIRMED || b.getStatus() == BookingStatus.ACTIVE || b.getStatus() == BookingStatus.OVERDUE)
                .map(b -> {
                    BookingResponse resp = mapToResponse(b);
                    resp.setAccessPin(null);
                    resp.setQrAccessToken(null);
                    return resp;
                })
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<BookingResponse> getUpcomingArrivals() {
        requireStaffRole();
        UUID scopedFacilityId = facilityAccessGuard.scopedFacilityIdOrNull();
        List<Booking> list = bookingRepository.findAll().stream()
                .filter(b -> b.getStatus() == BookingStatus.CONFIRMED || b.getStatus() == BookingStatus.PENDING_PAYMENT)
                .filter(b -> scopedFacilityId == null || (b.getStorageUnit() != null && b.getStorageUnit().getFacility() != null && scopedFacilityId.equals(b.getStorageUnit().getFacility().getId())))
                .collect(Collectors.toList());
        return list.stream().map(this::mapToResponse).collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<BookingResponse> searchBookings(UUID customerId, UUID facilityId, String statusCsv, String q, int page, int size) {
        String role = requestContext != null ? requestContext.currentUserRole() : null;
        UUID currentUserId = requestContext != null ? requestContext.currentUserId() : null;
        if (currentUserId == null) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }

        UUID effectiveCustomerId = customerId;
        UUID effectiveFacilityId = facilityId;
        if ("CUSTOMER".equalsIgnoreCase(role)) {
            effectiveCustomerId = currentUserId;
        } else if (!isStaffRole(role)) {
            throw new AppException(ErrorCode.FORBIDDEN);
        } else if (facilityAccessGuard.isFacilityScoped()) {
            // STAFF / FACILITY_MANAGER: always their own facility, whatever facilityId the client sent.
            effectiveFacilityId = facilityAccessGuard.scopedFacilityIdOrNull();
        }

        List<BookingStatus> statuses = parseStatuses(statusCsv);
        String needle = q != null && !q.isBlank() ? "%" + q.trim().toLowerCase() + "%" : null;
        final UUID queryCustomerId = effectiveCustomerId;
        final UUID queryFacilityId = effectiveFacilityId;

        Specification<Booking> spec = (root, query, cb) -> {
            List<jakarta.persistence.criteria.Predicate> predicates = new ArrayList<>();
            jakarta.persistence.criteria.Join<Booking, StorageUnit> unitJoin = root.join("storageUnit", jakarta.persistence.criteria.JoinType.LEFT);
            jakarta.persistence.criteria.Join<Booking, User> customerJoin = root.join("customer", jakarta.persistence.criteria.JoinType.LEFT);
            if (queryCustomerId != null) {
                predicates.add(cb.equal(customerJoin.get("id"), queryCustomerId));
            }
            if (queryFacilityId != null) {
                predicates.add(cb.equal(unitJoin.get("facility").get("id"), queryFacilityId));
            }
            if (!statuses.isEmpty()) {
                predicates.add(root.get("status").in(statuses));
            }
            if (needle != null) {
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("bookingCode")), needle),
                        cb.like(cb.lower(unitJoin.get("unitCode")), needle),
                        cb.like(cb.lower(cb.coalesce(customerJoin.get("fullName"), "")), needle),
                        cb.like(cb.lower(cb.coalesce(customerJoin.get("phone"), "")), needle),
                        cb.like(cb.lower(cb.coalesce(customerJoin.get("email"), "")), needle)
                ));
            }
            return cb.and(predicates.toArray(new jakarta.persistence.criteria.Predicate[0]));
        };

        int safeSize = Math.min(Math.max(size, 1), 200);
        Pageable pageable = PageRequest.of(Math.max(page, 0), safeSize, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<Booking> result = bookingRepository.findAll(spec, pageable);
        Map<UUID, Optional<FacilityPolicy>> policyCache = new HashMap<>();
        return PageResponse.from(result.map(booking -> mapToResponse(booking, policyCache)));
    }

    private List<BookingStatus> parseStatuses(String statusCsv) {
        if (statusCsv == null || statusCsv.isBlank()) {
            return List.of();
        }
        List<BookingStatus> statuses = new ArrayList<>();
        for (String raw : statusCsv.split(",")) {
            String value = raw.trim();
            if (value.isEmpty()) {
                continue;
            }
            try {
                statuses.add(BookingStatus.valueOf(value.toUpperCase()));
            } catch (IllegalArgumentException ex) {
                throw new AppException(ErrorCode.BOOKING_STATUS_FILTER_INVALID, "Trạng thái lọc đơn đặt kho không hợp lệ: " + value);
            }
        }
        return statuses;
    }

    /**
     * Bookings of {@code customerId} (or of the caller when null). A customer only ever gets their own bookings;
     * STAFF / FACILITY_MANAGER asking for a customer only get the bookings of their assigned facility.
     */
    private List<Booking> customerBookingsInScope(UUID customerId) {
        UUID currentUserId = requestContext != null ? requestContext.currentUserId() : null;
        if (currentUserId == null) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }
        boolean otherCustomer = customerId != null && !currentUserId.equals(customerId);
        if (otherCustomer && !isStaffRole(requestContext.currentUserRole())) {
            throw new AppException(ErrorCode.FORBIDDEN);
        }
        List<Booking> bookings = bookingRepository.findByCustomer_Id(otherCustomer ? customerId : currentUserId);
        if (otherCustomer && facilityAccessGuard.isFacilityScoped()) {
            UUID scopedFacilityId = facilityAccessGuard.scopedFacilityIdOrNull();
            bookings = bookings.stream()
                    .filter(b -> b.getStorageUnit() != null && b.getStorageUnit().getFacility() != null
                            && scopedFacilityId.equals(b.getStorageUnit().getFacility().getId()))
                    .collect(Collectors.toList());
        }
        return bookings;
    }

    /** Operational booking lists (arrivals, approvals, decisions) are for staff roles only, never for customers. */
    private void requireStaffRole() {
        if (!isStaffRole(requestContext != null ? requestContext.currentUserRole() : null)) {
            throw new AppException(ErrorCode.FORBIDDEN);
        }
    }

    /**
     * Same rule as the auto-cancel job: a request waiting for approval expires at its deadline, or, without a deadline,
     * {@code app.booking.approval-timeout-hours} after it was sent, or once its start date has passed.
     */
    private boolean isApprovalRequestExpired(Booking booking, Instant now) {
        if (booking.getPaymentExpiresAt() != null) {
            return !booking.getPaymentExpiresAt().isAfter(now);
        }
        long timeoutHours = approvalTimeoutHours > 0 ? approvalTimeoutHours : 24;
        if (booking.getCreatedAt() != null && booking.getCreatedAt().isBefore(LocalDateTime.now().minusHours(timeoutHours))) {
            return true;
        }
        return booking.getStartDate() != null && booking.getStartDate().isBefore(LocalDate.now());
    }

    /** The receiving staff member must be an active STAFF account assigned to the booking's facility. */
    private void validateReceivingStaff(UUID staffId, UUID facilityId) {
        User staff = userRepository.findById(staffId)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_ASSIGNED_STAFF_INVALID,
                        "Không tìm thấy tài khoản nhân viên tiếp nhận đã chọn."));
        String role = staff.getRole() != null ? staff.getRole().getName() : null;
        if (!"STAFF".equalsIgnoreCase(role)) {
            throw new AppException(ErrorCode.BOOKING_ASSIGNED_STAFF_INVALID,
                    "Tài khoản được chọn không phải nhân viên vận hành nên không thể tiếp nhận khách.");
        }
        if (Boolean.FALSE.equals(staff.getIsActive())) {
            throw new AppException(ErrorCode.BOOKING_ASSIGNED_STAFF_INVALID,
                    "Tài khoản nhân viên được chọn đang bị khóa.");
        }
        UUID staffFacilityId = staff.getFacility() != null ? staff.getFacility().getId() : null;
        if (facilityId != null && !facilityId.equals(staffFacilityId)) {
            throw new AppException(ErrorCode.BOOKING_ASSIGNED_STAFF_INVALID,
                    "Nhân viên được chọn không làm việc tại cơ sở của đơn đặt kho này.");
        }
    }

    private static final DateTimeFormatter DATE_TIME_VN = DateTimeFormatter.ofPattern("HH:mm dd/MM/yyyy");

    private static String formatDateTime(LocalDateTime value) {
        return value != null ? value.format(DATE_TIME_VN) : "chưa hẹn";
    }

    private static String formatInstant(Instant value) {
        return value != null ? value.atZone(java.time.ZoneId.systemDefault()).toLocalDateTime().format(DATE_TIME_VN) : "không giới hạn";
    }

    private static String signingMethodLabel(String signingMethod) {
        return "IN_PERSON".equalsIgnoreCase(signingMethod) ? "ký hợp đồng tại quầy" : "thanh toán và ký hợp đồng trực tuyến";
    }

    private static String bookingStatusLabel(BookingStatus status) {
        if (status == null) {
            return "không xác định";
        }
        return switch (status) {
            case PENDING_APPROVAL -> "chờ duyệt";
            case PENDING_PAYMENT -> "chờ thanh toán";
            case CONFIRMED -> "đã xác nhận";
            case ACTIVE -> "đang thuê";
            case OVERDUE -> "quá hạn nhận kho";
            case CANCELLED -> "đã hủy";
            case COMPLETED -> "đã kết thúc";
            case CHECKOUT_REQUESTED -> "đang làm thủ tục trả kho";
            case INSPECTED -> "đã kiểm tra trả kho";
        };
    }

    private static boolean isStaffRole(String role) {
        return "ADMIN".equalsIgnoreCase(role) || "BUSINESS_MANAGER".equalsIgnoreCase(role)
                || "FACILITY_MANAGER".equalsIgnoreCase(role) || "STAFF".equalsIgnoreCase(role);
    }

    private static final String BOOKING_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final java.security.SecureRandom CODE_RANDOM = new java.security.SecureRandom();

    /** BX-<year>-<6 random chars> (32^6 combinations per year), retried until the code is unused. */
    String generateBookingCode() {
        String year = String.valueOf(LocalDate.now().getYear());
        for (int attempt = 0; attempt < 12; attempt++) {
            StringBuilder suffix = new StringBuilder(6);
            for (int i = 0; i < 6; i++) {
                suffix.append(BOOKING_CODE_ALPHABET.charAt(CODE_RANDOM.nextInt(BOOKING_CODE_ALPHABET.length())));
            }
            String candidate = "BX-" + year + "-" + suffix;
            if (!bookingRepository.existsByBookingCode(candidate)) {
                return candidate;
            }
            log.warn("[BOOKING_CODE] Collision on {} (attempt {}), retrying", candidate, attempt + 1);
        }
        throw new AppException(ErrorCode.BOOKING_CODE_GENERATION_FAILED);
    }

    @Override
    public BookingResponse remoteUnlock(UUID id) {
        Booking booking = bookingRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));
        User currentUser = (requestContext != null && requestContext.currentUserId() != null)
                ? userRepository.findById(requestContext.currentUserId()).orElse(null)
                : null;
        validateBookingAccess(booking, currentUser);

        if (booking.getStorageUnit() != null && booking.getStorageUnit().getStatus() == UnitStatus.OVERDUE_LOCKED) {
            throw new AppException(ErrorCode.UNIT_OVERDUE_LOCKED);
        }
        if (booking.getStatus() != BookingStatus.ACTIVE) {
            throw new AppException(ErrorCode.REMOTE_UNLOCK_NOT_AVAILABLE);
        }

        // No smart-lock gateway is integrated: the request is only recorded, no signal is sent to any device.
        UUID facilityId = booking.getStorageUnit() != null && booking.getStorageUnit().getFacility() != null
                ? booking.getStorageUnit().getFacility().getId() : null;
        activityLogService.record(
                facilityId,
                ActivityAction.ACCESS_CREDENTIAL_ISSUE,
                "Booking",
                booking.getId(),
                String.format("Yêu cầu mở khóa từ xa kho %s (môi trường thử nghiệm: chưa kết nối khóa thông minh, không gửi tín hiệu).",
                        booking.getStorageUnit() != null ? booking.getStorageUnit().getUnitCode() : booking.getBookingCode()),
                null,
                booking.getBookingCode()
        );
        return mapToResponse(booking);
    }

    @Override
    @Transactional(readOnly = true)
    public BookingResponse getById(UUID id) {
        Booking booking = bookingRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        User currentUser = (requestContext != null && requestContext.currentUserId() != null)
                ? userRepository.findById(requestContext.currentUserId()).orElse(null)
                : null;
        if (currentUser == null) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }
        validateBookingAccess(booking, currentUser);

        return mapToResponse(booking);
    }

    @Override
    public BookingPinResponse getBookingPin(UUID id, String currentUserEmail) {
        Booking booking = bookingRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        User currentUser = currentUserEmail != null ? userRepository.findByEmail(currentUserEmail).orElse(null) : null;
        validateBookingAccess(booking, currentUser);
        requireCredentialOwner(currentUser);
        requireAccessCredentialsAvailable(booking);
        if (booking.getAccessPin() == null) {
            throw new AppException(ErrorCode.BOOKING_NOT_CHECKED_IN);
        }

        // Decrypt AES-256-GCM PIN
        String rawPin = booking.getAccessPin();
        String decryptedPin = (rawPin != null && !rawPin.isBlank()) ? encryptionService.decrypt(rawPin) : null;

        if (decryptedPin == null) {
            throw new AppException(ErrorCode.BOOKING_NOT_CHECKED_IN);
        }

        if (currentUser != null) {
            activityLogService.recordForUser(
                    currentUser.getId(),
                    ActivityAction.ACCESS_CREDENTIAL_ISSUE,
                    "Booking",
                    booking.getId(),
                    "Truy vấn xem mã PIN bảo mật cho đặt kho #" + booking.getBookingCode(),
                    null,
                    booking.getBookingCode()
            );
        }

        return BookingPinResponse.builder()
                .bookingId(booking.getId())
                .bookingCode(booking.getBookingCode())
                .unitCode(booking.getStorageUnit() != null ? booking.getStorageUnit().getUnitCode() : null)
                .pin(decryptedPin)
                .qrAccessToken(booking.getQrAccessToken())
                .pinUpdatedAt(booking.getPinUpdatedAt() != null ? booking.getPinUpdatedAt() : booking.getCreatedAt())
                .build();
    }

    @Override
    public BookingPinResponse updateBookingPin(UUID id, UpdatePinRequest request, String currentUserEmail) {
        Booking booking = bookingRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        User currentUser = currentUserEmail != null ? userRepository.findByEmail(currentUserEmail).orElse(null) : null;
        validateBookingAccess(booking, currentUser);
        requireAccessCredentialsAvailable(booking);

        // Encrypt new PIN with AES-256-GCM
        String encryptedPin = encryptionService.encrypt(request.getNewPin());
        booking.setAccessPin(encryptedPin);
        booking.setPinUpdatedAt(LocalDateTime.now());
        bookingRepository.save(booking);

        if (currentUser != null) {
            activityLogService.recordForUser(
                    currentUser.getId(),
                    ActivityAction.ACCESS_CREDENTIAL_UPDATE,
                    "Booking",
                    booking.getId(),
                    "Đổi mã PIN truy cập bảo mật AES-256-GCM cho kho #" + (booking.getStorageUnit() != null ? booking.getStorageUnit().getUnitCode() : booking.getBookingCode()),
                    null,
                    booking.getBookingCode()
            );
        }

        return BookingPinResponse.builder()
                .bookingId(booking.getId())
                .bookingCode(booking.getBookingCode())
                .unitCode(booking.getStorageUnit() != null ? booking.getStorageUnit().getUnitCode() : null)
                .pin(request.getNewPin())
                .qrAccessToken(booking.getQrAccessToken())
                .pinUpdatedAt(booking.getPinUpdatedAt())
                .build();
    }

    @Override
    public BookingPinResponse getBookingPinByUnitId(UUID unitId, String currentUserEmail) {
        Booking booking = bookingRepository.findFirstByStorageUnit_IdOrderByCreatedAtDesc(unitId)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        return getBookingPin(booking.getId(), currentUserEmail);
    }

    @Override
    public BookingPinResponse updateBookingPinByUnitId(UUID unitId, UpdatePinRequest request, String currentUserEmail) {
        Booking booking = bookingRepository.findFirstByStorageUnit_IdOrderByCreatedAtDesc(unitId)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        return updateBookingPin(booking.getId(), request, currentUserEmail);
    }

    /**
     * The access PIN / QR exist from the check-in until the unit is inspected at move-out: a customer who asked to
     * move out still uses the unit until the counter inspection (CHECKOUT_REQUESTED).
     */
    private void requireAccessCredentialsAvailable(Booking booking) {
        BookingStatus status = booking.getStatus();
        boolean unitLocked = booking.getStorageUnit() != null && booking.getStorageUnit().getStatus() == UnitStatus.OVERDUE_LOCKED;
        boolean rentalOverdue = status == BookingStatus.OVERDUE && booking.getHandoverTime() != null;
        boolean inUse = status == BookingStatus.ACTIVE || status == BookingStatus.CHECKOUT_REQUESTED;
        if (rentalOverdue || (inUse && unitLocked)) {
            throw new AppException(ErrorCode.UNIT_OVERDUE_LOCKED);
        }
        if (inUse) {
            return;
        }
        if (status == BookingStatus.INSPECTED || status == BookingStatus.COMPLETED) {
            throw new AppException(ErrorCode.BOOKING_ACCESS_ENDED);
        }
        if (status == BookingStatus.CANCELLED) {
            throw new AppException(ErrorCode.BOOKING_ACCESS_ENDED, "Đơn đặt kho đã hủy nên không có mã truy cập.");
        }
        throw new AppException(ErrorCode.BOOKING_NOT_CHECKED_IN);
    }

    /**
     * The PIN and QR token are shown to the customer who rents the unit. Front-desk staff and managers see the PIN once, in
     * the check-in response; afterwards they cannot read it back (a facility manager can issue a new one with PUT).
     */
    private void requireCredentialOwner(User currentUser) {
        String role = currentUser != null && currentUser.getRole() != null ? currentUser.getRole().getName() : "";
        if (!"CUSTOMER".equalsIgnoreCase(role)) {
            throw new AppException(ErrorCode.FORBIDDEN,
                    "Mã PIN chỉ hiển thị cho khách thuê kho. Nhân viên và quản lý chỉ thấy mã một lần lúc bàn giao; cần mã mới thì dùng chức năng cấp lại mã");
        }
    }

    private void validateBookingAccess(Booking booking, User currentUser) {
        if (currentUser == null) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }

        String role = currentUser.getRole() != null ? currentUser.getRole().getName() : "";
        if ("CUSTOMER".equalsIgnoreCase(role)) {
            if (booking.getCustomer() == null || !booking.getCustomer().getId().equals(currentUser.getId())) {
                throw new AppException(ErrorCode.FORBIDDEN);
            }
        } else if (facilityAccessGuard.isFacilityScoped()) {
            UUID facilityId = (booking.getStorageUnit() != null && booking.getStorageUnit().getFacility() != null)
                    ? booking.getStorageUnit().getFacility().getId() : null;
            if (facilityId != null) {
                facilityAccessGuard.checkFacilityAccess(facilityId);
            }
        }
    }

    @Override
    @Transactional(readOnly = true)
    public BookingAccessCredentialsResponse getAccessCredentials(UUID id) {
        Booking booking = bookingRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));
        User currentUser = (requestContext != null && requestContext.currentUserId() != null)
                ? userRepository.findById(requestContext.currentUserId()).orElse(null)
                : null;
        validateBookingAccess(booking, currentUser);
        requireCredentialOwner(currentUser);
        requireAccessCredentialsAvailable(booking);
        if (booking.getAccessPin() == null || booking.getAccessPin().isBlank()) {
            throw new AppException(ErrorCode.BOOKING_NOT_CHECKED_IN);
        }
        String pin = encryptionService.decrypt(booking.getAccessPin());
        if (pin == null || pin.isBlank()) {
            throw new AppException(ErrorCode.BOOKING_NOT_CHECKED_IN);
        }
        return BookingAccessCredentialsResponse.builder()
                .accessPin(pin)
                .qrAccessToken(booking.getQrAccessToken())
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public BookingRescheduleEligibilityResponse getRescheduleEligibility(UUID id) {
        Booking booking = bookingRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        User currentUser = requestContext != null && requestContext.currentUserId() != null
                ? userRepository.findById(requestContext.currentUserId()).orElse(null)
                : null;
        validateBookingAccess(booking, currentUser);

        StorageUnit unit = booking.getStorageUnit();
        Facility facility = (unit != null) ? unit.getFacility() : null;
        FacilityPolicy policy = (facility != null)
                ? facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(facility.getId()).orElse(null)
                : null;

        boolean eligible = true;
        String reasonIfNotEligible = null;

        if (booking.getStatus() == BookingStatus.ACTIVE || booking.getStatus() == BookingStatus.COMPLETED) {
            eligible = false;
            reasonIfNotEligible = "Kho đã được bàn giao thực tế và đang hoạt động. Không thể đổi lịch check-in.";
        } else if (booking.getStatus() == BookingStatus.CANCELLED) {
            eligible = false;
            reasonIfNotEligible = "Đơn đặt chỗ đã bị hủy. Không thể đổi lịch check-in.";
        } else if (booking.getHandoverTime() != null) {
            eligible = false;
            reasonIfNotEligible = "Kho đã được bàn giao thực tế, không thể đổi lịch nhận kho.";
        } else if (booking.getHoldExpiresAt() != null && booking.getHoldExpiresAt().isBefore(Instant.now())) {
            eligible = false;
            reasonIfNotEligible = "Thời hạn giữ chỗ của đơn đặt kho đã hết hạn.";
        } else if (booking.getPaymentExpiresAt() != null && booking.getPaymentExpiresAt().isBefore(Instant.now())
                && (booking.getDepositPaid() == null || booking.getDepositPaid().compareTo(BigDecimal.ZERO) <= 0)) {
            eligible = false;
            reasonIfNotEligible = "Đơn đặt kho đã quá hạn thanh toán giữ chỗ.";
        }

        Optional<RentalContract> contractOpt = rentalContractRepository.findByBookingId(booking.getId());
        String contractStatus = contractOpt.map(c -> c.getStatus().name()).orElse("CHƯA_TẠO");
        boolean contractSigned = contractOpt.isPresent() && (
                contractOpt.get().getStatus() == RentalContractStatus.PENDING_ACTIVATION
                        || contractOpt.get().getStatus() == RentalContractStatus.ACTIVE
        );

        int maxDays = (policy != null && policy.getMaxHoldDays() != null) ? policy.getMaxHoldDays() : maxAdvanceDays;
        int holdGraceHours = (policy != null && policy.getHoldGraceHours() != null) ? policy.getHoldGraceHours() : 24;
        LocalDate today = LocalDate.now();
        LocalDate allowedMinDate = today;
        LocalDate allowedMaxDate = today.plusDays(maxDays);

        LocalTime openTime = (facility != null && facility.getOpenTime() != null) ? facility.getOpenTime() : LocalTime.of(8, 0);
        LocalTime closeTime = (facility != null && facility.getCloseTime() != null) ? facility.getCloseTime() : LocalTime.of(20, 0);

        List<String> restrictions = new ArrayList<>();
        restrictions.add(String.format("Khung giờ nhận kho tại cơ sở: %s - %s", openTime, closeTime));
        restrictions.add(String.format("Thời hạn dời lịch tối đa %d ngày kể từ hôm nay (đến %s)", maxDays, allowedMaxDate.format(DateTimeFormatter.ofPattern("dd/MM/yyyy"))));
        restrictions.add(String.format("Thời gian giữ chỗ: Giữ kho thêm %d giờ sau thời điểm hẹn nhận kho", holdGraceHours));
        restrictions.add("Đổi lịch không phát sinh phụ phí, không làm thay đổi giá thuê, tiền cọc hay thời hạn thuê đã thỏa thuận.");
        if (contractSigned) {
            restrictions.add("Hợp đồng đã ký điện tử sẽ được bảo lưu trọn vẹn giá trị pháp lý và chữ ký. Ngày hiệu lực tính phí thuê sẽ kích hoạt tại thời điểm bàn giao thực tế tại cơ sở.");
        }

        LocalDateTime currentAppointmentAt = booking.getExpectedCheckInAt() != null
                ? booking.getExpectedCheckInAt()
                : (booking.getStartDate() != null ? booking.getStartDate().atTime(9, 0) : LocalDateTime.now());

        BigDecimal monthlyFee = booking.getTotalRentalFee() != null && booking.getRentalMonths() != null && booking.getRentalMonths() > 0
                ? booking.getTotalRentalFee().divide(BigDecimal.valueOf(booking.getRentalMonths()), 2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        return BookingRescheduleEligibilityResponse.builder()
                .bookingId(booking.getId())
                .bookingCode(booking.getBookingCode())
                .unitCode(unit != null ? unit.getUnitCode() : null)
                .facilityName(facility != null ? facility.getName() : null)
                .eligible(eligible)
                .reasonIfNotEligible(reasonIfNotEligible)
                .restrictions(restrictions)
                .currentAppointmentAt(currentAppointmentAt)
                .expectedStartDate(booking.getStartDate())
                .expectedEndDate(booking.getEndDate())
                .rentalMonths(booking.getRentalMonths())
                .monthlyFee(monthlyFee)
                .depositAmount(booking.getDepositAmount())
                .paymentStatus(booking.getPaymentStatus())
                .contractStatus(contractStatus)
                .contractSigned(contractSigned)
                .holdExpiresAt(booking.getHoldExpiresAt() != null ? booking.getHoldExpiresAt() : booking.getPaymentExpiresAt())
                .allowedMinDate(allowedMinDate)
                .allowedMaxDate(allowedMaxDate)
                .facilityOpenTime(openTime.toString())
                .facilityCloseTime(closeTime.toString())
                .build();
    }

    @Override
    public BookingRescheduleResponse rescheduleBookingDetailed(UUID id, BookingRescheduleRequest request) {
        Booking booking = bookingRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        User currentUser = requestContext != null && requestContext.currentUserId() != null
                ? userRepository.findById(requestContext.currentUserId()).orElse(null)
                : null;
        validateBookingAccess(booking, currentUser);

        if (booking.getStatus() == BookingStatus.ACTIVE || booking.getStatus() == BookingStatus.COMPLETED) {
            throw new AppException(ErrorCode.BOOKING_ALREADY_ACTIVE);
        }
        if (booking.getStatus() == BookingStatus.CANCELLED) {
            throw new AppException(ErrorCode.BOOKING_ALREADY_CANCELLED);
        }
        if (booking.getHandoverTime() != null) {
            throw new AppException(ErrorCode.BOOKING_ALREADY_HANDED_OVER);
        }

        LocalDate newStartDate = request.getNewStartDate();
        if (newStartDate == null && request.getNewExpectedCheckInAt() != null) {
            newStartDate = request.getNewExpectedCheckInAt().toLocalDate();
        }
        if (newStartDate == null) {
            throw new AppException(ErrorCode.INVALID_REQUEST);
        }

        LocalDate today = LocalDate.now();
        if (newStartDate.isBefore(today)) {
            throw new AppException(ErrorCode.BOOKING_START_DATE_PAST);
        }

        StorageUnit unit = booking.getStorageUnit();
        Facility facility = (unit != null) ? unit.getFacility() : null;
        FacilityPolicy policy = (facility != null)
                ? facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(facility.getId()).orElse(null)
                : null;

        int maxDays = (policy != null && policy.getMaxHoldDays() != null) ? policy.getMaxHoldDays() : maxAdvanceDays;
        if (newStartDate.isAfter(today.plusDays(maxDays))) {
            throw new AppException(ErrorCode.BOOKING_ADVANCE_NOTICE_EXCEEDED);
        }

        LocalDateTime newExpectedCheckIn = request.getNewExpectedCheckInAt();
        if (newExpectedCheckIn == null) {
            if (request.getNewCheckInTime() != null && !request.getNewCheckInTime().isBlank()) {
                try {
                    String[] parts = request.getNewCheckInTime().trim().split(":");
                    int hour = Integer.parseInt(parts[0]);
                    int minute = parts.length > 1 ? Integer.parseInt(parts[1]) : 0;
                    newExpectedCheckIn = newStartDate.atTime(hour, minute);
                } catch (Exception e) {
                    newExpectedCheckIn = newStartDate.atTime(9, 0);
                }
            } else {
                newExpectedCheckIn = newStartDate.atTime(9, 0);
            }
        }

        LocalTime openTime = (facility != null && facility.getOpenTime() != null) ? facility.getOpenTime() : LocalTime.of(8, 0);
        LocalTime closeTime = (facility != null && facility.getCloseTime() != null) ? facility.getCloseTime() : LocalTime.of(20, 0);
        LocalTime apptTime = newExpectedCheckIn.toLocalTime();
        if (apptTime.isBefore(openTime) || apptTime.isAfter(closeTime)) {
            throw new AppException(ErrorCode.INVALID_REQUEST);
        }

        if (unit != null) {
            boolean hasConflict = bookingRepository.existsByStorageUnit_IdAndStatusInAndIdNot(
                    unit.getId(),
                    List.of(BookingStatus.ACTIVE),
                    booking.getId()
            );
            if (hasConflict) {
                throw new AppException(ErrorCode.STORAGE_UNIT_NOT_AVAILABLE);
            }
        }

        int holdGraceHours = (policy != null && policy.getHoldGraceHours() != null) ? policy.getHoldGraceHours() : 24;
        Instant now = Instant.now();
        Instant appointmentInstant = newExpectedCheckIn.atZone(java.time.ZoneId.systemDefault()).toInstant();
        Instant newHoldExpiresAt = appointmentInstant.plus(java.time.Duration.ofHours(holdGraceHours));
        if (newHoldExpiresAt.isBefore(now.plus(java.time.Duration.ofHours(24)))) {
            newHoldExpiresAt = now.plus(java.time.Duration.ofHours(24));
        }
        Instant maxHoldLimit = now.plus(java.time.Duration.ofDays(maxDays + 2));
        if (newHoldExpiresAt.isAfter(maxHoldLimit)) {
            newHoldExpiresAt = maxHoldLimit;
        }

        LocalDateTime prevAppt = booking.getExpectedCheckInAt() != null
                ? booking.getExpectedCheckInAt()
                : (booking.getStartDate() != null ? booking.getStartDate().atTime(9, 0) : LocalDateTime.now());
        LocalDate prevStartDate = booking.getStartDate() != null ? booking.getStartDate() : newStartDate;
        LocalDate prevEndDate = booking.getEndDate() != null ? booking.getEndDate() : newStartDate.plusMonths(1);
        Instant prevHoldExpiresAt = booking.getHoldExpiresAt();

        int rentalMonths = (booking.getRentalMonths() != null && booking.getRentalMonths() > 0) ? booking.getRentalMonths() : 1;
        LocalDate newEndDate = newStartDate.plusMonths(rentalMonths);

        booking.setStartDate(newStartDate);
        booking.setEndDate(newEndDate);
        booking.setExpectedCheckInAt(newExpectedCheckIn);
        booking.setHoldExpiresAt(newHoldExpiresAt);
        booking.setPaymentExpiresAt(newHoldExpiresAt);
        booking = bookingRepository.save(booking);

        Optional<RentalContract> contractOpt = rentalContractRepository.findByBookingId(booking.getId());
        String amendmentNotes = null;
        if (contractOpt.isPresent()) {
            RentalContract contract = contractOpt.get();
            contract.setStartDate(newStartDate);
            contract.setEndDate(newEndDate);
            rentalContractRepository.save(contract);
            if (contract.getStatus() == RentalContractStatus.PENDING_ACTIVATION || contract.getStatus() == RentalContractStatus.ACTIVE) {
                amendmentNotes = String.format("Hợp đồng đã ký (%s) bảo lưu chữ ký số trọn vẹn. Ngày hiệu lực chính thức xác lập tại thời điểm bàn giao thực tế.",
                        contract.getContractCode());
            } else {
                amendmentNotes = String.format("Hợp đồng (%s) đã cập nhật lịch dự kiến nhận kho.", contract.getContractCode());
            }
        }

        String requesterRole = (currentUser != null && currentUser.getRole() != null)
                ? currentUser.getRole().getName()
                : (requestContext != null ? requestContext.currentUserRole() : "CUSTOMER");
        User requesterUser = currentUser != null ? currentUser : booking.getCustomer();

        BookingRescheduleHistory history = BookingRescheduleHistory.builder()
                .booking(booking)
                .changeType("CHECKIN_RESCHEDULE")
                .previousAppointmentAt(prevAppt)
                .requestedAppointmentAt(newExpectedCheckIn)
                .acceptedAppointmentAt(newExpectedCheckIn)
                .previousExpectedStartDate(prevStartDate)
                .previousExpectedEndDate(prevEndDate)
                .newExpectedStartDate(newStartDate)
                .newExpectedEndDate(newEndDate)
                .previousHoldExpiresAt(prevHoldExpiresAt)
                .newHoldExpiresAt(newHoldExpiresAt)
                .requester(requesterUser)
                .requesterRole(requesterRole != null ? requesterRole : "CUSTOMER")
                .requestTimestamp(LocalDateTime.now())
                .reason(request.getReason() != null && !request.getReason().isBlank() ? request.getReason() : "Khách hàng đổi lịch hẹn nhận kho")
                .processor(requesterUser)
                .processorRole(requesterRole != null ? requesterRole : "SYSTEM")
                .processedAt(LocalDateTime.now())
                .outcome("CONFIRMED")
                .previousBookingStatus(booking.getStatus().name())
                .resultingBookingStatus(booking.getStatus().name())
                .contractAmendmentRequired(false)
                .contractAmendmentNotes(amendmentNotes)
                .build();
        history = bookingRescheduleHistoryRepository.save(history);

        if (unit != null) {
            long effectiveLockHours = Math.max(1, java.time.Duration.between(now, newHoldExpiresAt).toHours() + 1);
            try {
                storageUnitLockService.tryLockUnit(unit.getId(), booking.getId(), effectiveLockHours);
            } catch (Exception ex) {
                log.warn("Could not update redis lock on reschedule: {}", ex.getMessage());
            }
        }

        UUID facilityId = (unit != null && unit.getFacility() != null) ? unit.getFacility().getId() : null;
        activityLogService.record(
                facilityId,
                ActivityAction.CHECKIN_RESCHEDULE,
                "Booking",
                booking.getId(),
                String.format("Đổi lịch hẹn nhận kho %s từ %s sang %s. Hạn giữ chỗ mới: %s. Lý do: %s",
                        booking.getBookingCode(),
                        prevAppt.format(DateTimeFormatter.ofPattern("HH:mm dd/MM/yyyy")),
                        newExpectedCheckIn.format(DateTimeFormatter.ofPattern("HH:mm dd/MM/yyyy")),
                        newHoldExpiresAt,
                        request.getReason() != null ? request.getReason() : "N/A"),
                null,
                booking.getStatus()
        );

        BookingResponse bookingResp = mapToResponse(booking);
        BookingRescheduleHistoryResponse historyResp = mapHistoryToResponse(history);
        String msg = String.format("Đổi lịch hẹn nhận kho thành công sang %s. Hạn giữ chỗ mới đã được cập nhật.",
                newExpectedCheckIn.format(DateTimeFormatter.ofPattern("HH:mm dd/MM/yyyy")));

        return BookingRescheduleResponse.builder()
                .booking(bookingResp)
                .historyRecord(historyResp)
                .message(msg)
                .build();
    }

    @Override
    public BookingResponse rescheduleBooking(UUID id, BookingRescheduleRequest request) {
        return rescheduleBookingDetailed(id, request).getBooking();
    }

    @Override
    @Transactional(readOnly = true)
    public List<BookingRescheduleHistoryResponse> getRescheduleHistory(UUID id) {
        Booking booking = bookingRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        User currentUser = requestContext != null && requestContext.currentUserId() != null
                ? userRepository.findById(requestContext.currentUserId()).orElse(null)
                : null;
        validateBookingAccess(booking, currentUser);

        List<BookingRescheduleHistory> list = bookingRescheduleHistoryRepository.findByBooking_IdOrderByCreatedAtDesc(id);
        return list.stream().map(this::mapHistoryToResponse).collect(Collectors.toList());
    }

    private BookingRescheduleHistoryResponse mapHistoryToResponse(BookingRescheduleHistory h) {
        return BookingRescheduleHistoryResponse.builder()
                .id(h.getId())
                .bookingId(h.getBooking().getId())
                .bookingCode(h.getBooking().getBookingCode())
                .changeType(h.getChangeType())
                .previousAppointmentAt(h.getPreviousAppointmentAt())
                .requestedAppointmentAt(h.getRequestedAppointmentAt())
                .acceptedAppointmentAt(h.getAcceptedAppointmentAt())
                .previousExpectedStartDate(h.getPreviousExpectedStartDate())
                .previousExpectedEndDate(h.getPreviousExpectedEndDate())
                .newExpectedStartDate(h.getNewExpectedStartDate())
                .newExpectedEndDate(h.getNewExpectedEndDate())
                .previousHoldExpiresAt(h.getPreviousHoldExpiresAt())
                .newHoldExpiresAt(h.getNewHoldExpiresAt())
                .requesterId(h.getRequester() != null ? h.getRequester().getId() : null)
                .requesterName(h.getRequester() != null
                        ? (h.getRequester().getFullName() != null ? h.getRequester().getFullName() : h.getRequester().getUsername())
                        : "Khách hàng")
                .requesterRole(h.getRequesterRole())
                .requestTimestamp(h.getRequestTimestamp())
                .reason(h.getReason())
                .processorId(h.getProcessor() != null ? h.getProcessor().getId() : null)
                .processorName(h.getProcessor() != null
                        ? (h.getProcessor().getFullName() != null ? h.getProcessor().getFullName() : h.getProcessor().getUsername())
                        : "Hệ thống Boxora")
                .processorRole(h.getProcessorRole())
                .processedAt(h.getProcessedAt())
                .outcome(h.getOutcome())
                .rejectionReason(h.getRejectionReason())
                .previousBookingStatus(h.getPreviousBookingStatus())
                .resultingBookingStatus(h.getResultingBookingStatus())
                .contractAmendmentRequired(h.getContractAmendmentRequired())
                .contractAmendmentNotes(h.getContractAmendmentNotes())
                .createdAt(h.getCreatedAt() != null ? h.getCreatedAt() : h.getProcessedAt())
                .build();
    }

    @Scheduled(fixedDelay = 60_000L)
    @Transactional
    public void expireUnpaidBookings() {
        Instant now = Instant.now();
        LocalDateTime checkInThreshold = LocalDateTime.now();
        LocalDate todayThreshold = LocalDate.now();
        List<Booking> candidates = bookingRepository.findExpiredHoldCandidates(
                List.of(BookingStatus.PENDING_APPROVAL, BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED),
                now,
                checkInThreshold,
                todayThreshold
        );

        for (Booking candidate : candidates) {
            // Lock booking row to serialize against concurrent payment returns / IPN webhooks
            Booking booking = bookingRepository.findByIdForUpdate(candidate.getId()).orElse(null);
            if (booking == null) {
                continue;
            }

            // Skip if already cancelled or already active/completed or overdue
            if (booking.getStatus() == BookingStatus.CANCELLED || booking.getStatus() == BookingStatus.ACTIVE 
                    || booking.getStatus() == BookingStatus.COMPLETED || booking.getStatus() == BookingStatus.OVERDUE) {
                continue;
            }
            if (booking.getHandoverTime() != null) {
                continue;
            }

            // Determine hold deadline and check whether check-in is overdue
            Instant holdDeadline = booking.getHoldExpiresAt();
            boolean isCheckInExpired = false;

            if (holdDeadline != null) {
                isCheckInExpired = holdDeadline.isBefore(now);
            } else if (booking.getExpectedCheckInAt() != null) {
                int graceHours = 24;
                if (booking.getStorageUnit() != null && booking.getStorageUnit().getFacility() != null) {
                    graceHours = facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(booking.getStorageUnit().getFacility().getId())
                            .map(FacilityPolicy::getHoldGraceHours)
                            .filter(h -> h != null && h > 0)
                            .orElse(24);
                }
                holdDeadline = booking.getExpectedCheckInAt()
                        .atZone(java.time.ZoneId.systemDefault())
                        .toInstant()
                        .plus(java.time.Duration.ofHours(graceHours));
                isCheckInExpired = holdDeadline.isBefore(now);
                if (!isCheckInExpired && booking.getHoldExpiresAt() == null) {
                    // Pre-populate exact hold deadline from facility policy so customer sees exact time
                    booking.setHoldExpiresAt(holdDeadline);
                    bookingRepository.save(booking);
                }
            } else if (booking.getStartDate() != null) {
                isCheckInExpired = booking.getStartDate().isBefore(todayThreshold);
                holdDeadline = booking.getStartDate().atTime(23, 59, 59).atZone(java.time.ZoneId.systemDefault()).toInstant();
            } else if (booking.getPaymentExpiresAt() != null) {
                isCheckInExpired = booking.getPaymentExpiresAt().isBefore(now);
            }

            // Check if payment was marked PAID in a race condition or deposit was already paid
            boolean hasPaidPayment = paymentRepository.existsByBooking_IdAndStatus(booking.getId(), PaymentStatus.PAID)
                    || (booking.getDepositPaid() != null && booking.getDepositPaid().compareTo(BigDecimal.ZERO) > 0);

            // Case A: Booking is still within its check-in appointment window
            if (!isCheckInExpired && booking.getStatus() == BookingStatus.CONFIRMED) {
                continue;
            }

            // Case B: Pending payment booking where customer completed payment -> reconcile to CONFIRMED
            if (!isCheckInExpired && hasPaidPayment && booking.getStatus() != BookingStatus.CONFIRMED) {
                log.info("[EXPIRE_RECONCILE] Booking {} has PAID payment/deposit; reconciling to CONFIRMED instead of CANCELLED", booking.getBookingCode());
                booking.setStatus(BookingStatus.CONFIRMED);
                booking.setPaymentExpiresAt(null);
                booking.setPaymentStatus("PAID");
                bookingRepository.save(booking);
                if (booking.getStorageUnit() != null) {
                    storageUnitLockService.releaseLock(booking.getStorageUnit().getId());
                }
                continue;
            }

            // Case C: Expiration reached!
            // A reservation with money received that missed its check-in deadline becomes OVERDUE (the facility
            // follows up: reschedule or refund under the cancellation policy). A hold with nothing paid is simply
            // CANCELLED: there is nothing to collect or refund, and "overdue" would read like an unpaid rental.
            BookingStatus resultingStatus = hasPaidPayment ? BookingStatus.OVERDUE : BookingStatus.CANCELLED;
            BookingStatus previousStatus = booking.getStatus();

            booking.setStatus(resultingStatus);
            booking.setPaymentExpiresAt(null);
            if (resultingStatus == BookingStatus.CANCELLED) {
                if (!"PAID".equalsIgnoreCase(booking.getPaymentStatus())) {
                    booking.setPaymentStatus("UNPAID");
                }
                if (booking.getCancelledAt() == null) {
                    booking.setCancelledAt(LocalDateTime.now());
                }
                if (booking.getCancellationReason() == null || booking.getCancellationReason().isBlank()) {
                    booking.setCancellationReason(previousStatus == BookingStatus.CONFIRMED
                            ? "Hết thời hạn giữ chỗ: khách chưa đến nhận kho đúng lịch hẹn"
                            : "Hết thời hạn thanh toán giữ chỗ");
                }
                cancelUnsignedContract(booking);
            }
            if (booking.getHoldExpiresAt() == null && holdDeadline != null) {
                booking.setHoldExpiresAt(holdDeadline);
            }
            bookingRepository.save(booking);

            // Reconcile unit state safely: verify no other active reservation occupies the unit
            if (booking.getStorageUnit() != null) {
                UUID unitId = booking.getStorageUnit().getId();
                StorageUnit unit = storageUnitRepository.findWithDetailsByIdForUpdate(unitId).orElse(null);
                if (unit != null) {
                    boolean hasOtherActive = bookingRepository.existsByStorageUnit_IdAndStatusInAndIdNot(
                            unitId,
                            List.of(BookingStatus.ACTIVE, BookingStatus.CONFIRMED, BookingStatus.PENDING_PAYMENT, BookingStatus.PENDING_APPROVAL),
                            booking.getId()
                    );
                    if (!hasOtherActive && unit.getStatus() == UnitStatus.RESERVED) {
                        unit.setStatus(UnitStatus.AVAILABLE);
                        storageUnitRepository.save(unit);
                        storageUnitLockService.releaseLock(unitId);
                        log.info("[EXPIRE_JOB] Released storage unit {} back to AVAILABLE for {} hold booking {}",
                                unit.getUnitCode(), resultingStatus, booking.getBookingCode());
                    }
                }
                UUID facilityId = (unit != null && unit.getFacility() != null) ? unit.getFacility().getId() : null;
                activityLogService.record(
                        facilityId,
                        ActivityAction.RESERVATION_EXPIRE,
                        "Booking",
                        booking.getId(),
                        String.format("Lịch hẹn giữ chỗ của đơn %s đã chuyển sang trạng thái %s do quá hạn nhận kho / giữ chỗ (ngày hẹn: %s); kho đã được giải phóng tự động.",
                                booking.getBookingCode(), bookingStatusLabel(resultingStatus), formatDateTime(booking.getExpectedCheckInAt())),
                        null,
                        resultingStatus
                );
            }
        }
    }

    /** A reservation that ends before the check-in also ends its unsigned / not yet started contract. */
    private void cancelUnsignedContract(Booking booking) {
        if (booking.getId() == null || rentalContractRepository == null) {
            return;
        }
        rentalContractRepository.findByBookingId(booking.getId()).ifPresent(contract -> {
            if (contract.getStatus() == RentalContractStatus.PENDING_SIGNATURE
                    || contract.getStatus() == RentalContractStatus.PENDING_VERIFICATION
                    || contract.getStatus() == RentalContractStatus.PENDING_ACTIVATION) {
                contract.setStatus(RentalContractStatus.CANCELLED);
                rentalContractRepository.save(contract);
            }
        });
    }

    private BookingResponse mapToResponse(Booking b) {
        return mapToResponse(b, new HashMap<>());
    }

    /**
     * Check-in settles the initial payment (the handover sets PAID), so a booking that was handed over never reports an
     * unpaid or partly paid state, even when an older row was left behind with one (see V70).
     */
    private String handedOverPaymentStatus(Booking b, String paymentStatus) {
        if (b.getHandoverTime() == null
                || !("UNPAID".equalsIgnoreCase(paymentStatus) || "PARTIALLY_PAID".equalsIgnoreCase(paymentStatus))) {
            return paymentStatus;
        }
        BookingStatus status = b.getStatus();
        boolean inUse = status == BookingStatus.ACTIVE || status == BookingStatus.CHECKOUT_REQUESTED
                || status == BookingStatus.INSPECTED || status == BookingStatus.COMPLETED || status == BookingStatus.OVERDUE;
        return inUse ? "PAID" : paymentStatus;
    }

    /**
     * A cancelled booking whose money is being (or has been) returned must not keep saying "PAID":
     * REFUND_PENDING while a refund request is open, REFUNDED once the transfer was made.
     */
    private String refundAwarePaymentStatus(Booking b, String paymentStatus) {
        if (b.getStatus() != BookingStatus.CANCELLED || b.getId() == null || refundRequestRepository == null
                || !("PAID".equalsIgnoreCase(paymentStatus) || "PARTIALLY_PAID".equalsIgnoreCase(paymentStatus))) {
            return paymentStatus;
        }
        List<com.boxora.entity.RefundRequest> refunds = refundRequestRepository.findByBookingId(b.getId());
        if (refunds == null || refunds.isEmpty()) {
            return paymentStatus;
        }
        boolean transferred = refunds.stream().anyMatch(r -> r.getStatus() == RefundStatus.AWAITING_CUSTOMER_CONFIRMATION
                || r.getStatus() == RefundStatus.PROCESSED || r.getStatus() == RefundStatus.RECONCILED
                || r.getStatus() == RefundStatus.COMPLETED);
        if (transferred) {
            return "REFUNDED";
        }
        boolean open = refunds.stream().anyMatch(r -> r.getStatus() == RefundStatus.PENDING_REVIEW
                || r.getStatus() == RefundStatus.APPROVED || r.getStatus() == RefundStatus.PROCESSING_TRANSFER);
        return open ? "REFUND_PENDING" : paymentStatus;
    }

    /** Initial payment still owed online, the same figure POST /payments/vnpay/create charges (0 once settled). */
    private BigDecimal initialPaymentDue(Booking b, BigDecimal initialPaymentAmount) {
        boolean payable = b.getHandoverTime() == null && !"PAID".equalsIgnoreCase(b.getPaymentStatus())
                && (b.getStatus() == BookingStatus.PENDING_PAYMENT || b.getStatus() == BookingStatus.PENDING_APPROVAL
                || b.getStatus() == BookingStatus.CONFIRMED);
        if (!payable) {
            return BigDecimal.ZERO;
        }
        if (b.getId() == null || paymentRepository == null) {
            return initialPaymentAmount;
        }
        BigDecimal paid = paymentRepository.findAllByBooking_Id(b.getId()).stream()
                .filter(p -> p.getStatus() == PaymentStatus.PAID && p.getAmount() != null)
                .filter(p -> p.getPaymentType() == com.boxora.enums.PaymentType.BOOKING_PAYMENT
                        || p.getPaymentType() == com.boxora.enums.PaymentType.DEPOSIT
                        || p.getPaymentType() == com.boxora.enums.PaymentType.RENTAL_FEE)
                .map(com.boxora.entity.Payment::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return initialPaymentAmount.subtract(paid).max(BigDecimal.ZERO).setScale(0, RoundingMode.HALF_UP);
    }

    /**
     * Booking DTO. The encrypted PIN and the QR token are never part of it: they are only returned by the
     * dedicated PIN endpoints to the owner or to authorised staff.
     */
    private BookingResponse mapToResponse(Booking b, Map<UUID, Optional<FacilityPolicy>> policyCache) {
        BigDecimal deposit = b.getDepositAmount() != null ? b.getDepositAmount() : BigDecimal.ZERO;
        BigDecimal initialPaymentAmount = b.getTotalRentalFee() != null && b.getRentalMonths() != null && b.getRentalMonths() > 0
                ? b.getTotalRentalFee().divide(BigDecimal.valueOf(b.getRentalMonths()), 2, RoundingMode.HALF_UP).add(deposit)
                : BigDecimal.ZERO;
        String assignedStaffName = null;
        if (b.getHandedOverByStaffId() != null) {
            assignedStaffName = userRepository.findById(b.getHandedOverByStaffId())
                    .map(u -> u.getFullName() != null ? u.getFullName() : u.getUsername())
                    .orElse(null);
        }

        StorageUnit unit = b.getStorageUnit();
        Facility facility = unit != null ? unit.getFacility() : null;
        Integer policyHoldGraceHours = null;
        if (facility != null) {
            Optional<FacilityPolicy> policy = policyCache.computeIfAbsent(facility.getId(),
                    facilityId -> facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(facilityId));
            if (policy != null && policy.isPresent()) {
                policyHoldGraceHours = policy.get().getHoldGraceHours();
            }
        }

        String paymentStatus = b.getPaymentStatus();
        if (paymentStatus == null || paymentStatus.isBlank()) {
            if (b.getStatus() == BookingStatus.ACTIVE || b.getStatus() == BookingStatus.COMPLETED) {
                paymentStatus = "PAID";
            } else if (b.getDepositPaid() != null && b.getDepositPaid().compareTo(BigDecimal.ZERO) > 0) {
                paymentStatus = "PARTIALLY_PAID";
            } else {
                paymentStatus = "UNPAID";
            }
        }
        paymentStatus = handedOverPaymentStatus(b, paymentStatus);
        paymentStatus = refundAwarePaymentStatus(b, paymentStatus);
        BigDecimal initialPaymentDue = initialPaymentDue(b, initialPaymentAmount);

        return BookingResponse.builder()
                .id(b.getId())
                .bookingCode(b.getBookingCode())
                .customerId(b.getCustomer() != null ? b.getCustomer().getId() : null)
                .customerName(b.getCustomer() != null ? b.getCustomer().getFullName() : null)
                .customerPhone(b.getCustomer() != null ? b.getCustomer().getPhone() : null)
                .customerEmail(b.getCustomer() != null ? b.getCustomer().getEmail() : null)
                .storageUnitId(unit != null ? unit.getId() : null)
                .unitId(unit != null ? unit.getId() : null)
                .unitCode(unit != null ? unit.getUnitCode() : null)
                .facilityId(facility != null ? facility.getId() : null)
                .facilityName(facility != null ? facility.getName() : null)
                .floorLevel(unit != null ? unit.getFloorLevel() : null)
                .startDate(b.getStartDate())
                .endDate(b.getEndDate())
                .rentalMonths(b.getRentalMonths())
                .totalRentalFee(b.getTotalRentalFee())
                .depositPaid(b.getDepositPaid())
                .depositAmount(b.getDepositAmount())
                .initialPaymentAmount(initialPaymentAmount)
                .initialPaymentDue(initialPaymentDue)
                .paymentExpiresAt(b.getPaymentExpiresAt())
                .holdStartedAt(b.getHoldStartedAt())
                .holdExpiresAt(b.getHoldExpiresAt() != null ? b.getHoldExpiresAt() : b.getPaymentExpiresAt())
                .expectedCheckInAt(b.getExpectedCheckInAt() != null ? b.getExpectedCheckInAt() : (b.getStartDate() != null ? b.getStartDate().atTime(9, 0) : null))
                .paymentStatus(paymentStatus)
                .holdGraceHours(policyHoldGraceHours != null ? policyHoldGraceHours : 24)
                .status(b.getStatus() != null ? b.getStatus() : BookingStatus.PENDING_PAYMENT)
                .signingMethod(b.getSigningMethod() != null ? b.getSigningMethod() : "ONLINE")
                .assignedStaffId(b.getHandedOverByStaffId())
                .assignedStaffName(assignedStaffName)
                .staffAssignmentNotes(b.getStaffAssignmentNotes())
                .accessPin(null)
                .qrAccessToken(null)
                .handoverTime(b.getHandoverTime())
                .returnTime(b.getReturnTime())
                .cancellationReason(b.getCancellationReason())
                .cancelledAt(b.getCancelledAt())
                .createdAt(b.getCreatedAt())
                .build();
    }
}

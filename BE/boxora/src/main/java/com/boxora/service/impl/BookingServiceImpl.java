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
import java.util.List;
import java.util.Optional;
import java.util.Random;
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
        boolean isStaffOrAdmin = requestContext != null && (
                "ADMIN".equalsIgnoreCase(requestContext.currentUserRole())
                || "FACILITY_MANAGER".equalsIgnoreCase(requestContext.currentUserRole())
                || "STAFF".equalsIgnoreCase(requestContext.currentUserRole())
        );

        if (isStaffOrAdmin && request.getCustomerId() != null) {
            customer = userRepository.findById(request.getCustomerId())
                    .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
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

        // 8. Tạo mã đặt kho duy nhất
        String code = "BX-" + (2025 + new Random().nextInt(2)) + "-" + String.format("%04d", new Random().nextInt(10000));

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

        boolean isDirect = request.getSigningMethod() != null &&
                ("DIRECT".equalsIgnoreCase(request.getSigningMethod().trim()) || "IN_PERSON".equalsIgnoreCase(request.getSigningMethod().trim()));
        BookingStatus initialStatus = isDirect ? BookingStatus.CONFIRMED : BookingStatus.PENDING_PAYMENT;
        String resolvedSigningMethod = isDirect ? "IN_PERSON" : (request.getSigningMethod() != null && !request.getSigningMethod().isBlank() ? request.getSigningMethod().trim().toUpperCase() : "ONLINE");

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
                        code, resolvedSigningMethod, expectedCheckInAt, holdExpiresAt),
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
    public BookingResponse reviewBookingRequest(UUID id, boolean approved, UUID assignedStaffId, String notes) {
        Booking booking = bookingRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));
        if (booking.getStatus() != BookingStatus.PENDING_APPROVAL && booking.getStatus() != BookingStatus.CONFIRMED) {
            throw new AppException(ErrorCode.BOOKING_REQUEST_NOT_PENDING_APPROVAL);
        }

        StorageUnit unit = booking.getStorageUnit();
        UUID facilityId = unit != null && unit.getFacility() != null ? unit.getFacility().getId() : null;
        if (facilityId != null) {
            facilityAccessGuard.checkFacilityAccess(facilityId);
        }

        Instant now = Instant.now();
        if (booking.getStatus() == BookingStatus.PENDING_APPROVAL && booking.getPaymentExpiresAt() != null && !booking.getPaymentExpiresAt().isAfter(now)) {
            booking.setStatus(BookingStatus.CANCELLED);
            booking.setPaymentExpiresAt(null);
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
            return mapToResponse(booking);
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

        UUID currentUserId = requestContext != null ? requestContext.currentUserId() : null;
        if (currentUserId != null && customerId != null && !currentUserId.equals(customerId)) {
            String role = requestContext.currentUserRole();
            if (!"ADMIN".equalsIgnoreCase(role) && !"FACILITY_MANAGER".equalsIgnoreCase(role) && !"STAFF".equalsIgnoreCase(role)) {
                throw new AppException(ErrorCode.FORBIDDEN);
            }
        }
        UUID targetCustomerId = customerId != null ? customerId : currentUserId;
        List<Booking> bookings;
        if (targetCustomerId != null) {
            bookings = bookingRepository.findByCustomer_Id(targetCustomerId);
        } else {
            bookings = bookingRepository.findAll();
        }
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
        UUID currentUserId = requestContext != null ? requestContext.currentUserId() : null;
        if (currentUserId != null && customerId != null && !currentUserId.equals(customerId)) {
            String role = requestContext.currentUserRole();
            if (!"ADMIN".equalsIgnoreCase(role) && !"FACILITY_MANAGER".equalsIgnoreCase(role) && !"STAFF".equalsIgnoreCase(role)) {
                throw new AppException(ErrorCode.FORBIDDEN);
            }
        }
        UUID targetCustomerId = customerId != null ? customerId : currentUserId;
        List<Booking> bookings;
        if (targetCustomerId != null) {
            bookings = bookingRepository.findByCustomer_Id(targetCustomerId);
        } else {
            bookings = bookingRepository.findAll();
        }
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
        UUID scopedFacilityId = facilityAccessGuard.scopedFacilityIdOrNull();
        List<Booking> list = bookingRepository.findAll().stream()
                .filter(b -> b.getStatus() == BookingStatus.CONFIRMED || b.getStatus() == BookingStatus.PENDING_PAYMENT)
                .filter(b -> scopedFacilityId == null || (b.getStorageUnit() != null && b.getStorageUnit().getFacility() != null && scopedFacilityId.equals(b.getStorageUnit().getFacility().getId())))
                .collect(Collectors.toList());
        return list.stream().map(this::mapToResponse).collect(Collectors.toList());
    }

    @Override
    public BookingResponse renewBooking(UUID id, int extraMonths) {
        Booking booking = bookingRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        LocalDate currentEnd = booking.getEndDate() != null ? booking.getEndDate() : LocalDate.now();
        booking.setEndDate(currentEnd.plusMonths(extraMonths));
        booking.setRentalMonths((booking.getRentalMonths() != null ? booking.getRentalMonths() : 0) + extraMonths);
        booking = bookingRepository.save(booking);

        return mapToResponse(booking);
    }

    @Override
    public BookingResponse remoteUnlock(UUID id) {
        Booking booking = bookingRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        if (booking.getStorageUnit() != null && booking.getStorageUnit().getStatus() == UnitStatus.OVERDUE_LOCKED) {
            throw new AppException(ErrorCode.UNIT_OVERDUE_LOCKED);
        }

        // Trigger IoT signal simulation
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

        if (booking.getStatus() == BookingStatus.OVERDUE) {
            throw new AppException(ErrorCode.UNIT_OVERDUE_LOCKED);
        }

        if (booking.getStatus() != BookingStatus.ACTIVE || booking.getAccessPin() == null) {
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

        if (booking.getStatus() == BookingStatus.OVERDUE) {
            throw new AppException(ErrorCode.UNIT_OVERDUE_LOCKED);
        }

        if (booking.getStatus() != BookingStatus.ACTIVE) {
            throw new AppException(ErrorCode.BOOKING_NOT_CHECKED_IN);
        }

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
        if (booking.getStatus() != BookingStatus.CONFIRMED && booking.getStatus() != BookingStatus.ACTIVE) {
            throw new AppException(ErrorCode.BOOKING_NOT_CHECKED_IN);
        }
        if (booking.getAccessPin() == null || booking.getQrAccessToken() == null) {
            throw new AppException(ErrorCode.BOOKING_NOT_CHECKED_IN);
        }
        UUID currentUserId = requestContext != null ? requestContext.currentUserId() : null;
        if (currentUserId != null && booking.getCustomer() != null && !booking.getCustomer().getId().equals(currentUserId)) {
            String role = requestContext.currentUserRole();
            if (!"ADMIN".equalsIgnoreCase(role) && !"FACILITY_MANAGER".equalsIgnoreCase(role) && !"STAFF".equalsIgnoreCase(role)) {
                throw new AppException(ErrorCode.FORBIDDEN);
            }
        }
        return BookingAccessCredentialsResponse.builder()
                .accessPin(booking.getAccessPin())
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
            // CONFIRMED reservations or reservations with paid deposits that missed their check-in deadline become OVERDUE.
            // Pure unconfirmed/unpaid hold requests become CANCELLED.
            BookingStatus resultingStatus = (booking.getStatus() == BookingStatus.CONFIRMED || (hasPaidPayment && isCheckInExpired))
                    ? BookingStatus.OVERDUE
                    : BookingStatus.CANCELLED;

            booking.setStatus(resultingStatus);
            booking.setPaymentExpiresAt(null);
            if (resultingStatus == BookingStatus.CANCELLED && !"PAID".equalsIgnoreCase(booking.getPaymentStatus())) {
                booking.setPaymentStatus("UNPAID");
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
                        String.format("Lịch hẹn giữ chỗ kho %s đã chuyển sang %s do quá hạn check-in / giữ chỗ (Ngày hẹn: %s); kho đã được giải phóng tự động.",
                                booking.getBookingCode(), resultingStatus, booking.getExpectedCheckInAt()),
                        null,
                        resultingStatus
                );
            }
        }
    }

    private BookingResponse mapToResponse(Booking b) {
        BigDecimal initialPaymentAmount = b.getTotalRentalFee() != null && b.getRentalMonths() != null && b.getRentalMonths() > 0
                ? b.getTotalRentalFee().divide(BigDecimal.valueOf(b.getRentalMonths()), 2, java.math.RoundingMode.HALF_UP).add(
                        b.getDepositAmount() != null ? b.getDepositAmount() : BigDecimal.ZERO)
                : BigDecimal.ZERO;
        String assignedStaffName = null;
        if (b.getHandedOverByStaffId() != null) {
            assignedStaffName = userRepository.findById(b.getHandedOverByStaffId())
                    .map(u -> u.getFullName() != null ? u.getFullName() : u.getUsername())
                    .orElse(null);
        }

        Integer policyHoldGraceHours = null;
        if (b.getStorageUnit() != null && b.getStorageUnit().getFacility() != null) {
            FacilityPolicy policy = facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(b.getStorageUnit().getFacility().getId()).orElse(null);
            if (policy != null) {
                policyHoldGraceHours = policy.getHoldGraceHours();
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

        return BookingResponse.builder()
                .id(b.getId())
                .bookingCode(b.getBookingCode())
                .customerId(b.getCustomer() != null ? b.getCustomer().getId() : null)
                .customerName(b.getCustomer() != null ? b.getCustomer().getFullName() : null)
                .customerPhone(b.getCustomer() != null ? b.getCustomer().getPhone() : null)
                .customerEmail(b.getCustomer() != null ? b.getCustomer().getEmail() : null)
                .storageUnitId(b.getStorageUnit() != null ? b.getStorageUnit().getId() : null)
                .unitCode(b.getStorageUnit() != null ? b.getStorageUnit().getUnitCode() : null)
                .facilityName(b.getStorageUnit() != null && b.getStorageUnit().getFacility() != null
                        ? b.getStorageUnit().getFacility().getName()
                        : null)
                .floorLevel(b.getStorageUnit() != null ? b.getStorageUnit().getFloorLevel() : null)
                .startDate(b.getStartDate())
                .endDate(b.getEndDate())
                .rentalMonths(b.getRentalMonths())
                .totalRentalFee(b.getTotalRentalFee())
                .depositPaid(b.getDepositPaid())
                .depositAmount(b.getDepositAmount())
                .initialPaymentAmount(initialPaymentAmount)
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
                .accessPin(b.getAccessPin())
                .qrAccessToken(b.getQrAccessToken())
                .handoverTime(b.getHandoverTime())
                .returnTime(b.getReturnTime())
                .build();
    }
}

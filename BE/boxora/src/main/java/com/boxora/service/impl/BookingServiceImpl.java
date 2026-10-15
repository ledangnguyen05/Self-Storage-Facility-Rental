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
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
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

        if (unit.getFacility() != null) {
            FacilityPolicy policy = facilityPolicyRepository.findByFacility_Id(unit.getFacility().getId())
                    .orElse(null);
            if (policy != null && policy.getMinimumRentalMonths() != null && months < policy.getMinimumRentalMonths()) {
                throw new AppException(ErrorCode.BOOKING_MINIMUM_DURATION_INVALID);
            }
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

        // 9. Khởi tạo Booking ở trạng thái PENDING_PAYMENT (thời hạn giữ chỗ 24h)
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
                .paymentExpiresAt(Instant.now().plusSeconds(softLockHours * 3600))
                .status((request.getSigningMethod() != null && "DIRECT".equalsIgnoreCase(request.getSigningMethod().trim())) ? BookingStatus.PENDING_APPROVAL : BookingStatus.PENDING_PAYMENT)
                .signingMethod(request.getSigningMethod() != null && !request.getSigningMethod().isBlank() ? request.getSigningMethod().trim().toUpperCase() : "ONLINE")
                .accessPin(null) // Chưa cấp PIN trước khi bàn giao
                .qrAccessToken(null) // Chưa cấp QR trước khi bàn giao
                .build();

        // 10. Chuyển ngăn kho sang RESERVED để giữ chỗ mềm
        unit.setStatus(UnitStatus.RESERVED);
        storageUnitRepository.save(unit);

        booking = bookingRepository.save(booking);

        // 11. Thực hiện Soft-lock 24 giờ trên Redis cho ngăn kho (tối ưu hóa)
        try {
            storageUnitLockService.tryLockUnit(unit.getId(), booking.getId(), softLockHours);
        } catch (Exception e) {
            log.warn("[REDIS_OPTIMIZATION_BYPASS] Redis lock acquisition error for unit {}: {}. Authoritative DB lock and RESERVED status are active.",
                    unit.getId(), e.getMessage());
        }

        // 12. Ghi Activity Log
        UUID facilityId = (unit.getFacility() != null) ? unit.getFacility().getId() : null;
        activityLogService.record(
                facilityId,
                ActivityAction.RESERVATION_CREATE,
                "Booking",
                booking.getId(),
                String.format("Tạo yêu cầu thuê kho %s thành công. Trạng thái: %s. Hết hạn giữ chỗ sau %d giờ.",
                        code, booking.getStatus(), softLockHours),
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
    @Transactional(readOnly = true)
    public List<BookingResponse> getMyBookings(UUID customerId) {
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

    @Scheduled(fixedDelay = 60_000L)
    @Transactional
    public void expireUnpaidBookings() {
        Instant now = Instant.now();
        List<Booking> candidates = new java.util.ArrayList<>();
        candidates.addAll(bookingRepository.findByStatusAndPaymentExpiresAtBefore(
                BookingStatus.PENDING_APPROVAL, now));
        candidates.addAll(bookingRepository.findByStatusAndPaymentExpiresAtBefore(
                BookingStatus.PENDING_PAYMENT, now));

        for (Booking candidate : candidates) {
            // Lock booking row to serialize against concurrent payment returns / IPN webhooks
            Booking booking = bookingRepository.findByIdForUpdate(candidate.getId()).orElse(null);
            if (booking == null) {
                continue;
            }

            // Idempotency: skip if already cancelled or moved out of pending status
            if (booking.getStatus() == BookingStatus.CANCELLED) {
                continue;
            }
            if (booking.getStatus() != BookingStatus.PENDING_PAYMENT && booking.getStatus() != BookingStatus.PENDING_APPROVAL) {
                continue;
            }

            // Check if payment was marked PAID in a race condition
            boolean hasPaidPayment = paymentRepository.existsByBooking_IdAndStatus(booking.getId(), PaymentStatus.PAID);
            if (hasPaidPayment) {
                log.info("[EXPIRE_RECONCILE] Booking {} has PAID payment; reconciling to CONFIRMED instead of CANCELLED", booking.getBookingCode());
                booking.setStatus(BookingStatus.CONFIRMED);
                booking.setPaymentExpiresAt(null);
                bookingRepository.save(booking);
                if (booking.getStorageUnit() != null) {
                    storageUnitLockService.releaseLock(booking.getStorageUnit().getId());
                }
                continue;
            }

            // Atomically expire and cancel booking
            booking.setStatus(BookingStatus.CANCELLED);
            booking.setPaymentExpiresAt(null);
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
                        log.info("[EXPIRE_JOB] Released storage unit {} back to AVAILABLE for cancelled booking {}", unit.getUnitCode(), booking.getBookingCode());
                    }
                }
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

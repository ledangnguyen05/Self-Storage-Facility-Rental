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
import com.boxora.event.BookingCreatedEvent;
import com.boxora.enums.ActivityAction;
import com.boxora.enums.BookingStatus;
import com.boxora.enums.UnitStatus;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.repository.BookingRepository;
import com.boxora.repository.FacilityPolicyRepository;
import com.boxora.repository.StorageUnitRepository;
import com.boxora.repository.UserRepository;
import com.boxora.security.FacilityAccessGuard;
import com.boxora.security.RequestContext;
import com.boxora.service.ActivityLogService;
import com.boxora.service.BookingService;
import com.boxora.service.EncryptionService;
import com.boxora.service.StorageUnitLockService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
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
    private final FacilityAccessGuard facilityAccessGuard;
    private final EncryptionService encryptionService;
    private final RequestContext requestContext;
    private final ApplicationEventPublisher eventPublisher;
    private final org.springframework.beans.factory.ObjectProvider<com.boxora.service.ContractSigningService> contractSigningServiceProvider;

    @Value("${app.booking.soft-lock-hours:1}")
    private long softLockHours;

    @Value("${app.booking.max-advance-days:30}")
    private int maxAdvanceDays;

    @Value("${app.booking.payment-timeout-minutes:15}")
    private int paymentTimeoutMinutes;

    @Override
    public BookingResponse createBooking(BookingCreateRequest request) {
        StorageUnit unit = storageUnitRepository.findWithDetailsById(request.getStorageUnitId())
                .orElseThrow(() -> new AppException(ErrorCode.STORAGE_UNIT_NOT_FOUND));

        // 1. Kiểm tra trạng thái ngăn kho trong database
        if (unit.getStatus() != UnitStatus.AVAILABLE) {
            throw new AppException(ErrorCode.STORAGE_UNIT_NOT_AVAILABLE);
        }

        // 2. Kiểm tra Soft-lock trong Redis (ngăn ngừa 2 khách cùng đặt 1 kho cùng lúc)
        if (storageUnitLockService.isUnitLocked(unit.getId())) {
            log.warn("[SOFT_LOCK] Storage unit {} is already locked in Redis", unit.getId());
            throw new AppException(ErrorCode.STORAGE_UNIT_SOFT_LOCKED);
        }

        // 3. Validation ngày bắt đầu (< 30 ngày so với hôm nay và >= hôm nay)
        LocalDate startDate = request.getStartDate() != null ? request.getStartDate() : LocalDate.now();
        LocalDate today = LocalDate.now();

        if (startDate.isBefore(today)) {
            throw new AppException(ErrorCode.BOOKING_START_DATE_PAST);
        }

        if (startDate.isAfter(today.plusDays(maxAdvanceDays))) {
            throw new AppException(ErrorCode.BOOKING_ADVANCE_NOTICE_EXCEEDED);
        }

        // 4. Validation thời gian thuê (rentalMonths >= 1 và tuân theo chính sách cơ sở)
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

        // 5. Xác định khách hàng
        User customer = null;
        if (request.getCustomerId() != null) {
            customer = userRepository.findById(request.getCustomerId())
                    .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        } else if (requestContext != null && requestContext.currentUserId() != null) {
            customer = userRepository.findById(requestContext.currentUserId())
                    .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        } else {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }

        // 6. Tính toán đơn giá và tiền cọc
        BigDecimal pricePerMonth = unit.getEffectiveBasePrice() != null
                ? unit.getEffectiveBasePrice()
                : new BigDecimal("1450000");

        BigDecimal totalFee = request.getTotalRentalFee() != null
                ? request.getTotalRentalFee()
                : pricePerMonth.multiply(BigDecimal.valueOf(months));

        BigDecimal deposit = request.getDepositPaid() != null
                ? request.getDepositPaid()
                : ((unit.getUnitType() != null && unit.getUnitType().getDepositAmount() != null)
                        ? unit.getUnitType().getDepositAmount()
                        : pricePerMonth);

        // 7. Tạo mã đặt kho
        String code = "BX-" + (2025 + new Random().nextInt(2)) + "-" + String.format("%04d", new Random().nextInt(10000));
        UUID bookingId = UUID.randomUUID();

<<<<<<< Updated upstream
        // 8. Tạo booking chờ quản lý duyệt hoặc chờ thanh toán tùy luồng đặt kho.
=======
        // 9. Xác định ngày/giờ nhận kho dự kiến (expectedCheckInAt)
        LocalDateTime expectedCheckInAt = request.getExpectedCheckInAt();
        if (expectedCheckInAt == null && request.getCheckInTime() != null && !request.getCheckInTime().isBlank()) {
            try {
                java.time.LocalTime checkInTime = java.time.LocalTime.parse(request.getCheckInTime().trim());
                expectedCheckInAt = startDate.atTime(checkInTime);
            } catch (java.time.format.DateTimeParseException ex) {
                throw new AppException(ErrorCode.INVALID_REQUEST, "Check-in appointment time must use HH:mm or HH:mm:ss.");
            }
        }
        if (expectedCheckInAt == null) {
            expectedCheckInAt = startDate.atTime(LocalTime.of(9, 0));
        }

        // Validate: Lịch hẹn nhận kho phải cách thời điểm hiện tại ít nhất 5 tiếng để cơ sở kịp chuẩn bị kho
        LocalDateTime minAllowedCheckIn = LocalDateTime.now(BUSINESS_ZONE).plusHours(5);
        if (expectedCheckInAt.isBefore(minAllowedCheckIn)) {
            DateTimeFormatter dtf = DateTimeFormatter.ofPattern("HH:mm dd/MM/yyyy");
            throw new AppException(ErrorCode.INVALID_REQUEST,
                    String.format("Lịch hẹn nhận kho (%s) phải cách thời điểm hiện tại ít nhất 5 tiếng để cơ sở kịp chuẩn bị kho (sớm nhất có thể chọn: %s).",
                            expectedCheckInAt.format(dtf),
                            minAllowedCheckIn.format(dtf)));
        }

        // 10. Xác định chính sách giữ chỗ và thời hạn giữ chỗ (holdExpiresAt)
        int holdGraceHours = resolveHoldGraceHours(activePolicy);
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
            Instant appointmentInstant = expectedCheckInAt != null
                    ? expectedCheckInAt.atZone(BUSINESS_ZONE).toInstant()
                    : now;
            holdExpiresAt = appointmentInstant.plus(java.time.Duration.ofHours(holdGraceHours));
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

        String idNumber = request.getIdentityCardNumber() != null && !request.getIdentityCardNumber().isBlank()
                ? request.getIdentityCardNumber().trim()
                : null;
        String idType = request.getIdentityCardType() != null && !request.getIdentityCardType().isBlank()
                ? request.getIdentityCardType().trim()
                : "CCCD";

>>>>>>> Stashed changes
        Booking booking = Booking.builder()
                .bookingCode(code)
                .customer(customer)
                .storageUnit(unit)
                .startDate(startDate)
                .expectedArrivalAt(request.getExpectedArrivalAt())
                .endDate(endDate)
                .rentalMonths(months)
                .totalRentalFee(totalFee)
                .depositPaid(request.getDepositPaid() != null ? request.getDepositPaid() : BigDecimal.ZERO)
                .depositAmount(deposit)
                .paymentExpiresAt(Instant.now().plusSeconds(approvalTimeoutHours * 60 * 60))
                .status(Boolean.TRUE.equals(request.getRequiresManagerApproval())
                        || "IN_PERSON".equalsIgnoreCase(request.getSigningMethod())
                        ? BookingStatus.PENDING_APPROVAL
                        : BookingStatus.PENDING_PAYMENT)
                .signingMethod(request.getSigningMethod() != null && !request.getSigningMethod().isBlank() ? request.getSigningMethod().trim().toUpperCase() : "ONLINE")
                .accessPin(null) // Chưa cấp PIN trước khi thanh toán
                .qrAccessToken(null) // Chưa cấp QR trước khi thanh toán
                .build();

        // 9. Chuyển ngăn kho sang RESERVED để giữ chỗ mềm
        unit.setStatus(UnitStatus.RESERVED);
        storageUnitRepository.save(unit);

        booking = bookingRepository.save(booking);
        eventPublisher.publishEvent(new BookingCreatedEvent(booking.getId()));

        // 10. Thực hiện Soft-lock 24 giờ trên Redis cho ngăn kho
        storageUnitLockService.tryLockUnit(unit.getId(), booking.getId(), softLockHours);

        // 11. Ghi Activity Log
        UUID facilityId = (unit.getFacility() != null) ? unit.getFacility().getId() : null;
        activityLogService.record(
                facilityId,
                ActivityAction.RESERVATION_CREATE,
                "Booking",
                booking.getId(),
                String.format("Tạo yêu cầu thuê kho %s, chờ quản lý duyệt trong tối đa %d giờ. Trạng thái: PENDING_APPROVAL",
                        code, approvalTimeoutHours),
                null,
                BookingStatus.PENDING_APPROVAL
        );

        return mapToCustomerVisibleResponse(booking);
    }

    @Override
    @Transactional(readOnly = true)
    public List<BookingResponse> getMyBookingRequests() {
        UUID customerId = requestContext != null ? requestContext.currentUserId() : null;
        if (customerId == null) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }
        return bookingRepository.findByCustomer_Id(customerId).stream()
                .filter(booking -> booking.getStatus() == BookingStatus.CANCELLED)
                .sorted((left, right) -> right.getCreatedAt().compareTo(left.getCreatedAt()))
                .map(booking -> {
                    BookingResponse response = mapToCustomerVisibleResponse(booking);
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
        if (booking.getStatus() != BookingStatus.PENDING_APPROVAL) {
            throw new AppException(ErrorCode.BOOKING_REQUEST_NOT_PENDING_APPROVAL);
        }

        StorageUnit unit = booking.getStorageUnit();
        UUID facilityId = unit != null && unit.getFacility() != null ? unit.getFacility().getId() : null;
        if (facilityId != null) {
            facilityAccessGuard.checkFacilityAccess(facilityId);
        }

        Instant now = Instant.now();
        if (booking.getPaymentExpiresAt() != null && !booking.getPaymentExpiresAt().isAfter(now)) {
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
<<<<<<< Updated upstream
=======
        bookings = restrictBookingsToCurrentFacility(bookings);
        if ("CUSTOMER".equalsIgnoreCase(role)) {
            bookings = bookings.stream()
                    .filter(booking -> booking.getStatus() != BookingStatus.PENDING_PAYMENT
                            && booking.getStatus() != BookingStatus.PENDING_APPROVAL)
                    .collect(Collectors.toList());
        }
>>>>>>> Stashed changes
        return bookings.stream()
                .sorted((b1, b2) -> {
                    if (b1.getCreatedAt() != null && b2.getCreatedAt() != null) {
                        return b2.getCreatedAt().compareTo(b1.getCreatedAt());
                    }
                    return 0;
                })
                .map(this::mapToCustomerVisibleResponse)
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
                .filter(b -> b.getStatus() == BookingStatus.CONFIRMED || b.getStatus() == BookingStatus.ACTIVE || b.getStatus() == BookingStatus.PENDING_PAYMENT || b.getStatus() == BookingStatus.OVERDUE)
                .map(b -> {
                    BookingResponse resp = mapToCustomerVisibleResponse(b);
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
<<<<<<< Updated upstream
        return list.stream().map(this::mapToResponse).collect(Collectors.toList());
=======
    }

    @Override
    @Transactional
    public BookingResponse claimCheckInReception(UUID bookingId) {
        if (bookingId == null) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Mã lượt đặt kho không hợp lệ");
        }
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        if (booking.getStorageUnit() != null && booking.getStorageUnit().getFacility() != null) {
            facilityAccessGuard.checkFacilityAccess(booking.getStorageUnit().getFacility().getId());
        }

        UUID currentUserId = requestContext != null ? requestContext.currentUserId() : null;
        String role = requestContext != null ? requestContext.currentUserRole() : null;
        if (currentUserId == null || role == null) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }

        if (!"STAFF".equalsIgnoreCase(role) && !"FACILITY_MANAGER".equalsIgnoreCase(role)) {
            throw new AppException(ErrorCode.FORBIDDEN, "Chỉ nhân viên hoặc quản lý cơ sở mới có quyền tiếp nhận lượt khách check-in.");
        }

        User currentUser = userRepository.findById(currentUserId)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        // Nếu đã có nhân viên khác tiếp nhận
        if (booking.getHandedOverByStaffId() != null && !booking.getHandedOverByStaffId().equals(currentUserId)) {
            String currentAssignee = userRepository.findById(booking.getHandedOverByStaffId())
                    .map(u -> u.getFullName() != null ? u.getFullName() : u.getUsername())
                    .orElse("nhân sự khác");
            throw new AppException(ErrorCode.INVALID_REQUEST, "Lượt check-in này đã được " + currentAssignee + " tiếp nhận.");
        }

        // Phân quyền: chỉ khi staff hoặc facility manager có ca làm trong ngày có lịch checkin của khách và đã checkin vào ca rồi thì mới có thể tiếp nhận
        LocalDate checkInDate = booking.getExpectedCheckInAt() != null
                ? booking.getExpectedCheckInAt().toLocalDate()
                : booking.getStartDate();

        UUID facId = booking.getStorageUnit() != null && booking.getStorageUnit().getFacility() != null
                ? booking.getStorageUnit().getFacility().getId()
                : null;

        List<StaffAssignment> myAssignments = staffAssignmentRepository.findByStaff_IdAndAssignedDate(currentUserId, checkInDate);
        boolean hasCheckedInShift = myAssignments.stream().anyMatch(a -> {
            boolean facMatch = facId == null || a.getFacility() == null || facId.equals(a.getFacility().getId());
            boolean checkedIn = a.getStatus() == StaffAssignmentStatus.CHECKED_IN
                    || (a.getCheckedInAt() != null && a.getCheckedOutAt() == null);
            return facMatch && checkedIn;
        });

        if (!hasCheckedInShift) {
            throw new AppException(ErrorCode.FORBIDDEN,
                    "Bạn chỉ có thể tiếp nhận khách khi có ca làm việc vào ngày hẹn check-in ("
                            + checkInDate + ") tại cơ sở và đã điểm danh vào ca trực.");
        }

        booking.setHandedOverByStaffId(currentUserId);
        String claimTimeStr = LocalDateTime.now().format(DateTimeFormatter.ofPattern("HH:mm dd/MM/yyyy"));
        booking.setStaffAssignmentNotes("Tiếp nhận tiếp đón bởi " + currentUser.getFullName() + " lúc " + claimTimeStr);
        booking = bookingRepository.save(booking);

        return mapOperationalBookingResponse(booking);
    }

    @Override
    @Transactional(readOnly = true)
    public List<BookingResponse> getBookings(UUID customerId, BookingStatus status, UUID facilityId) {
        UUID currentUserId = requestContext != null ? requestContext.currentUserId() : null;
        if (currentUserId == null) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }

        String role = requestContext.currentUserRole();
        UUID effectiveCustomerId = customerId;
        UUID effectiveFacilityId = facilityId;

        if ("CUSTOMER".equalsIgnoreCase(role)) {
            if (customerId != null && !currentUserId.equals(customerId)) {
                throw new AppException(ErrorCode.FORBIDDEN);
            }
            effectiveCustomerId = currentUserId;
        }

        if (facilityAccessGuard.isFacilityScoped()) {
            UUID assignedFacilityId = facilityAccessGuard.scopedFacilityIdOrNull();
            if (effectiveFacilityId != null) {
                facilityAccessGuard.checkFacilityAccess(effectiveFacilityId);
            }
            effectiveFacilityId = assignedFacilityId;
        }

        List<Booking> source;
        if (effectiveCustomerId != null && effectiveFacilityId != null) {
            source = bookingRepository.findByCustomer_IdAndStorageUnit_Facility_Id(
                    effectiveCustomerId, effectiveFacilityId);
        } else if (effectiveCustomerId != null) {
            source = bookingRepository.findByCustomer_Id(effectiveCustomerId);
        } else if (effectiveFacilityId != null) {
            source = bookingRepository.findByStorageUnit_Facility_Id(effectiveFacilityId);
        } else {
            source = bookingRepository.findAll();
        }

        return source.stream()
                .filter(booking -> !"CUSTOMER".equalsIgnoreCase(role)
                        || (booking.getStatus() != BookingStatus.PENDING_PAYMENT
                        && booking.getStatus() != BookingStatus.PENDING_APPROVAL))
                .filter(booking -> status == null || booking.getStatus() == status)
                .sorted((left, right) -> {
                    if (left.getCreatedAt() != null && right.getCreatedAt() != null) {
                        return right.getCreatedAt().compareTo(left.getCreatedAt());
                    }
                    return 0;
                })
                .map(this::mapOperationalBookingResponse)
                .collect(Collectors.toList());
    }

    private List<Booking> restrictBookingsToCurrentFacility(List<Booking> bookings) {
        if (!facilityAccessGuard.isFacilityScoped()) {
            return bookings;
        }
        UUID assignedFacilityId = facilityAccessGuard.scopedFacilityIdOrNull();
        return bookings.stream()
                .filter(booking -> booking.getStorageUnit() != null
                        && booking.getStorageUnit().getFacility() != null
                        && assignedFacilityId.equals(booking.getStorageUnit().getFacility().getId()))
                .collect(Collectors.toList());
    }

    private BookingResponse mapOperationalBookingResponse(Booking booking) {
        BookingResponse response = mapToCustomerVisibleResponse(booking);
        response.setAccessPin(null);
        response.setQrAccessToken(null);
        return response;
>>>>>>> Stashed changes
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
        UUID facilityId = booking.getStorageUnit() != null && booking.getStorageUnit().getFacility() != null
                ? booking.getStorageUnit().getFacility().getId() : null;
        if (facilityId != null) {
            facilityAccessGuard.checkFacilityAccess(facilityId);
        }
<<<<<<< Updated upstream
        return mapToResponse(booking);
=======
        validateBookingAccess(booking, currentUser);

        return mapToCustomerVisibleResponse(booking);
>>>>>>> Stashed changes
    }

    @Override
    public BookingPinResponse getBookingPin(UUID id, String currentUserEmail) {
        Booking booking = bookingRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        User currentUser = currentUserEmail != null ? userRepository.findByEmail(currentUserEmail).orElse(null) : null;
        validateBookingAccess(booking, currentUser);

        // Decrypt AES-256-GCM PIN
        String rawPin = booking.getAccessPin();
        String decryptedPin = (rawPin != null && !rawPin.isBlank()) ? encryptionService.decrypt(rawPin) : null;

        if (currentUser != null) {
            activityLogService.recordForUser(
                    currentUser.getId(),
                    ActivityAction.ACCESS_CREDENTIAL_ISSUE,
                    "Booking",
                    booking.getId(),
                    "Truy vấn xem mã PIN bảo mật AES-256-GCM cho đặt kho #" + booking.getBookingCode(),
                    null,
                    booking.getBookingCode()
            );
        }

        return BookingPinResponse.builder()
                .bookingId(booking.getId())
                .bookingCode(booking.getBookingCode())
                .unitCode(booking.getStorageUnit() != null ? booking.getStorageUnit().getUnitCode() : null)
                .pin(decryptedPin != null ? decryptedPin : "882914")
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
        Booking booking = bookingRepository.findFirstByStorageUnit_IdOrderByCreatedAtDesc(unitId).orElse(null);

        if (booking == null) {
            StorageUnit unit = storageUnitRepository.findById(unitId)
                    .orElseThrow(() -> new AppException(ErrorCode.STORAGE_UNIT_NOT_FOUND));

            return BookingPinResponse.builder()
                    .bookingId(null)
                    .bookingCode("UNIT-" + unit.getUnitCode())
                    .unitCode(unit.getUnitCode())
                    .pin("882914")
                    .qrAccessToken(null)
                    .pinUpdatedAt(LocalDateTime.now())
                    .build();
        }

        return getBookingPin(booking.getId(), currentUserEmail);
    }

    @Override
    public BookingPinResponse updateBookingPinByUnitId(UUID unitId, UpdatePinRequest request, String currentUserEmail) {
        Booking booking = bookingRepository.findFirstByStorageUnit_IdOrderByCreatedAtDesc(unitId).orElse(null);

        if (booking == null) {
            StorageUnit unit = storageUnitRepository.findById(unitId)
                    .orElseThrow(() -> new AppException(ErrorCode.STORAGE_UNIT_NOT_FOUND));

            User currentUser = currentUserEmail != null ? userRepository.findByEmail(currentUserEmail).orElse(null) : null;
            User customer = currentUser;
            if (customer == null || (customer.getRole() != null && !"CUSTOMER".equalsIgnoreCase(customer.getRole().getName()))) {
                customer = userRepository.findAll().stream()
                        .filter(u -> u.getRole() != null && "CUSTOMER".equalsIgnoreCase(u.getRole().getName()))
                        .findFirst()
                        .orElse(currentUser);
            }

            booking = Booking.builder()
                    .bookingCode("BK-" + (System.currentTimeMillis() % 1000000))
                    .customer(customer)
                    .storageUnit(unit)
                    .startDate(LocalDate.now())
                    .endDate(LocalDate.now().plusMonths(1))
                    .rentalMonths(1)
                    .totalRentalFee(unit.getEffectiveBasePrice() != null ? unit.getEffectiveBasePrice() : BigDecimal.ZERO)
                    .depositPaid(BigDecimal.ZERO)
                    .status(BookingStatus.ACTIVE)
                    .accessCode("BX-" + (System.currentTimeMillis() % 100000))
                    .build();
            booking = bookingRepository.save(booking);
        }

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

<<<<<<< Updated upstream
=======
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
        int holdGraceHours = resolveHoldGraceHours(policy);
        LocalDate today = LocalDate.now(BUSINESS_ZONE);
        LocalDate allowedMinDate = today;
        LocalDate allowedMaxDate = today.plusDays(maxDays);

        LocalTime openTime = (facility != null && facility.getOpenTime() != null) ? facility.getOpenTime() : LocalTime.of(0, 0);
        LocalTime closeTime = (facility != null && facility.getCloseTime() != null) ? facility.getCloseTime() : LocalTime.of(23, 59);

        List<String> restrictions = new ArrayList<>();
        restrictions.add("Hệ thống kho Boxora hỗ trợ ra vào và check-in 24/7.");
        restrictions.add("Giờ hẹn check-in mới phải cách thời điểm hiện tại ít nhất 5 tiếng để cơ sở kịp chuẩn bị kho.");
        restrictions.add(String.format("Thời hạn dời lịch tối đa %d ngày kể từ hôm nay (đến %s)", maxDays, allowedMaxDate.format(DateTimeFormatter.ofPattern("dd/MM/yyyy"))));
        restrictions.add(String.format("Thời gian giữ chỗ: Giữ kho thêm %d giờ sau thời điểm hẹn nhận kho", holdGraceHours));
        restrictions.add("Đổi lịch không phát sinh phụ phí, không làm thay đổi giá thuê, tiền cọc hay thời hạn thuê đã thỏa thuận.");
        if (contractSigned) {
            restrictions.add("Hợp đồng đã ký điện tử sẽ được bảo lưu trọn vẹn giá trị pháp lý và chữ ký. Ngày hiệu lực tính phí thuê sẽ kích hoạt tại thời điểm bàn giao thực tế tại cơ sở.");
        }

        LocalDateTime currentAppointmentAt = booking.getExpectedCheckInAt();

        BigDecimal monthlyFee = booking.getTotalRentalFee() != null && booking.getRentalMonths() != null && booking.getRentalMonths() > 0
                ? booking.getTotalRentalFee().divide(BigDecimal.valueOf(booking.getRentalMonths()), 2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        return BookingRescheduleEligibilityResponse.builder()
                .bookingId(booking.getId())
                .bookingCode(booking.getBookingCode())
                .unitCode("CUSTOMER".equalsIgnoreCase(requestContext != null ? requestContext.currentUserRole() : null)
                        && booking.getHandoverTime() == null
                        ? null
                        : unit != null ? unit.getUnitCode() : null)
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

        LocalDate today = LocalDate.now(BUSINESS_ZONE);
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
                    if (parts.length > 2) throw new IllegalArgumentException("Invalid time format");
                    int hour = Integer.parseInt(parts[0]);
                    int minute = parts.length > 1 ? Integer.parseInt(parts[1]) : 0;
                    newExpectedCheckIn = newStartDate.atTime(hour, minute);
                } catch (Exception e) {
                    throw new AppException(ErrorCode.INVALID_REQUEST, "A valid check-in appointment time is required");
                }
            } else {
                throw new AppException(ErrorCode.INVALID_REQUEST, "A check-in appointment time is required");
            }
        }

        // Hệ thống kho Boxora hỗ trợ tiếp nhận check-in và ra vào linh hoạt 24/7
        // Validate: Giờ hẹn check-in mới phải cách thời điểm hiện tại ít nhất 5 tiếng để cơ sở kịp chuẩn bị kho
        LocalDateTime minAllowedCheckIn = LocalDateTime.now(BUSINESS_ZONE).plusHours(5);
        if (newExpectedCheckIn.isBefore(minAllowedCheckIn)) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Giờ hẹn check-in mới phải cách thời điểm hiện tại ít nhất 5 tiếng để cơ sở kịp chuẩn bị kho.");
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

        int holdGraceHours = resolveHoldGraceHours(policy);
        Instant now = Instant.now();
        Instant appointmentInstant = newExpectedCheckIn.atZone(BUSINESS_ZONE).toInstant();
        Instant newHoldExpiresAt = appointmentInstant.plus(java.time.Duration.ofHours(holdGraceHours));
        Instant maxHoldLimit = now.plus(java.time.Duration.ofDays(maxDays + 2));
        if (newHoldExpiresAt.isAfter(maxHoldLimit)) {
            newHoldExpiresAt = maxHoldLimit;
        }

        LocalDateTime prevAppt = booking.getExpectedCheckInAt();
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
                .requestTimestamp(LocalDateTime.now(BUSINESS_ZONE))
                .reason(request.getReason() != null && !request.getReason().isBlank() ? request.getReason() : "Khách hàng đổi lịch hẹn nhận kho")
                .processor(requesterUser)
                .processorRole(requesterRole != null ? requesterRole : "SYSTEM")
                .processedAt(LocalDateTime.now(BUSINESS_ZONE))
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
        String previousAppointmentText = prevAppt == null
                ? "not recorded"
                : prevAppt.format(DateTimeFormatter.ofPattern("HH:mm dd/MM/yyyy"));
        activityLogService.record(
                facilityId,
                ActivityAction.CHECKIN_RESCHEDULE,
                "Booking",
                booking.getId(),
                String.format("Đổi lịch hẹn nhận kho %s từ %s sang %s. Hạn giữ chỗ mới: %s. Lý do: %s",
                        booking.getBookingCode(),
                        previousAppointmentText,
                        newExpectedCheckIn.format(DateTimeFormatter.ofPattern("HH:mm dd/MM/yyyy")),
                        newHoldExpiresAt,
                        request.getReason() != null ? request.getReason() : "N/A"),
                null,
                booking.getStatus()
        );

        BookingResponse bookingResp = mapToCustomerVisibleResponse(booking);
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

>>>>>>> Stashed changes
    @Scheduled(fixedDelay = 60_000L)
    public void expireUnpaidBookings() {
        Instant now = Instant.now();
<<<<<<< Updated upstream
        List<Booking> expiredBookings = new java.util.ArrayList<>();
        expiredBookings.addAll(bookingRepository.findByStatusAndPaymentExpiresAtBefore(
                BookingStatus.PENDING_APPROVAL, now));
        expiredBookings.addAll(bookingRepository.findByStatusAndPaymentExpiresAtBefore(
                BookingStatus.PENDING_PAYMENT, now));
        for (Booking booking : expiredBookings) {
            booking.setStatus(BookingStatus.CANCELLED);
=======
        LocalDateTime checkInThreshold = LocalDateTime.now(BUSINESS_ZONE);
        LocalDate todayThreshold = LocalDate.now(BUSINESS_ZONE);
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
                int graceHours = 1;
                if (booking.getStorageUnit() != null && booking.getStorageUnit().getFacility() != null) {
                    graceHours = facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(booking.getStorageUnit().getFacility().getId())
                            .map(this::resolveHoldGraceHours)
                            .orElse(1);
                }
                holdDeadline = booking.getExpectedCheckInAt()
                        .atZone(BUSINESS_ZONE)
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
                holdDeadline = booking.getStartDate().atTime(23, 59, 59).atZone(BUSINESS_ZONE).toInstant();
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
                booking.setPaymentStatus(resolveReconciledPaymentStatus(booking));
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
>>>>>>> Stashed changes
            booking.setPaymentExpiresAt(null);
            if (booking.getStorageUnit() != null && booking.getStorageUnit().getStatus() == UnitStatus.RESERVED) {
                booking.getStorageUnit().setStatus(UnitStatus.AVAILABLE);
                storageUnitRepository.save(booking.getStorageUnit());
                storageUnitLockService.releaseLock(booking.getStorageUnit().getId());
            }
            bookingRepository.save(booking);
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

<<<<<<< Updated upstream
=======
        Integer policyHoldGraceHours = null;
        if (b.getStorageUnit() != null && b.getStorageUnit().getFacility() != null) {
            FacilityPolicy policy = facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(b.getStorageUnit().getFacility().getId()).orElse(null);
            if (policy != null) {
                policyHoldGraceHours = resolveHoldGraceHours(policy);
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

>>>>>>> Stashed changes
        return BookingResponse.builder()
                .id(b.getId())
                .bookingCode(b.getBookingCode())
                .customerId(b.getCustomer() != null ? b.getCustomer().getId() : null)
                .customerName(b.getCustomer() != null ? b.getCustomer().getFullName() : "Nguyễn Văn An")
                .customerPhone(b.getCustomer() != null ? b.getCustomer().getPhone() : "0918 234 567")
                .customerEmail(b.getCustomer() != null ? b.getCustomer().getEmail() : "an.nguyen@gmail.com")
                .storageUnitId(b.getStorageUnit() != null ? b.getStorageUnit().getId() : null)
<<<<<<< Updated upstream
                .unitCode(b.getStorageUnit() != null ? b.getStorageUnit().getUnitCode() : "A-108")
=======
                .unitTypeId(b.getStorageUnit() != null && b.getStorageUnit().getUnitType() != null
                        ? b.getStorageUnit().getUnitType().getId()
                        : null)
                .unitTypeName(b.getStorageUnit() != null && b.getStorageUnit().getUnitType() != null
                        ? b.getStorageUnit().getUnitType().getTypeName()
                        : null)
                .unitCode(b.getStorageUnit() != null ? b.getStorageUnit().getUnitCode() : null)
                .facilityId(b.getStorageUnit() != null && b.getStorageUnit().getFacility() != null
                        ? b.getStorageUnit().getFacility().getId()
                        : null)
>>>>>>> Stashed changes
                .facilityName(b.getStorageUnit() != null && b.getStorageUnit().getFacility() != null
                        ? b.getStorageUnit().getFacility().getName()
                        : "Mega Central Tân Bình")
                .floorLevel(b.getStorageUnit() != null ? b.getStorageUnit().getFloorLevel() : "Tầng 1 - Khu A")
                .startDate(b.getStartDate())
                .expectedArrivalAt(b.getExpectedArrivalAt())
                .endDate(b.getEndDate())
                .rentalMonths(b.getRentalMonths())
                .totalRentalFee(b.getTotalRentalFee())
                .depositPaid(b.getDepositPaid())
                .depositAmount(b.getDepositAmount())
                .initialPaymentAmount(initialPaymentAmount)
                .paymentExpiresAt(b.getPaymentExpiresAt())
<<<<<<< Updated upstream
=======
                .holdStartedAt(b.getHoldStartedAt())
                .holdExpiresAt(b.getHoldExpiresAt() != null ? b.getHoldExpiresAt() : b.getPaymentExpiresAt())
                .expectedCheckInAt(b.getExpectedCheckInAt())
                .paymentStatus(paymentStatus)
                .holdGraceHours(policyHoldGraceHours != null ? policyHoldGraceHours : 1)
>>>>>>> Stashed changes
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

    private BookingResponse mapToCustomerVisibleResponse(Booking booking) {
        BookingResponse response = mapToResponse(booking);
        String role = requestContext != null ? requestContext.currentUserRole() : null;
        if ("CUSTOMER".equalsIgnoreCase(role) && booking.getHandoverTime() == null) {
            response.setUnitCode(null);
        }
        return response;
    }

    private int resolveHoldGraceHours(FacilityPolicy policy) {
        int configuredHours = policy != null && policy.getHoldGraceHours() != null
                ? policy.getHoldGraceHours()
                : 1;
        return Math.max(0, Math.min(configuredHours, 1));
    }
}

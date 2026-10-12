package com.boxora.service.impl;

import com.boxora.dto.request.BookingCreateRequest;
import com.boxora.dto.request.UpdatePinRequest;
import com.boxora.dto.response.BookingPinResponse;
import com.boxora.dto.response.BookingResponse;
import com.boxora.entity.Booking;
import com.boxora.entity.FacilityPolicy;
import com.boxora.entity.StorageUnit;
import com.boxora.entity.User;
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
import com.boxora.service.ActivityLogService;
import com.boxora.service.BookingService;
import com.boxora.service.EncryptionService;
import com.boxora.service.StorageUnitLockService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
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

    @Value("${app.booking.soft-lock-hours:24}")
    private long softLockHours;

    @Value("${app.booking.max-advance-days:30}")
    private int maxAdvanceDays;

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
            customer = userRepository.findById(request.getCustomerId()).orElse(null);
        }
        if (customer == null) {
            customer = userRepository.findAll().stream().findFirst().orElse(null);
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

        // 8. Thực hiện Soft-lock 24 giờ trên Redis cho ngăn kho
        boolean lockAcquired = storageUnitLockService.tryLockUnit(unit.getId(), bookingId, softLockHours);
        if (!lockAcquired) {
            throw new AppException(ErrorCode.STORAGE_UNIT_SOFT_LOCKED);
        }

        // 9. Khởi tạo Booking ở trạng thái PENDING_PAYMENT (chưa cấp PIN/QR)
        Booking booking = Booking.builder()
                .bookingCode(code)
                .customer(customer)
                .storageUnit(unit)
                .startDate(startDate)
                .endDate(endDate)
                .rentalMonths(months)
                .totalRentalFee(totalFee)
                .depositPaid(BigDecimal.ZERO) // Tiền cọc thực tế đã đóng = 0 cho tới khi thanh toán
                .status(BookingStatus.PENDING_PAYMENT)
                .accessPin(null) // Chưa cấp PIN trước khi thanh toán
                .qrAccessToken(null) // Chưa cấp QR trước khi thanh toán
                .build();
        booking.setId(bookingId);

        // 10. Chuyển ngăn kho sang RESERVED để giữ chỗ mềm
        unit.setStatus(UnitStatus.RESERVED);
        storageUnitRepository.save(unit);

        booking = bookingRepository.save(booking);

        // 11. Ghi Activity Log
        UUID facilityId = (unit.getFacility() != null) ? unit.getFacility().getId() : null;
        activityLogService.record(
                facilityId,
                ActivityAction.RESERVATION_CREATE,
                "Booking",
                booking.getId(),
                String.format("Tạo đơn đặt kho %s giữ chỗ mềm 24h qua Redis cho ngăn kho %s. Trạng thái: PENDING_PAYMENT",
                        code, unit.getUnitCode()),
                null,
                BookingStatus.PENDING_PAYMENT
        );

        return mapToResponse(booking);
    }

    @Override
    @Transactional(readOnly = true)
    public List<BookingResponse> getMyActiveBookings(UUID customerId) {
        List<Booking> bookings = bookingRepository.findAll();
        if (customerId != null) {
            bookings = bookings.stream()
                    .filter(b -> b.getCustomer() != null && customerId.equals(b.getCustomer().getId()))
                    .collect(Collectors.toList());
        }
        return bookings.stream().map(this::mapToResponse).collect(Collectors.toList());
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

    private BookingResponse mapToResponse(Booking b) {
        return BookingResponse.builder()
                .id(b.getId())
                .bookingCode(b.getBookingCode())
                .customerId(b.getCustomer() != null ? b.getCustomer().getId() : null)
                .customerName(b.getCustomer() != null ? b.getCustomer().getFullName() : "Nguyễn Văn An")
                .customerPhone(b.getCustomer() != null ? b.getCustomer().getPhone() : "0918 234 567")
                .customerEmail(b.getCustomer() != null ? b.getCustomer().getEmail() : "an.nguyen@gmail.com")
                .storageUnitId(b.getStorageUnit() != null ? b.getStorageUnit().getId() : null)
                .unitCode(b.getStorageUnit() != null ? b.getStorageUnit().getUnitCode() : "A-108")
                .facilityName(b.getStorageUnit() != null && b.getStorageUnit().getFacility() != null
                        ? b.getStorageUnit().getFacility().getName()
                        : "Mega Central Tân Bình")
                .floorLevel(b.getStorageUnit() != null ? b.getStorageUnit().getFloorLevel() : "Tầng 1 - Khu A")
                .startDate(b.getStartDate())
                .endDate(b.getEndDate())
                .rentalMonths(b.getRentalMonths())
                .totalRentalFee(b.getTotalRentalFee())
                .depositPaid(b.getDepositPaid())
                .status(b.getStatus() != null ? b.getStatus() : BookingStatus.PENDING_PAYMENT)
                .accessPin(b.getAccessPin())
                .qrAccessToken(b.getQrAccessToken())
                .handoverTime(b.getHandoverTime())
                .returnTime(b.getReturnTime())
                .build();
    }
}

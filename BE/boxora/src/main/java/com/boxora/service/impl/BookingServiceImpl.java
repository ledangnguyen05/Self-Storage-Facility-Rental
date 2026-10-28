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
import com.boxora.entity.UnitType;
import com.boxora.entity.Role;
import com.boxora.repository.FacilityRepository;
import com.boxora.repository.UnitTypeRepository;
import com.boxora.repository.RoleRepository;
import com.boxora.service.EmailService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import com.boxora.entity.RentalContract;
import com.boxora.entity.StaffAssignment;
import com.boxora.enums.RentalContractStatus;
import com.boxora.enums.StaffAssignmentStatus;
import com.boxora.enums.StaffShift;
import com.boxora.repository.BookingRescheduleHistoryRepository;
import com.boxora.repository.RentalContractRepository;
import com.boxora.repository.StaffAssignmentRepository;
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
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.Random;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class BookingServiceImpl implements BookingService {

    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

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
    private final StaffAssignmentRepository staffAssignmentRepository;
    private final FacilityRepository facilityRepository;
    private final UnitTypeRepository unitTypeRepository;
    private final RoleRepository roleRepository;
    private final EmailService emailService;


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
        if (request.getBookingCode() != null && !request.getBookingCode().isBlank()) {
            Optional<Booking> existingByCode = bookingRepository.findByBookingCode(request.getBookingCode().trim());
            if (existingByCode.isPresent()) {
                return mapToResponse(existingByCode.get());
            }
        }
        StorageUnit unit = null;
        Facility facility = null;
        UnitType unitType = null;

        if (request.getStorageUnitId() != null) {
            unit = storageUnitRepository.findWithDetailsByIdForUpdate(request.getStorageUnitId())
                    .orElseThrow(() -> new AppException(ErrorCode.STORAGE_UNIT_NOT_FOUND));
            if (request.getFacilityId() != null && unit.getFacility() != null && !request.getFacilityId().equals(unit.getFacility().getId())) {
                log.warn("[FACILITY_MISMATCH] Storage unit {} belongs to facility {}, but request specified facility {}",
                        unit.getId(), unit.getFacility().getId(), request.getFacilityId());
                throw new AppException(ErrorCode.INVALID_REQUEST, "Kho đã chọn không thuộc về cơ sở lưu trữ tương ứng.");
            }

            if (unit.getFacility() != null) {
                facility = unit.getFacility();
                if (facility.getStatus() == com.boxora.enums.FacilityStatus.INACTIVE) {
                    log.warn("[FACILITY_INACTIVE] Booking rejected. Facility {} ({}) is INACTIVE", facility.getId(), facility.getName());
                    throw new AppException(ErrorCode.FACILITY_INACTIVE,
                            String.format("Chi nhánh %s hiện đang tạm ngưng hoạt động. Quý khách vui lòng chọn chi nhánh khác.", facility.getName()));
                }
                if (facility.getStatus() == com.boxora.enums.FacilityStatus.MAINTENANCE) {
                    log.warn("[FACILITY_MAINTENANCE] Booking rejected. Facility {} ({}) is under MAINTENANCE", facility.getId(), facility.getName());
                    throw new AppException(ErrorCode.FACILITY_UNDER_MAINTENANCE,
                            String.format("Chi nhánh %s hiện đang trong thời gian bảo trì kỹ thuật. Quý khách vui lòng chọn chi nhánh khác.", facility.getName()));
                }
            }

            boolean alreadyOccupied = bookingRepository.existsByStorageUnit_IdAndStatusIn(
                    unit.getId(),
                    List.of(
                            BookingStatus.ACTIVE,
                            BookingStatus.CONFIRMED,
                            BookingStatus.PENDING_PAYMENT,
                            BookingStatus.PENDING_APPROVAL,
                            BookingStatus.PENDING_SIGNATURE,
                            BookingStatus.PENDING_CONTACT,
                            BookingStatus.PAID_AND_SIGNED,
                            BookingStatus.PAID_PENDING_ASSIGNMENT,
                            BookingStatus.READY_FOR_CHECKIN
                    )
            );
            if (unit.getStatus() == UnitStatus.RESERVED && !alreadyOccupied) {
                unit.setStatus(UnitStatus.AVAILABLE);
                storageUnitRepository.save(unit);
            }
            if (unit.getStatus() != UnitStatus.AVAILABLE || alreadyOccupied) {
                StorageUnit fallbackUnit = null;
                if (unit.getFacility() != null) {
                    UUID facId = unit.getFacility().getId();
                    List<StorageUnit> candidates = new ArrayList<>();
                    if (unit.getUnitType() != null) {
                        candidates.addAll(storageUnitRepository.findByFacility_IdAndUnitType_IdAndStatus(facId, unit.getUnitType().getId(), UnitStatus.AVAILABLE));
                    }
                    candidates.addAll(storageUnitRepository.findByFacility_IdAndStatus(facId, UnitStatus.AVAILABLE));
                    for (StorageUnit cand : candidates) {
                        if (cand.getId().equals(unit.getId())) continue;
                        boolean candOccupied = bookingRepository.existsByStorageUnit_IdAndStatusIn(
                                cand.getId(),
                                List.of(
                                        BookingStatus.ACTIVE,
                                        BookingStatus.CONFIRMED,
                                        BookingStatus.PENDING_PAYMENT,
                                        BookingStatus.PENDING_APPROVAL,
                                        BookingStatus.PENDING_SIGNATURE,
                                        BookingStatus.PENDING_CONTACT,
                                        BookingStatus.PAID_AND_SIGNED,
                                        BookingStatus.PAID_PENDING_ASSIGNMENT,
                                        BookingStatus.READY_FOR_CHECKIN
                                )
                        );
                        if (!candOccupied) {
                            fallbackUnit = storageUnitRepository.findWithDetailsByIdForUpdate(cand.getId()).orElse(null);
                            if (fallbackUnit != null && fallbackUnit.getStatus() == UnitStatus.AVAILABLE) {
                                break;
                            }
                        }
                    }
                }
                if (fallbackUnit != null) {
                    log.info("[UNIT_FALLBACK] Auto-switched from occupied unit {} to available unit {} in same facility", unit.getUnitCode(), fallbackUnit.getUnitCode());
                    unit = fallbackUnit;
                } else {
                    log.warn("[UNIT_LOCK] Storage unit {} status is {}, alreadyOccupied={}", unit.getUnitCode(), unit.getStatus(), alreadyOccupied);
                    throw new AppException(ErrorCode.STORAGE_UNIT_NOT_AVAILABLE);
                }
            }
            try {
                if (storageUnitLockService.isUnitLocked(unit.getId())) {
                    log.warn("[SOFT_LOCK] Releasing stale Redis soft-lock for available unit {}", unit.getId());
                    storageUnitLockService.releaseLock(unit.getId());
                }
            } catch (Exception e) {
                log.warn("[REDIS_OPTIMIZATION_BYPASS] Redis lock check error for unit {}: {}. Proceeding with authoritative DB pessimistic lock.",
                        unit.getId(), e.getMessage());
            }

            facility = unit.getFacility();
            unitType = unit.getUnitType();
        } else {
            if (request.getFacilityId() != null) {
                facility = facilityRepository.findById(request.getFacilityId())
                        .orElseThrow(() -> new AppException(ErrorCode.FACILITY_NOT_FOUND));
            }
            if (request.getUnitTypeId() != null) {
                unitType = unitTypeRepository.findById(request.getUnitTypeId())
                        .orElseThrow(() -> new AppException(ErrorCode.UNIT_TYPE_NOT_FOUND));
            }
            if (facility != null) {
                if (facility.getStatus() == com.boxora.enums.FacilityStatus.INACTIVE) {
                    throw new AppException(ErrorCode.FACILITY_INACTIVE, "Chi nhánh " + facility.getName() + " hiện đang tạm ngưng hoạt động.");
                }
                if (facility.getStatus() == com.boxora.enums.FacilityStatus.MAINTENANCE) {
                    throw new AppException(ErrorCode.FACILITY_UNDER_MAINTENANCE, "Chi nhánh " + facility.getName() + " hiện đang bảo trì.");
                }

                // Kiểm tra xem cơ sở còn buồng kho khả dụng (AVAILABLE) theo loại kho hay không
                List<StorageUnit> candidates = new ArrayList<>();
                if (unitType != null) {
                    candidates.addAll(storageUnitRepository.findByFacility_IdAndUnitType_IdAndStatus(facility.getId(), unitType.getId(), UnitStatus.AVAILABLE));
                }
                if (candidates.isEmpty()) {
                    candidates.addAll(storageUnitRepository.findByFacility_IdAndStatus(facility.getId(), UnitStatus.AVAILABLE));
                }

                if (candidates.isEmpty()) {
                    log.warn("[AUTO_ALLOCATE_FAILED] No available storage unit found for facility {} and unitType {}",
                            facility.getId(), unitType != null ? unitType.getId() : "null");
                    throw new AppException(ErrorCode.STORAGE_UNIT_NOT_AVAILABLE, "Rất tiếc, cơ sở hiện đã hết buồng kho khả dụng cho kích thước này.");
                }

                // Không tự động gán buồng kho cụ thể khi đặt chỗ mới.
                // Khách hàng và nhân viên sẽ chọn vị trí kho mong muốn khi check-in tại cơ sở.
                unit = null;
            }
        }
        LocalDate startDate = request.getStartDate() != null ? request.getStartDate() : LocalDate.now(BUSINESS_ZONE);
        LocalDate today = LocalDate.now(BUSINESS_ZONE);

        if (startDate.isBefore(today) && request.getBookingCode() != null && !request.getBookingCode().isBlank()) {
            startDate = today;
        }
        if (startDate.isBefore(today)) {
            throw new AppException(ErrorCode.BOOKING_START_DATE_PAST);
        }

        if (startDate.isAfter(today.plusDays(maxAdvanceDays))) {
            throw new AppException(ErrorCode.BOOKING_ADVANCE_NOTICE_EXCEEDED);
        }

        int months = request.getRentalMonths() != null ? request.getRentalMonths() : 1;
        if (months < 1) {
            throw new AppException(ErrorCode.BOOKING_MINIMUM_DURATION_INVALID);
        }

        UUID effectiveFacilityId = facility != null ? facility.getId() : (unit != null && unit.getFacility() != null ? unit.getFacility().getId() : null);
        FacilityPolicy activePolicy = effectiveFacilityId == null
                ? null
                : facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(effectiveFacilityId).orElse(null);
        if (activePolicy != null && activePolicy.getMinimumRentalMonths() != null
                && months < activePolicy.getMinimumRentalMonths()) {
            throw new AppException(ErrorCode.BOOKING_MINIMUM_DURATION_INVALID);
        }

        LocalDate endDate = startDate.plusMonths(months);

        User customer;
        boolean isStaffOrAdmin = requestContext != null && (
                "ADMIN".equalsIgnoreCase(requestContext.currentUserRole())
                || "FACILITY_MANAGER".equalsIgnoreCase(requestContext.currentUserRole())
                || "STAFF".equalsIgnoreCase(requestContext.currentUserRole())
        );

        String reqCustEmail = (request.getCustomerEmail() != null && !request.getCustomerEmail().isBlank())
                ? request.getCustomerEmail().trim().toLowerCase()
                : ((request.getEmail() != null && !request.getEmail().isBlank()) ? request.getEmail().trim().toLowerCase() : null);

        if (isStaffOrAdmin && request.getCustomerId() != null) {
            customer = userRepository.findById(request.getCustomerId())
                    .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        } else if (isStaffOrAdmin && reqCustEmail != null) {
            final String targetEmail = reqCustEmail;
            customer = userRepository.findByEmail(targetEmail).orElseGet(() -> {
                Role customerRole = roleRepository.findByName("CUSTOMER").orElse(null);
                String name = request.getCustomerName() != null && !request.getCustomerName().isBlank()
                        ? request.getCustomerName().trim()
                        : (request.getFullName() != null && !request.getFullName().isBlank() ? request.getFullName().trim() : "Khách hàng Boxora");
                String phone = request.getCustomerPhone() != null && !request.getCustomerPhone().isBlank()
                        ? request.getCustomerPhone().trim()
                        : (request.getPhone() != null ? request.getPhone().trim() : "");
                User newUser = User.builder()
                        .email(targetEmail)
                        .username(targetEmail)
                        .fullName(name)
                        .phone(phone)
                        .password(new BCryptPasswordEncoder().encode(UUID.randomUUID().toString()))
                        .role(customerRole)
                        .isActive(true)
                        .build();
                return userRepository.save(newUser);
            });
        } else if (isStaffOrAdmin && request.getCustomerId() != null) {
            customer = userRepository.findById(request.getCustomerId())
                    .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        } else if (requestContext != null && requestContext.currentUserId() != null) {
            customer = userRepository.findById(requestContext.currentUserId())
                    .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        } else if (request.getCustomerId() != null) {
            customer = userRepository.findById(request.getCustomerId())
                    .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        } else if (request.getCustomerEmail() != null && !request.getCustomerEmail().isBlank()) {
            String email = request.getCustomerEmail().trim().toLowerCase();
            customer = userRepository.findByEmail(email).orElseGet(() -> {
                Role customerRole = roleRepository.findByName("CUSTOMER").orElse(null);
                User newUser = User.builder()
                        .email(email)
                        .username(email)
                        .fullName(request.getCustomerName() != null && !request.getCustomerName().isBlank() ? request.getCustomerName().trim() : "Khách hàng Boxora")
                        .phone(request.getCustomerPhone() != null ? request.getCustomerPhone().trim() : "")
                        .password(new BCryptPasswordEncoder().encode(UUID.randomUUID().toString()))
                        .role(customerRole)
                        .isActive(true)
                        .build();
                return userRepository.save(newUser);
            });
        } else {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }

        BigDecimal totalFee = request.getTotalRentalFee();
        BigDecimal deposit = request.getDepositAmount();
        if (unit != null) {
            com.boxora.dto.request.PricingQuoteRequest quoteRequest = com.boxora.dto.request.PricingQuoteRequest.builder()
                    .storageUnitId(unit.getId())
                    .rentalMonths(months)
                    .discountCode(request.getDiscountCode())
                    .startDate(startDate)
                    .build();
            com.boxora.dto.response.PricingQuoteResponse quote = pricingService.calculateQuote(quoteRequest);
            if (totalFee == null || totalFee.compareTo(BigDecimal.ZERO) <= 0) {
                totalFee = quote.getTotalRentalFee();
            }
            if (deposit == null || deposit.compareTo(BigDecimal.ZERO) <= 0) {
                deposit = (request.getDepositPaid() != null && request.getDepositPaid().compareTo(BigDecimal.ZERO) > 0)
                        ? request.getDepositPaid()
                        : quote.getDepositAmount();
            }
        } else if (unitType != null) {
            BigDecimal baseMonthly = unitType.getBasePricePerMonth() != null ? unitType.getBasePricePerMonth() : BigDecimal.valueOf(1500000);
            if (totalFee == null || totalFee.compareTo(BigDecimal.ZERO) <= 0) {
                totalFee = baseMonthly.multiply(BigDecimal.valueOf(months));
            }
            if (deposit == null || deposit.compareTo(BigDecimal.ZERO) <= 0) {
                deposit = unitType.getDepositAmount() != null && unitType.getDepositAmount().compareTo(BigDecimal.ZERO) > 0
                        ? unitType.getDepositAmount()
                        : baseMonthly;
            }
        }

        String code = (request.getBookingCode() != null && !request.getBookingCode().isBlank())
                ? request.getBookingCode().trim()
                : ("BX-" + (2025 + new Random().nextInt(2)) + "-" + String.format("%04d", new Random().nextInt(10000)));

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

        LocalDateTime minAllowedCheckIn = LocalDateTime.now(BUSINESS_ZONE).plusHours(5);
        if (expectedCheckInAt.isBefore(minAllowedCheckIn)) {
            expectedCheckInAt = minAllowedCheckIn.plusMinutes(15);
        }

        int holdGraceHours = (activePolicy != null && activePolicy.getHoldGraceHours() != null)
                ? activePolicy.getHoldGraceHours()
                : 24;
        int policyMaxHoldDays = (activePolicy != null && activePolicy.getMaxHoldDays() != null)
                ? activePolicy.getMaxHoldDays()
                : maxAdvanceDays;

        boolean isDirect = request.getSigningMethod() != null &&
                ("DIRECT".equalsIgnoreCase(request.getSigningMethod().trim()) || "IN_PERSON".equalsIgnoreCase(request.getSigningMethod().trim()));
        BookingStatus initialStatus;
        if ("PENDING_CONTACT".equalsIgnoreCase(request.getInitialStatus()) || isDirect) {
            initialStatus = BookingStatus.PENDING_CONTACT;
        } else if ("PENDING_SIGNATURE".equalsIgnoreCase(request.getInitialStatus()) || unit == null) {
            initialStatus = BookingStatus.PENDING_SIGNATURE;
        } else {
            initialStatus = BookingStatus.PENDING_PAYMENT;
        }
        String resolvedSigningMethod = isDirect ? "IN_PERSON" : (request.getSigningMethod() != null && !request.getSigningMethod().isBlank() ? request.getSigningMethod().trim().toUpperCase() : "ONLINE");

        Instant now = Instant.now();
        Instant holdStartedAt = now;
        Instant holdExpiresAt;

        if (isDirect) {
            Instant appointmentInstant = expectedCheckInAt != null
                    ? expectedCheckInAt.atZone(BUSINESS_ZONE).toInstant()
                    : now;
            holdExpiresAt = appointmentInstant.plus(java.time.Duration.ofHours(holdGraceHours));
            if (holdExpiresAt.isBefore(now.plus(java.time.Duration.ofHours(24)))) {
                holdExpiresAt = now.plus(java.time.Duration.ofHours(24));
            }
            Instant maxHoldLimit = now.plus(java.time.Duration.ofDays(policyMaxHoldDays));
            if (holdExpiresAt.isAfter(maxHoldLimit)) {
                holdExpiresAt = maxHoldLimit;
            }
        } else {
            holdExpiresAt = now.plus(java.time.Duration.ofHours(softLockHours));
        }

        // Task 3: Validation thông tin người đặt & nhận bàn giao kho
        String fullName = request.getFullName();
        if (fullName != null && !fullName.isBlank()) {
            fullName = fullName.trim();
            if (fullName.length() > 100) {
                throw new AppException(ErrorCode.INVALID_REQUEST, "Họ và tên người đặt không được vượt quá 100 ký tự.");
            }
            if (!fullName.matches("^[\\p{L}\\s]+$")) {
                throw new AppException(ErrorCode.INVALID_REQUEST, "Họ và tên chỉ được chứa chữ cái và khoảng trắng hợp lệ.");
            }
        }

        String phone = request.getPhone();
        if (phone != null && !phone.isBlank()) {
            phone = phone.trim();
            if (!phone.matches("^(0|\\+84)(3[2-9]|5[2689]|7[06-9]|8[1-9]|9[0-9])[0-9]{7}$")) {
                throw new AppException(ErrorCode.INVALID_REQUEST, "Số điện thoại không đúng định dạng di động Việt Nam (10 chữ số).");
            }
        }

        String idNumber = request.getIdentityCardNumber() != null && !request.getIdentityCardNumber().isBlank()
                ? request.getIdentityCardNumber().trim()
                : null;
        String idType = request.getIdentityCardType() != null && !request.getIdentityCardType().isBlank()
                ? request.getIdentityCardType().trim().toUpperCase()
                : "CCCD";

        if (idNumber != null) {
            if ("PASSPORT".equals(idType)) {
                if (!idNumber.matches("^[A-Z][0-9]{7,8}$")) {
                    throw new AppException(ErrorCode.INVALID_REQUEST, "Số Hộ chiếu không hợp lệ (1 chữ cái in hoa theo sau bởi 7–8 chữ số, VD: B1234567).");
                }
            } else {
                if (!idNumber.matches("^[0-9]{12}$")) {
                    throw new AppException(ErrorCode.INVALID_REQUEST, "Số CCCD phải bao gồm đúng 12 chữ số theo quy chuẩn Bộ Công An.");
                }
            }
        }

        String email = request.getEmail();
        if (email != null && !email.isBlank()) {
            email = email.trim();
            if (!email.matches("^[A-Za-z0-9+_.-]+@([A-Za-z0-9.-]+\\.[A-Za-z]{2,})$")) {
                throw new AppException(ErrorCode.INVALID_REQUEST, "Địa chỉ email không đúng định dạng.");
            }
        }

        String notes = request.getSpecialNotes();
        if (notes != null) {
            notes = notes.trim();
            if (notes.length() > 500) {
                throw new AppException(ErrorCode.INVALID_REQUEST, "Ghi chú không được vượt quá 500 ký tự.");
            }
            notes = notes.replaceAll("<[^>]*>", "");
        }


        Booking booking = Booking.builder()
                .bookingCode(code)
                .customer(customer)
                .storageUnit(unit)
                .facility(facility)
                .unitType(unitType)
                .startDate(startDate)
                .endDate(endDate)
                .rentalMonths(months)
                .totalRentalFee(totalFee)
                .depositPaid(request.getDepositPaid() != null ? request.getDepositPaid() : BigDecimal.ZERO)
                .depositAmount(deposit)
                .status(initialStatus)
                .paymentStatus("UNPAID")
                .signingMethod(resolvedSigningMethod)
                .expectedArrivalAt(request.getExpectedArrivalAt())
                .expectedCheckInAt(expectedCheckInAt)
                .holdStartedAt(holdStartedAt)
                .holdExpiresAt(holdExpiresAt)
                .paymentExpiresAt(unit != null ? now.plus(java.time.Duration.ofMinutes(paymentTimeoutMinutes)) : null)
                .identityCardNumber(idNumber != null ? idNumber : request.getIdentityCardNumber())
                .identityCardType(idType != null ? idType : (request.getIdentityCardType() != null ? request.getIdentityCardType() : "CCCD"))
                .staffAssignmentNotes(notes)
                .accessPin(null)
                .qrAccessToken(null)
                .build();

        booking = bookingRepository.save(booking);

        if (unit != null) {
            unit.setStatus(UnitStatus.RESERVED);
            storageUnitRepository.save(unit);
        }

        com.boxora.service.ContractSigningService contractSigningService = contractSigningServiceProvider != null
                ? contractSigningServiceProvider.getIfAvailable()
                : null;
        if (contractSigningService != null) {
            try {
                contractSigningService.ensureContractForBooking(booking);
            } catch (Exception ex) {
                log.warn("Notice auto-generating contracts: {}", ex.getMessage());
            }
        }

        UUID facilityIdForLog = facility != null ? facility.getId() : (unit != null && unit.getFacility() != null ? unit.getFacility().getId() : null);
        activityLogService.record(
                facilityIdForLog,
                ActivityAction.RESERVATION_CREATE,
                "BOOKING",
                booking.getId(),
                "Tạo mới đặt chỗ " + booking.getBookingCode() + (unit != null ? " cho kho " + unit.getUnitCode() : ""),
                null,
                booking.getStatus().name()
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
        if (booking.getStatus() == BookingStatus.ACTIVE || booking.getStatus() == BookingStatus.COMPLETED || booking.getStatus() == BookingStatus.CANCELLED) {
            throw new AppException(ErrorCode.BOOKING_CANNOT_BE_CANCELLED, "Đơn đặt kho ở trạng thái " + booking.getStatus() + " không thể phê duyệt hoặc từ chối.");
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
            if (notes != null && !notes.isBlank()) {
                booking.setCancellationReason(notes.trim());
            }
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

        if (!approved) {
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
                    emailService.sendBookingCancellationEmail(
                            custEmail,
                            custName,
                            booking.getBookingCode(),
                            facName,
                            uCode,
                            notes != null && !notes.isBlank() ? notes.trim() : "Quản trị viên từ chối yêu cầu thuê kho",
                            true,
                            BigDecimal.ZERO
                    );
                }
            } catch (Exception ex) {
                log.error("[EMAIL_DISPATCH_FAILED] Không thể gửi email từ chối đơn {}: {}", booking.getBookingCode(), ex.getMessage(), ex);
            }
        }

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
        String role = requestContext != null ? requestContext.currentUserRole() : null;
        boolean isStaffOrManagerOrAdmin = "ADMIN".equalsIgnoreCase(role) || "FACILITY_MANAGER".equalsIgnoreCase(role) || "STAFF".equalsIgnoreCase(role) || "BUSINESS_MANAGER".equalsIgnoreCase(role) || "SYSTEM_ADMIN".equalsIgnoreCase(role);
        if (currentUserId != null && customerId != null && !currentUserId.equals(customerId)) {
            if (!isStaffOrManagerOrAdmin) {
                throw new AppException(ErrorCode.FORBIDDEN);
            }
        }
        UUID targetCustomerId = customerId != null ? customerId : (isStaffOrManagerOrAdmin ? null : currentUserId);
        List<Booking> bookings;
        if (targetCustomerId != null) {
            bookings = bookingRepository.findByCustomer_Id(targetCustomerId);
        } else {
            bookings = bookingRepository.findAll();
        }
        bookings = restrictBookingsToCurrentFacility(bookings);
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
        bookings = restrictBookingsToCurrentFacility(bookings);
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
        return getUpcomingArrivals(null, null, null, null);
    }

    @Override
    @Transactional(readOnly = true)
    public List<BookingResponse> getUpcomingArrivals(UUID facilityId) {
        return getUpcomingArrivals(facilityId, null, null, null);
    }

    @Override
    @Transactional(readOnly = true)
    public List<BookingResponse> getUpcomingArrivals(UUID facilityId, String timeframe, LocalDate fromDate, LocalDate toDate) {
        UUID effectiveFacilityId = facilityId;
        if (facilityAccessGuard.isFacilityScoped()) {
            UUID assignedFacilityId = facilityAccessGuard.scopedFacilityIdOrNull();
            if (assignedFacilityId == null) {
                throw new AppException(ErrorCode.FACILITY_ACCESS_DENIED);
            }
            if (facilityId != null && !facilityId.equals(assignedFacilityId)) {
                throw new AppException(ErrorCode.FACILITY_ACCESS_DENIED);
            }
            effectiveFacilityId = assignedFacilityId;
        }

        final UUID targetFacilityId = effectiveFacilityId;
        List<Booking> source;
        try {
            source = targetFacilityId == null
                    ? bookingRepository.findAll()
                    : bookingRepository.findAllByFacilityIdIncludingNullUnit(targetFacilityId);
            if (source == null || source.isEmpty()) {
                if (targetFacilityId != null) {
                    source = bookingRepository.findAll().stream()
                            .filter(b -> {
                                UUID facId = b.getStorageUnit() != null && b.getStorageUnit().getFacility() != null
                                        ? b.getStorageUnit().getFacility().getId()
                                        : (b.getFacility() != null ? b.getFacility().getId() : null);
                                return targetFacilityId.equals(facId);
                            })
                            .toList();
                } else {
                    source = bookingRepository.findAll();
                }
            }
        } catch (Exception e) {
            source = bookingRepository.findAll();
        }

        LocalDate today = LocalDate.now();

        return source.stream()
                .filter(b -> {
                    if ("PAST".equalsIgnoreCase(timeframe)) {
                        return b.getStatus() == BookingStatus.COMPLETED || b.getStatus() == BookingStatus.CANCELLED;
                    }
                    if ("ALL".equalsIgnoreCase(timeframe)) {
                        return true;
                    }
                    return b.getStatus() == BookingStatus.PAID_PENDING_ASSIGNMENT
                            || b.getStatus() == BookingStatus.PAID_AND_SIGNED
                            || b.getStatus() == BookingStatus.PENDING_CONTACT
                            || b.getStatus() == BookingStatus.PENDING_SIGNATURE
                            || b.getStatus() == BookingStatus.SIGNED_PENDING_PAYMENT
                            || b.getStatus() == BookingStatus.CONFIRMED
                            || b.getStatus() == BookingStatus.PENDING_PAYMENT
                            || b.getStatus() == BookingStatus.ACTIVE
                            || b.getStatus() == BookingStatus.COMPLETED;
                })
                .filter(b -> {
                    LocalDate checkInDate = b.getExpectedCheckInAt() != null
                            ? b.getExpectedCheckInAt().toLocalDate()
                            : b.getStartDate();
                    if (checkInDate == null) return false;

                    if ("TODAY".equalsIgnoreCase(timeframe) || "CURRENT".equalsIgnoreCase(timeframe)) {
                        if (!checkInDate.isEqual(today)) return false;
                    } else if ("PAST".equalsIgnoreCase(timeframe)) {
                        if (!checkInDate.isBefore(today)) return false;
                    } else if ("FUTURE".equalsIgnoreCase(timeframe)) {
                        if (!checkInDate.isAfter(today)) return false;
                    }

                    if (fromDate != null && checkInDate.isBefore(fromDate)) return false;
                    if (toDate != null && checkInDate.isAfter(toDate)) return false;

                    return true;
                })
                .sorted((a, b) -> {
                    LocalDateTime t1 = a.getExpectedCheckInAt() != null ? a.getExpectedCheckInAt() : a.getStartDate().atStartOfDay();
                    LocalDateTime t2 = b.getExpectedCheckInAt() != null ? b.getExpectedCheckInAt() : b.getStartDate().atStartOfDay();
                    if ("PAST".equalsIgnoreCase(timeframe)) {
                        return t2.compareTo(t1);
                    }
                    return t1.compareTo(t2);
                })
                .map(this::mapOperationalBookingResponse)
                .collect(Collectors.toList());
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

        if (!"STAFF".equalsIgnoreCase(role) && !"FACILITY_MANAGER".equalsIgnoreCase(role)
                && !"ADMIN".equalsIgnoreCase(role) && !"SYSTEM_ADMIN".equalsIgnoreCase(role)) {
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

        // Phân quyền: nhân viên/quản lý có ca trực đã điểm danh hôm nay hoặc vào ngày hẹn tại cơ sở (hỗ trợ tiếp nhận sớm và đúng hẹn)
        if (!"ADMIN".equalsIgnoreCase(role) && !"SYSTEM_ADMIN".equalsIgnoreCase(role) && !"BUSINESS_MANAGER".equalsIgnoreCase(role)) {
            LocalDate today = LocalDate.now(BUSINESS_ZONE);
            LocalDate checkInDate = booking.getExpectedCheckInAt() != null
                    ? booking.getExpectedCheckInAt().toLocalDate()
                    : booking.getStartDate();

            UUID facId = booking.getStorageUnit() != null && booking.getStorageUnit().getFacility() != null
                    ? booking.getStorageUnit().getFacility().getId()
                    : null;

            Set<LocalDate> targetDates = new LinkedHashSet<>();
            if (today != null) targetDates.add(today);
            if (checkInDate != null) targetDates.add(checkInDate);

            List<StaffAssignment> myAssignments = new ArrayList<>();
            for (LocalDate tDate : targetDates) {
                myAssignments.addAll(staffAssignmentRepository.findByStaff_IdAndAssignedDate(currentUserId, tDate));
                List<StaffAssignment> prevDayAssignments = staffAssignmentRepository.findByStaff_IdAndAssignedDate(
                        currentUserId, tDate.minusDays(1));
                for (StaffAssignment prev : prevDayAssignments) {
                    boolean isOvernight = prev.getShift() == StaffShift.NIGHT
                            || (prev.getStartTime() != null && prev.getEndTime() != null
                                && !prev.getEndTime().isAfter(prev.getStartTime()));
                    if (isOvernight) {
                        myAssignments.add(prev);
                    }
                }
            }

            boolean hasCheckedInShift = myAssignments.stream().anyMatch(a -> {
                boolean facMatch = facId == null || a.getFacility() == null || facId.equals(a.getFacility().getId());
                boolean checkedIn = a.getStatus() == StaffAssignmentStatus.CHECKED_IN
                        || (a.getCheckedInAt() != null && a.getCheckedOutAt() == null);
                return facMatch && checkedIn;
            });

            if (!hasCheckedInShift) {
                throw new AppException(ErrorCode.FORBIDDEN,
                        "Bạn chỉ có thể tiếp nhận khách khi có ca làm việc và đã điểm danh vào ca trực tại cơ sở.");
            }
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
        BookingResponse response = mapToResponse(booking);
        response.setAccessPin(null);
        response.setQrAccessToken(null);
        return response;
    }

    @Override
    public BookingResponse renewBooking(UUID id, int extraMonths) {
        Booking booking = bookingRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        LocalDate currentEnd = booking.getEndDate() != null ? booking.getEndDate() : LocalDate.now(BUSINESS_ZONE);
        booking.setEndDate(currentEnd.plusMonths(extraMonths));
        booking.setRentalMonths((booking.getRentalMonths() != null ? booking.getRentalMonths() : 0) + extraMonths);
        booking = bookingRepository.save(booking);

        return mapToResponse(booking);
    }

    @Override
    public BookingResponse remoteUnlock(UUID id) {
        throw new AppException(ErrorCode.SMARTLOCK_INTEGRATION_UNAVAILABLE);
    }

    @Override
    @Transactional(readOnly = true)
    public BookingResponse getById(UUID id) {
        Booking booking = bookingRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        User currentUser = (requestContext != null && requestContext.currentUserId() != null)
                ? userRepository.findById(requestContext.currentUserId()).orElse(null)
                : null;
        if (currentUser != null) {
            validateBookingAccess(booking, currentUser);
        }

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
        booking.setPinUpdatedAt(LocalDateTime.now(BUSINESS_ZONE));
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
        if (booking.getCustomer() != null && booking.getCustomer().getId().equals(currentUser.getId())) {
            return;
        }

        String role = currentUser.getRole() != null ? currentUser.getRole().getName() : "";
        if ("CUSTOMER".equalsIgnoreCase(role)) {
            throw new AppException(ErrorCode.FORBIDDEN);
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

        int holdGraceHours = (policy != null && policy.getHoldGraceHours() != null) ? policy.getHoldGraceHours() : 24;
        Instant now = Instant.now();
        Instant appointmentInstant = newExpectedCheckIn.atZone(BUSINESS_ZONE).toInstant();
        Instant newHoldExpiresAt = appointmentInstant.plus(java.time.Duration.ofHours(holdGraceHours));
        if (newHoldExpiresAt.isBefore(now.plus(java.time.Duration.ofHours(24)))) {
            newHoldExpiresAt = now.plus(java.time.Duration.ofHours(24));
        }
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
                int graceHours = 24;
                if ("IN_PERSON".equalsIgnoreCase(booking.getSigningMethod())) {
                    graceHours = 48; // Đơn ký tại quầy: sau 24h nhắc nhở khách, sau 48h mở quyền hủy đơn
                } else if (booking.getStorageUnit() != null && booking.getStorageUnit().getFacility() != null) {
                    graceHours = facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(booking.getStorageUnit().getFacility().getId())
                            .map(FacilityPolicy::getHoldGraceHours)
                            .filter(h -> h != null && h > 0)
                            .orElse(24);
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

    /**
     * Tự động quét và gửi email nhắc nhở khách hàng khi đơn đặt ký + thanh toán tại quầy
     * đã quá 24h sau lịch hẹn check-in mà vẫn chưa được tiếp nhận.
     */
    @Scheduled(fixedDelay = 60_000L)
    @Transactional
    public void sendCheckinOverdueReminders() {
        LocalDateTime threshold = LocalDateTime.now(BUSINESS_ZONE).minusHours(24);
        LocalDate todayThreshold = LocalDate.now(BUSINESS_ZONE).minusDays(1);
        List<Booking> overdueCandidates = bookingRepository.findOverdueInPersonCheckinReminders(threshold, todayThreshold);

        for (Booking candidate : overdueCandidates) {
            Booking booking = bookingRepository.findByIdForUpdate(candidate.getId()).orElse(null);
            if (booking == null || booking.getCheckinOverdueReminderSentAt() != null) {
                continue;
            }
            if (booking.getStatus() == BookingStatus.CANCELLED || booking.getStatus() == BookingStatus.ACTIVE
                    || booking.getStatus() == BookingStatus.COMPLETED || booking.getHandoverTime() != null) {
                continue;
            }

            try {
                if (booking.getCustomer() != null && booking.getCustomer().getEmail() != null && !booking.getCustomer().getEmail().isBlank()) {
                    String custEmail = booking.getCustomer().getEmail().trim();
                    String custName = booking.getCustomer().getFullName() != null && !booking.getCustomer().getFullName().isBlank()
                            ? booking.getCustomer().getFullName() : booking.getCustomer().getUsername();
                    String facName = (booking.getStorageUnit() != null && booking.getStorageUnit().getFacility() != null)
                            ? booking.getStorageUnit().getFacility().getName()
                            : (booking.getFacility() != null ? booking.getFacility().getName() : "Hệ thống Boxora");
                    String facAddress = (booking.getStorageUnit() != null && booking.getStorageUnit().getFacility() != null)
                            ? booking.getStorageUnit().getFacility().getAddress()
                            : (booking.getFacility() != null ? booking.getFacility().getAddress() : "Tại cơ sở Boxora");
                    String facPhone = (booking.getStorageUnit() != null && booking.getStorageUnit().getFacility() != null)
                            ? booking.getStorageUnit().getFacility().getContactPhone()
                            : (booking.getFacility() != null ? booking.getFacility().getContactPhone() : "1900-BOXORA");
                    String uCode = booking.getStorageUnit() != null
                            ? booking.getStorageUnit().getUnitCode()
                            : (booking.getUnitType() != null ? booking.getUnitType().getTypeName() : "Kho tự quản");
                    LocalDateTime checkInTime = booking.getExpectedCheckInAt() != null
                            ? booking.getExpectedCheckInAt()
                            : (booking.getStartDate() != null ? booking.getStartDate().atTime(9, 0) : LocalDateTime.now(BUSINESS_ZONE));

                    emailService.sendCheckinOverdueReminderEmail(
                            custEmail,
                            custName,
                            booking.getBookingCode(),
                            facName,
                            facAddress,
                            facPhone,
                            uCode,
                            checkInTime
                    );
                    log.info("[CHECKIN_OVERDUE_EMAIL] Đã gửi email nhắc nhở quá hạn 24h check-in cho khách hàng đơn {}", booking.getBookingCode());
                }
            } catch (Exception ex) {
                log.error("[CHECKIN_OVERDUE_EMAIL_FAILED] Lỗi gửi email nhắc nhở quá hạn check-in đơn {}: {}", booking.getBookingCode(), ex.getMessage(), ex);
            }

            booking.setCheckinOverdueReminderSentAt(LocalDateTime.now(BUSINESS_ZONE));
            bookingRepository.save(booking);

            UUID facilityId = (booking.getStorageUnit() != null && booking.getStorageUnit().getFacility() != null)
                    ? booking.getStorageUnit().getFacility().getId()
                    : (booking.getFacility() != null ? booking.getFacility().getId() : null);
            activityLogService.record(
                    facilityId,
                    ActivityAction.OVERDUE_REMINDER_SENT,
                    "Booking",
                    booking.getId(),
                    String.format("Đã gửi email nhắc nhở khách hàng đơn %s đến cơ sở nhận kho sau 24 giờ quá hạn lịch hẹn check-in.", booking.getBookingCode()),
                    null,
                    booking.getStatus()
            );
        }
    }

    private String resolveReconciledPaymentStatus(Booking booking) {
        if (booking.getStatus() == BookingStatus.CANCELLED || "REFUNDED".equalsIgnoreCase(booking.getPaymentStatus())) {
            return "UNPAID";
        }
        List<com.boxora.entity.Payment> payments = paymentRepository.findAllByBooking_Id(booking.getId());
        BigDecimal requiredDeposit = booking.getDepositAmount() != null && booking.getDepositAmount().compareTo(BigDecimal.ZERO) > 0
                ? booking.getDepositAmount()
                : (booking.getStorageUnit() != null && booking.getStorageUnit().getUnitType() != null
                        && booking.getStorageUnit().getUnitType().getDepositAmount() != null
                        ? booking.getStorageUnit().getUnitType().getDepositAmount()
                        : BigDecimal.ZERO);
        BigDecimal requiredFirstMonthRent = booking.getTotalRentalFee() != null && booking.getRentalMonths() != null && booking.getRentalMonths() > 0
                ? booking.getTotalRentalFee().divide(BigDecimal.valueOf(booking.getRentalMonths()), 2, java.math.RoundingMode.HALF_UP)
                : (booking.getTotalRentalFee() != null && booking.getTotalRentalFee().compareTo(BigDecimal.ZERO) > 0
                        ? booking.getTotalRentalFee()
                        : BigDecimal.ZERO);

        BigDecimal paidDeposit = BigDecimal.ZERO;
        BigDecimal paidRent = BigDecimal.ZERO;
        BigDecimal paidBooking = BigDecimal.ZERO;
        BigDecimal refundedDeposit = BigDecimal.ZERO;
        BigDecimal refundedRent = BigDecimal.ZERO;
        BigDecimal refundedBooking = BigDecimal.ZERO;
        boolean hasRefundedOrRefundPendingDepositTx = false;
        boolean hasAnyRefundPendingTx = false;

        if (payments != null) {
            for (com.boxora.entity.Payment p : payments) {
                if (p == null || p.getAmount() == null || p.getAmount().compareTo(BigDecimal.ZERO) <= 0) {
                    continue;
                }
                if (booking.getId() != null && p.getBooking() != null && p.getBooking().getId() != null
                        && !booking.getId().equals(p.getBooking().getId())) {
                    continue;
                }
                PaymentStatus st = p.getStatus();
                com.boxora.enums.PaymentType pt = p.getPaymentType();
                if (pt != com.boxora.enums.PaymentType.DEPOSIT
                        && pt != com.boxora.enums.PaymentType.RENTAL_FEE
                        && pt != com.boxora.enums.PaymentType.BOOKING_PAYMENT) {
                    continue;
                }
                if (st == PaymentStatus.PAID) {
                    if (pt == com.boxora.enums.PaymentType.DEPOSIT) {
                        paidDeposit = paidDeposit.add(p.getAmount());
                    } else if (pt == com.boxora.enums.PaymentType.RENTAL_FEE) {
                        paidRent = paidRent.add(p.getAmount());
                    } else if (pt == com.boxora.enums.PaymentType.BOOKING_PAYMENT) {
                        paidBooking = paidBooking.add(p.getAmount());
                    }
                } else if (st == PaymentStatus.REFUND_PENDING) {
                    // REFUND_PENDING is awaiting refund/reconciliation, NOT yet transferred out.
                    hasAnyRefundPendingTx = true;
                    if (pt == com.boxora.enums.PaymentType.DEPOSIT || pt == com.boxora.enums.PaymentType.BOOKING_PAYMENT) {
                        hasRefundedOrRefundPendingDepositTx = true;
                    }
                } else if (st == PaymentStatus.REFUNDED) {
                    if (pt == com.boxora.enums.PaymentType.DEPOSIT) {
                        refundedDeposit = refundedDeposit.add(p.getAmount());
                        hasRefundedOrRefundPendingDepositTx = true;
                    } else if (pt == com.boxora.enums.PaymentType.RENTAL_FEE) {
                        refundedRent = refundedRent.add(p.getAmount());
                    } else if (pt == com.boxora.enums.PaymentType.BOOKING_PAYMENT) {
                        refundedBooking = refundedBooking.add(p.getAmount());
                        hasRefundedOrRefundPendingDepositTx = true;
                    }
                }
            }
        }

        if (paidDeposit.compareTo(BigDecimal.ZERO) == 0
                && paidRent.compareTo(BigDecimal.ZERO) == 0
                && paidBooking.compareTo(BigDecimal.ZERO) == 0
                && !hasRefundedOrRefundPendingDepositTx
                && !hasAnyRefundPendingTx
                && refundedRent.compareTo(BigDecimal.ZERO) == 0
                && booking.getStatus() != BookingStatus.PENDING_PAYMENT
                && "PAID".equalsIgnoreCase(booking.getPaymentStatus())) {
            return "PAID";
        }

        BigDecimal bookingDepositField = booking.getDepositPaid() != null && booking.getDepositPaid().compareTo(BigDecimal.ZERO) > 0
                ? booking.getDepositPaid()
                : BigDecimal.ZERO;
        boolean canFallbackToBookingDepositField = booking.getStatus() != BookingStatus.PENDING_PAYMENT
                && !hasRefundedOrRefundPendingDepositTx
                && !"UNPAID".equalsIgnoreCase(booking.getPaymentStatus());
        BigDecimal baseDepositPaid = (paidDeposit.compareTo(BigDecimal.ZERO) == 0 && paidBooking.compareTo(BigDecimal.ZERO) == 0)
                ? (canFallbackToBookingDepositField ? bookingDepositField : BigDecimal.ZERO)
                : paidDeposit;

        BigDecimal unpaidDeposit = requiredDeposit.subtract(baseDepositPaid).max(BigDecimal.ZERO);
        BigDecimal allocDeposit = paidBooking.min(unpaidDeposit);
        BigDecimal remBooking = paidBooking.subtract(allocDeposit).max(BigDecimal.ZERO);

        BigDecimal grossDepositPaid = baseDepositPaid.add(allocDeposit);
        BigDecimal grossRentPaid = paidRent.add(remBooking);

        BigDecimal deductDeposit = refundedDeposit.min(grossDepositPaid);
        BigDecimal excessDepositRefund = refundedDeposit.subtract(deductDeposit).max(BigDecimal.ZERO);
        BigDecimal afterDepositRefund = grossDepositPaid.subtract(deductDeposit).max(BigDecimal.ZERO);
        BigDecimal afterRentRefund = grossRentPaid.subtract(refundedRent).subtract(excessDepositRefund).max(BigDecimal.ZERO);

        BigDecimal deductBookingFromDeposit = refundedBooking.min(afterDepositRefund);
        BigDecimal remBookingRefund = refundedBooking.subtract(deductBookingFromDeposit).max(BigDecimal.ZERO);

        BigDecimal effectiveDepositPaid = afterDepositRefund.subtract(deductBookingFromDeposit).max(BigDecimal.ZERO);
        BigDecimal effectiveRentPaid = afterRentRefund.subtract(remBookingRefund).max(BigDecimal.ZERO);

        boolean depositOk = requiredDeposit.compareTo(BigDecimal.ZERO) <= 0 || effectiveDepositPaid.compareTo(requiredDeposit) >= 0;
        boolean rentOk = requiredFirstMonthRent.compareTo(BigDecimal.ZERO) <= 0 || effectiveRentPaid.compareTo(requiredFirstMonthRent) >= 0;
        if (depositOk && rentOk && (effectiveDepositPaid.compareTo(BigDecimal.ZERO) > 0 || effectiveRentPaid.compareTo(BigDecimal.ZERO) > 0)) {
            return "PAID";
        }
        if (effectiveDepositPaid.compareTo(BigDecimal.ZERO) > 0 || effectiveRentPaid.compareTo(BigDecimal.ZERO) > 0) {
            return "PARTIALLY_PAID";
        }
        return "UNPAID";
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
        if (paymentStatus == null || paymentStatus.isBlank() || "UNPAID".equalsIgnoreCase(paymentStatus) || "PENDING_PAYMENT".equalsIgnoreCase(paymentStatus)) {
            String reconciled = resolveReconciledPaymentStatus(b);
            if (!"UNPAID".equalsIgnoreCase(reconciled)) {
                paymentStatus = reconciled;
            }
        }
        if (paymentStatus == null || paymentStatus.isBlank()) {
            if (b.getStatus() == BookingStatus.ACTIVE || b.getStatus() == BookingStatus.COMPLETED) {
                paymentStatus = "PAID";
            } else if (b.getDepositPaid() != null && b.getDepositPaid().compareTo(BigDecimal.ZERO) > 0) {
                paymentStatus = "PARTIALLY_PAID";
            } else {
                paymentStatus = "UNPAID";
            }
        }

        BookingStatus effectiveStatus = b.getStatus() != null ? b.getStatus() : BookingStatus.PENDING_PAYMENT;
        if ("PAID".equalsIgnoreCase(paymentStatus) && effectiveStatus == BookingStatus.PENDING_PAYMENT) {
            effectiveStatus = BookingStatus.CONFIRMED;
        }

        UUID contractId = null;
        String contractCode = null;
        String contractStatus = null;
        Boolean contractSigned = false;
        if (b.getId() != null && rentalContractRepository != null) {
            try {
                Optional<RentalContract> cOpt = rentalContractRepository.findByBookingId(b.getId());
                if (cOpt.isPresent()) {
                    RentalContract c = cOpt.get();
                    contractId = c.getId();
                    contractCode = c.getContractCode();
                    contractStatus = c.getStatus() != null ? c.getStatus().name() : null;
                    contractSigned = c.getSignedAt() != null
                            || c.getStatus() == RentalContractStatus.PENDING_ACTIVATION
                            || c.getStatus() == RentalContractStatus.ACTIVE;
                }
            } catch (Exception ignored) {
            }
        }

        UnitType effectiveType = (b.getStorageUnit() != null && b.getStorageUnit().getUnitType() != null)
                ? b.getStorageUnit().getUnitType()
                : b.getUnitType();

        String plainAccessPin = null;
        if (b.getAccessPin() != null && !b.getAccessPin().isBlank()) {
            try {
                plainAccessPin = encryptionService.decrypt(b.getAccessPin());
            } catch (Exception ex) {
                plainAccessPin = b.getAccessPin();
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
                .unitTypeId(effectiveType != null ? effectiveType.getId() : null)
                .unitTypeName(effectiveType != null ? effectiveType.getTypeName() : null)
                .unitSize(effectiveType != null ? (effectiveType.getDimensions() != null ? effectiveType.getDimensions() : effectiveType.getTypeName()) : null)
                .areaSqMeters(effectiveType != null ? effectiveType.getAreaSqm() : null)
                .dimensions(effectiveType != null ? effectiveType.getDimensions() : null)
                .unitCode(b.getStorageUnit() != null ? b.getStorageUnit().getUnitCode() : null)
                .facilityId(b.getStorageUnit() != null && b.getStorageUnit().getFacility() != null
                        ? b.getStorageUnit().getFacility().getId()
                        : (b.getFacility() != null ? b.getFacility().getId() : null))
                .facilityName(b.getStorageUnit() != null && b.getStorageUnit().getFacility() != null
                        ? b.getStorageUnit().getFacility().getName()
                        : (b.getFacility() != null ? b.getFacility().getName() : null))
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
                .expectedCheckInAt(b.getExpectedCheckInAt())
                .paymentStatus(paymentStatus)
                .holdGraceHours(policyHoldGraceHours != null ? policyHoldGraceHours : 24)
                .status(effectiveStatus)
                .signingMethod(b.getSigningMethod() != null ? b.getSigningMethod() : "ONLINE")
                .assignedStaffId(b.getHandedOverByStaffId())
                .assignedStaffName(assignedStaffName)
                .staffAssignmentNotes(b.getStaffAssignmentNotes())
                .accessPin(plainAccessPin)
                .qrAccessToken(b.getQrAccessToken())
                .handoverTime(b.getHandoverTime())
                .returnTime(b.getReturnTime())
                .identityCardNumber(b.getIdentityCardNumber())
                .identityCardType(b.getIdentityCardType())
                .contractId(contractId)
                .contractCode(contractCode)
                .contractStatus(contractStatus)
                .contractSigned(contractSigned)
                .checkinOverdueReminderSentAt(b.getCheckinOverdueReminderSentAt())
                .build();
    }

    @Override
    @Transactional
    public BookingResponse assignUnitAndProvision(UUID bookingId, UUID unitId, String notes) {
        Booking booking = bookingRepository.findByIdForUpdate(bookingId)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        StorageUnit unit = storageUnitRepository.findWithDetailsByIdForUpdate(unitId)
                .orElseThrow(() -> new AppException(ErrorCode.STORAGE_UNIT_NOT_FOUND));

        if (unit.getStatus() != UnitStatus.AVAILABLE) {
            throw new AppException(ErrorCode.STORAGE_UNIT_NOT_AVAILABLE, "Ô kho vật lý được chọn không khả dụng (status != AVAILABLE).");
        }

        UUID bookingFacilityId = booking.getStorageUnit() != null && booking.getStorageUnit().getFacility() != null
                ? booking.getStorageUnit().getFacility().getId()
                : (booking.getFacility() != null ? booking.getFacility().getId() : null);
        if (bookingFacilityId != null && unit.getFacility() != null && !bookingFacilityId.equals(unit.getFacility().getId())) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Ô kho được chọn không thuộc cùng cơ sở của đơn đặt chỗ.");
        }

        UUID contractedTypeId = booking.getStorageUnit() != null && booking.getStorageUnit().getUnitType() != null
                ? booking.getStorageUnit().getUnitType().getId()
                : (booking.getUnitType() != null ? booking.getUnitType().getId() : null);
        if (contractedTypeId != null && unit.getUnitType() != null && !contractedTypeId.equals(unit.getUnitType().getId())) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Ô kho được chọn không đúng loại hoặc kích thước kho đã đăng ký/ký trong hợp đồng.");
        }

        unit.setStatus(UnitStatus.RESERVED);
        storageUnitRepository.save(unit);

        booking.setStorageUnit(unit);
        booking.setStatus(BookingStatus.CONFIRMED);
        booking.setHandoverTime(LocalDateTime.now());
        if (requestContext != null && requestContext.currentUserId() != null) {
            booking.setHandedOverByStaffId(requestContext.currentUserId());
        }
        if (notes != null && !notes.isBlank()) {
            booking.setStaffAssignmentNotes(notes);
        }

        int randomPin = 100000 + new java.security.SecureRandom().nextInt(900000);
        String pin = String.valueOf(randomPin);
        booking.setAccessPin(pin);
        booking.setAccessCode(pin);
        booking.setQrAccessToken(UUID.randomUUID().toString());
        booking = bookingRepository.save(booking);

        Optional<RentalContract> contractOpt = rentalContractRepository.findByBookingId(booking.getId());
        RentalContract contract = null;
        if (contractOpt.isPresent()) {
            contract = contractOpt.get();
            contract.setUnit(unit);
            if (contract.getFacility() == null) {
                contract.setFacility(unit.getFacility());
            }
            contract = rentalContractRepository.save(contract);
        }

        // Note: Do NOT dispatch handover email here at Step 2 unit assignment.
        // Handover email is only dispatched at Step 4 upon completion of inspection & check-in.

        activityLogService.record(
                unit.getFacility() != null ? unit.getFacility().getId() : null,
                ActivityAction.STORAGE_UNIT_ASSIGN,
                "BOOKING",
                booking.getId(),
                "Nhân viên đã gán ô kho " + unit.getUnitCode() + " và phát sinh mã khóa IoT cho đơn " + booking.getBookingCode(),
                BookingStatus.PAID_PENDING_ASSIGNMENT,
                BookingStatus.CONFIRMED
        );

        return mapToResponse(booking);
    }

    @Override
    @Transactional
    public BookingResponse assignUnitAndProvisionByCode(String bookingCode, UUID unitId, String notes) {
        if (bookingCode == null || bookingCode.isBlank()) {
            throw new AppException(ErrorCode.BOOKING_NOT_FOUND);
        }
        Booking booking = bookingRepository.findByBookingCodeForUpdate(bookingCode.trim())
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        return assignUnitAndProvision(booking.getId(), unitId, notes);
    }

    @Override
    @Transactional(readOnly = true)
    public BookingResponse getByBookingCode(String bookingCode) {
        if (bookingCode == null || bookingCode.isBlank()) {
            throw new AppException(ErrorCode.BOOKING_NOT_FOUND);
        }
        Booking booking = bookingRepository.findByBookingCode(bookingCode.trim())
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        User currentUser = (requestContext != null && requestContext.currentUserId() != null)
                ? userRepository.findById(requestContext.currentUserId()).orElse(null)
                : null;
        if (currentUser != null) {
            validateBookingAccess(booking, currentUser);
        }

        return mapToResponse(booking);
    }

    @Override
    @Transactional
    public BookingResponse confirmBooking(UUID bookingId, String notes) {
        Booking booking = bookingRepository.findByIdForUpdate(bookingId)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        BookingStatus oldStatus = booking.getStatus();
        if (oldStatus == BookingStatus.CANCELLED || oldStatus == BookingStatus.COMPLETED || oldStatus == BookingStatus.ACTIVE) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Không thể xác nhận đơn đặt kho ở trạng thái " + oldStatus);
        }

        UUID facilityId = booking.getStorageUnit() != null && booking.getStorageUnit().getFacility() != null
                ? booking.getStorageUnit().getFacility().getId()
                : (booking.getFacility() != null ? booking.getFacility().getId() : null);

        if (facilityId != null && facilityAccessGuard != null && facilityAccessGuard.isFacilityScoped()) {
            facilityAccessGuard.checkFacilityAccess(facilityId);
        }

        booking.setStatus(BookingStatus.CONFIRMED);
        if (requestContext != null && requestContext.currentUserId() != null) {
            booking.setHandedOverByStaffId(requestContext.currentUserId());
        }
        if (notes != null && !notes.isBlank()) {
            booking.setStaffAssignmentNotes(notes.trim());
        }
        booking.setPaymentExpiresAt(null);

        booking = bookingRepository.save(booking);

        activityLogService.record(
                facilityId,
                ActivityAction.RESERVATION_UPDATE,
                "BOOKING",
                booking.getId(),
                "Nhân viên đã xác nhận đơn đặt giữ chỗ " + booking.getBookingCode() + (notes != null && !notes.isBlank() ? " (Ghi chú: " + notes.trim() + ")" : ""),
                oldStatus,
                BookingStatus.CONFIRMED
        );

        return mapToResponse(booking);
    }

    @Override
    @Transactional
    public BookingResponse confirmBookingByCode(String bookingCode, String notes) {
        if (bookingCode == null || bookingCode.isBlank()) {
            throw new AppException(ErrorCode.BOOKING_NOT_FOUND);
        }
        Booking booking = bookingRepository.findByBookingCodeForUpdate(bookingCode.trim())
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));
        return confirmBooking(booking.getId(), notes);
    }
}

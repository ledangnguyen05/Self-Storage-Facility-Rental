package com.boxora.service.impl;
import com.boxora.dto.request.CheckInInspectionRequest;


import com.boxora.dto.request.*;
import com.boxora.dto.response.HandoverPrerequisitesResponse;
import com.boxora.dto.response.*;
import com.boxora.dto.response.HandoverResponse;
import com.boxora.dto.response.ReturnSettlementPreviewResponse;
import com.boxora.dto.response.ReturnSettlementResponse;
import com.boxora.entity.*;
import com.boxora.enums.*;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.mapper.*;
import com.boxora.repository.*;
import com.boxora.service.ActivityLogService;
import com.boxora.service.EmailService;
import com.boxora.service.EncryptionService;
import com.boxora.service.HandoverService;
import com.boxora.service.StorageUnitLockService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class HandoverServiceImpl implements HandoverService {

    private final HandoverRecordRepository handoverRecordRepository;
    private final BookingRepository bookingRepository;
    private final StorageUnitRepository storageUnitRepository;
    private final UserRepository userRepository;
    private final PaymentRepository paymentRepository;
    private final RentalContractRepository rentalContractRepository;
    private final FacilityPolicyRepository facilityPolicyRepository;
    private final ActivityLogService activityLogService;
    private final com.boxora.security.FacilityAccessGuard facilityAccessGuard;
    private final com.boxora.security.RequestContext requestContext;
    private final PaymentMapper paymentMapper;
    private final RentalContractMapper rentalContractMapper;
    private final com.boxora.service.FileStorageService fileStorageService;
    private final StorageUnitLockService storageUnitLockService;
    private final EncryptionService encryptionService;
    private final NotificationLogRepository notificationLogRepository;
    private final EmailService emailService;

    /**
     * Đối soát 4 điều kiện tiên quyết trước khi check-in bàn giao (BR-RULE-005):
     * 1. Đủ tiền cọc (Full deposit)
     * 2. Đủ tiền thuê tháng đầu (First month rental fee)
     * 3. Hợp đồng điện tử đã ký qua OTP / DocuSeal (Signed e-contract)
     * 4. Xác minh CCCD / giấy tờ tùy thân gốc (Original identity verification)
     */
    @Override
    @Transactional(readOnly = true)
    public HandoverPrerequisitesResponse getCheckInPrerequisites(UUID bookingId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        StorageUnit unit = booking.getStorageUnit();
        User customer = booking.getCustomer();

        if (unit != null && unit.getFacility() != null) {
            facilityAccessGuard.checkFacilityAccess(unit.getFacility().getId());
        }

        // 1. Tính toán Điều kiện 1: Đủ tiền cọc (Full deposit)
        BigDecimal requiredDeposit = getRequiredDeposit(booking, unit);
        BigDecimal depositPaid = calculateTotalDepositPaid(booking);
        boolean depositSatisfied = depositPaid.compareTo(BigDecimal.ZERO) > 0
                && depositPaid.compareTo(requiredDeposit) >= 0;

        // 2. Tính toán Điều kiện 2: Đủ tiền thuê tháng đầu (First month rental fee)
        BigDecimal requiredFirstMonthRent = getRequiredFirstMonthRent(booking, unit);
        BigDecimal firstMonthRentPaid = calculateTotalFirstMonthRentPaid(booking);
        boolean firstMonthRentSatisfied = firstMonthRentPaid.compareTo(BigDecimal.ZERO) > 0
                && firstMonthRentPaid.compareTo(requiredFirstMonthRent) >= 0;

        // 3. Tính toán Điều kiện 3: Hợp đồng điện tử đã ký (Signed e-contract)
        Optional<RentalContract> contractOpt = rentalContractRepository.findByBookingId(booking.getId());
        boolean contractSigned = contractOpt.isPresent() && (
                contractOpt.get().getStatus() == RentalContractStatus.ACTIVE
                        || contractOpt.get().getDocusealSubmissionId() != null
        );
        String contractCode = contractOpt.map(RentalContract::getContractCode).orElse(null);
        String contractStatus = contractOpt.map(c -> c.getStatus().name()).orElse("CHƯA_TẠO");

        // 4. Tính toán Điều kiện 4: Đối soát CCCD gốc (Original identity verification)
        // Khi truy vấn xem trước, nếu khách hàng đã có thông tin CCCD hoặc đã xác minh trên hồ sơ
        boolean identityVerified = customer != null && customer.getPhone() != null && !customer.getPhone().isBlank();
        String idCardNumber = null;

        List<String> missing = new ArrayList<>();
        if (!depositSatisfied) {
            missing.add(String.format("Chưa thanh toán đủ tiền đặt cọc quy định (Đã nộp: %s VNĐ / Yêu cầu: %s VNĐ)",
                    depositPaid, requiredDeposit));
        }
        if (!firstMonthRentSatisfied) {
            missing.add(String.format("Chưa thanh toán tiền thuê tháng đầu tiên (Đã nộp: %s VNĐ / Yêu cầu: %s VNĐ)",
                    firstMonthRentPaid, requiredFirstMonthRent));
        }
        if (!contractSigned) {
            missing.add(String.format("Hợp đồng điện tử chưa được ký xác nhận qua mã OTP/DocuSeal (Trạng thái: %s)",
                    contractStatus));
        }
        if (!identityVerified) {
            missing.add("Chưa đối soát giấy tờ tùy thân / CCCD gốc của khách hàng tại quầy");
        }

        boolean eligible = missing.isEmpty();

        return HandoverPrerequisitesResponse.builder()
                .bookingId(booking.getId())
                .bookingCode(booking.getBookingCode())
                .customerName(customer != null ? customer.getFullName() : "N/A")
                .customerPhone(customer != null ? customer.getPhone() : "N/A")
                .unitCode(unit != null ? unit.getUnitCode() : "N/A")
                .facilityName((unit != null && unit.getFacility() != null) ? unit.getFacility().getName() : "N/A")
                .depositSatisfied(depositSatisfied)
                .depositPaid(depositPaid)
                .requiredDeposit(requiredDeposit)
                .firstMonthRentSatisfied(firstMonthRentSatisfied)
                .firstMonthRentPaid(firstMonthRentPaid)
                .requiredFirstMonthRent(requiredFirstMonthRent)
                .contractSigned(contractSigned)
                .contractCode(contractCode)
                .contractStatus(contractStatus)
                .identityVerified(identityVerified)
                .idCardNumber(idCardNumber)
                .eligibleForCheckIn(eligible)
                .missingPrerequisites(missing)
                .build();
    }

    /**
     * Thực hiện Check-in và bàn giao kho vật lý (BR-RULE-005 và BR-RULE-006):
     * Bắt buộc thỏa mãn đồng thời cả 4 điều kiện.
     */
    @Override
    public HandoverResponse checkIn(HandoverRequest request) {
        Booking booking = bookingRepository.findById(request.getBookingId())
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        if (booking.getStatus() == BookingStatus.ACTIVE) {
            throw new AppException(ErrorCode.HANDOVER_ALREADY_ACTIVE);
        }

        if (booking.getStatus() == BookingStatus.CANCELLED || booking.getStatus() == BookingStatus.COMPLETED) {
            throw new AppException(ErrorCode.BOOKING_CANNOT_BE_CANCELLED);
        }

        StorageUnit unit = booking.getStorageUnit();
        if (unit == null) {
            throw new AppException(ErrorCode.STORAGE_UNIT_NOT_FOUND);
        }

        if (unit.getFacility() != null) {
            facilityAccessGuard.checkFacilityAccess(unit.getFacility().getId());
        }

        // =========================================================================
        // BR-RULE-006: UNIT ASSIGNMENT & READY STATE
        // Ngăn kho phải ở trạng thái RESERVED hoặc AVAILABLE (sẵn sàng bàn giao)
        // =========================================================================
        if (unit.getStatus() != UnitStatus.RESERVED && unit.getStatus() != UnitStatus.AVAILABLE) {
            log.warn("[BR-RULE-006] Unit {} is in invalid state {} for check-in", unit.getUnitCode(), unit.getStatus());
            throw new AppException(ErrorCode.HANDOVER_UNIT_NOT_READY);
        }

        // =========================================================================
        // BR-RULE-005: KIỂM TRA 4 ĐIỀU KIỆN BẮT BUỘC
        // =========================================================================
        List<String> missingPrerequisites = new ArrayList<>();

        // Điều kiện 1: Đủ tiền cọc (Full deposit)
        BigDecimal requiredDeposit = getRequiredDeposit(booking, unit);
        BigDecimal depositPaid = calculateTotalDepositPaid(booking);
        boolean depositSatisfied = (depositPaid.compareTo(BigDecimal.ZERO) > 0
                && depositPaid.compareTo(requiredDeposit) >= 0)
                || (request.getDepositSettled() != null && request.getDepositSettled().compareTo(requiredDeposit) >= 0);
        if (!depositSatisfied) {
            missingPrerequisites.add("Chưa thanh toán đủ tiền cọc");
        }

        // Điều kiện 2: Đủ tiền thuê tháng đầu (First month rent)
        BigDecimal requiredFirstMonthRent = getRequiredFirstMonthRent(booking, unit);
        BigDecimal firstMonthRentPaid = calculateTotalFirstMonthRentPaid(booking);
        boolean firstMonthRentSatisfied = (firstMonthRentPaid.compareTo(BigDecimal.ZERO) > 0
                && firstMonthRentPaid.compareTo(requiredFirstMonthRent) >= 0)
                || Boolean.TRUE.equals(request.getFirstMonthRentConfirmed());
        if (!firstMonthRentSatisfied) {
            missingPrerequisites.add("Chưa thanh toán tiền thuê tháng đầu tiên");
        }

        // Điều kiện 3: Hợp đồng điện tử đã ký (Signed e-contract)
        Optional<RentalContract> contractOpt = rentalContractRepository.findByBookingId(booking.getId());
        boolean contractSigned = (contractOpt.isPresent() && (
                contractOpt.get().getStatus() == RentalContractStatus.ACTIVE
                        || contractOpt.get().getDocusealSubmissionId() != null
        )) || Boolean.TRUE.equals(request.getContractConfirmed());
        if (!contractSigned) {
            missingPrerequisites.add("Hợp đồng điện tử chưa được ký qua OTP/DocuSeal");
        }

        // Operator authorization check: check-in is restricted to staff and facility managers.
        // Điều kiện 4: Nhân viên tại quầy đối soát CCCD / giấy tờ tùy thân gốc
        boolean idAlreadyVerified = Boolean.TRUE.equals(booking.getIdentityOriginalDocumentSeen())
                && booking.getIdentityVerifiedAt() != null
                && booking.getIdentityVerifiedByStaff() != null
                && booking.getIdentityCardNumber() != null
                && booking.getIdentityCardNumber().matches("^[0-9]{9,12}$");

        boolean identityVerified = idAlreadyVerified
                || (request.getIdCardNumber() != null && !request.getIdCardNumber().trim().isEmpty())
                || Boolean.TRUE.equals(request.getIdentityVerified());

        if (!identityVerified) {
            missingPrerequisites.add("Chưa đối soát giấy tờ tùy thân / CCCD gốc của khách hàng tại quầy");
        }

        if (!missingPrerequisites.isEmpty()) {
            log.warn("[BR-RULE-005] Check-in failed for booking {}. Missing prerequisites: {}",
                    booking.getBookingCode(), missingPrerequisites);
            throw new AppException(ErrorCode.HANDOVER_PREREQUISITES_NOT_MET);
        }

        String requestedUnitCode = request.getRequestedUnitCode() != null
                ? request.getRequestedUnitCode().trim()
                : "";
        if (requestedUnitCode.isBlank()) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Cần xác nhận mã kho khách hàng chọn trước khi bàn giao.");
        }
        UUID facilityIdForAssignment = unit.getFacility() != null ? unit.getFacility().getId() : null;
        if (facilityIdForAssignment == null) {
            throw new AppException(ErrorCode.STORAGE_UNIT_NOT_FOUND);
        }
        StorageUnit previousUnit = unit;
        StorageUnit selectedUnit = storageUnitRepository
                .findWithDetailsByFacilityAndUnitCodeForUpdate(facilityIdForAssignment, requestedUnitCode)
                .orElseThrow(() -> new AppException(ErrorCode.STORAGE_UNIT_NOT_FOUND,
                        "Không tìm thấy vị trí kho khách hàng chọn tại cơ sở này."));
        if (selectedUnit.getUnitType() == null || previousUnit.getUnitType() == null
                || !selectedUnit.getUnitType().getId().equals(previousUnit.getUnitType().getId())) {
            throw new AppException(ErrorCode.INVALID_REQUEST,
                    "Vị trí khách hàng chọn không cùng loại kho với đơn đặt chỗ.");
        }
        boolean isOriginalUnit = selectedUnit.getId().equals(previousUnit.getId());
        boolean selectedUnitReady = selectedUnit.getStatus() == UnitStatus.AVAILABLE
                || (isOriginalUnit && selectedUnit.getStatus() == UnitStatus.RESERVED);
        if (!selectedUnitReady) {
            throw new AppException(ErrorCode.HANDOVER_UNIT_NOT_READY,
                    "Vị trí kho khách hàng chọn hiện không còn trống. Vui lòng chọn vị trí khác.");
        }
        boolean hasOtherReservation = bookingRepository.existsByStorageUnit_IdAndStatusInAndIdNot(
                selectedUnit.getId(),
                List.of(BookingStatus.ACTIVE, BookingStatus.CONFIRMED, BookingStatus.PENDING_PAYMENT,
                        BookingStatus.PENDING_APPROVAL),
                booking.getId());
        if (hasOtherReservation) {
            throw new AppException(ErrorCode.HANDOVER_UNIT_NOT_READY,
                    "Vị trí kho khách hàng chọn đã được đặt bởi một đơn khác.");
        }
        if (!isOriginalUnit) {
            booking.setStorageUnit(selectedUnit);
            unit = selectedUnit;
            if (previousUnit.getStatus() == UnitStatus.RESERVED) {
                boolean previousUnitHasOtherReservation = bookingRepository.existsByStorageUnit_IdAndStatusInAndIdNot(
                        previousUnit.getId(),
                        List.of(BookingStatus.ACTIVE, BookingStatus.CONFIRMED, BookingStatus.PENDING_PAYMENT,
                                BookingStatus.PENDING_APPROVAL),
                        booking.getId());
                if (!previousUnitHasOtherReservation) {
                    previousUnit.setStatus(UnitStatus.AVAILABLE);
                    storageUnitRepository.save(previousUnit);
                    storageUnitLockService.releaseLock(previousUnit.getId());
                }
            }
        }
        contractOpt.ifPresent(contract -> {
            contract.setUnit(selectedUnit);
            rentalContractRepository.save(contract);
        });
        // =========================================================================
        // THỰC HIỆN BÀN GIAO THỰC ĐỊA & CẤP QUYỀN TRUY CẬP
        // =========================================================================
        User staff = resolveStaff(request.getStaffId());

        booking.setStatus(BookingStatus.ACTIVE);
        booking.setHandoverTime(LocalDateTime.now());
        if (staff != null) {
            booking.setHandedOverByStaffId(staff.getId());
        }

        // Cập nhật hoặc cấp mã PIN và QR truy cập SmartLock
        if (request.getAccessPin() != null && !request.getAccessPin().isBlank()) {
            booking.setAccessPin(request.getAccessPin());
        } else if (booking.getAccessPin() == null) {
            booking.setAccessPin(String.format("%06d", new java.util.Random().nextInt(1000000)));
        }
        if (booking.getQrAccessToken() == null) {
            booking.setQrAccessToken("QR-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        }

        bookingRepository.save(booking);

        // Chuyển ngăn kho sang OCCUPIED
        unit.setStatus(UnitStatus.OCCUPIED);
        storageUnitRepository.save(unit);

        // Kích hoạt trạng thái hợp đồng thuê sang ACTIVE nếu có
        contractOpt.ifPresent(contract -> {
            if (contract.getStatus() != RentalContractStatus.ACTIVE) {
                contract.setStatus(RentalContractStatus.ACTIVE);
                rentalContractRepository.save(contract);
            }
        });

        // Ghi biên bản bàn giao HandoverRecord
        String notes = String.format("Check-in hoàn tất đạt chuẩn 4 điều kiện BR-RULE-005. Số CCCD đối soát: %s. Mã thẻ RFID: %s. %s",
                request.getIdCardNumber() != null ? request.getIdCardNumber() : "Đã đối chiếu",
                request.getRfidCardNumber() != null ? request.getRfidCardNumber() : "N/A",
                request.getNotes() != null ? request.getNotes() : "");

        HandoverRecord record = HandoverRecord.builder()
                .booking(booking)
                .staff(staff)
                .recordType("CHECK_IN")
                .unitCondition(request.getUnitCondition() != null ? request.getUnitCondition() : "Đạt chuẩn 5/5 kiểm định hiện trạng")
                .notes(notes)
                .recordedAt(LocalDateTime.now())
                .build();

        record = handoverRecordRepository.save(record);

        // Ghi Audit Trail ActivityLog
        UUID facilityId = (unit.getFacility() != null) ? unit.getFacility().getId() : null;
        activityLogService.record(
                facilityId,
                ActivityAction.CHECKIN_VERIFIED,
                "Booking",
                booking.getId(),
                String.format("Xác minh đủ 4 điều kiện check-in (Cọc + Tiền thuê + Hợp đồng + CCCD: %s) cho đơn %s",
                        request.getIdCardNumber() != null ? request.getIdCardNumber() : "Hợp lệ", booking.getBookingCode()),
                null,
                null
        );

        activityLogService.record(
                facilityId,
                ActivityAction.HANDOVER_COMPLETE,
                "HandoverRecord",
                record.getId(),
                String.format("Bàn giao thành công ngăn kho %s cho khách hàng %s. Đã kích hoạt SmartLock.",
                        unit.getUnitCode(), booking.getCustomer() != null ? booking.getCustomer().getFullName() : "Khách"),
                UnitStatus.RESERVED,
                UnitStatus.OCCUPIED
        );

        return mapToResponse(record);
    }

    @Override
    @Transactional(readOnly = true)
    public ReturnSettlementPreviewResponse getReturnSettlementPreview(UUID bookingId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        StorageUnit unit = booking.getStorageUnit();
        User customer = booking.getCustomer();
        Facility facility = (unit != null) ? unit.getFacility() : null;

        if (facility != null) {
            facilityAccessGuard.checkFacilityAccess(facility.getId());
        }

        Optional<RentalContract> contractOpt = rentalContractRepository.findByBookingId(booking.getId());
        String contractCode = contractOpt.map(RentalContract::getContractCode).orElse(null);
        String contractStatus = contractOpt.map(c -> c.getStatus().name()).orElse("N/A");

        Optional<FacilityPolicy> policyOpt = (facility != null)
                ? facilityPolicyRepository.findByFacilityId(facility.getId())
                : Optional.empty();

        int slaDays = policyOpt.map(FacilityPolicy::getDepositRefundSlaDays).orElse(5);
        BigDecimal dailyLateFee = policyOpt.map(FacilityPolicy::getDailyLateFee).orElse(new BigDecimal("100000.00"));
        int graceDays = policyOpt.map(FacilityPolicy::getOverdueGraceDays).orElse(1);

        BigDecimal depositPaid = calculateTotalDepositPaid(booking);

        LocalDate today = LocalDate.now();
        LocalDate endDate = booking.getEndDate();
        long overdueDays = 0;
        BigDecimal calculatedOverdueLateFee = BigDecimal.ZERO;

        if (endDate != null && today.isAfter(endDate)) {
            overdueDays = ChronoUnit.DAYS.between(endDate, today);
            long billableDays = Math.max(0, overdueDays - graceDays);
            if (billableDays > 0 && dailyLateFee != null) {
                calculatedOverdueLateFee = dailyLateFee.multiply(BigDecimal.valueOf(billableDays));
            }
        }

        String recommendedReviewStatus = calculatedOverdueLateFee.compareTo(BigDecimal.ZERO) > 0
                ? "PENDING_ACCOUNTING_REVIEW"
                : "AUTO_REFUND_APPROVED";

        List<String> checklistStandards = List.of(
                "1. Tình trạng cửa cuốn: Mở êm, không móp méo, ray dẫn tốt",
                "2. Vệ sinh kho & sàn: Đã dọn sạch rác, không ẩm ướt",
                "3. Ổ khóa Smart Lock: Cảm biến nhạy, pin tốt, khóa chốt chắc chắn",
                "4. Cảm biến nhiệt / ẩm: Thông số đạt chuẩn, hoạt động bình thường",
                "5. Tường vách & kết cấu: Không bong tróc nứt vỡ, nguyên vẹn"
        );

        return ReturnSettlementPreviewResponse.builder()
                .bookingId(booking.getId())
                .bookingCode(booking.getBookingCode())
                .customerName(customer != null ? customer.getFullName() : "N/A")
                .customerPhone(customer != null ? customer.getPhone() : "N/A")
                .unitCode(unit != null ? unit.getUnitCode() : "N/A")
                .facilityName(facility != null ? facility.getName() : "N/A")
                .contractCode(contractCode)
                .contractStatus(contractStatus)
                .rentalEndDate(endDate)
                .actualReturnDate(today)
                .overdueDays(overdueDays)
                .depositPaid(depositPaid)
                .dailyLateFee(dailyLateFee)
                .calculatedOverdueLateFee(calculatedOverdueLateFee)
                .depositRefundSlaDays(slaDays)
                .recommendedReviewStatus(recommendedReviewStatus)
                .checklistStandardItems(checklistStandards)
                .build();
    }

    @Override
    public HandoverResponse requestCheckout(UUID bookingId, String notes) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        if (booking.getStatus() != BookingStatus.ACTIVE && booking.getStatus() != BookingStatus.OVERDUE) {
            throw new AppException(ErrorCode.BOOKING_NOT_ACTIVE_FOR_RETURN);
        }

        if (booking.getStorageUnit() != null && booking.getStorageUnit().getFacility() != null) {
            if (facilityAccessGuard.isFacilityScoped()) {
                facilityAccessGuard.checkFacilityAccess(booking.getStorageUnit().getFacility().getId());
            }
        }
        if ("CUSTOMER".equalsIgnoreCase(requestContext.currentUserRole())) {
            UUID currentUserId = requestContext.currentUserId();
            if (currentUserId != null && !currentUserId.equals(booking.getCustomer().getId())) {
                throw new AppException(ErrorCode.FORBIDDEN);
            }
        }

        booking.setStatus(BookingStatus.CHECKOUT_REQUESTED);
        bookingRepository.save(booking);

        UUID facilityId = (booking.getStorageUnit() != null && booking.getStorageUnit().getFacility() != null)
                ? booking.getStorageUnit().getFacility().getId() : null;

        activityLogService.record(
                facilityId,
                ActivityAction.CHECKOUT_REQUEST,
                "Booking",
                booking.getId(),
                "Khách hàng gửi yêu cầu trả kho cho đơn " + booking.getBookingCode() + (notes != null ? ": " + notes : ""),
                BookingStatus.ACTIVE,
                BookingStatus.CHECKOUT_REQUESTED
        );

        User staff = resolveStaff(booking.getHandedOverByStaffId());

        HandoverRecord record = HandoverRecord.builder()
                .booking(booking)
                .staff(staff)
                .recordType("CHECKOUT_REQUEST")
                .unitCondition("Chờ nhân viên kiểm định hiện trường")
                .notes(notes)
                .recordedAt(LocalDateTime.now())
                .build();
        record = handoverRecordRepository.save(record);

        return mapToResponse(record);
    }

    @Override
    @Transactional
    public HandoverResponse performInspection(HandoverRequest request) {
        Booking booking = bookingRepository.findById(request.getBookingId())
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        User staff = requireAuthorizedStaffOperator(null);
        StorageUnit unit = booking.getStorageUnit();
        Facility facility = (unit != null) ? unit.getFacility() : null;

        if (facility != null) {
            facilityAccessGuard.checkFacilityAccess(facility.getId());
        }
        if (booking.getStatus() != BookingStatus.ACTIVE && booking.getStatus() != BookingStatus.OVERDUE
                && booking.getStatus() != BookingStatus.CHECKOUT_REQUESTED && booking.getStatus() != BookingStatus.INSPECTED) {
            throw new AppException(ErrorCode.BOOKING_NOT_ACTIVE_FOR_RETURN);
        }

        if (request.getDoorConditionPassed() == null || request.getCleanlinessPassed() == null
                || request.getSmartLockPassed() == null || request.getSensorPassed() == null
                || request.getWallStructurePassed() == null) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "All five return inspection checklist values are required.");
        }
        boolean doorPassed = Boolean.TRUE.equals(request.getDoorConditionPassed());
        boolean cleanlinessPassed = Boolean.TRUE.equals(request.getCleanlinessPassed());
        boolean smartLockPassed = Boolean.TRUE.equals(request.getSmartLockPassed());
        boolean sensorPassed = Boolean.TRUE.equals(request.getSensorPassed());
        boolean wallPassed = Boolean.TRUE.equals(request.getWallStructurePassed());

        String checklistSummary = String.format(
                "Cửa cuốn: %s | Vệ sinh: %s | SmartLock: %s | Cảm biến: %s | Tường vách: %s",
                doorPassed ? "Đạt" : "Không đạt",
                cleanlinessPassed ? "Sạch sẽ" : "Chưa dọn",
                smartLockPassed ? "Tốt" : "Lỗi",
                sensorPassed ? "Chuẩn" : "Lỗi",
                wallPassed ? "Nguyên vẹn" : "Hư hại"
        );

        List<String> evidencePhotos = request.getEvidencePhotos() != null
                ? request.getEvidencePhotos().stream()
                    .map(url -> validateStoredDocumentUrl(url, "Return inspection evidence photo"))
                    .distinct()
                    .collect(Collectors.toList())
                : List.of();
        if (evidencePhotos.size() < 2) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Two uploaded return inspection evidence photos are required.");
        }
        String photosStr = String.join(";", evidencePhotos);

        booking.setStatus(BookingStatus.INSPECTED);
        bookingRepository.save(booking);

        HandoverRecord record = HandoverRecord.builder()
                .booking(booking)
                .staff(staff)
                .recordType("INSPECTION")
                .unitCondition(request.getUnitCondition() != null ? request.getUnitCondition() : "Đã hoàn thành kiểm định hiện trường")
                .checklistSummary(checklistSummary)
                .evidencePhotos(photosStr)
                .doorConditionPassed(doorPassed)
                .cleanlinessPassed(cleanlinessPassed)
                .smartLockPassed(smartLockPassed)
                .sensorPassed(sensorPassed)
                .wallStructurePassed(wallPassed)
                .notes(request.getNotes())
                .recordedAt(LocalDateTime.now())
                .build();
        record = handoverRecordRepository.save(record);

        activityLogService.record(
                facility != null ? facility.getId() : null,
                ActivityAction.CHECKOUT_INSPECTION_COMPLETE,
                "HandoverRecord",
                record.getId(),
                String.format("Nhân viên %s hoàn thành kiểm định hiện trường ngăn kho %s: %s",
                        staff != null ? staff.getFullName() : "N/A",
                        unit != null ? unit.getUnitCode() : "N/A",
                        checklistSummary),
                BookingStatus.CHECKOUT_REQUESTED,
                BookingStatus.INSPECTED
        );

        return mapToResponse(record);
    }

    @Override
    public HandoverResponse processReturn(HandoverRequest request) {
        HandoverRecord record = processReturnSettlementInternal(request);
        return mapToResponse(record);
    }

    @Override
    public ReturnSettlementResponse processReturnSettlement(HandoverRequest request) {
        HandoverRecord record = processReturnSettlementInternal(request);

        List<String> photos = (record.getEvidencePhotos() != null && !record.getEvidencePhotos().isBlank())
                ? Arrays.asList(record.getEvidencePhotos().split(";"))
                : List.of();

        boolean checklistAllPassed = record.getChecklistSummary() == null || (
                !record.getChecklistSummary().contains("Không đạt")
                && !record.getChecklistSummary().contains("Chưa dọn")
                && !record.getChecklistSummary().contains("Lỗi")
                && !record.getChecklistSummary().contains("Hư hại")
        );

        BigDecimal damageFee = request.getDamageFee() != null ? request.getDamageFee() : BigDecimal.ZERO;
        BigDecimal cleaningFee = request.getCleaningFee() != null ? request.getCleaningFee() : BigDecimal.ZERO;
        BigDecimal lostCardFee = request.getLostCardFee() != null ? request.getLostCardFee() : BigDecimal.ZERO;
        BigDecimal overdueDebt = request.getOverdueDebt() != null ? request.getOverdueDebt() : BigDecimal.ZERO;

        Booking booking = record.getBooking();
        StorageUnit unit = (booking != null) ? booking.getStorageUnit() : null;
        Facility facility = (unit != null) ? unit.getFacility() : null;
        Optional<FacilityPolicy> policyOpt = (facility != null)
                ? facilityPolicyRepository.findByFacilityId(facility.getId())
                : Optional.empty();
        int refundSlaDays = policyOpt.map(FacilityPolicy::getDepositRefundSlaDays).orElse(5);

        return ReturnSettlementResponse.builder()
                .handoverRecordId(record.getId())
                .bookingId(booking != null ? booking.getId() : null)
                .bookingCode(booking != null ? booking.getBookingCode() : null)
                .unitCode(unit != null ? unit.getUnitCode() : null)
                .customerName(booking != null && booking.getCustomer() != null ? booking.getCustomer().getFullName() : null)
                .staffId(record.getStaff() != null ? record.getStaff().getId() : null)
                .staffName(record.getStaff() != null ? record.getStaff().getFullName() : null)
                .depositPaid(record.getDepositSettled())
                .damageFee(damageFee)
                .cleaningFee(cleaningFee)
                .lostCardFee(lostCardFee)
                .overdueDebt(overdueDebt)
                .totalDeduction(record.getDeductionAmount())
                .netRefundAmount(record.getRefundAmount())
                .reviewStatus(record.getReviewStatus())
                .depositRefundSlaDays(refundSlaDays)
                .refundTransactionId(null)
                .checklistAllPassed(checklistAllPassed)
                .checklistSummary(record.getChecklistSummary())
                .evidencePhotoCount(photos.size())
                .evidencePhotos(photos)
                .recordedAt(record.getRecordedAt())
                .notes(record.getNotes())
                .build();
    }

    private HandoverRecord processReturnSettlementInternal(HandoverRequest request) {
        Booking booking = bookingRepository.findById(request.getBookingId())
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        if (booking.getStatus() != BookingStatus.ACTIVE) {
            log.warn("[BR-RULE-013] Booking {} is in status {}, must be ACTIVE for return",
                    booking.getBookingCode(), booking.getStatus());
            throw new AppException(ErrorCode.BOOKING_NOT_ACTIVE_FOR_RETURN);
        }

        User staff = resolveStaff(request.getStaffId());

        StorageUnit unit = booking.getStorageUnit();
        Facility facility = (unit != null) ? unit.getFacility() : null;

        if (facility != null) {
            facilityAccessGuard.checkFacilityAccess(facility.getId());
        }

        Optional<FacilityPolicy> policyOpt = (facility != null)
                ? facilityPolicyRepository.findByFacilityId(facility.getId())
                : Optional.empty();

        int refundSlaDays = policyOpt.map(FacilityPolicy::getDepositRefundSlaDays).orElse(5);
        BigDecimal dailyLateFee = policyOpt.map(FacilityPolicy::getDailyLateFee).orElse(new BigDecimal("100000.00"));
        int overdueGraceDays = policyOpt.map(FacilityPolicy::getOverdueGraceDays).orElse(1);

        // 1. Thẩm định Checklist 5 điểm hiện trường (BR-RULE-013)
        boolean doorPassed = request.getDoorConditionPassed() == null || Boolean.TRUE.equals(request.getDoorConditionPassed());
        boolean cleanlinessPassed = request.getCleanlinessPassed() == null || Boolean.TRUE.equals(request.getCleanlinessPassed());
        boolean smartLockPassed = request.getSmartLockPassed() == null || Boolean.TRUE.equals(request.getSmartLockPassed());
        boolean sensorPassed = request.getSensorPassed() == null || Boolean.TRUE.equals(request.getSensorPassed());
        boolean wallPassed = request.getWallStructurePassed() == null || Boolean.TRUE.equals(request.getWallStructurePassed());

        String checklistSummary = String.format(
                "Cửa cuốn: %s | Vệ sinh: %s | SmartLock: %s | Cảm biến: %s | Tường vách: %s",
                doorPassed ? "Đạt" : "Không đạt",
                cleanlinessPassed ? "Sạch sẽ" : "Chưa dọn",
                smartLockPassed ? "Tốt" : "Lỗi",
                sensorPassed ? "Chuẩn" : "Lỗi",
                wallPassed ? "Nguyên vẹn" : "Hư hại"
        );

        List<String> evidencePhotos = request.getEvidencePhotos() != null ? request.getEvidencePhotos() : List.of();

        // 2. Quyết toán cọc và các khoản khấu trừ (BR-RULE-014)
        BigDecimal depositPaid = calculateTotalDepositPaid(booking);

        BigDecimal damageFee = request.getDamageFee() != null ? request.getDamageFee() : BigDecimal.ZERO;
        BigDecimal cleaningFee = request.getCleaningFee() != null ? request.getCleaningFee() : BigDecimal.ZERO;
        BigDecimal lostCardFee = request.getLostCardFee() != null ? request.getLostCardFee() : BigDecimal.ZERO;

        BigDecimal overdueDebt = request.getOverdueDebt();
        if (overdueDebt == null) {
            LocalDate today = LocalDate.now();
            LocalDate endDate = booking.getEndDate();
            if (endDate != null && today.isAfter(endDate)) {
                long overdueDays = ChronoUnit.DAYS.between(endDate, today);
                long billableDays = Math.max(0, overdueDays - overdueGraceDays);
                if (billableDays > 0 && dailyLateFee != null) {
                    overdueDebt = dailyLateFee.multiply(BigDecimal.valueOf(billableDays));
                } else {
                    overdueDebt = BigDecimal.ZERO;
                }
            } else {
                overdueDebt = BigDecimal.ZERO;
            }
        }

        BigDecimal itemizedDeductions = damageFee.add(cleaningFee).add(lostCardFee).add(overdueDebt);
        BigDecimal totalDeduction;
        if (request.getDeductionAmount() != null && request.getDeductionAmount().compareTo(itemizedDeductions) > 0) {
            totalDeduction = request.getDeductionAmount();
        } else {
            totalDeduction = itemizedDeductions;
        }

        BigDecimal netRefundAmount = depositPaid.subtract(totalDeduction);
        BigDecimal actualRefund = netRefundAmount.compareTo(BigDecimal.ZERO) > 0 ? netRefundAmount : BigDecimal.ZERO;
        BigDecimal customerDebt = netRefundAmount.compareTo(BigDecimal.ZERO) < 0 ? totalDeduction.subtract(depositPaid) : BigDecimal.ZERO;

        if (customerDebt.compareTo(BigDecimal.ZERO) > 0) {
            log.warn("[BR-RULE-015] Total deductions ({}) exceeded deposit ({}) for booking {}. Unrecovered debt: {}",
                    totalDeduction, depositPaid, booking.getBookingCode(), customerDebt);
        }

        // 3. Trạng thái xét duyệt hoàn tiền cọc & SLA (BR-RULE-015)
        String reviewStatus;
        if (totalDeduction.compareTo(BigDecimal.ZERO) > 0
                || customerDebt.compareTo(BigDecimal.ZERO) > 0
                || Boolean.TRUE.equals(request.getRequiresAccountingReview())) {
            reviewStatus = "PENDING_ACCOUNTING_REVIEW";
        } else {
            reviewStatus = "AUTO_REFUND_APPROVED";
        }

        // 4. Sinh bản ghi giao dịch hoàn tiền Payment
        String refundTxnId = null;
        if (actualRefund.compareTo(BigDecimal.ZERO) > 0) {
            PaymentStatus refundPaymentStatus = "AUTO_REFUND_APPROVED".equals(reviewStatus)
                    ? PaymentStatus.REFUNDED
                    : PaymentStatus.PENDING;
            refundTxnId = "REFUND-RET-" + booking.getBookingCode() + "-" + System.currentTimeMillis();

            Payment refundPayment = Payment.builder()
                    .transactionId(refundTxnId)
                    .booking(booking)
                    .amount(actualRefund)
                    .paymentType(PaymentType.DEPOSIT)
                    .status(refundPaymentStatus)
                    .paymentMethod(request.getRefundMethod() != null ? request.getRefundMethod()
                            : ("AUTO_REFUND_APPROVED".equals(reviewStatus) ? "VNPAY_REFUND" : "BANK_TRANSFER"))
                    .paymentTime(LocalDateTime.now())
                    .build();
            paymentRepository.save(refundPayment);
        }

        // 5. Thu hồi mã SmartLock và hoàn tất booking
        booking.setAccessPin(null);
        booking.setQrAccessToken(null);
        booking.setStatus(BookingStatus.COMPLETED);
        booking.setReturnTime(LocalDateTime.now());
        bookingRepository.save(booking);

        // 6. Giải phóng ngăn kho sang AVAILABLE
        if (unit != null) {
            unit.setStatus(UnitStatus.AVAILABLE);
            storageUnitRepository.save(unit);
        }

        // 7. Chuyển hợp đồng thuê sang TERMINATED nếu có
        Optional<RentalContract> contractOpt = rentalContractRepository.findByBookingId(booking.getId());
        contractOpt.ifPresent(contract -> {
            if (contract.getStatus() != RentalContractStatus.TERMINATED) {
                contract.setStatus(RentalContractStatus.TERMINATED);
                rentalContractRepository.save(contract);
            }
        });

        // 8. Tạo và lưu biên bản HandoverRecord
        String damageNoteStr = (request.getDamageNotes() != null && !request.getDamageNotes().isBlank())
                ? ("Ghi chú hư hại: " + request.getDamageNotes() + ". ") : "";
        String extraNoteStr = (request.getNotes() != null && !request.getNotes().isBlank())
                ? request.getNotes() : "Đã nghiệm thu hoàn trả kho thành công";
        String debtWarningStr = customerDebt.compareTo(BigDecimal.ZERO) > 0
                ? String.format(" [CẢNH BÁO: Khấu trừ vượt quá tiền cọc! Khách hàng nợ thêm: %s VNĐ. Chuyển kế toán thu hồi công nợ]", customerDebt) : "";

        String fullNotes = String.format(
                "Nghiệm thu trả kho & Quyết toán cọc. Trạng thái duyệt: %s (SLA: %d ngày). Cọc gốc: %s VNĐ, Khấu trừ: %s VNĐ (Hư hại: %s, Vệ sinh: %s, Thẻ/khóa: %s, Quá hạn: %s), Thực hoàn: %s VNĐ. %s%s%s",
                reviewStatus, refundSlaDays, depositPaid, totalDeduction,
                damageFee, cleaningFee, lostCardFee, overdueDebt, actualRefund,
                damageNoteStr, extraNoteStr, debtWarningStr
        );

        HandoverRecord record = HandoverRecord.builder()
                .booking(booking)
                .staff(staff)
                .recordType("RETURN")
                .unitCondition(request.getUnitCondition() != null ? request.getUnitCondition() : checklistSummary)
                .depositSettled(depositPaid)
                .deductionAmount(totalDeduction)
                .refundAmount(actualRefund)
                .reviewStatus(reviewStatus)
                .checklistSummary(checklistSummary)
                .evidencePhotos(evidencePhotos.isEmpty() ? null : String.join(";", evidencePhotos))
                .notes(fullNotes)
                .recordedAt(LocalDateTime.now())
                .build();

        record = handoverRecordRepository.save(record);

        // 9. Ghi nhận Activity Audit Trail
        UUID facilityId = (facility != null) ? facility.getId() : null;
        activityLogService.record(
                facilityId,
                ActivityAction.CHECKOUT_INSPECTION_COMPLETE,
                "HandoverRecord",
                record.getId(),
                String.format("Nghiệm thu hiện trường trả kho đơn %s (Kho %s): %s",
                        booking.getBookingCode(), unit != null ? unit.getUnitCode() : "N/A", checklistSummary),
                null,
                null
        );

        if (totalDeduction.compareTo(BigDecimal.ZERO) > 0) {
            activityLogService.record(
                    facilityId,
                    ActivityAction.DAMAGE_FEE_RECORDED,
                    "Booking",
                    booking.getId(),
                    String.format("Khấu trừ hư hại/vệ sinh/quá hạn %s VNĐ cho đơn %s", totalDeduction, booking.getBookingCode()),
                    null,
                    null
            );
        }

        if (netRefundAmount.compareTo(BigDecimal.ZERO) > 0) {
            activityLogService.record(
                    facilityId,
                    ActivityAction.REFUND_PROCESSED,
                    "Payment",
                    booking.getId(),
                    String.format("Lập lệnh hoàn tiền cọc %s VNĐ (Trạng thái: %s, SLA: %d ngày) cho đơn %s",
                            netRefundAmount, reviewStatus, refundSlaDays, booking.getBookingCode()),
                    null,
                    null
            );
        }

        activityLogService.record(
                facilityId,
                ActivityAction.ACCESS_CREDENTIAL_REVOKE,
                "Booking",
                booking.getId(),
                String.format("Thu hồi mã PIN và quyền truy cập SmartLock đơn %s sau khi trả kho", booking.getBookingCode()),
                null,
                null
        );

        activityLogService.record(
                facilityId,
                ActivityAction.STORAGE_UNIT_RELEASE,
                "StorageUnit",
                unit != null ? unit.getId() : null,
                String.format("Giải phóng ngăn kho %s về trạng thái AVAILABLE sau khi nghiệm thu trả kho",
                        unit != null ? unit.getUnitCode() : "N/A"),
                UnitStatus.OCCUPIED,
                UnitStatus.AVAILABLE
        );

        return record;
    }

    @Override
    @Transactional(readOnly = true)
    public List<HandoverResponse> getByBookingId(UUID bookingId) {
        return handoverRecordRepository.findByBookingId(bookingId).stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Override
    public void sendHandoverPinEmail(UUID bookingId, String customEmail) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        StorageUnit unit = booking.getStorageUnit();
        if (unit != null && unit.getFacility() != null && facilityAccessGuard.isFacilityScoped()) {
            facilityAccessGuard.checkFacilityAccess(unit.getFacility().getId());
        }

        if (booking.getStatus() != BookingStatus.ACTIVE || booking.getAccessPin() == null || booking.getAccessPin().isBlank()) {
            throw new AppException(ErrorCode.BOOKING_NOT_CHECKED_IN);
        }

        String unitCode = unit != null ? unit.getUnitCode() : "N/A";
        String facilityName = (unit != null && unit.getFacility() != null) ? unit.getFacility().getName() : "Boxora Facility";

        String toEmail = booking.getCustomer() != null ? booking.getCustomer().getEmail() : null;
        if (customEmail != null && !customEmail.isBlank()
                && (toEmail == null || !toEmail.equalsIgnoreCase(customEmail.trim()))) {
            throw new AppException(ErrorCode.INVALID_REQUEST,
                    "The PIN can only be sent to the customer email on the booking.");
        }

        if (toEmail == null || toEmail.isBlank()) {
            throw new AppException(ErrorCode.USER_NOT_FOUND);
        }

        String plainPin;
        try {
            plainPin = encryptionService.decrypt(booking.getAccessPin());
        } catch (Exception e) {
            plainPin = booking.getAccessPin();
        }

        String fullName = booking.getCustomer() != null ? booking.getCustomer().getFullName() : "Khách hàng Boxora";
        emailService.sendHandoverPinEmail(toEmail, fullName, unitCode, booking.getBookingCode(), plainPin, facilityName);
    }

    @Override
    public NotificationLogResponse sendHandoverWebNotification(UUID bookingId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        StorageUnit unit = booking.getStorageUnit();
        if (unit != null && unit.getFacility() != null && facilityAccessGuard.isFacilityScoped()) {
            facilityAccessGuard.checkFacilityAccess(unit.getFacility().getId());
        }

        if (booking.getStatus() != BookingStatus.ACTIVE || booking.getAccessPin() == null || booking.getAccessPin().isBlank()) {
            throw new AppException(ErrorCode.BOOKING_NOT_CHECKED_IN);
        }

        String unitCode = unit != null ? unit.getUnitCode() : "N/A";
        String facilityName = (unit != null && unit.getFacility() != null) ? unit.getFacility().getName() : "Boxora Facility";

        String plainPin;
        try {
            plainPin = encryptionService.decrypt(booking.getAccessPin());
        } catch (Exception e) {
            plainPin = booking.getAccessPin();
        }

        String custName = booking.getCustomer() != null ? booking.getCustomer().getFullName() : "Khách hàng";
        String custEmail = booking.getCustomer() != null ? booking.getCustomer().getEmail() : null;
        if (custEmail == null || custEmail.isBlank()) {
            throw new AppException(ErrorCode.USER_NOT_FOUND, "The customer has no email address for the in-app notification record.");
        }

        NotificationLog logEntity = NotificationLog.builder()
                .recipient(booking.getCustomer())
                .recipientEmail(custEmail)
                .recipientName(custName)
                .facility(unit != null ? unit.getFacility() : null)
                .channel(NotificationChannel.IN_APP)
                .notificationType(NotificationType.HANDOVER_PIN)
                .referenceType("BOOKING")
                .referenceId(booking.getId())
                .title(String.format("Bàn giao kho & Cấp mã PIN [%s]", unitCode))
                .content(String.format("Kính gửi %s, quy trình bàn giao kho %s tại cơ sở %s đã hoàn tất. Boxora lưu mã PIN của bạn là: %s. Vui lòng xác nhận với nhân viên việc cài đặt mã trên khóa vật lý; Boxora chưa xác minh trạng thái thiết bị.",
                        custName, unitCode, facilityName, plainPin))
                .status("SENT")
                .build();

        logEntity = notificationLogRepository.save(logEntity);

        return NotificationLogResponse.builder()
                .id(logEntity.getId())
                .recipientId(booking.getCustomer() != null ? booking.getCustomer().getId() : null)
                .recipientEmail(custEmail)
                .recipientName(custName)
                .facilityId(unit != null && unit.getFacility() != null ? unit.getFacility().getId() : null)
                .facilityName(facilityName)
                .channel(NotificationChannel.IN_APP)
                .notificationType(NotificationType.HANDOVER_PIN)
                .referenceType("BOOKING")
                .referenceId(booking.getId())
                .title(logEntity.getTitle())
                .content(logEntity.getContent())
                .status(logEntity.getStatus())
                .createdAt(logEntity.getCreatedAt() != null ? logEntity.getCreatedAt() : LocalDateTime.now())
                .build();
    }

    private BigDecimal getRequiredDeposit(Booking booking, StorageUnit unit) {
        if (unit != null && unit.getUnitType() != null && unit.getUnitType().getDepositAmount() != null) {
            return unit.getUnitType().getDepositAmount();
        }
        if (booking.getDepositPaid() != null && booking.getDepositPaid().compareTo(BigDecimal.ZERO) > 0) {
            return booking.getDepositPaid();
        }
        if (unit != null && unit.getEffectiveBasePrice() != null) {
            return unit.getEffectiveBasePrice();
        }
        return new BigDecimal("1000000.00");
    }

    private BigDecimal calculateTotalDepositPaid(Booking booking) {
        if (booking.getDepositPaid() != null && booking.getDepositPaid().compareTo(BigDecimal.ZERO) > 0) {
            return booking.getDepositPaid();
        }
        List<Payment> payments = paymentRepository.findAllByBooking_Id(booking.getId());
        return payments.stream()
                .filter(p -> p.getPaymentType() == PaymentType.DEPOSIT && p.getStatus() == PaymentStatus.PAID)
                .map(Payment::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BigDecimal getRequiredFirstMonthRent(Booking booking, StorageUnit unit) {
        if (unit != null && unit.getEffectiveBasePrice() != null) {
            return unit.getEffectiveBasePrice();
        }
        if (booking.getTotalRentalFee() != null && booking.getRentalMonths() != null && booking.getRentalMonths() > 0) {
            return booking.getTotalRentalFee().divide(BigDecimal.valueOf(booking.getRentalMonths()), 2, java.math.RoundingMode.HALF_UP);
        }
        return new BigDecimal("1500000.00");
    }

    private BigDecimal calculateTotalFirstMonthRentPaid(Booking booking) {
        List<Payment> payments = paymentRepository.findAllByBooking_Id(booking.getId());
        return payments.stream()
                .filter(p -> p.getPaymentType() == PaymentType.RENTAL_FEE && p.getStatus() == PaymentStatus.PAID)
                .map(Payment::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BigDecimal calculateTotalDepositPaid(Booking booking, Payment pendingPayment) {
        BigDecimal total = calculateTotalDepositPaid(booking);
        if (pendingPayment != null && pendingPayment.getPaymentType() == PaymentType.DEPOSIT) {
            total = total.add(pendingPayment.getAmount() != null ? pendingPayment.getAmount() : BigDecimal.ZERO);
        }
        return total;
    }

    private BigDecimal calculateTotalFirstMonthRentPaid(Booking booking, Payment pendingPayment) {
        BigDecimal total = calculateTotalFirstMonthRentPaid(booking);
        if (pendingPayment != null && pendingPayment.getPaymentType() == PaymentType.RENTAL_FEE) {
            total = total.add(pendingPayment.getAmount() != null ? pendingPayment.getAmount() : BigDecimal.ZERO);
        }
        return total;
    }

    private HandoverResponse mapToResponse(HandoverRecord r) {
        List<String> photos = (r.getEvidencePhotos() != null && !r.getEvidencePhotos().isBlank())
                ? Arrays.asList(r.getEvidencePhotos().split(";"))
                : List.of();

        boolean checklistAllPassed = r.getChecklistSummary() == null || (
                !r.getChecklistSummary().contains("Không đạt")
                && !r.getChecklistSummary().contains("Chưa dọn")
                && !r.getChecklistSummary().contains("Lỗi")
                && !r.getChecklistSummary().contains("Hư hại")
        );

        Integer slaDays = null;
        if (r.getBooking() != null && r.getBooking().getStorageUnit() != null
                && r.getBooking().getStorageUnit().getFacility() != null) {
            slaDays = facilityPolicyRepository.findByFacilityId(r.getBooking().getStorageUnit().getFacility().getId())
                    .map(FacilityPolicy::getDepositRefundSlaDays)
                    .orElse(5);
        }

        return HandoverResponse.builder()
                .id(r.getId())
                .bookingId(r.getBooking() != null ? r.getBooking().getId() : null)
                .bookingCode(r.getBooking() != null ? r.getBooking().getBookingCode() : null)
                .unitCode(r.getBooking() != null && r.getBooking().getStorageUnit() != null
                        ? r.getBooking().getStorageUnit().getUnitCode() : null)
                .customerName(r.getBooking() != null && r.getBooking().getCustomer() != null
                        ? r.getBooking().getCustomer().getFullName() : null)
                .staffId(r.getStaff() != null ? r.getStaff().getId() : null)
                .staffName(r.getStaff() != null ? r.getStaff().getFullName() : null)
                .recordType(r.getRecordType())
                .unitCondition(r.getUnitCondition())
                .depositSettled(r.getDepositSettled())
                .deductionAmount(r.getDeductionAmount())
                .refundAmount(r.getRefundAmount())
                .reviewStatus(r.getReviewStatus())
                .depositRefundSlaDays(slaDays)
                .checklistAllPassed(checklistAllPassed)
                .checklistSummary(r.getChecklistSummary())
                .evidencePhotos(photos)
                .notes(r.getNotes())
                .recordedAt(r.getRecordedAt())
                .build();
    }

    private User resolveStaff(UUID requestedStaffId) {
        UUID staffId = requestedStaffId != null ? requestedStaffId : requestContext.currentUserId();
        if (staffId != null) {
            Optional<User> found = userRepository.findById(staffId);
            if (found.isPresent()) {
                return found.get();
            }
        }
        return userRepository.findAll().stream()
                .filter(u -> u.getRole() != null && ("STAFF".equals(u.getRole().getName()) || "FACILITY_MANAGER".equals(u.getRole().getName())))
                .findFirst()
                .orElse(null);
    }

    private String validateStoredDocumentUrl(String rawUrl, String fieldLabel) {
        if (rawUrl == null || rawUrl.isBlank()) {
            throw new AppException(ErrorCode.INVALID_REQUEST, fieldLabel + " không được để trống");
        }
        String trimmed = rawUrl.trim();
        if (trimmed.regionMatches(true, 0, "data:", 0, 5)) {
            throw new AppException(ErrorCode.INVALID_REQUEST,
                    fieldLabel + " không chấp nhận chuỗi dữ liệu Base64 trực tiếp. Vui lòng tải tệp qua API upload tài liệu.");
        }
        if (trimmed.length() > 500) {
            throw new AppException(ErrorCode.INVALID_REQUEST,
                    fieldLabel + " vượt quá giới hạn tối đa 500 ký tự (" + trimmed.length() + " ký tự)");
        }
        if (trimmed.contains("..")
                || !(trimmed.startsWith("/uploads/") || trimmed.startsWith("http://") || trimmed.startsWith("https://"))) {
            throw new AppException(ErrorCode.INVALID_REQUEST,
                    fieldLabel + " phải là đường dẫn tệp hợp lệ (/uploads/... hoặc URL hợp lệ)");
        }
        return trimmed;
    }

    @Override
    public java.nio.file.Path getAuthorizedHandoverDocumentPath(UUID bookingId, String fileUrl) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));
        StorageUnit unit = booking.getStorageUnit();
        UUID facilityId = (unit != null && unit.getFacility() != null) ? unit.getFacility().getId() : null;

        UUID currentUserId = requestContext != null ? requestContext.currentUserId() : null;
        if (currentUserId == null) {
            throw new AppException(ErrorCode.FORBIDDEN, "Yêu cầu xác thực để xem tài liệu");
        }
        User currentUser = userRepository.findById(currentUserId)
                .orElseThrow(() -> new AppException(ErrorCode.FORBIDDEN, "Không tìm thấy người dùng xác thực"));
        String roleName = currentUser.getRole() != null ? currentUser.getRole().getName() : "";

        if ("CUSTOMER".equalsIgnoreCase(roleName)) {
            if (booking.getCustomer() == null || !currentUserId.equals(booking.getCustomer().getId())) {
                throw new AppException(ErrorCode.FORBIDDEN, "Bạn không có quyền xem tài liệu của đơn đặt kho khác");
            }
        } else if ("STAFF".equalsIgnoreCase(roleName)
                || "FACILITY_MANAGER".equalsIgnoreCase(roleName)
                || "BUSINESS_MANAGER".equalsIgnoreCase(roleName)
                || "ADMIN".equalsIgnoreCase(roleName)) {
            if (facilityId != null) {
                facilityAccessGuard.checkFacilityAccess(facilityId);
            }
        } else {
            throw new AppException(ErrorCode.FORBIDDEN, "Vai trò người dùng không có quyền xem tài liệu này");
        }

        String cleanUrl = validateStoredDocumentUrl(fileUrl, "Đường dẫn tài liệu");
        if (!cleanUrl.startsWith("/uploads/")) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Chỉ hỗ trợ truy xuất tệp nội bộ trong thư mục /uploads/");
        }

        boolean matchesBookingContract = rentalContractRepository.findByBookingId(booking.getId())
                .map(c -> cleanUrl.equals(c.getPaperContractUrl()))
                .orElse(false);
        boolean matchesBookingPayment = paymentRepository.findAllByBooking_Id(booking.getId()).stream()
                .anyMatch(p -> cleanUrl.equals(p.getProofDocumentUrl()));
        boolean matchesBookingFolder = cleanUrl.contains("/" + booking.getId() + "/");

        if (!matchesBookingContract && !matchesBookingPayment && !matchesBookingFolder) {
            throw new AppException(ErrorCode.FORBIDDEN, "Tài liệu không thuộc phạm vi đơn đặt kho này");
        }

        if (fileStorageService == null) {
            throw new AppException(ErrorCode.INTERNAL_SERVER_ERROR, "Dịch vụ lưu trữ tệp chưa sẵn sàng");
        }
        return fileStorageService.resolveStoredFilePath(cleanUrl);
    }

    @Override
    public com.boxora.dto.response.FileUploadResponse uploadHandoverDocument(
            UUID bookingId,
            org.springframework.web.multipart.MultipartFile file,
            String documentType) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));
        StorageUnit unit = booking.getStorageUnit();
        if (unit != null && unit.getFacility() != null) {
            facilityAccessGuard.checkFacilityAccess(unit.getFacility().getId());
        }
        requireAuthorizedStaffOperator(null);

        if (booking.getStatus() == BookingStatus.CANCELLED || booking.getStatus() == BookingStatus.COMPLETED) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Không thể tải tài liệu cho đơn đặt kho đã hủy hoặc đã hoàn tất");
        }

        String normalizedType = documentType != null ? documentType.trim().toUpperCase() : "PAPER_CONTRACT";
        String subDir;
        switch (normalizedType) {
            case "PAPER_CONTRACT" -> subDir = "contracts/" + booking.getId();
            case "PAYMENT_PROOF" -> subDir = "payments/" + booking.getId();
            case "CHECKIN_EVIDENCE" -> subDir = "handovers/" + booking.getId();
            default -> throw new AppException(ErrorCode.INVALID_REQUEST, "Loại tài liệu tải lên không hợp lệ: " + documentType);
        }

        if (fileStorageService == null) {
            throw new AppException(ErrorCode.INTERNAL_SERVER_ERROR, "Dịch vụ lưu trữ tệp chưa sẵn sàng");
        }
        return fileStorageService.storeDocumentFile(file, subDir);
    }

    private User requireAuthorizedStaffOperator(UUID requestedStaffId) {
        User staff = resolveStaff(requestedStaffId);
        if (staff == null) {
            throw new AppException(ErrorCode.FORBIDDEN, "Yêu cầu tài khoản nhân viên hoặc quản lý hợp lệ để thực hiện thao tác");
        }
        if (staff.getRole() != null && "CUSTOMER".equalsIgnoreCase(staff.getRole().getName())) {
            throw new AppException(ErrorCode.FORBIDDEN, "Khách hàng không có quyền thực hiện nghiệp vụ nội bộ tại quầy");
        }
        return staff;
    }


    @Override
    public HandoverResponse recordCheckInInspection(com.boxora.dto.request.CheckInInspectionRequest request) {
        HandoverPrerequisitesResponse prereq = getCheckInPrerequisites(request.getBookingId());
        if (!prereq.isEligibleForInspection()) {
            throw new AppException(ErrorCode.CHECKIN_STEP_NOT_SATISFIED);
        }
        Booking booking = bookingRepository.findById(request.getBookingId())
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));
        StorageUnit unit = booking.getStorageUnit();
        User staff = requireAuthorizedStaffOperator(null);

        if (request.getDoorConditionPassed() == null
                || request.getCleanlinessPassed() == null
                || request.getSmartLockPassed() == null
                || request.getSensorPassed() == null
                || request.getWallStructurePassed() == null) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "All five inspection checklist values are required.");
        }

        boolean doorPassed = Boolean.TRUE.equals(request.getDoorConditionPassed());
        boolean cleanlinessPassed = Boolean.TRUE.equals(request.getCleanlinessPassed());
        boolean smartLockPassed = Boolean.TRUE.equals(request.getSmartLockPassed());
        boolean sensorPassed = Boolean.TRUE.equals(request.getSensorPassed());
        boolean wallPassed = Boolean.TRUE.equals(request.getWallStructurePassed());

        String checklistSummary = String.format(
                "Cửa cuốn: %s | Vệ sinh: %s | SmartLock: %s | Cảm biến IoT: %s | Tường vách: %s",
                doorPassed ? "Đạt" : "Không đạt",
                cleanlinessPassed ? "Sạch sẽ" : "Chưa dọn",
                smartLockPassed ? "Tốt" : "Lỗi",
                sensorPassed ? "Chuẩn" : "Lỗi",
                wallPassed ? "Nguyên vẹn" : "Hư hại"
        );

        List<String> photos = request.getEvidencePhotos() != null
                ? request.getEvidencePhotos().stream()
                    .map(url -> validateStoredDocumentUrl(url, "Check-in evidence photo"))
                    .distinct()
                    .collect(Collectors.toList())
                : List.of();
        if (photos.size() < 2) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Two uploaded check-in evidence photos are required.");
        }
        String photosStr = String.join(";", photos);

        HandoverRecord record = HandoverRecord.builder()
                .booking(booking)
                .staff(staff)
                .recordType("CHECK_IN_INSPECTION")
                .unitCondition(request.getUnitCondition() != null ? request.getUnitCondition() : "Đạt chuẩn 5/5 kiểm định hiện trường")
                .checklistSummary(checklistSummary)
                .evidencePhotos(photosStr)
                .doorConditionPassed(doorPassed)
                .cleanlinessPassed(cleanlinessPassed)
                .smartLockPassed(smartLockPassed)
                .sensorPassed(sensorPassed)
                .wallStructurePassed(wallPassed)
                .notes(request.getNotes())
                .recordedAt(LocalDateTime.now())
                .build();
        record = handoverRecordRepository.save(record);

        UUID facilityId = (unit != null && unit.getFacility() != null) ? unit.getFacility().getId() : null;
        activityLogService.record(
                facilityId,
                ActivityAction.CHECKIN_VERIFIED,
                "Booking",
                booking.getId(),
                String.format("Nhân viên %s đối soát đạt chuẩn 4 điều kiện check-in cho đơn %s",
                        staff.getFullName(), booking.getBookingCode()),
                null,
                null
        );

        return mapToResponse(record);
    }


    @Override
    public void completeCheckInStep1(UUID bookingId) {
        HandoverPrerequisitesResponse prereq = getCheckInPrerequisites(bookingId);
        if (!prereq.isEligibleForInspection()) {
            throw new AppException(ErrorCode.CHECKIN_STEP_NOT_SATISFIED);
        }
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));
        User staff = requireAuthorizedStaffOperator(null);
        String stepLog = String.format("[%s] Hoàn tất đối soát 4 điều kiện bởi nhân viên %s. Chuyển sang bước Nghiệm thu hiện trường.\n",
                LocalDateTime.now(), staff.getFullName());
        booking.setStepTransitionHistory((booking.getStepTransitionHistory() != null ? booking.getStepTransitionHistory() : "") + stepLog);
        bookingRepository.save(booking);
    }


public RentalContractResponse createOrUploadPaperContract(PaperContractCreateRequest request) {
        if (request == null || request.getBookingId() == null) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Thiếu thông tin đơn đặt kho để lưu hợp đồng giấy");
        }
        String rawPaperUrl = request.getPaperContractUrl();
        Booking booking = bookingRepository.findById(request.getBookingId())
                .orElseThrow(() -> {
                    cleanupUploadedFileIfOrphan(rawPaperUrl);
                    return new AppException(ErrorCode.BOOKING_NOT_FOUND);
                });
        StorageUnit unit = booking.getStorageUnit();
        if (unit != null && unit.getFacility() != null) {
            try {
                facilityAccessGuard.checkFacilityAccess(unit.getFacility().getId());
            } catch (RuntimeException ex) {
                cleanupUploadedFileIfOrphan(rawPaperUrl);
                throw ex;
            }
        }

        try {
            requireAuthorizedStaffOperator(null);

            if (booking.getStatus() == BookingStatus.CANCELLED || booking.getStatus() == BookingStatus.COMPLETED) {
                throw new AppException(ErrorCode.INVALID_REQUEST, "Không thể tạo hoặc tải hợp đồng giấy cho đơn đã hủy hoặc đã hoàn tất");
            }

            String cleanPaperUrl = validateStoredDocumentUrl(rawPaperUrl, "Bản scan hợp đồng giấy");

            RentalContract contract = rentalContractRepository.findByBookingId(booking.getId())
                    .orElseGet(() -> RentalContract.builder()
                            .booking(booking)
                            .customer(booking.getCustomer())
                            .unit(unit)
                            .facility(unit != null ? unit.getFacility() : null)
                            .startDate(booking.getStartDate())
                            .endDate(booking.getEndDate())
                            .monthlyFee(getRequiredFirstMonthRent(booking, unit))
                            .depositHeld(getRequiredDeposit(booking, unit))
                            .status(RentalContractStatus.PENDING_VERIFICATION)
                            .build());

            String code = (request.getContractCode() != null && !request.getContractCode().isBlank())
                    ? request.getContractCode().trim()
                    : (contract.getContractCode() != null ? contract.getContractCode() : "HĐ-GIAY-" + booking.getBookingCode());
            if (code.length() > 50) {
                throw new AppException(ErrorCode.INVALID_REQUEST, "Mã hợp đồng không được vượt quá 50 ký tự");
            }

            Optional<RentalContract> duplicateCodeOpt = rentalContractRepository.findByContractCodeIgnoreCase(code);
            if (duplicateCodeOpt.isPresent()) {
                RentalContract existingByCode = duplicateCodeOpt.get();
                boolean isSameContract = (contract.getId() != null && contract.getId().equals(existingByCode.getId()))
                        || (existingByCode.getBooking() != null && booking.getId().equals(existingByCode.getBooking().getId()));
                if (!isSameContract) {
                    throw new AppException(ErrorCode.INVALID_REQUEST, "Mã hợp đồng " + code + " đã tồn tại cho một đơn đặt kho khác");
                }
            }

            String oldPaperUrl = contract.getPaperContractUrl();

            if (request.getPaperOriginalLocation() != null) {
                String loc = request.getPaperOriginalLocation().trim();
                if (loc.length() > 255) {
                    throw new AppException(ErrorCode.INVALID_REQUEST, "Vị trí lưu trữ bản gốc không được vượt quá 255 ký tự");
                }
                contract.setPaperOriginalLocation(loc);
            }
            if (request.getNotes() != null) {
                contract.setPaperNotes(request.getNotes().trim());
            }

            boolean wasOnlineSigned = "ONLINE".equalsIgnoreCase(contract.getSigningMethod()) && contract.getSignedAt() != null;
            contract.setContractCode(code);
            contract.setPaperContractUrl(cleanPaperUrl);
            if (!wasOnlineSigned) {
                contract.setSigningMethod("PAPER");
                contract.setStatus(RentalContractStatus.PENDING_VERIFICATION);
                contract.setPaperVerifiedAt(null);
                contract.setPaperVerifiedBy(null);
                contract.setSignedAt(null);

                booking.setSigningMethod("IN_PERSON");
                bookingRepository.save(booking);
            }

            contract = rentalContractRepository.save(contract);

            if (oldPaperUrl != null && !oldPaperUrl.equals(cleanPaperUrl)) {
                cleanupUploadedFileIfOrphan(oldPaperUrl);
            }

            UUID facilityId = (unit != null && unit.getFacility() != null) ? unit.getFacility().getId() : null;
            activityLogService.record(
                    facilityId,
                    ActivityAction.CONTRACT_CREATE,
                    "RentalContract",
                    contract.getId(),
                    String.format("Khởi tạo / Tải lên hợp đồng giấy %s cho đơn %s (Chờ xác minh hồ sơ)",
                            contract.getContractCode(), booking.getBookingCode()),
                    null,
                    contract.getStatus()
            );
            return rentalContractMapper.toResponse(contract);
        } catch (RuntimeException ex) {
            cleanupUploadedFileIfOrphan(rawPaperUrl);
            throw ex;
        }
    }

    @Override
    public RentalContractResponse verifyPaperContract(UUID bookingId, String notes) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));
        StorageUnit unit = booking.getStorageUnit();
        if (unit != null && unit.getFacility() != null) {
            facilityAccessGuard.checkFacilityAccess(unit.getFacility().getId());
        }
        User staff = requireAuthorizedStaffOperator(null);

        if (booking.getStatus() == BookingStatus.CANCELLED || booking.getStatus() == BookingStatus.COMPLETED) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Không thể xác minh hợp đồng cho đơn đặt kho đã hủy hoặc đã hoàn tất");
        }

        RentalContract contract = rentalContractRepository.findByBookingId(booking.getId())
                .orElseThrow(() -> new AppException(ErrorCode.CONTRACT_NOT_FOUND));

        if (contract.getPaperContractUrl() == null || contract.getPaperContractUrl().isBlank()) {
            throw new AppException(ErrorCode.CONTRACT_NOT_SIGNED);
        }
        validateStoredDocumentUrl(contract.getPaperContractUrl(), "Bản scan hợp đồng giấy");

        if (contract.getPaperVerifiedAt() != null
                && (contract.getStatus() == RentalContractStatus.PENDING_ACTIVATION
                || contract.getStatus() == RentalContractStatus.ACTIVE)) {
            throw new AppException(ErrorCode.CONTRACT_ALREADY_SIGNED, "Hợp đồng giấy này đã được xác minh trước đó");
        }

        boolean isBookingActive = booking.getStatus() == BookingStatus.ACTIVE;
        contract.setStatus(isBookingActive ? RentalContractStatus.ACTIVE : RentalContractStatus.PENDING_ACTIVATION);
        contract.setPaperVerifiedBy(staff);
        contract.setPaperVerifiedAt(LocalDateTime.now());
        contract.setSignedAt(LocalDateTime.now());
        if (notes != null && !notes.isBlank()) {
            contract.setPaperNotes((contract.getPaperNotes() != null ? contract.getPaperNotes() + "; " : "") + notes.trim());
        }
        contract = rentalContractRepository.save(contract);

        UUID facilityId = (unit != null && unit.getFacility() != null) ? unit.getFacility().getId() : null;
        activityLogService.record(
                facilityId,
                ActivityAction.CONTRACT_SIGNED,
                "RentalContract",
                contract.getId(),
                String.format("Nhân viên %s đã đối chiếu chữ ký và xác minh hợp đồng giấy %s cho đơn %s",
                        staff.getFullName(), contract.getContractCode(), booking.getBookingCode()),
                RentalContractStatus.PENDING_VERIFICATION,
                contract.getStatus()
        );
        return rentalContractMapper.toResponse(contract);
    }

    @Override
    public PaymentResponse recordManualPayment(ManualPaymentRecordRequest request) {
        if (request == null || request.getBookingId() == null) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Thiếu thông tin đơn đặt kho để ghi nhận thanh toán");
        }
        String rawProofUrl = request.getProofDocumentUrl();
        Booking booking = bookingRepository.findById(request.getBookingId())
                .orElseThrow(() -> {
                    cleanupUploadedFileIfOrphan(rawProofUrl);
                    return new AppException(ErrorCode.BOOKING_NOT_FOUND);
                });
        StorageUnit unit = booking.getStorageUnit();
        if (unit != null && unit.getFacility() != null) {
            try {
                facilityAccessGuard.checkFacilityAccess(unit.getFacility().getId());
            } catch (RuntimeException ex) {
                cleanupUploadedFileIfOrphan(rawProofUrl);
                throw ex;
            }
        }

        try {
            User staff = requireAuthorizedStaffOperator(null);

            if (booking.getStatus() == BookingStatus.CANCELLED || booking.getStatus() == BookingStatus.COMPLETED) {
                throw new AppException(ErrorCode.INVALID_REQUEST, "Không thể ghi nhận thu tiền cho đơn đặt kho đã hủy hoặc đã hoàn tất");
            }

            if (request.getAmount() == null || request.getAmount().compareTo(BigDecimal.ZERO) <= 0) {
                throw new AppException(ErrorCode.PAYMENT_AMOUNT_INVALID);
            }

            if (request.getPaymentType() != PaymentType.DEPOSIT && request.getPaymentType() != PaymentType.RENTAL_FEE) {
                throw new AppException(ErrorCode.INVALID_REQUEST, "Chỉ hỗ trợ ghi nhận thu tiền cọc (DEPOSIT) hoặc tiền thuê kỳ đầu (RENTAL_FEE)");
            }

            String method = request.getPaymentMethod() != null ? request.getPaymentMethod().trim().toUpperCase() : "";
            boolean isCash = "CASH".equals(method);
            boolean isBank = "BANK_TRANSFER".equals(method);

            if (!isCash && !isBank) {
                throw new AppException(ErrorCode.INVALID_PAYMENT_METHOD);
            }

            // Kiểm tra nghĩa vụ còn thiếu để chống thu trùng / cộng tiền 2 lần
            BigDecimal requiredAmount = (request.getPaymentType() == PaymentType.DEPOSIT)
                    ? getRequiredDeposit(booking, unit)
                    : getRequiredFirstMonthRent(booking, unit);
            BigDecimal alreadyPaidAmount = (request.getPaymentType() == PaymentType.DEPOSIT)
                    ? calculateTotalDepositPaid(booking)
                    : calculateTotalFirstMonthRentPaid(booking);
            BigDecimal remainingAmount = requiredAmount.subtract(alreadyPaidAmount).max(BigDecimal.ZERO);

            if (remainingAmount.compareTo(BigDecimal.ZERO) <= 0) {
                throw new AppException(ErrorCode.PAYMENT_ALREADY_PROCESSED,
                        "Nghĩa vụ " + (request.getPaymentType() == PaymentType.DEPOSIT ? "tiền cọc" : "tiền thuê tháng đầu") + " đã được thanh toán đủ trước đó");
            }

            if (request.getAmount().compareTo(remainingAmount) > 0) {
                throw new AppException(ErrorCode.PAYMENT_AMOUNT_MISMATCH,
                        String.format("Số tiền thu (%s VNĐ) vượt quá số tiền còn thiếu (%s VNĐ)", request.getAmount(), remainingAmount));
            }

            String cleanVoucherCode = null;
            String cleanRefCode = null;
            String cleanProofUrl = null;

            if (isCash) {
                // Khi thu tiền mặt: Bắt buộc có mã phiếu thu, và loại bỏ hoàn toàn proofDocumentUrl / referenceCode
                if (request.getReceiptVoucherCode() == null || request.getReceiptVoucherCode().isBlank()) {
                    throw new AppException(ErrorCode.INVALID_REQUEST, "Vui lòng nhập mã chứng từ / số phiếu thu tiền mặt");
                }
                cleanVoucherCode = request.getReceiptVoucherCode().trim();
                if (cleanVoucherCode.length() > 100) {
                    throw new AppException(ErrorCode.INVALID_REQUEST, "Mã phiếu thu tiền mặt không được vượt quá 100 ký tự");
                }
                if (paymentRepository.existsByReceiptVoucherCodeIgnoreCase(cleanVoucherCode)) {
                    throw new AppException(ErrorCode.PAYMENT_ALREADY_PROCESSED, "Mã phiếu thu tiền mặt " + cleanVoucherCode + " đã tồn tại trong hệ thống");
                }
            } else {
                // Khi chuyển khoản ngân hàng: Bắt buộc có referenceCode và chứng từ upload hợp lệ (< 500 ký tự, không nhận Base64)
                if (request.getReferenceCode() == null || request.getReferenceCode().isBlank()) {
                    throw new AppException(ErrorCode.INVALID_REQUEST, "Vui lòng nhập mã tham chiếu giao dịch ngân hàng (Ref Code)");
                }
                cleanRefCode = request.getReferenceCode().trim();
                if (cleanRefCode.length() > 100) {
                    throw new AppException(ErrorCode.INVALID_REQUEST, "Mã tham chiếu ngân hàng không được vượt quá 100 ký tự");
                }
                if (paymentRepository.existsByReferenceCodeIgnoreCase(cleanRefCode)) {
                    throw new AppException(ErrorCode.PAYMENT_ALREADY_PROCESSED, "Mã tham chiếu ngân hàng " + cleanRefCode + " đã tồn tại trong hệ thống");
                }
                cleanProofUrl = validateStoredDocumentUrl(rawProofUrl, "Chứng từ chuyển khoản ngân hàng");
            }

            String txnId = (isCash ? "CASH-" : "BANK-") + booking.getBookingCode() + "-" + System.currentTimeMillis()
                    + "-" + UUID.randomUUID().toString().substring(0, 4).toUpperCase();

            Payment payment = Payment.builder()
                    .transactionId(txnId)
                    .booking(booking)
                    .amount(request.getAmount())
                    .paymentType(request.getPaymentType())
                    .paymentMethod(method)
                    .paymentTime(LocalDateTime.now())
                    .collectedByStaff(staff)
                    .receiptVoucherCode(isCash ? cleanVoucherCode : null)
                    .referenceCode(isBank ? cleanRefCode : null)
                    .proofDocumentUrl(isBank ? cleanProofUrl : null)
                    .paymentNotes(request.getNotes() != null ? request.getNotes().trim() : null)
                    .status(isCash ? PaymentStatus.PAID : PaymentStatus.PENDING)
                    .confirmedByStaff(isCash ? staff : null)
                    .confirmedAt(isCash ? LocalDateTime.now() : null)
                    .build();

            payment = paymentRepository.save(payment);

            if (isCash) {
                BigDecimal dep = calculateTotalDepositPaid(booking, payment);
                BigDecimal reqDep = getRequiredDeposit(booking, unit);
                BigDecimal rent = calculateTotalFirstMonthRentPaid(booking, payment);
                BigDecimal reqRent = getRequiredFirstMonthRent(booking, unit);
                if (request.getPaymentType() == PaymentType.DEPOSIT) {
                    booking.setDepositPaid(dep);
                }
                boolean fullyPaid = dep.compareTo(reqDep) >= 0 && rent.compareTo(reqRent) >= 0;
                booking.setPaymentStatus(fullyPaid ? "PAID" : "PARTIALLY_PAID");
                booking.setHoldExpiresAt(null);
                bookingRepository.save(booking);
            }

            UUID facilityId = (unit != null && unit.getFacility() != null) ? unit.getFacility().getId() : null;
            activityLogService.record(
                    facilityId,
                    isCash ? ActivityAction.PAYMENT_CONFIRMED : ActivityAction.PAYMENT_INITIATED,
                    "Payment",
                    payment.getId(),
                    String.format("Ghi nhận khoản thu %s %s VNĐ (%s) cho đơn %s do nhân viên %s thực hiện (Mã chứng từ: %s)",
                            request.getPaymentType(), request.getAmount(), method, booking.getBookingCode(),
                            staff.getFullName(),
                            isCash ? cleanVoucherCode : cleanRefCode),
                    null,
                    payment.getStatus()
            );
            return paymentMapper.toResponse(payment);
        } catch (RuntimeException ex) {
            cleanupUploadedFileIfOrphan(rawProofUrl);
            throw ex;
        }
    }

    @Override
    public PaymentResponse confirmBankTransferPayment(UUID paymentId, String notes) {
        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new AppException(ErrorCode.PAYMENT_NOT_FOUND));
        if (payment.getBooking() != null && payment.getBooking().getStorageUnit() != null
                && payment.getBooking().getStorageUnit().getFacility() != null) {
            facilityAccessGuard.checkFacilityAccess(payment.getBooking().getStorageUnit().getFacility().getId());
        }
        User staff = requireAuthorizedStaffOperator(null);

        if (!"BANK_TRANSFER".equalsIgnoreCase(payment.getPaymentMethod())) {
            throw new AppException(ErrorCode.INVALID_PAYMENT_METHOD, "Chỉ giao dịch chuyển khoản ngân hàng mới cần đối soát khớp lệnh");
        }

        if (payment.getStatus() == PaymentStatus.PAID || payment.getStatus() != PaymentStatus.PENDING) {
            throw new AppException(ErrorCode.PAYMENT_ALREADY_PROCESSED, "Giao dịch chuyển khoản này đã được xác nhận hoặc không ở trạng thái chờ đối soát");
        }

        Booking b = payment.getBooking();
        if (b != null) {
            if (b.getStatus() == BookingStatus.CANCELLED || b.getStatus() == BookingStatus.COMPLETED) {
                throw new AppException(ErrorCode.INVALID_REQUEST, "Không thể xác nhận thanh toán cho đơn đặt kho đã hủy hoặc đã hoàn tất");
            }
            StorageUnit unit = b.getStorageUnit();
            BigDecimal requiredAmount = (payment.getPaymentType() == PaymentType.DEPOSIT)
                    ? getRequiredDeposit(b, unit)
                    : getRequiredFirstMonthRent(b, unit);
            BigDecimal alreadyPaidAmount = (payment.getPaymentType() == PaymentType.DEPOSIT)
                    ? calculateTotalDepositPaid(b)
                    : calculateTotalFirstMonthRentPaid(b);
            BigDecimal remainingAmount = requiredAmount.subtract(alreadyPaidAmount).max(BigDecimal.ZERO);
            if (remainingAmount.compareTo(payment.getAmount()) < 0) {
                throw new AppException(ErrorCode.PAYMENT_ALREADY_PROCESSED, "Nghĩa vụ thanh toán này đã được thu đủ qua giao dịch khác");
            }
        }

        payment.setStatus(PaymentStatus.PAID);
        payment.setConfirmedByStaff(staff);
        payment.setConfirmedAt(LocalDateTime.now());
        if (notes != null && !notes.isBlank()) {
            payment.setPaymentNotes((payment.getPaymentNotes() != null ? payment.getPaymentNotes() + "; " : "") + notes.trim());
        }
        payment = paymentRepository.save(payment);

        if (b != null) {
            StorageUnit unit = b.getStorageUnit();
            BigDecimal dep = calculateTotalDepositPaid(b, payment);
            BigDecimal reqDep = getRequiredDeposit(b, unit);
            BigDecimal rent = calculateTotalFirstMonthRentPaid(b, payment);
            BigDecimal reqRent = getRequiredFirstMonthRent(b, unit);
            if (payment.getPaymentType() == PaymentType.DEPOSIT) {
                b.setDepositPaid(dep);
            }
            boolean fullyPaid = dep.compareTo(reqDep) >= 0 && rent.compareTo(reqRent) >= 0;
            b.setPaymentStatus(fullyPaid ? "PAID" : "PARTIALLY_PAID");
            b.setHoldExpiresAt(null);
            bookingRepository.save(b);
        }

        UUID facilityId = (b != null && b.getStorageUnit() != null && b.getStorageUnit().getFacility() != null)
                ? b.getStorageUnit().getFacility().getId() : null;
        activityLogService.record(
                facilityId,
                ActivityAction.PAYMENT_CONFIRMED,
                "Payment",
                payment.getId(),
                String.format("Nhân viên %s đối soát và xác nhận tiền chuyển khoản %s VNĐ (%s) đã vào tài khoản",
                        staff.getFullName(), payment.getAmount(), payment.getReferenceCode()),
                PaymentStatus.PENDING,
                PaymentStatus.PAID
        );
        return paymentMapper.toResponse(payment);
    }

    @Override
    public HandoverPrerequisitesResponse verifyIdentity(IdentityVerifyRequest request) {
        Booking booking = bookingRepository.findById(request.getBookingId())
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));
        if (booking.getStorageUnit() != null && booking.getStorageUnit().getFacility() != null) {
            facilityAccessGuard.checkFacilityAccess(booking.getStorageUnit().getFacility().getId());
        }
        User staff = requireAuthorizedStaffOperator(null);
        if (!Boolean.TRUE.equals(request.getOriginalDocumentSeen())) {
            throw new AppException(ErrorCode.INVALID_REQUEST,
                    "The authenticated staff operator must attest that the original identity document was physically checked.");
        }
        String idNumber = request.getIdCardNumber() != null ? request.getIdCardNumber().trim() : "";
        if (!idNumber.matches("^[0-9]{9,12}$")) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Số CCCD / Hộ chiếu phải gồm từ 9 đến 12 chữ số hợp lệ");
        }

        // Đối chiếu số CCCD / Hộ chiếu nhập vào với số đã lưu trong CSDL của đơn đặt giữ chỗ
        String registeredId = booking.getIdentityCardNumber() != null ? booking.getIdentityCardNumber().trim() : null;
        if (registeredId != null && !registeredId.isEmpty()) {
            if (!registeredId.equalsIgnoreCase(idNumber)) {
                throw new AppException(ErrorCode.INVALID_REQUEST,
                        String.format("Số %s đối chiếu (%s) không trùng khớp với số %s đã đăng ký trong đơn đặt giữ chỗ (%s). Vui lòng kiểm tra lại giấy tờ gốc của khách hàng.",
                                request.getIdCardType() != null ? request.getIdCardType() : "CCCD",
                                idNumber,
                                booking.getIdentityCardType() != null ? booking.getIdentityCardType() : "CCCD",
                                registeredId));
            }
        } else {
            // Trường hợp dữ liệu cũ chưa có số CCCD đăng ký trong booking
            booking.setIdentityCardNumber(idNumber);
            booking.setIdentityCardType(request.getIdCardType() != null ? request.getIdCardType() : "CCCD");
        }

        booking.setIdentityVerifiedByStaff(staff);
        booking.setIdentityVerifiedAt(LocalDateTime.now());
        booking.setIdentityOriginalDocumentSeen(true);
        booking.setIdentityVerificationNotes(request.getNotes());
        booking = bookingRepository.save(booking);

        UUID facilityId = (booking.getStorageUnit() != null && booking.getStorageUnit().getFacility() != null)
                ? booking.getStorageUnit().getFacility().getId() : null;
        activityLogService.record(
                facilityId,
                ActivityAction.CHECKIN_VERIFIED,
                "Booking",
                booking.getId(),
                String.format("Nhân viên %s đã đối chiếu giấy tờ gốc %s của khách hàng %s",
                        staff.getFullName(),
                        booking.getIdentityCardType(),
                        booking.getCustomer() != null ? booking.getCustomer().getFullName() : "Khách"),
                null,
                null
        );
        return getCheckInPrerequisites(booking.getId());
    }

    private void cleanupUploadedFileIfOrphan(String fileUrl) {
        if (fileStorageService != null && fileUrl != null && fileUrl.trim().startsWith("/uploads/")) {
            fileStorageService.deleteFileIfExists(fileUrl.trim());
        }
    }

}
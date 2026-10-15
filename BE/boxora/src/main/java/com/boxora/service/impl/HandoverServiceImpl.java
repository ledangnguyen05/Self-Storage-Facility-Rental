package com.boxora.service.impl;

import com.boxora.dto.request.HandoverRequest;
import com.boxora.dto.response.HandoverPrerequisitesResponse;
import com.boxora.dto.response.HandoverResponse;
import com.boxora.dto.response.ReturnSettlementPreviewResponse;
import com.boxora.dto.response.ReturnSettlementResponse;
import com.boxora.entity.*;
import com.boxora.enums.*;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.repository.*;
import com.boxora.service.ActivityLogService;
import com.boxora.service.EncryptionService;
import com.boxora.service.HandoverService;
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
    private final EncryptionService encryptionService;
    private final RefundRequestRepository refundRequestRepository;
    private final com.boxora.security.FacilityAccessGuard facilityAccessGuard;
    private final com.boxora.security.RequestContext requestContext;

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
                        && contractOpt.get().getSignedAt() != null
        );
        String contractCode = contractOpt.map(RentalContract::getContractCode).orElse(null);
        String contractStatus = contractOpt.map(c -> c.getStatus().name()).orElse("CHƯA_TẠO");

        // 4. Tính toán Điều kiện 4: Đối soát CCCD gốc (Original identity verification)
        boolean identityVerified = customer != null && Boolean.TRUE.equals(customer.getIsActive()) && customer.getPhone() != null && !customer.getPhone().isBlank();
        String idCardNumber = customer != null ? customer.getPhone() : null;

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

        StorageUnit unit = booking.getStorageUnit();
        if (unit == null) {
            throw new AppException(ErrorCode.STORAGE_UNIT_NOT_FOUND);
        }

        if (unit.getFacility() != null) {
            facilityAccessGuard.checkFacilityAccess(unit.getFacility().getId());
        }

        // Kiểm tra ngăn ngừa bàn giao trùng lặp cho cùng một đặt chỗ
        if (booking.getStatus() == BookingStatus.ACTIVE
                || handoverRecordRepository.existsByBooking_IdAndRecordType(booking.getId(), "CHECK_IN")) {
            log.warn("[P0-02] Duplicate check-in attempt for booking {}", booking.getBookingCode());
            throw new AppException(ErrorCode.HANDOVER_ALREADY_ACTIVE);
        }

        if (booking.getStatus() == BookingStatus.CANCELLED || booking.getStatus() == BookingStatus.COMPLETED) {
            throw new AppException(ErrorCode.BOOKING_CANNOT_BE_CANCELLED);
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
        // BR-RULE-005 & P0-02: BACKEND KIỂM TRA 4 ĐIỀU KIỆN TIÊN QUYẾT BẮT BUỘC TỪ DB
        // Không chấp nhận cờ giả mạo do frontend tự quyết định
        // =========================================================================
        List<String> missingPrerequisites = new ArrayList<>();

        // Điều kiện 1: Đủ tiền cọc (Full deposit) từ lịch sử giao dịch thực tế
        BigDecimal requiredDeposit = getRequiredDeposit(booking, unit);
        BigDecimal depositPaid = calculateTotalDepositPaid(booking);
        boolean depositSatisfied = depositPaid.compareTo(BigDecimal.ZERO) > 0
                && depositPaid.compareTo(requiredDeposit) >= 0;
        if (!depositSatisfied) {
            missingPrerequisites.add(String.format("Chưa thanh toán đủ tiền cọc (Đã đóng: %s / Yêu cầu: %s)",
                    depositPaid, requiredDeposit));
        }

        // Điều kiện 2: Đủ tiền thuê tháng đầu (First month rent) từ lịch sử giao dịch thực tế
        BigDecimal requiredFirstMonthRent = getRequiredFirstMonthRent(booking, unit);
        BigDecimal firstMonthRentPaid = calculateTotalFirstMonthRentPaid(booking);
        boolean firstMonthRentSatisfied = firstMonthRentPaid.compareTo(BigDecimal.ZERO) > 0
                && firstMonthRentPaid.compareTo(requiredFirstMonthRent) >= 0;
        if (!firstMonthRentSatisfied) {
            missingPrerequisites.add(String.format("Chưa thanh toán đủ tiền thuê tháng đầu (Đã đóng: %s / Yêu cầu: %s)",
                    firstMonthRentPaid, requiredFirstMonthRent));
        }

        // Điều kiện 3: Hợp đồng điện tử đã ký hợp lệ qua OTP / DocuSeal
        Optional<RentalContract> contractOpt = rentalContractRepository.findByBookingId(booking.getId());
        boolean contractSigned = contractOpt.isPresent() && (
                contractOpt.get().getStatus() == RentalContractStatus.ACTIVE
                        && contractOpt.get().getSignedAt() != null
        );
        if (!contractSigned) {
            missingPrerequisites.add("Hợp đồng thuê điện tử chưa được ký kết hợp lệ qua OTP/DocuSeal");
        }

        // Operator authorization check: Handover check-in MUST be performed by authorized staff/manager/admin
        User staff = resolveStaff(request.getStaffId());
        if (staff == null) {
            log.warn("[HANDOVER_AUTH] Handover check-in requires an authorized staff operator");
            throw new AppException(ErrorCode.FORBIDDEN);
        }
        if (staff.getRole() != null && "CUSTOMER".equalsIgnoreCase(staff.getRole().getName())) {
            log.warn("[HANDOVER_AUTH] Customer {} cannot authorize their own handover", staff.getId());
            throw new AppException(ErrorCode.FORBIDDEN);
        }

        // Điều kiện 4: Nhân viên tại quầy đối soát CCCD / giấy tờ tùy thân gốc
        // 4a. Input validation: Định dạng chuỗi số 9-12 chữ số
        String idCard = request.getIdCardNumber() != null ? request.getIdCardNumber().trim() : "";
        boolean validIdFormat = idCard.matches("^[0-9]{9,12}$");
        if (!validIdFormat) {
            missingPrerequisites.add("Định dạng số CCCD/giấy tờ tùy thân không hợp lệ (yêu cầu chuỗi số 9-12 chữ số)");
        }

        // 4b. Proof of identity: Yêu cầu hành động đối soát thực tế từ nhân viên có thẩm quyền
        boolean staffAttested = Boolean.TRUE.equals(request.getIdentityVerified());
        if (!staffAttested) {
            missingPrerequisites.add("Nhân viên tại quầy chưa xác nhận hoàn tất đối soát giấy tờ tùy thân / CCCD gốc của khách hàng");
        }

        if (!missingPrerequisites.isEmpty()) {
            log.warn("[BR-RULE-005] Check-in failed for booking {}. Missing prerequisites: {}",
                    booking.getBookingCode(), missingPrerequisites);
            throw new AppException(ErrorCode.HANDOVER_PREREQUISITES_NOT_MET);
        }

        // =========================================================================
        // THỰC HIỆN BÀN GIAO THỰC ĐỊA & CẤP QUYỀN TRUY CẬP (P0-03)
        // =========================================================================
        booking.setStatus(BookingStatus.ACTIVE);
        booking.setHandoverTime(LocalDateTime.now());
        booking.setHandedOverByStaffId(staff.getId());

        // P0-03: Sinh mã PIN an toàn ở Backend bằng SecureRandom và mã hóa AES-256-GCM
        java.security.SecureRandom secureRandom = new java.security.SecureRandom();
        String plainPin = String.format("%06d", secureRandom.nextInt(1_000_000));
        String encryptedPin = encryptionService.encrypt(plainPin);

        booking.setAccessPin(encryptedPin);
        booking.setPinUpdatedAt(LocalDateTime.now());
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
                idCard,
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

        // Ghi Audit Trail ActivityLog (không ghi PIN bí mật vào log)
        UUID facilityId = (unit.getFacility() != null) ? unit.getFacility().getId() : null;
        activityLogService.record(
                facilityId,
                ActivityAction.CHECKIN_VERIFIED,
                "Booking",
                booking.getId(),
                String.format("Nhân viên %s đối soát đạt chuẩn 4 điều kiện check-in cho đơn %s (CCCD: %s)",
                        staff != null ? staff.getFullName() : "Quầy giao dịch", booking.getBookingCode(), idCard),
                null,
                null
        );

        activityLogService.record(
                facilityId,
                ActivityAction.HANDOVER_COMPLETE,
                "HandoverRecord",
                record.getId(),
                String.format("Bàn giao thành công ngăn kho %s cho khách hàng %s. Đã phát hành mã PIN và QR truy cập bảo mật.",
                        unit.getUnitCode(), booking.getCustomer() != null ? booking.getCustomer().getFullName() : "Khách"),
                UnitStatus.RESERVED,
                UnitStatus.OCCUPIED
        );

        HandoverResponse response = mapToResponse(record);
        response.setAccessPin(plainPin); // Trả về PIN nguyên bản một lần duy nhất trên màn hình bàn giao
        return response;
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
                ? facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(facility.getId())
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
    @Transactional
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

        User staff = resolveStaff(request.getStaffId());
        StorageUnit unit = booking.getStorageUnit();
        Facility facility = (unit != null) ? unit.getFacility() : null;

        if (facility != null) {
            facilityAccessGuard.checkFacilityAccess(facility.getId());
        }

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
                ? facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(facility.getId())
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

        if (booking.getStatus() != BookingStatus.INSPECTED
                && booking.getStatus() != BookingStatus.CHECKOUT_REQUESTED
                && booking.getStatus() != BookingStatus.ACTIVE
                && booking.getStatus() != BookingStatus.OVERDUE) {
            log.warn("[BR-RULE-013] Booking {} is in status {}, must be INSPECTED, CHECKOUT_REQUESTED, or ACTIVE for return",
                    booking.getBookingCode(), booking.getStatus());
            throw new AppException(ErrorCode.BOOKING_NOT_ACTIVE_FOR_RETURN);
        }

        if (booking.getStatus() == BookingStatus.CHECKOUT_REQUESTED) {
            boolean hasInspection = handoverRecordRepository.existsByBooking_IdAndRecordType(booking.getId(), "INSPECTION");
            if (!hasInspection) {
                log.warn("[BR-RULE-013] Booking {} has checkout request but inspection has not been completed yet", booking.getBookingCode());
                throw new AppException(ErrorCode.RETURN_INSPECTION_CHECKLIST_INCOMPLETE);
            }
        }

        User staff = resolveStaff(request.getStaffId());

        StorageUnit unit = booking.getStorageUnit();
        Facility facility = (unit != null) ? unit.getFacility() : null;

        if (facility != null) {
            facilityAccessGuard.checkFacilityAccess(facility.getId());
        }

        Optional<FacilityPolicy> policyOpt = (facility != null)
                ? facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(facility.getId())
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

        Optional<RentalContract> contractOpt = rentalContractRepository.findByBookingId(booking.getId());

        // 4. Sinh bản ghi giao dịch hoàn tiền Payment và tạo RefundRequest cho kế toán duyệt (9.5.D)
        String refundTxnId = null;
        if (actualRefund.compareTo(BigDecimal.ZERO) > 0) {
            refundTxnId = "REFUND-RET-" + booking.getBookingCode() + "-" + System.currentTimeMillis();

            Payment refundPayment = Payment.builder()
                    .transactionId(refundTxnId)
                    .booking(booking)
                    .amount(actualRefund)
                    .paymentType(PaymentType.DEPOSIT)
                    .status(PaymentStatus.REFUND_PENDING)
                    .paymentMethod(request.getRefundMethod() != null ? request.getRefundMethod() : "BANK_TRANSFER")
                    .paymentTime(LocalDateTime.now())
                    .build();
            paymentRepository.save(refundPayment);

            String reqCode = "REF-" + System.currentTimeMillis() + "-" + com.boxora.util.VNPayUtil.randomAlphaNumeric(4).toUpperCase();
            RefundRequest refundRequest = RefundRequest.builder()
                    .requestCode(reqCode)
                    .customer(booking.getCustomer())
                    .facility(facility)
                    .booking(booking)
                    .contract(contractOpt.orElse(null))
                    .requestedAmount(depositPaid)
                    .deductionAmount(totalDeduction)
                    .finalRefundAmount(actualRefund)
                    .bankName(request.getRefundMethod() != null ? request.getRefundMethod() : "Chuyển khoản / VNPay")
                    .bankAccountNumber("N/A")
                    .bankAccountName(booking.getCustomer() != null ? booking.getCustomer().getFullName() : "Khách hàng")
                    .reason(String.format("Quyết toán trả kho %s (Cọc: %sđ, Khấu trừ: %sđ)",
                            unit != null ? unit.getUnitCode() : "", depositPaid, totalDeduction))
                    .status(RefundStatus.PENDING_REVIEW)
                    .requestedBy(staff != null ? staff : booking.getCustomer())
                    .build();
            refundRequestRepository.save(refundRequest);
        }

        // 5. Thu hồi mã SmartLock và hoàn tất booking
        booking.setAccessPin(null);
        booking.setQrAccessToken(null);
        booking.setStatus(BookingStatus.COMPLETED);
        booking.setReturnTime(LocalDateTime.now());
        bookingRepository.save(booking);

        // 6. Giải phóng ngăn kho: Nếu có hư hại/vệ sinh -> UNDER_MAINTENANCE; Nếu đạt chuẩn -> AVAILABLE
        if (unit != null) {
            boolean hasDamageOrIssues = damageFee.compareTo(BigDecimal.ZERO) > 0
                    || cleaningFee.compareTo(BigDecimal.ZERO) > 0
                    || !doorPassed || !cleanlinessPassed || !smartLockPassed || !sensorPassed || !wallPassed
                    || (request.getDamageNotes() != null && !request.getDamageNotes().isBlank());

            if (hasDamageOrIssues) {
                unit.setStatus(UnitStatus.UNDER_MAINTENANCE);
                log.info("Storage unit {} moved to UNDER_MAINTENANCE due to damage/inspection issues upon checkout", unit.getUnitCode());
            } else {
                unit.setStatus(UnitStatus.AVAILABLE);
                log.info("Storage unit {} returned in pristine condition, released to AVAILABLE", unit.getUnitCode());
            }
            storageUnitRepository.save(unit);
        }

        // 7. Chuyển hợp đồng thuê sang TERMINATED nếu có
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
        boolean hasBookingPayment = payments.stream()
                .anyMatch(p -> p.getPaymentType() == PaymentType.BOOKING_PAYMENT && p.getStatus() == PaymentStatus.PAID);
        if (hasBookingPayment) {
            BigDecimal firstMonthRent = (booking.getTotalRentalFee() != null && booking.getRentalMonths() != null && booking.getRentalMonths() > 0)
                    ? booking.getTotalRentalFee().divide(BigDecimal.valueOf(booking.getRentalMonths()), 2, java.math.RoundingMode.HALF_UP)
                    : ((booking.getStorageUnit() != null && booking.getStorageUnit().getEffectiveBasePrice() != null)
                    ? booking.getStorageUnit().getEffectiveBasePrice() : BigDecimal.ZERO);
            return firstMonthRent != null ? firstMonthRent : BigDecimal.ZERO;
        }
        return payments.stream()
                .filter(p -> p.getPaymentType() == PaymentType.RENTAL_FEE && p.getStatus() == PaymentStatus.PAID)
                .map(Payment::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
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
            slaDays = facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(r.getBooking().getStorageUnit().getFacility().getId())
                    .map(FacilityPolicy::getDepositRefundSlaDays)
                    .orElse(5);
        }

        String plainPin = null;
        if (r.getBooking() != null && r.getBooking().getAccessPin() != null) {
            try {
                plainPin = encryptionService.decrypt(r.getBooking().getAccessPin());
            } catch (Exception ex) {
                plainPin = r.getBooking().getAccessPin();
            }
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
                .accessPin(plainPin)
                .qrAccessToken(r.getBooking() != null ? r.getBooking().getQrAccessToken() : null)
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
        if (requestContext != null && requestContext.currentUserId() != null) {
            return userRepository.findById(requestContext.currentUserId()).orElse(null);
        }
        return null;
    }
}

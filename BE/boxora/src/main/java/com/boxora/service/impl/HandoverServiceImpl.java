package com.boxora.service.impl;

import com.boxora.dto.request.CheckInInspectionRequest;
import com.boxora.dto.request.HandoverRequest;
import com.boxora.dto.request.IdentityVerifyRequest;
import com.boxora.dto.request.ManualPaymentRecordRequest;
import com.boxora.dto.request.PaperContractCreateRequest;
import com.boxora.dto.response.HandoverPrerequisitesResponse;
import com.boxora.dto.response.HandoverResponse;
import com.boxora.dto.response.NotificationLogResponse;
import com.boxora.dto.response.PaymentResponse;
import com.boxora.dto.response.RentalContractResponse;
import com.boxora.dto.response.ReturnSettlementPreviewResponse;
import com.boxora.dto.response.ReturnSettlementResponse;
import com.boxora.entity.*;
import com.boxora.enums.*;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.mapper.PaymentMapper;
import com.boxora.mapper.RentalContractMapper;
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
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
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

    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final DateTimeFormatter CHECKIN_DT_FMT = DateTimeFormatter.ofPattern("HH:mm dd/MM/yyyy");

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
    private final NotificationLogRepository notificationLogRepository;
    private final EmailService emailService;
    private final com.boxora.security.FacilityAccessGuard facilityAccessGuard;
    private final com.boxora.security.RequestContext requestContext;
    private final PaymentMapper paymentMapper;
    private final RentalContractMapper rentalContractMapper;
    private final com.boxora.service.FileStorageService fileStorageService;
    private final StorageUnitLockService storageUnitLockService;

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
        BigDecimal depositRemaining = requiredDeposit.subtract(depositPaid).max(BigDecimal.ZERO);
        boolean depositSatisfied = depositPaid.compareTo(BigDecimal.ZERO) > 0
                && depositPaid.compareTo(requiredDeposit) >= 0;

        // 2. Tính toán Điều kiện 2: Đủ tiền thuê tháng đầu (First month rental fee)
        BigDecimal requiredFirstMonthRent = getRequiredFirstMonthRent(booking, unit);
        BigDecimal firstMonthRentPaid = calculateTotalFirstMonthRentPaid(booking);
        BigDecimal firstMonthRentRemaining = requiredFirstMonthRent.subtract(firstMonthRentPaid).max(BigDecimal.ZERO);
        boolean firstMonthRentSatisfied = firstMonthRentPaid.compareTo(BigDecimal.ZERO) > 0
                && firstMonthRentPaid.compareTo(requiredFirstMonthRent) >= 0;

        // 3. Tính toán Điều kiện 3: Hợp đồng thuê kho (Electronic OTP/DocuSeal or Paper at Facility)
        Optional<RentalContract> contractOpt = rentalContractRepository.findByBookingId(booking.getId());
        boolean contractSigned = false;
        String contractCode = null;
        String contractStatus = "CHƯA_TẠO";
        String contractSigningMethod = booking.getSigningMethod() != null ? booking.getSigningMethod() : "ONLINE";
        String contractVerificationStatus = null;
        String signedDocumentUrl = null;
        LocalDateTime contractSignedAt = null;
        String paperContractUrl = null;
        String paperOriginalLocation = null;
        String paperVerifiedByName = null;
        LocalDateTime paperVerifiedAt = null;

        if (contractOpt.isPresent()) {
            RentalContract contract = contractOpt.get();
            contractCode = contract.getContractCode();
            signedDocumentUrl = contract.getSignedDocumentUrl();
            contractSignedAt = contract.getSignedAt();
            if (contract.getSigningMethod() != null) {
                contractSigningMethod = contract.getSigningMethod();
            }
            paperContractUrl = contract.getPaperContractUrl();
            paperOriginalLocation = contract.getPaperOriginalLocation();
            if (contract.getPaperVerifiedBy() != null) {
                paperVerifiedByName = contract.getPaperVerifiedBy().getFullName();
            }
            paperVerifiedAt = contract.getPaperVerifiedAt();

            boolean isContractSignedOrActive = contract.getStatus() == RentalContractStatus.ACTIVE
                    || contract.getStatus() == RentalContractStatus.PENDING_ACTIVATION;

            // Kiểm tra xem hợp đồng đã hoàn tất ký hay chưa:
            // TH1: Đã ký điện tử trực tuyến (có signedAt và trạng thái ACTIVE hoặc PENDING_ACTIVATION)
            if (isContractSignedOrActive && contract.getSignedAt() != null) {
                contractSigned = true;
                contractStatus = "ĐÃ_KÝ_ĐIỆN_TỬ";
                contractVerificationStatus = "VERIFIED";
            }
            // TH2: Đã ký giấy tại quầy và đã được nhân viên kiểm tra xác minh (có paperVerifiedAt)
            else if (isContractSignedOrActive && contract.getPaperVerifiedAt() != null) {
                contractSigned = true;
                contractStatus = "ĐÃ_KÝ_VÀ_XÁC_MINH";
                contractVerificationStatus = "VERIFIED";
            }
            // TH3: Chưa hoàn tất ký hợp đồng
            else {
                contractSigned = false;
                boolean isPaper = "PAPER".equalsIgnoreCase(contractSigningMethod)
                        || "IN_PERSON".equalsIgnoreCase(contractSigningMethod)
                        || "IN_PERSON".equalsIgnoreCase(booking.getSigningMethod());

                if (isPaper) {
                    if (contract.getStatus() == RentalContractStatus.PENDING_VERIFICATION
                            || (contract.getPaperContractUrl() != null && contract.getPaperVerifiedAt() == null)) {
                        contractStatus = "CHỜ_XÁC_MINH_HỢP_ĐỒNG_GIẤY";
                        contractVerificationStatus = "PENDING_VERIFICATION";
                    } else {
                        contractStatus = "CHỜ_TẢI_HỢP_ĐỒNG_GIẤY";
                        contractVerificationStatus = "PENDING_UPLOAD";
                    }
                } else {
                    contractStatus = contract.getStatus() != null ? contract.getStatus().name() : "CHỜ_KÝ_ONLINE";
                    contractVerificationStatus = "PENDING_SIGNATURE";
                }
            }
        }

        // 4. Tính toán Điều kiện 4: Đối soát CCCD gốc (Original identity verification)
        boolean identityVerified = Boolean.TRUE.equals(booking.getIdentityOriginalDocumentSeen())
                && booking.getIdentityVerifiedAt() != null
                && booking.getIdentityVerifiedByStaff() != null;
        String idCardType = booking.getIdentityCardType() != null ? booking.getIdentityCardType() : "CCCD";
        String idCardNumber = booking.getIdentityCardNumber();
        String identityVerifiedByName = booking.getIdentityVerifiedByStaff() != null ? booking.getIdentityVerifiedByStaff().getFullName() : null;
        LocalDateTime identityVerifiedAt = booking.getIdentityVerifiedAt();

        List<String> missing = new ArrayList<>();
        if (!contractSigned) {
            if (contractOpt.isEmpty()) {
                missing.add("Hợp đồng thuê kho chưa được khởi tạo");
            } else if ("CHỜ_XÁC_MINH_HỢP_ĐỒNG_GIẤY".equals(contractStatus)) {
                missing.add("Hợp đồng giấy đã tải lên nhưng đang chờ nhân viên kiểm tra chữ ký và xác minh hồ sơ");
            } else if ("CHỜ_TẢI_HỢP_ĐỒNG_GIẤY".equals(contractStatus)) {
                missing.add("Hợp đồng giấy chưa được tải lên bản scan/ảnh có chữ ký tại kho");
            } else {
                missing.add(String.format("Hợp đồng điện tử chưa được ký hoàn tất qua DocuSeal/OTP (Trạng thái: %s)", contractStatus));
            }
        }
        if (!depositSatisfied) {
            missing.add(String.format("Tiền cọc còn thiếu %s VNĐ (Đã xác nhận: %s VNĐ / Yêu cầu: %s VNĐ)",
                    String.format("%,d", depositRemaining.longValue()),
                    String.format("%,d", depositPaid.longValue()),
                    String.format("%,d", requiredDeposit.longValue())));
        }
        if (!firstMonthRentSatisfied) {
            missing.add(String.format("Tiền thuê tháng đầu còn thiếu %s VNĐ (Đã xác nhận: %s VNĐ / Yêu cầu: %s VNĐ)",
                    String.format("%,d", firstMonthRentRemaining.longValue()),
                    String.format("%,d", firstMonthRentPaid.longValue()),
                    String.format("%,d", requiredFirstMonthRent.longValue())));
        }
        if (!identityVerified) {
            missing.add("Chưa xác nhận đã đối chiếu giấy tờ tùy thân / CCCD / Passport gốc của khách hàng tại quầy");
        }

        // =========================================================================
        // QUY TẮC NGHIỆP VỤ THỜI ĐIỂM CHECK-IN (LỊCH HẸN NHẬN KHO):
        // 1. Chưa đến ngày check-in -> Không cho phép -> Hiển thị thời điểm được phép nhận kho
        // 2. Đúng ngày nhưng chưa đến giờ check-in -> Không cho phép -> Chờ đến giờ hợp lệ
        // 3. Đã đến giờ check-in -> Có thể -> Kiểm tra các điều kiện bàn giao còn lại
        // 4. Khách đến muộn -> Có thể -> Cho bàn giao nếu hợp đồng, lịch hẹn và các điều kiện khác vẫn hợp lệ
        // =========================================================================
        LocalDateTime expectedCheckIn = booking.getExpectedCheckInAt() != null
                ? booking.getExpectedCheckInAt()
                : (booking.getStartDate() != null ? booking.getStartDate().atStartOfDay() : null);

        boolean checkInTimeMet = true;
        String checkInTimeStatus = "ON_TIME";
        String checkInTimeMessage = "Đã đến thời điểm hợp lệ để nhận kho";

        if (expectedCheckIn != null) {
            LocalDateTime now = LocalDateTime.now(BUSINESS_ZONE);
            LocalDate today = now.toLocalDate();
            LocalDate apptDate = expectedCheckIn.toLocalDate();

            if (today.isBefore(apptDate)) {
                checkInTimeMet = false;
                checkInTimeStatus = "BEFORE_DATE";
                checkInTimeMessage = String.format("Chưa đến ngày check-in. Thời điểm được phép nhận kho từ: %s",
                        expectedCheckIn.format(CHECKIN_DT_FMT));
                missing.add(checkInTimeMessage);
            } else if (today.isEqual(apptDate) && now.isBefore(expectedCheckIn)) {
                checkInTimeMet = false;
                checkInTimeStatus = "BEFORE_TIME";
                checkInTimeMessage = String.format("Đúng ngày nhưng chưa đến giờ check-in (Lịch hẹn lúc %s). Vui lòng chờ đến giờ hợp lệ.",
                        expectedCheckIn.format(CHECKIN_DT_FMT));
                missing.add(checkInTimeMessage);
            } else if (today.isEqual(apptDate)) {
                checkInTimeMet = true;
                checkInTimeStatus = "ON_TIME";
                checkInTimeMessage = "Đã đến giờ check-in hợp lệ";
            } else {
                checkInTimeMet = true;
                checkInTimeStatus = "LATE";
                checkInTimeMessage = String.format("Khách đến muộn so với lịch hẹn (%s). Cho phép bàn giao nếu hợp đồng, lịch hẹn và các điều kiện khác vẫn hợp lệ.",
                        expectedCheckIn.format(CHECKIN_DT_FMT));
            }
        }

        boolean eligible = missing.isEmpty();

        List<PaymentResponse> paymentHistory = paymentRepository.findAllByBooking_Id(booking.getId()).stream()
                .sorted((a, b) -> {
                    LocalDateTime t1 = a.getPaymentTime() != null ? a.getPaymentTime() : LocalDateTime.MIN;
                    LocalDateTime t2 = b.getPaymentTime() != null ? b.getPaymentTime() : LocalDateTime.MIN;
                    return t2.compareTo(t1);
                })
                .map(paymentMapper::toResponse)
                .collect(Collectors.toList());

        return HandoverPrerequisitesResponse.builder()
                .bookingId(booking.getId())
                .bookingCode(booking.getBookingCode())
                .customerName(customer != null ? customer.getFullName() : "N/A")
                .customerPhone(customer != null ? customer.getPhone() : "N/A")
                .customerEmail(customer != null ? customer.getEmail() : "N/A")
                .unitCode(unit != null ? unit.getUnitCode() : "N/A")
                .unitTypeName(unit != null && unit.getUnitType() != null ? unit.getUnitType().getTypeName() : "Kho tiêu chuẩn")
                .areaSqMeters(unit != null && unit.getUnitType() != null ? unit.getUnitType().getAreaSqm() : null)
                .facilityName((unit != null && unit.getFacility() != null) ? unit.getFacility().getName() : "N/A")
                .depositSatisfied(depositSatisfied)
                .depositPaid(depositPaid)
                .requiredDeposit(requiredDeposit)
                .depositRemaining(depositRemaining)
                .firstMonthRentSatisfied(firstMonthRentSatisfied)
                .firstMonthRentPaid(firstMonthRentPaid)
                .requiredFirstMonthRent(requiredFirstMonthRent)
                .firstMonthRentRemaining(firstMonthRentRemaining)
                .contractSigned(contractSigned)
                .contractCode(contractCode)
                .contractStatus(contractStatus)
                .contractSigningMethod(contractSigningMethod)
                .contractVerificationStatus(contractVerificationStatus)
                .signedDocumentUrl(signedDocumentUrl)
                .contractSignedAt(contractSignedAt)
                .paperContractUrl(paperContractUrl)
                .paperOriginalLocation(paperOriginalLocation)
                .paperVerifiedByName(paperVerifiedByName)
                .paperVerifiedAt(paperVerifiedAt)
                .identityVerified(identityVerified)
                .idCardType(idCardType)
                .idCardNumber(idCardNumber)
                .registeredIdCardNumber(booking.getIdentityCardNumber())
                .registeredIdCardType(booking.getIdentityCardType() != null ? booking.getIdentityCardType() : "CCCD")
                .identityVerifiedByName(identityVerifiedByName)
                .identityVerifiedAt(identityVerifiedAt)
                .checkInTimeMet(checkInTimeMet)
                .checkInTimeStatus(checkInTimeStatus)
                .checkInTimeMessage(checkInTimeMessage)
                .expectedCheckInAt(expectedCheckIn)
                .eligibleForInspection(eligible)
                .eligibleForCheckIn(eligible)
                .missingPrerequisites(missing)
                .paymentHistory(paymentHistory)
                .build();
    }

    /**
     * Thực hiện Check-in và bàn giao kho vật lý (BR-RULE-005 và BR-RULE-006):
     * Bắt buộc thỏa mãn đồng thời cả 4 điều kiện.
     */
    @Transactional
    @Override
    public HandoverPrerequisitesResponse assignUnitToBooking(UUID bookingId, String unitCode) {
        if (unitCode == null || unitCode.trim().isEmpty()) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Mã kho không được để trống.");
        }
        Booking booking = bookingRepository.findByIdForUpdate(bookingId)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        if (booking.getStatus() == BookingStatus.ACTIVE) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Đơn đặt kho đã hoàn tất check-in nhận kho, không thể đổi mã kho.");
        }

        StorageUnit previousUnit = booking.getStorageUnit();
        if (previousUnit == null) {
            throw new AppException(ErrorCode.STORAGE_UNIT_NOT_FOUND);
        }
        UUID facilityId = previousUnit.getFacility() != null ? previousUnit.getFacility().getId() : null;
        if (facilityId == null) {
            throw new AppException(ErrorCode.STORAGE_UNIT_NOT_FOUND);
        }
        facilityAccessGuard.checkFacilityAccess(facilityId);

        String cleanUnitCode = unitCode.trim();
        StorageUnit selectedUnit = storageUnitRepository
                .findWithDetailsByFacilityAndUnitCodeForUpdate(facilityId, cleanUnitCode)
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
            bookingRepository.save(booking);

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

            selectedUnit.setStatus(UnitStatus.RESERVED);
            storageUnitRepository.save(selectedUnit);

            rentalContractRepository.findByBookingId(booking.getId()).ifPresent(contract -> {
                contract.setUnit(selectedUnit);
                rentalContractRepository.save(contract);
            });
        }

        return getCheckInPrerequisites(booking.getId());
    }

    @Override
    public HandoverResponse checkIn(HandoverRequest request) {
        Booking booking = bookingRepository.findByIdForUpdate(request.getBookingId())
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        StorageUnit unit = booking.getStorageUnit();
        if (unit == null) {
            throw new AppException(ErrorCode.STORAGE_UNIT_NOT_FOUND);
        }

        if (unit.getFacility() != null) {
            facilityAccessGuard.checkFacilityAccess(unit.getFacility().getId());
        }

        User staff = requireAuthorizedStaffOperator(null);

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

        HandoverRecord latestInspection = handoverRecordRepository.findByBooking_Id(booking.getId()).stream()
                .filter(record -> "CHECK_IN_INSPECTION".equals(record.getRecordType()))
                .max(java.util.Comparator.comparing(HandoverRecord::getRecordedAt,
                        java.util.Comparator.nullsFirst(java.util.Comparator.naturalOrder())))
                .orElseThrow(() -> new AppException(ErrorCode.RETURN_INSPECTION_CHECKLIST_INCOMPLETE,
                        "A persisted check-in inspection with evidence is required before handover."));
        boolean inspectionPassed = Boolean.TRUE.equals(latestInspection.getDoorConditionPassed())
                && Boolean.TRUE.equals(latestInspection.getCleanlinessPassed())
                && Boolean.TRUE.equals(latestInspection.getSmartLockPassed())
                && Boolean.TRUE.equals(latestInspection.getSensorPassed())
                && Boolean.TRUE.equals(latestInspection.getWallStructurePassed());
        long inspectionPhotoCount = latestInspection.getEvidencePhotos() == null || latestInspection.getEvidencePhotos().isBlank()
                ? 0 : Arrays.stream(latestInspection.getEvidencePhotos().split(";")).filter(value -> !value.isBlank()).count();
        if (!inspectionPassed || inspectionPhotoCount < 2) {
            throw new AppException(ErrorCode.RETURN_INSPECTION_CHECKLIST_INCOMPLETE,
                    "The latest persisted check-in inspection must pass all checklist items and include two evidence photos.");
        }

        // =========================================================================
        // QUY TẮC NGHIỆP VỤ THỜI ĐIỂM CHECK-IN (LỊCH HẸN NHẬN KHO):
        // 1. Chưa đến ngày check-in -> Không cho phép -> Ném lỗi HANDOVER_BEFORE_CHECKIN_DATE
        // 2. Đúng ngày nhưng chưa đến giờ check-in -> Không cho phép -> Ném lỗi HANDOVER_BEFORE_CHECKIN_TIME
        // 3. Đã đến giờ check-in -> Có thể -> Tiếp tục kiểm tra các điều kiện bàn giao còn lại
        // 4. Khách đến muộn -> Có thể -> Cho bàn giao nếu hợp đồng, lịch hẹn và các điều kiện khác vẫn hợp lệ
        // =========================================================================
        LocalDateTime expectedCheckIn = booking.getExpectedCheckInAt() != null
                ? booking.getExpectedCheckInAt()
                : (booking.getStartDate() != null ? booking.getStartDate().atStartOfDay() : null);

        if (expectedCheckIn != null) {
            LocalDateTime now = LocalDateTime.now(BUSINESS_ZONE);
            LocalDate today = now.toLocalDate();
            LocalDate apptDate = expectedCheckIn.toLocalDate();

            if (today.isBefore(apptDate)) {
                log.warn("[CHECKIN-DATE] Handover check-in rejected for booking {}. Today {} is before expected check-in date {}",
                        booking.getBookingCode(), today, apptDate);
                throw new AppException(ErrorCode.HANDOVER_BEFORE_CHECKIN_DATE,
                        String.format("Chưa đến ngày check-in. Thời điểm được phép nhận kho từ: %s",
                                expectedCheckIn.format(CHECKIN_DT_FMT)));
            } else if (today.isEqual(apptDate) && now.isBefore(expectedCheckIn)) {
                log.warn("[CHECKIN-TIME] Handover check-in rejected for booking {}. Current time {} is before expected check-in time {}",
                        booking.getBookingCode(), now, expectedCheckIn);
                throw new AppException(ErrorCode.HANDOVER_BEFORE_CHECKIN_TIME,
                        String.format("Đúng ngày nhưng chưa đến giờ check-in (Lịch hẹn lúc %s). Vui lòng chờ đến giờ hợp lệ.",
                                expectedCheckIn.format(CHECKIN_DT_FMT)));
            }
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

        // Điều kiện 3: Hợp đồng thuê kho (Electronic or Paper at Facility)
        Optional<RentalContract> contractOpt = rentalContractRepository.findByBookingId(booking.getId());
        boolean contractSigned = false;
        if (contractOpt.isPresent()) {
            RentalContract contract = contractOpt.get();
            boolean isContractSignedOrActive = contract.getStatus() == RentalContractStatus.ACTIVE
                    || contract.getStatus() == RentalContractStatus.PENDING_ACTIVATION;
            if (isContractSignedOrActive && contract.getSignedAt() != null) {
                contractSigned = true;
            } else if (isContractSignedOrActive && contract.getPaperVerifiedAt() != null) {
                contractSigned = true;
            }
        }
        if (!contractSigned) {
            missingPrerequisites.add("Hợp đồng thuê chưa được ký kết hoặc chưa được nhân viên xác minh hợp lệ");
        }

        // Operator authorization check: Handover check-in MUST be performed by authorized staff/manager/admin
        // Điều kiện 4: Nhân viên tại quầy đối soát CCCD / giấy tờ tùy thân gốc
        boolean idAlreadyVerified = Boolean.TRUE.equals(booking.getIdentityOriginalDocumentSeen())
                && booking.getIdentityVerifiedAt() != null
                && booking.getIdentityVerifiedByStaff() != null
                && booking.getIdentityCardNumber() != null
                && booking.getIdentityCardNumber().matches("^[A-Za-z0-9]{7,15}$");

        if (!idAlreadyVerified) {
            missingPrerequisites.add("Nhân viên tại quầy chưa xác nhận hoàn tất đối soát giấy tờ tùy thân / CCCD gốc của khách hàng");
        }

        if (!missingPrerequisites.isEmpty()) {
            log.warn("[BR-RULE-005] Check-in failed for booking {}. Missing prerequisites: {}",
                    booking.getBookingCode(), missingPrerequisites);
            throw new AppException(ErrorCode.HANDOVER_PREREQUISITES_NOT_MET);
        }

        String requestedUnitCode = request.getRequestedUnitCode() != null
                ? request.getRequestedUnitCode().trim()
                : (unit != null ? unit.getUnitCode() : "");
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
        // THỰC HIỆN BÀN GIAO THỰC ĐỊA & CẤP QUYỀN TRUY CẬP (P0-03)
        // Hiệu lực thuê chính thức tính từ ngày check-in và kích hoạt mã PIN
        // =========================================================================
        LocalDate checkInDate = LocalDate.now();
        int rentalMonths = (booking.getRentalMonths() != null && booking.getRentalMonths() > 0)
                ? booking.getRentalMonths()
                : 1;
        LocalDate effectiveEndDate = checkInDate.plusMonths(rentalMonths);

        booking.setStartDate(checkInDate);
        booking.setEndDate(effectiveEndDate);
        booking.setStatus(BookingStatus.ACTIVE);
        booking.setHandoverTime(LocalDateTime.now());
        booking.setHandedOverByStaffId(staff.getId());
        booking.setPaymentStatus("PAID");
        booking.setHoldExpiresAt(null);
        booking.setPaymentExpiresAt(null);

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

        // Kích hoạt trạng thái hợp đồng thuê sang ACTIVE và đồng bộ ngày hiệu lực thực tế
        contractOpt.ifPresent(contract -> {
            contract.setStartDate(checkInDate);
            contract.setEndDate(effectiveEndDate);
            contract.setStatus(RentalContractStatus.ACTIVE);
            rentalContractRepository.save(contract);
        });

        // Ghi biên bản bàn giao HandoverRecord
        String notes = String.format("Check-in hoàn tất đạt chuẩn 4 điều kiện BR-RULE-005. Mã thẻ RFID: %s. %s",
                request.getRfidCardNumber() != null ? request.getRfidCardNumber() : "N/A",
                request.getNotes() != null ? request.getNotes() : "");

        HandoverRecord record = HandoverRecord.builder()
                .booking(booking)
                .staff(staff)
                .recordType("CHECK_IN")
                .unitCondition(request.getUnitCondition() != null ? request.getUnitCondition() : latestInspection.getUnitCondition())
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
                String.format("Nhân viên %s đối soát đạt chuẩn 4 điều kiện check-in cho đơn %s",
                        staff.getFullName(), booking.getBookingCode()),
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

        // Tự động gửi Email và lưu thông báo Web cho khách hàng khi bàn giao thành công
        try {
            if (booking.getCustomer() != null && booking.getCustomer().getEmail() != null
                    && !booking.getCustomer().getEmail().isBlank()) {
                String toEmail = booking.getCustomer().getEmail();
                String custName = booking.getCustomer().getFullName();
                String facilityName = (unit.getFacility() != null) ? unit.getFacility().getName() : "Boxora Facility";
                emailService.sendHandoverPinEmail(toEmail, custName, unit.getUnitCode(), booking.getBookingCode(), plainPin, facilityName);
            }
        } catch (Exception e) {
            log.warn("[CHECK_IN] Could not send handover PIN email: {}", e.getMessage());
        }

        try {
            if (booking.getCustomer() != null && booking.getCustomer().getEmail() != null
                    && !booking.getCustomer().getEmail().isBlank()) {
                String facilityName = (unit.getFacility() != null) ? unit.getFacility().getName() : "Boxora Facility";
                NotificationLog notifLog = NotificationLog.builder()
                        .recipient(booking.getCustomer())
                        .recipientEmail(booking.getCustomer().getEmail())
                        .recipientName(booking.getCustomer().getFullName())
                        .facility(unit.getFacility())
                        .channel(NotificationChannel.IN_APP)
                        .notificationType(NotificationType.HANDOVER_PIN)
                        .referenceType("BOOKING")
                        .referenceId(booking.getId())
                        .title(String.format("Bàn giao kho & Cấp mã PIN [%s]", unit.getUnitCode()))
                        .content(String.format("Kính gửi quý khách, quy trình bàn giao kho %s tại cơ sở %s đã hoàn tất. Boxora lưu mã PIN của bạn là: %s. Vui lòng xác nhận với nhân viên việc cài đặt mã trên khóa vật lý; Boxora chưa xác minh trạng thái thiết bị.",
                                unit.getUnitCode(), facilityName, plainPin))
                        .status("SENT")
                        .build();
                notificationLogRepository.save(notifLog);
            }
        } catch (Exception e) {
            log.warn("[CHECK_IN] Could not save in-app notification log: {}", e.getMessage());
        }

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
        if ("CUSTOMER".equalsIgnoreCase(requestContext.currentUserRole())) {
            UUID currentUserId = requestContext.currentUserId();
            if (currentUserId == null || customer == null || !currentUserId.equals(customer.getId())) {
                throw new AppException(ErrorCode.FORBIDDEN);
            }
        }

        Optional<RentalContract> contractOpt = rentalContractRepository.findByBookingId(booking.getId());
        String contractCode = contractOpt.map(RentalContract::getContractCode).orElse(null);
        String contractStatus = contractOpt.map(c -> c.getStatus().name()).orElse("N/A");

        Optional<FacilityPolicy> policyOpt = (facility != null)
                ? facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(facility.getId())
                : Optional.empty();

        FacilityPolicy policy = policyOpt.orElseThrow(() -> new AppException(ErrorCode.INVALID_REQUEST,
                "An active facility policy is required to calculate the return settlement preview."));
        if (policy.getDepositRefundSlaDays() == null || policy.getDailyLateFee() == null || policy.getOverdueGraceDays() == null) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "The active facility policy is missing return settlement values.");
        }
        int slaDays = policy.getDepositRefundSlaDays();
        BigDecimal dailyLateFee = policy.getDailyLateFee();
        int graceDays = policy.getOverdueGraceDays();

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
                ? facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(facility.getId())
                : Optional.empty();
        int refundSlaDays = policyOpt.map(FacilityPolicy::getDepositRefundSlaDays)
                .orElseThrow(() -> new AppException(ErrorCode.INVALID_REQUEST, "An active facility policy is required."));

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
        Booking booking = bookingRepository.findByIdForUpdate(request.getBookingId())
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        if (booking.getStatus() != BookingStatus.INSPECTED
                && booking.getStatus() != BookingStatus.CHECKOUT_REQUESTED
                && booking.getStatus() != BookingStatus.ACTIVE
                && booking.getStatus() != BookingStatus.OVERDUE) {
            log.warn("[BR-RULE-013] Booking {} is in status {}, must be INSPECTED, CHECKOUT_REQUESTED, or ACTIVE for return",
                    booking.getBookingCode(), booking.getStatus());
            throw new AppException(ErrorCode.BOOKING_NOT_ACTIVE_FOR_RETURN);
        }

        User staff = requireAuthorizedStaffOperator(null);

        StorageUnit unit = booking.getStorageUnit();
        Facility facility = (unit != null) ? unit.getFacility() : null;

        if (facility != null) {
            facilityAccessGuard.checkFacilityAccess(facility.getId());
        }

        Optional<FacilityPolicy> policyOpt = (facility != null)
                ? facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(facility.getId())
                : Optional.empty();

        FacilityPolicy policy = policyOpt.orElseThrow(() -> new AppException(ErrorCode.INVALID_REQUEST,
                "An active facility policy is required to process a return proposal."));
        if (policy.getDepositRefundSlaDays() == null || policy.getDailyLateFee() == null || policy.getOverdueGraceDays() == null) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "The active facility policy is missing return settlement values.");
        }
        int refundSlaDays = policy.getDepositRefundSlaDays();
        BigDecimal dailyLateFee = policy.getDailyLateFee();
        int overdueGraceDays = policy.getOverdueGraceDays();

        // 1. Thẩm định Checklist 5 điểm hiện trường (BR-RULE-013)
        HandoverRecord inspection = handoverRecordRepository.findByBooking_Id(booking.getId()).stream()
                .filter(record -> "INSPECTION".equals(record.getRecordType()))
                .max(java.util.Comparator.comparing(HandoverRecord::getRecordedAt,
                        java.util.Comparator.nullsFirst(java.util.Comparator.naturalOrder())))
                .orElseThrow(() -> new AppException(ErrorCode.RETURN_INSPECTION_CHECKLIST_INCOMPLETE,
                        "A persisted return inspection is required before settlement."));
        if (inspection.getDoorConditionPassed() == null || inspection.getCleanlinessPassed() == null
                || inspection.getSmartLockPassed() == null || inspection.getSensorPassed() == null
                || inspection.getWallStructurePassed() == null) {
            throw new AppException(ErrorCode.RETURN_INSPECTION_CHECKLIST_INCOMPLETE,
                    "The persisted return inspection is missing checklist values.");
        }
        boolean doorPassed = Boolean.TRUE.equals(inspection.getDoorConditionPassed());
        boolean cleanlinessPassed = Boolean.TRUE.equals(inspection.getCleanlinessPassed());
        boolean smartLockPassed = Boolean.TRUE.equals(inspection.getSmartLockPassed());
        boolean sensorPassed = Boolean.TRUE.equals(inspection.getSensorPassed());
        boolean wallPassed = Boolean.TRUE.equals(inspection.getWallStructurePassed());

        String checklistSummary = String.format(
                "Cửa cuốn: %s | Vệ sinh: %s | SmartLock: %s | Cảm biến: %s | Tường vách: %s",
                doorPassed ? "Đạt" : "Không đạt",
                cleanlinessPassed ? "Sạch sẽ" : "Chưa dọn",
                smartLockPassed ? "Tốt" : "Lỗi",
                sensorPassed ? "Chuẩn" : "Lỗi",
                wallPassed ? "Nguyên vẹn" : "Hư hại"
        );

        List<String> evidencePhotos = inspection.getEvidencePhotos() == null || inspection.getEvidencePhotos().isBlank()
                ? List.of() : Arrays.stream(inspection.getEvidencePhotos().split(";"))
                    .filter(value -> !value.isBlank()).collect(Collectors.toList());
        if (evidencePhotos.size() < 2) {
            throw new AppException(ErrorCode.RETURN_INSPECTION_CHECKLIST_INCOMPLETE,
                    "The persisted return inspection must include two evidence photos.");
        }

        // 2. Quyết toán cọc và các khoản khấu trừ (BR-RULE-014)
        BigDecimal depositPaid = calculateTotalDepositPaid(booking);

        BigDecimal damageFee = request.getDamageFee() != null ? request.getDamageFee() : BigDecimal.ZERO;
        BigDecimal cleaningFee = request.getCleaningFee() != null ? request.getCleaningFee() : BigDecimal.ZERO;
        BigDecimal lostCardFee = request.getLostCardFee() != null ? request.getLostCardFee() : BigDecimal.ZERO;

        if (damageFee.signum() < 0 || cleaningFee.signum() < 0 || lostCardFee.signum() < 0
                || (request.getDeductionAmount() != null && request.getDeductionAmount().signum() < 0)) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Return deduction proposals cannot be negative.");
        }

        BigDecimal overdueDebt = BigDecimal.ZERO;
        LocalDate today = LocalDate.now();
        LocalDate endDate = booking.getEndDate();
        if (endDate != null && today.isAfter(endDate)) {
            long overdueDays = ChronoUnit.DAYS.between(endDate, today);
            long billableDays = Math.max(0, overdueDays - overdueGraceDays);
            if (billableDays > 0) {
                overdueDebt = dailyLateFee.multiply(BigDecimal.valueOf(billableDays));
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
        BigDecimal actualRefund = netRefundAmount.max(BigDecimal.ZERO).min(depositPaid);
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

        // Create a proposal only. The actual refund Payment is recorded after finance confirms a real transfer.
        if (actualRefund.compareTo(BigDecimal.ZERO) > 0) {
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
                .doorConditionPassed(doorPassed)
                .cleanlinessPassed(cleanlinessPassed)
                .smartLockPassed(smartLockPassed)
                .sensorPassed(sensorPassed)
                .wallStructurePassed(wallPassed)
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

        if (actualRefund.compareTo(BigDecimal.ZERO) > 0) {
            activityLogService.record(
                    facilityId,
                    ActivityAction.REFUND_REQUEST_CREATE,
                    "RefundRequest",
                    record.getId(),
                    String.format("Đề xuất hoàn tiền cọc %s VNĐ (Trạng thái: %s, SLA: %d ngày) cho đơn %s",
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
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        if (facilityAccessGuard.isFacilityScoped()) {
            UUID facilityId = (booking.getStorageUnit() != null && booking.getStorageUnit().getFacility() != null)
                    ? booking.getStorageUnit().getFacility().getId() : null;
            if (facilityId != null) {
                facilityAccessGuard.checkFacilityAccess(facilityId);
            }
        }
        if ("CUSTOMER".equalsIgnoreCase(requestContext.currentUserRole())) {
            UUID currentUserId = requestContext.currentUserId();
            if (currentUserId == null || booking.getCustomer() == null || !currentUserId.equals(booking.getCustomer().getId())) {
                throw new AppException(ErrorCode.FORBIDDEN);
            }
        }

        return handoverRecordRepository.findByBookingId(bookingId).stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    private BigDecimal getRequiredDeposit(Booking booking, StorageUnit unit) {
        if (booking.getDepositAmount() != null && booking.getDepositAmount().compareTo(BigDecimal.ZERO) > 0) {
            return booking.getDepositAmount();
        }
        if (unit != null && unit.getUnitType() != null && unit.getUnitType().getDepositAmount() != null) {
            return unit.getUnitType().getDepositAmount();
        }
        if (booking.getDepositPaid() != null && booking.getDepositPaid().compareTo(BigDecimal.ZERO) > 0) {
            return booking.getDepositPaid();
        }
        if (unit != null && unit.getEffectiveBasePrice() != null) {
            return unit.getEffectiveBasePrice();
        }
        return new BigDecimal("450000.00");
    }

    private BigDecimal calculateTotalDepositPaid(Booking booking) {
        return calculateTotalDepositPaid(booking, null);
    }

    private BigDecimal calculateTotalDepositPaid(Booking booking, Payment additionalPayment) {
        List<Payment> payments = new ArrayList<>(paymentRepository.findAllByBooking_Id(booking.getId()));
        if (additionalPayment != null && !containsPayment(payments, additionalPayment)) {
            payments.add(additionalPayment);
        }

        BigDecimal fromPayments = payments.stream()
                .filter(p -> p.getPaymentType() == PaymentType.DEPOSIT
                        && p.getStatus() == PaymentStatus.PAID
                        && p.getAmount() != null
                        && p.getAmount().compareTo(BigDecimal.ZERO) > 0)
                .map(Payment::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal refundedDeposit = payments.stream()
                .filter(p -> p.getPaymentType() == PaymentType.DEPOSIT
                        && p.getStatus() == PaymentStatus.REFUNDED
                        && p.getAmount() != null
                        && p.getAmount().compareTo(BigDecimal.ZERO) > 0)
                .map(Payment::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        if (fromPayments.compareTo(BigDecimal.ZERO) > 0) {
            return fromPayments.subtract(refundedDeposit).max(BigDecimal.ZERO);
        }

        BigDecimal paidBookingPayments = payments.stream()
                .filter(p -> p.getPaymentType() == PaymentType.BOOKING_PAYMENT
                        && p.getStatus() == PaymentStatus.PAID
                        && p.getAmount() != null
                        && p.getAmount().compareTo(BigDecimal.ZERO) > 0)
                .map(Payment::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        if (paidBookingPayments.compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal reqDep = getRequiredDeposit(booking, booking.getStorageUnit());
            BigDecimal allocatedDep = paidBookingPayments.min(reqDep);
            return allocatedDep.subtract(refundedDeposit).max(BigDecimal.ZERO);
        }

        boolean hasAnyDepositOrBookingTx = payments.stream()
                .anyMatch(p -> p.getPaymentType() == PaymentType.DEPOSIT || p.getPaymentType() == PaymentType.BOOKING_PAYMENT);
        if (!hasAnyDepositOrBookingTx
                && booking.getStatus() != BookingStatus.CANCELLED
                && booking.getDepositPaid() != null
                && booking.getDepositPaid().compareTo(BigDecimal.ZERO) > 0) {
            return booking.getDepositPaid();
        }
        return BigDecimal.ZERO;
    }

    private BigDecimal getRequiredFirstMonthRent(Booking booking, StorageUnit unit) {
        if (booking.getTotalRentalFee() != null && booking.getRentalMonths() != null && booking.getRentalMonths() > 0) {
            return booking.getTotalRentalFee().divide(BigDecimal.valueOf(booking.getRentalMonths()), 2, java.math.RoundingMode.HALF_UP);
        }
        if (unit != null && unit.getEffectiveBasePrice() != null) {
            return unit.getEffectiveBasePrice();
        }
        return new BigDecimal("450000.00");
    }

    private BigDecimal calculateTotalFirstMonthRentPaid(Booking booking) {
        return calculateTotalFirstMonthRentPaid(booking, null);
    }

    private BigDecimal calculateTotalFirstMonthRentPaid(Booking booking, Payment additionalPayment) {
        List<Payment> payments = new ArrayList<>(paymentRepository.findAllByBooking_Id(booking.getId()));
        if (additionalPayment != null && !containsPayment(payments, additionalPayment)) {
            payments.add(additionalPayment);
        }

        BigDecimal fromRentPayments = payments.stream()
                .filter(p -> p.getPaymentType() == PaymentType.RENTAL_FEE
                        && p.getStatus() == PaymentStatus.PAID
                        && p.getAmount() != null
                        && p.getAmount().compareTo(BigDecimal.ZERO) > 0)
                .map(Payment::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal refundedRent = payments.stream()
                .filter(p -> p.getPaymentType() == PaymentType.RENTAL_FEE
                        && p.getStatus() == PaymentStatus.REFUNDED
                        && p.getAmount() != null
                        && p.getAmount().compareTo(BigDecimal.ZERO) > 0)
                .map(Payment::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        if (fromRentPayments.compareTo(BigDecimal.ZERO) > 0) {
            return fromRentPayments.subtract(refundedRent).max(BigDecimal.ZERO);
        }

        BigDecimal paidBookingPayments = payments.stream()
                .filter(p -> p.getPaymentType() == PaymentType.BOOKING_PAYMENT
                        && p.getStatus() == PaymentStatus.PAID
                        && p.getAmount() != null
                        && p.getAmount().compareTo(BigDecimal.ZERO) > 0)
                .map(Payment::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        if (paidBookingPayments.compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal reqDep = getRequiredDeposit(booking, booking.getStorageUnit());
            BigDecimal reqRent = getRequiredFirstMonthRent(booking, booking.getStorageUnit());
            BigDecimal remainingAfterDep = paidBookingPayments.subtract(reqDep).max(BigDecimal.ZERO);
            return remainingAfterDep.min(reqRent).subtract(refundedRent).max(BigDecimal.ZERO);
        }
        return BigDecimal.ZERO;
    }

    private boolean containsPayment(List<Payment> list, Payment target) {
        if (list == null || target == null) {
            return false;
        }
        for (Payment p : list) {
            if (p == target) {
                return true;
            }
            if (target.getId() != null && target.getId().equals(p.getId())) {
                return true;
            }
            if (target.getTransactionId() != null && target.getTransactionId().equals(p.getTransactionId())) {
                return true;
            }
        }
        return false;
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
                    .orElse(null);
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

    // =========================================================================
    // QUY TRÌNH CHECK-IN ĐỐI SOÁT 4 ĐIỀU KIỆN & NGHIỆM THU HIỆN TRƯỜNG
    // =========================================================================

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

    @Override
    @Transactional(readOnly = true)
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

            String method = request.getPaymentMethod() != null && !request.getPaymentMethod().isBlank()
                    ? request.getPaymentMethod().trim().toUpperCase()
                    : "BANK_TRANSFER";

            if (!"BANK_TRANSFER".equals(method)) {
                throw new AppException(ErrorCode.INVALID_PAYMENT_METHOD, "Hệ thống chỉ chấp nhận phương thức chuyển khoản ngân hàng (BANK_TRANSFER) tại quầy");
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

            // Khi chuyển khoản ngân hàng: Bắt buộc có mã tham chiếu giao dịch và chứng từ upload hợp lệ
            String cleanRefCode;
            if (request.getReferenceCode() != null && !request.getReferenceCode().isBlank()) {
                cleanRefCode = request.getReferenceCode().trim();
            } else if (request.getReceiptVoucherCode() != null && !request.getReceiptVoucherCode().isBlank()) {
                cleanRefCode = request.getReceiptVoucherCode().trim();
            } else {
                throw new AppException(ErrorCode.INVALID_REQUEST, "Vui lòng nhập mã tham chiếu giao dịch chuyển khoản ngân hàng (Ref Code)");
            }

            if (cleanRefCode.length() > 100) {
                throw new AppException(ErrorCode.INVALID_REQUEST, "Mã tham chiếu ngân hàng không được vượt quá 100 ký tự");
            }
            if (paymentRepository.existsByReferenceCodeIgnoreCase(cleanRefCode)) {
                throw new AppException(ErrorCode.PAYMENT_ALREADY_PROCESSED, "Mã tham chiếu ngân hàng " + cleanRefCode + " đã tồn tại trong hệ thống");
            }
            String cleanProofUrl = validateStoredDocumentUrl(rawProofUrl, "Chứng từ chuyển khoản ngân hàng");

            String txnId = "BANK-" + booking.getBookingCode() + "-" + System.currentTimeMillis()
                    + "-" + UUID.randomUUID().toString().substring(0, 4).toUpperCase();

            Payment payment = Payment.builder()
                    .transactionId(txnId)
                    .booking(booking)
                    .amount(request.getAmount())
                    .paymentType(request.getPaymentType())
                    .paymentMethod("BANK_TRANSFER")
                    .paymentTime(LocalDateTime.now())
                    .collectedByStaff(staff)
                    .receiptVoucherCode(null)
                    .referenceCode(cleanRefCode)
                    .proofDocumentUrl(cleanProofUrl)
                    .paymentNotes(request.getNotes() != null ? request.getNotes().trim() : null)
                    .status(PaymentStatus.PENDING)
                    .confirmedByStaff(null)
                    .confirmedAt(null)
                    .build();

            payment = paymentRepository.save(payment);

            UUID facilityId = (unit != null && unit.getFacility() != null) ? unit.getFacility().getId() : null;
            activityLogService.record(
                    facilityId,
                    ActivityAction.PAYMENT_INITIATED,
                    "Payment",
                    payment.getId(),
                    String.format("Ghi nhận khoản thu chuyển khoản %s %s VNĐ cho đơn %s do nhân viên %s thực hiện (Mã giao dịch: %s)",
                            request.getPaymentType(), request.getAmount(), booking.getBookingCode(),
                            staff.getFullName(), cleanRefCode),
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
        if (!idNumber.matches("^[A-Za-z0-9]{7,15}$")) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Số CCCD / Hộ chiếu (Passport) phải gồm từ 7 đến 15 ký tự hợp lệ");
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

    @Override
    public HandoverResponse recordCheckInInspection(CheckInInspectionRequest request) {
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
                ActivityAction.CHECKOUT_INSPECTION_COMPLETE,
                "HandoverRecord",
                record.getId(),
                String.format("Nghiệm thu hiện trường buồng kho %s đạt chuẩn kiểm định: %s",
                        unit != null ? unit.getUnitCode() : "N/A", checklistSummary),
                null,
                null
        );
        return mapToResponse(record);
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

    private void cleanupUploadedFileIfOrphan(String fileUrl) {
        if (fileStorageService != null && fileUrl != null && fileUrl.trim().startsWith("/uploads/")) {
            fileStorageService.deleteFileIfExists(fileUrl.trim());
        }
    }
}

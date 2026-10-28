package com.boxora.service.impl;

import com.boxora.dto.request.CheckInInspectionRequest;
import com.boxora.dto.request.HandoverRequest;
import com.boxora.dto.request.IdentityVerifyRequest;
import com.boxora.dto.request.ManualPaymentRecordRequest;
import com.boxora.dto.request.PaperContractCreateRequest;
import com.boxora.dto.response.FileUploadResponse;
import com.boxora.dto.response.HandoverPrerequisitesResponse;
import com.boxora.dto.response.HandoverResponse;
import com.boxora.dto.response.NotificationLogResponse;
import com.boxora.dto.response.PaymentResponse;
import com.boxora.dto.response.RentalContractResponse;
import com.boxora.dto.response.ReturnCaseResponse;
import com.boxora.dto.response.ReturnSettlementPreviewResponse;
import com.boxora.dto.response.ReturnSettlementResponse;
import org.springframework.web.multipart.MultipartFile;
import java.nio.file.Path;
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
    private final SupportTicketRepository supportTicketRepository;

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
                checkInTimeMessage = String.format("Chưa đến ngày check-in. Thời điểm đúng để thực hiện tiếp nhận kho từ: %s.",
                        expectedCheckIn.format(CHECKIN_DT_FMT));
            } else if (today.isEqual(apptDate) && now.isBefore(expectedCheckIn)) {
                checkInTimeMet = false;
                checkInTimeStatus = "BEFORE_TIME";
                checkInTimeMessage = String.format("Chưa đến giờ check-in. Thời điểm đúng để thực hiện tiếp nhận kho từ: %s.",
                        expectedCheckIn.format(CHECKIN_DT_FMT));
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

        boolean physicalPrereqsMet = missing.isEmpty();
        boolean eligibleForInspection = physicalPrereqsMet;
        boolean eligibleForCheckIn = physicalPrereqsMet && checkInTimeMet;

        List<PaymentResponse> paymentHistory = paymentRepository.findAllByBooking_Id(booking.getId()).stream()
                .sorted((a, b) -> {
                    LocalDateTime t1 = a.getPaymentTime() != null ? a.getPaymentTime() : LocalDateTime.MIN;
                    LocalDateTime t2 = b.getPaymentTime() != null ? b.getPaymentTime() : LocalDateTime.MIN;
                    return t2.compareTo(t1);
                })
                .map(paymentMapper::toResponse)
                .collect(Collectors.toList());

        UnitType effectiveUnitType = null;
        if (unit != null && unit.getUnitType() != null) {
            effectiveUnitType = unit.getUnitType();
        } else if (booking.getUnitType() != null) {
            effectiveUnitType = booking.getUnitType();
        } else if (contractOpt.isPresent() && contractOpt.get().getUnit() != null && contractOpt.get().getUnit().getUnitType() != null) {
            effectiveUnitType = contractOpt.get().getUnit().getUnitType();
        }

        Facility effectiveFacility = null;
        if (unit != null && unit.getFacility() != null) {
            effectiveFacility = unit.getFacility();
        } else if (booking.getFacility() != null) {
            effectiveFacility = booking.getFacility();
        } else if (contractOpt.isPresent() && contractOpt.get().getFacility() != null) {
            effectiveFacility = contractOpt.get().getFacility();
        }

        return HandoverPrerequisitesResponse.builder()
                .bookingId(booking.getId())
                .bookingCode(booking.getBookingCode())
                .customerName(customer != null ? customer.getFullName() : "N/A")
                .customerPhone(customer != null ? customer.getPhone() : "N/A")
                .customerEmail(customer != null ? customer.getEmail() : "N/A")
                .unitCode(unit != null ? unit.getUnitCode() : "N/A")
                .unitTypeName(effectiveUnitType != null ? effectiveUnitType.getTypeName() : null)
                .areaSqMeters(effectiveUnitType != null ? effectiveUnitType.getAreaSqm() : null)
                .unitSize(effectiveUnitType != null ? (effectiveUnitType.getDimensions() != null ? effectiveUnitType.getDimensions() : effectiveUnitType.getTypeName()) : null)
                .facilityName(effectiveFacility != null ? effectiveFacility.getName() : "N/A")
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
                .eligibleForInspection(eligibleForInspection)
                .eligibleForCheckIn(eligibleForCheckIn)
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
        UUID facilityId = null;
        if (previousUnit != null && previousUnit.getFacility() != null) {
            facilityId = previousUnit.getFacility().getId();
        } else if (booking.getFacility() != null) {
            facilityId = booking.getFacility().getId();
        } else {
            Optional<RentalContract> contractOpt = rentalContractRepository.findByBookingId(booking.getId());
            if (contractOpt.isPresent() && contractOpt.get().getFacility() != null) {
                facilityId = contractOpt.get().getFacility().getId();
            }
        }
        if (facilityId == null) {
            throw new AppException(ErrorCode.STORAGE_UNIT_NOT_FOUND, "Không xác định được cơ sở của đơn đặt kho.");
        }
        facilityAccessGuard.checkFacilityAccess(facilityId);

        String cleanUnitCode = unitCode.trim();
        StorageUnit selectedUnit = storageUnitRepository
                .findWithDetailsByFacilityAndUnitCodeForUpdate(facilityId, cleanUnitCode)
                .orElseThrow(() -> new AppException(ErrorCode.STORAGE_UNIT_NOT_FOUND,
                        "Không tìm thấy vị trí kho khách hàng chọn tại cơ sở này."));

        UUID contractedTypeId = null;
        if (previousUnit != null && previousUnit.getUnitType() != null) {
            contractedTypeId = previousUnit.getUnitType().getId();
        } else if (booking.getUnitType() != null) {
            contractedTypeId = booking.getUnitType().getId();
        } else {
            Optional<RentalContract> contractOpt = rentalContractRepository.findByBookingId(booking.getId());
            if (contractOpt.isPresent() && contractOpt.get().getUnit() != null && contractOpt.get().getUnit().getUnitType() != null) {
                contractedTypeId = contractOpt.get().getUnit().getUnitType().getId();
            }
        }

        if (contractedTypeId != null) {
            if (selectedUnit.getUnitType() == null || !contractedTypeId.equals(selectedUnit.getUnitType().getId())) {
                throw new AppException(ErrorCode.INVALID_REQUEST,
                        "Vị trí khách hàng chọn không cùng loại kho với đơn đặt chỗ.");
            }
        }

        boolean isOriginalUnit = previousUnit != null && selectedUnit.getId().equals(previousUnit.getId());
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

            if (previousUnit != null && previousUnit.getStatus() == UnitStatus.RESERVED) {
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

            if (today.isBefore(apptDate) || (today.isEqual(apptDate) && now.isBefore(expectedCheckIn))) {
                if (Boolean.TRUE.equals(request.getEarlyCheckInConfirmed())) {
                    log.info("[EARLY-CHECKIN] Authorized early check-in by {} for booking {}. Original expectedCheckInAt: {}",
                            staff.getFullName(), booking.getBookingCode(), expectedCheckIn);
                    String earlyReason = (request.getEarlyCheckInReason() != null && !request.getEarlyCheckInReason().isBlank())
                            ? request.getEarlyCheckInReason().trim()
                            : "Khách cần nhận kho gấp, cơ sở đủ điều kiện phục vụ";
                    String roleName = (staff.getRole() != null && staff.getRole().getName() != null)
                            ? staff.getRole().getName()
                            : "STAFF";
                    String earlyNote = String.format("[EARLY_CHECKIN][%s] Tiếp nhận sớm bởi %s (%s). Lý do: %s. Lịch hẹn gốc giữ nguyên: %s.\n",
                            LocalDateTime.now(), staff.getFullName(), roleName, earlyReason,
                            expectedCheckIn.format(CHECKIN_DT_FMT));
                    booking.setStepTransitionHistory((booking.getStepTransitionHistory() != null ? booking.getStepTransitionHistory() : "") + earlyNote);
                } else {
                    if (today.isBefore(apptDate)) {
                        log.warn("[CHECKIN-DATE] Handover check-in rejected for booking {}. Today {} is before expected check-in date {}",
                                booking.getBookingCode(), today, apptDate);
                        throw new AppException(ErrorCode.HANDOVER_BEFORE_CHECKIN_DATE,
                                String.format("Chưa đến ngày check-in. Thời điểm đúng để thực hiện tiếp nhận kho từ: %s.",
                                        expectedCheckIn.format(CHECKIN_DT_FMT)));
                    } else {
                        log.warn("[CHECKIN-TIME] Handover check-in rejected for booking {}. Current time {} is before expected check-in time {}",
                                booking.getBookingCode(), now, expectedCheckIn);
                        throw new AppException(ErrorCode.HANDOVER_BEFORE_CHECKIN_TIME,
                                String.format("Chưa đến giờ check-in. Thời điểm đúng để thực hiện tiếp nhận kho từ: %s.",
                                        expectedCheckIn.format(CHECKIN_DT_FMT)));
                    }
                }
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
                .inspectionStatus(r.getInspectionStatus())
                .approvalStatus(r.getApprovalStatus())
                .additionalAmountDue(r.getAdditionalAmountDue())
                .additionalPaymentStatus(r.getAdditionalPaymentStatus())
                .refundStatus(r.getRefundStatus())
                .doorConditionPassed(r.getDoorConditionPassed())
                .cleanlinessPassed(r.getCleanlinessPassed())
                .wallStructurePassed(r.getWallStructurePassed())
                .smartLockPassed(r.getSmartLockPassed())
                .assetsClearedPassed(r.getAssetsClearedPassed())
                .sensorPassed(r.getSensorPassed())
                .smartLockIssueType(r.getSmartLockIssueType())
                .unitReturnedPhysically(r.getPhysicalHandoverConfirmed())
                .returnedAt(r.getPhysicalHandoverAt())
                .accessRevoked(Boolean.TRUE.equals(r.getAccessRevoked()))
                .accessRevokedAt(r.getAccessRevokedAt())
                .scheduledInspectionAt(r.getScheduledInspectionAt())
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

            if (!"BANK_TRANSFER".equals(method) && !"CASH".equals(method)) {
                throw new AppException(ErrorCode.INVALID_PAYMENT_METHOD, "Hệ thống chỉ chấp nhận phương thức tiền mặt (CASH) hoặc chuyển khoản ngân hàng (BANK_TRANSFER) tại quầy");
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

            Payment payment;
            if ("CASH".equals(method)) {
                String cleanVoucherCode = request.getReceiptVoucherCode() != null && !request.getReceiptVoucherCode().isBlank()
                        ? request.getReceiptVoucherCode().trim()
                        : null;
                if (cleanVoucherCode == null) {
                    throw new AppException(ErrorCode.INVALID_REQUEST, "Thu tiền mặt bắt buộc nhập mã phiếu thu");
                }
                if (paymentRepository.existsByReceiptVoucherCodeIgnoreCase(cleanVoucherCode)) {
                    throw new AppException(ErrorCode.PAYMENT_ALREADY_PROCESSED, "Mã phiếu thu " + cleanVoucherCode + " đã tồn tại trong hệ thống");
                }
                String txnId = "CASH-" + booking.getBookingCode() + "-" + System.currentTimeMillis()
                        + "-" + UUID.randomUUID().toString().substring(0, 4).toUpperCase();
                payment = Payment.builder()
                        .transactionId(txnId)
                        .booking(booking)
                        .amount(request.getAmount())
                        .paymentType(request.getPaymentType())
                        .paymentMethod("CASH")
                        .paymentTime(LocalDateTime.now())
                        .collectedByStaff(staff)
                        .receiptVoucherCode(cleanVoucherCode)
                        .referenceCode(null)
                        .proofDocumentUrl(null)
                        .paymentNotes(request.getNotes() != null ? request.getNotes().trim() : null)
                        .status(PaymentStatus.PAID)
                        .confirmedByStaff(staff)
                        .confirmedAt(LocalDateTime.now())
                        .build();
            } else {
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

                payment = Payment.builder()
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
            }

            payment = paymentRepository.save(payment);

            UUID facilityId = (unit != null && unit.getFacility() != null) ? unit.getFacility().getId() : null;
            String refOrVoucher = payment.getReferenceCode() != null ? payment.getReferenceCode() : payment.getReceiptVoucherCode();
            activityLogService.record(
                    facilityId,
                    ActivityAction.PAYMENT_INITIATED,
                    "Payment",
                    payment.getId(),
                    String.format("Ghi nhận khoản thu %s %s VNĐ cho đơn %s do nhân viên %s thực hiện (Mã: %s)",
                            payment.getPaymentMethod(), request.getAmount(), booking.getBookingCode(),
                            staff.getFullName(), refOrVoucher),
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

    @Override
    @Transactional(readOnly = true)
    public List<ReturnCaseResponse> getReturnCases(
            UUID facilityId,
            String search,
            String status,
            LocalDate dateFrom,
            LocalDate dateTo
    ) {
        if (facilityId != null) {
            facilityAccessGuard.checkFacilityAccess(facilityId);
        } else if (facilityAccessGuard.isFacilityScoped()) {
            User staff = resolveStaff(null);
            if (staff != null && staff.getFacility() != null) {
                facilityId = staff.getFacility().getId();
            }
        }

        List<Booking> bookings = bookingRepository.findAll();
        final UUID finalFacId = facilityId;

        return bookings.stream()
                .filter(b -> {
                    if (finalFacId != null) {
                        if (b.getStorageUnit() == null || b.getStorageUnit().getFacility() == null
                                || !finalFacId.equals(b.getStorageUnit().getFacility().getId())) {
                            return false;
                        }
                    }
                    return b.getStatus() == BookingStatus.CHECKOUT_REQUESTED
                            || b.getStatus() == BookingStatus.INSPECTED
                            || (b.getStatus() == BookingStatus.COMPLETED && b.getReturnTime() != null)
                            || (b.getStatus() == BookingStatus.ACTIVE && (b.getReturnTime() != null || b.getEndDate() != null))
                            || !handoverRecordRepository.findByBooking_Id(b.getId()).isEmpty();
                })
                .map(this::buildReturnCaseResponse)
                .filter(c -> {
                    if (c == null) return false;
                    if (search != null && !search.isBlank()) {
                        String s = search.trim().toLowerCase();
                        boolean match = (c.getBookingCode() != null && c.getBookingCode().toLowerCase().contains(s))
                                || (c.getCustomerName() != null && c.getCustomerName().toLowerCase().contains(s))
                                || (c.getCustomerPhone() != null && c.getCustomerPhone().contains(s))
                                || (c.getUnitCode() != null && c.getUnitCode().toLowerCase().contains(s))
                                || (c.getContractCode() != null && c.getContractCode().toLowerCase().contains(s));
                        if (!match) return false;
                    }
                    if (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status)) {
                        boolean statusMatch = status.equalsIgnoreCase(c.getStatus())
                                || status.equalsIgnoreCase(c.getInspectionStatus())
                                || status.equalsIgnoreCase(c.getApprovalStatus())
                                || status.equalsIgnoreCase(c.getAdditionalPaymentStatus())
                                || status.equalsIgnoreCase(c.getRefundStatus());
                        if (!statusMatch) return false;
                    }
                    if (dateFrom != null && c.getRequestDate() != null && c.getRequestDate().isBefore(dateFrom)) {
                        return false;
                    }
                    if (dateTo != null && c.getRequestDate() != null && c.getRequestDate().isAfter(dateTo)) {
                        return false;
                    }
                    return true;
                })
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public ReturnCaseResponse getReturnCaseDetail(UUID bookingId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        if (booking.getStorageUnit() != null && booking.getStorageUnit().getFacility() != null) {
            facilityAccessGuard.checkFacilityAccess(booking.getStorageUnit().getFacility().getId());
        }

        return buildReturnCaseResponse(booking);
    }

    private ReturnCaseResponse buildReturnCaseResponse(Booking booking) {
        if (booking == null) return null;
        StorageUnit unit = booking.getStorageUnit();
        Facility fac = unit != null ? unit.getFacility() : null;
        User customer = booking.getCustomer();
        Optional<RentalContract> contractOpt = rentalContractRepository.findByBookingId(booking.getId());

        List<HandoverRecord> records = handoverRecordRepository.findByBooking_IdOrderByRecordedAtDesc(booking.getId());
        HandoverRecord latestRecord = records.isEmpty() ? null : records.get(0);
        HandoverRecord inspectionRecord = records.stream()
                .filter(r -> "INSPECTION".equalsIgnoreCase(r.getRecordType()) || "CHECK_OUT".equalsIgnoreCase(r.getRecordType()))
                .findFirst()
                .orElse(latestRecord);

        BigDecimal depositAmount = calculateTotalDepositPaid(booking);
        BigDecimal overdueDebt = calculateOverdueDebtForBooking(booking);

        List<String> photoUrls = List.of();
        if (inspectionRecord != null && inspectionRecord.getEvidencePhotos() != null && !inspectionRecord.getEvidencePhotos().isBlank()) {
            photoUrls = Arrays.stream(inspectionRecord.getEvidencePhotos().split(";"))
                    .filter(s -> !s.isBlank())
                    .collect(Collectors.toList());
        }

        Boolean doorPassed = inspectionRecord != null ? inspectionRecord.getDoorConditionPassed() : null;
        Boolean cleanPassed = inspectionRecord != null ? inspectionRecord.getCleanlinessPassed() : null;
        Boolean wallPassed = inspectionRecord != null ? inspectionRecord.getWallStructurePassed() : null;
        Boolean lockPassed = inspectionRecord != null ? inspectionRecord.getSmartLockPassed() : null;
        Boolean assetsPassed = inspectionRecord != null ? inspectionRecord.getAssetsClearedPassed() : null;
        Boolean sensorPassed = inspectionRecord != null ? inspectionRecord.getSensorPassed() : null;

        BigDecimal doorFee = inspectionRecord != null && inspectionRecord.getDoorFee() != null ? inspectionRecord.getDoorFee() : BigDecimal.ZERO;
        BigDecimal cleanFee = inspectionRecord != null && inspectionRecord.getCleanlinessFee() != null ? inspectionRecord.getCleanlinessFee() : BigDecimal.ZERO;
        BigDecimal wallFee = inspectionRecord != null && inspectionRecord.getWallStructureFee() != null ? inspectionRecord.getWallStructureFee() : BigDecimal.ZERO;
        BigDecimal lockFee = inspectionRecord != null && inspectionRecord.getSmartLockFee() != null ? inspectionRecord.getSmartLockFee() : BigDecimal.ZERO;
        BigDecimal lostCardFee = inspectionRecord != null && inspectionRecord.getLostCardFee() != null ? inspectionRecord.getLostCardFee() : BigDecimal.ZERO;
        String lockIssueType = inspectionRecord != null ? inspectionRecord.getSmartLockIssueType() : null;

        BigDecimal effectiveLockFee = "CUSTOMER_FAULT".equalsIgnoreCase(lockIssueType) ? lockFee : BigDecimal.ZERO;
        BigDecimal proposedDeductions = doorFee.add(cleanFee).add(wallFee).add(effectiveLockFee).add(lostCardFee).add(overdueDebt);

        BigDecimal approvedDeductions = (inspectionRecord != null && "APPROVED".equalsIgnoreCase(inspectionRecord.getApprovalStatus()))
                ? (inspectionRecord.getApprovedDeductions() != null ? inspectionRecord.getApprovedDeductions() : proposedDeductions)
                : BigDecimal.ZERO;

        BigDecimal effectiveDeductions = "APPROVED".equalsIgnoreCase(inspectionRecord != null ? inspectionRecord.getApprovalStatus() : null)
                ? approvedDeductions : proposedDeductions;

        BigDecimal netRefund = depositAmount.subtract(effectiveDeductions).max(BigDecimal.ZERO);
        BigDecimal additionalDue = effectiveDeductions.subtract(depositAmount).max(BigDecimal.ZERO);

        String inspStatus = inspectionRecord != null && inspectionRecord.getInspectionStatus() != null
                ? inspectionRecord.getInspectionStatus()
                : (booking.getStatus() == BookingStatus.INSPECTED ? "COMPLETED" : "PENDING");

        String approvalStatus = inspectionRecord != null && inspectionRecord.getApprovalStatus() != null
                ? inspectionRecord.getApprovalStatus() : "NONE";

        String addPaymentStatus = inspectionRecord != null && inspectionRecord.getAdditionalPaymentStatus() != null
                ? inspectionRecord.getAdditionalPaymentStatus() : "NONE";

        String refStatus = inspectionRecord != null && inspectionRecord.getRefundStatus() != null
                ? inspectionRecord.getRefundStatus() : "NONE";

        LocalDate reqDate = booking.getCreatedAt() != null ? booking.getCreatedAt().toLocalDate() : LocalDate.now();

        List<String> historyNotes = new ArrayList<>();
        if (booking.getStepTransitionHistory() != null && !booking.getStepTransitionHistory().isBlank()) {
            historyNotes.addAll(Arrays.asList(booking.getStepTransitionHistory().split("\n")));
        }

        // Lấy lý do trả kho chính xác từ yêu cầu của khách hàng trong DB:
        // 1. Kiểm tra ticket từ Trung tâm hỗ trợ (SupportTicket) gửi từ phía khách hàng
        String returnReason = null;
        if (supportTicketRepository != null) {
            List<SupportTicket> tickets = supportTicketRepository.findByBooking_IdOrderByCreatedAtDesc(booking.getId());
            if (tickets.isEmpty() && booking.getStorageUnit() != null) {
                tickets = supportTicketRepository.findByStorageUnit_IdOrderByCreatedAtDesc(booking.getStorageUnit().getId());
            }

            // Ưu tiên 1: Ticket yêu cầu trả kho (RETURN_REFUND hoặc RETURN_EXPIRED)
            Optional<SupportTicket> returnTicket = tickets.stream()
                    .filter(t -> t.getCategory() == TicketCategory.RETURN_REFUND || t.getCategory() == TicketCategory.RETURN_EXPIRED)
                    .findFirst();

            if (returnTicket.isPresent()) {
                SupportTicket t = returnTicket.get();
                if (t.getDescription() != null && !t.getDescription().isBlank()) {
                    returnReason = t.getDescription().trim();
                } else if (t.getTitle() != null && !t.getTitle().isBlank()) {
                    returnReason = t.getTitle().trim();
                }
            }

            // Ưu tiên 2: Nếu chưa tìm thấy nhưng có ticket liên quan trả kho
            if (returnReason == null || returnReason.isBlank()) {
                for (SupportTicket t : tickets) {
                    String desc = t.getDescription() != null ? t.getDescription().toLowerCase() : "";
                    String tit = t.getTitle() != null ? t.getTitle().toLowerCase() : "";
                    if (desc.contains("trả kho") || desc.contains("hoàn cọc") || desc.contains("thanh lý") || desc.contains("kết thúc hợp đồng")
                            || tit.contains("trả kho") || tit.contains("hoàn cọc") || tit.contains("thanh lý")) {
                        returnReason = (t.getDescription() != null && !t.getDescription().isBlank()) ? t.getDescription().trim() : t.getTitle().trim();
                        break;
                    }
                }
            }
        }

        // 2. Kiểm tra biên bản yêu cầu trả kho từ phía khách hàng (HandoverRecord loại CHECKOUT_REQUEST)
        if (returnReason == null || returnReason.isBlank()) {
            Optional<HandoverRecord> checkoutReq = records.stream()
                    .filter(r -> "CHECKOUT_REQUEST".equalsIgnoreCase(r.getRecordType()) && r.getNotes() != null && !r.getNotes().isBlank())
                    .findFirst();
            if (checkoutReq.isPresent()) {
                returnReason = checkoutReq.get().getNotes().trim();
            }
        }

        // 3. Kiểm tra cancellationReason của đơn đặt kho (Booking)
        if (returnReason == null || returnReason.isBlank()) {
            if (booking.getCancellationReason() != null && !booking.getCancellationReason().isBlank()) {
                returnReason = booking.getCancellationReason().trim();
            }
        }

        // 4. Mặc định theo nghiệp vụ Boxora: "Khách hàng kết thúc hợp đồng thuê kho"
        if (returnReason == null || returnReason.isBlank()) {
            returnReason = "Khách hàng kết thúc hợp đồng thuê kho";
        }

        String caseStatus = "RETURN_REQUESTED";
        if (booking.getStatus() == BookingStatus.COMPLETED && (inspectionRecord == null || !"PENDING".equalsIgnoreCase(inspectionRecord.getRefundStatus()))) {
            caseStatus = "COMPLETED";
        } else if ("COMPLETED".equalsIgnoreCase(refStatus) || "REFUNDED".equalsIgnoreCase(refStatus)) {
            caseStatus = "REFUNDED";
        } else if ("PROCESSING".equalsIgnoreCase(refStatus) || "REFUND_PROCESSING".equalsIgnoreCase(refStatus)) {
            caseStatus = "REFUND_PROCESSING";
        } else if ("APPROVED".equalsIgnoreCase(approvalStatus) || "REFUND_APPROVED".equalsIgnoreCase(approvalStatus)) {
            caseStatus = "REFUND_APPROVED";
        } else if ("PENDING".equalsIgnoreCase(approvalStatus) || "REFUND_PENDING_APPROVAL".equalsIgnoreCase(approvalStatus)) {
            caseStatus = "REFUND_PENDING_APPROVAL";
        } else if ("ISSUE".equalsIgnoreCase(inspStatus) || "INSPECTION_ISSUE".equalsIgnoreCase(inspStatus)) {
            caseStatus = "INSPECTION_ISSUE";
        } else if ("PASSED".equalsIgnoreCase(inspStatus) || "INSPECTION_PASSED".equalsIgnoreCase(inspStatus) || booking.getStatus() == BookingStatus.INSPECTED) {
            caseStatus = "INSPECTION_PASSED";
        } else if ("IN_PROGRESS".equalsIgnoreCase(inspStatus) || "INSPECTION_IN_PROGRESS".equalsIgnoreCase(inspStatus) || "INSPECTING".equalsIgnoreCase(inspStatus)) {
            caseStatus = "INSPECTION_IN_PROGRESS";
        } else if ("SCHEDULED".equalsIgnoreCase(inspStatus) || "INSPECTION_SCHEDULED".equalsIgnoreCase(inspStatus)
                || (inspectionRecord != null && inspectionRecord.getScheduledInspectionAt() != null && !"COMPLETED".equalsIgnoreCase(inspStatus))) {
            caseStatus = "INSPECTION_SCHEDULED";
        } else if (booking.getStatus() == BookingStatus.CHECKOUT_REQUESTED) {
            caseStatus = "RETURN_REQUESTED";
        }

        return ReturnCaseResponse.builder()
                .id(booking.getId().toString())
                .bookingId(booking.getId())
                .bookingCode(booking.getBookingCode())
                .contractCode(contractOpt.map(RentalContract::getContractCode).orElse("N/A"))
                .unitCode(unit != null ? unit.getUnitCode() : "N/A")
                .customerName(customer != null ? customer.getFullName() : "N/A")
                .customerPhone(customer != null ? customer.getPhone() : "")
                .customerEmail(customer != null ? customer.getEmail() : "")
                .facilityId(fac != null ? fac.getId() : null)
                .facilityName(fac != null ? fac.getName() : "N/A")
                .requestDate(reqDate)
                .expectedReturnDate(booking.getEndDate())
                .inspectionDate(inspectionRecord != null ? inspectionRecord.getScheduledInspectionAt() : null)
                .reason(returnReason)
                .depositAmount(depositAmount)
                .outstandingDebt(overdueDebt)
                .cleaningFee(cleanFee)
                .damageFee(wallFee)
                .doorFee(doorFee)
                .smartLockFee(lockFee)
                .wallStructureFee(wallFee)
                .lostCardFee(lostCardFee)
                .totalDeduction(proposedDeductions)
                .approvedDeductions(approvedDeductions)
                .netRefundAmount(netRefund)
                .additionalAmountDue(additionalDue)
                .status(caseStatus)
                .inspectionStatus(inspStatus)
                .approvalStatus(approvalStatus)
                .additionalPaymentStatus(addPaymentStatus)
                .additionalPaymentTxnRef(inspectionRecord != null ? inspectionRecord.getAdditionalPaymentTxnRef() : null)
                .refundStatus(refStatus)
                .refundTxnRef(inspectionRecord != null ? inspectionRecord.getRefundTxnRef() : null)
                .refundProcessedAt(inspectionRecord != null ? inspectionRecord.getRefundProcessedAt() : null)
                .inspectorName(inspectionRecord != null && inspectionRecord.getStaff() != null ? inspectionRecord.getStaff().getFullName() : null)
                .approverName(inspectionRecord != null && inspectionRecord.getApprovedBy() != null ? inspectionRecord.getApprovedBy().getFullName() : null)
                .approvedAt(inspectionRecord != null ? inspectionRecord.getApprovedAt() : null)
                .approvalNotes(inspectionRecord != null ? inspectionRecord.getApprovalNotes() : null)
                .completedAt(booking.getReturnTime())
                .historyNotes(historyNotes)
                .doorPassed(doorPassed)
                .doorNotes(inspectionRecord != null ? inspectionRecord.getDoorNotes() : null)
                .doorFeeInput(doorFee)
                .cleanlinessPassed(cleanPassed)
                .cleanlinessNotes(inspectionRecord != null ? inspectionRecord.getCleanlinessNotes() : null)
                .cleaningFeeInput(cleanFee)
                .damagePassed(wallPassed)
                .damageNotes(inspectionRecord != null ? inspectionRecord.getWallStructureNotes() : null)
                .damageFeeInput(wallFee)
                .smartLockPassed(lockPassed)
                .smartLockNotes(inspectionRecord != null ? inspectionRecord.getSmartLockNotes() : null)
                .smartLockFeeInput(lockFee)
                .smartLockIssueType(lockIssueType)
                .assetsClearedPassed(assetsPassed)
                .assetsClearedNotes(inspectionRecord != null ? inspectionRecord.getAssetsClearedNotes() : null)
                .photoUrls(photoUrls)
                .envPassed(sensorPassed)
                .envNotes(inspectionRecord != null ? inspectionRecord.getSensorNotes() : null)
                .unitReturnedPhysically(inspectionRecord != null ? inspectionRecord.getPhysicalHandoverConfirmed() : false)
                .returnedAt(inspectionRecord != null ? inspectionRecord.getPhysicalHandoverAt() : null)
                .accessRevoked(inspectionRecord != null ? Boolean.TRUE.equals(inspectionRecord.getAccessRevoked()) : false)
                .accessRevokedAt(inspectionRecord != null ? inspectionRecord.getAccessRevokedAt() : null)
                .postReturnUnitStatus(unit != null ? unit.getStatus().name() : "N/A")
                .build();
    }

    private BigDecimal calculateOverdueDebtForBooking(Booking booking) {
        if (booking == null) return BigDecimal.ZERO;
        StorageUnit unit = booking.getStorageUnit();
        Facility facility = unit != null ? unit.getFacility() : null;
        if (facility == null) return BigDecimal.ZERO;

        Optional<FacilityPolicy> policyOpt = facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(facility.getId());
        if (policyOpt.isEmpty()) return BigDecimal.ZERO;

        FacilityPolicy policy = policyOpt.get();
        BigDecimal dailyLateFee = policy.getDailyLateFee() != null ? policy.getDailyLateFee() : BigDecimal.ZERO;
        int overdueGraceDays = policy.getOverdueGraceDays() != null ? policy.getOverdueGraceDays() : 0;

        LocalDate today = LocalDate.now();
        LocalDate endDate = booking.getEndDate();
        if (endDate != null && today.isAfter(endDate)) {
            long overdueDays = ChronoUnit.DAYS.between(endDate, today);
            long billableDays = Math.max(0, overdueDays - overdueGraceDays);
            if (billableDays > 0) {
                return dailyLateFee.multiply(BigDecimal.valueOf(billableDays));
            }
        }
        return BigDecimal.ZERO;
    }

    @Override
    public HandoverResponse scheduleInspection(UUID bookingId, LocalDateTime scheduledAt, String notes) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        if (booking.getStatus() == BookingStatus.COMPLETED || booking.getStatus() == BookingStatus.CANCELLED) {
            throw new AppException(ErrorCode.RETURN_ALREADY_COMPLETED);
        }

        StorageUnit unit = booking.getStorageUnit();
        if (unit != null && unit.getFacility() != null) {
            facilityAccessGuard.checkFacilityAccess(unit.getFacility().getId());
        }

        User staff = requireAuthorizedStaffOperator(null);

        HandoverRecord record = handoverRecordRepository.findByBooking_IdOrderByRecordedAtDesc(booking.getId())
                .stream().findFirst().orElseGet(() -> HandoverRecord.builder()
                        .booking(booking)
                        .staff(staff)
                        .recordType("INSPECTION")
                        .recordedAt(LocalDateTime.now())
                        .build());

        record.setScheduledInspectionAt(scheduledAt);
        record.setInspectionStatus("SCHEDULED");
        if (notes != null && !notes.isBlank()) {
            record.setNotes(notes);
        }
        record = handoverRecordRepository.save(record);

        String logMsg = String.format("[%s] Nhân viên %s xác nhận lịch hẹn nghiệm thu hiện trường vào lúc %s. Ghi chú: %s\n",
                LocalDateTime.now().format(CHECKIN_DT_FMT), staff.getFullName(),
                scheduledAt != null ? scheduledAt.format(CHECKIN_DT_FMT) : "Chưa hẹn",
                notes != null ? notes : "Không");
        booking.setStepTransitionHistory((booking.getStepTransitionHistory() != null ? booking.getStepTransitionHistory() : "") + logMsg);
        bookingRepository.save(booking);

        activityLogService.record(
                unit != null && unit.getFacility() != null ? unit.getFacility().getId() : null,
                ActivityAction.CHECKOUT_INSPECTION_COMPLETE,
                "HandoverRecord",
                record.getId(),
                String.format("Xác nhận lịch nghiệm thu đơn %s: %s", booking.getBookingCode(), scheduledAt),
                booking.getStatus(),
                booking.getStatus()
        );

        return mapToResponse(record);
    }

    @Override
    public HandoverResponse startInspection(UUID bookingId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        if (booking.getStatus() == BookingStatus.COMPLETED || booking.getStatus() == BookingStatus.CANCELLED) {
            throw new AppException(ErrorCode.RETURN_ALREADY_COMPLETED);
        }

        StorageUnit unit = booking.getStorageUnit();
        if (unit != null && unit.getFacility() != null) {
            facilityAccessGuard.checkFacilityAccess(unit.getFacility().getId());
        }

        User staff = requireAuthorizedStaffOperator(null);

        HandoverRecord record = handoverRecordRepository.findByBooking_IdOrderByRecordedAtDesc(booking.getId())
                .stream().findFirst().orElseGet(() -> HandoverRecord.builder()
                        .booking(booking)
                        .staff(staff)
                        .recordType("INSPECTION")
                        .recordedAt(LocalDateTime.now())
                        .build());

        record.setInspectionStatus("IN_PROGRESS");
        record = handoverRecordRepository.save(record);

        booking.setStatus(BookingStatus.INSPECTED);
        String logMsg = String.format("[%s] Nhân viên %s bắt đầu nghiệm thu hiện trường.\n",
                LocalDateTime.now().format(CHECKIN_DT_FMT), staff.getFullName());
        booking.setStepTransitionHistory((booking.getStepTransitionHistory() != null ? booking.getStepTransitionHistory() : "") + logMsg);
        bookingRepository.save(booking);

        activityLogService.record(
                unit != null && unit.getFacility() != null ? unit.getFacility().getId() : null,
                ActivityAction.CHECKOUT_INSPECTION_COMPLETE,
                "Booking",
                booking.getId(),
                String.format("Bắt đầu nghiệm thu hiện trường ô kho %s đơn %s",
                        unit != null ? unit.getUnitCode() : "N/A", booking.getBookingCode()),
                BookingStatus.CHECKOUT_REQUESTED,
                BookingStatus.INSPECTED
        );

        return mapToResponse(record);
    }

    @Override
    public HandoverResponse saveInspection(HandoverRequest request) {
        if (request.getBookingId() == null) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Mã đơn đặt kho không được để trống");
        }
        Booking booking = bookingRepository.findById(request.getBookingId())
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        if (booking.getStatus() == BookingStatus.COMPLETED || booking.getStatus() == BookingStatus.CANCELLED) {
            throw new AppException(ErrorCode.RETURN_ALREADY_COMPLETED);
        }

        StorageUnit unit = booking.getStorageUnit();
        if (unit != null && unit.getFacility() != null) {
            facilityAccessGuard.checkFacilityAccess(unit.getFacility().getId());
        }

        User staff = requireAuthorizedStaffOperator(null);
        boolean isDraft = Boolean.TRUE.equals(request.getIsDraft());

        List<String> photos = request.getEvidencePhotos() != null ? request.getEvidencePhotos().stream()
                .filter(url -> url != null && !url.isBlank())
                .distinct()
                .collect(Collectors.toList()) : List.of();

        if (!isDraft) {
            // Nghiệm thu chính thức: Kiểm tra 7 tiêu chí không null
            if (request.getDoorConditionPassed() == null
                    || request.getCleanlinessPassed() == null
                    || request.getWallStructurePassed() == null
                    || request.getSmartLockPassed() == null
                    || request.getAssetsClearedPassed() == null
                    || request.getSensorPassed() == null) {
                throw new AppException(ErrorCode.RETURN_INSPECTION_CHECKLIST_INCOMPLETE,
                        "Bắt buộc kiểm tra đầy đủ 7 tiêu chí hiện trường trước khi chốt biên bản nghiệm thu");
            }
            if (photos.size() < 2) {
                throw new AppException(ErrorCode.RETURN_PHOTO_COUNT_INSUFFICIENT,
                        "Biên bản nghiệm thu hiện trường yêu cầu tối thiểu 2 ảnh thực tế (ảnh toàn cảnh và chi tiết hư hại)");
            }
            // Tiêu chí 5: Dọn sạch đồ đạc. Nếu chưa dọn thì không thể chốt nghiệm thu đạt chuẩn
            if (Boolean.FALSE.equals(request.getAssetsClearedPassed())) {
                boolean wantsToPassAll = Boolean.TRUE.equals(request.getDoorConditionPassed())
                        && Boolean.TRUE.equals(request.getCleanlinessPassed())
                        && Boolean.TRUE.equals(request.getWallStructurePassed())
                        && Boolean.TRUE.equals(request.getSmartLockPassed())
                        && Boolean.TRUE.equals(request.getSensorPassed());
                if (wantsToPassAll) {
                    throw new AppException(ErrorCode.RETURN_ASSETS_NOT_CLEARED,
                            "Khách hàng chưa lấy hết đồ đạc ra khỏi kho. Không thể xác nhận nghiệm thu đạt chuẩn.");
                }
            }
        }

        HandoverRecord record = handoverRecordRepository.findByBooking_IdOrderByRecordedAtDesc(booking.getId())
                .stream()
                .filter(r -> "INSPECTION".equalsIgnoreCase(r.getRecordType()) || "CHECK_OUT".equalsIgnoreCase(r.getRecordType()))
                .findFirst()
                .orElseGet(() -> HandoverRecord.builder()
                        .booking(booking)
                        .staff(staff)
                        .recordType("INSPECTION")
                        .recordedAt(LocalDateTime.now())
                        .build());

        record.setDoorConditionPassed(request.getDoorConditionPassed());
        record.setDoorFee(request.getDoorFee() != null ? request.getDoorFee() : BigDecimal.ZERO);
        record.setDoorNotes(request.getDoorNotes());

        record.setCleanlinessPassed(request.getCleanlinessPassed());
        record.setCleanlinessFee(request.getCleaningFee() != null ? request.getCleaningFee() : BigDecimal.ZERO);
        record.setCleanlinessNotes(request.getCleanlinessNotes());

        record.setWallStructurePassed(request.getWallStructurePassed());
        record.setWallStructureFee(request.getDamageFee() != null ? request.getDamageFee() : BigDecimal.ZERO);
        record.setWallStructureNotes(request.getDamageNotes());

        record.setSmartLockPassed(request.getSmartLockPassed());
        record.setSmartLockFee(request.getSmartLockFee() != null ? request.getSmartLockFee() : BigDecimal.ZERO);
        record.setSmartLockNotes(request.getSmartLockNotes());
        record.setSmartLockIssueType(request.getSmartLockIssueType() != null ? request.getSmartLockIssueType() : "PENDING_VERIFICATION");

        record.setAssetsClearedPassed(request.getAssetsClearedPassed());
        record.setAssetsClearedNotes(request.getAssetsClearedNotes());

        record.setSensorPassed(request.getSensorPassed());
        record.setSensorNotes(request.getSensorNotes());

        record.setLostCardFee(request.getLostCardFee() != null ? request.getLostCardFee() : BigDecimal.ZERO);
        record.setEvidencePhotos(String.join(";", photos));
        record.setNotes(request.getNotes());
        record.setInspectionStatus(isDraft ? "DRAFT" : "COMPLETED");

        BigDecimal cleanFee = Boolean.TRUE.equals(record.getCleanlinessPassed()) ? BigDecimal.ZERO : (record.getCleanlinessFee() != null ? record.getCleanlinessFee() : BigDecimal.ZERO);
        BigDecimal wallFee = Boolean.TRUE.equals(record.getWallStructurePassed()) ? BigDecimal.ZERO : (record.getWallStructureFee() != null ? record.getWallStructureFee() : BigDecimal.ZERO);
        BigDecimal doorFee = Boolean.TRUE.equals(record.getDoorConditionPassed()) ? BigDecimal.ZERO : (record.getDoorFee() != null ? record.getDoorFee() : BigDecimal.ZERO);
        String lockIssue = record.getSmartLockIssueType() != null ? record.getSmartLockIssueType() : "PENDING_VERIFICATION";
        BigDecimal lockFee = Boolean.TRUE.equals(record.getSmartLockPassed()) ? BigDecimal.ZERO : ("CUSTOMER_FAULT".equalsIgnoreCase(lockIssue) ? (record.getSmartLockFee() != null ? record.getSmartLockFee() : BigDecimal.ZERO) : BigDecimal.ZERO);
        BigDecimal lostFee = record.getLostCardFee() != null ? record.getLostCardFee() : BigDecimal.ZERO;
        record.setDeductionAmount(cleanFee.add(wallFee).add(doorFee).add(lockFee).add(lostFee));

        String checklistSummary = String.format(
                "Cửa cuốn: %s | Vệ sinh: %s | Tường vách: %s | SmartLock: %s | Dọn đồ: %s | Cảm biến: %s",
                Boolean.TRUE.equals(record.getDoorConditionPassed()) ? "Đạt" : "Không đạt",
                Boolean.TRUE.equals(record.getCleanlinessPassed()) ? "Sạch" : "Bẩn",
                Boolean.TRUE.equals(record.getWallStructurePassed()) ? "Nguyên vẹn" : "Hư hại",
                Boolean.TRUE.equals(record.getSmartLockPassed()) ? "Tốt" : "Lỗi (" + record.getSmartLockIssueType() + ")",
                Boolean.TRUE.equals(record.getAssetsClearedPassed()) ? "Đã dọn hết" : "Còn đồ",
                Boolean.TRUE.equals(record.getSensorPassed()) ? "Chuẩn" : "Lỗi"
        );
        record.setChecklistSummary(checklistSummary);
        record = handoverRecordRepository.save(record);

        if (!isDraft) {
            booking.setStatus(BookingStatus.INSPECTED);
            String logMsg = String.format("[%s] Nhân viên %s hoàn thành thẩm định hiện trường: %s\n",
                    LocalDateTime.now().format(CHECKIN_DT_FMT), staff.getFullName(), checklistSummary);
            booking.setStepTransitionHistory((booking.getStepTransitionHistory() != null ? booking.getStepTransitionHistory() : "") + logMsg);
            bookingRepository.save(booking);
        }

        activityLogService.record(
                unit != null && unit.getFacility() != null ? unit.getFacility().getId() : null,
                ActivityAction.CHECKOUT_INSPECTION_COMPLETE,
                "HandoverRecord",
                record.getId(),
                String.format("Lưu %s biên bản nghiệm thu hiện trường ô kho %s: %s",
                        isDraft ? "BẢN NHÁP" : "CHÍNH THỨC", unit != null ? unit.getUnitCode() : "N/A", checklistSummary),
                booking.getStatus(),
                booking.getStatus()
        );

        return mapToResponse(record);
    }

    @Override
    @Transactional(readOnly = true)
    public ReturnSettlementResponse calculateSettlement(UUID bookingId, HandoverRequest request) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        StorageUnit unit = booking.getStorageUnit();
        Facility facility = unit != null ? unit.getFacility() : null;
        if (facility != null) {
            facilityAccessGuard.checkFacilityAccess(facility.getId());
        }

        List<HandoverRecord> records = handoverRecordRepository.findByBooking_IdOrderByRecordedAtDesc(booking.getId());
        HandoverRecord record = records.isEmpty() ? null : records.get(0);

        BigDecimal depositPaid = calculateTotalDepositPaid(booking);
        BigDecimal overdueDebt = calculateOverdueDebtForBooking(booking);

        BigDecimal doorFee = (request != null && request.getDoorFee() != null) ? request.getDoorFee()
                : (record != null && record.getDoorFee() != null ? record.getDoorFee() : BigDecimal.ZERO);
        BigDecimal cleanFee = (request != null && request.getCleaningFee() != null) ? request.getCleaningFee()
                : (record != null && record.getCleanlinessFee() != null ? record.getCleanlinessFee() : BigDecimal.ZERO);
        BigDecimal wallFee = (request != null && request.getDamageFee() != null) ? request.getDamageFee()
                : (record != null && record.getWallStructureFee() != null ? record.getWallStructureFee() : BigDecimal.ZERO);
        BigDecimal lockFee = (request != null && request.getSmartLockFee() != null) ? request.getSmartLockFee()
                : (record != null && record.getSmartLockFee() != null ? record.getSmartLockFee() : BigDecimal.ZERO);
        BigDecimal lostCardFee = (request != null && request.getLostCardFee() != null) ? request.getLostCardFee()
                : (record != null && record.getLostCardFee() != null ? record.getLostCardFee() : BigDecimal.ZERO);

        String lockIssueType = (request != null && request.getSmartLockIssueType() != null) ? request.getSmartLockIssueType()
                : (record != null ? record.getSmartLockIssueType() : "PENDING_VERIFICATION");

        // Chi phí Smart Lock chỉ tính khi lỗi do khách (5.2)
        BigDecimal effectiveLockFee = "CUSTOMER_FAULT".equalsIgnoreCase(lockIssueType) ? lockFee : BigDecimal.ZERO;

        BigDecimal totalProposedDeductions = doorFee.add(cleanFee).add(wallFee).add(effectiveLockFee).add(lostCardFee).add(overdueDebt);

        boolean isApproved = record != null && "APPROVED".equalsIgnoreCase(record.getApprovalStatus());
        BigDecimal approvedDeductions = isApproved
                ? (record.getApprovedDeductions() != null ? record.getApprovedDeductions() : totalProposedDeductions)
                : BigDecimal.ZERO;

        BigDecimal effectiveDeductions = isApproved ? approvedDeductions.add(overdueDebt) : totalProposedDeductions;
        BigDecimal netRefund = depositPaid.subtract(effectiveDeductions).max(BigDecimal.ZERO);
        BigDecimal additionalDue = effectiveDeductions.subtract(depositPaid).max(BigDecimal.ZERO);

        FacilityPolicy policy = (facility != null)
                ? facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(facility.getId()).orElse(null)
                : null;
        int slaDays = policy != null && policy.getDepositRefundSlaDays() != null ? policy.getDepositRefundSlaDays() : 7;

        return ReturnSettlementResponse.builder()
                .handoverRecordId(record != null ? record.getId() : null)
                .bookingId(booking.getId())
                .bookingCode(booking.getBookingCode())
                .unitCode(unit != null ? unit.getUnitCode() : "N/A")
                .customerName(booking.getCustomer() != null ? booking.getCustomer().getFullName() : "N/A")
                .depositPaid(depositPaid)
                .damageFee(wallFee)
                .cleaningFee(cleanFee)
                .lostCardFee(lostCardFee)
                .doorFee(doorFee)
                .smartLockFee(lockFee)
                .smartLockIssueType(lockIssueType)
                .wallStructureFee(wallFee)
                .overdueDebt(overdueDebt)
                .totalDeduction(totalProposedDeductions)
                .approvedDeductions(approvedDeductions)
                .netRefundAmount(netRefund)
                .additionalAmountDue(additionalDue)
                .reviewStatus(totalProposedDeductions.compareTo(BigDecimal.ZERO) > 0 ? "PENDING_ACCOUNTING_REVIEW" : "AUTO_REFUND_APPROVED")
                .approvalStatus(record != null && record.getApprovalStatus() != null ? record.getApprovalStatus() : "NONE")
                .approverName(record != null && record.getApprovedBy() != null ? record.getApprovedBy().getFullName() : null)
                .approvedAt(record != null ? record.getApprovedAt() : null)
                .approvalNotes(record != null ? record.getApprovalNotes() : null)
                .additionalPaymentStatus(record != null && record.getAdditionalPaymentStatus() != null ? record.getAdditionalPaymentStatus() : "NONE")
                .additionalPaymentTxnRef(record != null ? record.getAdditionalPaymentTxnRef() : null)
                .refundStatus(record != null && record.getRefundStatus() != null ? record.getRefundStatus() : "NONE")
                .refundTransactionId(record != null ? record.getRefundTxnRef() : null)
                .depositRefundSlaDays(slaDays)
                .checklistAllPassed(record != null && Boolean.TRUE.equals(record.getChecklistAllPassed()))
                .checklistSummary(record != null ? record.getChecklistSummary() : "")
                .doorConditionPassed(record != null ? record.getDoorConditionPassed() : null)
                .cleanlinessPassed(record != null ? record.getCleanlinessPassed() : null)
                .wallStructurePassed(record != null ? record.getWallStructurePassed() : null)
                .smartLockPassed(record != null ? record.getSmartLockPassed() : null)
                .assetsClearedPassed(record != null ? record.getAssetsClearedPassed() : null)
                .sensorPassed(record != null ? record.getSensorPassed() : null)
                .unitReturnedPhysically(record != null ? record.getPhysicalHandoverConfirmed() : false)
                .returnedAt(record != null ? record.getPhysicalHandoverAt() : null)
                .accessRevoked(record != null ? Boolean.TRUE.equals(record.getAccessRevoked()) : false)
                .accessRevokedAt(record != null ? record.getAccessRevokedAt() : null)
                .build();
    }

    @Override
    public HandoverResponse submitDeductionsForApproval(UUID bookingId, String notes) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        StorageUnit unit = booking.getStorageUnit();
        if (unit != null && unit.getFacility() != null) {
            facilityAccessGuard.checkFacilityAccess(unit.getFacility().getId());
        }

        User staff = requireAuthorizedStaffOperator(null);

        HandoverRecord record = handoverRecordRepository.findByBooking_IdOrderByRecordedAtDesc(booking.getId())
                .stream().findFirst().orElseThrow(() -> new AppException(ErrorCode.RETURN_NOT_INSPECTED));

        if ("DRAFT".equalsIgnoreCase(record.getInspectionStatus())) {
            throw new AppException(ErrorCode.RETURN_NOT_INSPECTED, "Không thể trình duyệt biên bản nghiệm thu đang ở trạng thái bản nháp");
        }

        record.setApprovalStatus("PENDING_APPROVAL");
        if (notes != null && !notes.isBlank()) {
            record.setApprovalNotes(notes);
        }
        record = handoverRecordRepository.save(record);

        String logMsg = String.format("[%s] Nhân viên %s trình quản lý phê duyệt các khoản khấu trừ bồi thường. Ghi chú: %s\n",
                LocalDateTime.now().format(CHECKIN_DT_FMT), staff.getFullName(), notes != null ? notes : "Không");
        booking.setStepTransitionHistory((booking.getStepTransitionHistory() != null ? booking.getStepTransitionHistory() : "") + logMsg);
        bookingRepository.save(booking);

        activityLogService.record(
                unit != null && unit.getFacility() != null ? unit.getFacility().getId() : null,
                ActivityAction.CHECKOUT_INSPECTION_COMPLETE,
                "HandoverRecord",
                record.getId(),
                String.format("Trình duyệt khấu trừ cho đơn %s", booking.getBookingCode()),
                booking.getStatus(),
                booking.getStatus()
        );

        return mapToResponse(record);
    }

    @Override
    public ReturnSettlementResponse approveSettlement(UUID bookingId, HandoverRequest request) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        StorageUnit unit = booking.getStorageUnit();
        Facility facility = unit != null ? unit.getFacility() : null;
        if (facility != null) {
            facilityAccessGuard.checkFacilityAccess(facility.getId());
        }

        User approver = resolveStaff(null);
        if (approver == null) {
            throw new AppException(ErrorCode.FORBIDDEN);
        }
        String roleName = approver.getRole() != null ? approver.getRole().getName() : "";

        // Nhân viên thường STAFF không có quyền phê duyệt khấu trừ (11 & 6.3)
        if ("STAFF".equalsIgnoreCase(roleName) || "FACILITY_STAFF".equalsIgnoreCase(roleName)) {
            throw new AppException(ErrorCode.RETURN_UNAUTHORIZED_APPROVAL, "Nhân viên không có quyền phê duyệt khấu trừ bồi thường");
        }

        HandoverRecord record = handoverRecordRepository.findByBooking_IdOrderByRecordedAtDesc(booking.getId())
                .stream().findFirst().orElseThrow(() -> new AppException(ErrorCode.RETURN_NOT_INSPECTED));

        BigDecimal depositPaid = calculateTotalDepositPaid(booking);
        BigDecimal overdueDebt = calculateOverdueDebtForBooking(booking);

        BigDecimal doorFee = record.getDoorFee() != null ? record.getDoorFee() : BigDecimal.ZERO;
        BigDecimal cleanFee = record.getCleanlinessFee() != null ? record.getCleanlinessFee() : BigDecimal.ZERO;
        BigDecimal wallFee = record.getWallStructureFee() != null ? record.getWallStructureFee() : BigDecimal.ZERO;
        BigDecimal lockFee = record.getSmartLockFee() != null ? record.getSmartLockFee() : BigDecimal.ZERO;
        BigDecimal lostCardFee = record.getLostCardFee() != null ? record.getLostCardFee() : BigDecimal.ZERO;
        String lockIssueType = record.getSmartLockIssueType();
        BigDecimal effectiveLockFee = "CUSTOMER_FAULT".equalsIgnoreCase(lockIssueType) ? lockFee : BigDecimal.ZERO;

        BigDecimal totalProposedDeductions = doorFee.add(cleanFee).add(wallFee).add(effectiveLockFee).add(lostCardFee).add(overdueDebt);

        boolean isApprove = request == null || request.getApprovalAction() == null || "APPROVE".equalsIgnoreCase(request.getApprovalAction());

        if (isApprove) {
            BigDecimal approvedAmount = (request != null && request.getApprovedDeductionAmount() != null)
                    ? request.getApprovedDeductionAmount() : totalProposedDeductions;

            BigDecimal amountToCheck = (approvedAmount != null && approvedAmount.compareTo(BigDecimal.ZERO) > 0)
                    ? approvedAmount : totalProposedDeductions;

            // Giới hạn duyệt của FACILITY_MANAGER: 5.000.000 VNĐ. Nếu vượt cần BUSINESS_MANAGER hoặc ADMIN
            BigDecimal approvalLimit = new BigDecimal("5000000");
            if (amountToCheck.compareTo(approvalLimit) > 0) {
                if (!"BUSINESS_MANAGER".equalsIgnoreCase(roleName) && !"ADMIN".equalsIgnoreCase(roleName)) {
                    throw new AppException(ErrorCode.RETURN_UNAUTHORIZED_APPROVAL,
                            "Chi phí khấu trừ (" + amountToCheck + "đ) vượt hạn mức phê duyệt của Quản lý cơ sở (tối đa 5.000.000đ). Cần Giám đốc kinh doanh hoặc Admin phê duyệt");
                }
            }

            BigDecimal netRefund = depositPaid.subtract(approvedAmount).max(BigDecimal.ZERO);
            BigDecimal additionalDue = approvedAmount.subtract(depositPaid).max(BigDecimal.ZERO);

            record.setApprovalStatus("APPROVED");
            record.setApprovedBy(approver);
            record.setApprovedAt(LocalDateTime.now());
            record.setApprovedDeductions(approvedAmount);
            record.setDeductionAmount(approvedAmount);
            record.setRefundAmount(netRefund);
            record.setDepositSettled(depositPaid);
            record.setAdditionalAmountDue(additionalDue);
            if (additionalDue.compareTo(BigDecimal.ZERO) > 0) {
                record.setAdditionalPaymentStatus("PENDING");
            }
            if (request != null && request.getNotes() != null) {
                record.setApprovalNotes(request.getNotes());
            }

            String logMsg = String.format("[%s] Quản lý %s (%s) ĐÃ PHÊ DUYỆT quyết toán: Khấu trừ duyệt: %sđ, Hoàn cọc: %sđ, Thu bổ sung: %sđ\n",
                    LocalDateTime.now().format(CHECKIN_DT_FMT), approver.getFullName(), roleName, approvedAmount, netRefund, additionalDue);
            booking.setStepTransitionHistory((booking.getStepTransitionHistory() != null ? booking.getStepTransitionHistory() : "") + logMsg);
        } else {
            record.setApprovalStatus("REJECTED");
            record.setApprovedBy(approver);
            record.setApprovedAt(LocalDateTime.now());
            if (request != null && request.getNotes() != null) {
                record.setApprovalNotes("Từ chối: " + request.getNotes());
            }

            String logMsg = String.format("[%s] Quản lý %s (%s) ĐÃ TỪ CHỐI phê duyệt khấu trừ. Lý do: %s\n",
                    LocalDateTime.now().format(CHECKIN_DT_FMT), approver.getFullName(), roleName,
                    request != null && request.getNotes() != null ? request.getNotes() : "Cần bổ sung chứng từ");
            booking.setStepTransitionHistory((booking.getStepTransitionHistory() != null ? booking.getStepTransitionHistory() : "") + logMsg);
        }

        record = handoverRecordRepository.save(record);
        bookingRepository.save(booking);

        activityLogService.record(
                facility != null ? facility.getId() : null,
                ActivityAction.CHECKOUT_INSPECTION_COMPLETE,
                "HandoverRecord",
                record.getId(),
                String.format("Phê duyệt quyết toán đơn %s: %s", booking.getBookingCode(), record.getApprovalStatus()),
                booking.getStatus(),
                booking.getStatus()
        );

        return calculateSettlement(bookingId, request);
    }

    @Override
    public HandoverResponse recordCustomerDispute(UUID bookingId, String disputeReason) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        StorageUnit unit = booking.getStorageUnit();
        Facility facility = unit != null ? unit.getFacility() : null;
        if (facility != null) {
            facilityAccessGuard.checkFacilityAccess(facility.getId());
        }

        User staff = resolveStaff(null);

        HandoverRecord record = handoverRecordRepository.findByBooking_IdOrderByRecordedAtDesc(booking.getId())
                .stream().findFirst().orElseThrow(() -> new AppException(ErrorCode.RETURN_NOT_INSPECTED));

        record.setApprovalStatus("DISPUTED");
        record.setNotes((record.getNotes() != null ? record.getNotes() + "\n" : "") + "[KHIẾU NẠI] " + disputeReason);
        record = handoverRecordRepository.save(record);

        String logMsg = String.format("[%s] Ghi nhận khiếu nại tranh chấp từ khách hàng: %s\n",
                LocalDateTime.now().format(CHECKIN_DT_FMT), disputeReason != null ? disputeReason : "Không đồng ý chi phí bồi thường");
        booking.setStepTransitionHistory((booking.getStepTransitionHistory() != null ? booking.getStepTransitionHistory() : "") + logMsg);
        bookingRepository.save(booking);

        activityLogService.record(
                facility != null ? facility.getId() : null,
                ActivityAction.CHECKOUT_INSPECTION_COMPLETE,
                "Booking",
                booking.getId(),
                String.format("Ghi nhận tranh chấp quyết toán đơn %s: %s", booking.getBookingCode(), disputeReason),
                booking.getStatus(),
                booking.getStatus()
        );

        return mapToResponse(record);
    }

    @Override
    public PaymentResponse collectAdditionalPayment(UUID bookingId, HandoverRequest request) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        StorageUnit unit = booking.getStorageUnit();
        Facility facility = unit != null ? unit.getFacility() : null;
        if (facility != null) {
            facilityAccessGuard.checkFacilityAccess(facility.getId());
        }

        User staff = requireAuthorizedStaffOperator(null);

        HandoverRecord record = handoverRecordRepository.findByBooking_IdOrderByRecordedAtDesc(booking.getId())
                .stream().findFirst().orElseThrow(() -> new AppException(ErrorCode.RETURN_NOT_INSPECTED));

        if ("PAID".equalsIgnoreCase(record.getAdditionalPaymentStatus())) {
            throw new AppException(ErrorCode.RETURN_ADDITIONAL_PAYMENT_ALREADY_PAID);
        }

        BigDecimal additionalDue = record.getAdditionalAmountDue() != null ? record.getAdditionalAmountDue() : BigDecimal.ZERO;
        if (additionalDue.compareTo(BigDecimal.ZERO) <= 0) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Hồ sơ không có khoản bồi thường bổ sung cần thu");
        }

        String paymentMethod = (request != null && request.getAdditionalPaymentMethod() != null)
                ? request.getAdditionalPaymentMethod() : "CASH";
        String txnRef = (request != null && request.getAdditionalPaymentTxnRef() != null && !request.getAdditionalPaymentTxnRef().isBlank())
                ? request.getAdditionalPaymentTxnRef()
                : "ADD-" + booking.getBookingCode() + "-" + System.currentTimeMillis();

        Payment payment = Payment.builder()
                .booking(booking)
                .collectedByStaff(staff)
                .paymentType(PaymentType.EXTRA_CHARGE)
                .paymentMethod(paymentMethod)
                .amount(additionalDue)
                .status(PaymentStatus.PAID)
                .transactionId(txnRef)
                .paymentTime(LocalDateTime.now())
                .referenceCode("ADDITIONAL_REPAIR_FEE")
                .build();
        payment = paymentRepository.save(payment);

        record.setAdditionalPaymentStatus("PAID");
        record.setAdditionalPaymentMethod(paymentMethod);
        record.setAdditionalPaymentTxnRef(txnRef);
        record.setAdditionalPaymentRecordedAt(LocalDateTime.now());
        record = handoverRecordRepository.save(record);

        String logMsg = String.format("[%s] Nhân viên %s ghi nhận thu khoản bồi thường vượt cọc %s VNĐ qua hình thức %s (Mã GD: %s)\n",
                LocalDateTime.now().format(CHECKIN_DT_FMT), staff.getFullName(), additionalDue, paymentMethod, txnRef);
        booking.setStepTransitionHistory((booking.getStepTransitionHistory() != null ? booking.getStepTransitionHistory() : "") + logMsg);
        bookingRepository.save(booking);

        activityLogService.record(
                facility != null ? facility.getId() : null,
                ActivityAction.DAMAGE_FEE_RECORDED,
                "Payment",
                payment.getId(),
                String.format("Đã thu bồi thường bổ sung %s VNĐ cho đơn %s (GD: %s)", additionalDue, booking.getBookingCode(), txnRef),
                null,
                null
        );

        return paymentMapper.toResponse(payment);
    }

    @Override
    public ReturnSettlementResponse executeRefund(UUID bookingId, HandoverRequest request) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        StorageUnit unit = booking.getStorageUnit();
        Facility facility = unit != null ? unit.getFacility() : null;
        if (facility != null) {
            facilityAccessGuard.checkFacilityAccess(facility.getId());
        }

        User staff = requireAuthorizedStaffOperator(null);

        HandoverRecord record = handoverRecordRepository.findByBooking_IdOrderByRecordedAtDesc(booking.getId())
                .stream().findFirst().orElseThrow(() -> new AppException(ErrorCode.RETURN_NOT_INSPECTED));

        if ("REFUNDED".equalsIgnoreCase(record.getRefundStatus())) {
            throw new AppException(ErrorCode.RETURN_ALREADY_REFUNDED);
        }

        BigDecimal refundAmount = record.getRefundAmount() != null ? record.getRefundAmount() : BigDecimal.ZERO;
        if (refundAmount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Số tiền hoàn cọc bằng 0. Không có khoản tiền nào để thực hiện hoàn cọc.");
        }

        // Bắt buộc các khoản khấu trừ phải được phê duyệt trước khi thực hiện hoàn tiền (6.3, 8)
        BigDecimal deductions = record.getDeductionAmount() != null ? record.getDeductionAmount() : BigDecimal.ZERO;
        if (deductions.compareTo(BigDecimal.ZERO) > 0 && !"APPROVED".equalsIgnoreCase(record.getApprovalStatus())) {
            throw new AppException(ErrorCode.RETURN_APPROVAL_REQUIRED, "Các khoản khấu trừ chưa được phê duyệt. Không thể hoàn tiền.");
        }

        String refundMethod = (request != null && request.getRefundMethod() != null) ? request.getRefundMethod() : "BANK_TRANSFER";
        String txnRef = "REF-" + booking.getBookingCode() + "-" + System.currentTimeMillis();

        Optional<RentalContract> contractOpt = rentalContractRepository.findByBookingId(booking.getId());

        RefundRequest refundReq = RefundRequest.builder()
                .requestCode(txnRef)
                .customer(booking.getCustomer())
                .facility(facility)
                .booking(booking)
                .contract(contractOpt.orElse(null))
                .requestedAmount(record.getDepositSettled() != null ? record.getDepositSettled() : refundAmount)
                .deductionAmount(deductions)
                .finalRefundAmount(refundAmount)
                .bankName(refundMethod)
                .bankAccountNumber("N/A")
                .bankAccountName(booking.getCustomer() != null ? booking.getCustomer().getFullName() : "Khách hàng")
                .reason(String.format("Hoàn trả tiền cọc trả kho %s đơn %s", unit != null ? unit.getUnitCode() : "", booking.getBookingCode()))
                .status(RefundStatus.COMPLETED)
                .processedAt(LocalDateTime.now())
                .requestedBy(staff)
                .build();
        refundRequestRepository.save(refundReq);

        record.setRefundStatus("REFUNDED");
        record.setRefundMethod(refundMethod);
        record.setRefundTxnRef(txnRef);
        record.setRefundProcessedAt(LocalDateTime.now());
        record = handoverRecordRepository.save(record);

        String logMsg = String.format("[%s] Nhân viên %s thực hiện hoàn trả tiền cọc %s VNĐ qua hình thức %s (Mã tham chiếu: %s)\n",
                LocalDateTime.now().format(CHECKIN_DT_FMT), staff.getFullName(), refundAmount, refundMethod, txnRef);
        booking.setStepTransitionHistory((booking.getStepTransitionHistory() != null ? booking.getStepTransitionHistory() : "") + logMsg);
        bookingRepository.save(booking);

        activityLogService.record(
                facility != null ? facility.getId() : null,
                ActivityAction.REFUND_REQUEST_CREATE,
                "HandoverRecord",
                record.getId(),
                String.format("Hoàn tất hoàn trả cọc %s VNĐ cho đơn %s (Mã GD: %s)", refundAmount, booking.getBookingCode(), txnRef),
                null,
                null
        );

        return calculateSettlement(bookingId, request);
    }

    @Override
    public HandoverResponse confirmPhysicalReturn(UUID bookingId, HandoverRequest request) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        StorageUnit unit = booking.getStorageUnit();
        Facility facility = unit != null ? unit.getFacility() : null;
        if (facility != null) {
            facilityAccessGuard.checkFacilityAccess(facility.getId());
        }

        User staff = requireAuthorizedStaffOperator(null);

        HandoverRecord record = handoverRecordRepository.findByBooking_IdOrderByRecordedAtDesc(booking.getId())
                .stream().findFirst().orElseThrow(() -> new AppException(ErrorCode.RETURN_NOT_INSPECTED));

        if (Boolean.FALSE.equals(record.getAssetsClearedPassed())) {
            throw new AppException(ErrorCode.RETURN_ASSETS_NOT_CLEARED, "Ngăn kho còn đồ đạc, chưa dọn sạch. Không thể nhận lại kho!");
        }

        record.setPhysicalHandoverConfirmed(true);
        record.setPhysicalHandoverAt(LocalDateTime.now());
        record.setPhysicalHandoverBy(staff);
        record = handoverRecordRepository.save(record);

        // Chuyển trạng thái ngăn kho theo tình trạng kiểm tra (9.3)
        if (unit != null) {
            BigDecimal deductions = record.getDeductionAmount() != null ? record.getDeductionAmount() : BigDecimal.ZERO;
            boolean hasDamageOrCleanIssue = deductions.compareTo(BigDecimal.ZERO) > 0
                    || Boolean.FALSE.equals(record.getDoorConditionPassed())
                    || Boolean.FALSE.equals(record.getCleanlinessPassed())
                    || Boolean.FALSE.equals(record.getWallStructurePassed())
                    || (Boolean.FALSE.equals(record.getSmartLockPassed()) && "CUSTOMER_FAULT".equalsIgnoreCase(record.getSmartLockIssueType()));

            if (hasDamageOrCleanIssue) {
                unit.setStatus(UnitStatus.UNDER_MAINTENANCE);
            } else {
                unit.setStatus(UnitStatus.AVAILABLE);
            }
            storageUnitRepository.save(unit);
        }

        String logMsg = String.format("[%s] Nhân viên %s xác nhận nhận lại kho vật lý. Trạng thái ô kho chuyển sang: %s\n",
                LocalDateTime.now().format(CHECKIN_DT_FMT), staff.getFullName(), unit != null ? unit.getStatus() : "N/A");
        booking.setStepTransitionHistory((booking.getStepTransitionHistory() != null ? booking.getStepTransitionHistory() : "") + logMsg);
        bookingRepository.save(booking);

        activityLogService.record(
                facility != null ? facility.getId() : null,
                ActivityAction.STORAGE_UNIT_RELEASE,
                "StorageUnit",
                unit != null ? unit.getId() : null,
                String.format("Xác nhận nhận lại kho vật lý %s, trạng thái: %s", unit != null ? unit.getUnitCode() : "N/A", unit != null ? unit.getStatus() : "N/A"),
                UnitStatus.OCCUPIED,
                unit != null ? unit.getStatus() : UnitStatus.AVAILABLE
        );

        return mapToResponse(record);
    }

    @Override
    public HandoverResponse revokeAccess(UUID bookingId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        StorageUnit unit = booking.getStorageUnit();
        Facility facility = unit != null ? unit.getFacility() : null;
        if (facility != null) {
            facilityAccessGuard.checkFacilityAccess(facility.getId());
        }

        User staff = requireAuthorizedStaffOperator(null);

        HandoverRecord record = handoverRecordRepository.findByBooking_IdOrderByRecordedAtDesc(booking.getId())
                .stream().findFirst().orElseThrow(() -> new AppException(ErrorCode.RETURN_NOT_INSPECTED));

        // Gọi service giải phóng lock ngăn kho
        if (unit != null) {
            try {
                storageUnitLockService.releaseLock(unit.getId());
            } catch (Exception ex) {
                log.warn("StorageUnitLock release lock failed for unit {}: {}", unit.getUnitCode(), ex.getMessage());
            }
        }

        booking.setAccessPin(null);
        booking.setQrAccessToken(null);
        bookingRepository.save(booking);

        record.setAccessRevoked(true);
        record.setAccessRevokedAt(LocalDateTime.now());
        record = handoverRecordRepository.save(record);

        String logMsg = String.format("[%s] Nhân viên %s thu hồi mã PIN SmartLock và hủy quyền truy cập kho của khách\n",
                LocalDateTime.now().format(CHECKIN_DT_FMT), staff.getFullName());
        booking.setStepTransitionHistory((booking.getStepTransitionHistory() != null ? booking.getStepTransitionHistory() : "") + logMsg);
        bookingRepository.save(booking);

        activityLogService.record(
                facility != null ? facility.getId() : null,
                ActivityAction.ACCESS_CREDENTIAL_REVOKE,
                "Booking",
                booking.getId(),
                String.format("Thu hồi mã PIN và quyền truy cập SmartLock đơn %s", booking.getBookingCode()),
                null,
                null
        );

        return mapToResponse(record);
    }

    @Override
    public ReturnSettlementResponse completeReturn(UUID bookingId) {
        Booking booking = bookingRepository.findByIdForUpdate(bookingId)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        if (booking.getStatus() == BookingStatus.COMPLETED) {
            throw new AppException(ErrorCode.RETURN_ALREADY_COMPLETED);
        }

        StorageUnit unit = booking.getStorageUnit();
        Facility facility = unit != null ? unit.getFacility() : null;
        if (facility != null) {
            facilityAccessGuard.checkFacilityAccess(facility.getId());
        }

        User staff = requireAuthorizedStaffOperator(null);

        HandoverRecord record = handoverRecordRepository.findByBooking_IdOrderByRecordedAtDesc(booking.getId())
                .stream().findFirst().orElseThrow(() -> new AppException(ErrorCode.RETURN_NOT_INSPECTED));

        // 1. Kiểm tra nghiệm thu hiện trường
        if ("DRAFT".equalsIgnoreCase(record.getInspectionStatus()) || !"COMPLETED".equalsIgnoreCase(record.getInspectionStatus())) {
            throw new AppException(ErrorCode.RETURN_NOT_INSPECTED, "Biên bản nghiệm thu hiện trường chưa được hoàn tất và chốt");
        }

        // 2. Kiểm tra kho đã dọn trống
        if (Boolean.FALSE.equals(record.getAssetsClearedPassed())) {
            throw new AppException(ErrorCode.RETURN_ASSETS_NOT_CLEARED, "Ngăn kho chưa lấy hết đồ đạc, không thể hoàn tất hồ sơ trả kho");
        }

        // 3. Kiểm tra nhận lại kho vật lý (9.1)
        if (!Boolean.TRUE.equals(record.getPhysicalHandoverConfirmed())) {
            throw new AppException(ErrorCode.RETURN_PHYSICAL_HANDOVER_REQUIRED, "Chưa xác nhận bàn giao nhận lại kho vật lý");
        }

        // 4. Kiểm tra thu hồi quyền truy cập SmartLock (9.2 & 10)
        if (!Boolean.TRUE.equals(record.getAccessRevoked())) {
            throw new AppException(ErrorCode.RETURN_ACCESS_REVOCATION_FAILED, "Chưa thu hồi mã PIN SmartLock và quyền truy cập kho");
        }

        // 5. Kiểm tra trạng thái tranh chấp
        if ("DISPUTED".equalsIgnoreCase(record.getApprovalStatus())) {
            throw new AppException(ErrorCode.RETURN_DISPUTED, "Hồ sơ đang trong trạng thái khiếu nại tranh chấp. Không thể hoàn tất");
        }

        // 6. Kiểm tra phê duyệt khấu trừ (nếu có chi phí)
        BigDecimal deductions = record.getDeductionAmount() != null ? record.getDeductionAmount() : BigDecimal.ZERO;
        if (deductions.compareTo(BigDecimal.ZERO) > 0 && !"APPROVED".equalsIgnoreCase(record.getApprovalStatus())) {
            throw new AppException(ErrorCode.RETURN_APPROVAL_REQUIRED, "Khoản khấu trừ chưa được quản lý phê duyệt");
        }

        // 7. Kiểm tra khoản thanh toán bổ sung (nếu có)
        BigDecimal additionalDue = record.getAdditionalAmountDue() != null ? record.getAdditionalAmountDue() : BigDecimal.ZERO;
        if (additionalDue.compareTo(BigDecimal.ZERO) > 0 && !"PAID".equalsIgnoreCase(record.getAdditionalPaymentStatus())) {
            throw new AppException(ErrorCode.RETURN_ADDITIONAL_PAYMENT_PENDING, "Khách hàng chưa thanh toán khoản bồi thường bổ sung còn thiếu (" + additionalDue + " VNĐ)");
        }

        // 8. Hoàn tất hợp đồng, booking và chuyển trạng thái kho theo thực tế (9.3 & 10)
        booking.setStatus(BookingStatus.COMPLETED);
        booking.setReturnTime(LocalDateTime.now());
        booking.setAccessPin(null);
        booking.setQrAccessToken(null);

        if (unit != null) {
            boolean hasDamageOrCleanIssue = deductions.compareTo(BigDecimal.ZERO) > 0
                    || Boolean.FALSE.equals(record.getDoorConditionPassed())
                    || Boolean.FALSE.equals(record.getCleanlinessPassed())
                    || Boolean.FALSE.equals(record.getWallStructurePassed())
                    || (Boolean.FALSE.equals(record.getSmartLockPassed()) && "CUSTOMER_FAULT".equalsIgnoreCase(record.getSmartLockIssueType()));

            if (hasDamageOrCleanIssue) {
                unit.setStatus(UnitStatus.UNDER_MAINTENANCE);
            } else {
                unit.setStatus(UnitStatus.AVAILABLE);
            }
            storageUnitRepository.save(unit);
        }

        Optional<RentalContract> contractOpt = rentalContractRepository.findByBookingId(booking.getId());
        contractOpt.ifPresent(c -> {
            c.setStatus(RentalContractStatus.TERMINATED);
            rentalContractRepository.save(c);
        });

        record.setApprovalStatus("COMPLETED");
        record.setReviewStatus("COMPLETED");
        record = handoverRecordRepository.save(record);

        String logMsg = String.format("[%s] Nhân viên %s ĐÃ HOÀN TẤT TOÀN BỘ HỒ SƠ TRẢ KHO. Hợp đồng chính thức thanh lý. Ô kho: %s\n",
                LocalDateTime.now().format(CHECKIN_DT_FMT), staff.getFullName(), unit != null ? unit.getStatus() : "N/A");
        booking.setStepTransitionHistory((booking.getStepTransitionHistory() != null ? booking.getStepTransitionHistory() : "") + logMsg);
        bookingRepository.save(booking);

        // Gửi email thông báo hoàn tất trả kho cho khách
        if (booking.getCustomer() != null && booking.getCustomer().getEmail() != null) {
            try {
                String subject = "[Boxora] Thông báo hoàn tất trả kho & thanh lý hợp đồng thuê kho " + (unit != null ? unit.getUnitCode() : "");
                String body = String.format(
                        "Kính gửi Quý khách %s,\n\nHệ thống Boxora xin trân trọng thông báo: Hồ sơ trả kho cho đơn đặt kho %s (ô kho %s) đã được hoàn tất thành công.\n"
                        + "Hợp đồng thuê kho đã được thanh lý.\n"
                        + "Cảm ơn Quý khách đã tin tưởng và sử dụng dịch vụ của Boxora!",
                        booking.getCustomer().getFullName(), booking.getBookingCode(), unit != null ? unit.getUnitCode() : "N/A"
                );
                emailService.sendSimpleEmail(booking.getCustomer().getEmail(), subject, body);
            } catch (Exception ex) {
                log.warn("Could not send completion email to {}: {}", booking.getCustomer().getEmail(), ex.getMessage());
            }
        }

        activityLogService.record(
                facility != null ? facility.getId() : null,
                ActivityAction.CHECKOUT_INSPECTION_COMPLETE,
                "Booking",
                booking.getId(),
                String.format("Hoàn tất hồ sơ trả kho và thanh lý hợp đồng đơn %s", booking.getBookingCode()),
                BookingStatus.INSPECTED,
                BookingStatus.COMPLETED
        );

        return calculateSettlement(bookingId, null);
    }
}

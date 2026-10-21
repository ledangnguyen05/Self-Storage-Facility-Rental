package com.boxora.service.impl;

import com.boxora.dto.request.CheckInInspectionRequest;
import com.boxora.dto.request.HandoverRequest;
import com.boxora.dto.request.IdentityVerifyRequest;
import com.boxora.dto.request.ManualPaymentRecordRequest;
import com.boxora.dto.request.PaperContractCreateRequest;
import com.boxora.dto.response.CustomerDebtResponse;
import com.boxora.dto.response.FileUploadResponse;
import com.boxora.dto.response.HandoverLookupResponse;
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
import com.boxora.service.FacilityPolicyDefaults;
import com.boxora.service.FileStorageService;
import com.boxora.service.HandoverService;
import com.boxora.service.OverdueFeeCalculator;
import com.boxora.service.UnitAvailability;
import com.boxora.util.BookingStatusLabels;
import com.boxora.util.EvidenceUrlCodec;
import com.boxora.util.HandoverLabels;
import com.boxora.util.IdentityDocuments;
import com.boxora.util.VndFormat;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class HandoverServiceImpl implements HandoverService {

    /** Prefix of the check-in QR the customer app shows: BOXORA-CHECKIN:&lt;bookingCode&gt; */
    static final String QR_PREFIX = "BOXORA-CHECKIN:";
    private static final Pattern UUID_PATTERN =
            Pattern.compile("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$");
    private static final int MIN_EVIDENCE_PHOTOS = 2;
    private static final Set<BookingStatus> CHECK_IN_STATUSES = Set.of(BookingStatus.CONFIRMED, BookingStatus.PENDING_PAYMENT);
    private static final Pattern CHECKLIST_FAIL = Pattern.compile("Không đạt|Chưa dọn|Lỗi|Hư hại");
    private static final String DEBT_NOTE_MARK = "CẢNH BÁO: Khấu trừ vượt quá tiền cọc!";

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
    private final CustomerDebtRepository customerDebtRepository;
    private final NotificationLogRepository notificationLogRepository;
    private final EmailService emailService;
    private final FileStorageService fileStorageService;
    private final OverdueFeeCalculator overdueFeeCalculator;
    private final com.boxora.security.FacilityAccessGuard facilityAccessGuard;
    private final com.boxora.security.RequestContext requestContext;
    private final PaymentMapper paymentMapper;
    private final RentalContractMapper rentalContractMapper;
    private final HandoverPinMailer pinMailer;

    // =========================================================================
    // ACCESS CONTROL HELPERS
    // =========================================================================

    private AppException bookingNotFound() {
        return new AppException(ErrorCode.BOOKING_NOT_FOUND, "Không tìm thấy đơn đặt kho");
    }

    private Booking findBooking(UUID bookingId) {
        if (bookingId == null) {
            throw bookingNotFound();
        }
        return bookingRepository.findById(bookingId).orElseThrow(this::bookingNotFound);
    }

    private static Facility facilityOf(Booking booking) {
        return booking.getStorageUnit() != null ? booking.getStorageUnit().getFacility() : null;
    }

    private static UUID facilityIdOf(Booking booking) {
        Facility facility = facilityOf(booking);
        return facility != null ? facility.getId() : null;
    }

    /**
     * Who may touch this booking: a customer only their own, STAFF / FACILITY_MANAGER only their facility,
     * ADMIN / BUSINESS_MANAGER everything. Customers get a "not found" so booking ids cannot be probed.
     */
    private void authorizeBookingAccess(Booking booking) {
        String role = requestContext.currentUserRole();
        if ("CUSTOMER".equalsIgnoreCase(role)) {
            UUID userId = requestContext.currentUserId();
            if (userId == null || booking.getCustomer() == null || !userId.equals(booking.getCustomer().getId())) {
                throw bookingNotFound();
            }
            return;
        }
        UUID facilityId = facilityIdOf(booking);
        if (facilityId != null) {
            facilityAccessGuard.checkFacilityAccess(facilityId);
        }
    }

    /** Staff-only actions: refuses customers outright, then applies the facility scope. */
    private void authorizeStaffAccess(Booking booking) {
        if ("CUSTOMER".equalsIgnoreCase(requestContext.currentUserRole())) {
            throw new AppException(ErrorCode.FORBIDDEN);
        }
        authorizeBookingAccess(booking);
    }

    /** The signed-in operator. The staffId a client sends is only a fallback when nobody is signed in (jobs, tests). */
    private User resolveStaff(UUID requestedStaffId) {
        UUID currentId = requestContext.currentUserId();
        if (currentId != null) {
            return userRepository.findById(currentId).orElse(null);
        }
        if (requestedStaffId != null) {
            return userRepository.findById(requestedStaffId).orElse(null);
        }
        return null;
    }

    // =========================================================================
    // CHECK-IN: 4 PREREQUISITES
    // =========================================================================

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
        Booking booking = findBooking(bookingId);
        authorizeStaffAccess(booking);

        StorageUnit unit = booking.getStorageUnit();
        User customer = booking.getCustomer();

        // 1. Điều kiện 1: Đủ tiền cọc (Full deposit)
        BigDecimal requiredDeposit = getRequiredDeposit(booking, unit);
        BigDecimal depositPaid = calculateTotalDepositPaid(booking);
        BigDecimal depositRemaining = requiredDeposit.subtract(depositPaid).max(BigDecimal.ZERO);
        boolean depositSatisfied = depositPaid.compareTo(BigDecimal.ZERO) > 0
                && depositPaid.compareTo(requiredDeposit) >= 0;

        // 2. Điều kiện 2: Đủ tiền thuê tháng đầu (First month rental fee)
        BigDecimal requiredFirstMonthRent = getRequiredFirstMonthRent(booking, unit);
        BigDecimal firstMonthRentPaid = calculateTotalFirstMonthRentPaid(booking);
        BigDecimal firstMonthRentRemaining = requiredFirstMonthRent.subtract(firstMonthRentPaid).max(BigDecimal.ZERO);
        boolean firstMonthRentSatisfied = firstMonthRentPaid.compareTo(BigDecimal.ZERO) > 0
                && firstMonthRentPaid.compareTo(requiredFirstMonthRent) >= 0;

        // 3. Điều kiện 3: Hợp đồng thuê kho (Electronic OTP/DocuSeal or Paper at Facility)
        Optional<RentalContract> contractOpt = rentalContractRepository.findByBookingId(booking.getId());
        boolean contractSigned = false;
        String contractCode = null;
        String contractStatus = "CHƯA_TẠO";
        String contractSigningMethod = booking.getSigningMethod() != null ? booking.getSigningMethod() : "ONLINE";
        String contractVerificationStatus = null;
        String paperContractUrl = null;
        String paperOriginalLocation = null;
        String paperVerifiedByName = null;
        LocalDateTime paperVerifiedAt = null;

        if (contractOpt.isPresent()) {
            RentalContract contract = contractOpt.get();
            contractCode = contract.getContractCode();
            if (contract.getSigningMethod() != null) {
                contractSigningMethod = contract.getSigningMethod();
            }
            paperContractUrl = contract.getPaperContractUrl();
            paperOriginalLocation = contract.getPaperOriginalLocation();
            if (contract.getPaperVerifiedBy() != null) {
                paperVerifiedByName = contract.getPaperVerifiedBy().getFullName();
            }
            paperVerifiedAt = contract.getPaperVerifiedAt();

            boolean isPaper = isPaperContract(contract, booking);
            boolean isContractSignedOrActive = contract.getStatus() == RentalContractStatus.ACTIVE
                    || contract.getStatus() == RentalContractStatus.PENDING_ACTIVATION;

            if (isPaper) {
                if (isContractSignedOrActive && contract.getPaperVerifiedAt() != null) {
                    contractSigned = true;
                    contractStatus = "ĐÃ_KÝ_VÀ_XÁC_MINH";
                    contractVerificationStatus = "VERIFIED";
                } else if (contract.getStatus() == RentalContractStatus.PENDING_VERIFICATION
                        || (contract.getPaperContractUrl() != null && contract.getPaperVerifiedAt() == null)) {
                    contractSigned = false;
                    contractStatus = "CHỜ_XÁC_MINH_HỢP_ĐỒNG_GIẤY";
                    contractVerificationStatus = "PENDING_VERIFICATION";
                } else {
                    contractSigned = false;
                    contractStatus = "CHỜ_TẢI_HỢP_ĐỒNG_GIẤY";
                    contractVerificationStatus = "PENDING_UPLOAD";
                }
            } else {
                // ELECTRONIC / ONLINE
                if (isContractSignedOrActive && contract.getSignedAt() != null) {
                    contractSigned = true;
                    contractStatus = "ĐÃ_KÝ_ĐIỆN_TỬ";
                    contractVerificationStatus = "VERIFIED";
                } else {
                    contractSigned = false;
                    contractStatus = contract.getStatus() != null ? contract.getStatus().name() : "CHỜ_KÝ_ONLINE";
                    contractVerificationStatus = "PENDING_SIGNATURE";
                }
            }
        }

        // 4. Điều kiện 4: Đối soát CCCD gốc (Original identity verification).
        // The number is only returned once staff verified it: it used to fall back to the customer's phone number.
        boolean identityVerified = booking.getIdentityVerifiedAt() != null || booking.getIdentityVerifiedByStaff() != null;
        String idCardType = IdentityDocuments.normalizeType(booking.getIdentityCardType());
        String idCardNumber = identityVerified ? booking.getIdentityCardNumber() : null;
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
                missing.add(String.format("Hợp đồng điện tử chưa được ký hoàn tất qua DocuSeal/OTP (Trạng thái: %s)",
                        contractOpt.map(c -> HandoverLabels.contractStatus(c.getStatus())).orElse("chờ ký")));
            }
        }
        if (!depositSatisfied) {
            missing.add(String.format("Tiền cọc còn thiếu %s (Đã xác nhận: %s / Yêu cầu: %s)",
                    VndFormat.format(depositRemaining), VndFormat.format(depositPaid), VndFormat.format(requiredDeposit)));
        }
        if (!firstMonthRentSatisfied) {
            missing.add(String.format("Tiền thuê tháng đầu còn thiếu %s (Đã xác nhận: %s / Yêu cầu: %s)",
                    VndFormat.format(firstMonthRentRemaining), VndFormat.format(firstMonthRentPaid), VndFormat.format(requiredFirstMonthRent)));
        }
        if (!identityVerified) {
            missing.add("Chưa xác nhận đã đối chiếu giấy tờ tùy thân / CCCD / Passport gốc của khách hàng tại quầy");
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
                .paperContractUrl(paperContractUrl)
                .paperOriginalLocation(paperOriginalLocation)
                .paperVerifiedByName(paperVerifiedByName)
                .paperVerifiedAt(paperVerifiedAt)
                .identityVerified(identityVerified)
                .idCardType(idCardType)
                .idCardNumber(idCardNumber)
                .identityVerifiedByName(identityVerifiedByName)
                .identityVerifiedAt(identityVerifiedAt)
                .eligibleForInspection(eligible)
                .eligibleForCheckIn(eligible)
                .missingPrerequisites(missing)
                .paymentHistory(paymentHistory)
                .build();
    }

    private static boolean isPaperContract(RentalContract contract, Booking booking) {
        return "PAPER".equalsIgnoreCase(contract.getSigningMethod())
                || "IN_PERSON".equalsIgnoreCase(contract.getSigningMethod())
                || "IN_PERSON".equalsIgnoreCase(booking.getSigningMethod());
    }

    // =========================================================================
    // CHECK-IN
    // =========================================================================

    /**
     * Thực hiện Check-in và bàn giao kho vật lý (BR-RULE-005 và BR-RULE-006):
     * Bắt buộc thỏa mãn đồng thời cả 4 điều kiện và đã có biên bản nghiệm thu đạt 5/5 kèm tối thiểu 2 ảnh.
     */
    @Override
    public HandoverResponse checkIn(HandoverRequest request) {
        Booking booking = findBooking(request.getBookingId());

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
                    VndFormat.format(depositPaid), VndFormat.format(requiredDeposit)));
        }

        // Điều kiện 2: Đủ tiền thuê tháng đầu (First month rent) từ lịch sử giao dịch thực tế
        BigDecimal requiredFirstMonthRent = getRequiredFirstMonthRent(booking, unit);
        BigDecimal firstMonthRentPaid = calculateTotalFirstMonthRentPaid(booking);
        boolean firstMonthRentSatisfied = firstMonthRentPaid.compareTo(BigDecimal.ZERO) > 0
                && firstMonthRentPaid.compareTo(requiredFirstMonthRent) >= 0;
        if (!firstMonthRentSatisfied) {
            missingPrerequisites.add(String.format("Chưa thanh toán đủ tiền thuê tháng đầu (Đã đóng: %s / Yêu cầu: %s)",
                    VndFormat.format(firstMonthRentPaid), VndFormat.format(requiredFirstMonthRent)));
        }

        // Điều kiện 3: Hợp đồng thuê kho (Electronic or Paper at Facility)
        Optional<RentalContract> contractOpt = rentalContractRepository.findByBookingId(booking.getId());
        boolean contractSigned = false;
        if (contractOpt.isPresent()) {
            RentalContract contract = contractOpt.get();
            boolean isPaper = isPaperContract(contract, booking);
            boolean isContractSignedOrActive = contract.getStatus() == RentalContractStatus.ACTIVE
                    || contract.getStatus() == RentalContractStatus.PENDING_ACTIVATION;
            if (isPaper) {
                contractSigned = (isContractSignedOrActive && contract.getPaperVerifiedAt() != null);
            } else {
                contractSigned = (isContractSignedOrActive && contract.getSignedAt() != null);
            }
        }
        if (!contractSigned) {
            missingPrerequisites.add("Hợp đồng thuê chưa được ký kết hoặc chưa được nhân viên xác minh hợp lệ");
        }

        // Operator authorization check: the signed-in staff member performs the handover
        User staff = resolveStaff(request.getStaffId());
        if (staff == null) {
            log.warn("[HANDOVER_AUTH] Handover check-in requires an authorized staff operator");
            throw new AppException(ErrorCode.FORBIDDEN);
        }
        if (staff.getRole() != null && "CUSTOMER".equalsIgnoreCase(staff.getRole().getName())) {
            log.warn("[HANDOVER_AUTH] Customer {} cannot authorize their own handover", staff.getId());
            throw new AppException(ErrorCode.FORBIDDEN);
        }

        // Điều kiện 4: Nhân viên tại quầy đối soát CCCD / hộ chiếu gốc
        String requestedType = request.getIdCardType() != null && !request.getIdCardType().isBlank()
                ? request.getIdCardType() : booking.getIdentityCardType();
        String idType = IdentityDocuments.normalizeType(requestedType);
        String idCard = request.getIdCardNumber() != null ? IdentityDocuments.normalizeNumber(idType, request.getIdCardNumber()) : "";
        boolean staffAttestedValidly = Boolean.TRUE.equals(request.getIdentityVerified())
                && IdentityDocuments.isValidNumber(idType, idCard);

        boolean idAlreadyVerified = booking.getIdentityVerifiedAt() != null
                && booking.getIdentityVerifiedByStaff() != null
                && IdentityDocuments.isValidNumber(booking.getIdentityCardType(), booking.getIdentityCardNumber());

        if (Boolean.FALSE.equals(request.getIdentityVerified())) {
            missingPrerequisites.add("Nhân viên tại quầy chưa xác nhận hoàn tất đối soát giấy tờ tùy thân / CCCD gốc của khách hàng");
        } else if (!idCard.isBlank() && !IdentityDocuments.isValidNumber(idType, idCard)) {
            missingPrerequisites.add(ErrorCode.HANDOVER_IDENTITY_FORMAT_INVALID.getMessage());
        } else if (!staffAttestedValidly && !idAlreadyVerified) {
            missingPrerequisites.add("Nhân viên tại quầy chưa xác nhận hoàn tất đối soát giấy tờ tùy thân / CCCD gốc của khách hàng");
        } else if (staffAttestedValidly && !idAlreadyVerified) {
            booking.setIdentityCardType(idType);
            booking.setIdentityCardNumber(idCard);
            booking.setIdentityVerifiedByStaff(staff);
            booking.setIdentityVerifiedAt(LocalDateTime.now());
        }

        if (!missingPrerequisites.isEmpty()) {
            log.warn("[BR-RULE-005] Check-in failed for booking {}. Missing prerequisites: {}",
                    booking.getBookingCode(), missingPrerequisites);
            throw new AppException(ErrorCode.HANDOVER_PREREQUISITES_NOT_MET);
        }

        if (!CHECK_IN_STATUSES.contains(booking.getStatus())) {
            throw new AppException(ErrorCode.HANDOVER_BOOKING_NOT_READY,
                    "Đơn đang ở trạng thái \"" + BookingStatusLabels.of(booking.getStatus()) + "\" nên chưa thể bàn giao kho");
        }

        // Biên bản nghiệm thu bước 2: 5/5 tiêu chí đạt và tối thiểu 2 ảnh. Server tự kiểm tra, không tin cờ từ giao diện.
        HandoverRecord inspection = handoverRecordRepository
                .findFirstByBooking_IdAndRecordTypeOrderByRecordedAtDesc(booking.getId(), "CHECK_IN_INSPECTION")
                .orElseThrow(() -> new AppException(ErrorCode.HANDOVER_INSPECTION_REQUIRED));
        List<String> inspectionPhotos = EvidenceUrlCodec.decode(inspection.getEvidencePhotos());
        if (!isChecklistAllPassed(inspection.getChecklistSummary()) || inspectionPhotos.size() < MIN_EVIDENCE_PHOTOS) {
            throw new AppException(ErrorCode.HANDOVER_INSPECTION_REQUIRED);
        }

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

        // Ghi biên bản bàn giao HandoverRecord (ảnh lấy từ biên bản nghiệm thu đã lưu, thẻ RFID có cột riêng)
        String rfid = request.getRfidCardNumber() != null && !request.getRfidCardNumber().isBlank()
                ? request.getRfidCardNumber().trim() : null;
        String notes = String.format("Check-in hoàn tất đạt chuẩn 4 điều kiện BR-RULE-005. Loại giấy tờ: %s. Số giấy tờ đối soát: %s.%s %s",
                IdentityDocuments.label(idType),
                IdentityDocuments.mask(booking.getIdentityCardNumber() != null ? booking.getIdentityCardNumber() : idCard),
                rfid != null ? " Mã thẻ RFID: " + rfid + "." : "",
                request.getNotes() != null ? request.getNotes() : "").trim();

        HandoverRecord record = HandoverRecord.builder()
                .booking(booking)
                .staff(staff)
                .recordType("CHECK_IN")
                .unitCondition(request.getUnitCondition() != null ? request.getUnitCondition()
                        : (inspection.getUnitCondition() != null ? inspection.getUnitCondition() : "Đạt chuẩn 5/5 kiểm định hiện trạng"))
                .checklistSummary(inspection.getChecklistSummary())
                .evidencePhotos(EvidenceUrlCodec.encode(inspectionPhotos))
                .rfidCardNumber(rfid)
                .notes(notes)
                .recordedAt(LocalDateTime.now())
                .build();

        record = handoverRecordRepository.save(record);

        // Ghi Audit Trail ActivityLog (không ghi PIN và số giấy tờ vào log)
        UUID facilityId = (unit.getFacility() != null) ? unit.getFacility().getId() : null;
        activityLogService.record(
                facilityId,
                ActivityAction.CHECKIN_VERIFIED,
                "Booking",
                booking.getId(),
                String.format("Nhân viên %s đối soát đạt chuẩn 4 điều kiện check-in cho đơn %s (%s)",
                        staff.getFullName(), booking.getBookingCode(), IdentityDocuments.label(idType)),
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

        // Gửi thông tin bàn giao cho khách SAU KHI giao dịch đã commit và ngoài luồng xử lý yêu cầu: máy chủ thư chậm không
        // được giữ khóa dòng đơn/kho hay làm nhân viên chờ. Phản hồi chỉ nói "đã đưa vào hàng gửi" (emailQueued); nếu thư
        // lỗi, nhân viên dùng "Gửi lại" (đồng bộ, báo đúng kết quả) hoặc đưa mã cho khách tại quầy.
        String facilityName = (unit.getFacility() != null) ? unit.getFacility().getName() : "Boxora";
        boolean emailQueued = false;
        String emailError = null;
        User customer = booking.getCustomer();
        if (customer == null || customer.getEmail() == null || customer.getEmail().isBlank()) {
            emailError = "Khách chưa có email trong hồ sơ nên chưa gửi được mã PIN.";
        } else if (!emailService.isMailConfigured()) {
            emailError = "Hệ thống chưa cấu hình dịch vụ gửi email (SMTP) nên chưa gửi được mã PIN qua email.";
        } else {
            pinMailer.sendAfterCommit(customer.getEmail(),
                    HandoverMessageTemplates.pinEmailSubject(unit.getUnitCode()),
                    HandoverMessageTemplates.pinEmailHtml(customer.getFullName(), booking.getBookingCode(), facilityName,
                            unit.getUnitCode(), plainPin),
                    booking.getBookingCode());
            emailQueued = true;
        }

        boolean inAppSent = false;
        try {
            saveInAppHandoverNotification(booking);
            inAppSent = true;
        } catch (Exception e) {
            log.warn("[CHECK_IN] Could not save in-app notification log: {}", e.getMessage());
        }

        HandoverResponse response = mapToResponse(record);
        response.setAccessPin(plainPin); // Trả về PIN nguyên bản một lần duy nhất trên màn hình bàn giao
        response.setQrAccessToken(booking.getQrAccessToken());
        response.setEmailSent(false);
        response.setEmailQueued(emailQueued);
        response.setEmailError(emailError);
        response.setInAppNotificationSent(inAppSent);
        return response;
    }

    // =========================================================================
    // RETURN: PREVIEW / CHECKOUT REQUEST / INSPECTION
    // =========================================================================

    @Override
    @Transactional(readOnly = true)
    public ReturnSettlementPreviewResponse getReturnSettlementPreview(UUID bookingId) {
        Booking booking = findBooking(bookingId);
        authorizeBookingAccess(booking);

        StorageUnit unit = booking.getStorageUnit();
        User customer = booking.getCustomer();
        Facility facility = (unit != null) ? unit.getFacility() : null;
        UUID facilityId = facility != null ? facility.getId() : null;

        Optional<RentalContract> contractOpt = rentalContractRepository.findByBookingId(booking.getId());
        String contractCode = contractOpt.map(RentalContract::getContractCode).orElse(null);
        String contractStatus = contractOpt.map(c -> c.getStatus().name()).orElse("N/A");

        int slaDays = refundSlaDays(facilityId);
        OverdueFeeCalculator.OverduePolicy policy = overdueFeeCalculator.policyFor(facilityId);

        BigDecimal depositPaid = calculateTotalDepositPaid(booking);

        LocalDate today = LocalDate.now();
        LocalDate endDate = booking.getEndDate();
        int overdueDays = overdueFeeCalculator.daysOverdue(endDate, today);
        BigDecimal calculatedOverdueLateFee = overdueFeeCalculator.calculateLateFee(endDate, facilityId, today);

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
                .bookingStatus(booking.getStatus() != null ? booking.getStatus().name() : null)
                .rentalEndDate(endDate)
                .actualReturnDate(today)
                .overdueDays(overdueDays)
                .overdueGraceDays(policy.graceDays())
                .depositPaid(depositPaid)
                .dailyLateFee(policy.dailyLateFee())
                .calculatedOverdueLateFee(calculatedOverdueLateFee)
                .depositRefundSlaDays(slaDays)
                .recommendedReviewStatus(recommendedReviewStatus)
                .checklistStandardItems(checklistStandards)
                .build();
    }

    @Override
    @Transactional
    public HandoverResponse requestCheckout(UUID bookingId, String notes) {
        Booking booking = findBooking(bookingId);

        if (booking.getStatus() != BookingStatus.ACTIVE && booking.getStatus() != BookingStatus.OVERDUE) {
            throw new AppException(ErrorCode.BOOKING_NOT_ACTIVE_FOR_RETURN);
        }

        authorizeBookingAccess(booking);

        BookingStatus previous = booking.getStatus();
        booking.setStatus(BookingStatus.CHECKOUT_REQUESTED);
        bookingRepository.save(booking);

        UUID facilityId = facilityIdOf(booking);
        boolean byCustomer = "CUSTOMER".equalsIgnoreCase(requestContext.currentUserRole());

        activityLogService.record(
                facilityId,
                ActivityAction.CHECKOUT_REQUEST,
                "Booking",
                booking.getId(),
                (byCustomer ? "Khách hàng gửi yêu cầu trả kho cho đơn " : "Nhân viên ghi nhận yêu cầu trả kho cho đơn ")
                        + booking.getBookingCode() + (notes != null && !notes.isBlank() ? ": " + notes : ""),
                previous,
                BookingStatus.CHECKOUT_REQUESTED
        );

        HandoverRecord record = HandoverRecord.builder()
                .booking(booking)
                .staff(byCustomer ? null : resolveStaff(null))
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
        Booking booking = findBooking(request.getBookingId());

        User staff = resolveStaff(request.getStaffId());
        StorageUnit unit = booking.getStorageUnit();
        Facility facility = (unit != null) ? unit.getFacility() : null;

        if (facility != null) {
            facilityAccessGuard.checkFacilityAccess(facility.getId());
        }

        BookingStatus previous = booking.getStatus();
        if (previous != BookingStatus.CHECKOUT_REQUESTED && previous != BookingStatus.ACTIVE && previous != BookingStatus.OVERDUE) {
            throw new AppException(ErrorCode.BOOKING_NOT_ACTIVE_FOR_RETURN);
        }

        boolean doorPassed = request.getDoorConditionPassed() == null || Boolean.TRUE.equals(request.getDoorConditionPassed());
        boolean cleanlinessPassed = request.getCleanlinessPassed() == null || Boolean.TRUE.equals(request.getCleanlinessPassed());
        boolean smartLockPassed = request.getSmartLockPassed() == null || Boolean.TRUE.equals(request.getSmartLockPassed());
        boolean sensorPassed = request.getSensorPassed() == null || Boolean.TRUE.equals(request.getSensorPassed());
        boolean wallPassed = request.getWallStructurePassed() == null || Boolean.TRUE.equals(request.getWallStructurePassed());

        String checklistSummary = buildChecklistSummary(doorPassed, cleanlinessPassed, smartLockPassed, sensorPassed, wallPassed, "Cảm biến");

        List<String> evidencePhotos = EvidenceUrlCodec.requireUploadedUrls(request.getEvidencePhotos());
        if (evidencePhotos.size() < MIN_EVIDENCE_PHOTOS) {
            throw new AppException(ErrorCode.RETURN_PHOTO_EVIDENCE_REQUIRED);
        }
        fileStorageService.requireBookingEvidence(evidencePhotos, booking.getId(), facilityIdOf(booking));

        booking.setStatus(BookingStatus.INSPECTED);
        bookingRepository.save(booking);

        HandoverRecord record = HandoverRecord.builder()
                .booking(booking)
                .staff(staff)
                .recordType("INSPECTION")
                .unitCondition(request.getUnitCondition() != null ? request.getUnitCondition() : "Đã hoàn thành kiểm định hiện trường")
                .checklistSummary(checklistSummary)
                .evidencePhotos(EvidenceUrlCodec.encode(evidencePhotos))
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
                previous,
                BookingStatus.INSPECTED
        );

        return mapToResponse(record);
    }

    // =========================================================================
    // RETURN SETTLEMENT
    // =========================================================================

    @Override
    public HandoverResponse processReturn(HandoverRequest request) {
        SettlementOutcome outcome = processReturnSettlementInternal(request);
        HandoverResponse response = mapToResponse(outcome.record());
        response.setRefundTransactionId(outcome.refundTxnId());
        return response;
    }

    @Override
    public ReturnSettlementResponse processReturnSettlement(HandoverRequest request) {
        SettlementOutcome outcome = processReturnSettlementInternal(request);
        HandoverRecord record = outcome.record();

        List<String> photos = EvidenceUrlCodec.decode(record.getEvidencePhotos());
        boolean checklistAllPassed = isChecklistAllPassed(record.getChecklistSummary());

        Booking booking = record.getBooking();
        StorageUnit unit = (booking != null) ? booking.getStorageUnit() : null;

        return ReturnSettlementResponse.builder()
                .handoverRecordId(record.getId())
                .bookingId(booking != null ? booking.getId() : null)
                .bookingCode(booking != null ? booking.getBookingCode() : null)
                .unitCode(unit != null ? unit.getUnitCode() : null)
                .customerName(booking != null && booking.getCustomer() != null ? booking.getCustomer().getFullName() : null)
                .staffId(record.getStaff() != null ? record.getStaff().getId() : null)
                .staffName(record.getStaff() != null ? record.getStaff().getFullName() : null)
                .depositPaid(record.getDepositSettled())
                .damageFee(outcome.damageFee())
                .cleaningFee(outcome.cleaningFee())
                .lostCardFee(outcome.lostCardFee())
                .overdueDebt(outcome.overdueDebt())
                .totalDeduction(record.getDeductionAmount())
                .netRefundAmount(record.getRefundAmount())
                .reviewStatus(record.getReviewStatus())
                .depositRefundSlaDays(outcome.refundSlaDays())
                .refundTransactionId(outcome.refundTxnId())
                .refundRequestId(outcome.refundRequest() != null ? outcome.refundRequest().getId() : null)
                .refundRequestCode(outcome.refundRequest() != null ? outcome.refundRequest().getRequestCode() : null)
                .refundMethod(outcome.refundMethod())
                .customerDebtAmount(outcome.customerDebt() != null ? outcome.customerDebt().getAmount() : BigDecimal.ZERO)
                .customerDebtId(outcome.customerDebt() != null ? outcome.customerDebt().getId() : null)
                .checklistAllPassed(checklistAllPassed)
                .checklistSummary(record.getChecklistSummary())
                .evidencePhotoCount(photos.size())
                .evidencePhotos(photos)
                .recordedAt(record.getRecordedAt())
                .notes(record.getNotes())
                .build();
    }

    private record SettlementOutcome(HandoverRecord record, BigDecimal damageFee, BigDecimal cleaningFee,
                                     BigDecimal lostCardFee, BigDecimal overdueDebt, int refundSlaDays,
                                     String refundTxnId, String refundMethod, RefundRequest refundRequest,
                                     CustomerDebt customerDebt) {
    }

    private SettlementOutcome processReturnSettlementInternal(HandoverRequest request) {
        Booking booking = findBooking(request.getBookingId());

        if (booking.getStatus() != BookingStatus.INSPECTED
                && booking.getStatus() != BookingStatus.CHECKOUT_REQUESTED
                && booking.getStatus() != BookingStatus.ACTIVE
                && booking.getStatus() != BookingStatus.OVERDUE) {
            log.warn("[BR-RULE-013] Booking {} is in status {}, must be INSPECTED, CHECKOUT_REQUESTED, or ACTIVE for return",
                    booking.getBookingCode(), booking.getStatus());
            throw new AppException(ErrorCode.BOOKING_NOT_ACTIVE_FOR_RETURN);
        }

        Optional<HandoverRecord> inspectionOpt = handoverRecordRepository
                .findFirstByBooking_IdAndRecordTypeOrderByRecordedAtDesc(booking.getId(), "INSPECTION");
        if (booking.getStatus() == BookingStatus.CHECKOUT_REQUESTED) {
            boolean hasInspection = inspectionOpt.isPresent()
                    || handoverRecordRepository.existsByBooking_IdAndRecordType(booking.getId(), "INSPECTION");
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
        UUID facilityId = (facility != null) ? facility.getId() : null;

        int refundSlaDays = refundSlaDays(facilityId);

        // 1. Thẩm định Checklist 5 điểm hiện trường (BR-RULE-013)
        boolean doorPassed = request.getDoorConditionPassed() == null || Boolean.TRUE.equals(request.getDoorConditionPassed());
        boolean cleanlinessPassed = request.getCleanlinessPassed() == null || Boolean.TRUE.equals(request.getCleanlinessPassed());
        boolean smartLockPassed = request.getSmartLockPassed() == null || Boolean.TRUE.equals(request.getSmartLockPassed());
        boolean sensorPassed = request.getSensorPassed() == null || Boolean.TRUE.equals(request.getSensorPassed());
        boolean wallPassed = request.getWallStructurePassed() == null || Boolean.TRUE.equals(request.getWallStructurePassed());

        String checklistSummary = buildChecklistSummary(doorPassed, cleanlinessPassed, smartLockPassed, sensorPassed, wallPassed, "Cảm biến");

        // Ảnh hiện trường: gửi kèm biên bản, hoặc đã lưu ở bước kiểm định. Tối thiểu 2 ảnh, chỉ nhận tệp đã tải lên hệ thống.
        List<String> evidencePhotos = EvidenceUrlCodec.requireUploadedUrls(request.getEvidencePhotos());
        if (evidencePhotos.isEmpty() && inspectionOpt.isPresent()) {
            evidencePhotos = EvidenceUrlCodec.decode(inspectionOpt.get().getEvidencePhotos());
        } else {
            fileStorageService.requireBookingEvidence(evidencePhotos, booking.getId(), facilityId);
        }
        if (evidencePhotos.size() < MIN_EVIDENCE_PHOTOS) {
            throw new AppException(ErrorCode.RETURN_PHOTO_EVIDENCE_REQUIRED);
        }

        // 2. Quyết toán cọc và các khoản khấu trừ (BR-RULE-014)
        BigDecimal depositPaid = calculateTotalDepositPaid(booking);

        BigDecimal damageFee = nonNegative(request.getDamageFee());
        BigDecimal cleaningFee = nonNegative(request.getCleaningFee());
        BigDecimal lostCardFee = nonNegative(request.getLostCardFee());

        // Phí trễ hạn theo MỘT quy tắc duy nhất (chính sách cơ sở). Nhân viên có thể giảm/miễn, không thể tính cao hơn quy định.
        LocalDate today = LocalDate.now();
        BigDecimal policyLateFee = overdueFeeCalculator.calculateLateFee(booking.getEndDate(), facilityId, today);
        BigDecimal overdueDebt = request.getOverdueDebt() == null
                ? policyLateFee
                : nonNegative(request.getOverdueDebt()).min(policyLateFee);

        BigDecimal itemizedDeductions = damageFee.add(cleaningFee).add(lostCardFee).add(overdueDebt);
        BigDecimal totalDeduction;
        if (request.getDeductionAmount() != null && request.getDeductionAmount().compareTo(itemizedDeductions) > 0) {
            totalDeduction = request.getDeductionAmount();
        } else {
            totalDeduction = itemizedDeductions;
        }

        // A deduction that is only the policy late fee needs no explanation; anything else must say why.
        String deductionReason = trimToNull(request.getDeductionReason()) != null
                ? trimToNull(request.getDeductionReason()) : trimToNull(request.getDamageNotes());
        if (totalDeduction.compareTo(BigDecimal.ZERO) > 0
                && deductionReason == null
                && overdueDebt.compareTo(totalDeduction) != 0) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Vui lòng ghi rõ lý do khấu trừ cọc trước khi lập biên bản trả kho");
        }

        BigDecimal netRefundAmount = depositPaid.subtract(totalDeduction);
        BigDecimal actualRefund = netRefundAmount.compareTo(BigDecimal.ZERO) > 0 ? netRefundAmount : BigDecimal.ZERO;
        BigDecimal customerDebt = netRefundAmount.compareTo(BigDecimal.ZERO) < 0 ? totalDeduction.subtract(depositPaid) : BigDecimal.ZERO;

        String refundMethod = normalizeRefundMethod(request.getRefundMethod());
        RefundBankDetails bank = actualRefund.compareTo(BigDecimal.ZERO) > 0
                ? resolveRefundBankDetails(request, refundMethod, booking)
                : null;

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

        // 4. Ghi biên bản trước để các bản ghi hoàn tiền / công nợ tham chiếu được tới nó
        String damageNoteStr = deductionReason != null ? ("Lý do khấu trừ: " + deductionReason + ". ") : "";
        String extraNoteStr = (request.getNotes() != null && !request.getNotes().isBlank())
                ? request.getNotes() : "Đã nghiệm thu hoàn trả kho thành công";
        String debtWarningStr = customerDebt.compareTo(BigDecimal.ZERO) > 0
                ? String.format(" [%s Khách hàng nợ thêm: %s. Chuyển kế toán thu hồi công nợ]", DEBT_NOTE_MARK, VndFormat.format(customerDebt)) : "";

        String fullNotes = String.format(
                "Nghiệm thu trả kho & Quyết toán cọc. Trạng thái duyệt: %s (SLA: %d ngày). Cọc gốc: %s, Khấu trừ: %s (Hư hại: %s, Vệ sinh: %s, Thẻ/khóa: %s, Quá hạn: %s), Thực hoàn: %s. %s%s%s",
                HandoverLabels.refundReviewStatus(reviewStatus), refundSlaDays, VndFormat.format(depositPaid), VndFormat.format(totalDeduction),
                VndFormat.format(damageFee), VndFormat.format(cleaningFee), VndFormat.format(lostCardFee),
                VndFormat.format(overdueDebt), VndFormat.format(actualRefund),
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
                .evidencePhotos(EvidenceUrlCodec.encode(evidencePhotos))
                .notes(fullNotes)
                .recordedAt(LocalDateTime.now())
                .build();

        record = handoverRecordRepository.save(record);

        // 5. Sinh bản ghi giao dịch hoàn tiền Payment và yêu cầu hoàn tiền (RefundRequest) cho kế toán duyệt
        String refundTxnId = null;
        RefundRequest refundRequest = null;
        if (actualRefund.compareTo(BigDecimal.ZERO) > 0) {
            refundTxnId = "REFUND-RET-" + booking.getBookingCode() + "-" + System.currentTimeMillis();

            Payment refundPayment = Payment.builder()
                    .transactionId(refundTxnId)
                    .booking(booking)
                    .amount(actualRefund)
                    .paymentType(PaymentType.DEPOSIT)
                    .status(PaymentStatus.REFUND_PENDING)
                    .paymentMethod(refundMethod)
                    .paymentTime(LocalDateTime.now())
                    .build();
            paymentRepository.save(refundPayment);

            String reqCode = "REF-" + System.currentTimeMillis() + "-" + com.boxora.util.VNPayUtil.randomAlphaNumeric(4).toUpperCase();
            String reason = String.format("Quyết toán trả kho %s (Cọc: %s, Khấu trừ: %s)",
                    unit != null ? unit.getUnitCode() : "", VndFormat.format(depositPaid), VndFormat.format(totalDeduction));
            refundRequest = RefundRequest.builder()
                    .requestCode(reqCode)
                    .customer(booking.getCustomer())
                    .facility(facility)
                    .booking(booking)
                    .contract(contractOpt.orElse(null))
                    .requestedAmount(depositPaid)
                    .deductionAmount(totalDeduction)
                    .finalRefundAmount(actualRefund)
                    .bankName(bank.bankName())
                    .bankAccountNumber(bank.accountNumber())
                    .bankAccountName(bank.accountName())
                    .reason(reason.length() > 500 ? reason.substring(0, 500) : reason)
                    .status(RefundStatus.PENDING_REVIEW)
                    .requestedBy(staff != null ? staff : booking.getCustomer())
                    .build();
            refundRequest = refundRequestRepository.save(refundRequest);
        }

        // 6. Ghi nhận công nợ khi khấu trừ vượt tiền cọc để kế toán thu hồi
        CustomerDebt debt = null;
        if (customerDebt.compareTo(BigDecimal.ZERO) > 0) {
            String debtReason = String.format("Khấu trừ trả kho %s vượt tiền cọc (Cọc %s, khấu trừ %s)",
                    unit != null ? unit.getUnitCode() : booking.getBookingCode(), VndFormat.format(depositPaid), VndFormat.format(totalDeduction));
            debt = customerDebtRepository.save(CustomerDebt.builder()
                    .customer(booking.getCustomer())
                    .booking(booking)
                    .facility(facility)
                    .handoverRecord(record)
                    .amount(customerDebt)
                    .reason(debtReason.length() > 500 ? debtReason.substring(0, 500) : debtReason)
                    .status(CustomerDebt.STATUS_OPEN)
                    .createdBy(staff)
                    .build());
        }

        // 7. Thu hồi mã SmartLock và hoàn tất booking
        booking.setAccessPin(null);
        booking.setQrAccessToken(null);
        booking.setStatus(BookingStatus.COMPLETED);
        booking.setReturnTime(LocalDateTime.now());
        bookingRepository.save(booking);

        // 8. Giải phóng ngăn kho: có hư hại/vệ sinh -> UNDER_MAINTENANCE; trả kho đạt chuẩn (kể cả quá hạn) -> AVAILABLE
        UnitStatus previousUnitStatus = unit != null ? unit.getStatus() : null;
        UnitStatus releasedStatus = UnitStatus.AVAILABLE;
        if (unit != null) {
            releasedStatus = HandoverUnitRelease.statusAfterReturn(damageFee, cleaningFee, doorPassed, cleanlinessPassed, smartLockPassed, sensorPassed, wallPassed);
            if (releasedStatus == UnitStatus.UNDER_MAINTENANCE) {
                log.info("Storage unit {} moved to UNDER_MAINTENANCE due to damage/inspection issues upon checkout", unit.getUnitCode());
            } else {
                log.info("Storage unit {} returned in pristine condition, released to AVAILABLE", unit.getUnitCode());
            }
            unit.setStatus(releasedStatus);
            storageUnitRepository.save(unit);
        }

        // 9. Chuyển hợp đồng thuê sang TERMINATED nếu có
        contractOpt.ifPresent(contract -> {
            if (contract.getStatus() != RentalContractStatus.TERMINATED) {
                contract.setStatus(RentalContractStatus.TERMINATED);
                rentalContractRepository.save(contract);
            }
        });

        // 10. Ghi nhận Activity Audit Trail
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
                    String.format("Khấu trừ hư hại/vệ sinh/quá hạn %s cho đơn %s", VndFormat.format(totalDeduction), booking.getBookingCode()),
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
                    String.format("Lập lệnh hoàn tiền cọc %s (Trạng thái: %s, SLA: %d ngày) cho đơn %s",
                            VndFormat.format(netRefundAmount), HandoverLabels.refundReviewStatus(reviewStatus), refundSlaDays, booking.getBookingCode()),
                    null,
                    null
            );
        }

        if (debt != null) {
            activityLogService.record(
                    facilityId,
                    ActivityAction.DAMAGE_FEE_RECORDED,
                    "CustomerDebt",
                    debt.getId(),
                    String.format("Ghi nhận công nợ %s khách còn nợ sau trả kho đơn %s", VndFormat.format(customerDebt), booking.getBookingCode()),
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
                String.format("Giải phóng ngăn kho %s về trạng thái %s sau khi nghiệm thu trả kho",
                        unit != null ? unit.getUnitCode() : "N/A", UnitAvailability.label(releasedStatus)),
                previousUnitStatus != null ? previousUnitStatus : UnitStatus.OCCUPIED,
                releasedStatus
        );

        return new SettlementOutcome(record, damageFee, cleaningFee, lostCardFee, overdueDebt, refundSlaDays,
                refundTxnId, refundMethod, refundRequest, debt);
    }

    private record RefundBankDetails(String bankName, String accountNumber, String accountName) {
    }

    private static String normalizeRefundMethod(String method) {
        String value = method == null ? "" : method.trim().toUpperCase();
        return switch (value) {
            case "VNPAY_REFUND", "CASH", "BANK_TRANSFER" -> value;
            default -> "BANK_TRANSFER";
        };
    }

    /**
     * Where the refund goes. A bank transfer needs the customer's real account; the other methods carry an honest
     * label instead of a made-up account number.
     */
    private RefundBankDetails resolveRefundBankDetails(HandoverRequest request, String method, Booking booking) {
        String customerName = booking.getCustomer() != null && booking.getCustomer().getFullName() != null
                ? booking.getCustomer().getFullName() : "Khách hàng";
        switch (method) {
            case "CASH":
                return new RefundBankDetails("Tiền mặt tại quầy", "—", customerName);
            case "VNPAY_REFUND":
                return new RefundBankDetails("VNPay (kế toán hoàn thủ công về phương thức gốc)", "—", customerName);
            default:
                String bankName = trimToNull(request.getRefundBankName());
                String rawAccount = trimToNull(request.getRefundBankAccountNumber());
                String accountName = trimToNull(request.getRefundBankAccountName());
                if (bankName == null || rawAccount == null || accountName == null) {
                    throw new AppException(ErrorCode.HANDOVER_REFUND_BANK_REQUIRED);
                }
                // Same rule as the refund flow: spaces, dots and hyphens are ignored, 6-20 digits remain.
                String accountNumber = rawAccount.replaceAll("[\\s.-]", "");
                if (bankName.length() < 2 || bankName.length() > 100 || accountName.length() < 2 || accountName.length() > 100
                        || !accountNumber.matches("\\d{6,20}")) {
                    throw new AppException(ErrorCode.HANDOVER_REFUND_BANK_REQUIRED,
                            "Số tài khoản chỉ gồm 6 đến 20 chữ số. Kiểm tra lại tên ngân hàng, số tài khoản và tên chủ tài khoản");
                }
                return new RefundBankDetails(bankName, accountNumber, accountName.toUpperCase());
        }
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static BigDecimal nonNegative(BigDecimal value) {
        return value != null && value.signum() > 0 ? value : BigDecimal.ZERO;
    }

    private int refundSlaDays(UUID facilityId) {
        if (facilityId == null) {
            return FacilityPolicyDefaults.DEPOSIT_REFUND_SLA_DAYS;
        }
        return facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(facilityId)
                .map(FacilityPolicy::getDepositRefundSlaDays)
                .orElse(FacilityPolicyDefaults.DEPOSIT_REFUND_SLA_DAYS);
    }

    private static String buildChecklistSummary(boolean door, boolean cleanliness, boolean smartLock, boolean sensor,
                                                boolean wall, String sensorLabel) {
        return String.format(
                "Cửa cuốn: %s | Vệ sinh: %s | SmartLock: %s | %s: %s | Tường vách: %s",
                door ? "Đạt" : "Không đạt",
                cleanliness ? "Sạch sẽ" : "Chưa dọn",
                smartLock ? "Tốt" : "Lỗi",
                sensorLabel,
                sensor ? "Chuẩn" : "Lỗi",
                wall ? "Nguyên vẹn" : "Hư hại"
        );
    }

    private static boolean isChecklistAllPassed(String summary) {
        return summary == null || !CHECKLIST_FAIL.matcher(summary).find();
    }

    // =========================================================================
    // HISTORY
    // =========================================================================

    @Override
    @Transactional(readOnly = true)
    public List<HandoverResponse> getByBookingId(UUID bookingId) {
        Booking booking = findBooking(bookingId);
        authorizeBookingAccess(booking);
        return handoverRecordRepository.findByBookingId(bookingId).stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    // =========================================================================
    // AMOUNTS
    // =========================================================================

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
        List<Payment> payments = paymentRepository.findAllByBooking_Id(booking.getId());
        BigDecimal fromPayments = payments.stream()
                .filter(p -> p.getPaymentType() == PaymentType.DEPOSIT && p.getStatus() == PaymentStatus.PAID)
                .map(Payment::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        if (fromPayments.compareTo(BigDecimal.ZERO) > 0) {
            return fromPayments;
        }
        boolean hasBookingPayment = payments.stream()
                .anyMatch(p -> p.getPaymentType() == PaymentType.BOOKING_PAYMENT && p.getStatus() == PaymentStatus.PAID);
        if (hasBookingPayment) {
            return getRequiredDeposit(booking, booking.getStorageUnit());
        }
        if (booking.getDepositPaid() != null && booking.getDepositPaid().compareTo(BigDecimal.ZERO) > 0) {
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
        List<Payment> payments = paymentRepository.findAllByBooking_Id(booking.getId());
        BigDecimal fromRentPayments = payments.stream()
                .filter(p -> p.getPaymentType() == PaymentType.RENTAL_FEE && p.getStatus() == PaymentStatus.PAID)
                .map(Payment::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        if (fromRentPayments.compareTo(BigDecimal.ZERO) > 0) {
            return fromRentPayments;
        }
        boolean hasBookingPayment = payments.stream()
                .anyMatch(p -> p.getPaymentType() == PaymentType.BOOKING_PAYMENT && p.getStatus() == PaymentStatus.PAID);
        if (hasBookingPayment) {
            return getRequiredFirstMonthRent(booking, booking.getStorageUnit());
        }
        return BigDecimal.ZERO;
    }

    // =========================================================================
    // MAPPING
    // =========================================================================

    /**
     * History view of a record. It never carries the access PIN or QR token: those are returned once by
     * {@link #checkIn} and afterwards only through the booking's own credentials endpoint.
     */
    private HandoverResponse mapToResponse(HandoverRecord r) {
        List<String> photos = EvidenceUrlCodec.decode(r.getEvidencePhotos());

        boolean checklistAllPassed = isChecklistAllPassed(r.getChecklistSummary());

        Integer slaDays = null;
        if (r.getBooking() != null && r.getBooking().getStorageUnit() != null
                && r.getBooking().getStorageUnit().getFacility() != null) {
            slaDays = refundSlaDays(r.getBooking().getStorageUnit().getFacility().getId());
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
                .rfidCardNumber(r.getRfidCardNumber())
                .notes(r.getNotes())
                .recordedAt(r.getRecordedAt())
                .build();
    }

    // =========================================================================
    // PIN EMAIL / IN-APP NOTIFICATION
    // =========================================================================

    private String decryptPin(Booking booking) {
        String stored = booking.getAccessPin();
        if (stored == null || stored.isBlank()) {
            return null;
        }
        try {
            String plain = encryptionService.decrypt(stored);
            if (plain != null && plain.matches("^[0-9]{4,8}$")) {
                return plain;
            }
        } catch (Exception ignored) {
            // legacy rows stored the PIN unencrypted
        }
        return stored.matches("^[0-9]{4,8}$") ? stored : null;
    }

    @Override
    public String sendHandoverPinEmail(UUID bookingId) {
        Booking booking = findBooking(bookingId);
        authorizeStaffAccess(booking);

        if (booking.getStatus() != BookingStatus.ACTIVE && booking.getStatus() != BookingStatus.OVERDUE) {
            throw new AppException(ErrorCode.HANDOVER_NOT_CHECKED_IN);
        }
        String plainPin = decryptPin(booking);
        if (plainPin == null) {
            throw new AppException(ErrorCode.HANDOVER_NOT_CHECKED_IN);
        }

        // Only ever the address on the customer's profile: the caller cannot choose where a PIN is sent.
        User customer = booking.getCustomer();
        String toEmail = customer != null ? trimToNull(customer.getEmail()) : null;
        if (toEmail == null) {
            throw new AppException(ErrorCode.HANDOVER_CUSTOMER_EMAIL_MISSING);
        }
        if (!emailService.isMailConfigured()) {
            throw new AppException(ErrorCode.EMAIL_SEND_FAILED,
                    "Hệ thống chưa cấu hình dịch vụ gửi email (SMTP) nên chưa gửi được mã PIN. Hãy đưa mã cho khách trực tiếp hoặc liên hệ quản trị viên.");
        }

        StorageUnit unit = booking.getStorageUnit();
        String unitCode = unit != null ? unit.getUnitCode() : "N/A";
        String facilityName = (unit != null && unit.getFacility() != null) ? unit.getFacility().getName() : "Boxora";

        emailService.sendNow(toEmail,
                HandoverMessageTemplates.pinEmailSubject(unitCode),
                HandoverMessageTemplates.pinEmailHtml(customer.getFullName(), booking.getBookingCode(), facilityName, unitCode, plainPin));

        activityLogService.record(
                facilityIdOf(booking),
                ActivityAction.ACCESS_CREDENTIAL_ISSUE,
                "Booking",
                booking.getId(),
                String.format("Gửi lại thông tin bàn giao kho %s tới email của khách (đơn %s)", unitCode, booking.getBookingCode()),
                null,
                null
        );
        return toEmail;
    }

    @Override
    public NotificationLogResponse sendHandoverWebNotification(UUID bookingId) {
        Booking booking = findBooking(bookingId);
        authorizeStaffAccess(booking);

        if (booking.getStatus() != BookingStatus.ACTIVE && booking.getStatus() != BookingStatus.OVERDUE) {
            throw new AppException(ErrorCode.HANDOVER_NOT_CHECKED_IN);
        }
        if (booking.getCustomer() == null) {
            throw new AppException(ErrorCode.USER_NOT_FOUND);
        }

        NotificationLog logEntity = saveInAppHandoverNotification(booking);
        return toNotificationResponse(logEntity, booking);
    }

    /** One in-app handover notification per booking; asking again returns the existing one. Never contains the PIN. */
    private NotificationLog saveInAppHandoverNotification(Booking booking) {
        Optional<NotificationLog> existing = notificationLogRepository
                .findFirstByNotificationTypeAndReferenceIdAndChannelOrderByCreatedAtDesc(
                        NotificationType.HANDOVER_PIN, booking.getId(), NotificationChannel.IN_APP);
        if (existing != null && existing.isPresent()) {
            return existing.get();
        }
        User customer = booking.getCustomer();
        StorageUnit unit = booking.getStorageUnit();
        String unitCode = unit != null ? unit.getUnitCode() : "N/A";
        String facilityName = (unit != null && unit.getFacility() != null) ? unit.getFacility().getName() : "Boxora";
        String custName = customer != null && customer.getFullName() != null ? customer.getFullName() : "Quý khách";

        return notificationLogRepository.save(NotificationLog.builder()
                .recipient(customer)
                .recipientEmail(customer != null && customer.getEmail() != null ? customer.getEmail() : "")
                .recipientName(custName)
                .facility(unit != null ? unit.getFacility() : null)
                .channel(NotificationChannel.IN_APP)
                .notificationType(NotificationType.HANDOVER_PIN)
                .referenceType("BOOKING")
                .referenceId(booking.getId())
                .title(HandoverMessageTemplates.inAppTitle(unitCode))
                .content(HandoverMessageTemplates.inAppContent(custName, unitCode, facilityName))
                .status("SENT")
                .build());
    }

    private NotificationLogResponse toNotificationResponse(NotificationLog logEntity, Booking booking) {
        StorageUnit unit = booking.getStorageUnit();
        return NotificationLogResponse.builder()
                .id(logEntity.getId())
                .recipientId(booking.getCustomer() != null ? booking.getCustomer().getId() : null)
                .recipientEmail(logEntity.getRecipientEmail())
                .recipientName(logEntity.getRecipientName())
                .facilityId(unit != null && unit.getFacility() != null ? unit.getFacility().getId() : null)
                .facilityName(unit != null && unit.getFacility() != null ? unit.getFacility().getName() : null)
                .channel(NotificationChannel.IN_APP)
                .notificationType(NotificationType.HANDOVER_PIN)
                .referenceType("BOOKING")
                .referenceId(booking.getId())
                .title(logEntity.getTitle())
                .content(logEntity.getContent())
                .status(logEntity.getStatus())
                .createdAt(logEntity.getCreatedAt() != null ? logEntity.getCreatedAt() : LocalDateTime.now())
                .readAt(logEntity.getReadAt())
                .read(logEntity.getReadAt() != null)
                .build();
    }

    // =========================================================================
    // UPLOADS / LOOKUP / CUSTOMER DEBTS
    // =========================================================================

    @Override
    public FileUploadResponse uploadEvidence(MultipartFile file, UUID bookingId) {
        UUID facilityId = null;
        if (bookingId != null) {
            Booking booking = findBooking(bookingId);
            authorizeStaffAccess(booking);
            facilityId = facilityIdOf(booking);
        }
        // The file is remembered together with the booking, so it cannot later be attached to another booking.
        return fileStorageService.storeDocument(file, "handover", bookingId, facilityId);
    }

    @Override
    @Transactional(readOnly = true)
    public HandoverLookupResponse lookupBooking(String code) {
        String raw = code == null ? "" : code.trim();
        if (raw.regionMatches(true, 0, QR_PREFIX, 0, QR_PREFIX.length())) {
            raw = raw.substring(QR_PREFIX.length()).trim();
        }
        if (raw.startsWith("#")) {
            raw = raw.substring(1).trim();
        }
        if (raw.isEmpty() || raw.length() > 80) {
            throw new AppException(ErrorCode.HANDOVER_LOOKUP_NOT_FOUND);
        }

        Optional<Booking> found = UUID_PATTERN.matcher(raw).matches()
                ? bookingRepository.findById(UUID.fromString(raw))
                : bookingRepository.findByBookingCodeIgnoreCase(raw);
        Booking booking = found.orElseThrow(() -> new AppException(ErrorCode.HANDOVER_LOOKUP_NOT_FOUND));

        // Staff of another facility get a clear "other facility" refusal; customers never reach this endpoint.
        authorizeStaffAccess(booking);

        StorageUnit unit = booking.getStorageUnit();
        User customer = booking.getCustomer();
        Facility facility = facilityOf(booking);
        BookingStatus status = booking.getStatus();
        boolean checkedIn = status != null && status != BookingStatus.CONFIRMED && status != BookingStatus.PENDING_PAYMENT
                && status != BookingStatus.PENDING_APPROVAL && status != BookingStatus.CANCELLED;

        return HandoverLookupResponse.builder()
                .id(booking.getId())
                .bookingCode(booking.getBookingCode())
                .customerId(customer != null ? customer.getId() : null)
                .customerName(customer != null ? customer.getFullName() : null)
                .customerPhone(customer != null ? customer.getPhone() : null)
                .customerEmail(customer != null ? customer.getEmail() : null)
                .storageUnitId(unit != null ? unit.getId() : null)
                .unitCode(unit != null ? unit.getUnitCode() : null)
                .floorLevel(unit != null ? unit.getFloorLevel() : null)
                .facilityId(facility != null ? facility.getId() : null)
                .facilityName(facility != null ? facility.getName() : null)
                .startDate(booking.getStartDate())
                .endDate(booking.getEndDate())
                .rentalMonths(booking.getRentalMonths())
                .totalRentalFee(booking.getTotalRentalFee())
                .depositPaid(booking.getDepositPaid())
                .depositAmount(booking.getDepositAmount())
                .paymentStatus(booking.getPaymentStatus())
                .status(status != null ? status.name() : null)
                .expectedCheckInAt(booking.getExpectedCheckInAt())
                .signingMethod(booking.getSigningMethod())
                .checkedIn(checkedIn)
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public List<CustomerDebtResponse> getCustomerDebts(UUID facilityId, String status) {
        UUID effectiveFacilityId = facilityId;
        if (facilityAccessGuard.isFacilityScoped()) {
            effectiveFacilityId = facilityAccessGuard.scopedFacilityIdOrNull();
        }
        final UUID queryFacilityId = effectiveFacilityId;
        final String queryStatus = status == null || status.isBlank() || "ALL".equalsIgnoreCase(status)
                ? null : status.trim().toUpperCase();

        org.springframework.data.jpa.domain.Specification<CustomerDebt> spec = (root, query, cb) -> {
            List<jakarta.persistence.criteria.Predicate> predicates = new ArrayList<>();
            if (queryFacilityId != null) {
                predicates.add(cb.equal(root.get("facility").get("id"), queryFacilityId));
            }
            if (queryStatus != null) {
                predicates.add(cb.equal(root.get("status"), queryStatus));
            }
            return cb.and(predicates.toArray(new jakarta.persistence.criteria.Predicate[0]));
        };
        return customerDebtRepository.findAll(spec, org.springframework.data.domain.Sort.by(
                        org.springframework.data.domain.Sort.Direction.DESC, "createdAt")).stream()
                .map(this::toDebtResponse)
                .collect(Collectors.toList());
    }

    @Override
    public CustomerDebtResponse resolveCustomerDebt(UUID debtId, String status, String note) {
        CustomerDebt debt = customerDebtRepository.findById(debtId)
                .orElseThrow(() -> new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Không tìm thấy công nợ"));
        if (debt.getFacility() != null) {
            facilityAccessGuard.checkFacilityAccess(debt.getFacility().getId());
        }
        String target = status == null ? "" : status.trim().toUpperCase();
        if (!CustomerDebt.STATUS_COLLECTED.equals(target) && !CustomerDebt.STATUS_WRITTEN_OFF.equals(target)) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Kết quả xử lý công nợ phải là \"đã thu\" hoặc \"xóa nợ\"");
        }
        if (!CustomerDebt.STATUS_OPEN.equals(debt.getStatus())) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Công nợ này đã được xử lý trước đó");
        }
        User actor = resolveStaff(null);
        debt.setStatus(target);
        debt.setResolvedBy(actor);
        debt.setResolvedAt(LocalDateTime.now());
        debt.setResolutionNote(note != null && note.length() > 500 ? note.substring(0, 500) : note);
        debt = customerDebtRepository.save(debt);

        activityLogService.record(
                debt.getFacility() != null ? debt.getFacility().getId() : null,
                ActivityAction.PAYMENT_CONFIRMED,
                "CustomerDebt",
                debt.getId(),
                String.format("Công nợ %s của khách %s được xử lý: %s", VndFormat.format(debt.getAmount()),
                        debt.getCustomer() != null ? debt.getCustomer().getFullName() : "", HandoverLabels.debtStatus(target)),
                CustomerDebt.STATUS_OPEN,
                target
        );
        return toDebtResponse(debt);
    }

    private CustomerDebtResponse toDebtResponse(CustomerDebt d) {
        Booking booking = d.getBooking();
        return CustomerDebtResponse.builder()
                .id(d.getId())
                .customerId(d.getCustomer() != null ? d.getCustomer().getId() : null)
                .customerName(d.getCustomer() != null ? d.getCustomer().getFullName() : null)
                .customerPhone(d.getCustomer() != null ? d.getCustomer().getPhone() : null)
                .bookingId(booking != null ? booking.getId() : null)
                .bookingCode(booking != null ? booking.getBookingCode() : null)
                .unitCode(booking != null && booking.getStorageUnit() != null ? booking.getStorageUnit().getUnitCode() : null)
                .facilityId(d.getFacility() != null ? d.getFacility().getId() : null)
                .facilityName(d.getFacility() != null ? d.getFacility().getName() : null)
                .handoverRecordId(d.getHandoverRecord() != null ? d.getHandoverRecord().getId() : null)
                .amount(d.getAmount())
                .reason(d.getReason())
                .status(d.getStatus())
                .createdByName(d.getCreatedBy() != null ? d.getCreatedBy().getFullName() : null)
                .createdAt(d.getCreatedAt())
                .resolvedByName(d.getResolvedBy() != null ? d.getResolvedBy().getFullName() : null)
                .resolvedAt(d.getResolvedAt())
                .resolutionNote(d.getResolutionNote())
                .build();
    }

    // =========================================================================
    // QUY TRÌNH CHECK-IN ĐỐI SOÁT 4 ĐIỀU KIỆN & NGHIỆM THU HIỆN TRƯỜNG
    // =========================================================================

    @Override
    public RentalContractResponse createOrUploadPaperContract(PaperContractCreateRequest request) {
        Booking booking = findBooking(request.getBookingId());
        authorizeStaffAccess(booking);
        StorageUnit unit = booking.getStorageUnit();
        requireCheckInStage(booking);

        String scanUrl = EvidenceUrlCodec.requireUploadedUrl(request.getPaperContractUrl());
        if (scanUrl != null) {
            fileStorageService.requireBookingEvidence(List.of(scanUrl), booking.getId(), facilityIdOf(booking));
        }

        Optional<RentalContract> existing = rentalContractRepository.findByBookingId(booking.getId());
        if (existing.isPresent() && existing.get().getSignedAt() != null && !isPaperContract(existing.get(), booking)
                && (existing.get().getStatus() == RentalContractStatus.ACTIVE
                || existing.get().getStatus() == RentalContractStatus.PENDING_ACTIVATION)) {
            throw new AppException(ErrorCode.CONTRACT_ALREADY_SIGNED,
                    "Hợp đồng đã được khách ký điện tử nên không cần bản giấy");
        }

        RentalContract contract = existing
                .orElseGet(() -> RentalContract.builder()
                        .booking(booking)
                        .customer(booking.getCustomer())
                        .unit(unit)
                        .facility(unit != null ? unit.getFacility() : null)
                        .startDate(booking.getStartDate())
                        .endDate(booking.getEndDate())
                        .monthlyFee(getRequiredFirstMonthRent(booking, unit))
                        .depositHeld(getRequiredDeposit(booking, unit))
                        .status(RentalContractStatus.PENDING_SIGNATURE)
                        .build());

        String code = (request.getContractCode() != null && !request.getContractCode().isBlank())
                ? request.getContractCode().trim()
                : (contract.getContractCode() != null ? contract.getContractCode() : "HĐ-GIAY-" + booking.getBookingCode());
        contract.setContractCode(code);
        contract.setSigningMethod("PAPER");
        if (request.getPaperOriginalLocation() != null) {
            contract.setPaperOriginalLocation(request.getPaperOriginalLocation().trim());
        }
        if (request.getNotes() != null) {
            contract.setPaperNotes(request.getNotes().trim());
        }
        if (scanUrl != null) {
            contract.setPaperContractUrl(scanUrl);
            contract.setStatus(RentalContractStatus.PENDING_VERIFICATION);
            // A replaced scan must be verified again.
            contract.setPaperVerifiedAt(null);
            contract.setPaperVerifiedBy(null);
        }
        booking.setSigningMethod("IN_PERSON");
        bookingRepository.save(booking);

        contract = rentalContractRepository.save(contract);

        UUID facilityId = facilityIdOf(booking);
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
    }

    @Override
    public RentalContractResponse verifyPaperContract(UUID bookingId, String notes) {
        Booking booking = findBooking(bookingId);
        authorizeStaffAccess(booking);
        StorageUnit unit = booking.getStorageUnit();
        RentalContract contract = rentalContractRepository.findByBookingId(booking.getId())
                .orElseThrow(() -> new AppException(ErrorCode.CONTRACT_NOT_FOUND));

        if (contract.getPaperContractUrl() == null || contract.getPaperContractUrl().isBlank()) {
            throw new AppException(ErrorCode.CONTRACT_NOT_SIGNED);
        }

        User staff = resolveStaff(null);
        boolean isBookingActive = booking.getStatus() == BookingStatus.ACTIVE;
        contract.setStatus(isBookingActive ? RentalContractStatus.ACTIVE : RentalContractStatus.PENDING_ACTIVATION);
        contract.setPaperVerifiedBy(staff);
        contract.setPaperVerifiedAt(LocalDateTime.now());
        contract.setSignedAt(LocalDateTime.now());
        if (notes != null && !notes.isBlank()) {
            contract.setPaperNotes((contract.getPaperNotes() != null ? contract.getPaperNotes() + "; " : "") + notes);
        }
        contract = rentalContractRepository.save(contract);

        UUID facilityId = (unit != null && unit.getFacility() != null) ? unit.getFacility().getId() : null;
        activityLogService.record(
                facilityId,
                ActivityAction.CONTRACT_SIGNED,
                "RentalContract",
                contract.getId(),
                String.format("Nhân viên %s đã đối chiếu chữ ký và xác minh hợp đồng giấy %s cho đơn %s",
                        staff != null ? staff.getFullName() : "Quầy", contract.getContractCode(), booking.getBookingCode()),
                RentalContractStatus.PENDING_VERIFICATION,
                RentalContractStatus.ACTIVE
        );
        return rentalContractMapper.toResponse(contract);
    }

    private void requireCheckInStage(Booking booking) {
        if (!CHECK_IN_STATUSES.contains(booking.getStatus())) {
            throw new AppException(ErrorCode.HANDOVER_BOOKING_NOT_READY,
                    "Chỉ ghi nhận hợp đồng và khoản thu tại quầy cho đơn đang chờ nhận kho (đơn đang ở trạng thái \""
                            + BookingStatusLabels.of(booking.getStatus()) + "\")");
        }
    }

    @Override
    public PaymentResponse recordManualPayment(ManualPaymentRecordRequest request) {
        Booking booking = findBooking(request.getBookingId());
        authorizeStaffAccess(booking);
        StorageUnit unit = booking.getStorageUnit();
        requireCheckInStage(booking);
        User staff = resolveStaff(null);

        if (request.getPaymentType() != PaymentType.DEPOSIT && request.getPaymentType() != PaymentType.RENTAL_FEE) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Chỉ ghi nhận khoản thu tiền cọc hoặc tiền thuê tháng đầu tại quầy");
        }

        String method = request.getPaymentMethod() == null ? "" : request.getPaymentMethod().trim().toUpperCase();
        boolean isCash = "CASH".equals(method);
        boolean isBank = "BANK_TRANSFER".equals(method);

        if (!isCash && !isBank) {
            throw new AppException(ErrorCode.INVALID_PAYMENT_METHOD);
        }

        String receiptVoucher = trimToNull(request.getReceiptVoucherCode());
        String referenceCode = trimToNull(request.getReferenceCode());
        String proofUrl = EvidenceUrlCodec.requireUploadedUrl(request.getProofDocumentUrl());
        if (proofUrl != null) {
            fileStorageService.requireBookingEvidence(List.of(proofUrl), booking.getId(), facilityIdOf(booking));
        }
        if (isCash && receiptVoucher == null) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Nhập số phiếu thu đã cấp cho khách");
        }
        if (isBank && (referenceCode == null || proofUrl == null)) {
            throw new AppException(ErrorCode.HANDOVER_PAYMENT_PROOF_REQUIRED);
        }
        if (isCash && paymentRepository.existsByReceiptVoucherCodeIgnoreCase(receiptVoucher)) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Số phiếu thu này đã được dùng cho một khoản thu khác");
        }
        if (isBank && paymentRepository.existsByReferenceCodeIgnoreCase(referenceCode)) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Mã tham chiếu ngân hàng này đã được ghi nhận cho một khoản thu khác");
        }

        // The amount may not exceed what is still owed: confirmed money plus transfers already waiting for the bank count.
        BigDecimal required = request.getPaymentType() == PaymentType.DEPOSIT
                ? getRequiredDeposit(booking, unit) : getRequiredFirstMonthRent(booking, unit);
        BigDecimal confirmed = request.getPaymentType() == PaymentType.DEPOSIT
                ? calculateTotalDepositPaid(booking) : calculateTotalFirstMonthRentPaid(booking);
        BigDecimal awaitingBank = paymentRepository.findAllByBooking_Id(booking.getId()).stream()
                .filter(p -> p.getPaymentType() == request.getPaymentType()
                        && p.getStatus() == PaymentStatus.PENDING
                        && "BANK_TRANSFER".equalsIgnoreCase(p.getPaymentMethod()))
                .map(Payment::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal remaining = required.subtract(confirmed).subtract(awaitingBank).max(BigDecimal.ZERO);
        if (request.getAmount().compareTo(remaining) > 0) {
            String message = remaining.signum() == 0
                    ? "Khoản này đã thu đủ hoặc đã có chuyển khoản đang chờ đối soát, không thể ghi nhận thêm"
                    : String.format("Số tiền vượt quá số còn phải thu (%s)", VndFormat.format(remaining));
            throw new AppException(ErrorCode.HANDOVER_PAYMENT_OVER_REMAINING, message);
        }

        String txnId = (isCash ? "CASH-" : "BANK-") + booking.getBookingCode() + "-" + System.currentTimeMillis();

        Payment payment = Payment.builder()
                .transactionId(txnId)
                .booking(booking)
                .amount(request.getAmount())
                .paymentType(request.getPaymentType())
                .paymentMethod(method)
                .paymentTime(LocalDateTime.now())
                .collectedByStaff(staff)
                .receiptVoucherCode(isCash ? receiptVoucher : null)
                .referenceCode(isBank ? referenceCode : null)
                .proofDocumentUrl(isBank ? proofUrl : null)
                .paymentNotes(request.getNotes())
                .status(isCash ? PaymentStatus.PAID : PaymentStatus.PENDING)
                .confirmedByStaff(isCash ? staff : null)
                .confirmedAt(isCash ? LocalDateTime.now() : null)
                .build();

        payment = paymentRepository.save(payment);

        if (isCash) {
            applyConfirmedPaymentToBooking(booking, payment);
        }

        UUID facilityId = facilityIdOf(booking);
        activityLogService.record(
                facilityId,
                isCash ? ActivityAction.PAYMENT_CONFIRMED : ActivityAction.PAYMENT_INITIATED,
                "Payment",
                payment.getId(),
                String.format("Ghi nhận khoản thu %s %s (%s) cho đơn %s do nhân viên %s thực hiện (Mã chứng từ: %s)",
                        HandoverLabels.paymentType(request.getPaymentType()), VndFormat.format(request.getAmount()),
                        HandoverLabels.paymentMethod(method), booking.getBookingCode(),
                        staff != null ? staff.getFullName() : "Quầy",
                        isCash ? receiptVoucher : referenceCode),
                null,
                payment.getStatus()
        );
        return paymentMapper.toResponse(payment);
    }

    /** Credits a just-confirmed counter payment to the booking's deposit / payment status. */
    private void applyConfirmedPaymentToBooking(Booking booking, Payment payment) {
        StorageUnit unit = booking.getStorageUnit();
        if (payment.getPaymentType() == PaymentType.DEPOSIT) {
            BigDecimal cur = booking.getDepositPaid() != null ? booking.getDepositPaid() : BigDecimal.ZERO;
            booking.setDepositPaid(cur.add(payment.getAmount()));
        }
        BigDecimal dep = calculateTotalDepositPaid(booking);
        BigDecimal reqDep = getRequiredDeposit(booking, unit);
        BigDecimal rent = calculateTotalFirstMonthRentPaid(booking);
        BigDecimal reqRent = getRequiredFirstMonthRent(booking, unit);
        boolean fullyPaid = dep.compareTo(reqDep) >= 0 && rent.compareTo(reqRent) >= 0;
        booking.setPaymentStatus(fullyPaid ? "PAID" : "PARTIALLY_PAID");
        booking.setHoldExpiresAt(null);
        bookingRepository.save(booking);
    }

    @Override
    public PaymentResponse confirmBankTransferPayment(UUID paymentId, String notes) {
        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new AppException(ErrorCode.PAYMENT_NOT_FOUND, "Không tìm thấy giao dịch"));
        Booking booking = payment.getBooking();
        if (booking == null) {
            throw new AppException(ErrorCode.HANDOVER_PAYMENT_NOT_PENDING_TRANSFER);
        }
        authorizeStaffAccess(booking);

        if (!"BANK_TRANSFER".equalsIgnoreCase(payment.getPaymentMethod())
                || payment.getStatus() != PaymentStatus.PENDING
                || (payment.getPaymentType() != PaymentType.DEPOSIT && payment.getPaymentType() != PaymentType.RENTAL_FEE)) {
            throw new AppException(ErrorCode.HANDOVER_PAYMENT_NOT_PENDING_TRANSFER);
        }
        if (trimToNull(payment.getReferenceCode()) == null || trimToNull(payment.getProofDocumentUrl()) == null) {
            throw new AppException(ErrorCode.HANDOVER_PAYMENT_PROOF_REQUIRED);
        }

        User staff = resolveStaff(null);
        payment.setStatus(PaymentStatus.PAID);
        payment.setConfirmedByStaff(staff);
        payment.setConfirmedAt(LocalDateTime.now());
        if (notes != null && !notes.isBlank()) {
            payment.setPaymentNotes((payment.getPaymentNotes() != null ? payment.getPaymentNotes() + "; " : "") + notes);
        }
        payment = paymentRepository.save(payment);

        applyConfirmedPaymentToBooking(booking, payment);

        activityLogService.record(
                facilityIdOf(booking),
                ActivityAction.PAYMENT_CONFIRMED,
                "Payment",
                payment.getId(),
                String.format("Nhân viên %s đối soát và xác nhận tiền chuyển khoản %s (%s) đã vào tài khoản",
                        staff != null ? staff.getFullName() : "Kế toán", VndFormat.format(payment.getAmount()), payment.getReferenceCode()),
                PaymentStatus.PENDING,
                PaymentStatus.PAID
        );
        return paymentMapper.toResponse(payment);
    }

    @Override
    public HandoverPrerequisitesResponse verifyIdentity(IdentityVerifyRequest request) {
        Booking booking = findBooking(request.getBookingId());
        authorizeStaffAccess(booking);

        if (!IdentityDocuments.isSupportedType(request.getIdCardType())) {
            throw new AppException(ErrorCode.HANDOVER_IDENTITY_FORMAT_INVALID);
        }
        String idType = IdentityDocuments.normalizeType(request.getIdCardType());
        if (!IdentityDocuments.isValidNumber(idType, request.getIdCardNumber())) {
            throw new AppException(ErrorCode.HANDOVER_IDENTITY_FORMAT_INVALID);
        }

        User staff = resolveStaff(null);
        booking.setIdentityCardType(idType);
        booking.setIdentityCardNumber(IdentityDocuments.normalizeNumber(idType, request.getIdCardNumber()));
        booking.setIdentityVerifiedByStaff(staff);
        booking.setIdentityVerifiedAt(LocalDateTime.now());
        booking.setIdentityVerificationNotes(request.getNotes());
        booking = bookingRepository.save(booking);

        activityLogService.record(
                facilityIdOf(booking),
                ActivityAction.CHECKIN_VERIFIED,
                "Booking",
                booking.getId(),
                String.format("Nhân viên %s đã đối chiếu giấy tờ gốc %s của khách hàng %s",
                        staff != null ? staff.getFullName() : "Quầy",
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
        Booking booking = findBooking(bookingId);
        User staff = resolveStaff(null);
        String stepLog = String.format("[%s] Hoàn tất đối soát 4 điều kiện bởi nhân viên %s. Chuyển sang bước Nghiệm thu hiện trường.\n",
                LocalDateTime.now(), staff != null ? staff.getFullName() : "Quầy");
        booking.setStepTransitionHistory((booking.getStepTransitionHistory() != null ? booking.getStepTransitionHistory() : "") + stepLog);
        bookingRepository.save(booking);
    }

    @Override
    public HandoverResponse recordCheckInInspection(CheckInInspectionRequest request) {
        HandoverPrerequisitesResponse prereq = getCheckInPrerequisites(request.getBookingId());
        if (!prereq.isEligibleForInspection()) {
            throw new AppException(ErrorCode.CHECKIN_STEP_NOT_SATISFIED);
        }
        Booking booking = findBooking(request.getBookingId());
        if (booking.getStatus() == BookingStatus.ACTIVE) {
            throw new AppException(ErrorCode.HANDOVER_ALREADY_ACTIVE);
        }
        StorageUnit unit = booking.getStorageUnit();
        User staff = resolveStaff(null);

        boolean doorPassed = Boolean.TRUE.equals(request.getDoorConditionPassed());
        boolean cleanlinessPassed = Boolean.TRUE.equals(request.getCleanlinessPassed());
        boolean smartLockPassed = Boolean.TRUE.equals(request.getSmartLockPassed());
        boolean sensorPassed = Boolean.TRUE.equals(request.getSensorPassed());
        boolean wallPassed = Boolean.TRUE.equals(request.getWallStructurePassed());

        if (!(doorPassed && cleanlinessPassed && smartLockPassed && sensorPassed && wallPassed)) {
            throw new AppException(ErrorCode.HANDOVER_INSPECTION_REQUIRED,
                    "Kho chưa đạt đủ 5/5 tiêu chí nghiệm thu nên chưa thể bàn giao. Hãy xử lý hạng mục chưa đạt rồi nghiệm thu lại");
        }

        List<String> photos = EvidenceUrlCodec.requireUploadedUrls(request.getEvidencePhotos());
        if (photos.size() < MIN_EVIDENCE_PHOTOS) {
            throw new AppException(ErrorCode.HANDOVER_INSPECTION_REQUIRED,
                    "Cần tối thiểu " + MIN_EVIDENCE_PHOTOS + " ảnh hiện trạng kho đã tải lên hệ thống trước khi lưu nghiệm thu");
        }
        // The files must exist and belong to this booking: a typed-in /uploads/handover/... path is not evidence.
        fileStorageService.requireBookingEvidence(photos, booking.getId(), facilityIdOf(booking));

        String checklistSummary = buildChecklistSummary(doorPassed, cleanlinessPassed, smartLockPassed, sensorPassed, wallPassed, "Cảm biến IoT");

        HandoverRecord record = HandoverRecord.builder()
                .booking(booking)
                .staff(staff)
                .recordType("CHECK_IN_INSPECTION")
                .unitCondition(request.getUnitCondition() != null ? request.getUnitCondition() : "Đạt chuẩn 5/5 kiểm định hiện trường")
                .checklistSummary(checklistSummary)
                .evidencePhotos(EvidenceUrlCodec.encode(photos))
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
}

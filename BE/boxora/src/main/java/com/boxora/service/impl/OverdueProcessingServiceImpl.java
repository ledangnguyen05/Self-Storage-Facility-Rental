package com.boxora.service.impl;

import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.UnsealRequest;
import com.boxora.dto.response.OverdueContractDetail;
import com.boxora.dto.response.OverdueProcessResult;
import com.boxora.dto.response.SealingRecordResponse;
import com.boxora.entity.*;
import com.boxora.enums.*;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.mapper.SealingRecordMapper;
import com.boxora.repository.*;
import com.boxora.security.FacilityAccessGuard;
import com.boxora.security.RequestContext;
import com.boxora.service.ActivityLogService;
import com.boxora.service.OverdueProcessingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class OverdueProcessingServiceImpl implements OverdueProcessingService {

    private final RentalContractRepository rentalContractRepository;
    private final FacilityPolicyRepository facilityPolicyRepository;
    private final BookingRepository bookingRepository;
    private final StorageUnitRepository storageUnitRepository;
    private final SealingRecordRepository sealingRecordRepository;
    private final UserRepository userRepository;
    private final SealingRecordMapper sealingRecordMapper;
    private final ActivityLogService activityLogService;
    private final ActivityLogRepository activityLogRepository;
    private final FacilityAccessGuard facilityAccessGuard;
    private final RequestContext requestContext;

    /**
     * Cron Job chạy định kỳ mỗi ngày (mặc định 1:00 AM) để xử lý các hợp đồng quá hạn.
     */
    @Scheduled(cron = "${app.scheduling.overdue-cron:0 0 1 * * ?}")
    public void runDailyOverdueCron() {
        log.info("[CRON] Starting daily automated overdue scan...");
        try {
            OverdueProcessResult result = processOverdueContracts(LocalDate.now());
            log.info("[CRON] Overdue scan completed. Scanned: {}, Late Penalty: {}, Credentials Revoked in Boxora: {}, Sealing Eligible: {}",
                    result.getScannedOverdueContractsCount(),
                    result.getLatePenaltyCount(),
                    result.getPinDisabledCount(),
                    result.getSealingEligibleCount());
        } catch (Exception e) {
            log.error("[CRON] Error during daily automated overdue scan", e);
        }
    }

    /**
     * Scheduled Boxora credential cleanup for expired contracts.
     */
    @Scheduled(cron = "${app.scheduling.credential-cleanup-cron:0 0 2 * * ?}")
    @Transactional
    public void cleanupExpiredCredentials() {
        log.info("[CRON] Starting daily automated credential cleanup for expired contracts...");
        try {
            LocalDate today = LocalDate.now();
            List<RentalContract> expiredContracts = rentalContractRepository.findActiveOrOverdueContractsBeforeDate(today);
            for (RentalContract contract : expiredContracts) {
                Facility facility = contract.getFacility();
                StorageUnit unit = contract.getUnit();
                Booking booking = contract.getBooking();
                if (facility == null || unit == null || unit.getFacility() == null
                        || !facility.getId().equals(unit.getFacility().getId()) || booking == null
                        || (booking.getStatus() != BookingStatus.ACTIVE && booking.getStatus() != BookingStatus.OVERDUE)
                        || !isRecognizedPaymentStatus(booking.getPaymentStatus())
                        || "REFUNDED".equalsIgnoreCase(booking.getPaymentStatus())) {
                    continue;
                }
                FacilityPolicy policy = facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(facility.getId()).orElse(null);
                if (policy == null || policy.getOverdueAccessDisableDays() == null
                        || policy.getOverdueAccessDisableDays() < 0) {
                    continue;
                }
                long overdueDays = ChronoUnit.DAYS.between(contract.getEndDate(), today);
                boolean credentialsNeedRevocation = booking.getAccessPin() != null
                        || (booking.getQrAccessToken() != null && !booking.getQrAccessToken().startsWith("REVOKED"));
                if (overdueDays >= policy.getOverdueAccessDisableDays() && credentialsNeedRevocation) {
                    booking.setAccessPin(null);
                    booking.setQrAccessToken("REVOKED_EXPIRED");
                    bookingRepository.save(booking);
                    activityLogService.recordSystem(
                            facility.getId(),
                            ActivityAction.ACCESS_CREDENTIAL_REVOKE,
                            "Booking",
                            booking.getId(),
                            "PIN/QR credentials revoked in Boxora for unit " + unit.getUnitCode()
                                    + " because contract " + contract.getContractCode()
                                    + " passed the facility policy threshold; physical lock state is unverified."
                    );
                }
            }
        } catch (Exception e) {
            log.error("[CRON] Error during automated credential cleanup: {}", e.getMessage(), e);
        }
    }

    /**
     * Scans overdue contracts, revokes stored credentials at the facility threshold, and reports sealing eligibility.
     * Physical sealing remains a witnessed on-site workflow.
     */
    @Override
    @Transactional
    public OverdueProcessResult processOverdueContracts(LocalDate referenceDate) {
        LocalDate today = (referenceDate != null) ? referenceDate : LocalDate.now();
        log.info("Processing overdue contracts with reference date: {}", today);

        UUID scopedFacilityId = facilityAccessGuard.isFacilityScoped()
                ? facilityAccessGuard.scopedFacilityIdOrNull()
                : null;
        List<RentalContract> overdueContracts = rentalContractRepository
                .findActiveOrOverdueContractsBeforeDate(today).stream()
                .filter(contract -> scopedFacilityId == null
                        || (contract.getFacility() != null && scopedFacilityId.equals(contract.getFacility().getId())))
                .toList();

        int penaltyCount = 0;
        int pinLockCount = 0;
        int sealedCount = 0;
        int sealingEligibleCount = 0;
        List<OverdueContractDetail> details = new ArrayList<>();

        for (RentalContract contract : overdueContracts) {
            long overdueDays = ChronoUnit.DAYS.between(contract.getEndDate(), today);
            if (overdueDays < 1) {
                continue;
            }

            StorageUnit unit = contract.getUnit();
            Facility facility = contract.getFacility();
            Booking booking = contract.getBooking();

            if (facility == null || unit == null || unit.getFacility() == null
                    || !facility.getId().equals(unit.getFacility().getId())) {
                log.warn("Skipping overdue contract {} with missing or mismatched facility/unit scope", contract.getId());
                continue;
            }

            FacilityPolicy policy = facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(facility.getId()).orElse(null);

            if (booking != null && ((booking.getStatus() != BookingStatus.ACTIVE
                    && booking.getStatus() != BookingStatus.OVERDUE)
                    || !isRecognizedPaymentStatus(booking.getPaymentStatus()))) {
                log.info("Skipping overdue processing for booking {} with inactive or unreconciled status", booking.getId());
                continue;
            }

            boolean latePenaltyApplied = false;
            BigDecimal latePenaltyAmount = BigDecimal.ZERO;
            boolean pinAccessDisabled = false;
            boolean unitSealed = sealingRecordRepository
                    .existsByStorageUnit_IdAndStatus(unit.getId(), SealingStatus.SEALED);
            String sealTagNumber = null;
            List<String> actions = new ArrayList<>();

            // =========================================================================
            // MỐC 1: +1 NGÀY QUÁ HẠN -> Phạt 5% trên tiền thuê tháng (Idempotent)
            // =========================================================================
            if (overdueDays >= 1) {
                contract.setStatus(RentalContractStatus.OVERDUE);
                BigDecimal monthlyFee = contract.getMonthlyFee() != null
                        ? contract.getMonthlyFee() : BigDecimal.ZERO;
                latePenaltyAmount = monthlyFee.multiply(new BigDecimal("0.05"));

                boolean alreadyPenalized = activityLogRepository.existsByResourceIdAndAction(
                        contract.getId(), ActivityAction.OVERDUE_DETECTED);

                if (!alreadyPenalized) {
                    latePenaltyApplied = true;
                    penaltyCount++;
                    actions.add(String.format("Áp dụng phạt 5%% tiền thuê trễ hạn (+1 ngày): %s VNĐ", latePenaltyAmount));

                    activityLogService.recordSystem(
                            facility != null ? facility.getId() : null,
                            ActivityAction.OVERDUE_DETECTED,
                            "RentalContract",
                            contract.getId(),
                            String.format("Hợp đồng %s quá hạn %d ngày (+1 ngày). Phạt 5%% tiền thuê: %s VNĐ",
                                    contract.getContractCode(), overdueDays, latePenaltyAmount)
                    );
                } else {
                    latePenaltyApplied = true;
                    actions.add(String.format("Khoản phạt 5%% trễ hạn (%s VNĐ) đã được ghi nhận trước đó.", latePenaltyAmount));
                }
            }

            // =========================================================================
            // MỐC 2: +3 NGÀY QUÁ HẠN -> Khóa mã PIN / thu hồi quyền truy cập (Idempotent)
            // =========================================================================
            if (booking != null && policy != null && policy.getOverdueAccessDisableDays() != null
                    && overdueDays >= policy.getOverdueAccessDisableDays()) {
                boolean alreadyDisabled = booking.getAccessPin() == null
                        && "REVOKED_OVERDUE".equals(booking.getQrAccessToken());
                if (alreadyDisabled) {
                    pinAccessDisabled = true;
                    actions.add("PIN/QR credentials were already revoked in Boxora; physical lock state is unverified.");
                } else if ((booking.getStatus() == BookingStatus.ACTIVE || booking.getStatus() == BookingStatus.OVERDUE)
                        && isRecognizedPaymentStatus(booking.getPaymentStatus())
                        && !"REFUNDED".equalsIgnoreCase(booking.getPaymentStatus())) {
                    booking.setStatus(BookingStatus.OVERDUE);
                    booking.setAccessPin(null);
                    booking.setQrAccessToken("REVOKED_OVERDUE");
                    bookingRepository.save(booking);

                    pinAccessDisabled = true;
                    pinLockCount++;
                    actions.add("PIN/QR credentials revoked in Boxora; physical lock state is unverified.");
                    activityLogService.recordSystem(
                            facility.getId(),
                            ActivityAction.OVERDUE_ACCESS_DISABLED,
                            "Booking",
                            booking.getId(),
                            String.format("Contract %s is %d days overdue. PIN/QR credentials revoked in Boxora for unit %s; physical lock state is unverified.",
                                    contract.getContractCode(), overdueDays, unit.getUnitCode())
                    );
                } else {
                    actions.add("Skipped credential revocation for cancelled or refunded booking.");
                }
            }
            if (policy != null && policy.getOverdueSealingDays() != null && policy.getOverdueSealingDays() >= 0
                    && overdueDays >= policy.getOverdueSealingDays()) {
                sealingEligibleCount++;
                actions.add("Eligible for on-site sealing under the facility policy; no physical sealing was performed by this scan.");
            }
            rentalContractRepository.save(contract);

            OverdueContractDetail detail = OverdueContractDetail.builder()
                    .contractId(contract.getId())
                    .contractCode(contract.getContractCode())
                    .customerId(contract.getCustomer() != null ? contract.getCustomer().getId() : null)
                    .customerName(contract.getCustomer() != null ? contract.getCustomer().getFullName() : "N/A")
                    .customerEmail(contract.getCustomer() != null ? contract.getCustomer().getEmail() : "N/A")
                    .storageUnitId(unit != null ? unit.getId() : null)
                    .unitCode(unit != null ? unit.getUnitCode() : "N/A")
                    .facilityId(facility != null ? facility.getId() : null)
                    .facilityName(facility != null ? facility.getName() : "N/A")
                    .endDate(contract.getEndDate())
                    .overdueDays(overdueDays)
                    .monthlyFee(contract.getMonthlyFee())
                    .contractStatus(contract.getStatus())
                    .latePenaltyApplied(latePenaltyApplied)
                    .latePenaltyAmount(latePenaltyAmount)
                    .pinAccessDisabled(pinAccessDisabled)
                    .unitSealed(unitSealed)
                    .physicalLockState("UNVERIFIED")
                    .sealTagNumber(sealTagNumber)
                    .actionSummary(String.join("; ", actions))
                    .build();

            details.add(detail);
        }

        return OverdueProcessResult.builder()
                .executionTime(LocalDateTime.now())
                .scannedOverdueContractsCount(details.size())
                .latePenaltyCount(penaltyCount)
                .pinDisabledCount(pinLockCount)
                .sealedUnitsCount(sealedCount)
                .sealingEligibleCount(sealingEligibleCount)
                .details(details)
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public List<OverdueContractDetail> getOverdueContractsSummary() {
        LocalDate today = LocalDate.now();
        UUID scopedFacilityId = facilityAccessGuard.isFacilityScoped()
                ? facilityAccessGuard.scopedFacilityIdOrNull()
                : null;
        List<RentalContract> list = rentalContractRepository.findActiveOrOverdueContractsBeforeDate(today);

        return list.stream()
                .filter(contract -> contract.getFacility() != null
                        && (scopedFacilityId == null || scopedFacilityId.equals(contract.getFacility().getId())))
                .filter(contract -> contract.getBooking() == null
                        || ((contract.getBooking().getStatus() == BookingStatus.ACTIVE
                        || contract.getBooking().getStatus() == BookingStatus.OVERDUE)
                        && isRecognizedPaymentStatus(contract.getBooking().getPaymentStatus())))
                .map(contract -> {
                    long overdueDays = ChronoUnit.DAYS.between(contract.getEndDate(), today);
                    Booking booking = contract.getBooking();
                    StorageUnit unit = contract.getUnit();
                    boolean penaltyRecorded = activityLogRepository.existsByResourceIdAndAction(
                            contract.getId(), ActivityAction.OVERDUE_DETECTED);
                    boolean credentialsRevoked = booking != null && booking.getAccessPin() == null
                            && booking.getQrAccessToken() != null && booking.getQrAccessToken().startsWith("REVOKED");
                    boolean sealingRecordExists = unit != null && sealingRecordRepository
                            .existsByStorageUnit_IdAndStatus(unit.getId(), SealingStatus.SEALED);

                    return OverdueContractDetail.builder()
                            .contractId(contract.getId())
                            .contractCode(contract.getContractCode())
                            .customerId(contract.getCustomer() != null ? contract.getCustomer().getId() : null)
                            .customerName(contract.getCustomer() != null ? contract.getCustomer().getFullName() : null)
                            .customerEmail(contract.getCustomer() != null ? contract.getCustomer().getEmail() : null)
                            .storageUnitId(unit != null ? unit.getId() : null)
                            .unitCode(unit != null ? unit.getUnitCode() : null)
                            .facilityId(contract.getFacility().getId())
                            .facilityName(contract.getFacility().getName())
                            .endDate(contract.getEndDate())
                            .overdueDays(overdueDays)
                            .monthlyFee(contract.getMonthlyFee())
                            .contractStatus(contract.getStatus())
                            .latePenaltyApplied(penaltyRecorded)
                            .latePenaltyAmount(null)
                            .pinAccessDisabled(credentialsRevoked)
                            .unitSealed(sealingRecordExists)
                            .physicalLockState("UNVERIFIED")
                            .actionSummary(String.format(
                                    "%d days overdue. Fee record: %s. Boxora PIN/QR revoked: %s. Sealing record exists: %s. Physical lock state: unverified.",
                                    overdueDays, penaltyRecorded, credentialsRevoked, sealingRecordExists))
                            .build();
                })
                .toList();
    }
    @Override
    @Transactional(readOnly = true)
    public PageResponse<SealingRecordResponse> getAllSealingRecords(
            UUID facilityId, SealingStatus status, int page, int size
    ) {
        UUID scopedFacilityId = facilityAccessGuard.isFacilityScoped()
                ? facilityAccessGuard.scopedFacilityIdOrNull()
                : facilityId;

        Pageable pageable = PageRequest.of(page, size, Sort.by("sealedAt").descending());

        Page<SealingRecordResponse> result = sealingRecordRepository
                .findAllWithFilters(scopedFacilityId, status, pageable)
                .map(sealingRecordMapper::toResponse);

        return PageResponse.from(result);
    }

    @Override
    @Transactional(readOnly = true)
    public SealingRecordResponse getSealingRecordById(UUID id) {
        SealingRecord record = sealingRecordRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.SEALING_RECORD_NOT_FOUND));

        if (record.getFacility() == null) {
            throw new AppException(ErrorCode.FACILITY_ACCESS_DENIED);
        }
        facilityAccessGuard.checkFacilityAccess(record.getFacility().getId());

        return sealingRecordMapper.toResponse(record);
    }

    @Override
    @Transactional
    public SealingRecordResponse unsealUnit(UUID sealingRecordId, UnsealRequest request) {
        log.info("Unsealing unit for record id={}", sealingRecordId);

        SealingRecord record = sealingRecordRepository.findById(sealingRecordId)
                .orElseThrow(() -> new AppException(ErrorCode.SEALING_RECORD_NOT_FOUND));

        if (record.getStatus() == SealingStatus.UNSEALED) {
            throw new AppException(ErrorCode.SEALING_ALREADY_UNSEALED);
        }

        if (record.getFacility() == null) {
            throw new AppException(ErrorCode.FACILITY_ACCESS_DENIED);
        }
        facilityAccessGuard.checkFacilityAccess(record.getFacility().getId());

        UUID currentUserId = requestContext.currentUserId();
        User unsealedBy = currentUserId != null ? userRepository.findById(currentUserId).orElse(null) : null;
        if (unsealedBy == null || !Boolean.TRUE.equals(unsealedBy.getIsActive())) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }
        if (!isFacilityOperator(unsealedBy, record.getFacility())) {
            throw new AppException(ErrorCode.FACILITY_ACCESS_DENIED);
        }

        record.setStatus(SealingStatus.UNSEALED);
        record.setUnsealedAt(LocalDateTime.now());
        record.setUnsealedBy(unsealedBy);
        record.setUnsealReason(request.getUnsealReason().trim());
        if (request.getPhotoEvidenceUrl() != null) {
            record.setPhotoEvidenceUrl(request.getPhotoEvidenceUrl().trim());
        }
        if (request.getNotes() != null && !request.getNotes().isBlank()) {
            record.setNotes((record.getNotes() != null ? record.getNotes() + "\n" : "") + request.getNotes().trim());
        }

        // Mở lại trạng thái kho
        StorageUnit unit = record.getStorageUnit();
        if (unit != null) {
            RentalContract contract = record.getContract();
            if (contract != null && contract.getEndDate() != null && !LocalDate.now().isAfter(contract.getEndDate())) {
                unit.setStatus(UnitStatus.OCCUPIED);
                contract.setStatus(RentalContractStatus.ACTIVE);
            } else {
                unit.setStatus(UnitStatus.AVAILABLE);
                if (contract != null) {
                    contract.setStatus(RentalContractStatus.EXPIRED);
                }
            }
            storageUnitRepository.save(unit);
            if (contract != null) {
                rentalContractRepository.save(contract);
            }
        }

        SealingRecord saved = sealingRecordRepository.save(record);

        activityLogService.record(
                record.getFacility().getId(),
                ActivityAction.OVERDUE_UNIT_LOCKED,
                "SealingRecord",
                saved.getId(),
                String.format("Gỡ niêm phong kho %s (Tem: %s). Lý do: %s",
                        unit != null ? unit.getUnitCode() : "",
                        saved.getSealTagNumber(),
                        request.getUnsealReason()),
                SealingStatus.SEALED.name(),
                SealingStatus.UNSEALED.name()
        );

        return sealingRecordMapper.toResponse(saved);
    }

    @Override
    @Transactional
    public com.boxora.dto.response.LockoutResponse lockoutContract(UUID contractId, String reason) {
        RentalContract contract = rentalContractRepository.findById(contractId)
                .orElseThrow(() -> new AppException(ErrorCode.CONTRACT_NOT_FOUND));

        Facility facility = contract.getFacility();
        if (facility == null) {
            throw new AppException(ErrorCode.FACILITY_ACCESS_DENIED);
        }
        facilityAccessGuard.checkFacilityAccess(facility.getId());

        StorageUnit unit = contract.getUnit();
        if (unit == null || unit.getFacility() == null || !facility.getId().equals(unit.getFacility().getId())) {
            throw new AppException(ErrorCode.FACILITY_ACCESS_DENIED);
        }

        UUID operatorId = requestContext != null ? requestContext.currentUserId() : null;
        User operator = operatorId != null ? userRepository.findById(operatorId).orElse(null) : null;
        if (operator == null || !Boolean.TRUE.equals(operator.getIsActive())) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }
        if (!isFacilityOperator(operator, facility)) {
            throw new AppException(ErrorCode.FACILITY_ACCESS_DENIED);
        }

        if (contract.getStatus() != RentalContractStatus.ACTIVE
                && contract.getStatus() != RentalContractStatus.OVERDUE
                && contract.getStatus() != RentalContractStatus.EXPIRED) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Only active or expired rental contracts can be locked out for overdue access");
        }
        if (contract.getEndDate() == null || !contract.getEndDate().isBefore(LocalDate.now())) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "The contract must be past its end date before PIN/QR revocation");
        }
        if (contract.getMonthlyFee() == null || contract.getMonthlyFee().compareTo(BigDecimal.ZERO) <= 0) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "A valid contract rent amount is required before PIN/QR revocation");
        }

        FacilityPolicy policy = facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(facility.getId())
                .orElseThrow(() -> new AppException(ErrorCode.FACILITY_POLICY_NOT_FOUND));
        if (policy.getOverdueAccessDisableDays() == null || policy.getOverdueAccessDisableDays() < 0) {
            throw new AppException(ErrorCode.FACILITY_POLICY_NOT_FOUND, "The active facility policy has no PIN/QR revocation threshold");
        }
        long overdueDays = ChronoUnit.DAYS.between(contract.getEndDate(), LocalDate.now());
        if (overdueDays < policy.getOverdueAccessDisableDays()) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "The facility policy PIN/QR revocation threshold has not been reached");
        }

        Booking booking = contract.getBooking();
        if (booking == null) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "A booking is required to revoke stored PIN/QR credentials");
        }
        if (booking != null) {
            if (booking.getStorageUnit() == null || !unit.getId().equals(booking.getStorageUnit().getId())) {
                throw new AppException(ErrorCode.INVALID_REQUEST, "The booking and contract units do not match");
            }
            if ((booking.getStatus() != BookingStatus.ACTIVE && booking.getStatus() != BookingStatus.OVERDUE)
                    || "REFUNDED".equalsIgnoreCase(booking.getPaymentStatus())) {
                throw new AppException(ErrorCode.INVALID_REQUEST, "Only active, non-refunded bookings can have overdue credentials revoked");
            }
            String paymentStatus = booking.getPaymentStatus();
            if (paymentStatus == null || !("UNPAID".equalsIgnoreCase(paymentStatus)
                    || "PARTIALLY_PAID".equalsIgnoreCase(paymentStatus)
                    || "PAID".equalsIgnoreCase(paymentStatus))) {
                throw new AppException(ErrorCode.INVALID_REQUEST, "The booking payment status is not reconciled");
            }
        }

        // Idempotency: nếu đã khóa rồi thì trả về kết quả thành công ngay
        boolean alreadyLocked = (booking != null && booking.getAccessPin() == null && "REVOKED_OVERDUE".equals(booking.getQrAccessToken()));
        if (alreadyLocked) {
            log.info("[LOCKOUT_IDEMPOTENT] Contract {} and booking {} are already locked out.",
                    contract.getContractCode(), booking != null ? booking.getBookingCode() : "N/A");
            return com.boxora.dto.response.LockoutResponse.builder()
                    .contractId(contract.getId())
                    .contractCode(contract.getContractCode())
                    .bookingId(booking != null ? booking.getId() : null)
                    .unitCode(unit != null ? unit.getUnitCode() : "N/A")
                    .status("SUCCESS")
                    .message("PIN/QR credentials were already revoked in Boxora; physical lock state is unverified.")
                    .reason(reason != null ? reason : "Quá hạn thanh toán cước thuê")
                    .lockedAt(booking != null && booking.getPinUpdatedAt() != null ? booking.getPinUpdatedAt() : LocalDateTime.now())
                    .pinRevoked(true)
                    .physicalLockState("UNVERIFIED")
                    .build();
        }

        LocalDateTime now = LocalDateTime.now();

        if (booking != null) {
            booking.setStatus(BookingStatus.OVERDUE);
            booking.setAccessPin(null);
            booking.setQrAccessToken("REVOKED_OVERDUE");
            booking.setPinUpdatedAt(now);
            bookingRepository.save(booking);
        }

        if (unit != null) {
            unit.setStatus(UnitStatus.OVERDUE_LOCKED);
            storageUnitRepository.save(unit);
        }

        contract.setStatus(RentalContractStatus.OVERDUE);
        rentalContractRepository.save(contract);

        // Ghi Audit Trail
        String operatorIdentifier = requestContext.currentUserEmail() != null ? requestContext.currentUserEmail() : operatorId.toString();
        String lockoutReason = (reason != null && !reason.isBlank()) ? reason : "Overdue PIN/QR credential revocation";

        activityLogService.record(
                facility != null ? facility.getId() : null,
                ActivityAction.OVERDUE_ACCESS_DISABLED,
                "RentalContract",
                contract.getId(),
                String.format("Operator %s revoked PIN/QR credentials for unit %s under contract %s. Physical lock state is unverified. Reason: %s",
                        operatorIdentifier, unit != null ? unit.getUnitCode() : "N/A", contract.getContractCode(), lockoutReason),
                null,
                BookingStatus.OVERDUE
        );

        return com.boxora.dto.response.LockoutResponse.builder()
                .contractId(contract.getId())
                .contractCode(contract.getContractCode())
                .bookingId(booking != null ? booking.getId() : null)
                .unitCode(unit != null ? unit.getUnitCode() : "N/A")
                .status("SUCCESS")
                .message("PIN/QR credentials were revoked in Boxora; physical lock state is unverified.")
                .reason(lockoutReason)
                .lockedAt(now)
                .pinRevoked(true)
                .physicalLockState("UNVERIFIED")
                .build();
    }
    private boolean isRecognizedPaymentStatus(String paymentStatus) {
        return "UNPAID".equalsIgnoreCase(paymentStatus)
                || "PARTIALLY_PAID".equalsIgnoreCase(paymentStatus)
                || "PAID".equalsIgnoreCase(paymentStatus);
    }

    private boolean isFacilityOperator(User user, Facility facility) {
        String roleName = user.getRole() != null ? user.getRole().getName() : null;
        return facility != null && user.getFacility() != null
                && facility.getId().equals(user.getFacility().getId())
                && ("FACILITY_MANAGER".equalsIgnoreCase(roleName) || "STAFF".equalsIgnoreCase(roleName));
    }
}

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
    private final BookingRepository bookingRepository;
    private final StorageUnitRepository storageUnitRepository;
    private final SealingRecordRepository sealingRecordRepository;
    private final UserRepository userRepository;
    private final SealingRecordMapper sealingRecordMapper;
    private final ActivityLogService activityLogService;
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
            log.info("[CRON] Overdue scan completed. Scanned: {}, Late Penalty: {}, PIN Locked: {}, Sealed: {}",
                    result.getScannedOverdueContractsCount(),
                    result.getLatePenaltyCount(),
                    result.getPinDisabledCount(),
                    result.getSealedUnitsCount());
        } catch (Exception e) {
            log.error("[CRON] Error during daily automated overdue scan", e);
        }
    }

    /**
     * Nghiệp vụ chính: Quét và xử lý hợp đồng quá hạn theo mốc (+1 phạt 5%, +3 khóa PIN, +7 niêm phong BR-RULE-012).
     */
    @Override
    @Transactional
    public OverdueProcessResult processOverdueContracts(LocalDate referenceDate) {
        LocalDate today = (referenceDate != null) ? referenceDate : LocalDate.now();
        log.info("Processing overdue contracts with reference date: {}", today);

        List<RentalContract> overdueContracts = rentalContractRepository
                .findActiveOrOverdueContractsBeforeDate(today);

        int penaltyCount = 0;
        int pinLockCount = 0;
        int sealedCount = 0;
        List<OverdueContractDetail> details = new ArrayList<>();

        for (RentalContract contract : overdueContracts) {
            long overdueDays = ChronoUnit.DAYS.between(contract.getEndDate(), today);
            if (overdueDays < 1) {
                continue;
            }

            StorageUnit unit = contract.getUnit();
            Facility facility = contract.getFacility();
            Booking booking = contract.getBooking();

            boolean latePenaltyApplied = false;
            BigDecimal latePenaltyAmount = BigDecimal.ZERO;
            boolean pinAccessDisabled = false;
            boolean unitSealed = false;
            String sealTagNumber = null;
            List<String> actions = new ArrayList<>();

            // =========================================================================
            // MỐC 1: +1 NGÀY QUÁ HẠN -> Phạt 5% trên tiền thuê tháng
            // =========================================================================
            if (overdueDays >= 1) {
                contract.setStatus(RentalContractStatus.OVERDUE);
                BigDecimal monthlyFee = contract.getMonthlyFee() != null
                        ? contract.getMonthlyFee() : BigDecimal.ZERO;
                latePenaltyAmount = monthlyFee.multiply(new BigDecimal("0.05"));
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
            }

            // =========================================================================
            // MỐC 2: +3 NGÀY QUÁ HẠN -> Khóa mã PIN / thu hồi quyền truy cập
            // =========================================================================
            if (overdueDays >= 3) {
                if (booking != null) {
                    booking.setStatus(BookingStatus.OVERDUE);
                    booking.setAccessPin(null); // Khóa PIN
                    booking.setQrAccessToken("REVOKED_OVERDUE");
                    bookingRepository.save(booking);
                }
                pinAccessDisabled = true;
                pinLockCount++;
                actions.add("Đã khóa mã PIN và vô hiệu hóa mã QR truy cập (+3 ngày)");

                activityLogService.recordSystem(
                        facility != null ? facility.getId() : null,
                        ActivityAction.OVERDUE_ACCESS_DISABLED,
                        "Booking",
                        booking != null ? booking.getId() : contract.getId(),
                        String.format("Hợp đồng %s quá hạn %d ngày (+3 ngày). Đã khóa quyền truy cập PIN/QR kho %s",
                                contract.getContractCode(), overdueDays, unit != null ? unit.getUnitCode() : "N/A")
                );
            }

            // =========================================================================
            // MỐC 3: +7 NGÀY QUÁ HẠN -> Niêm phong kho (Sealing Record BR-RULE-012)
            // =========================================================================
            if (overdueDays >= 7 && unit != null) {
                boolean alreadySealed = sealingRecordRepository
                        .existsByStorageUnit_IdAndStatus(unit.getId(), SealingStatus.SEALED);

                if (!alreadySealed) {
                    User sealedBy = findSealedByUser(facility);
                    User witness = findWitnessUser(facility, sealedBy);

                    sealTagNumber = String.format("SEAL-%d-%s-%04d",
                            today.getYear(),
                            unit.getUnitCode() != null ? unit.getUnitCode() : "UNIT",
                            (System.currentTimeMillis() % 10000));

                    SealingRecord sealingRecord = SealingRecord.builder()
                            .storageUnit(unit)
                            .contract(contract)
                            .facility(facility)
                            .sealTagNumber(sealTagNumber)
                            .reason(String.format("Quá hạn hợp đồng %s %d ngày (+7 ngày theo BR-RULE-012). Tự động niêm phong bảo toàn tài sản.",
                                    contract.getContractCode(), overdueDays))
                            .sealedAt(LocalDateTime.now())
                            .sealedBy(sealedBy)
                            .witness(witness)
                            .status(SealingStatus.SEALED)
                            .notes("Hệ thống tự động lập biên bản niêm phong kho qua Overdue Cron Job.")
                            .build();

                    sealingRecordRepository.save(sealingRecord);

                    // Đổi trạng thái kho sang UNDER_MAINTENANCE để ngăn cấp phát mới
                    unit.setStatus(UnitStatus.UNDER_MAINTENANCE);
                    storageUnitRepository.save(unit);

                    unitSealed = true;
                    sealedCount++;
                    actions.add(String.format("Đã lập biên bản niêm phong %s và khóa kho (+7 ngày theo BR-RULE-012)", sealTagNumber));

                    activityLogService.recordSystem(
                            facility != null ? facility.getId() : null,
                            ActivityAction.OVERDUE_SEALING_APPROVED,
                            "SealingRecord",
                            sealingRecord.getId(),
                            String.format("Hợp đồng %s quá hạn %d ngày (+7 ngày). Đã niêm phong kho %s, số tem: %s",
                                    contract.getContractCode(), overdueDays, unit.getUnitCode(), sealTagNumber)
                    );
                } else {
                    unitSealed = true;
                    actions.add("Kho đã trong trạng thái niêm phong trước đó.");
                }
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
                    .sealTagNumber(sealTagNumber)
                    .actionSummary(String.join("; ", actions))
                    .build();

            details.add(detail);
        }

        return OverdueProcessResult.builder()
                .executionTime(LocalDateTime.now())
                .scannedOverdueContractsCount(overdueContracts.size())
                .latePenaltyCount(penaltyCount)
                .pinDisabledCount(pinLockCount)
                .sealedUnitsCount(sealedCount)
                .details(details)
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public List<OverdueContractDetail> getOverdueContractsSummary() {
        LocalDate today = LocalDate.now();
        List<RentalContract> list = rentalContractRepository.findActiveOrOverdueContractsBeforeDate(today);

        return list.stream().map(c -> {
            long overdueDays = ChronoUnit.DAYS.between(c.getEndDate(), today);
            boolean isSealed = c.getUnit() != null && sealingRecordRepository
                    .existsByStorageUnit_IdAndStatus(c.getUnit().getId(), SealingStatus.SEALED);

            BigDecimal latePenalty = c.getMonthlyFee() != null
                    ? c.getMonthlyFee().multiply(new BigDecimal("0.05")) : BigDecimal.ZERO;

            return OverdueContractDetail.builder()
                    .contractId(c.getId())
                    .contractCode(c.getContractCode())
                    .customerId(c.getCustomer() != null ? c.getCustomer().getId() : null)
                    .customerName(c.getCustomer() != null ? c.getCustomer().getFullName() : "N/A")
                    .customerEmail(c.getCustomer() != null ? c.getCustomer().getEmail() : "N/A")
                    .storageUnitId(c.getUnit() != null ? c.getUnit().getId() : null)
                    .unitCode(c.getUnit() != null ? c.getUnit().getUnitCode() : "N/A")
                    .facilityId(c.getFacility() != null ? c.getFacility().getId() : null)
                    .facilityName(c.getFacility() != null ? c.getFacility().getName() : "N/A")
                    .endDate(c.getEndDate())
                    .overdueDays(overdueDays)
                    .monthlyFee(c.getMonthlyFee())
                    .contractStatus(c.getStatus())
                    .latePenaltyApplied(overdueDays >= 1)
                    .latePenaltyAmount(latePenalty)
                    .pinAccessDisabled(overdueDays >= 3)
                    .unitSealed(isSealed || overdueDays >= 7)
                    .actionSummary(String.format("Quá hạn %d ngày. Giai đoạn: %s",
                            overdueDays,
                            overdueDays >= 7 ? "Mốc +7 (Niêm phong)" :
                            overdueDays >= 3 ? "Mốc +3 (Khóa PIN)" : "Mốc +1 (Phạt 5%)"))
                    .build();
        }).toList();
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

        facilityAccessGuard.checkFacilityAccess(record.getFacility().getId());

        User unsealedBy = null;
        UUID currentUserId = requestContext.currentUserId();
        if (currentUserId != null) {
            unsealedBy = userRepository.findById(currentUserId).orElse(null);
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
            unit.setStatus(UnitStatus.AVAILABLE);
            storageUnitRepository.save(unit);
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

    private User findSealedByUser(Facility facility) {
        if (facility != null) {
            List<User> managers = userRepository.findAll().stream()
                    .filter(u -> u.getRole() != null && "FACILITY_MANAGER".equalsIgnoreCase(u.getRole().getName()))
                    .filter(u -> u.getFacility() != null && u.getFacility().getId().equals(facility.getId()))
                    .toList();
            if (!managers.isEmpty()) {
                return managers.get(0);
            }
        }
        return userRepository.findAll().stream()
                .filter(u -> u.getRole() != null && "ADMIN".equalsIgnoreCase(u.getRole().getName()))
                .findFirst()
                .orElseGet(() -> userRepository.findAll().stream().findFirst().orElse(null));
    }

    private User findWitnessUser(Facility facility, User sealedBy) {
        if (facility != null) {
            List<User> staffList = userRepository.findAll().stream()
                    .filter(u -> u.getRole() != null && "STAFF".equalsIgnoreCase(u.getRole().getName()))
                    .filter(u -> u.getFacility() != null && u.getFacility().getId().equals(facility.getId()))
                    .filter(u -> sealedBy == null || !u.getId().equals(sealedBy.getId()))
                    .toList();
            if (!staffList.isEmpty()) {
                return staffList.get(0);
            }
        }
        return userRepository.findAll().stream()
                .filter(u -> sealedBy == null || !u.getId().equals(sealedBy.getId()))
                .findFirst()
                .orElse(sealedBy);
    }
}

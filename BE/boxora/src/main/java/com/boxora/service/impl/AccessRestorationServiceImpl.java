package com.boxora.service.impl;

import com.boxora.dto.response.AccessRestorationResponse;
import com.boxora.entity.Booking;
import com.boxora.entity.Facility;
import com.boxora.entity.OverdueCase;
import com.boxora.entity.RentalContract;
import com.boxora.entity.SealingRecord;
import com.boxora.entity.StorageUnit;
import com.boxora.entity.User;
import com.boxora.enums.ActivityAction;
import com.boxora.enums.BookingStatus;
import com.boxora.enums.NotificationType;
import com.boxora.enums.OverdueCaseStatus;
import com.boxora.enums.RentalContractStatus;
import com.boxora.enums.SealingStatus;
import com.boxora.enums.UnitStatus;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.repository.BookingRepository;
import com.boxora.repository.OverdueCaseRepository;
import com.boxora.repository.RentalContractRepository;
import com.boxora.repository.SealingRecordRepository;
import com.boxora.repository.StorageUnitRepository;
import com.boxora.service.AccessRestorationService;
import com.boxora.service.ActivityLogService;
import com.boxora.service.EncryptionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Lifts an overdue lockout (contract 3). Used by the payment / renewal flows once a payment settles an overdue
 * contract, by the manager action "Mở khóa truy cập" and by unsealing.
 *
 * <p>Rules: a sealed unit is never reopened here (the seal is a physical protocol a manager removes first). The
 * booking goes back to ACTIVE with a freshly issued PIN/QR, the unit to OCCUPIED. The contract returns to ACTIVE
 * only when its end date is today or later (renewed); otherwise the debt is still open, the contract stays OVERDUE
 * and a reprieve date stops the nightly job from locking access again straight away.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AccessRestorationServiceImpl implements AccessRestorationService {

    public static final int DEFAULT_ACCESS_HOLD_DAYS = 3;
    public static final int MAX_ACCESS_HOLD_DAYS = 30;
    private static final DateTimeFormatter VN_DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final SecureRandom RANDOM = new SecureRandom();

    private final RentalContractRepository rentalContractRepository;
    private final BookingRepository bookingRepository;
    private final StorageUnitRepository storageUnitRepository;
    private final SealingRecordRepository sealingRecordRepository;
    private final OverdueCaseRepository overdueCaseRepository;
    private final EncryptionService encryptionService;
    private final ActivityLogService activityLogService;
    private final OverdueNotificationSender notificationSender;

    /**
     * Called after a successful payment. Never throws: the payment is already recorded and must not be rolled
     * back because access could not be reopened (the reason is logged and the manager can still act).
     */
    @Override
    @Transactional
    public void restoreAccessAfterSettlement(UUID contractId, String reason) {
        if (contractId == null) {
            return;
        }
        try {
            RentalContract contract = rentalContractRepository.findById(contractId).orElse(null);
            if (contract == null) {
                log.warn("[ACCESS_RESTORE] Contract {} not found, nothing to restore", contractId);
                return;
            }
            String why = reason != null && !reason.isBlank() ? reason.trim() : "Khách hàng đã thanh toán công nợ";
            restore(contract, why, null, false, false);
        } catch (RuntimeException e) {
            log.error("[ACCESS_RESTORE] Could not restore access of contract {} after settlement: {}", contractId, e.getMessage(), e);
        }
    }

    /** Manager action "Mở khóa truy cập". Throws when nothing is locked or the unit is sealed. */
    @Transactional
    public AccessRestorationResponse restoreByManager(RentalContract contract, String reason, LocalDate holdUntil) {
        return restore(contract, reason, validateHold(holdUntil), true, false);
    }

    /** After a seal was removed: reopen access whatever the lock flags say (the unit was locked by the seal). */
    @Transactional
    public AccessRestorationResponse restoreAfterUnseal(RentalContract contract, String reason, LocalDate holdUntil) {
        return restore(contract, reason, validateHold(holdUntil), false, true);
    }

    /** True when the tenant cannot open the unit because of debt. */
    public static boolean isAccessLocked(RentalContract contract) {
        if (contract == null) {
            return false;
        }
        Booking booking = contract.getBooking();
        StorageUnit unit = contract.getUnit();
        boolean bookingLocked = booking != null && (booking.getStatus() == BookingStatus.OVERDUE
                || (booking.getAccessPin() == null && isRevokedForDebt(booking.getQrAccessToken())));
        boolean unitLocked = unit != null && unit.getStatus() == UnitStatus.OVERDUE_LOCKED;
        return bookingLocked || unitLocked || contract.getStatus() == RentalContractStatus.OVERDUE_LOCKED;
    }

    /**
     * True for a contract marked EXPIRED whose tenant never returned the unit (booking still ACTIVE / OVERDUE): it is
     * treated as overdue (ledger, late fee, lockout, sealing), never as an ended contract.
     */
    public static boolean isHeldAfterExpiry(RentalContract contract) {
        if (contract == null || contract.getStatus() != RentalContractStatus.EXPIRED) {
            return false;
        }
        Booking booking = contract.getBooking();
        return booking != null && (booking.getStatus() == BookingStatus.ACTIVE || booking.getStatus() == BookingStatus.OVERDUE);
    }

    private static boolean isRevokedForDebt(String qrToken) {
        return qrToken != null && (qrToken.startsWith("REVOKED_OVERDUE") || qrToken.startsWith("REVOKED_EXPIRED"));
    }

    private LocalDate validateHold(LocalDate holdUntil) {
        if (holdUntil == null) {
            return null;
        }
        LocalDate today = LocalDate.now();
        if (holdUntil.isBefore(today) || holdUntil.isAfter(today.plusDays(MAX_ACCESS_HOLD_DAYS))) {
            throw new AppException(ErrorCode.OVERDUE_HOLD_DATE_INVALID);
        }
        return holdUntil;
    }

    private AccessRestorationResponse restore(RentalContract contract, String reason, LocalDate holdUntil,
                                              boolean manual, boolean afterUnseal) {
        LocalDate today = LocalDate.now();
        StorageUnit unit = contract.getUnit();
        Booking booking = contract.getBooking();
        String unitCode = unit != null ? unit.getUnitCode() : null;
        UUID facilityId = contract.getFacility() != null ? contract.getFacility().getId() : null;

        if (!afterUnseal) {
            Optional<SealingRecord> seal = sealingRecordRepository
                    .findFirstByContract_IdAndStatusOrderBySealedAtDesc(contract.getId(), SealingStatus.SEALED);
            if (seal.isEmpty() && unit != null) {
                seal = sealingRecordRepository.findFirstByStorageUnit_IdAndStatusOrderBySealedAtDesc(unit.getId(), SealingStatus.SEALED);
            }
            if (seal.isPresent()) {
                if (manual) {
                    throw new AppException(ErrorCode.OVERDUE_UNIT_SEALED);
                }
                activityLogService.record(facilityId, ActivityAction.OVERDUE_DETECTED, "RentalContract", contract.getId(),
                        String.format("Đã ghi nhận thanh toán cho hợp đồng %s nhưng kho %s đang niêm phong (biên bản %s). "
                                        + "Quản lý cần gỡ niêm phong để mở lại quyền truy cập. Ghi chú: %s",
                                contract.getContractCode(), nullToDash(unitCode), seal.get().getProtocolNumber(), reason),
                        null, null);
                return baseResponse(contract).sealed(true)
                        .message("Kho đang niêm phong. Quản lý cần gỡ niêm phong để mở lại quyền truy cập.")
                        .build();
            }
        }

        boolean renewed = contract.getEndDate() != null && !contract.getEndDate().isBefore(today);
        boolean wasLocked = afterUnseal || isAccessLocked(contract) || contract.getStatus() == RentalContractStatus.OVERDUE;
        if (manual && !isAccessLocked(contract)) {
            throw new AppException(ErrorCode.OVERDUE_ACCESS_NOT_LOCKED);
        }
        if (!wasLocked) {
            if (renewed) {
                settleOpenCase(contract, reason);
            }
            return baseResponse(contract).accessRestored(true).settled(renewed)
                    .message("Quyền truy cập kho không bị khóa.").build();
        }

        LocalDateTime now = LocalDateTime.now();
        boolean pinReissued = false;
        if (booking != null) {
            if (booking.getStatus() == BookingStatus.OVERDUE) {
                booking.setStatus(BookingStatus.ACTIVE);
            }
            if (booking.getStatus() == BookingStatus.ACTIVE && booking.getAccessPin() == null) {
                String plainPin = String.format("%06d", RANDOM.nextInt(1_000_000));
                booking.setAccessPin(encryptionService.encrypt(plainPin));
                booking.setQrAccessToken("QR-" + UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase());
                booking.setPinUpdatedAt(now);
                pinReissued = true;
            }
            bookingRepository.save(booking);
        }

        if (unit != null && unit.getStatus() == UnitStatus.OVERDUE_LOCKED) {
            unit.setStatus(UnitStatus.OCCUPIED);
            storageUnitRepository.save(unit);
        }

        LocalDate effectiveHold = null;
        if (renewed) {
            contract.setStatus(RentalContractStatus.ACTIVE);
            rentalContractRepository.save(contract);
            settleOpenCase(contract, reason);
        } else {
            if (contract.getStatus() == RentalContractStatus.OVERDUE_LOCKED || contract.getStatus() == RentalContractStatus.ACTIVE
                    || isHeldAfterExpiry(contract)) {
                contract.setStatus(RentalContractStatus.OVERDUE);
                rentalContractRepository.save(contract);
            }
            effectiveHold = holdUntil != null ? holdUntil : today.plusDays(DEFAULT_ACCESS_HOLD_DAYS);
            OverdueCase overdueCase = openCase(contract);
            overdueCase.setAccessHoldUntil(effectiveHold);
            overdueCase.setAccessRestoredAt(now);
            overdueCaseRepository.save(overdueCase);
        }

        String description = String.format("Mở lại quyền truy cập kho %s theo hợp đồng %s%s%s. Lý do: %s",
                nullToDash(unitCode), contract.getContractCode(),
                pinReissued ? ", đã cấp mã PIN mới cho khách" : "",
                effectiveHold != null ? ", còn nợ quá hạn nên chỉ giữ quyền truy cập đến " + effectiveHold.format(VN_DATE) : "",
                reason);
        activityLogService.record(facilityId, ActivityAction.ACCESS_CREDENTIAL_ISSUE, "RentalContract", contract.getId(),
                description, null, contract.getStatus().name());

        String message;
        if (renewed) {
            message = pinReissued
                    ? "Đã mở lại quyền truy cập và cấp mã PIN mới. Khách xem mã trong cổng khách hàng."
                    : "Đã mở lại quyền truy cập kho.";
        } else {
            message = "Đã mở lại quyền truy cập đến " + effectiveHold.format(VN_DATE)
                    + ". Hợp đồng vẫn quá hạn cho tới khi khách gia hạn hoặc thanh toán đủ.";
        }
        // The tenant must not find the door open (or still dead) without notice. A settlement already sends its own payment
        // confirmation, and unsealing sends the unsealing notice, so only the manager action also emails.
        OverdueNotificationSender.Outcome notice = afterUnseal ? null
                : notifyRestored(contract, renewed, effectiveHold, pinReissued, manual);
        return baseResponse(contract)
                .accessRestored(booking == null || booking.getStatus() == BookingStatus.ACTIVE)
                .pinReissued(pinReissued)
                .settled(renewed)
                .accessHoldUntil(effectiveHold)
                .message(message)
                .customerNotified(notice != null && manual ? notice.sent() : null)
                .notificationMessage(notice != null ? describe(notice, manual) : null)
                .build();
    }

    /** In-app notification (always) and, for the manager action, an email telling the tenant access is open again. Never throws. */
    private OverdueNotificationSender.Outcome notifyRestored(RentalContract contract, boolean renewed, LocalDate hold,
                                                             boolean pinReissued, boolean sendEmail) {
        try {
            User customer = contract.getCustomer();
            Facility facility = contract.getFacility();
            String unitCode = nullToDash(contract.getUnit() != null ? contract.getUnit().getUnitCode() : null);
            String title = "Quyền truy cập kho " + unitCode + " đã được mở lại";
            String summary = renewed
                    ? "Quyền truy cập kho " + unitCode + " theo hợp đồng " + contract.getContractCode() + " đã được mở lại."
                    + (pinReissued ? " Mã PIN mới đã được cấp, bạn xem mã trong mục Kho của tôi." : "")
                    : "Quyền truy cập kho " + unitCode + " theo hợp đồng " + contract.getContractCode() + " đã được mở lại đến ngày "
                    + (hold != null ? hold.format(VN_DATE) : "—") + ". Hợp đồng vẫn quá hạn, vui lòng gia hạn hoặc thanh toán trước ngày này để không bị khóa lại.";
            List<Map.Entry<String, String>> rows = new ArrayList<>();
            rows.add(Map.entry("Hợp đồng", contract.getContractCode()));
            rows.add(Map.entry("Kho", unitCode));
            rows.add(Map.entry("Cơ sở", facility != null ? facility.getName() : "—"));
            if (!renewed && hold != null) {
                rows.add(Map.entry("Giữ quyền truy cập đến", hold.format(VN_DATE)));
            }
            List<String> closing = new ArrayList<>();
            if (pinReissued) {
                closing.add("Mã PIN cũ đã bị thu hồi. Bạn xem mã PIN mới trong cổng khách hàng Boxora, mục Kho của tôi.");
            }
            if (!renewed) {
                closing.add("Bạn có thể gia hạn hợp đồng trong cổng khách hàng Boxora hoặc thanh toán tại quầy.");
            }
            closing.add(OverdueNotificationSender.facilityContact(facility));
            String html = notificationSender.render(title,
                    "Xin chào " + OverdueNotificationSender.displayName(customer) + ", " + summary, rows, closing);
            return notificationSender.notifyCustomer(customer, facility, NotificationType.OVERDUE_NOTICE, "RentalContract",
                    contract.getId(), sendEmail, "[Boxora] " + title, title, summary, html);
        } catch (RuntimeException e) {
            log.warn("[ACCESS_RESTORE] Could not notify the tenant of contract {}: {}", contract.getId(), e.getMessage());
            return null;
        }
    }

    private static String describe(OverdueNotificationSender.Outcome notice, boolean emailAttempted) {
        if (!emailAttempted) {
            return "Đã thông báo cho khách trong cổng khách hàng.";
        }
        return notice.sent()
                ? "Đã gửi email tới " + notice.recipientEmail() + " và thông báo trong cổng khách hàng."
                : "Đã thông báo trong cổng khách hàng. Chưa gửi được email" + (notice.error() != null ? ": " + notice.error() : "") + ".";
    }

    private OverdueCase openCase(RentalContract contract) {
        return overdueCaseRepository.findFirstByContract_IdAndStatus(contract.getId(), OverdueCaseStatus.OPEN)
                .orElseGet(() -> OverdueCase.builder()
                        .contract(contract)
                        .facility(contract.getFacility())
                        .dueDate(contract.getEndDate())
                        .status(OverdueCaseStatus.OPEN)
                        .build());
    }

    private void settleOpenCase(RentalContract contract, String reason) {
        overdueCaseRepository.findFirstByContract_IdAndStatus(contract.getId(), OverdueCaseStatus.OPEN).ifPresent(oc -> {
            oc.setStatus(OverdueCaseStatus.SETTLED);
            oc.setResolvedAt(LocalDateTime.now());
            oc.setAccessHoldUntil(null);
            oc.setResolutionNote(truncate(reason, 500));
            overdueCaseRepository.save(oc);
        });
    }

    private AccessRestorationResponse.AccessRestorationResponseBuilder baseResponse(RentalContract contract) {
        Booking booking = contract.getBooking();
        StorageUnit unit = contract.getUnit();
        return AccessRestorationResponse.builder()
                .contractId(contract.getId())
                .contractCode(contract.getContractCode())
                .unitCode(unit != null ? unit.getUnitCode() : null)
                .contractStatus(contract.getStatus() != null ? contract.getStatus().name() : null)
                .bookingStatus(booking != null && booking.getStatus() != null ? booking.getStatus().name() : null)
                .unitStatus(unit != null && unit.getStatus() != null ? unit.getStatus().name() : null);
    }

    static String nullToDash(String value) {
        return value != null && !value.isBlank() ? value : "—";
    }

    static String truncate(String value, int max) {
        if (value == null) {
            return null;
        }
        return value.length() <= max ? value : value.substring(0, max);
    }
}

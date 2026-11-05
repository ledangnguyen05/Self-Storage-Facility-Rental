package com.boxora.service.impl;

import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.OverduePinActionRequest;
import com.boxora.dto.request.OverduePinTempGrantRequest;
import com.boxora.dto.request.OverdueLiquidateReleaseRequest;
import com.boxora.dto.request.OverdueSettlementRequest;
import com.boxora.dto.request.OverdueSealingWorkflowRequest;
import com.boxora.dto.request.OverdueSendReminderRequest;
import com.boxora.dto.response.OverdueContractDetailResponse;
import com.boxora.dto.response.OverdueContractItemResponse;
import com.boxora.dto.response.OverdueSummaryResponse;
import com.boxora.entity.*;
import com.boxora.enums.*;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.integration.smartlock.SmartLockAdapter;
import com.boxora.repository.*;
import com.boxora.security.FacilityAccessGuard;
import com.boxora.security.RequestContext;
import com.boxora.service.ActivityLogService;
import com.boxora.service.EmailService;
import com.boxora.service.OverdueDebtCalculationService;
import com.boxora.service.OverdueManagementService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.PrintWriter;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class OverdueManagementServiceImpl implements OverdueManagementService {

    private final RentalContractRepository rentalContractRepository;
    private final FacilityPolicyRepository facilityPolicyRepository;
    private final BookingRepository bookingRepository;
    private final StorageUnitRepository storageUnitRepository;
    private final SealingRecordRepository sealingRecordRepository;
    private final UserRepository userRepository;
    private final PaymentRepository paymentRepository;
    private final HandoverRecordRepository handoverRecordRepository;
    private final RefundRequestRepository refundRequestRepository;

    private final OverdueNoticeLogRepository overdueNoticeLogRepository;
    private final PinRevocationRequestRepository pinRevocationRequestRepository;
    private final AssetInventoryItemRepository assetInventoryItemRepository;
    private final OverdueAuditLogRepository overdueAuditLogRepository;

    private final OverdueDebtCalculationService overdueDebtCalculationService;
    private final SmartLockAdapter smartLockAdapter;
    private final FacilityAccessGuard facilityAccessGuard;
    private final RequestContext requestContext;
    private final EmailService emailService;
    private final ActivityLogService activityLogService;
    private final NotificationLogRepository notificationLogRepository;

    @Override
    @Transactional(readOnly = true)
    public OverdueSummaryResponse getOverdueSummary(UUID facilityId) {
        UUID effectiveFacilityId = resolveFacilityId(facilityId);
        LocalDate today = LocalDate.now(OverdueDebtCalculationService.VN_ZONE);

        List<RentalContract> contracts = getScopedOverdueContracts(effectiveFacilityId, today);
        Map<UUID, FacilityPolicy> policyCache = new HashMap<>();

        long totalOverdueContracts = 0;
        BigDecimal totalOverdueDebt = BigDecimal.ZERO;
        BigDecimal totalPrincipalDebt = BigDecimal.ZERO;
        BigDecimal totalLateFees = BigDecimal.ZERO;
        BigDecimal totalCustomerRefundAmount = BigDecimal.ZERO;
        BigDecimal totalDepositHeld = BigDecimal.ZERO;
        BigDecimal unverifiedPaymentsAmount = BigDecimal.ZERO;
        long unverifiedPaymentsCount = 0;

        long graceCount = 0;
        long warningCount = 0;
        long pinThresholdCount = 0;
        long sealingThresholdCount = 0;
        long policyUnconfiguredCount = 0;

        long pendingPinRevocationsCount = 0;
        long pendingSealingApprovalsCount = 0;
        long eligibleLiquidationReleaseCount = 0;

        for (RentalContract contract : contracts) {
            UUID facId = contract.getFacility() != null ? contract.getFacility().getId() : null;
            FacilityPolicy policy = facId != null
                    ? policyCache.computeIfAbsent(facId, id -> facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(id).orElse(null))
                    : null;

            var calc = overdueDebtCalculationService.calculateOverdueDebt(contract, policy, today);
            if (calc.overdueDays() < 1) {
                continue;
            }

            totalOverdueContracts++;
            totalPrincipalDebt = totalPrincipalDebt.add(calc.principalDebt());
            totalLateFees = totalLateFees.add(calc.lateFee());
            totalOverdueDebt = totalOverdueDebt.add(calc.totalDebt());
            if (calc.customerRefundAmount() != null) {
                totalCustomerRefundAmount = totalCustomerRefundAmount.add(calc.customerRefundAmount());
            }
            if (calc.depositHeld() != null) {
                totalDepositHeld = totalDepositHeld.add(calc.depositHeld());
            }

            if (calc.unverifiedAmount() != null && calc.unverifiedAmount().compareTo(BigDecimal.ZERO) > 0) {
                unverifiedPaymentsAmount = unverifiedPaymentsAmount.add(calc.unverifiedAmount());
                unverifiedPaymentsCount++;
            }

            switch (calc.stage()) {
                case GRACE_PERIOD -> graceCount++;
                case WARNING -> warningCount++;
                case PIN_REVOCATION -> pinThresholdCount++;
                case SEALING_ELIGIBLE -> sealingThresholdCount++;
                case POLICY_UNCONFIGURED -> policyUnconfiguredCount++;
            }

            if (contract.getOverduePinStatus() == OverduePinStatus.PIN_REVOCATION_PENDING) {
                pendingPinRevocationsCount++;
            }
            if (contract.getOverdueSealingStatus() == OverdueSealingStatus.SEALING_REQUESTED) {
                pendingSealingApprovalsCount++;
            }

            // Kiểm tra buồng kho có thể giải phóng do hết hạn mức giữ kho (0 ngày)
            if (calc.totalDebt() != null && calc.totalDebt().compareTo(BigDecimal.ZERO) > 0) {
                var sealingOpt = sealingRecordRepository.findFirstByContract_IdOrderByCreatedAtDesc(contract.getId());
                if (sealingOpt.isPresent()) {
                    var items = assetInventoryItemRepository.findBySealingRecord_Id(sealingOpt.get().getId());
                    if (items != null && !items.isEmpty()) {
                        BigDecimal totalLiq = BigDecimal.ZERO;
                        for (var it : items) {
                            BigDecimal val = it.getEstimatedValue() != null ? it.getEstimatedValue() : BigDecimal.ZERO;
                            int qty = it.getQuantity() != null ? it.getQuantity() : 1;
                            totalLiq = totalLiq.add(val.multiply(BigDecimal.valueOf(qty)));
                        }
                        BigDecimal dailyPenalty = calc.dailyLateFee() != null && calc.dailyLateFee().compareTo(BigDecimal.ZERO) > 0
                                ? calc.dailyLateFee()
                                : (calc.dailyRentalPrice() != null ? calc.dailyRentalPrice() : BigDecimal.ZERO);
                        BigDecimal remainingVal = totalLiq.subtract(calc.totalDebt());
                        long estDays = 0L;
                        if (dailyPenalty.compareTo(BigDecimal.ZERO) > 0 && remainingVal.compareTo(BigDecimal.ZERO) > 0) {
                            estDays = remainingVal.divide(dailyPenalty, 0, RoundingMode.FLOOR).longValue();
                        }
                        if (estDays == 0L) {
                            eligibleLiquidationReleaseCount++;
                        }
                    }
                }
            }
        }

        long settledCount = 0;
        try {
            List<OverdueAuditLog> settledLogs = new ArrayList<>();
            settledLogs.addAll(overdueAuditLogRepository.findByActionOrderByCreatedAtDesc("OVERDUE_SETTLED_COMPLETED"));
            settledLogs.addAll(overdueAuditLogRepository.findByActionOrderByCreatedAtDesc("OVERDUE_LIQUIDATION_RELEASE"));
            if (effectiveFacilityId != null) {
                settledCount = settledLogs.stream()
                        .filter(l -> l.getContract() != null && l.getContract().getFacility() != null && effectiveFacilityId.equals(l.getContract().getFacility().getId()))
                        .map(l -> l.getContract().getId())
                        .distinct()
                        .count();
            } else {
                settledCount = settledLogs.stream()
                        .filter(l -> l.getContract() != null)
                        .map(l -> l.getContract().getId())
                        .distinct()
                        .count();
            }
        } catch (Exception ignored) {}

        return OverdueSummaryResponse.builder()
                .asOfDate(today)
                .totalOverdueContracts(totalOverdueContracts)
                .totalOverdueDebt(totalOverdueDebt)
                .totalPrincipalDebt(totalPrincipalDebt)
                .totalLateFees(totalLateFees)
                .totalCustomerRefundAmount(totalCustomerRefundAmount)
                .totalDepositHeld(totalDepositHeld)
                .unverifiedPaymentsAmount(unverifiedPaymentsAmount)
                .unverifiedPaymentsCount(unverifiedPaymentsCount)
                .graceCount(graceCount)
                .warningCount(warningCount)
                .pinThresholdCount(pinThresholdCount)
                .sealingThresholdCount(sealingThresholdCount)
                .policyUnconfiguredCount(policyUnconfiguredCount)
                .pendingPinRevocationsCount(pendingPinRevocationsCount)
                .pendingSealingApprovalsCount(pendingSealingApprovalsCount)
                .eligibleLiquidationReleaseCount(eligibleLiquidationReleaseCount)
                .settledCount(settledCount)
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<OverdueContractItemResponse> getOverdueContracts(
            UUID facilityId,
            String stage,
            Integer minDays,
            Integer maxDays,
            String pinStatus,
            String sealingStatus,
            String searchTerm,
            Boolean isDemo,
            int page,
            int size
    ) {
        UUID effectiveFacilityId = resolveFacilityId(facilityId);
        LocalDate today = LocalDate.now(OverdueDebtCalculationService.VN_ZONE);

        if ("SETTLED".equalsIgnoreCase(stage)) {
            List<OverdueAuditLog> settledLogs = new ArrayList<>();
            settledLogs.addAll(overdueAuditLogRepository.findByActionOrderByCreatedAtDesc("OVERDUE_SETTLED_COMPLETED"));
            settledLogs.addAll(overdueAuditLogRepository.findByActionOrderByCreatedAtDesc("OVERDUE_LIQUIDATION_RELEASE"));
            List<OverdueContractItemResponse> settledItems = new ArrayList<>();
            Set<UUID> seenContracts = new HashSet<>();
            for (OverdueAuditLog logItem : settledLogs) {
                RentalContract c = logItem.getContract();
                if (c == null || seenContracts.contains(c.getId())) {
                    continue;
                }
                seenContracts.add(c.getId());
                if (effectiveFacilityId != null && c.getFacility() != null && !effectiveFacilityId.equals(c.getFacility().getId())) {
                    continue;
                }
                if (isDemo != null && !Objects.equals(c.getIsDemo(), isDemo)) {
                    continue;
                }
                if (searchTerm != null && !searchTerm.trim().isEmpty()) {
                    String term = searchTerm.trim().toLowerCase();
                    boolean matches = (c.getContractCode() != null && c.getContractCode().toLowerCase().contains(term))
                            || (c.getUnit() != null && c.getUnit().getUnitCode() != null && c.getUnit().getUnitCode().toLowerCase().contains(term))
                            || (c.getCustomer() != null && c.getCustomer().getFullName() != null && c.getCustomer().getFullName().toLowerCase().contains(term))
                            || (c.getCustomer() != null && c.getCustomer().getPhone() != null && c.getCustomer().getPhone().toLowerCase().contains(term));
                    if (!matches) {
                        continue;
                    }
                }
                LocalDateTime settledTime = logItem.getCreatedAt() != null ? logItem.getCreatedAt()
                        : (c.getUpdatedAt() != null ? c.getUpdatedAt() : LocalDateTime.now());
                String settledAtStr = settledTime.format(DateTimeFormatter.ofPattern("HH:mm dd/MM/yyyy"));
                FacilityPolicy policy = c.getFacility() != null
                        ? facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(c.getFacility().getId()).orElse(null)
                        : null;
                var calc = overdueDebtCalculationService.calculateOverdueDebt(c, policy, today);

                settledItems.add(OverdueContractItemResponse.builder()
                        .contractId(c.getId())
                        .contractCode(c.getContractCode())
                        .bookingId(c.getBooking() != null ? c.getBooking().getId() : null)
                        .bookingCode(c.getBooking() != null ? c.getBooking().getBookingCode() : null)
                        .unitId(c.getUnit() != null ? c.getUnit().getId() : null)
                        .unitCode(c.getUnit() != null ? c.getUnit().getUnitCode() : "N/A")
                        .unitTypeName(calc.unitTypeName())
                        .monthlyFee(calc.monthlyFee())
                        .dailyRentalPrice(calc.dailyRentalPrice())
                        .lateFeePercentage(calc.lateFeePercentage())
                        .facilityId(c.getFacility() != null ? c.getFacility().getId() : null)
                        .facilityName(c.getFacility() != null ? c.getFacility().getName() : "N/A")
                        .customerId(c.getCustomer() != null ? c.getCustomer().getId() : null)
                        .customerName(c.getCustomer() != null ? c.getCustomer().getFullName() : "N/A")
                        .customerPhone(c.getCustomer() != null ? c.getCustomer().getPhone() : "")
                        .customerEmail(c.getCustomer() != null ? c.getCustomer().getEmail() : "")
                        .startDate(c.getStartDate())
                        .dueDate(c.getEndDate())
                        .daysOverdue(calc.overdueDays())
                        .principalDebt(calc.principalDebt())
                        .dailyLateFee(calc.dailyLateFee())
                        .lateFee(calc.lateFee())
                        .totalDebt(calc.totalDebt())
                        .unverifiedAmount(calc.unverifiedAmount())
                        .stage(calc.stage())
                        .stageLabel("OVERDUE_LIQUIDATION_RELEASE".equals(logItem.getAction()) ? "Đã thanh lý & giải phóng kho" : "Đã xong (Khách trả kho)")
                        .pinStatus(c.getOverduePinStatus() != null ? c.getOverduePinStatus() : OverduePinStatus.PIN_REVOKED)
                        .sealingStatus(OverdueSealingStatus.NONE)
                        .smartLockOnlineStatus("OFFLINE")
                        .smartLockIsMock(c.getSmartLockIsMock() != null ? c.getSmartLockIsMock() : true)
                        .isDemo(Boolean.TRUE.equals(c.getIsDemo()))
                        .hasActivePolicy(true)
                        .contractStatus(c.getStatus() != null ? c.getStatus().name() : "TERMINATED")
                        .isSettled(true)
                        .settledAt(settledAtStr)
                        .settledByName(logItem.getPerformedByName())
                        .build());
            }

            int totalElements = settledItems.size();
            int fromIndex = Math.min(page * size, totalElements);
            int toIndex = Math.min(fromIndex + size, totalElements);
            List<OverdueContractItemResponse> pagedContent = settledItems.subList(fromIndex, toIndex);
            int totalPages = (int) Math.ceil((double) totalElements / (double) Math.max(1, size));

            return PageResponse.<OverdueContractItemResponse>builder()
                    .content(pagedContent)
                    .page(page)
                    .size(size)
                    .totalElements(totalElements)
                    .totalPages(totalPages)
                    .last(page >= totalPages - 1)
                    .first(page == 0)
                    .build();
        }

        List<RentalContract> allContracts = getScopedOverdueContracts(effectiveFacilityId, today);
        Map<UUID, FacilityPolicy> policyCache = new HashMap<>();

        List<OverdueContractItemResponse> items = new ArrayList<>();

        for (RentalContract contract : allContracts) {
            if (isDemo != null && !Objects.equals(contract.getIsDemo(), isDemo)) {
                continue;
            }

            UUID facId = contract.getFacility() != null ? contract.getFacility().getId() : null;
            FacilityPolicy policy = facId != null
                    ? policyCache.computeIfAbsent(facId, id -> facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(id).orElse(null))
                    : null;

            var calc = overdueDebtCalculationService.calculateOverdueDebt(contract, policy, today);
            if (calc.overdueDays() < 1) {
                continue;
            }

            // Filter: Stage
            if (stage != null && !stage.equalsIgnoreCase("ALL")) {
                if (!calc.stage().name().equalsIgnoreCase(stage)) {
                    continue;
                }
            }

            // Filter: Days range
            if (minDays != null && calc.overdueDays() < minDays) {
                continue;
            }
            if (maxDays != null && calc.overdueDays() > maxDays) {
                continue;
            }

            // Filter: PIN Status
            if (pinStatus != null && !pinStatus.equalsIgnoreCase("ALL")) {
                if (contract.getOverduePinStatus() == null || !contract.getOverduePinStatus().name().equalsIgnoreCase(pinStatus)) {
                    continue;
                }
            }

            // Filter: Sealing Status
            if (sealingStatus != null && !sealingStatus.equalsIgnoreCase("ALL")) {
                if (contract.getOverdueSealingStatus() == null || !contract.getOverdueSealingStatus().name().equalsIgnoreCase(sealingStatus)) {
                    continue;
                }
            }

            // Filter: Search Term (contractCode, unitCode, customerName, phone)
            if (searchTerm != null && !searchTerm.trim().isEmpty()) {
                String term = searchTerm.trim().toLowerCase();
                boolean matches = (contract.getContractCode() != null && contract.getContractCode().toLowerCase().contains(term))
                        || (contract.getUnit() != null && contract.getUnit().getUnitCode() != null && contract.getUnit().getUnitCode().toLowerCase().contains(term))
                        || (contract.getCustomer() != null && contract.getCustomer().getFullName() != null && contract.getCustomer().getFullName().toLowerCase().contains(term))
                        || (contract.getCustomer() != null && contract.getCustomer().getPhone() != null && contract.getCustomer().getPhone().toLowerCase().contains(term));
                if (!matches) {
                    continue;
                }
            }

            long reminderCount = overdueNoticeLogRepository.countByContract_Id(contract.getId());
            var latestNotice = overdueNoticeLogRepository.findByContract_IdOrderBySentAtDesc(contract.getId());
            LocalDateTime lastReminderSentAt = latestNotice.isEmpty() ? null : latestNotice.get(0).getSentAt();

            items.add(OverdueContractItemResponse.builder()
                    .contractId(contract.getId())
                    .contractCode(contract.getContractCode())
                    .bookingId(contract.getBooking() != null ? contract.getBooking().getId() : null)
                    .bookingCode(contract.getBooking() != null ? contract.getBooking().getBookingCode() : null)
                    .unitId(contract.getUnit() != null ? contract.getUnit().getId() : null)
                    .unitCode(contract.getUnit() != null ? contract.getUnit().getUnitCode() : "N/A")
                    .unitTypeName(calc.unitTypeName())
                    .monthlyFee(calc.monthlyFee())
                    .dailyRentalPrice(calc.dailyRentalPrice())
                    .lateFeePercentage(calc.lateFeePercentage())
                    .facilityId(facId)
                    .facilityName(contract.getFacility() != null ? contract.getFacility().getName() : "N/A")
                    .customerId(contract.getCustomer() != null ? contract.getCustomer().getId() : null)
                    .customerName(contract.getCustomer() != null ? contract.getCustomer().getFullName() : "Khách vãng lai")
                    .customerPhone(contract.getCustomer() != null ? contract.getCustomer().getPhone() : "")
                    .customerEmail(contract.getCustomer() != null ? contract.getCustomer().getEmail() : "")
                    .startDate(contract.getStartDate())
                    .dueDate(contract.getEndDate())
                    .daysOverdue(calc.overdueDays())
                    .principalDebt(calc.principalDebt())
                    .dailyLateFee(calc.dailyLateFee())
                    .lateFee(calc.lateFee())
                    .totalDebt(calc.totalDebt())
                    .customerRefundAmount(calc.customerRefundAmount())
                    .depositHeld(calc.depositHeld())
                    .unverifiedAmount(calc.unverifiedAmount())
                    .stage(calc.stage())
                    .stageLabel(resolveStageLabel(calc.stage()))
                    .pinStatus(contract.getOverduePinStatus() != null ? contract.getOverduePinStatus() : OverduePinStatus.PIN_ACTIVE)
                    .sealingStatus(contract.getOverdueSealingStatus() != null ? contract.getOverdueSealingStatus() : OverdueSealingStatus.NONE)
                    .smartLockOnlineStatus(contract.getSmartLockOnlineStatus() != null ? contract.getSmartLockOnlineStatus() : "ONLINE")
                    .smartLockIsMock(contract.getSmartLockIsMock() != null ? contract.getSmartLockIsMock() : true)
                    .isDemo(Boolean.TRUE.equals(contract.getIsDemo()))
                    .hasActivePolicy(calc.isPolicyValid())
                    .lastReminderSentAt(lastReminderSentAt)
                    .reminderCount(reminderCount)
                    .contractStatus(contract.getStatus() != null ? contract.getStatus().name() : "N/A")
                    .isSettled(contract.getStatus() == RentalContractStatus.TERMINATED)
                    .build());
        }

        // Sort: overdueDays descending
        items.sort((a, b) -> Long.compare(b.getDaysOverdue(), a.getDaysOverdue()));

        int totalElements = items.size();
        int fromIndex = Math.min(page * size, totalElements);
        int toIndex = Math.min(fromIndex + size, totalElements);
        List<OverdueContractItemResponse> pagedContent = items.subList(fromIndex, toIndex);
        int totalPages = (int) Math.ceil((double) totalElements / (double) Math.max(1, size));

        return PageResponse.<OverdueContractItemResponse>builder()
                .content(pagedContent)
                .page(page)
                .size(size)
                .totalElements(totalElements)
                .totalPages(totalPages)
                .last(page >= totalPages - 1)
                .first(page == 0)
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public OverdueContractDetailResponse getOverdueContractDetail(UUID contractId) {
        RentalContract contract = rentalContractRepository.findById(contractId)
                .orElseThrow(() -> new AppException(ErrorCode.CONTRACT_NOT_FOUND));

        if (contract.getFacility() != null) {
            facilityAccessGuard.checkFacilityAccess(contract.getFacility().getId());
        }

        boolean isSettled = contract.getStatus() == RentalContractStatus.TERMINATED;
        String settledAtStr = null;
        String settledByName = null;
        String settledAction = null;
        if (isSettled) {
            var settlementAuditOpt = overdueAuditLogRepository.findByContract_IdOrderByCreatedAtDesc(contractId).stream()
                    .filter(a -> "OVERDUE_SETTLED_COMPLETED".equals(a.getAction()) || "OVERDUE_LIQUIDATION_RELEASE".equals(a.getAction()))
                    .findFirst();
            if (settlementAuditOpt.isPresent()) {
                var audit = settlementAuditOpt.get();
                settledAction = audit.getAction();
                LocalDateTime settledTime = audit.getCreatedAt() != null ? audit.getCreatedAt()
                        : (contract.getUpdatedAt() != null ? contract.getUpdatedAt() : LocalDateTime.now());
                settledAtStr = settledTime.format(DateTimeFormatter.ofPattern("HH:mm dd/MM/yyyy"));
                settledByName = audit.getPerformedByName();
            }
        }

        LocalDate today = LocalDate.now(OverdueDebtCalculationService.VN_ZONE);
        FacilityPolicy policy = contract.getFacility() != null
                ? facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(contract.getFacility().getId()).orElse(null)
                : null;

        var calc = overdueDebtCalculationService.calculateOverdueDebt(contract, policy, today);


        // Payments
        List<Payment> paymentEntities = new ArrayList<>();
        try {
            paymentEntities.addAll(paymentRepository.findByContract_Id(contract.getId()));
            if (contract.getBooking() != null) {
                paymentEntities.addAll(paymentRepository.findAllByBooking_Id(contract.getBooking().getId()));
            }
        } catch (Exception ignored) {}

        List<OverdueContractDetailResponse.PaymentHistoryDto> payments = paymentEntities.stream()
                .distinct()
                .map(p -> OverdueContractDetailResponse.PaymentHistoryDto.builder()
                        .paymentId(p.getId())
                        .transactionId(p.getTransactionId())
                        .amount(p.getAmount())
                        .paymentType(p.getPaymentType() != null ? p.getPaymentType().name() : "")
                        .status(p.getStatus() != null ? p.getStatus().name() : "")
                        .paymentMethod(p.getPaymentMethod())
                        .paymentTime(p.getPaymentTime())
                        .receiptVoucherCode(p.getReceiptVoucherCode())
                        .build())
                .toList();

        // Notices
        List<OverdueContractDetailResponse.NoticeLogDto> reminders = overdueNoticeLogRepository
                .findByContract_IdOrderBySentAtDesc(contractId).stream()
                .map(n -> OverdueContractDetailResponse.NoticeLogDto.builder()
                        .id(n.getId())
                        .channel(n.getChannel())
                        .templateType(n.getTemplateType())
                        .content(n.getContent())
                        .sentByName(n.getSentBy() != null ? n.getSentBy().getFullName() : "Hệ thống Boxora")
                        .sentAt(n.getSentAt())
                        .deliveryStatus(n.getDeliveryStatus())
                        .notes(n.getNotes())
                        .build())
                .toList();

        // PIN Revocation Requests
        List<OverdueContractDetailResponse.PinRevocationDto> pinRequests = pinRevocationRequestRepository
                .findByContract_IdOrderByCreatedAtDesc(contractId).stream()
                .map(r -> OverdueContractDetailResponse.PinRevocationDto.builder()
                        .id(r.getId())
                        .requestCode(r.getRequestCode())
                        .reason(r.getReason())
                        .status(r.getStatus())
                        .isMock(r.getIsMock())
                        .errorMessage(r.getErrorMessage())
                        .retryCount(r.getRetryCount())
                        .requestedByName(r.getRequestedBy() != null ? r.getRequestedBy().getFullName() : "Hệ thống")
                        .requestedAt(r.getRequestedAt())
                        .executedAt(r.getExecutedAt())
                        .build())
                .toList();

        // Sealing Dossier
        OverdueContractDetailResponse.SealingDossierDto sealingDossier = null;
        var sealingOpt = sealingRecordRepository.findFirstByContract_IdOrderByCreatedAtDesc(contractId);
        if (sealingOpt.isPresent()) {
            SealingRecord sr = sealingOpt.get();
            List<OverdueContractDetailResponse.AssetInventoryDto> items = assetInventoryItemRepository
                    .findBySealingRecord_Id(sr.getId()).stream()
                    .map(item -> OverdueContractDetailResponse.AssetInventoryDto.builder()
                            .id(item.getId())
                            .itemName(item.getItemName())
                            .quantity(item.getQuantity())
                            .conditionStatus(item.getConditionStatus())
                            .estimatedValue(item.getEstimatedValue())
                            .notes(item.getNotes())
                            .build())
                    .toList();

            sealingDossier = OverdueContractDetailResponse.SealingDossierDto.builder()
                    .sealingRecordId(sr.getId())
                    .protocolNumber(sr.getProtocolNumber())
                    .sealTagNumber(sr.getSealTagNumber())
                    .status(sr.getStatus() != null ? sr.getStatus().name() : "")
                    .requestStatus(sr.getRequestStatus() != null ? sr.getRequestStatus() : "COMPLETED")
                    .reason(sr.getReason())
                    .sealedAt(sr.getSealedAt())
                    .sealedByName(sr.getSealedBy() != null ? sr.getSealedBy().getFullName() : "N/A")
                    .witnessName(sr.getWitness() != null ? sr.getWitness().getFullName() : "N/A")
                    .approvedByName(sr.getApprovedBy() != null ? sr.getApprovedBy().getFullName() : "N/A")
                    .approvedAt(sr.getApprovedAt())
                    .rejectionReason(sr.getRejectionReason())
                    .inventorySummary(sr.getInventorySummary())
                    .notes(sr.getNotes())
                    .items(items)
                    .build();
        }

        // Audit Trail
        List<OverdueContractDetailResponse.AuditLogDto> auditLogs = overdueAuditLogRepository
                .findByContract_IdOrderByCreatedAtDesc(contractId).stream()
                .map(a -> OverdueContractDetailResponse.AuditLogDto.builder()
                        .id(a.getId())
                        .action(a.getAction())
                        .performedByName(a.getPerformedByName())
                        .performedByRole(a.getPerformedByRole())
                        .beforeState(a.getBeforeState())
                        .afterState(a.getAfterState())
                        .details(a.getDetails())
                        .createdAt(a.getCreatedAt())
                        .build())
                .toList();

        // Tự động hết hạn quyền cấp PIN tạm thời nếu thời hạn đã qua
        OverduePinStatus effectivePinStatus = contract.getOverduePinStatus() != null ? contract.getOverduePinStatus() : OverduePinStatus.PIN_ACTIVE;
        if (contract.getTempPinGrantedUntil() != null && contract.getTempPinGrantedUntil().isBefore(LocalDateTime.now())) {
            effectivePinStatus = OverduePinStatus.PIN_REVOKED;
            contract.setOverduePinStatus(OverduePinStatus.PIN_REVOKED);
            contract.setStatus(RentalContractStatus.OVERDUE_LOCKED);
            contract.setTempAccessPin(null);
            Booking b = contract.getBooking();
            if (b == null && contract.getUnit() != null) {
                b = bookingRepository.findFirstByStorageUnit_IdOrderByCreatedAtDesc(contract.getUnit().getId()).orElse(null);
            }
            if (b != null) {
                b.setStatus(BookingStatus.OVERDUE);
                b.setAccessPin(null);
                b.setQrAccessToken("REVOKED_OVERDUE");
                bookingRepository.save(b);
            }
            rentalContractRepository.save(contract);
        }

        boolean isTempActive = contract.getTempPinGrantedUntil() != null && contract.getTempPinGrantedUntil().isAfter(LocalDateTime.now());
        String maskedPin = "Chưa cấp";
        if (isTempActive && contract.getTempAccessPin() != null && !contract.getTempAccessPin().isBlank()) {
            maskedPin = contract.getTempAccessPin(); // Hiện rõ 6 số tạm thời!
        } else if (effectivePinStatus == OverduePinStatus.PIN_REVOKED) {
            maskedPin = "Đã thu hồi";
        } else if (contract.getBooking() != null && contract.getBooking().getAccessPin() != null) {
            String rawPin = contract.getBooking().getAccessPin();
            if (rawPin.length() >= 4) {
                maskedPin = "****" + rawPin.substring(rawPin.length() - 2);
            } else {
                maskedPin = "****";
            }
        }

        return OverdueContractDetailResponse.builder()
                .contractId(contract.getId())
                .contractCode(contract.getContractCode())
                .bookingId(contract.getBooking() != null ? contract.getBooking().getId() : null)
                .bookingCode(contract.getBooking() != null ? contract.getBooking().getBookingCode() : null)
                .unitId(contract.getUnit() != null ? contract.getUnit().getId() : null)
                .unitCode(contract.getUnit() != null ? contract.getUnit().getUnitCode() : "N/A")
                .unitTypeName(calc.unitTypeName())
                .monthlyFee(calc.monthlyFee())
                .dailyRentalPrice(calc.dailyRentalPrice())
                .lateFeePercentage(calc.lateFeePercentage())
                .facilityId(contract.getFacility() != null ? contract.getFacility().getId() : null)
                .facilityName(contract.getFacility() != null ? contract.getFacility().getName() : "N/A")
                .customerId(contract.getCustomer() != null ? contract.getCustomer().getId() : null)
                .customerName(contract.getCustomer() != null ? contract.getCustomer().getFullName() : "N/A")
                .customerPhone(contract.getCustomer() != null ? contract.getCustomer().getPhone() : "")
                .customerEmail(contract.getCustomer() != null ? contract.getCustomer().getEmail() : "")
                .startDate(contract.getStartDate())
                .dueDate(contract.getEndDate())
                .daysOverdue(calc.overdueDays())
                .principalDebt(calc.principalDebt())
                .dailyLateFee(calc.dailyLateFee())
                .lateFee(calc.lateFee())
                .totalDebt(calc.totalDebt())
                .customerRefundAmount(calc.customerRefundAmount())
                .unverifiedAmount(calc.unverifiedAmount())
                .depositHeld(calc.depositHeld())
                .stage(calc.stage())
                .stageLabel(isSettled ? ("OVERDUE_LIQUIDATION_RELEASE".equals(settledAction) ? "Đã thanh lý & giải phóng kho" : "Đã xong (Khách trả kho)") : resolveStageLabel(calc.stage()))
                .feeFormulaExplanation(calc.feeFormulaExplanation())
                .pinStatus(effectivePinStatus)
                .sealingStatus(isSettled ? OverdueSealingStatus.NONE : (contract.getOverdueSealingStatus() != null ? contract.getOverdueSealingStatus() : OverdueSealingStatus.NONE))
                .smartLockOnlineStatus(isSettled ? "OFFLINE" : (contract.getSmartLockOnlineStatus() != null ? contract.getSmartLockOnlineStatus() : "ONLINE"))
                .smartLockIsMock(contract.getSmartLockIsMock() != null ? contract.getSmartLockIsMock() : true)
                .maskedPin(isSettled ? "Đã thu hồi" : maskedPin)
                .tempAccessPin(isSettled ? null : (isTempActive ? contract.getTempAccessPin() : null))
                .smartLockLastUnlockedAt(contract.getSmartLockLastUnlockedAt())
                .tempPinGrantedUntil(isSettled ? null : contract.getTempPinGrantedUntil())
                .tempPinGrantReason(isSettled ? null : contract.getTempPinGrantReason())
                .isDemo(Boolean.TRUE.equals(contract.getIsDemo()))
                .hasActivePolicy(calc.isPolicyValid())
                .policyWarning(isSettled ? null : calc.policyWarning())
                .contractStatus(contract.getStatus() != null ? contract.getStatus().name() : "N/A")
                .isSettled(isSettled)
                .settledAt(settledAtStr)
                .settledByName(settledByName)
                .payments(payments)
                .reminders(reminders)
                .pinRequests(pinRequests)
                .sealingDossier(sealingDossier)
                .auditLogs(auditLogs)
                .build();
    }

    @Override
    @Transactional
    public void sendReminder(UUID contractId, OverdueSendReminderRequest request) {
        RentalContract contract = rentalContractRepository.findById(contractId)
                .orElseThrow(() -> new AppException(ErrorCode.CONTRACT_NOT_FOUND));

        validateContractActive(contract);

        if (contract.getFacility() != null) {
            facilityAccessGuard.checkFacilityAccess(contract.getFacility().getId());
        }

        LocalDate today = LocalDate.now(OverdueDebtCalculationService.VN_ZONE);
        FacilityPolicy policy = contract.getFacility() != null
                ? facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(contract.getFacility().getId()).orElse(null)
                : null;

        var calc = overdueDebtCalculationService.calculateOverdueDebt(contract, policy, today);

        // 1. Kiểm tra biên bản kiểm kê tài sản và niêm phong kho nếu có
        BigDecimal dailyPenalty = calc.dailyLateFee() != null && calc.dailyLateFee().compareTo(BigDecimal.ZERO) > 0
                ? calc.dailyLateFee()
                : (calc.dailyRentalPrice() != null && calc.dailyRentalPrice().compareTo(BigDecimal.ZERO) > 0
                    ? calc.dailyRentalPrice()
                    : (contract.getMonthlyFee() != null ? OverdueDebtCalculationServiceImpl.roundUpToThousand(contract.getMonthlyFee().divide(BigDecimal.valueOf(30), 4, RoundingMode.HALF_UP)) : BigDecimal.ZERO));
        BigDecimal totalLiquidationValue = null;
        Long estimatedHoldingDays = null;
        Integer inventoryCount = null;
        var sealingOpt = sealingRecordRepository.findFirstByContract_IdOrderByCreatedAtDesc(contractId);
        if (sealingOpt.isPresent()) {
            var items = assetInventoryItemRepository.findBySealingRecord_Id(sealingOpt.get().getId());
            if (items != null && !items.isEmpty()) {
                inventoryCount = items.size();
                BigDecimal totalLiq = BigDecimal.ZERO;
                for (var it : items) {
                    BigDecimal val = it.getEstimatedValue() != null ? it.getEstimatedValue() : BigDecimal.ZERO;
                    int qty = it.getQuantity() != null ? it.getQuantity() : 1;
                    totalLiq = totalLiq.add(val.multiply(BigDecimal.valueOf(qty)));
                }
                totalLiquidationValue = totalLiq;

                BigDecimal remainingVal = totalLiq.subtract(calc.totalDebt());
                if (dailyPenalty.compareTo(BigDecimal.ZERO) > 0 && remainingVal.compareTo(BigDecimal.ZERO) > 0) {
                    estimatedHoldingDays = remainingVal.divide(dailyPenalty, 0, RoundingMode.FLOOR).longValue();
                } else {
                    estimatedHoldingDays = 0L;
                }
            }
        }

        // 2. Tự động phân loại mẫu thông báo chuẩn
        String resolvedTemplate = request.getTemplateType();
        if (resolvedTemplate == null || resolvedTemplate.isBlank() || "AUTO".equalsIgnoreCase(resolvedTemplate)) {
            if (calc.totalDebt().compareTo(BigDecimal.ZERO) > 0 && totalLiquidationValue != null) {
                resolvedTemplate = "LIQUIDATION_HOLDING_WARNING";
            } else {
                resolvedTemplate = switch (calc.stage()) {
                    case GRACE_PERIOD -> "REMINDER";
                    case WARNING -> "WARNING";
                    case PIN_REVOCATION -> "LOCKOUT_NOTICE";
                    case SEALING_ELIGIBLE, POLICY_UNCONFIGURED -> "SEAL_WARNING";
                };
            }
        }

        String unitTypeName = "Kho";
        if (contract.getUnit() != null && contract.getUnit().getUnitType() != null && contract.getUnit().getUnitType().getTypeName() != null) {
            unitTypeName = contract.getUnit().getUnitType().getTypeName();
        }

        String content = request.getContent();
        if (content == null || content.trim().isEmpty()) {
            if ("LIQUIDATION_HOLDING_WARNING".equalsIgnoreCase(resolvedTemplate)) {
                content = String.format(
                        "[BOXORA THÔNG BÁO CÔNG NỢ & HẠN MỨC GIỮ KHO] Kính gửi %s, hợp đồng #%s (Kho #%s - %s) tại %s đã quá hạn trả kho %d ngày. Phí phạt: %,.0f đ vượt cọc giữ %,.0f đ -> Tổng công nợ phải nộp: %,.0f đ. Tài sản kiểm kê (%d mục): Tổng thanh lý %,.0f đ (Sau bù nợ: %,.0f đ). Ước tính giữ kho tối đa: %d ngày (Đơn giá %,.0f đ/ngày). Quý khách vui lòng thanh toán công nợ và đến nhận lại tài sản trước thời hạn.",
                        contract.getCustomer() != null ? contract.getCustomer().getFullName() : "Quý khách",
                        contract.getContractCode(),
                        contract.getUnit() != null ? contract.getUnit().getUnitCode() : "N/A",
                        unitTypeName,
                        contract.getFacility() != null ? contract.getFacility().getName() : "Boxora",
                        calc.overdueDays(),
                        calc.lateFee().doubleValue(),
                        calc.depositHeld() != null ? calc.depositHeld().doubleValue() : 0.0,
                        calc.totalDebt().doubleValue(),
                        inventoryCount != null ? inventoryCount : 0,
                        totalLiquidationValue != null ? totalLiquidationValue.doubleValue() : 0.0,
                        totalLiquidationValue != null ? totalLiquidationValue.subtract(calc.totalDebt()).max(BigDecimal.ZERO).doubleValue() : 0.0,
                        estimatedHoldingDays != null ? estimatedHoldingDays : 0L,
                        dailyPenalty != null ? dailyPenalty.doubleValue() : 0.0
                );
            } else if (calc.totalDebt().compareTo(BigDecimal.ZERO) == 0) {
                content = String.format(
                        "[BOXORA %s] Kính gửi %s, hợp đồng thuê kho #%s (%s) tại %s đã quá hạn trả kho %d ngày. Phí phạt trễ hạn: %,.0f đ. Tiền cọc giữ: %,.0f đ (Số tiền hoàn khách dự kiến khi trả kho: %,.0f đ). Quý khách vui lòng liên hệ BQL cơ sở để hoàn tất thủ tục bàn giao trả kho.",
                        resolvedTemplate,
                        contract.getCustomer() != null ? contract.getCustomer().getFullName() : "Quý khách",
                        contract.getUnit() != null ? contract.getUnit().getUnitCode() : "N/A",
                        contract.getContractCode(),
                        contract.getFacility() != null ? contract.getFacility().getName() : "Boxora",
                        calc.overdueDays(),
                        calc.lateFee().doubleValue(),
                        calc.depositHeld() != null ? calc.depositHeld().doubleValue() : 0.0,
                        calc.customerRefundAmount() != null ? calc.customerRefundAmount().doubleValue() : 0.0
                );
            } else {
                content = String.format(
                        "[BOXORA %s] Kính gửi %s, hợp đồng thuê kho #%s (%s) tại %s đã quá hạn trả kho %d ngày. Phí phạt trễ hạn: %,.0f đ, vượt quá tiền cọc giữ %,.0f đ. Tổng công nợ cần thanh toán: %,.0f đ. Quý khách vui lòng thanh toán công nợ và liên hệ BQL cơ sở để hoàn tất bàn giao trả kho.",
                        resolvedTemplate,
                        contract.getCustomer() != null ? contract.getCustomer().getFullName() : "Quý khách",
                        contract.getUnit() != null ? contract.getUnit().getUnitCode() : "N/A",
                        contract.getContractCode(),
                        contract.getFacility() != null ? contract.getFacility().getName() : "Boxora",
                        calc.overdueDays(),
                        calc.lateFee().doubleValue(),
                        calc.depositHeld() != null ? calc.depositHeld().doubleValue() : 0.0,
                        calc.totalDebt().doubleValue()
                );
            }
        }

        User currentUser = getCurrentUser();

        OverdueNoticeLog noticeLog = OverdueNoticeLog.builder()
                .contract(contract)
                .customer(contract.getCustomer())
                .channel(request.getChannel())
                .templateType(resolvedTemplate)
                .content(content)
                .sentBy(currentUser)
                .sentAt(LocalDateTime.now())
                .deliveryStatus("DELIVERED")
                .notes(request.getNotes())
                .build();
        overdueNoticeLogRepository.save(noticeLog);

        // Dispatch web notification for customer dashboard & notification center
        if (contract.getCustomer() != null) {
            String unitCode = contract.getUnit() != null ? contract.getUnit().getUnitCode() : "N/A";
            String webTitle = "LIQUIDATION_HOLDING_WARNING".equalsIgnoreCase(resolvedTemplate)
                    ? String.format("[Cảnh báo nợ & giữ kho] Hợp đồng #%s (Kho #%s) quá hạn %d ngày (Giữ kho ước tính: %d ngày)",
                    contract.getContractCode(), unitCode, calc.overdueDays(), estimatedHoldingDays != null ? estimatedHoldingDays : 0L)
                    : String.format("[Quá hạn trả kho] Hợp đồng #%s (Kho #%s) quá hạn %d ngày",
                    contract.getContractCode(), unitCode, calc.overdueDays());

            NotificationLog webNotif = NotificationLog.builder()
                    .recipient(contract.getCustomer())
                    .recipientEmail(contract.getCustomer().getEmail() != null ? contract.getCustomer().getEmail() : "")
                    .recipientName(contract.getCustomer().getFullName())
                    .facility(contract.getFacility())
                    .channel(NotificationChannel.IN_APP)
                    .notificationType(NotificationType.OVERDUE_DEBT_REMINDER)
                    .referenceType("OVERDUE_DEBT")
                    .referenceId(contract.getId())
                    .title(webTitle)
                    .content(content)
                    .status("SENT")
                    .build();
            notificationLogRepository.save(webNotif);
        }

        // Attempt real detailed email dispatch if customer email is configured and channel includes email
        boolean shouldSendEmail = !"WEB".equalsIgnoreCase(request.getChannel());
        if (shouldSendEmail && contract.getCustomer() != null && contract.getCustomer().getEmail() != null) {
            try {
                emailService.sendDetailedOverdueNoticeEmail(
                        contract.getCustomer().getEmail(),
                        contract.getCustomer().getFullName(),
                        contract.getContractCode(),
                        contract.getUnit() != null ? contract.getUnit().getUnitCode() : "N/A",
                        unitTypeName,
                        contract.getFacility() != null ? contract.getFacility().getName() : "Boxora",
                        calc.overdueDays(),
                        calc.principalDebt(),
                        calc.dailyLateFee(),
                        calc.lateFee(),
                        calc.totalDebt(),
                        contract.getDepositHeld() != null ? contract.getDepositHeld() : BigDecimal.ZERO,
                        calc.dueDate(),
                        calc.feeFormulaExplanation(),
                        calc.stage() != null ? calc.stage().name() : "OVERDUE",
                        resolvedTemplate,
                        request.getNotes(),
                        totalLiquidationValue,
                        estimatedHoldingDays,
                        inventoryCount,
                        dailyPenalty
                );
            } catch (Exception e) {
                log.warn("Could not dispatch detailed overdue email notice: {}", e.getMessage());
            }
        }

        recordAudit(
                contract,
                "OVERDUE_REMINDER_SENT",
                currentUser,
                null,
                "DELIVERED",
                String.format("Gửi thông báo nhắc cước qua kênh %s (%s). Nội dung: %s", request.getChannel(), request.getTemplateType(), content)
        );
    }

    @Override
    @Transactional
    public OverdueContractDetailResponse.PinRevocationDto requestPinRevocation(UUID contractId, OverduePinActionRequest request) {
        RentalContract contract = rentalContractRepository.findById(contractId)
                .orElseThrow(() -> new AppException(ErrorCode.CONTRACT_NOT_FOUND));

        validateContractActive(contract);

        if (contract.getFacility() != null) {
            facilityAccessGuard.checkFacilityAccess(contract.getFacility().getId());
        }

        User currentUser = getCurrentUser();
        String reason = (request != null && request.getReason() != null) ? request.getReason() : "Quá hạn thanh toán cước thuê theo chính sách";

        String requestCode = "PIN-REQ-" + System.currentTimeMillis() % 10000000;

        PinRevocationRequest req = PinRevocationRequest.builder()
                .contract(contract)
                .unit(contract.getUnit())
                .requestCode(requestCode)
                .reason(reason)
                .status(PinRevocationExecutionStatus.PENDING)
                .isMock(smartLockAdapter.isMock())
                .requestedBy(currentUser)
                .requestedAt(LocalDateTime.now())
                .build();
        pinRevocationRequestRepository.save(req);

        contract.setOverduePinStatus(OverduePinStatus.PIN_REVOCATION_PENDING);
        rentalContractRepository.save(contract);

        recordAudit(
                contract,
                "PIN_REVOCATION_REQUESTED",
                currentUser,
                OverduePinStatus.PIN_ACTIVE.name(),
                OverduePinStatus.PIN_REVOCATION_PENDING.name(),
                "Yêu cầu thu hồi mã PIN/QR cho buồng kho " + (contract.getUnit() != null ? contract.getUnit().getUnitCode() : "") + ". Lý do: " + reason
        );

        return OverdueContractDetailResponse.PinRevocationDto.builder()
                .id(req.getId())
                .requestCode(req.getRequestCode())
                .reason(req.getReason())
                .status(req.getStatus())
                .isMock(req.getIsMock())
                .requestedByName(currentUser != null ? currentUser.getFullName() : "Hệ thống")
                .requestedAt(req.getRequestedAt())
                .build();
    }

    @Override
    @Transactional
    public OverdueContractDetailResponse.PinRevocationDto executePinRevocation(UUID contractId, OverduePinActionRequest request) {
        RentalContract contract = rentalContractRepository.findById(contractId)
                .orElseThrow(() -> new AppException(ErrorCode.CONTRACT_NOT_FOUND));

        validateContractActive(contract);

        if (contract.getFacility() != null) {
            facilityAccessGuard.checkFacilityAccess(contract.getFacility().getId());
        }

        boolean isTempActive = contract.getTempPinGrantedUntil() != null && contract.getTempPinGrantedUntil().isAfter(LocalDateTime.now());
        if (!isTempActive) {
            LocalDate today = LocalDate.now(OverdueDebtCalculationService.VN_ZONE);
            FacilityPolicy policy = contract.getFacility() != null
                    ? facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(contract.getFacility().getId()).orElse(null)
                    : null;
            var calc = overdueDebtCalculationService.calculateOverdueDebt(contract, policy, today);
            if (calc.overdueDays() < 3) {
                throw new AppException(ErrorCode.PIN_REVOCATION_THRESHOLD_NOT_MET);
            }
        }

        User currentUser = getCurrentUser();
        boolean simulateOffline = request != null && Boolean.TRUE.equals(request.getSimulateOffline());
        String unitCode = contract.getUnit() != null ? contract.getUnit().getUnitCode() : "N/A";
        String onlineStatus = contract.getSmartLockOnlineStatus() != null ? contract.getSmartLockOnlineStatus() : "ONLINE";

        var revocationResult = smartLockAdapter.revokeCredentials(unitCode, onlineStatus, simulateOffline);

        String requestCode = "PIN-REV-" + System.currentTimeMillis() % 10000000;
        PinRevocationRequest req = PinRevocationRequest.builder()
                .contract(contract)
                .unit(contract.getUnit())
                .requestCode(requestCode)
                .reason(request != null ? request.getReason() : "Thu hồi quyền truy cập quá hạn")
                .status(revocationResult.status())
                .isMock(revocationResult.isMock())
                .errorMessage(revocationResult.errorDetails())
                .requestedBy(currentUser)
                .requestedAt(LocalDateTime.now())
                .executedAt(LocalDateTime.now())
                .build();
        pinRevocationRequestRepository.save(req);

        if (revocationResult.success()) {
            contract.setOverduePinStatus(OverduePinStatus.PIN_REVOKED);
            contract.setStatus(RentalContractStatus.OVERDUE_LOCKED);
            contract.setTempPinGrantedUntil(null);
            contract.setTempPinGrantReason(null);
            contract.setTempAccessPin(null);

            if (contract.getUnit() != null) {
                contract.getUnit().setStatus(UnitStatus.OVERDUE_LOCKED);
                storageUnitRepository.save(contract.getUnit());
            }

            Booking booking = contract.getBooking();
            if (booking == null && contract.getUnit() != null) {
                booking = bookingRepository.findFirstByStorageUnit_IdOrderByCreatedAtDesc(contract.getUnit().getId()).orElse(null);
            }
            if (booking != null) {
                booking.setStatus(BookingStatus.OVERDUE);
                booking.setAccessPin(null);
                booking.setQrAccessToken("REVOKED_OVERDUE");
                bookingRepository.save(booking);
            }

            rentalContractRepository.save(contract);

            if (contract.getCustomer() != null) {
                NotificationLog lockoutNotif = NotificationLog.builder()
                        .recipient(contract.getCustomer())
                        .recipientEmail(contract.getCustomer().getEmail() != null ? contract.getCustomer().getEmail() : "")
                        .recipientName(contract.getCustomer().getFullName())
                        .facility(contract.getFacility())
                        .channel(NotificationChannel.IN_APP)
                        .notificationType(NotificationType.SMARTLOCK_LOCKOUT_NOTICE)
                        .referenceType("SMARTLOCK_REVOCATION")
                        .referenceId(contract.getId())
                        .title(String.format("[SmartLock] Tạm khóa quyền truy cập kho #%s", unitCode))
                        .content(String.format("Hệ thống đã thực hiện tạm khóa mã PIN/QR SmartLock cho buồng kho #%s (HĐ %s) do quá hạn nợ cước. Vui lòng thanh toán cước để phục hồi quyền truy cập.",
                                unitCode, contract.getContractCode()))
                        .status("SENT")
                        .build();
                notificationLogRepository.save(lockoutNotif);
            }

            recordAudit(
                    contract,
                    "PIN_REVOKED",
                    currentUser,
                    OverduePinStatus.PIN_REVOCATION_PENDING.name(),
                    OverduePinStatus.PIN_REVOKED.name(),
                    revocationResult.message() + (revocationResult.isMock() ? " [MOCK ADAPTER]" : "")
            );
        } else {
            contract.setOverduePinStatus(OverduePinStatus.PIN_REVOCATION_FAILED);
            rentalContractRepository.save(contract);

            recordAudit(
                    contract,
                    "PIN_REVOCATION_FAILED",
                    currentUser,
                    OverduePinStatus.PIN_REVOCATION_PENDING.name(),
                    OverduePinStatus.PIN_REVOCATION_FAILED.name(),
                    revocationResult.message() + " (" + revocationResult.errorDetails() + ")"
            );
        }

        return OverdueContractDetailResponse.PinRevocationDto.builder()
                .id(req.getId())
                .requestCode(req.getRequestCode())
                .reason(req.getReason())
                .status(req.getStatus())
                .isMock(req.getIsMock())
                .errorMessage(req.getErrorMessage())
                .requestedByName(currentUser != null ? currentUser.getFullName() : "Hệ thống")
                .requestedAt(req.getRequestedAt())
                .executedAt(req.getExecutedAt())
                .build();
    }

    @Override
    @Transactional
    public void grantTemporaryPin(UUID contractId, OverduePinTempGrantRequest request) {
        RentalContract contract = rentalContractRepository.findById(contractId)
                .orElseThrow(() -> new AppException(ErrorCode.CONTRACT_NOT_FOUND));

        validateContractActive(contract);

        if (contract.getFacility() != null) {
            facilityAccessGuard.checkFacilityAccess(contract.getFacility().getId());
        }

        User currentUser = getCurrentUser();
        String unitCode = contract.getUnit() != null ? contract.getUnit().getUnitCode() : "N/A";

        var tempResult = smartLockAdapter.grantTemporaryPin(unitCode, request.getHours());

        contract.setTempAccessPin(tempResult.tempPin());
        contract.setOverduePinStatus(OverduePinStatus.PIN_ACTIVE);
        contract.setTempPinGrantedUntil(LocalDateTime.now().plusHours(request.getHours()));
        contract.setTempPinGrantReason(request.getReason());

        Booking booking = contract.getBooking();
        if (booking == null && contract.getUnit() != null) {
            booking = bookingRepository.findFirstByStorageUnit_IdOrderByCreatedAtDesc(contract.getUnit().getId()).orElse(null);
        }
        if (booking != null) {
            booking.setAccessPin(tempResult.tempPin());
            booking.setQrAccessToken("TEMP_ACCESS_" + System.currentTimeMillis());
            bookingRepository.save(booking);
        }

        rentalContractRepository.save(contract);

        if (contract.getCustomer() != null) {
            NotificationLog tempPinNotif = NotificationLog.builder()
                    .recipient(contract.getCustomer())
                    .recipientEmail(contract.getCustomer().getEmail() != null ? contract.getCustomer().getEmail() : "")
                    .recipientName(contract.getCustomer().getFullName())
                    .facility(contract.getFacility())
                    .channel(NotificationChannel.IN_APP)
                    .notificationType(NotificationType.HANDOVER_PIN)
                    .referenceType("TEMPORARY_PIN")
                    .referenceId(contract.getId())
                    .title(String.format("[SmartLock] Cấp mã PIN tạm thời kho #%s (%d giờ)", unitCode, request.getHours()))
                    .content(String.format("Quản lý cơ sở đã cấp mã PIN mở khóa tạm thời (%d giờ) cho buồng kho #%s. Lý do: %s.",
                            request.getHours(), unitCode, request.getReason()))
                    .status("SENT")
                    .build();
            notificationLogRepository.save(tempPinNotif);
        }

        recordAudit(
                contract,
                "PIN_TEMP_GRANTED",
                currentUser,
                OverduePinStatus.PIN_REVOKED.name(),
                OverduePinStatus.PIN_ACTIVE.name(),
                String.format("Cấp mã PIN tạm thời [MOCK ADAPTER] trong %d giờ. Lý do: %s", request.getHours(), request.getReason())
        );
    }

    @Override
    @Transactional
    public void processSealingWorkflow(UUID contractId, OverdueSealingWorkflowRequest request) {
        RentalContract contract = rentalContractRepository.findById(contractId)
                .orElseThrow(() -> new AppException(ErrorCode.CONTRACT_NOT_FOUND));

        validateContractActive(contract);

        if (contract.getFacility() != null) {
            facilityAccessGuard.checkFacilityAccess(contract.getFacility().getId());
        }

        User currentUser = getCurrentUser();
        String action = request.getAction().toUpperCase();

        var existingSealingOpt = sealingRecordRepository.findFirstByContract_IdOrderByCreatedAtDesc(contractId);

        switch (action) {
            case "REQUEST" -> {
                contract.setOverdueSealingStatus(OverdueSealingStatus.SEALING_REQUESTED);
                rentalContractRepository.save(contract);

                SealingRecord sealing = existingSealingOpt.orElseGet(() -> SealingRecord.builder()
                        .contract(contract)
                        .storageUnit(contract.getUnit())
                        .facility(contract.getFacility())
                        .sealTagNumber("REQ-SEAL-" + (contract.getUnit() != null ? contract.getUnit().getUnitCode() : "") + "-" + (System.currentTimeMillis() % 10000))
                        .reason(request.getReason() != null ? request.getReason() : "Đề xuất niêm phong do quá hạn")
                        .sealedAt(LocalDateTime.now())
                        .sealedBy(currentUser)
                        .witness(currentUser)
                        .status(SealingStatus.SEALED)
                        .build());

                sealing.setRequestStatus("REQUESTED");
                sealing.setRequestedBy(currentUser);
                sealing.setRequestedAt(LocalDateTime.now());
                sealingRecordRepository.save(sealing);

                recordAudit(
                        contract,
                        "SEALING_REQUESTED",
                        currentUser,
                        OverdueSealingStatus.SEALING_ELIGIBLE.name(),
                        OverdueSealingStatus.SEALING_REQUESTED.name(),
                        "Nhân viên gửi yêu cầu niêm phong buồng kho. Lý do: " + request.getReason()
                );
            }
            case "APPROVE" -> {
                contract.setOverdueSealingStatus(OverdueSealingStatus.SEALING_APPROVED);
                rentalContractRepository.save(contract);

                SealingRecord sealing = existingSealingOpt.orElseGet(() -> SealingRecord.builder()
                        .contract(contract)
                        .storageUnit(contract.getUnit())
                        .facility(contract.getFacility())
                        .sealTagNumber("REQ-SEAL-" + (contract.getUnit() != null ? contract.getUnit().getUnitCode() : "") + "-" + (System.currentTimeMillis() % 10000))
                        .reason("Đề xuất niêm phong kho do quá hạn")
                        .sealedAt(LocalDateTime.now())
                        .sealedBy(currentUser)
                        .witness(currentUser)
                        .status(SealingStatus.SEALED)
                        .requestedAt(LocalDateTime.now().minusDays(1))
                        .build());

                sealing.setRequestStatus("APPROVED");
                sealing.setApprovedBy(currentUser);
                sealing.setApprovedAt(LocalDateTime.now());
                sealingRecordRepository.save(sealing);

                recordAudit(
                        contract,
                        "SEALING_APPROVED",
                        currentUser,
                        OverdueSealingStatus.SEALING_REQUESTED.name(),
                        OverdueSealingStatus.SEALING_APPROVED.name(),
                        "Business Manager đã phê duyệt đề xuất niêm phong kho."
                );
            }
            case "REJECT" -> {
                contract.setOverdueSealingStatus(OverdueSealingStatus.SEALING_REJECTED);
                rentalContractRepository.save(contract);

                SealingRecord sealing = existingSealingOpt.orElseGet(() -> SealingRecord.builder()
                        .contract(contract)
                        .storageUnit(contract.getUnit())
                        .facility(contract.getFacility())
                        .sealTagNumber("REJ-SEAL-" + (contract.getUnit() != null ? contract.getUnit().getUnitCode() : "") + "-" + (System.currentTimeMillis() % 10000))
                        .reason("Đề xuất niêm phong kho do quá hạn")
                        .sealedAt(LocalDateTime.now())
                        .sealedBy(currentUser)
                        .witness(currentUser)
                        .status(SealingStatus.SEALED)
                        .requestedAt(LocalDateTime.now().minusDays(1))
                        .build());

                sealing.setRequestStatus("REJECTED");
                sealing.setRejectionReason(request.getRejectionReason());
                sealingRecordRepository.save(sealing);

                recordAudit(
                        contract,
                        "SEALING_REJECTED",
                        currentUser,
                        OverdueSealingStatus.SEALING_REQUESTED.name(),
                        OverdueSealingStatus.SEALING_REJECTED.name(),
                        "Từ chối yêu cầu niêm phong. Lý do: " + request.getRejectionReason()
                );
            }
            case "INVENTORY" -> {
                contract.setOverdueSealingStatus(OverdueSealingStatus.SEALING_IN_PROGRESS);
                rentalContractRepository.save(contract);

                // Validate inventory items: estimatedValue >= 0 and quantity >= 1
                if (request.getInventoryItems() != null) {
                    for (var itemDto : request.getInventoryItems()) {
                        if (itemDto.getItemName() != null && !itemDto.getItemName().trim().isEmpty()) {
                            if (itemDto.getEstimatedValue() != null && itemDto.getEstimatedValue().compareTo(BigDecimal.ZERO) < 0) {
                                throw new AppException(ErrorCode.INVALID_REQUEST, "Giá trị ước tính của tài sản '" + itemDto.getItemName() + "' phải lớn hơn hoặc bằng 0");
                            }
                            if (itemDto.getQuantity() != null && itemDto.getQuantity() < 1) {
                                throw new AppException(ErrorCode.INVALID_REQUEST, "Số lượng của tài sản '" + itemDto.getItemName() + "' phải lớn hơn hoặc bằng 1");
                            }
                        }
                    }
                }

                User witness = (request.getWitnessId() != null)
                        ? userRepository.findById(request.getWitnessId()).orElse(currentUser)
                        : currentUser;

                // Check if inventory has actually changed compared to existing record
                boolean isInventoryChanged = true;
                if (existingSealingOpt.isPresent()) {
                    SealingRecord existingSealing = existingSealingOpt.get();
                    List<AssetInventoryItem> existingItems = assetInventoryItemRepository.findBySealingRecord_Id(existingSealing.getId());
                    List<OverdueSealingWorkflowRequest.AssetItemDto> incomingItems = request.getInventoryItems() != null
                            ? request.getInventoryItems().stream()
                                    .filter(i -> i.getItemName() != null && !i.getItemName().trim().isEmpty())
                                    .toList()
                            : List.of();

                    boolean notesMatch = Objects.equals(
                            existingSealing.getNotes() != null ? existingSealing.getNotes().trim() : "",
                            request.getNotes() != null ? request.getNotes().trim() : ""
                    );

                    boolean witnessMatch = (existingSealing.getWitness() == null && witness == null)
                            || (existingSealing.getWitness() != null && witness != null && Objects.equals(existingSealing.getWitness().getId(), witness.getId()));

                    boolean itemsMatch = existingItems.size() == incomingItems.size();
                    if (itemsMatch) {
                        for (int i = 0; i < existingItems.size(); i++) {
                            AssetInventoryItem existingItem = existingItems.get(i);
                            OverdueSealingWorkflowRequest.AssetItemDto incomingItem = incomingItems.get(i);

                            String existingName = existingItem.getItemName() != null ? existingItem.getItemName().trim() : "";
                            String incomingName = incomingItem.getItemName() != null ? incomingItem.getItemName().trim() : "";

                            int existingQty = existingItem.getQuantity() != null ? existingItem.getQuantity() : 1;
                            int incomingQty = incomingItem.getQuantity() != null ? incomingItem.getQuantity() : 1;

                            String existingCond = existingItem.getConditionStatus() != null ? existingItem.getConditionStatus().trim() : "";
                            String incomingCond = incomingItem.getConditionStatus() != null ? incomingItem.getConditionStatus().trim() : "";

                            BigDecimal existingVal = existingItem.getEstimatedValue() != null ? existingItem.getEstimatedValue() : BigDecimal.ZERO;
                            BigDecimal incomingVal = incomingItem.getEstimatedValue() != null ? incomingItem.getEstimatedValue() : BigDecimal.ZERO;

                            String existingItemNotes = existingItem.getNotes() != null ? existingItem.getNotes().trim() : "";
                            String incomingItemNotes = incomingItem.getNotes() != null ? incomingItem.getNotes().trim() : "";

                            if (!existingName.equalsIgnoreCase(incomingName)
                                    || existingQty != incomingQty
                                    || !existingCond.equalsIgnoreCase(incomingCond)
                                    || existingVal.compareTo(incomingVal) != 0
                                    || !existingItemNotes.equals(incomingItemNotes)) {
                                itemsMatch = false;
                                break;
                            }
                        }
                    }

                    if (notesMatch && witnessMatch && itemsMatch) {
                        isInventoryChanged = false;
                    }
                }

                if (!isInventoryChanged) {
                    log.info("Inventory details for contract {} remain unchanged. Skipping audit log recording.", contractId);
                    return;
                }

                SealingRecord sealing = existingSealingOpt.orElseGet(() -> SealingRecord.builder()
                        .contract(contract)
                        .storageUnit(contract.getUnit())
                        .facility(contract.getFacility())
                        .sealTagNumber("INV-TEMP-" + (contract.getUnit() != null ? contract.getUnit().getUnitCode() : "") + "-" + (System.currentTimeMillis() % 10000))
                        .reason(request.getReason() != null ? request.getReason() : "Kiểm kê tài sản hiện trường")
                        .sealedAt(LocalDateTime.now())
                        .sealedBy(currentUser)
                        .witness(witness)
                        .status(SealingStatus.SEALED)
                        .build());

                sealing.setRequestStatus("IN_PROGRESS");
                sealing.setWitness(witness);
                sealing.setNotes(request.getNotes());
                if (sealing.getProtocolNumber() == null || sealing.getProtocolNumber().isBlank()) {
                    sealing.setProtocolNumber("BB-KK-" + (contract.getUnit() != null ? contract.getUnit().getUnitCode() : "") + "-" + (System.currentTimeMillis() % 10000));
                }
                sealingRecordRepository.save(sealing);

                // Clear old items if updating inventory
                if (sealing.getId() != null) {
                    var existingItems = assetInventoryItemRepository.findBySealingRecord_Id(sealing.getId());
                    if (!existingItems.isEmpty()) {
                        assetInventoryItemRepository.deleteAll(existingItems);
                    }
                }

                if (request.getInventoryItems() != null && !request.getInventoryItems().isEmpty()) {
                    StringBuilder summary = new StringBuilder("Kiểm kê " + request.getInventoryItems().size() + " mục tài sản: ");
                    for (var itemDto : request.getInventoryItems()) {
                        AssetInventoryItem item = AssetInventoryItem.builder()
                                .sealingRecord(sealing)
                                .itemName(itemDto.getItemName())
                                .quantity(itemDto.getQuantity() != null ? itemDto.getQuantity() : 1)
                                .conditionStatus(itemDto.getConditionStatus())
                                .estimatedValue(itemDto.getEstimatedValue() != null ? itemDto.getEstimatedValue() : BigDecimal.ZERO)
                                .notes(itemDto.getNotes())
                                .build();
                        assetInventoryItemRepository.save(item);
                        summary.append(itemDto.getItemName()).append(" (x").append(item.getQuantity()).append("); ");
                    }
                    sealing.setInventorySummary(summary.toString());
                    sealingRecordRepository.save(sealing);
                }

                recordAudit(
                        contract,
                        "INVENTORY_COMPLETED",
                        currentUser,
                        OverdueSealingStatus.SEALING_APPROVED.name(),
                        OverdueSealingStatus.SEALING_IN_PROGRESS.name(),
                        String.format("Đã hoàn tất kiểm kê hiện trường buồng kho có sự chứng kiến của %s. Biên bản kiểm kê: %s",
                                witness != null ? witness.getFullName() : (currentUser != null ? currentUser.getFullName() : "Nhân viên"),
                                sealing.getProtocolNumber())
                );
            }
            case "COMPLETE" -> {
                if (request.getSealTagNumber() == null || request.getSealTagNumber().trim().isEmpty()) {
                    throw new AppException(ErrorCode.INVALID_REQUEST, "Số tem niêm phong không được để trống khi hoàn tất niêm phong");
                }

                // Validate inventory items if provided: estimatedValue >= 0 and quantity >= 1
                if (request.getInventoryItems() != null) {
                    for (var itemDto : request.getInventoryItems()) {
                        if (itemDto.getItemName() != null && !itemDto.getItemName().trim().isEmpty()) {
                            if (itemDto.getEstimatedValue() != null && itemDto.getEstimatedValue().compareTo(BigDecimal.ZERO) < 0) {
                                throw new AppException(ErrorCode.INVALID_REQUEST, "Giá trị ước tính của tài sản '" + itemDto.getItemName() + "' phải lớn hơn hoặc bằng 0");
                            }
                            if (itemDto.getQuantity() != null && itemDto.getQuantity() < 1) {
                                throw new AppException(ErrorCode.INVALID_REQUEST, "Số lượng của tài sản '" + itemDto.getItemName() + "' phải lớn hơn hoặc bằng 1");
                            }
                        }
                    }
                }

                User witness = (request.getWitnessId() != null)
                        ? userRepository.findById(request.getWitnessId()).orElse(currentUser)
                        : currentUser;

                contract.setOverdueSealingStatus(OverdueSealingStatus.SEALING_COMPLETED);
                rentalContractRepository.save(contract);

                // Update storage unit status to UNDER_MAINTENANCE (Never AVAILABLE while assets remain!)
                if (contract.getUnit() != null) {
                    contract.getUnit().setStatus(UnitStatus.UNDER_MAINTENANCE);
                    storageUnitRepository.save(contract.getUnit());
                }

                LocalDate today = LocalDate.now(OverdueDebtCalculationService.VN_ZONE);
                FacilityPolicy policy = contract.getFacility() != null
                        ? facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(contract.getFacility().getId()).orElse(null)
                        : null;
                var calc = overdueDebtCalculationService.calculateOverdueDebt(contract, policy, today);

                SealingRecord sealing = existingSealingOpt.orElseGet(() -> SealingRecord.builder()
                        .contract(contract)
                        .storageUnit(contract.getUnit())
                        .facility(contract.getFacility())
                        .build());

                sealing.setSealTagNumber(request.getSealTagNumber().trim());
                sealing.setReason(request.getReason() != null ? request.getReason() : "Niêm phong do nợ cước quá hạn BR-RULE-012");
                sealing.setSealedAt(LocalDateTime.now());
                sealing.setSealedBy(currentUser);
                sealing.setWitness(witness);
                sealing.setStatus(SealingStatus.SEALED);
                sealing.setRequestStatus("COMPLETED");
                sealing.setProtocolNumber("BB-NP-" + (contract.getUnit() != null ? contract.getUnit().getUnitCode() : "") + "-" + (System.currentTimeMillis() % 10000));
                sealing.setOverdueDays(calc.overdueDays());
                sealing.setTotalDebtAmount(calc.totalDebt());
                if (request.getPhotoEvidenceUrl() != null) {
                    sealing.setPhotoEvidenceUrl(request.getPhotoEvidenceUrl());
                }
                if (request.getNotes() != null) {
                    sealing.setNotes(request.getNotes());
                }
                sealingRecordRepository.save(sealing);

                // Save asset inventory items if provided
                if (request.getInventoryItems() != null && !request.getInventoryItems().isEmpty()) {
                    if (sealing.getId() != null) {
                        var existingItems = assetInventoryItemRepository.findBySealingRecord_Id(sealing.getId());
                        if (!existingItems.isEmpty()) {
                            assetInventoryItemRepository.deleteAll(existingItems);
                        }
                    }
                    StringBuilder summary = new StringBuilder("Kiểm kê " + request.getInventoryItems().size() + " mục tài sản: ");
                    for (var itemDto : request.getInventoryItems()) {
                        AssetInventoryItem item = AssetInventoryItem.builder()
                                .sealingRecord(sealing)
                                .itemName(itemDto.getItemName())
                                .quantity(itemDto.getQuantity() != null ? itemDto.getQuantity() : 1)
                                .conditionStatus(itemDto.getConditionStatus())
                                .estimatedValue(itemDto.getEstimatedValue() != null ? itemDto.getEstimatedValue() : BigDecimal.ZERO)
                                .notes(itemDto.getNotes())
                                .build();
                        assetInventoryItemRepository.save(item);
                        summary.append(itemDto.getItemName()).append(" (x").append(item.getQuantity()).append("); ");
                    }
                    sealing.setInventorySummary(summary.toString());
                    sealingRecordRepository.save(sealing);
                }

                recordAudit(
                        contract,
                        "SEALING_COMPLETED",
                        currentUser,
                        OverdueSealingStatus.SEALING_APPROVED.name(),
                        OverdueSealingStatus.SEALING_COMPLETED.name(),
                        String.format("Đã hoàn tất dán tem niêm phong %s có sự chứng kiến của %s. Biên bản: %s",
                                sealing.getSealTagNumber(), witness.getFullName(), sealing.getProtocolNumber())
                );
            }
            default -> throw new AppException(ErrorCode.INVALID_REQUEST, "Hành động niêm phong không hợp lệ: " + action);
        }

        // Dispatch web notification for customer when sealing workflow changes
        if (contract.getCustomer() != null) {
            String unitCode = contract.getUnit() != null ? contract.getUnit().getUnitCode() : "N/A";
            String title = switch (action) {
                case "REQUEST" -> String.format("[Niêm phong] Đề xuất niêm phong buồng kho #%s", unitCode);
                case "APPROVE" -> String.format("[Niêm phong] Phê duyệt lệnh niêm phong buồng kho #%s", unitCode);
                case "COMPLETE" -> String.format("[Niêm phong & Kiểm kê] Hoàn tất niêm phong buồng kho #%s", unitCode);
                case "REJECT" -> String.format("[Niêm phong] Hủy đề xuất niêm phong buồng kho #%s", unitCode);
                default -> String.format("[Niêm phong] Thông báo cập nhật niêm phong kho #%s", unitCode);
            };
            String body = switch (action) {
                case "REQUEST" -> String.format("Nhân viên cơ sở đã lập đề xuất niêm phong buồng kho #%s (HĐ %s) do quá hạn cước. Lý do: %s",
                        unitCode, contract.getContractCode(), request.getReason());
                case "APPROVE" -> String.format("Quản lý cơ sở đã phê duyệt lệnh niêm phong buồng kho #%s (HĐ %s).",
                        unitCode, contract.getContractCode());
                case "COMPLETE" -> String.format("Cơ sở đã hoàn tất dán tem niêm phong buồng kho #%s (Mã số niêm phong/seal: %s) và lập danh mục kiểm kê tài sản lưu trữ.",
                        unitCode, request.getSealTagNumber() != null ? request.getSealTagNumber() : "N/A");
                case "REJECT" -> String.format("Đề xuất niêm phong buồng kho #%s đã được thu hồi. Lý do: %s",
                        unitCode, request.getRejectionReason());
                default -> "Cập nhật tiến trình niêm phong và kiểm kê buồng kho.";
            };

            NotificationLog sealNotif = NotificationLog.builder()
                    .recipient(contract.getCustomer())
                    .recipientEmail(contract.getCustomer().getEmail() != null ? contract.getCustomer().getEmail() : "")
                    .recipientName(contract.getCustomer().getFullName())
                    .facility(contract.getFacility())
                    .channel(NotificationChannel.IN_APP)
                    .notificationType(NotificationType.SEALING_NOTICE)
                    .referenceType("SEALING")
                    .referenceId(contract.getId())
                    .title(title)
                    .content(body)
                    .status("SENT")
                    .build();
            notificationLogRepository.save(sealNotif);
        }
    }

    @Override
    @Transactional(readOnly = true)
    public byte[] exportOverdueCsv(UUID facilityId, String stage, String searchTerm) {
        var pageResponse = getOverdueContracts(facilityId, stage, null, null, null, null, searchTerm, null, 0, 10000);
        List<OverdueContractItemResponse> list = pageResponse.getContent();

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (PrintWriter writer = new PrintWriter(out, true, StandardCharsets.UTF_8)) {
            // Write UTF-8 BOM for Microsoft Excel Vietnamese character compatibility
            out.write(0xEF);
            out.write(0xBB);
            out.write(0xBF);

            writer.println("Mã Hợp Đồng,Mã Kho,Cơ Sở,Khách Hàng,SĐT,Email,Ngày Đến Hạn,Số Ngày Quá Hạn,Nợ Gốc (VNĐ),Phí Phạt (VNĐ),Tổng Nợ (VNĐ),Phân Nhóm,Trạng Thái PIN,Trạng Thái Niêm Phong,SmartLock IoT");

            for (var item : list) {
                writer.printf("\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",%d,%.0f,%.0f,%.0f,\"%s\",\"%s\",\"%s\",\"%s\"\n",
                        escapeCsv(item.getContractCode()),
                        escapeCsv(item.getUnitCode()),
                        escapeCsv(item.getFacilityName()),
                        escapeCsv(item.getCustomerName()),
                        escapeCsv(item.getCustomerPhone()),
                        escapeCsv(item.getCustomerEmail()),
                        item.getDueDate() != null ? item.getDueDate().toString() : "",
                        item.getDaysOverdue(),
                        item.getPrincipalDebt() != null ? item.getPrincipalDebt().doubleValue() : 0.0,
                        item.getLateFee() != null ? item.getLateFee().doubleValue() : 0.0,
                        item.getTotalDebt() != null ? item.getTotalDebt().doubleValue() : 0.0,
                        escapeCsv(item.getStageLabel()),
                        item.getPinStatus() != null ? item.getPinStatus().name() : "",
                        item.getSealingStatus() != null ? item.getSealingStatus().name() : "",
                        item.getSmartLockOnlineStatus() != null ? (item.getSmartLockOnlineStatus() + (Boolean.TRUE.equals(item.getSmartLockIsMock()) ? " [MOCK]" : "")) : ""
                );
            }
            writer.flush();
        } catch (Exception e) {
            log.error("Error generating CSV export", e);
        }

        return out.toByteArray();
    }

    @Override
    @Transactional
    public void completeSettlement(UUID contractId) {
        completeSettlement(contractId, null);
    }

    @Override
    @Transactional
    public void completeSettlement(UUID contractId, OverdueSettlementRequest request) {
        RentalContract contract = rentalContractRepository.findById(contractId)
                .orElseThrow(() -> new AppException(ErrorCode.CONTRACT_NOT_FOUND));

        if (contract.getFacility() != null) {
            facilityAccessGuard.checkFacilityAccess(contract.getFacility().getId());
        }

        if (contract.getStatus() == RentalContractStatus.TERMINATED || contract.getStatus() == RentalContractStatus.CANCELLED) {
            throw new AppException(ErrorCode.CONTRACT_ALREADY_TERMINATED);
        }

        User currentUser = getCurrentUser();
        String oldStatus = contract.getStatus() != null ? contract.getStatus().name() : "N/A";

        Booking booking = contract.getBooking();
        if (booking == null && contract.getUnit() != null) {
            booking = bookingRepository.findFirstByStorageUnit_IdOrderByCreatedAtDesc(contract.getUnit().getId()).orElse(null);
        }

        Facility facility = contract.getFacility();
        FacilityPolicy policy = (facility != null)
                ? facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(facility.getId()).orElse(null)
                : null;
        LocalDate today = LocalDate.now(OverdueDebtCalculationService.VN_ZONE);
        OverdueDebtCalculationService.CalculationResult calc = overdueDebtCalculationService.calculateOverdueDebt(contract, policy, today);
        BigDecimal remainingDebt = (calc != null && calc.totalDebt() != null) ? calc.totalDebt() : BigDecimal.ZERO;
        BigDecimal lateFee = (calc != null && calc.lateFee() != null) ? calc.lateFee() : BigDecimal.ZERO;
        BigDecimal depositHeld = (calc != null && calc.depositHeld() != null) ? calc.depositHeld() : (contract.getDepositHeld() != null ? contract.getDepositHeld() : BigDecimal.ZERO);
        BigDecimal customerRefund = (calc != null && calc.customerRefundAmount() != null) ? calc.customerRefundAmount() : BigDecimal.ZERO;

        // Strict Financial Audit:
        // Do NOT blindly create a PAID CASH payment merely from clicking "Đã xong".
        // Must verify real payment proof or existing PAID payment before settling.
        if (remainingDebt.compareTo(BigDecimal.ZERO) > 0) {
            if (request == null || request.getReceiptVoucherCode() == null || request.getReceiptVoucherCode().trim().isEmpty()) {
                throw new AppException(ErrorCode.INVALID_REQUEST,
                        "Không thể hoàn tất tất toán: Khách hàng vẫn còn nợ cước "
                                + String.format(Locale.ROOT, "%,.0f", remainingDebt.doubleValue())
                                + " đ chưa được thanh toán hoặc xác nhận qua chứng từ hợp lệ.");
            }

            // Verify staff counter payment submission
            String cleanVoucher = request.getReceiptVoucherCode().trim();
            if (paymentRepository.existsByReceiptVoucherCodeIgnoreCase(cleanVoucher)) {
                throw new AppException(ErrorCode.INVALID_REQUEST, "Mã phiếu thu " + cleanVoucher + " đã tồn tại trong hệ thống");
            }

            if (request.getAmount() == null || request.getAmount().compareTo(remainingDebt) < 0) {
                throw new AppException(ErrorCode.INVALID_REQUEST,
                        "Số tiền thanh toán (" + (request.getAmount() != null ? request.getAmount() : 0)
                                + ") nhỏ hơn số dư nợ quá hạn cần thanh toán (" + remainingDebt + ")");
            }

            String method = (request.getPaymentMethod() != null && !request.getPaymentMethod().isBlank())
                    ? request.getPaymentMethod().trim().toUpperCase() : "CASH";
            if (!"CASH".equals(method) && !"BANK_TRANSFER".equals(method)) {
                throw new AppException(ErrorCode.INVALID_PAYMENT_METHOD);
            }

            String txnId = "SETTLE-" + contract.getContractCode() + "-" + System.currentTimeMillis();
            Payment payment = Payment.builder()
                    .transactionId(txnId)
                    .booking(booking)
                    .contract(contract)
                    .amount(request.getAmount())
                    .paymentType(PaymentType.RENTAL_FEE)
                    .paymentMethod(method)
                    .receiptVoucherCode(cleanVoucher)
                    .referenceCode(request.getReferenceCode() != null ? request.getReferenceCode().trim() : null)
                    .proofDocumentUrl(request.getProofDocumentUrl() != null ? request.getProofDocumentUrl().trim() : null)
                    .status(PaymentStatus.PAID)
                    .paymentTime(LocalDateTime.now())
                    .collectedByStaff(currentUser)
                    .confirmedByStaff(currentUser)
                    .confirmedAt(LocalDateTime.now())
                    .paymentNotes(request.getNotes() != null && !request.getNotes().isBlank()
                            ? request.getNotes()
                            : "Thanh toán công nợ quá hạn tại quầy cơ sở")
                    .build();
            paymentRepository.save(payment);
        }

        // 2. Penalty fee deducted from deposit -> Earned EXTRA_CHARGE revenue
        BigDecimal penaltyDeductedFromDeposit = lateFee.min(depositHeld);
        if (penaltyDeductedFromDeposit.compareTo(BigDecimal.ZERO) > 0) {
            String deductTxnId = "PENALTY-DEDUCT-" + contract.getContractCode() + "-" + System.currentTimeMillis();
            Payment deductPayment = Payment.builder()
                    .transactionId(deductTxnId)
                    .booking(booking)
                    .contract(contract)
                    .amount(penaltyDeductedFromDeposit)
                    .paymentType(PaymentType.EXTRA_CHARGE)
                    .paymentMethod("DEPOSIT_DEDUCTION")
                    .status(PaymentStatus.PAID)
                    .paymentTime(LocalDateTime.now())
                    .collectedByStaff(currentUser)
                    .confirmedByStaff(currentUser)
                    .confirmedAt(LocalDateTime.now())
                    .paymentNotes("Khấu trừ phí phạt trễ hạn từ tiền cọc hợp đồng " + contract.getContractCode())
                    .build();
            paymentRepository.save(deductPayment);
        }

        // 3. Deposit Refund Request to settle deposit liability and track refund outflow
        if (refundRequestRepository != null && depositHeld.compareTo(BigDecimal.ZERO) > 0) {
            String refCode = "REF-SETTLE-" + contract.getContractCode() + "-" + System.currentTimeMillis();
            User cust = contract.getCustomer() != null ? contract.getCustomer() : (booking != null ? booking.getCustomer() : currentUser);
            String custName = cust != null && cust.getFullName() != null ? cust.getFullName() : "Khách hàng";

            RefundRequest refundReq = RefundRequest.builder()
                    .requestCode(refCode)
                    .customer(cust)
                    .facility(facility)
                    .booking(booking)
                    .contract(contract)
                    .requestedAmount(depositHeld)
                    .deductionAmount(penaltyDeductedFromDeposit)
                    .finalRefundAmount(customerRefund)
                    .bankName("Chuyển khoản / Quầy")
                    .bankAccountNumber("N/A")
                    .bankAccountName(custName)
                    .reason("Quyết toán nợ cước và hoàn tiền cọc hợp đồng " + contract.getContractCode()
                            + " (Cọc: " + depositHeld + " đ, Khấu trừ phạt: " + penaltyDeductedFromDeposit + " đ)")
                    .status(RefundStatus.COMPLETED)
                    .requestedBy(currentUser != null ? currentUser : cust)
                    .reviewedBy(currentUser != null ? currentUser : cust)
                    .reviewedAt(LocalDateTime.now())
                    .processedAt(LocalDateTime.now())
                    .processNotes("Hoàn tất quyết toán cấn trừ cọc và trả kho")
                    .build();
            refundRequestRepository.save(refundReq);
        }

        // Clear temporary overdue access & mark contract terminated
        contract.setStatus(RentalContractStatus.TERMINATED);
        contract.setOverduePinStatus(OverduePinStatus.PIN_REVOKED);
        contract.setOverdueSealingStatus(OverdueSealingStatus.NONE);
        contract.setTempAccessPin(null);
        contract.setTempPinGrantedUntil(null);

        var sealingOpt = sealingRecordRepository.findFirstByContract_IdOrderByCreatedAtDesc(contractId);
        if (sealingOpt.isPresent()) {
            SealingRecord sr = sealingOpt.get();
            sr.setRequestStatus("SETTLED");
            sr.setStatus(SealingStatus.UNSEALED);
            sr.setNotes((sr.getNotes() != null && !sr.getNotes().isBlank() ? sr.getNotes() + " | " : "") + "Đã hoàn tất thanh toán nợ cước và trả kho giải phóng buồng.");
            sealingRecordRepository.save(sr);
        }

        if (booking != null) {
            booking.setAccessPin(null);
            booking.setQrAccessToken("REVOKED_SETTLED");
            booking.setStatus(BookingStatus.COMPLETED);
            bookingRepository.save(booking);
        }

        // Safe Storage Unit Release Logic:
        // Distinguish:
        // A. Customer pays debt and continues renting -> (contract renewal)
        // B. Customer pays debt but has not completed physical return -> unit remains not AVAILABLE
        // C. Customer pays debt, returns locker, inspection passes, and IoT SmartLock access is revoked -> AVAILABLE
        if (contract.getUnit() != null) {
            StorageUnit unit = contract.getUnit();
            String unitCode = unit.getUnitCode() != null ? unit.getUnitCode() : "";

            // Check if physical return handover record exists
            Optional<HandoverRecord> returnRecordOpt = Optional.empty();
            if (booking != null) {
                returnRecordOpt = handoverRecordRepository.findTopByBooking_IdAndRecordTypeOrderByRecordedAtDesc(booking.getId(), "RETURN");
                if (returnRecordOpt.isEmpty()) {
                    returnRecordOpt = handoverRecordRepository.findTopByBooking_IdAndRecordTypeOrderByRecordedAtDesc(booking.getId(), "INSPECTION");
                }
            }

            // Revoke IoT credentials via SmartLockAdapter
            SmartLockAdapter.RevocationResult revokeRes = smartLockAdapter.revokeCredentials(unitCode, "ONLINE", false);
            boolean smartLockRevoked = (revokeRes != null && revokeRes.success());

            if (returnRecordOpt.isEmpty()) {
                // Physical return has not taken place: do NOT release unit to AVAILABLE!
                log.info("Contract {} settled debt, but physical return handover is pending. Unit {} remains in status {}",
                        contract.getContractCode(), unitCode, unit.getStatus());
            } else if (!smartLockRevoked) {
                // SmartLock IoT device revocation failed: do NOT release unit to AVAILABLE!
                log.warn("Contract {} settled and inspected, but SmartLock IoT revocation failed for unit {}. Unit cannot be AVAILABLE.",
                        contract.getContractCode(), unitCode);
            } else {
                HandoverRecord hr = returnRecordOpt.get();
                boolean hasDamageOrIssues = (hr.getDeductionAmount() != null && hr.getDeductionAmount().compareTo(BigDecimal.ZERO) > 0)
                        || Boolean.FALSE.equals(hr.getDoorConditionPassed())
                        || Boolean.FALSE.equals(hr.getCleanlinessPassed())
                        || Boolean.FALSE.equals(hr.getSmartLockPassed())
                        || Boolean.FALSE.equals(hr.getSensorPassed())
                        || Boolean.FALSE.equals(hr.getWallStructurePassed());

                if (hasDamageOrIssues) {
                    unit.setStatus(UnitStatus.UNDER_MAINTENANCE);
                    log.info("Unit {} moved to UNDER_MAINTENANCE after return inspection with issues", unitCode);
                } else {
                    unit.setStatus(UnitStatus.AVAILABLE);
                    log.info("Unit {} return inspection passed and SmartLock revoked successfully. Released to AVAILABLE", unitCode);
                }
                storageUnitRepository.save(unit);
            }
        }

        rentalContractRepository.save(contract);

        recordAudit(
                contract,
                "OVERDUE_SETTLED_COMPLETED",
                currentUser,
                oldStatus,
                RentalContractStatus.TERMINATED.name(),
                "Khách hàng đã tới cơ sở thanh toán đủ công nợ quá hạn và hoàn tất thủ tục trả kho"
        );
    }

    @Override
    @Transactional
    public void releaseLiquidatedStorageUnit(UUID contractId, OverdueLiquidateReleaseRequest request) {
        RentalContract contract = rentalContractRepository.findById(contractId)
                .orElseThrow(() -> new AppException(ErrorCode.CONTRACT_NOT_FOUND));

        if (contract.getFacility() != null) {
            facilityAccessGuard.checkFacilityAccess(contract.getFacility().getId());
        }

        if (contract.getStatus() == RentalContractStatus.TERMINATED || contract.getStatus() == RentalContractStatus.CANCELLED) {
            throw new AppException(ErrorCode.CONTRACT_ALREADY_TERMINATED);
        }

        User currentUser = getCurrentUser();
        String oldStatus = contract.getStatus() != null ? contract.getStatus().name() : "N/A";
        Booking booking = contract.getBooking();
        if (booking == null && contract.getUnit() != null) {
            booking = bookingRepository.findFirstByStorageUnit_IdOrderByCreatedAtDesc(contract.getUnit().getId()).orElse(null);
        }

        // Không tạo giao dịch thanh toán cho việc thanh lý giải phóng kho

        // 2. Clear IoT Credentials & Directly Release Storage Unit to AVAILABLE
        if (contract.getUnit() != null) {
            StorageUnit unit = contract.getUnit();
            String unitCode = unit.getUnitCode() != null ? unit.getUnitCode() : "";
            try {
                smartLockAdapter.revokeCredentials(unitCode, "ONLINE", false);
            } catch (Exception e) {
                log.warn("Failed to revoke IoT credentials for unit {} during liquidation: {}", unitCode, e.getMessage());
            }
            unit.setStatus(UnitStatus.AVAILABLE);
            storageUnitRepository.save(unit);
            log.info("Storage unit {} released to AVAILABLE after overdue liquidation", unitCode);
        }

        // 3. Mark contract terminated & clear overdue states
        contract.setStatus(RentalContractStatus.TERMINATED);
        contract.setOverduePinStatus(OverduePinStatus.PIN_REVOKED);
        contract.setOverdueSealingStatus(OverdueSealingStatus.NONE);
        contract.setTempAccessPin(null);
        contract.setTempPinGrantedUntil(null);
        rentalContractRepository.save(contract);

        // 4. Update Sealing Record
        var sealingOpt = sealingRecordRepository.findFirstByContract_IdOrderByCreatedAtDesc(contractId);
        if (sealingOpt.isPresent()) {
            SealingRecord sr = sealingOpt.get();
            sr.setRequestStatus("LIQUIDATED_RELEASED");
            sr.setStatus(SealingStatus.UNSEALED);
            sr.setNotes((sr.getNotes() != null && !sr.getNotes().isBlank() ? sr.getNotes() + " | " : "")
                    + "Đã thanh lý tài sản kiểm kê và giải phóng kho về AVAILABLE (Thời gian giữ kho = 0)");
            sealingRecordRepository.save(sr);
        }

        // 5. Update Booking
        if (booking != null) {
            booking.setAccessPin(null);
            booking.setQrAccessToken("REVOKED_LIQUIDATED");
            booking.setStatus(BookingStatus.COMPLETED);
            bookingRepository.save(booking);
        }

        // 6. Record Audit Log
        String auditNotes = "Thanh lý tài sản kiểm kê và giải phóng buồng kho về trạng thái AVAILABLE";
        if (request != null && request.getNotes() != null && !request.getNotes().isBlank()) {
            auditNotes += ". Ghi chú: " + request.getNotes();
        }
        recordAudit(
                contract,
                "OVERDUE_LIQUIDATION_RELEASE",
                currentUser,
                oldStatus,
                RentalContractStatus.TERMINATED.name(),
                auditNotes
        );
    }

    private void validateContractActive(RentalContract contract) {
        if (contract.getStatus() == RentalContractStatus.TERMINATED || contract.getStatus() == RentalContractStatus.CANCELLED) {
            throw new AppException(ErrorCode.CONTRACT_ALREADY_TERMINATED);
        }
    }

    private String escapeCsv(String str) {
        if (str == null) return "";
        return str.replace("\"", "\"\"");
    }

    private String resolveStageLabel(OverdueStage stage) {
        if (stage == null) return "Chưa quá hạn";
        return switch (stage) {
            case GRACE_PERIOD -> "Ân hạn nhắc cước (1 ngày)";
            case WARNING -> "Cảnh báo quá hạn (2 ngày)";
            case PIN_REVOCATION -> "Đạt ngưỡng thu hồi PIN (3-6 ngày)";
            case SEALING_ELIGIBLE -> "Đủ điều kiện niêm phong (>= 7 ngày)";
            case POLICY_UNCONFIGURED -> "Thiếu chính sách quá hạn";
        };
    }

    private UUID resolveFacilityId(UUID requestedFacilityId) {
        if (facilityAccessGuard.isFacilityScoped()) {
            return facilityAccessGuard.scopedFacilityIdOrNull();
        }
        return requestedFacilityId;
    }

    private List<RentalContract> getScopedOverdueContracts(UUID facilityId, LocalDate today) {
        return rentalContractRepository.findActiveOrOverdueContractsBeforeDate(today).stream()
                .filter(c -> facilityId == null || (c.getFacility() != null && facilityId.equals(c.getFacility().getId())))
                .toList();
    }

    private User getCurrentUser() {
        UUID uid = requestContext.currentUserId();
        if (uid != null) {
            return userRepository.findById(uid).orElse(null);
        }
        return null;
    }

    private void recordAudit(RentalContract contract, String action, User user, String beforeState, String afterState, String details) {
        OverdueAuditLog audit = OverdueAuditLog.builder()
                .contract(contract)
                .action(action)
                .performedBy(user)
                .performedByName(user != null ? user.getFullName() : "Hệ thống Boxora")
                .performedByRole(user != null && user.getRole() != null ? user.getRole().getName() : "SYSTEM")
                .beforeState(beforeState)
                .afterState(afterState)
                .details(details)
                .build();
        overdueAuditLogRepository.save(audit);
    }
}

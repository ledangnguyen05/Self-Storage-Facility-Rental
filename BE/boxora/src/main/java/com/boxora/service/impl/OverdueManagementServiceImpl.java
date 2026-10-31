package com.boxora.service.impl;

import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.OverduePinActionRequest;
import com.boxora.dto.request.OverduePinTempGrantRequest;
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
        BigDecimal unverifiedPaymentsAmount = BigDecimal.ZERO;
        long unverifiedPaymentsCount = 0;

        long graceCount = 0;
        long warningCount = 0;
        long pinThresholdCount = 0;
        long sealingThresholdCount = 0;
        long policyUnconfiguredCount = 0;

        long pendingPinRevocationsCount = 0;
        long pendingSealingApprovalsCount = 0;

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
        }

        return OverdueSummaryResponse.builder()
                .asOfDate(today)
                .totalOverdueContracts(totalOverdueContracts)
                .totalOverdueDebt(totalOverdueDebt)
                .totalPrincipalDebt(totalPrincipalDebt)
                .totalLateFees(totalLateFees)
                .unverifiedPaymentsAmount(unverifiedPaymentsAmount)
                .unverifiedPaymentsCount(unverifiedPaymentsCount)
                .graceCount(graceCount)
                .warningCount(warningCount)
                .pinThresholdCount(pinThresholdCount)
                .sealingThresholdCount(sealingThresholdCount)
                .policyUnconfiguredCount(policyUnconfiguredCount)
                .pendingPinRevocationsCount(pendingPinRevocationsCount)
                .pendingSealingApprovalsCount(pendingSealingApprovalsCount)
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

        LocalDate today = LocalDate.now(OverdueDebtCalculationService.VN_ZONE);
        FacilityPolicy policy = contract.getFacility() != null
                ? facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(contract.getFacility().getId()).orElse(null)
                : null;

        var calc = overdueDebtCalculationService.calculateOverdueDebt(contract, policy, today);

        // Masked PIN logic
        String maskedPin = "Chưa cấp";
        if (contract.getBooking() != null && contract.getBooking().getAccessPin() != null) {
            String rawPin = contract.getBooking().getAccessPin();
            if (rawPin.length() >= 4) {
                maskedPin = "****" + rawPin.substring(rawPin.length() - 2);
            } else {
                maskedPin = "****";
            }
        }

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

        return OverdueContractDetailResponse.builder()
                .contractId(contract.getId())
                .contractCode(contract.getContractCode())
                .bookingId(contract.getBooking() != null ? contract.getBooking().getId() : null)
                .bookingCode(contract.getBooking() != null ? contract.getBooking().getBookingCode() : null)
                .unitId(contract.getUnit() != null ? contract.getUnit().getId() : null)
                .unitCode(contract.getUnit() != null ? contract.getUnit().getUnitCode() : "N/A")
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
                .unverifiedAmount(calc.unverifiedAmount())
                .depositHeld(contract.getDepositHeld())
                .stage(calc.stage())
                .stageLabel(resolveStageLabel(calc.stage()))
                .feeFormulaExplanation(calc.feeFormulaExplanation())
                .pinStatus(contract.getOverduePinStatus() != null ? contract.getOverduePinStatus() : OverduePinStatus.PIN_ACTIVE)
                .sealingStatus(contract.getOverdueSealingStatus() != null ? contract.getOverdueSealingStatus() : OverdueSealingStatus.NONE)
                .smartLockOnlineStatus(contract.getSmartLockOnlineStatus() != null ? contract.getSmartLockOnlineStatus() : "ONLINE")
                .smartLockIsMock(contract.getSmartLockIsMock() != null ? contract.getSmartLockIsMock() : true)
                .maskedPin(maskedPin)
                .smartLockLastUnlockedAt(contract.getSmartLockLastUnlockedAt())
                .tempPinGrantedUntil(contract.getTempPinGrantedUntil())
                .tempPinGrantReason(contract.getTempPinGrantReason())
                .isDemo(Boolean.TRUE.equals(contract.getIsDemo()))
                .hasActivePolicy(calc.isPolicyValid())
                .policyWarning(calc.policyWarning())
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

        if (contract.getFacility() != null) {
            facilityAccessGuard.checkFacilityAccess(contract.getFacility().getId());
        }

        LocalDate today = LocalDate.now(OverdueDebtCalculationService.VN_ZONE);
        FacilityPolicy policy = contract.getFacility() != null
                ? facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(contract.getFacility().getId()).orElse(null)
                : null;

        var calc = overdueDebtCalculationService.calculateOverdueDebt(contract, policy, today);

        String content = request.getContent();
        if (content == null || content.trim().isEmpty()) {
            content = String.format(
                    "[BOXORA %s] Kính gửi %s, hợp đồng thuê kho #%s (%s) tại %s đã quá hạn %d ngày. Tổng công nợ cần thanh toán: %,.0f VNĐ (Nợ gốc: %,.0f đ, Phí phạt: %,.0f đ). Vui lòng thanh toán tại boxora.vn hoặc liên hệ BQL cơ sở.",
                    request.getTemplateType(),
                    contract.getCustomer() != null ? contract.getCustomer().getFullName() : "Quý khách",
                    contract.getUnit() != null ? contract.getUnit().getUnitCode() : "N/A",
                    contract.getContractCode(),
                    contract.getFacility() != null ? contract.getFacility().getName() : "Boxora",
                    calc.overdueDays(),
                    calc.totalDebt().doubleValue(),
                    calc.principalDebt().doubleValue(),
                    calc.lateFee().doubleValue()
            );
        }

        User currentUser = getCurrentUser();

        OverdueNoticeLog noticeLog = OverdueNoticeLog.builder()
                .contract(contract)
                .customer(contract.getCustomer())
                .channel(request.getChannel())
                .templateType(request.getTemplateType())
                .content(content)
                .sentBy(currentUser)
                .sentAt(LocalDateTime.now())
                .deliveryStatus("DELIVERED")
                .notes(request.getNotes())
                .build();
        overdueNoticeLogRepository.save(noticeLog);

        // Attempt real email dispatch if customer email is configured
        if (contract.getCustomer() != null && contract.getCustomer().getEmail() != null) {
            try {
                emailService.sendOverdueNoticeEmail(
                        contract.getCustomer().getEmail(),
                        contract.getCustomer().getFullName(),
                        contract.getContractCode(),
                        contract.getUnit() != null ? contract.getUnit().getUnitCode() : "N/A",
                        calc.overdueDays(),
                        calc.totalDebt(),
                        calc.stage().name()
                );
            } catch (Exception e) {
                log.warn("Could not dispatch overdue email notice: {}", e.getMessage());
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

        if (contract.getFacility() != null) {
            facilityAccessGuard.checkFacilityAccess(contract.getFacility().getId());
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

            Booking booking = contract.getBooking();
            if (booking != null) {
                booking.setAccessPin(null);
                booking.setQrAccessToken("REVOKED_OVERDUE");
                bookingRepository.save(booking);
            }

            rentalContractRepository.save(contract);

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

        if (contract.getFacility() != null) {
            facilityAccessGuard.checkFacilityAccess(contract.getFacility().getId());
        }

        User currentUser = getCurrentUser();
        String unitCode = contract.getUnit() != null ? contract.getUnit().getUnitCode() : "N/A";

        var tempResult = smartLockAdapter.grantTemporaryPin(unitCode, request.getHours());

        contract.setOverduePinStatus(OverduePinStatus.PIN_ACTIVE);
        contract.setTempPinGrantedUntil(LocalDateTime.now().plusHours(request.getHours()));
        contract.setTempPinGrantReason(request.getReason());

        if (contract.getBooking() != null) {
            contract.getBooking().setAccessPin(tempResult.tempPin());
            contract.getBooking().setQrAccessToken("TEMP_ACCESS_" + System.currentTimeMillis());
            bookingRepository.save(contract.getBooking());
        }

        rentalContractRepository.save(contract);

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

                SealingRecord sealing = existingSealingOpt.orElseThrow(() -> new AppException(ErrorCode.INVALID_REQUEST, "Chưa có yêu cầu niêm phong để phê duyệt"));
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
                        "Quản lý cơ sở đã phê duyệt đề xuất niêm phong kho."
                );
            }
            case "REJECT" -> {
                contract.setOverdueSealingStatus(OverdueSealingStatus.SEALING_REJECTED);
                rentalContractRepository.save(contract);

                if (existingSealingOpt.isPresent()) {
                    SealingRecord sealing = existingSealingOpt.get();
                    sealing.setRequestStatus("REJECTED");
                    sealing.setRejectionReason(request.getRejectionReason());
                    sealingRecordRepository.save(sealing);
                }

                recordAudit(
                        contract,
                        "SEALING_REJECTED",
                        currentUser,
                        OverdueSealingStatus.SEALING_REQUESTED.name(),
                        OverdueSealingStatus.SEALING_REJECTED.name(),
                        "Từ chối yêu cầu niêm phong. Lý do: " + request.getRejectionReason()
                );
            }
            case "COMPLETE" -> {
                if (request.getSealTagNumber() == null || request.getSealTagNumber().trim().isEmpty()) {
                    throw new AppException(ErrorCode.INVALID_REQUEST, "Số tem niêm phong không được để trống khi hoàn tất niêm phong");
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
                sealing.setPhotoEvidenceUrl(request.getPhotoEvidenceUrl());
                sealing.setNotes(request.getNotes());
                sealingRecordRepository.save(sealing);

                // Save asset inventory items
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

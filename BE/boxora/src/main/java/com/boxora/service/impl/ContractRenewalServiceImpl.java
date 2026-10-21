package com.boxora.service.impl;

import com.boxora.client.DocuSealClient;
import com.boxora.common.response.PageResponse;
import com.boxora.config.DocuSealConfig;
import com.boxora.dto.request.DocuSealSubmissionRequest;
import com.boxora.dto.request.PricingQuoteRequest;
import com.boxora.dto.response.ContractRenewalResponse;
import com.boxora.dto.response.DocuSealSubmitterResponse;
import com.boxora.dto.response.PricingQuoteResponse;
import com.boxora.dto.response.VNPayPaymentResponse;
import com.boxora.entity.Booking;
import com.boxora.entity.ContractRenewal;
import com.boxora.entity.Payment;
import com.boxora.entity.RentalContract;
import com.boxora.enums.ActivityAction;
import com.boxora.enums.ContractRenewalStatus;
import com.boxora.enums.PaymentStatus;
import com.boxora.enums.PaymentType;
import com.boxora.enums.RentalContractStatus;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.mapper.ContractRenewalMapper;
import com.boxora.repository.BookingRepository;
import com.boxora.repository.ContractRenewalRepository;
import com.boxora.repository.PaymentRepository;
import com.boxora.repository.RentalContractRepository;
import com.boxora.security.FacilityAccessGuard;
import com.boxora.security.RequestContext;
import com.boxora.service.ActivityLogService;
import com.boxora.service.ContractBillingService;
import com.boxora.service.ContractRenewalService;
import com.boxora.service.OverdueFeeCalculator;
import com.boxora.service.PaymentService;
import com.boxora.service.PricingService;
import jakarta.persistence.criteria.Predicate;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Contract renewal: request (inside the facility renewal window, or any time while the contract is overdue)
 * -> sign the addendum (DocuSeal, or in-app when DocuSeal is not configured: test environment) -> pay the
 * RENEWAL_FEE through VNPay. When both are done the contract AND its booking get the new end date; an
 * overdue contract also gets its access restored. The fee is the PricingService quote for the renewal cycle
 * plus the late fee of an overdue contract.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ContractRenewalServiceImpl implements ContractRenewalService {

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final List<ContractRenewalStatus> OPEN = List.of(ContractRenewalStatus.PENDING_SIGNATURE, ContractRenewalStatus.PENDING_PAYMENT);
    private static final Set<String> SORTABLE = Set.of("createdAt", "newEndDate", "oldEndDate", "status");
    private static final int MAX_CYCLE_MONTHS = 36;
    public static final String SIGNING_DOCUSEAL = "DOCUSEAL";
    public static final String SIGNING_IN_APP_TEST = "IN_APP_TEST";
    private static final String DEFAULT_FRONTEND_URL = "http://localhost:5173";

    private final DocuSealClient docuSealClient;
    private final DocuSealConfig docuSealConfig;
    private final RentalContractRepository rentalContractRepository;
    private final ContractRenewalRepository contractRenewalRepository;
    private final PaymentRepository paymentRepository;
    private final BookingRepository bookingRepository;
    private final ContractRenewalMapper contractRenewalMapper;
    private final ActivityLogService activityLogService;
    private final FacilityAccessGuard facilityAccessGuard;
    private final RequestContext requestContext;
    private final ObjectProvider<PaymentService> paymentServiceProvider;
    private final PricingService pricingService;
    private final ContractBillingService contractBillingService;
    private final OverdueFeeCalculator overdueFeeCalculator;

    @Value("${app.frontend-url:}")
    private String frontendUrl;

    // =====================================================================================
    // Request
    // =====================================================================================

    @Override
    @Transactional
    public ContractRenewalResponse requestRenewal(UUID contractId, Integer cycleMonths) {
        int cycle = cycleMonths == null ? 1 : cycleMonths;
        if (cycle < 1 || cycle > MAX_CYCLE_MONTHS) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Số tháng gia hạn phải từ 1 đến " + MAX_CYCLE_MONTHS + ".");
        }

        RentalContract contract = rentalContractRepository.findById(contractId)
                .orElseThrow(() -> new AppException(ErrorCode.CONTRACT_NOT_FOUND));
        contractBillingService.assertContractAccess(contract);

        LocalDate today = LocalDate.now();
        ContractBillingService.RenewalWindow window = contractBillingService.renewalWindow(contract, today);
        if (!window.renewable()) {
            ErrorCode code = contract.getStatus() == RentalContractStatus.ACTIVE && window.opensOn() != null && today.isBefore(window.opensOn())
                    ? ErrorCode.CONTRACT_RENEWAL_WINDOW_CLOSED : ErrorCode.CONTRACT_RENEWAL_NOT_ALLOWED;
            throw new AppException(code, window.blockedReason());
        }
        if (contractRenewalRepository.existsByContract_IdAndStatusIn(contractId, OPEN)) {
            throw new AppException(ErrorCode.CONTRACT_RENEWAL_ALREADY_PENDING);
        }

        LocalDate oldEndDate = contract.getEndDate();
        LocalDate newEndDate = oldEndDate.plusMonths(cycle);
        if (!newEndDate.isAfter(today)) {
            long minimum = ChronoUnit.MONTHS.between(oldEndDate, today) + 1;
            throw new AppException(ErrorCode.CONTRACT_RENEWAL_TERM_TOO_SHORT, String.format(
                    "Hợp đồng đã quá hạn từ ngày %s. Vui lòng gia hạn ít nhất %d tháng để thời hạn mới kéo dài qua hôm nay.",
                    oldEndDate.format(DATE_FMT), minimum));
        }

        // One price source: the PricingService quote for the renewal cycle, starting at the current end date.
        PricingQuoteResponse quote = pricingService.calculateQuote(PricingQuoteRequest.builder()
                .storageUnitId(contract.getUnit().getId())
                .rentalMonths(cycle)
                .startDate(oldEndDate)
                .renewal(Boolean.TRUE)
                .build());
        BigDecimal rentalFee = quote.getTotalRentalFee() != null ? quote.getTotalRentalFee().setScale(0, RoundingMode.HALF_UP) : BigDecimal.ZERO;
        BigDecimal lateFee = lateFeeOf(contract, today);
        BigDecimal renewalFee = rentalFee.add(lateFee);
        if (renewalFee.signum() <= 0) {
            throw new AppException(ErrorCode.PAYMENT_AMOUNT_INVALID, "Không tính được phí gia hạn cho kho này. Vui lòng liên hệ cơ sở.");
        }

        ContractRenewal renewal = ContractRenewal.builder()
                .contract(contract)
                .oldEndDate(oldEndDate)
                .newEndDate(newEndDate)
                .cycleMonths(cycle)
                .rentalFeeAmount(rentalFee)
                .lateFeeAmount(lateFee)
                .renewalFee(renewalFee)
                .status(ContractRenewalStatus.PENDING_SIGNATURE)
                .build();
        renewal = contractRenewalRepository.save(renewal);

        try {
            ensureSubmission(renewal);
        } catch (AppException e) {
            // The renewal stays valid: "Ký phụ lục" retries the submission later.
            log.warn("DocuSeal submission for renewal {} failed: {}", renewal.getId(), e.getMessage());
        }

        activityLogService.record(
                contract.getFacility().getId(),
                ActivityAction.RENEWAL_REQUEST,
                "ContractRenewal",
                renewal.getId(),
                String.format("Yêu cầu gia hạn hợp đồng %s thêm %d tháng (đến %s), phí %s%s",
                        contract.getContractCode(), cycle, newEndDate.format(DATE_FMT), renewalFee.toPlainString(),
                        lateFee.signum() > 0 ? " gồm phí trễ hạn " + lateFee.toPlainString() : ""),
                null,
                renewal.getId()
        );
        return toResponse(renewal);
    }

    private BigDecimal lateFeeOf(RentalContract contract, LocalDate today) {
        if (contract.getEndDate() == null || !today.isAfter(contract.getEndDate())) {
            return BigDecimal.ZERO;
        }
        BigDecimal fee = overdueFeeCalculator.calculateLateFee(contract, today);
        return fee != null ? fee.setScale(0, RoundingMode.HALF_UP) : BigDecimal.ZERO;
    }

    /** Creates the DocuSeal submission of the addendum once (mock slug when DocuSeal is not configured). */
    private void ensureSubmission(ContractRenewal renewal) {
        if (renewal.getDocusealSubmitterSlug() != null) {
            return;
        }
        RentalContract contract = renewal.getContract();
        String customerName = contract.getCustomer().getFullName() != null
                ? contract.getCustomer().getFullName() : contract.getCustomer().getUsername();
        String customerEmail = contract.getCustomer().getEmail();

        DocuSealSubmissionRequest submissionRequest = DocuSealSubmissionRequest.builder()
                .template_id(docuSealConfig.getEffectiveRenewalTemplateId())
                .send_email(false)
                .completed_redirect_url(frontendBase() + "/portal/customer?tab=my-units&renewalSigned=" + renewal.getId())
                .submitters(List.of(
                        DocuSealSubmissionRequest.Submitter.builder()
                                .role("Customer")
                                .email(customerEmail)
                                .name(customerName)
                                .external_id("RENEWAL_" + renewal.getId())
                                .fields(List.of(
                                        field("customer_name", customerName),
                                        field("customer_email", customerEmail),
                                        field("contract_code", contract.getContractCode() != null ? contract.getContractCode() : contract.getId().toString()),
                                        field("unit_code", contract.getUnit().getUnitCode()),
                                        field("facility_name", contract.getFacility().getName()),
                                        field("old_end_date", renewal.getOldEndDate().format(DATE_FMT)),
                                        field("new_end_date", renewal.getNewEndDate().format(DATE_FMT)),
                                        field("cycle_months", String.valueOf(renewal.getCycleMonths())),
                                        field("renewal_fee", renewal.getRenewalFee().toPlainString())
                                ))
                                .build()
                ))
                .build();

        List<DocuSealSubmitterResponse> submitters = docuSealClient.createSubmission(submissionRequest);
        if (submitters == null || submitters.isEmpty()) {
            throw new AppException(ErrorCode.CONTRACT_SIGNING_PROVIDER_UNAVAILABLE);
        }
        DocuSealSubmitterResponse submitter = submitters.get(0);
        renewal.setDocusealSubmissionId(submitter.getSubmission_id());
        renewal.setDocusealSubmitterSlug(submitter.getSlug());
        renewal.setSigningMethod(docuSealConfig.isMockActive() ? SIGNING_IN_APP_TEST : SIGNING_DOCUSEAL);
        contractRenewalRepository.save(renewal);
    }

    // =====================================================================================
    // Pay / sign / cancel
    // =====================================================================================

    @Override
    @Transactional
    public VNPayPaymentResponse createRenewalPayment(UUID renewalId, HttpServletRequest httpRequest) {
        ContractRenewal renewal = contractRenewalRepository.findById(renewalId)
                .orElseThrow(() -> new AppException(ErrorCode.CONTRACT_RENEWAL_NOT_FOUND));
        RentalContract contract = renewal.getContract();
        contractBillingService.assertContractAccess(contract);

        if (renewal.getStatus() == ContractRenewalStatus.COMPLETED) {
            throw new AppException(ErrorCode.CONTRACT_RENEWAL_ALREADY_COMPLETED);
        }
        if (renewal.getStatus() == ContractRenewalStatus.CANCELLED) {
            throw new AppException(ErrorCode.CONTRACT_RENEWAL_NOT_PAYABLE, "Yêu cầu gia hạn đã bị hủy. Vui lòng tạo yêu cầu mới.");
        }
        Payment existing = renewal.getPayment();
        if (existing != null && existing.getStatus() == PaymentStatus.PAID) {
            throw new AppException(ErrorCode.PAYMENT_ALREADY_PROCESSED, "Phí gia hạn đã được thanh toán.");
        }

        // The late fee of an overdue contract keeps growing until it is paid: charge today's amount.
        BigDecimal lateFee = lateFeeOf(contract, LocalDate.now());
        BigDecimal rentalFee = renewal.getRentalFeeAmount() != null ? renewal.getRentalFeeAmount()
                : renewal.getRenewalFee().subtract(renewal.getLateFeeAmount() != null ? renewal.getLateFeeAmount() : BigDecimal.ZERO);
        BigDecimal fee = rentalFee.add(lateFee);
        if (fee.compareTo(renewal.getRenewalFee()) != 0) {
            renewal.setLateFeeAmount(lateFee);
            renewal.setRenewalFee(fee);
        }
        if (existing != null && existing.getStatus() == PaymentStatus.PENDING) {
            existing.setStatus(PaymentStatus.EXPIRED);
            paymentRepository.save(existing);
        }

        String orderInfo = "Gia han hop dong " + (contract.getContractCode() != null ? contract.getContractCode() : contract.getId())
                + " " + renewal.getCycleMonths() + " thang";
        VNPayPaymentResponse paymentResponse = paymentServiceProvider.getObject().createContractPayment(
                contract, contract.getBooking(), PaymentType.RENEWAL_FEE, renewal.getRenewalFee(), renewal.getCycleMonths(),
                lateFee, BigDecimal.ZERO, 0, orderInfo, httpRequest);

        if (paymentResponse.getPaymentId() != null) {
            paymentRepository.findById(paymentResponse.getPaymentId()).ifPresent(renewal::setPayment);
        }
        contractRenewalRepository.save(renewal);
        return paymentResponse;
    }

    @Override
    @Transactional
    public ContractRenewalResponse mockSignRenewal(UUID renewalId, String signatureData) {
        if (!docuSealConfig.isMockActive()) {
            throw new AppException(ErrorCode.CONTRACT_MOCK_SIGN_DISABLED);
        }
        ContractRenewal renewal = contractRenewalRepository.findById(renewalId)
                .orElseThrow(() -> new AppException(ErrorCode.CONTRACT_RENEWAL_NOT_FOUND));
        // Same rule as the main contract: only the customer named on the contract signs the addendum, in their own
        // session. Staff and administrators never sign electronically on the customer's behalf.
        requireContractCustomer(renewal.getContract());
        assertOpen(renewal);
        if (renewal.getSignedAt() != null) {
            throw new AppException(ErrorCode.CONTRACT_RENEWAL_ALREADY_SIGNED);
        }
        if (signatureData == null || signatureData.isBlank()) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Vui lòng ký tên trước khi xác nhận phụ lục gia hạn.");
        }
        renewal.setSignatureData(signatureData);
        renewal.setSigningMethod(SIGNING_IN_APP_TEST);
        contractRenewalRepository.save(renewal);
        // No signed PDF exists in the test environment: the document URL stays empty.
        handleRenewalSigned(renewalId, null);
        return toResponse(contractRenewalRepository.findById(renewalId).orElse(renewal));
    }

    @Override
    @Transactional
    public ContractRenewalResponse cancelRenewal(UUID renewalId, String reason) {
        ContractRenewal renewal = contractRenewalRepository.findById(renewalId)
                .orElseThrow(() -> new AppException(ErrorCode.CONTRACT_RENEWAL_NOT_FOUND));
        contractBillingService.assertContractAccess(renewal.getContract());
        Payment payment = renewal.getPayment();
        if (renewal.getStatus() == ContractRenewalStatus.COMPLETED || (payment != null && payment.getStatus() == PaymentStatus.PAID)) {
            throw new AppException(ErrorCode.CONTRACT_RENEWAL_CANNOT_CANCEL);
        }
        if (renewal.getStatus() == ContractRenewalStatus.CANCELLED) {
            return toResponse(renewal);
        }
        if (payment != null && payment.getStatus() == PaymentStatus.PENDING) {
            payment.setStatus(PaymentStatus.EXPIRED);
            paymentRepository.save(payment);
        }
        renewal.setStatus(ContractRenewalStatus.CANCELLED);
        renewal.setCancelledAt(LocalDateTime.now());
        renewal.setCancelReason(reason != null && !reason.isBlank() ? reason.trim() : "Khách hàng hủy yêu cầu gia hạn");
        contractRenewalRepository.save(renewal);
        activityLogService.record(
                renewal.getContract().getFacility().getId(),
                ActivityAction.RENEWAL_REQUEST,
                "ContractRenewal",
                renewal.getId(),
                "Hủy yêu cầu gia hạn hợp đồng " + renewal.getContract().getContractCode() + ": " + renewal.getCancelReason(),
                null,
                ContractRenewalStatus.CANCELLED.name()
        );
        return toResponse(renewal);
    }

    private void assertOpen(ContractRenewal renewal) {
        if (renewal.getStatus() == ContractRenewalStatus.COMPLETED) {
            throw new AppException(ErrorCode.CONTRACT_RENEWAL_ALREADY_COMPLETED);
        }
        if (renewal.getStatus() == ContractRenewalStatus.CANCELLED) {
            throw new AppException(ErrorCode.CONTRACT_RENEWAL_NOT_PAYABLE, "Yêu cầu gia hạn đã bị hủy.");
        }
    }

    @Override
    @Transactional
    public void handleRenewalSigned(UUID renewalId, String documentUrl) {
        ContractRenewal renewal = contractRenewalRepository.findById(renewalId).orElse(null);
        if (renewal == null) {
            log.warn("No renewal found for ID={}", renewalId);
            return;
        }
        if (renewal.getSignedAt() != null) {
            log.info("Renewal {} already marked as signed - ignoring duplicate webhook", renewalId);
            return;
        }
        renewal.setSignedDocumentUrl(documentUrl);
        renewal.setSignedAt(LocalDateTime.now());

        boolean isPaid = renewal.getPayment() != null && renewal.getPayment().getStatus() == PaymentStatus.PAID;
        if (isPaid) {
            completeRenewal(renewal);
        } else {
            renewal.setStatus(ContractRenewalStatus.PENDING_PAYMENT);
            activityLogService.recordSystem(
                    renewal.getContract().getFacility().getId(),
                    ActivityAction.CONTRACT_SIGNED,
                    "ContractRenewal",
                    renewal.getId(),
                    "Phụ lục gia hạn hợp đồng " + renewal.getContract().getContractCode() + " đã được ký"
                            + (SIGNING_IN_APP_TEST.equals(renewal.getSigningMethod()) ? " trong cổng Boxora (môi trường thử nghiệm)" : " qua DocuSeal")
                            + ", chờ thanh toán phí gia hạn"
            );
        }
        contractRenewalRepository.save(renewal);
    }

    @Override
    @Transactional
    public void handleRenewalPaid(Payment payment) {
        ContractRenewal renewal = contractRenewalRepository.findByPaymentId(payment.getId()).orElse(null);
        if (renewal == null && payment.getContract() != null) {
            renewal = contractRenewalRepository.findFirstByContract_IdAndStatusInOrderByCreatedAtDesc(payment.getContract().getId(), OPEN)
                    .orElse(null);
        }
        if (renewal == null) {
            log.warn("No renewal found matching payment ID={}", payment.getId());
            return;
        }
        renewal.setPayment(payment);
        if (renewal.getStatus() == ContractRenewalStatus.CANCELLED) {
            log.warn("Renewal {} was cancelled but its fee was paid ({}); reopening it", renewal.getId(), payment.getTransactionId());
            renewal.setCancelledAt(null);
        }

        if (renewal.getSignedAt() != null) {
            completeRenewal(renewal);
        } else {
            renewal.setStatus(ContractRenewalStatus.PENDING_SIGNATURE);
            activityLogService.recordSystem(
                    renewal.getContract().getFacility().getId(),
                    ActivityAction.RENEWAL_PAID,
                    "ContractRenewal",
                    renewal.getId(),
                    "Phí gia hạn hợp đồng " + renewal.getContract().getContractCode() + " đã thanh toán, chờ ký phụ lục"
            );
        }
        contractRenewalRepository.save(renewal);
    }

    /** Signed and paid: extend the contract and its booking; restore access of an overdue contract. */
    private void completeRenewal(ContractRenewal renewal) {
        renewal.setStatus(ContractRenewalStatus.COMPLETED);
        RentalContract contract = renewal.getContract();
        boolean wasOverdue = contract.getStatus() == RentalContractStatus.OVERDUE || contract.getStatus() == RentalContractStatus.OVERDUE_LOCKED;
        LocalDate newEnd = renewal.getNewEndDate();
        if (contract.getEndDate() == null || newEnd.isAfter(contract.getEndDate())) {
            contract.setEndDate(newEnd);
        }
        if (!wasOverdue) {
            contract.setStatus(RentalContractStatus.ACTIVE);
        }
        rentalContractRepository.save(contract);

        Booking booking = contract.getBooking();
        if (booking != null && (booking.getEndDate() == null || contract.getEndDate().isAfter(booking.getEndDate()))) {
            // Return settlement, reports and overdue detection read the booking end date too.
            booking.setEndDate(contract.getEndDate());
            bookingRepository.save(booking);
        }

        activityLogService.recordSystem(
                contract.getFacility().getId(),
                ActivityAction.CONTRACT_EXTENDED,
                "RentalContract",
                contract.getId(),
                "Hợp đồng " + contract.getContractCode() + " đã được gia hạn thêm " + renewal.getCycleMonths()
                        + " tháng, đến ngày " + contract.getEndDate().format(DATE_FMT)
        );
        if (wasOverdue) {
            contractBillingService.restoreAccessAfterCommit(contract, "Gia hạn hợp đồng " + contract.getContractCode()
                    + " đến " + contract.getEndDate().format(DATE_FMT) + " và đã thanh toán phí gia hạn");
        }
    }

    // =====================================================================================
    // Read
    // =====================================================================================

    @Override
    @Transactional(readOnly = true)
    public ContractRenewalResponse getById(UUID renewalId) {
        ContractRenewal renewal = contractRenewalRepository.findById(renewalId)
                .orElseThrow(() -> new AppException(ErrorCode.CONTRACT_RENEWAL_NOT_FOUND));
        contractBillingService.assertContractAccess(renewal.getContract());
        return toResponse(renewal);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ContractRenewalResponse> getRenewalsByContractId(UUID contractId) {
        RentalContract contract = rentalContractRepository.findById(contractId)
                .orElseThrow(() -> new AppException(ErrorCode.CONTRACT_NOT_FOUND));
        contractBillingService.assertContractAccess(contract);
        return contractRenewalRepository.findByContractIdOrderByCreatedAtDesc(contractId).stream().map(this::toResponse).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<ContractRenewalResponse> getAllRenewals(int page, int size, String sortBy, String sortDir) {
        return getAllRenewals(null, null, null, page, size, sortBy, sortDir);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<ContractRenewalResponse> getAllRenewals(
            UUID contractId, UUID facilityId, ContractRenewalStatus status,
            int page, int size, String sortBy, String sortDir) {
        String sortField = sortBy != null && SORTABLE.contains(sortBy) ? sortBy : "createdAt";
        Sort sort = Sort.by("asc".equalsIgnoreCase(sortDir) ? Sort.Direction.ASC : Sort.Direction.DESC, sortField);
        Pageable pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 200), sort);

        UUID effectiveFacilityId = facilityId;
        if (facilityAccessGuard.isFacilityScoped()) {
            effectiveFacilityId = facilityAccessGuard.scopedFacilityIdOrNull();
        }
        UUID effectiveCustomerId = null;
        if ("CUSTOMER".equalsIgnoreCase(requestContext.currentUserRole())) {
            effectiveCustomerId = requestContext.currentUserId();
        }
        final UUID queryFacilityId = effectiveFacilityId;
        final UUID queryCustomerId = effectiveCustomerId;

        Specification<ContractRenewal> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (contractId != null) {
                predicates.add(cb.equal(root.get("contract").get("id"), contractId));
            }
            if (queryFacilityId != null) {
                predicates.add(cb.equal(root.get("contract").get("facility").get("id"), queryFacilityId));
            }
            if (queryCustomerId != null) {
                predicates.add(cb.equal(root.get("contract").get("customer").get("id"), queryCustomerId));
            }
            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };

        Page<ContractRenewal> result = contractRenewalRepository.findAll(spec, pageable);
        return PageResponse.from(result.map(this::toResponse));
    }

    @Override
    @Transactional
    public String getRenewalSigningUrl(UUID renewalId) {
        ContractRenewal renewal = contractRenewalRepository.findById(renewalId)
                .orElseThrow(() -> new AppException(ErrorCode.CONTRACT_RENEWAL_NOT_FOUND));
        contractBillingService.assertContractAccess(renewal.getContract());
        // The signing link acts as the customer's signature: it is only handed to the customer.
        requireContractCustomer(renewal.getContract());
        assertOpen(renewal);
        if (renewal.getSignedAt() != null) {
            throw new AppException(ErrorCode.CONTRACT_RENEWAL_ALREADY_SIGNED);
        }
        ensureSubmission(renewal);
        return signingUrl(renewal);
    }

    /** True when the caller is the customer named on the contract (the only person who may sign it). */
    private boolean callerIsContractCustomer(RentalContract contract) {
        UUID currentUserId = requestContext.currentUserId();
        return "CUSTOMER".equalsIgnoreCase(requestContext.currentUserRole()) && currentUserId != null
                && contract != null && contract.getCustomer() != null && currentUserId.equals(contract.getCustomer().getId());
    }

    private void requireContractCustomer(RentalContract contract) {
        if (!callerIsContractCustomer(contract)) {
            throw new AppException(ErrorCode.CONTRACT_SIGNER_NOT_CUSTOMER,
                    "Chỉ khách hàng đứng tên hợp đồng mới được ký phụ lục gia hạn, trong tài khoản của chính mình.");
        }
    }

    private ContractRenewalResponse toResponse(ContractRenewal renewal) {
        ContractRenewalResponse response = contractRenewalMapper.toResponse(renewal);
        if (callerIsContractCustomer(renewal.getContract())
                && renewal.getDocusealSubmitterSlug() != null && renewal.getSignedAt() == null
                && renewal.getStatus() != ContractRenewalStatus.CANCELLED && renewal.getStatus() != ContractRenewalStatus.COMPLETED) {
            response.setSigningUrl(signingUrl(renewal));
        }
        if (response.getRentalFeeAmount() == null) {
            response.setRentalFeeAmount(renewal.getRenewalFee());
        }
        return response;
    }

    /** DocuSeal link, or the in-app signing link of the portal when DocuSeal is not configured. */
    private String signingUrl(ContractRenewal renewal) {
        String slug = renewal.getDocusealSubmitterSlug();
        if (slug == null || slug.startsWith("mock-") || SIGNING_IN_APP_TEST.equals(renewal.getSigningMethod())) {
            return frontendBase() + "/portal/customer?tab=my-units&mockSignRenewalId=" + renewal.getId();
        }
        return docuSealConfig.getWebBaseUrl() + "/s/" + slug;
    }

    private String frontendBase() {
        String base = frontendUrl != null ? frontendUrl.trim() : "";
        if (base.isEmpty()) {
            base = DEFAULT_FRONTEND_URL;
        }
        return base.endsWith("/") ? base.substring(0, base.length() - 1) : base;
    }

    private DocuSealSubmissionRequest.Field field(String name, String value) {
        return DocuSealSubmissionRequest.Field.builder()
                .name(name)
                .default_value(value != null ? value : "")
                .build();
    }
}

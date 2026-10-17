package com.boxora.service.impl;

import com.boxora.client.DocuSealClient;
import com.boxora.common.response.PageResponse;
import com.boxora.config.DocuSealConfig;
import com.boxora.dto.request.ContractCreateRequest;
import com.boxora.dto.request.DocuSealSubmissionRequest;
import com.boxora.dto.response.DocuSealSubmitterResponse;
import com.boxora.dto.response.RentalContractResponse;
import com.boxora.entity.Booking;
import com.boxora.entity.Facility;
import com.boxora.entity.RentalContract;
import com.boxora.entity.StorageUnit;
import com.boxora.entity.User;
import com.boxora.enums.ActivityAction;
import com.boxora.enums.BookingStatus;
import com.boxora.enums.RentalContractStatus;
import com.boxora.enums.UnitStatus;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.mapper.RentalContractMapper;
import com.boxora.repository.BookingRepository;
import com.boxora.repository.FacilityRepository;
import com.boxora.repository.RentalContractRepository;
import com.boxora.repository.StorageUnitRepository;
import com.boxora.repository.UserRepository;
import com.boxora.security.FacilityAccessGuard;
import com.boxora.security.RequestContext;
import com.boxora.service.ActivityLogService;
import com.boxora.service.ContractRenewalService;
import com.boxora.service.ContractSigningService;
import com.boxora.service.EmailService;
import com.boxora.service.EncryptionService;
import com.boxora.util.VNPayUtil;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import java.util.Optional;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ContractSigningServiceImpl implements ContractSigningService {

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final DocuSealClient docuSealClient;
    private final DocuSealConfig docuSealConfig;
    private final RentalContractRepository rentalContractRepository;
    private final UserRepository userRepository;
    private final StorageUnitRepository storageUnitRepository;
    private final FacilityRepository facilityRepository;
    private final BookingRepository bookingRepository;
    private final com.boxora.repository.PaymentRepository paymentRepository;
    private final com.boxora.repository.RefundRequestRepository refundRequestRepository;
    private final RentalContractMapper rentalContractMapper;
    private final ActivityLogService activityLogService;
    private final EmailService emailService;
    private final EncryptionService encryptionService;
    private final FacilityAccessGuard facilityAccessGuard;
    private final RequestContext requestContext;

    @Lazy
    private final ContractRenewalService contractRenewalService;

    @org.springframework.beans.factory.annotation.Value("${app.frontend-url:http://localhost:5173}")
    private String frontendUrl;

    @Override
    @Transactional
    public RentalContractResponse createContract(ContractCreateRequest request) {
        Facility facility = facilityRepository.findById(request.getFacilityId())
                .orElseThrow(() -> new AppException(ErrorCode.FACILITY_NOT_FOUND));

        facilityAccessGuard.checkFacilityAccess(facility.getId());

        User customer = userRepository.findById(request.getCustomerId())
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        StorageUnit unit = storageUnitRepository.findById(request.getUnitId())
                .orElseThrow(() -> new AppException(ErrorCode.STORAGE_UNIT_NOT_FOUND));

        Booking booking = null;
        if (request.getBookingId() != null) {
            booking = bookingRepository.findById(request.getBookingId())
                    .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));
        }

        String contractCode = request.getContractCode();
        if (contractCode == null || contractCode.isBlank()) {
            contractCode = "CTR" + System.currentTimeMillis() + VNPayUtil.randomAlphaNumeric(4);
        }

        RentalContract contract = RentalContract.builder()
                .contractCode(contractCode)
                .customer(customer)
                .unit(unit)
                .facility(facility)
                .booking(booking)
                .startDate(request.getStartDate())
                .endDate(request.getEndDate())
                .monthlyFee(request.getMonthlyFee())
                .depositHeld(request.getDepositHeld() != null ? request.getDepositHeld() : BigDecimal.ZERO)
                .status(RentalContractStatus.PENDING_SIGNATURE)
                .build();

        contract = rentalContractRepository.save(contract);

        activityLogService.record(
                facility.getId(),
                ActivityAction.CONTRACT_CREATE,
                "RentalContract",
                contract.getId(),
                "Tao hop dong thue kho " + contract.getContractCode(),
                null,
                contract.getContractCode()
        );

        RentalContractResponse response = rentalContractMapper.toResponse(contract);
        return response;
    }

    @Override
    @Transactional(readOnly = true)
    public RentalContractResponse getContractById(UUID contractId) {
        RentalContract contract = rentalContractRepository.findById(contractId)
                .orElseThrow(() -> new AppException(ErrorCode.CONTRACT_NOT_FOUND));

        if (facilityAccessGuard.isFacilityScoped()) {
            facilityAccessGuard.checkFacilityAccess(contract.getFacility().getId());
        }
        if ("CUSTOMER".equalsIgnoreCase(requestContext.currentUserRole())) {
            UUID currentUserId = requestContext.currentUserId();
            if (currentUserId != null && !currentUserId.equals(contract.getCustomer().getId())) {
                throw new AppException(ErrorCode.FORBIDDEN);
            }
        }

        RentalContractResponse response = rentalContractMapper.toResponse(contract);
        if (!"CUSTOMER".equalsIgnoreCase(requestContext.currentUserRole())
                && contract.getDocusealSubmitterSlug() != null) {
            response.setSigningUrl(signingUrl(contract, contract.getDocusealSubmitterSlug()));
        }
        return response;
    }

    @Override
    @Transactional
    public RentalContractResponse getContractByBookingId(UUID bookingId) {
        if (bookingId == null) {
            throw new AppException(ErrorCode.BOOKING_NOT_FOUND);
        }

        RentalContract contract = rentalContractRepository.findByBookingId(bookingId)
                .orElseGet(() -> {
                    // Nếu hợp đồng chưa được khởi tạo trước đó, tự động tạo hợp đồng cho booking hợp lệ
                    Booking booking = bookingRepository.findById(bookingId)
                            .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));
                    return ensureContractForBooking(booking);
                });

        if (contract == null) {
            throw new AppException(ErrorCode.CONTRACT_NOT_FOUND);
        }

        if (facilityAccessGuard.isFacilityScoped()) {
            facilityAccessGuard.checkFacilityAccess(contract.getFacility().getId());
        }
        if ("CUSTOMER".equalsIgnoreCase(requestContext.currentUserRole())) {
            UUID currentUserId = requestContext.currentUserId();
            if (currentUserId == null || contract.getCustomer() == null || !currentUserId.equals(contract.getCustomer().getId())) {
                throw new AppException(ErrorCode.FORBIDDEN);
            }
        }

        RentalContractResponse response = rentalContractMapper.toResponse(contract);
        if (!"CUSTOMER".equalsIgnoreCase(requestContext.currentUserRole())
                && contract.getDocusealSubmitterSlug() != null) {
            response.setSigningUrl(signingUrl(contract, contract.getDocusealSubmitterSlug()));
        }
        return response;
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<RentalContractResponse> getAllContracts(
            UUID customerId, UUID facilityId, RentalContractStatus status,
            int page, int size, String sortBy, String sortDir) {

        Sort sort = Sort.by(Sort.Direction.fromString(sortDir != null ? sortDir : "desc"),
                sortBy != null ? sortBy : "createdAt");
        Pageable pageable = PageRequest.of(page, size, sort);

        UUID effectiveFacilityId = facilityId;
        if (facilityAccessGuard.isFacilityScoped()) {
            effectiveFacilityId = facilityAccessGuard.scopedFacilityIdOrNull();
        }

        UUID effectiveCustomerId = customerId;
        if ("CUSTOMER".equalsIgnoreCase(requestContext.currentUserRole())) {
            effectiveCustomerId = requestContext.currentUserId();
        }

        final UUID queryFacilityId = effectiveFacilityId;
        final UUID queryCustomerId = effectiveCustomerId;

        if (queryCustomerId != null) {
            autoGenerateContractsForOrphanConfirmedBookings(queryCustomerId);
        }

        Specification<RentalContract> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (queryCustomerId != null) {
                predicates.add(cb.equal(root.get("customer").get("id"), queryCustomerId));
            }
            if (queryFacilityId != null) {
                predicates.add(cb.equal(root.get("facility").get("id"), queryFacilityId));
            }
            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };

        Page<RentalContract> result = rentalContractRepository.findAll(spec, pageable);
        return PageResponse.from(result.map(c -> {
            RentalContractResponse res = rentalContractMapper.toResponse(c);
            if (!"CUSTOMER".equalsIgnoreCase(requestContext.currentUserRole())
                    && c.getDocusealSubmitterSlug() != null) {
                res.setSigningUrl(signingUrl(c, c.getDocusealSubmitterSlug()));
            }
            return res;
        }));
    }

    @Override
    @Transactional
    public String createSigningRequest(UUID contractId) {
        RentalContract contract = rentalContractRepository.findById(contractId)
                .orElseThrow(() -> new AppException(ErrorCode.CONTRACT_NOT_FOUND));

        if (facilityAccessGuard.isFacilityScoped()) {
            facilityAccessGuard.checkFacilityAccess(contract.getFacility().getId());
        }
        if ("CUSTOMER".equalsIgnoreCase(requestContext.currentUserRole())) {
            UUID currentUserId = requestContext.currentUserId();
            if (currentUserId != null && !currentUserId.equals(contract.getCustomer().getId())) {
                throw new AppException(ErrorCode.FORBIDDEN);
            }
        }

        return createSigningRequest(contract);
    }

    @Override
    @Transactional
    public String createSigningRequest(RentalContract contract) {
        if (contract.getSignedAt() != null
                || contract.getStatus() == RentalContractStatus.ACTIVE
                || contract.getStatus() == RentalContractStatus.PENDING_ACTIVATION) {
            if (contract.getSignedDocumentUrl() != null) {
                return contract.getSignedDocumentUrl();
            }
            throw new AppException(ErrorCode.CONTRACT_ALREADY_SIGNED);
        }

        if (contract.getBooking() != null && isBookingAwaitingOrCompletedRefund(contract.getBooking())) {
            throw new AppException(ErrorCode.INVALID_REQUEST);
        }

        // Nếu đã có slug tạo trước đó và chưa ký, có thể tái sử dụng signing URL
        if (contract.getDocusealSubmitterSlug() != null) {
            return signingUrl(contract, contract.getDocusealSubmitterSlug());
        }

        String customerName = contract.getCustomer().getFullName() != null ? contract.getCustomer().getFullName() : contract.getCustomer().getUsername();
        String customerEmail = contract.getCustomer().getEmail();

        DocuSealSubmissionRequest request = DocuSealSubmissionRequest.builder()
                .template_id(docuSealConfig.getTemplateId())
                .send_email(false)
                .completed_redirect_url(frontendUrl + "/portal/customer?tab=contracts&signed=true")
                .submitters(List.of(
                        DocuSealSubmissionRequest.Submitter.builder()
                                .role("Customer")
                                .email(customerEmail)
                                .name(customerName)
                                .external_id(contract.getId().toString())
                                .fields(List.of(
                                        field("customer_name", customerName),
                                        field("customer_email", customerEmail),
                                        field("unit_code", contract.getUnit().getUnitCode()),
                                        field("facility_name", contract.getFacility().getName()),
                                        field("start_date", contract.getStartDate().format(DATE_FMT)),
                                        field("end_date", contract.getEndDate().format(DATE_FMT)),
                                        field("monthly_fee", contract.getMonthlyFee() != null ? contract.getMonthlyFee().toPlainString() : "0"),
                                        field("deposit_amount", contract.getDepositHeld() != null ? contract.getDepositHeld().toPlainString() : "0")
                                ))
                                .build()
                ))
                .build();

        List<DocuSealSubmitterResponse> submitters = docuSealClient.createSubmission(request);

        if (submitters == null || submitters.isEmpty()) {
            throw new AppException(ErrorCode.CONTRACT_SIGNING_FAILED);
        }

        DocuSealSubmitterResponse submitter = submitters.get(0);
        contract.setDocusealSubmissionId(submitter.getSubmission_id());
        contract.setDocusealSubmitterSlug(submitter.getSlug());
        contract.setStatus(RentalContractStatus.PENDING_SIGNATURE);
        rentalContractRepository.save(contract);

        activityLogService.record(
                contract.getFacility().getId(),
                ActivityAction.CONTRACT_CREATE,
                "RentalContract",
                contract.getId(),
                "Gui yeu cau ky hop dong e-Contract qua DocuSeal, submissionId: " + submitter.getSubmission_id(),
                null,
                submitter.getSubmission_id()
        );

        if (submitter.getLink() != null && !submitter.getLink().isBlank()) {
            return submitter.getLink();
        }
        return signingUrl(contract, submitter.getSlug());
    }

    @Override
    @Transactional(readOnly = true)
    public String getSigningUrl(UUID contractId) {
        RentalContract contract = rentalContractRepository.findById(contractId)
                .orElseThrow(() -> new AppException(ErrorCode.CONTRACT_NOT_FOUND));

        if (facilityAccessGuard.isFacilityScoped()) {
            facilityAccessGuard.checkFacilityAccess(contract.getFacility().getId());
        }
        if ("CUSTOMER".equalsIgnoreCase(requestContext.currentUserRole())) {
            UUID currentUserId = requestContext.currentUserId();
            if (currentUserId != null && !currentUserId.equals(contract.getCustomer().getId())) {
                throw new AppException(ErrorCode.FORBIDDEN);
            }
        }

        if (contract.getBooking() != null && isBookingAwaitingOrCompletedRefund(contract.getBooking())) {
            throw new AppException(ErrorCode.INVALID_REQUEST);
        }

        if (contract.getDocusealSubmitterSlug() != null) {
            return signingUrl(contract, contract.getDocusealSubmitterSlug());
        }
        return createSigningRequest(contract);
    }

    private String signingUrl(RentalContract contract, String slug) {
        if (docuSealConfig.isMockActive() && slug != null && slug.startsWith("mock-")) {
            return frontendUrl + "/portal/customer?tab=contracts&mockSignContractId=" + contract.getId();
        }
        return docuSealConfig.getWebBaseUrl() + "/s/" + slug;
    }

    private DocuSealSubmissionRequest.Field field(String name, String value) {
        return DocuSealSubmissionRequest.Field.builder()
                .name(name)
                .default_value(value != null ? value : "")
                .build();
    }

    @Override
    @Transactional
    public void handleWebhook(Map<String, Object> payload) {
        String eventType = (String) payload.get("event_type");
        if (!"form.completed".equals(eventType)) {
            log.info("Ignoring DocuSeal event: {}", eventType);
            return;
        }

        @SuppressWarnings("unchecked")
        Map<String, Object> data = (Map<String, Object>) payload.get("data");
        if (data == null) {
            log.warn("DocuSeal webhook missing 'data' field");
            return;
        }

        String externalId = (String) data.get("external_id");
        if (externalId == null || externalId.isBlank()) {
            log.warn("DocuSeal webhook missing external_id - cannot match contract or renewal");
            return;
        }

        String documentUrl = extractFirstDocumentUrl(data);
        log.info("DocuSeal webhook form.completed received for external_id: {}, docUrl: {}", externalId, documentUrl);

        // Trường hợp 1: Phụ lục gia hạn hợp đồng (RENEWAL_<uuid>)
        if (externalId.startsWith("RENEWAL_")) {
            String rawRenewalId = externalId.substring("RENEWAL_".length());
            try {
                UUID renewalId = UUID.fromString(rawRenewalId);
                contractRenewalService.handleRenewalSigned(renewalId, documentUrl);
            } catch (IllegalArgumentException e) {
                log.error("Invalid UUID format for renewal external_id: {}", externalId);
            }
            return;
        }

        // Trường hợp 2: Hợp đồng chính (UUID)
        UUID contractId;
        try {
            contractId = UUID.fromString(externalId);
        } catch (IllegalArgumentException e) {
            log.error("Invalid UUID in DocuSeal external_id: {}", externalId);
            return;
        }

        RentalContract contract = rentalContractRepository.findById(contractId).orElse(null);
        if (contract == null) {
            log.warn("No contract found for DocuSeal external_id={}", externalId);
            return;
        }

        // Idempotency: không xử lý lại nếu đã được đánh dấu ký
        if (contract.getSignedAt() != null
                || contract.getStatus() == RentalContractStatus.ACTIVE
                || contract.getStatus() == RentalContractStatus.PENDING_ACTIVATION) {
            log.info("Contract {} already marked as signed - ignoring duplicate webhook", contract.getId());
            return;
        }

        completeContractSigning(contract, documentUrl);
    }

    @Override
    @Transactional
    public RentalContractResponse mockSign(UUID contractId) {
        return mockSign(contractId, null);
    }

    @Override
    @Transactional
    public RentalContractResponse mockSign(UUID contractId, String signatureData) {
        RentalContract contract = rentalContractRepository.findById(contractId)
                .orElseThrow(() -> new AppException(ErrorCode.CONTRACT_NOT_FOUND));

        if (facilityAccessGuard.isFacilityScoped()) {
            facilityAccessGuard.checkFacilityAccess(contract.getFacility().getId());
        }

        String currentRole = requestContext.currentUserRole();
        UUID currentUserId = requestContext.currentUserId();
        if (currentRole == null && currentUserId == null) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }
        if ("CUSTOMER".equalsIgnoreCase(currentRole)) {
            if (currentUserId == null) {
                throw new AppException(ErrorCode.UNAUTHORIZED);
            }
            if (contract.getCustomer() == null || !currentUserId.equals(contract.getCustomer().getId())) {
                throw new AppException(ErrorCode.FORBIDDEN);
            }
        }

        if (!docuSealConfig.isMockActive()) {
            throw new AppException(ErrorCode.FORBIDDEN);
        }

        if (signatureData == null || signatureData.isBlank()) {
            throw new AppException(ErrorCode.INVALID_REQUEST);
        }
        String trimmedSig = signatureData.trim();
        if (trimmedSig.length() > 500_000
                || (!trimmedSig.startsWith("data:image/png;base64,")
                        && !trimmedSig.startsWith("data:image/svg+xml;")
                        && !trimmedSig.startsWith("data:image/jpeg;base64,")
                        && !trimmedSig.startsWith("data:image/webp;base64,"))) {
            throw new AppException(ErrorCode.INVALID_REQUEST);
        }
        int commaIdx = trimmedSig.indexOf(',');
        if (commaIdx < 0 || trimmedSig.substring(commaIdx + 1).isBlank()) {
            throw new AppException(ErrorCode.INVALID_REQUEST);
        }

        if (contract.getStatus() == RentalContractStatus.TERMINATED
                || contract.getStatus() == RentalContractStatus.EXPIRED) {
            throw new AppException(ErrorCode.INVALID_REQUEST);
        }

        if (contract.getBooking() != null) {
            Booking booking = contract.getBooking();
            if (booking.getStatus() == BookingStatus.CANCELLED
                    || booking.getStatus() == BookingStatus.OVERDUE
                    || booking.getStatus() == BookingStatus.COMPLETED
                    || isBookingAwaitingOrCompletedRefund(booking)) {
                throw new AppException(ErrorCode.INVALID_REQUEST);
            }

            boolean isPaperOrInPerson = "PAPER".equalsIgnoreCase(contract.getSigningMethod())
                    || "IN_PERSON".equalsIgnoreCase(contract.getSigningMethod())
                    || "IN_PERSON".equalsIgnoreCase(booking.getSigningMethod());
            if (!isPaperOrInPerson && !isBookingInitialPaymentSatisfied(booking)) {
                throw new AppException(ErrorCode.INVALID_REQUEST);
            }
        }

        contract.setSignatureData(trimmedSig);

        if (contract.getSignedAt() != null
                || contract.getStatus() == RentalContractStatus.ACTIVE
                || contract.getStatus() == RentalContractStatus.PENDING_ACTIVATION) {
            rentalContractRepository.save(contract);
            return rentalContractMapper.toResponse(contract);
        }

        String sampleDocUrl = "https://docuseal.com/documents/contract-" + contract.getContractCode() + "-signed.pdf";
        completeContractSigning(contract, sampleDocUrl);
        return rentalContractMapper.toResponse(contract);
    }

    private boolean isBookingAwaitingOrCompletedRefund(Booking booking) {
        if (booking == null) {
            return false;
        }
        if ("REFUNDED".equalsIgnoreCase(booking.getPaymentStatus())) {
            return true;
        }
        if (booking.getId() != null && refundRequestRepository != null) {
            boolean hasActiveOrCompletedRefundReq = refundRequestRepository.existsByBooking_IdAndStatusIn(
                    booking.getId(),
                    List.of(
                            com.boxora.enums.RefundStatus.PENDING_REVIEW,
                            com.boxora.enums.RefundStatus.APPROVED,
                            com.boxora.enums.RefundStatus.PROCESSING_TRANSFER,
                            com.boxora.enums.RefundStatus.AWAITING_CUSTOMER_CONFIRMATION,
                            com.boxora.enums.RefundStatus.RECONCILED,
                            com.boxora.enums.RefundStatus.PROCESSED,
                            com.boxora.enums.RefundStatus.COMPLETED
                    )
            );
            if (hasActiveOrCompletedRefundReq) {
                return true;
            }
        }
        if (booking.getId() != null && paymentRepository != null) {
            List<com.boxora.entity.Payment> payments = paymentRepository.findAllByBooking_Id(booking.getId());
            if (payments != null) {
                for (com.boxora.entity.Payment p : payments) {
                    if (p == null) continue;
                    if (p.getBooking() != null && p.getBooking().getId() != null && !booking.getId().equals(p.getBooking().getId())) {
                        continue;
                    }
                    if (p.getStatus() == com.boxora.enums.PaymentStatus.REFUND_PENDING) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    private boolean isBookingInitialPaymentSatisfied(Booking booking) {
        if (booking == null) {
            return false;
        }
        if (booking.getStatus() == BookingStatus.PENDING_PAYMENT
                || booking.getStatus() == BookingStatus.CANCELLED
                || "REFUNDED".equalsIgnoreCase(booking.getPaymentStatus())
                || isBookingAwaitingOrCompletedRefund(booking)) {
            return false;
        }

        BigDecimal requiredDeposit = booking.getDepositAmount() != null && booking.getDepositAmount().compareTo(BigDecimal.ZERO) > 0
                ? booking.getDepositAmount()
                : (booking.getStorageUnit() != null && booking.getStorageUnit().getUnitType() != null
                        && booking.getStorageUnit().getUnitType().getDepositAmount() != null
                        ? booking.getStorageUnit().getUnitType().getDepositAmount()
                        : BigDecimal.ZERO);
        BigDecimal requiredFirstMonthRent = booking.getTotalRentalFee() != null && booking.getRentalMonths() != null && booking.getRentalMonths() > 0
                ? booking.getTotalRentalFee().divide(BigDecimal.valueOf(booking.getRentalMonths()), 2, java.math.RoundingMode.HALF_UP)
                : (booking.getTotalRentalFee() != null && booking.getTotalRentalFee().compareTo(BigDecimal.ZERO) > 0
                        ? booking.getTotalRentalFee()
                        : BigDecimal.ZERO);

        List<com.boxora.entity.Payment> payments = paymentRepository != null
                ? paymentRepository.findAllByBooking_Id(booking.getId())
                : List.of();

        BigDecimal paidDeposit = BigDecimal.ZERO;
        BigDecimal paidRent = BigDecimal.ZERO;
        BigDecimal paidBooking = BigDecimal.ZERO;
        BigDecimal refundedDeposit = BigDecimal.ZERO;
        BigDecimal refundedRent = BigDecimal.ZERO;
        BigDecimal refundedBooking = BigDecimal.ZERO;
        boolean hasRefundedOrRefundPendingDepositTx = false;

        if (payments != null) {
            for (com.boxora.entity.Payment p : payments) {
                if (p == null || p.getAmount() == null || p.getAmount().compareTo(BigDecimal.ZERO) <= 0) {
                    continue;
                }
                if (booking.getId() != null && p.getBooking() != null && p.getBooking().getId() != null
                        && !booking.getId().equals(p.getBooking().getId())) {
                    continue;
                }
                com.boxora.enums.PaymentStatus st = p.getStatus();
                com.boxora.enums.PaymentType pt = p.getPaymentType();
                if (pt != com.boxora.enums.PaymentType.DEPOSIT
                        && pt != com.boxora.enums.PaymentType.RENTAL_FEE
                        && pt != com.boxora.enums.PaymentType.BOOKING_PAYMENT) {
                    continue;
                }
                if (st == com.boxora.enums.PaymentStatus.PAID) {
                    if (pt == com.boxora.enums.PaymentType.DEPOSIT) {
                        paidDeposit = paidDeposit.add(p.getAmount());
                    } else if (pt == com.boxora.enums.PaymentType.RENTAL_FEE) {
                        paidRent = paidRent.add(p.getAmount());
                    } else if (pt == com.boxora.enums.PaymentType.BOOKING_PAYMENT) {
                        paidBooking = paidBooking.add(p.getAmount());
                    }
                } else if (st == com.boxora.enums.PaymentStatus.REFUND_PENDING) {
                    if (pt == com.boxora.enums.PaymentType.DEPOSIT || pt == com.boxora.enums.PaymentType.BOOKING_PAYMENT) {
                        hasRefundedOrRefundPendingDepositTx = true;
                    }
                } else if (st == com.boxora.enums.PaymentStatus.REFUNDED) {
                    if (pt == com.boxora.enums.PaymentType.DEPOSIT) {
                        refundedDeposit = refundedDeposit.add(p.getAmount());
                        hasRefundedOrRefundPendingDepositTx = true;
                    } else if (pt == com.boxora.enums.PaymentType.RENTAL_FEE) {
                        refundedRent = refundedRent.add(p.getAmount());
                    } else if (pt == com.boxora.enums.PaymentType.BOOKING_PAYMENT) {
                        refundedBooking = refundedBooking.add(p.getAmount());
                        hasRefundedOrRefundPendingDepositTx = true;
                    }
                }
            }
        }

        if (paidDeposit.compareTo(BigDecimal.ZERO) == 0 && paidRent.compareTo(BigDecimal.ZERO) == 0 && paidBooking.compareTo(BigDecimal.ZERO) == 0) {
            if (!hasRefundedOrRefundPendingDepositTx
                    && refundedRent.compareTo(BigDecimal.ZERO) == 0
                    && "PAID".equalsIgnoreCase(booking.getPaymentStatus())) {
                return true;
            }
            if (booking.getDepositPaid() == null || booking.getDepositPaid().compareTo(BigDecimal.ZERO) <= 0) {
                return false;
            }
        }

        BigDecimal bookingDepositField = booking.getDepositPaid() != null && booking.getDepositPaid().compareTo(BigDecimal.ZERO) > 0
                ? booking.getDepositPaid()
                : BigDecimal.ZERO;
        boolean canFallbackToBookingDepositField = booking.getStatus() != BookingStatus.PENDING_PAYMENT
                && !hasRefundedOrRefundPendingDepositTx
                && !"UNPAID".equalsIgnoreCase(booking.getPaymentStatus());
        BigDecimal baseDepositPaid = (paidDeposit.compareTo(BigDecimal.ZERO) == 0 && paidBooking.compareTo(BigDecimal.ZERO) == 0)
                ? (canFallbackToBookingDepositField ? bookingDepositField : BigDecimal.ZERO)
                : paidDeposit;

        BigDecimal unpaidDeposit = requiredDeposit.subtract(baseDepositPaid).max(BigDecimal.ZERO);
        BigDecimal allocDeposit = paidBooking.min(unpaidDeposit);
        BigDecimal remBooking = paidBooking.subtract(allocDeposit).max(BigDecimal.ZERO);

        BigDecimal grossDepositPaid = baseDepositPaid.add(allocDeposit);
        BigDecimal grossRentPaid = paidRent.add(remBooking);

        BigDecimal deductDeposit = refundedDeposit.min(grossDepositPaid);
        BigDecimal excessDepositRefund = refundedDeposit.subtract(deductDeposit).max(BigDecimal.ZERO);
        BigDecimal afterDepositRefund = grossDepositPaid.subtract(deductDeposit).max(BigDecimal.ZERO);
        BigDecimal afterRentRefund = grossRentPaid.subtract(refundedRent).subtract(excessDepositRefund).max(BigDecimal.ZERO);

        BigDecimal deductBookingFromDeposit = refundedBooking.min(afterDepositRefund);
        BigDecimal remBookingRefund = refundedBooking.subtract(deductBookingFromDeposit).max(BigDecimal.ZERO);

        BigDecimal effectiveDepositPaid = afterDepositRefund.subtract(deductBookingFromDeposit).max(BigDecimal.ZERO);
        BigDecimal effectiveRentPaid = afterRentRefund.subtract(remBookingRefund).max(BigDecimal.ZERO);

        boolean depositSatisfied = requiredDeposit.compareTo(BigDecimal.ZERO) <= 0 || effectiveDepositPaid.compareTo(requiredDeposit) >= 0;
        boolean rentSatisfied = requiredFirstMonthRent.compareTo(BigDecimal.ZERO) <= 0 || effectiveRentPaid.compareTo(requiredFirstMonthRent) >= 0;
        return depositSatisfied && rentSatisfied;
    }

    private void completeContractSigning(RentalContract contract, String documentUrl) {
        contract.setSignedDocumentUrl(documentUrl != null ? documentUrl : "https://docuseal.com/documents/contract-" + contract.getContractCode() + "-signed.pdf");
        contract.setSignedAt(LocalDateTime.now());
        boolean isBookingPendingCheckIn = contract.getBooking() != null && contract.getBooking().getStatus() != BookingStatus.ACTIVE;
        contract.setStatus(isBookingPendingCheckIn ? RentalContractStatus.PENDING_ACTIVATION : RentalContractStatus.ACTIVE);
        rentalContractRepository.save(contract);

        // Lưu ý (BR-RULE-005): Ký hợp đồng KHÔNG được tự chuyển booking chưa thanh toán (PENDING_PAYMENT) sang CONFIRMED
        // và KHÔNG được giải mã/cấp phát mã PIN trước khi hoàn tất đối soát đủ 4 điều kiện check-in tại cơ sở.
        // Tuyệt đối không tiết lộ mã PIN thật qua email xác nhận ký hợp đồng (PIN chỉ cấp phát qua workflow bàn giao riêng).
        try {
            String accessPin = "Chưa kích hoạt (Chỉ cấp phát sau khi hoàn tất đối soát đủ 4 điều kiện check-in và bàn giao tại cơ sở)";
            User customer = contract.getCustomer();
            if (customer != null && customer.getEmail() != null) {
                emailService.sendContractSignedConfirmationEmail(
                        customer.getEmail(),
                        customer.getFullName() != null ? customer.getFullName() : customer.getUsername(),
                        contract.getContractCode(),
                        contract.getUnit() != null ? contract.getUnit().getUnitCode() : "N/A",
                        accessPin,
                        contract.getSignedDocumentUrl()
                );
            }
        } catch (Exception e) {
            log.warn("Failed to send signed contract confirmation email: {}", e.getMessage());
        }

        activityLogService.recordSystem(
                contract.getFacility().getId(),
                ActivityAction.CONTRACT_SIGNED,
                "RentalContract",
                contract.getId(),
                "Hop dong e-Contract da duoc khach hang ky qua DocuSeal: " + contract.getContractCode()
        );
    }

    @Override
    @Transactional
    public RentalContract ensureContractForBooking(Booking booking) {
        if (booking == null) return null;
        Optional<RentalContract> existing = rentalContractRepository.findByBookingId(booking.getId());
        if (existing.isPresent()) {
            return existing.get();
        }

        StorageUnit unit = booking.getStorageUnit();
        Facility facility = unit != null ? unit.getFacility() : null;
        BigDecimal monthlyFee = (unit != null && unit.getEffectiveBasePrice() != null)
                ? unit.getEffectiveBasePrice()
                : (booking.getTotalRentalFee() != null && booking.getRentalMonths() != null && booking.getRentalMonths() > 0
                ? booking.getTotalRentalFee().divide(BigDecimal.valueOf(booking.getRentalMonths()), java.math.RoundingMode.HALF_UP)
                : BigDecimal.valueOf(1500000));

        RentalContract contract = RentalContract.builder()
                .contractCode("CTR-" + booking.getBookingCode())
                .customer(booking.getCustomer())
                .unit(unit)
                .facility(facility)
                .booking(booking)
                .startDate(booking.getStartDate())
                .endDate(booking.getEndDate())
                .monthlyFee(monthlyFee)
                .depositHeld(booking.getDepositPaid() != null ? booking.getDepositPaid() : BigDecimal.ZERO)
                .status(booking.getStatus() == BookingStatus.ACTIVE ? RentalContractStatus.ACTIVE : RentalContractStatus.PENDING_SIGNATURE)
                .build();

        contract = rentalContractRepository.save(contract);
        log.info("Auto-generated RentalContract {} for booking {}", contract.getContractCode(), booking.getBookingCode());
        return contract;
    }

    private void autoGenerateContractsForOrphanConfirmedBookings(UUID customerId) {
        try {
            List<Booking> bookings = bookingRepository.findByCustomer_Id(customerId);
            for (Booking booking : bookings) {
                if (booking.getStatus() == BookingStatus.CONFIRMED || booking.getStatus() == BookingStatus.ACTIVE) {
                    if (rentalContractRepository.findByBookingId(booking.getId()).isEmpty()) {
                        ensureContractForBooking(booking);
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Notice auto-generating contracts for customer {}: {}", customerId, e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    private String extractFirstDocumentUrl(Map<String, Object> data) {
        Object documents = data.get("documents");
        if (documents instanceof List<?> list && !list.isEmpty() && list.get(0) instanceof Map<?, ?> doc) {
            Object url = ((Map<String, Object>) doc).get("url");
            if (url != null) {
                return url.toString();
            }
        }
        Object directUrl = data.get("document_url");
        return directUrl != null ? directUrl.toString() : null;
    }
}
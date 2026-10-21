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
    private final RentalContractMapper rentalContractMapper;
    private final ActivityLogService activityLogService;
    private final EmailService emailService;
    private final EncryptionService encryptionService;
    private final FacilityAccessGuard facilityAccessGuard;
    private final RequestContext requestContext;

    @Lazy
    private final ContractRenewalService contractRenewalService;
    private final org.springframework.beans.factory.ObjectProvider<com.boxora.service.ContractBillingService> contractBillingServiceProvider;
    private final com.boxora.repository.ContractRenewalRepository contractRenewalRepository;

    @org.springframework.beans.factory.annotation.Value("${app.frontend-url:}")
    private String frontendUrl;

    private static final String DEFAULT_FRONTEND_URL = "http://localhost:5173";
    /** Contracts signed in-app while DocuSeal is not configured (test environment). */
    public static final String SIGNING_METHOD_IN_APP_TEST = "ELECTRONIC_TEST";
    /** Signed through DocuSeal. */
    public static final String SIGNING_METHOD_ELECTRONIC = "ELECTRONIC";
    /** Counter booking: the contract is signed on paper at the facility and uploaded by staff. */
    public static final String SIGNING_METHOD_IN_PERSON = "IN_PERSON";

    private String frontendBase() {
        String base = frontendUrl != null ? frontendUrl.trim() : "";
        if (base.isEmpty()) {
            base = DEFAULT_FRONTEND_URL;
        }
        return base.endsWith("/") ? base.substring(0, base.length() - 1) : base;
    }

    /** Response with the fields the portal needs: renewal window, open renewal, real deposit, signing mode. */
    private RentalContractResponse toPortalResponse(RentalContract contract) {
        RentalContractResponse response = rentalContractMapper.toResponse(contract);
        if (contract.getBooking() != null && contract.getBooking().getDepositPaid() != null) {
            BigDecimal held = response.getDepositHeld() != null ? response.getDepositHeld() : BigDecimal.ZERO;
            if (contract.getBooking().getDepositPaid().compareTo(held) > 0) {
                response.setDepositHeld(contract.getBooking().getDepositPaid());
            }
        }
        response.setSigningSimulated(docuSealConfig.isMockActive());
        com.boxora.service.ContractBillingService billing = contractBillingServiceProvider.getIfAvailable();
        if (billing != null) {
            com.boxora.service.ContractBillingService.RenewalWindow window = billing.renewalWindow(contract, java.time.LocalDate.now());
            response.setRenewable(window.renewable());
            response.setRenewalOpensOn(window.opensOn());
            response.setRenewalClosesOn(window.closesOn());
            response.setRenewalBlockedReason(window.blockedReason());
            response.setRenewalWindowDays(window.windowDays());
        }
        if (contract.getId() != null) {
            contractRenewalRepository.findFirstByContract_IdAndStatusInOrderByCreatedAtDesc(contract.getId(),
                            List.of(com.boxora.enums.ContractRenewalStatus.PENDING_SIGNATURE, com.boxora.enums.ContractRenewalStatus.PENDING_PAYMENT))
                    .ifPresent(renewal -> response.setPendingRenewalId(renewal.getId()));
        }
        // The DocuSeal signing link acts as the customer's signature: it is never handed to staff. The customer
        // obtains it themselves after verifying the OTP (POST /contracts/{id}/otp/verify).
        response.setSigningUrl(null);
        return response;
    }

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

        return toPortalResponse(contract);
    }

    @Override
    @Transactional
    public RentalContractResponse getContractByBookingId(UUID bookingId) {
        if (bookingId == null) {
            throw new AppException(ErrorCode.BOOKING_NOT_FOUND);
        }

        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));
        if ("CUSTOMER".equalsIgnoreCase(requestContext.currentUserRole())) {
            UUID currentUserId = requestContext.currentUserId();
            if (currentUserId == null || booking.getCustomer() == null || !currentUserId.equals(booking.getCustomer().getId())) {
                throw new AppException(ErrorCode.FORBIDDEN);
            }
        } else if (facilityAccessGuard.isFacilityScoped() && booking.getStorageUnit() != null
                && booking.getStorageUnit().getFacility() != null) {
            facilityAccessGuard.checkFacilityAccess(booking.getStorageUnit().getFacility().getId());
        }

        RentalContract contract = rentalContractRepository.findByBookingId(bookingId).orElse(null);
        if (contract == null) {
            // A contract exists only for reservations that are confirmed (paid online or held for the counter).
            if (booking.getStatus() != BookingStatus.CONFIRMED && booking.getStatus() != BookingStatus.ACTIVE) {
                throw new AppException(ErrorCode.CONTRACT_NOT_FOUND, "Đơn đặt kho này chưa có hợp đồng.");
            }
            contract = ensureContractForBooking(booking);
        }
        if (contract == null) {
            throw new AppException(ErrorCode.CONTRACT_NOT_FOUND);
        }
        return toPortalResponse(contract);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<RentalContractResponse> getAllContracts(
            UUID customerId, UUID facilityId, RentalContractStatus status,
            int page, int size, String sortBy, String sortDir) {

        String sortField = sortBy != null && java.util.Set.of("createdAt", "startDate", "endDate", "status", "contractCode").contains(sortBy)
                ? sortBy : "createdAt";
        Sort sort = Sort.by("asc".equalsIgnoreCase(sortDir) ? Sort.Direction.ASC : Sort.Direction.DESC, sortField);
        Pageable pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 200), sort);

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
        return PageResponse.from(result.map(this::toPortalResponse));
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

        // Nếu đã có slug tạo trước đó và chưa ký, có thể tái sử dụng signing URL
        if (contract.getDocusealSubmitterSlug() != null) {
            return signingUrl(contract, contract.getDocusealSubmitterSlug());
        }

        String customerName = contract.getCustomer().getFullName() != null ? contract.getCustomer().getFullName() : contract.getCustomer().getUsername();
        String customerEmail = contract.getCustomer().getEmail();

        DocuSealSubmissionRequest request = DocuSealSubmissionRequest.builder()
                .template_id(docuSealConfig.getTemplateId())
                .send_email(false)
                .completed_redirect_url(frontendBase() + "/portal/customer?tab=contracts&signed=true")
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

        if (contract.getDocusealSubmitterSlug() != null) {
            return signingUrl(contract, contract.getDocusealSubmitterSlug());
        }
        return createSigningRequest(contract);
    }

    private String signingUrl(RentalContract contract, String slug) {
        if (slug != null && slug.startsWith("mock-")) {
            return frontendBase() + "/portal/customer?tab=contracts&mockSignContractId=" + contract.getId();
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
        if (!docuSealConfig.isMockActive()) {
            throw new AppException(ErrorCode.CONTRACT_MOCK_SIGN_DISABLED);
        }
        RentalContract contract = rentalContractRepository.findById(contractId)
                .orElseThrow(() -> new AppException(ErrorCode.CONTRACT_NOT_FOUND));

        // Only the customer named on the contract signs it, in their own session (the controller also requires
        // the OTP sent to their email). Staff never sign electronically on a customer's behalf.
        UUID currentUserId = requestContext.currentUserId();
        if (!"CUSTOMER".equalsIgnoreCase(requestContext.currentUserRole()) || currentUserId == null
                || contract.getCustomer() == null || !currentUserId.equals(contract.getCustomer().getId())) {
            throw new AppException(ErrorCode.CONTRACT_SIGNER_NOT_CUSTOMER);
        }

        if (signatureData != null && !signatureData.isBlank()) {
            contract.setSignatureData(signatureData);
        }

        if (contract.getSignedAt() != null
                || contract.getStatus() == RentalContractStatus.ACTIVE
                || contract.getStatus() == RentalContractStatus.PENDING_ACTIVATION) {
            if (signatureData != null && !signatureData.isBlank()) {
                rentalContractRepository.save(contract);
            }
            return rentalContractMapper.toResponse(contract);
        }

        if (contract.getStatus() != RentalContractStatus.PENDING_SIGNATURE) {
            throw new AppException(ErrorCode.CONTRACT_NOT_ACTIVE, "Hợp đồng không ở trạng thái chờ ký.");
        }
        if (signatureData == null || signatureData.isBlank()) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Vui lòng ký tên trước khi xác nhận hợp đồng.");
        }
        // Test environment: there is no signed PDF; the portal renders the contract with the stored signature.
        contract.setSigningMethod(SIGNING_METHOD_IN_APP_TEST);
        completeContractSigning(contract, null);
        return toPortalResponse(contract);
    }

    private void completeContractSigning(RentalContract contract, String documentUrl) {
        contract.setSignedDocumentUrl(documentUrl);
        contract.setSignedAt(LocalDateTime.now());
        // Signed electronically (DocuSeal or the in-app test signature): no longer a counter / paper contract,
        // even when the customer had first chosen to sign at the counter.
        if (!SIGNING_METHOD_IN_APP_TEST.equals(contract.getSigningMethod())) {
            contract.setSigningMethod(SIGNING_METHOD_ELECTRONIC);
        }
        boolean isBookingPendingCheckIn = contract.getBooking() != null && contract.getBooking().getStatus() != BookingStatus.ACTIVE;
        contract.setStatus(isBookingPendingCheckIn ? RentalContractStatus.PENDING_ACTIVATION : RentalContractStatus.ACTIVE);
        rentalContractRepository.save(contract);

        // 1. Maintain booking in CONFIRMED state awaiting physical staff handover; the booking now reads
        //    "signed online" so the portal and the check-in workbench stop asking for a paper contract.
        if (contract.getBooking() != null) {
            Booking booking = contract.getBooking();
            boolean changed = false;
            if (booking.getStatus() == BookingStatus.PENDING_PAYMENT) {
                booking.setStatus(BookingStatus.CONFIRMED);
                changed = true;
            }
            if (!"ONLINE".equalsIgnoreCase(booking.getSigningMethod())) {
                booking.setSigningMethod("ONLINE");
                changed = true;
            }
            if (changed) {
                bookingRepository.save(booking);
            }
        }

        // 3. Decrypt PIN and dispatch confirmation email
        try {
            String accessPin = "Được cấp khi nhận bàn giao kho";
            if (contract.getBooking() != null && contract.getBooking().getAccessPin() != null) {
                accessPin = encryptionService.decrypt(contract.getBooking().getAccessPin());
            }
            User customer = contract.getCustomer();
            if (customer != null && customer.getEmail() != null) {
                emailService.sendContractSignedConfirmationEmail(
                        customer.getEmail(),
                        customer.getFullName() != null ? customer.getFullName() : customer.getUsername(),
                        contract.getContractCode(),
                        contract.getUnit() != null ? contract.getUnit().getUnitCode() : "N/A",
                        accessPin,
                        contract.getSignedDocumentUrl() != null ? contract.getSignedDocumentUrl()
                                : frontendBase() + "/portal/customer?tab=contracts"
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
                (SIGNING_METHOD_IN_APP_TEST.equals(contract.getSigningMethod())
                        ? "Khách hàng đã ký hợp đồng điện tử trong cổng Boxora (môi trường thử nghiệm, chưa kết nối DocuSeal): "
                        : "Khách hàng đã ký hợp đồng điện tử qua DocuSeal: ") + contract.getContractCode()
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
        // Monthly fee = the discounted monthly rent of the PricingService quote stored on the booking.
        BigDecimal monthlyFee = booking.getTotalRentalFee() != null && booking.getRentalMonths() != null && booking.getRentalMonths() > 0
                ? booking.getTotalRentalFee().divide(BigDecimal.valueOf(booking.getRentalMonths()), 2, java.math.RoundingMode.HALF_UP)
                : (unit != null && unit.getEffectiveBasePrice() != null ? unit.getEffectiveBasePrice() : BigDecimal.ZERO);

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
                // A counter booking is signed on paper at the facility; online bookings are signed electronically.
                .signingMethod("IN_PERSON".equalsIgnoreCase(booking.getSigningMethod()) ? SIGNING_METHOD_IN_PERSON : SIGNING_METHOD_ELECTRONIC)
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
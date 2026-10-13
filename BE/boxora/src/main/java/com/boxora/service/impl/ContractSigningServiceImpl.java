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
        if (contract.getSignedAt() != null || contract.getStatus() == RentalContractStatus.ACTIVE) {
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

        if (contract.getDocusealSubmitterSlug() != null) {
            return signingUrl(contract, contract.getDocusealSubmitterSlug());
        }
        return createSigningRequest(contract);
    }

    private String signingUrl(RentalContract contract, String slug) {
        if (slug != null && slug.startsWith("mock-")) {
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
        if (contract.getSignedAt() != null && contract.getStatus() == RentalContractStatus.ACTIVE) {
            log.info("Contract {} already marked as signed - ignoring duplicate webhook", contract.getId());
            return;
        }

        completeContractSigning(contract, documentUrl);
    }

    @Override
    @Transactional
    public RentalContractResponse mockSign(UUID contractId) {
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

        if (contract.getSignedAt() != null && contract.getStatus() == RentalContractStatus.ACTIVE) {
            return rentalContractMapper.toResponse(contract);
        }

        String sampleDocUrl = "https://docuseal.com/documents/contract-" + contract.getContractCode() + "-signed.pdf";
        completeContractSigning(contract, sampleDocUrl);
        return rentalContractMapper.toResponse(contract);
    }

    private void completeContractSigning(RentalContract contract, String documentUrl) {
        contract.setSignedDocumentUrl(documentUrl != null ? documentUrl : "https://docuseal.com/documents/contract-" + contract.getContractCode() + "-signed.pdf");
        contract.setSignedAt(LocalDateTime.now());
        contract.setStatus(RentalContractStatus.ACTIVE);
        rentalContractRepository.save(contract);

        // 1. Transition associated booking to ACTIVE
        if (contract.getBooking() != null) {
            Booking booking = contract.getBooking();
            booking.setStatus(BookingStatus.ACTIVE);
            bookingRepository.save(booking);
        }

        // 2. Transition storage unit to OCCUPIED
        if (contract.getUnit() != null) {
            StorageUnit unit = contract.getUnit();
            unit.setStatus(UnitStatus.OCCUPIED);
            storageUnitRepository.save(unit);
        }

        // 3. Decrypt PIN and dispatch confirmation email
        try {
            String accessPin = "N/A";
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
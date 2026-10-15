package com.boxora.service.impl;

import com.boxora.client.DocuSealClient;
import com.boxora.common.response.PageResponse;
import com.boxora.config.DocuSealConfig;
import com.boxora.dto.request.DocuSealSubmissionRequest;
import com.boxora.dto.response.ContractRenewalResponse;
import com.boxora.dto.response.DocuSealSubmitterResponse;
import com.boxora.dto.response.VNPayPaymentResponse;
import com.boxora.entity.ContractRenewal;
import com.boxora.entity.FacilityPolicy;
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
import com.boxora.repository.ContractRenewalRepository;
import com.boxora.repository.FacilityPolicyRepository;
import com.boxora.repository.PaymentRepository;
import com.boxora.repository.RentalContractRepository;
import com.boxora.service.ActivityLogService;
import com.boxora.service.ContractRenewalService;
import com.boxora.service.PaymentService;
import com.boxora.security.FacilityAccessGuard;
import com.boxora.security.RequestContext;
import com.boxora.service.PaymentService;
import jakarta.persistence.criteria.Predicate;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ContractRenewalServiceImpl implements ContractRenewalService {

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final DocuSealClient docuSealClient;
    private final DocuSealConfig docuSealConfig;
    private final RentalContractRepository rentalContractRepository;
    private final ContractRenewalRepository contractRenewalRepository;
    private final FacilityPolicyRepository facilityPolicyRepository;
    private final PaymentRepository paymentRepository;
    private final ContractRenewalMapper contractRenewalMapper;
    private final ActivityLogService activityLogService;
    private final FacilityAccessGuard facilityAccessGuard;
    private final RequestContext requestContext;
    private final ObjectProvider<PaymentService> paymentServiceProvider;

    @Override
    @Transactional
    public ContractRenewalResponse requestRenewal(UUID contractId, Integer cycleMonths) {
        if (cycleMonths == null || cycleMonths < 1) {
            cycleMonths = 1;
        }

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

        if (contract.getStatus() == RentalContractStatus.TERMINATED || contract.getStatus() == RentalContractStatus.CANCELLED) {
            throw new AppException(ErrorCode.CONTRACT_NOT_ACTIVE);
        }

        // Kiểm tra chính sách gia hạn của cơ sở (FacilityPolicy)
        FacilityPolicy policy = facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(contract.getFacility().getId())
                .orElse(null);

        int renewalWindowDays = policy != null && policy.getRenewalWindowDays() != null
                ? policy.getRenewalWindowDays() : 3;
        int overdueGraceDays = policy != null && policy.getOverdueGraceDays() != null
                ? policy.getOverdueGraceDays() : 1;

        LocalDate today = LocalDate.now();
        LocalDate earliestRenewalDate = contract.getEndDate().minusDays(renewalWindowDays);
        LocalDate latestRenewalDate = contract.getEndDate().plusDays(overdueGraceDays);

        if (today.isBefore(earliestRenewalDate)) {
            log.warn("Contract {} cannot be renewed yet. Allowed from {}, today is {}", contractId, earliestRenewalDate, today);
            throw new AppException(ErrorCode.CONTRACT_RENEWAL_WINDOW_CLOSED);
        }

        if (today.isAfter(latestRenewalDate)) {
            log.warn("Contract {} past renewal window. Latest allowed was {}, today is {}", contractId, latestRenewalDate, today);
            throw new AppException(ErrorCode.CONTRACT_NOT_ACTIVE);
        }

        LocalDate oldEndDate = contract.getEndDate();
        LocalDate newEndDate = oldEndDate.plusMonths(cycleMonths);
        BigDecimal renewalFee = contract.getMonthlyFee().multiply(BigDecimal.valueOf(cycleMonths));

        ContractRenewal renewal = ContractRenewal.builder()
                .contract(contract)
                .oldEndDate(oldEndDate)
                .newEndDate(newEndDate)
                .cycleMonths(cycleMonths)
                .renewalFee(renewalFee)
                .status(ContractRenewalStatus.PENDING_SIGNATURE)
                .build();

        renewal = contractRenewalRepository.save(renewal);

        // Tạo yêu cầu ký phụ lục gia hạn DocuSeal
        String customerName = contract.getCustomer().getFullName() != null
                ? contract.getCustomer().getFullName() : contract.getCustomer().getUsername();
        String customerEmail = contract.getCustomer().getEmail();

        DocuSealSubmissionRequest submissionRequest = DocuSealSubmissionRequest.builder()
                .template_id(docuSealConfig.getEffectiveRenewalTemplateId())
                .send_email(true)
                .submitters(List.of(
                        DocuSealSubmissionRequest.Submitter.builder()
                                .role("Customer")
                                .email(customerEmail)
                                .name(customerName)
                                .external_id("RENEWAL_" + renewal.getId().toString())
                                .fields(List.of(
                                        field("customer_name", customerName),
                                        field("customer_email", customerEmail),
                                        field("contract_code", contract.getContractCode() != null ? contract.getContractCode() : contract.getId().toString()),
                                        field("unit_code", contract.getUnit().getUnitCode()),
                                        field("facility_name", contract.getFacility().getName()),
                                        field("old_end_date", oldEndDate.format(DATE_FMT)),
                                        field("new_end_date", newEndDate.format(DATE_FMT)),
                                        field("cycle_months", String.valueOf(cycleMonths)),
                                        field("renewal_fee", renewalFee.toPlainString())
                                ))
                                .build()
                ))
                .build();

        try {
            List<DocuSealSubmitterResponse> submitters = docuSealClient.createSubmission(submissionRequest);
            if (submitters != null && !submitters.isEmpty()) {
                DocuSealSubmitterResponse submitter = submitters.get(0);
                renewal.setDocusealSubmissionId(submitter.getSubmission_id());
                renewal.setDocusealSubmitterSlug(submitter.getSlug());
                contractRenewalRepository.save(renewal);
            }
        } catch (Exception e) {
            log.error("Failed to create DocuSeal submission for renewal {}: {}", renewal.getId(), e.getMessage());
            // Vẫn lưu yêu cầu gia hạn và trả về response để có thể resend sau
        }

        activityLogService.record(
                contract.getFacility().getId(),
                ActivityAction.RENEWAL_REQUEST,
                "ContractRenewal",
                renewal.getId(),
                "Yeu cau gia han hop dong " + contract.getContractCode() + " them " + cycleMonths + " thang, so tien: " + renewalFee,
                null,
                renewal.getId()
        );

        ContractRenewalResponse response = contractRenewalMapper.toResponse(renewal);
        if (renewal.getDocusealSubmitterSlug() != null) {
            response.setSigningUrl(signingUrl(renewal.getDocusealSubmitterSlug()));
        }
        return response;
    }

    @Override
    @Transactional
    public VNPayPaymentResponse createRenewalPayment(UUID renewalId, HttpServletRequest httpRequest) {
        ContractRenewal renewal = contractRenewalRepository.findById(renewalId)
                .orElseThrow(() -> new AppException(ErrorCode.CONTRACT_RENEWAL_NOT_FOUND));

        if (renewal.getStatus() == ContractRenewalStatus.COMPLETED) {
            throw new AppException(ErrorCode.CONTRACT_RENEWAL_ALREADY_COMPLETED);
        }

        RentalContract contract = renewal.getContract();
        if (facilityAccessGuard.isFacilityScoped()) {
            facilityAccessGuard.checkFacilityAccess(contract.getFacility().getId());
        }
        if ("CUSTOMER".equalsIgnoreCase(requestContext.currentUserRole())) {
            UUID currentUserId = requestContext.currentUserId();
            if (currentUserId != null && !currentUserId.equals(contract.getCustomer().getId())) {
                throw new AppException(ErrorCode.FORBIDDEN);
            }
        }

        String orderInfo = "Gia han hop dong " + (contract.getContractCode() != null ? contract.getContractCode() : contract.getId())
                + " (" + renewal.getCycleMonths() + " thang)";

        VNPayPaymentResponse paymentResponse = paymentServiceProvider.getObject().createContractPayment(
                contract,
                PaymentType.RENEWAL_FEE,
                renewal.getRenewalFee(),
                renewal.getCycleMonths(),
                orderInfo,
                httpRequest
        );

        if (paymentResponse.getPaymentId() != null) {
            Payment payment = paymentRepository.findById(paymentResponse.getPaymentId()).orElse(null);
            if (payment != null) {
                renewal.setPayment(payment);
                contractRenewalRepository.save(renewal);
            }
        }

        return paymentResponse;
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

        // Kiểm tra xem đã thanh toán phí gia hạn chưa
        boolean isPaid = renewal.getPayment() != null && renewal.getPayment().getStatus() == PaymentStatus.PAID;
        if (isPaid) {
            // Cả ký phụ lục và thanh toán đều hoàn tất -> Hoàn tất gia hạn và kéo dài thời hạn hợp đồng
            renewal.setStatus(ContractRenewalStatus.COMPLETED);
            RentalContract contract = renewal.getContract();
            contract.setEndDate(renewal.getNewEndDate());
            contract.setStatus(RentalContractStatus.ACTIVE);
            rentalContractRepository.save(contract);

            activityLogService.recordSystem(
                    contract.getFacility().getId(),
                    ActivityAction.CONTRACT_EXTENDED,
                    "RentalContract",
                    contract.getId(),
                    "Hop dong " + contract.getContractCode() + " da duoc gia han thanh cong den " + renewal.getNewEndDate()
            );
        } else {
            // Chờ thanh toán
            renewal.setStatus(ContractRenewalStatus.PENDING_PAYMENT);
            activityLogService.recordSystem(
                    renewal.getContract().getFacility().getId(),
                    ActivityAction.CONTRACT_SIGNED,
                    "ContractRenewal",
                    renewal.getId(),
                    "Phu luc gia han hop dong da duoc ky qua DocuSeal, cho thanh toan phi"
            );
        }

        contractRenewalRepository.save(renewal);
    }

    @Override
    @Transactional
    public void handleRenewalPaid(Payment payment) {
        // Tìm bản ghi gia hạn liên quan tới payment này
        ContractRenewal renewal = contractRenewalRepository.findByPaymentId(payment.getId())
                .orElse(null);

        if (renewal == null && payment.getContract() != null) {
            renewal = contractRenewalRepository.findFirstByContractIdOrderByCreatedAtDesc(payment.getContract().getId())
                    .orElse(null);
        }

        if (renewal == null) {
            log.warn("No renewal found matching payment ID={}", payment.getId());
            return;
        }

        renewal.setPayment(payment);

        // Kiểm tra xem khách đã ký phụ lục gia hạn trên DocuSeal chưa
        boolean isSigned = renewal.getSignedAt() != null;
        if (isSigned) {
            // Cả ký phụ lục và thanh toán đều hoàn tất -> Hoàn tất gia hạn và kéo dài thời hạn hợp đồng
            renewal.setStatus(ContractRenewalStatus.COMPLETED);
            RentalContract contract = renewal.getContract();
            contract.setEndDate(renewal.getNewEndDate());
            contract.setStatus(RentalContractStatus.ACTIVE);
            rentalContractRepository.save(contract);

            activityLogService.recordSystem(
                    contract.getFacility().getId(),
                    ActivityAction.CONTRACT_EXTENDED,
                    "RentalContract",
                    contract.getId(),
                    "Hop dong " + contract.getContractCode() + " da duoc gia han thanh cong den " + renewal.getNewEndDate()
            );
        } else {
            // Đã nộp tiền nhưng chưa ký DocuSeal -> Chờ ký
            renewal.setStatus(ContractRenewalStatus.PENDING_SIGNATURE);
            activityLogService.recordSystem(
                    renewal.getContract().getFacility().getId(),
                    ActivityAction.RENEWAL_PAID,
                    "ContractRenewal",
                    renewal.getId(),
                    "Phi gia han hop dong da thanh toan thanh cong, cho ky phu luc DocuSeal"
            );
        }

        contractRenewalRepository.save(renewal);
    }

    @Override
    @Transactional(readOnly = true)
    public ContractRenewalResponse getById(UUID renewalId) {
        ContractRenewal renewal = contractRenewalRepository.findById(renewalId)
                .orElseThrow(() -> new AppException(ErrorCode.CONTRACT_RENEWAL_NOT_FOUND));

        RentalContract contract = renewal.getContract();
        if (facilityAccessGuard.isFacilityScoped()) {
            facilityAccessGuard.checkFacilityAccess(contract.getFacility().getId());
        }
        if ("CUSTOMER".equalsIgnoreCase(requestContext.currentUserRole())) {
            UUID currentUserId = requestContext.currentUserId();
            if (currentUserId != null && !currentUserId.equals(contract.getCustomer().getId())) {
                throw new AppException(ErrorCode.FORBIDDEN);
            }
        }

        ContractRenewalResponse res = contractRenewalMapper.toResponse(renewal);
        if (renewal.getDocusealSubmitterSlug() != null) {
            res.setSigningUrl(signingUrl(renewal.getDocusealSubmitterSlug()));
        }
        return res;
    }

    @Override
    @Transactional(readOnly = true)
    public List<ContractRenewalResponse> getRenewalsByContractId(UUID contractId) {
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

        List<ContractRenewal> list = contractRenewalRepository.findByContractId(contractId);
        return list.stream().map(r -> {
            ContractRenewalResponse res = contractRenewalMapper.toResponse(r);
            if (r.getDocusealSubmitterSlug() != null) {
                res.setSigningUrl(signingUrl(r.getDocusealSubmitterSlug()));
            }
            return res;
        }).toList();
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
        Sort sort = Sort.by(Sort.Direction.fromString(sortDir != null ? sortDir : "desc"),
                sortBy != null ? sortBy : "createdAt");
        Pageable pageable = PageRequest.of(page, size, sort);

        UUID effectiveFacilityId = facilityId;
        if (facilityAccessGuard.isFacilityScoped()) {
            effectiveFacilityId = facilityAccessGuard.scopedFacilityIdOrNull();
        }

        UUID effectiveCustomerId = null;
        if ("CUSTOMER".equalsIgnoreCase(requestContext.currentUserRole())) {
            effectiveCustomerId = requestContext.currentUserId();
        }

        final UUID queryFacilityId = effectiveFacilityId;
        final UUID queryContractId = contractId;
        final UUID queryCustomerId = effectiveCustomerId;

        Specification<ContractRenewal> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (queryContractId != null) {
                predicates.add(cb.equal(root.get("contract").get("id"), queryContractId));
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
        return PageResponse.from(result.map(r -> {
            ContractRenewalResponse res = contractRenewalMapper.toResponse(r);
            if (r.getDocusealSubmitterSlug() != null) {
                res.setSigningUrl(signingUrl(r.getDocusealSubmitterSlug()));
            }
            return res;
        }));
    }

    @Override
    @Transactional
    public String getRenewalSigningUrl(UUID renewalId) {
        ContractRenewal renewal = contractRenewalRepository.findById(renewalId)
                .orElseThrow(() -> new AppException(ErrorCode.CONTRACT_RENEWAL_NOT_FOUND));

        RentalContract contract = renewal.getContract();
        if (facilityAccessGuard.isFacilityScoped()) {
            facilityAccessGuard.checkFacilityAccess(contract.getFacility().getId());
        }
        if ("CUSTOMER".equalsIgnoreCase(requestContext.currentUserRole())) {
            UUID currentUserId = requestContext.currentUserId();
            if (currentUserId != null && !currentUserId.equals(contract.getCustomer().getId())) {
                throw new AppException(ErrorCode.FORBIDDEN);
            }
        }

        if (renewal.getDocusealSubmitterSlug() != null) {
            return signingUrl(renewal.getDocusealSubmitterSlug());
        }

        if (renewal.getSignedDocumentUrl() != null) {
            return renewal.getSignedDocumentUrl();
        }

        throw new AppException(ErrorCode.CONTRACT_SIGNING_FAILED);
    }

    private String signingUrl(String slug) {
        return docuSealConfig.getWebBaseUrl() + "/s/" + slug;
    }

    private DocuSealSubmissionRequest.Field field(String name, String value) {
        return DocuSealSubmissionRequest.Field.builder()
                .name(name)
                .default_value(value != null ? value : "")
                .build();
    }
}

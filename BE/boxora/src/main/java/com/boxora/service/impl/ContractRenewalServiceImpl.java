package com.boxora.service.impl;

import com.boxora.client.DocuSealClient;
import com.boxora.common.response.PageResponse;
import com.boxora.config.DocuSealConfig;
import com.boxora.dto.request.ContractRenewalCounterPaymentRequest;
import com.boxora.dto.request.DocuSealSubmissionRequest;
import com.boxora.dto.response.ContractRenewalResponse;
import com.boxora.dto.response.DocuSealSubmitterResponse;
import com.boxora.dto.response.VNPayPaymentResponse;
import com.boxora.entity.*;
import com.boxora.enums.*;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.mapper.ContractRenewalMapper;
import com.boxora.repository.*;
import com.boxora.security.FacilityAccessGuard;
import com.boxora.security.RequestContext;
import com.boxora.service.ActivityLogService;
import com.boxora.service.ContractRenewalService;
import com.boxora.service.PaymentService;
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
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ContractRenewalServiceImpl implements ContractRenewalService {

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    @Value("${app.frontend-url:http://localhost:5173}")
    private String frontendUrl;

    private final DocuSealClient docuSealClient;
    private final DocuSealConfig docuSealConfig;
    private final RentalContractRepository rentalContractRepository;
    private final ContractRenewalRepository contractRenewalRepository;
    private final FacilityPolicyRepository facilityPolicyRepository;
    private final PaymentRepository paymentRepository;
    private final UserRepository userRepository;
    private final NotificationLogRepository notificationLogRepository;
    private final StaffAssignmentRepository staffAssignmentRepository;
    private final ContractRenewalMapper contractRenewalMapper;
    private final ActivityLogService activityLogService;
    private final FacilityAccessGuard facilityAccessGuard;
    private final RequestContext requestContext;
    private final ObjectProvider<PaymentService> paymentServiceProvider;

    @Override
    @Transactional
    public ContractRenewalResponse requestRenewal(UUID contractId, Integer cycleMonths) {
        return requestRenewal(contractId, cycleMonths, null);
    }

    @Override
    @Transactional
    public ContractRenewalResponse requestRenewal(UUID contractId, Integer cycleMonths, String notes) {
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

        // 1. Kiểm tra trạng thái hợp đồng: kho chưa bị hoàn tất trả hoặc kết thúc
        if (contract.getStatus() == RentalContractStatus.TERMINATED 
                || contract.getStatus() == RentalContractStatus.CANCELLED
                || contract.getStatus() == RentalContractStatus.EXPIRED) {
            throw new AppException(ErrorCode.CONTRACT_NOT_ACTIVE, "Hợp đồng đã kết thúc hoặc kho đã hoàn trả, không thể thực hiện gia hạn");
        }

        // 2. Kiểm tra niêm phong: kho chưa bị niêm phong (OVERDUE_LOCKED)
        if (contract.getStatus() == RentalContractStatus.OVERDUE_LOCKED
                || (contract.getUnit() != null && contract.getUnit().getStatus() == UnitStatus.OVERDUE_LOCKED)) {
            log.warn("Contract {} or unit is sealed (OVERDUE_LOCKED)", contractId);
            throw new AppException(ErrorCode.UNIT_OVERDUE_LOCKED, "Kho đang bị niêm phong. Vui lòng thanh toán công nợ và hoàn tất mở niêm phong trước khi gia hạn");
        }

        boolean hasPending = contractRenewalRepository.existsByContract_IdAndStatusIn(
                contractId,
                List.of(ContractRenewalStatus.PENDING_REVIEW, ContractRenewalStatus.PENDING_SIGNATURE, ContractRenewalStatus.PENDING_PAYMENT)
        );
        if (hasPending) {
            log.warn("Contract {} already has an active pending renewal request", contractId);
            throw new AppException(ErrorCode.CONTRACT_RENEWAL_ALREADY_PENDING);
        }

        LocalDate oldEndDate = contract.getEndDate();
        LocalDate newEndDate = oldEndDate.plusMonths(cycleMonths);
        BigDecimal renewalFee = contract.getMonthlyFee().multiply(BigDecimal.valueOf(cycleMonths));

        ContractRenewalStatus initialStatus = ContractRenewalStatus.PENDING_REVIEW;

        ContractRenewal renewal = ContractRenewal.builder()
                .contract(contract)
                .oldEndDate(oldEndDate)
                .newEndDate(newEndDate)
                .cycleMonths(cycleMonths)
                .renewalFee(renewalFee)
                .status(initialStatus)
                .notes(notes)
                .build();

        renewal = contractRenewalRepository.save(renewal);

        activityLogService.record(
                contract.getFacility().getId(),
                ActivityAction.RENEWAL_REQUEST,
                "ContractRenewal",
                renewal.getId(),
                "Yeu cau gia han hop dong " + contract.getContractCode() + " them " + cycleMonths + " thang, so tien: " + renewalFee,
                null,
                renewal.getId()
        );

        sendCustomerRenewalNotification(
                contract,
                "Yêu cầu gia hạn hợp đồng " + contract.getContractCode(),
                "Hệ thống Boxora đã tiếp nhận yêu cầu gia hạn thêm " + cycleMonths + " tháng (đến ngày " + newEndDate.format(DATE_FMT) + "). Yêu cầu đang được gửi tới Quản lý cơ sở để xem xét phê duyệt."
        );

        return contractRenewalMapper.toResponse(renewal);
    }

    private void createDocusealSubmissionForRenewal(ContractRenewal renewal) {
        RentalContract contract = renewal.getContract();
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
                                        field("old_end_date", renewal.getOldEndDate().format(DATE_FMT)),
                                        field("new_end_date", renewal.getNewEndDate().format(DATE_FMT)),
                                        field("cycle_months", String.valueOf(renewal.getCycleMonths())),
                                        field("renewal_fee", renewal.getRenewalFee().toPlainString())
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
        }
    }

    @Override
    @Transactional
    public ContractRenewalResponse approveRenewal(UUID renewalId, String notes) {
        ContractRenewal renewal = contractRenewalRepository.findById(renewalId)
                .orElseThrow(() -> new AppException(ErrorCode.CONTRACT_RENEWAL_NOT_FOUND));

        RentalContract contract = renewal.getContract();
        if (facilityAccessGuard.isFacilityScoped()) {
            facilityAccessGuard.checkFacilityAccess(contract.getFacility().getId());
        }

        if (renewal.getStatus() != ContractRenewalStatus.PENDING_REVIEW) {
            throw new AppException(ErrorCode.CONTRACT_RENEWAL_CANNOT_BE_APPROVED);
        }

        User reviewer = null;
        UUID currentUserId = requestContext.currentUserId();
        if (currentUserId != null) {
            reviewer = userRepository.findById(currentUserId).orElse(null);
        }

        renewal.setReviewedBy(reviewer);
        renewal.setReviewedAt(LocalDateTime.now());
        if (notes != null && !notes.isBlank()) {
            renewal.setNotes(renewal.getNotes() != null ? renewal.getNotes() + " | Duyệt: " + notes : notes);
        }
        renewal.setStatus(ContractRenewalStatus.PENDING_SIGNATURE);
        if (renewal.getPaymentMethod() == null) {
            renewal.setPaymentMethod("ONLINE");
        }
        renewal = contractRenewalRepository.save(renewal);

        if ("ONLINE".equalsIgnoreCase(renewal.getPaymentMethod()) && renewal.getDocusealSubmitterSlug() == null) {
            createDocusealSubmissionForRenewal(renewal);
        }

        activityLogService.record(
                contract.getFacility().getId(),
                ActivityAction.RENEWAL_APPROVED,
                "ContractRenewal",
                renewal.getId(),
                "Phe duyet yeu cau gia han hop dong " + contract.getContractCode() + (notes != null ? ": " + notes : ""),
                ContractRenewalStatus.PENDING_REVIEW,
                ContractRenewalStatus.PENDING_SIGNATURE
        );

        sendCustomerRenewalNotification(
                contract,
                "Yêu cầu gia hạn hợp đồng " + contract.getContractCode() + " đã được phê duyệt",
                "Quản lý cơ sở đã chấp thuận yêu cầu gia hạn kho #" + contract.getUnit().getUnitCode() + ". Quý khách có thể lựa chọn hình thức ký và thanh toán trực tuyến hoặc trực tiếp tại cơ sở.",
                NotificationType.RENEWAL_APPROVED
        );

        ContractRenewalResponse response = contractRenewalMapper.toResponse(renewal);
        if (renewal.getDocusealSubmitterSlug() != null) {
            response.setSigningUrl(signingUrl(renewal, renewal.getDocusealSubmitterSlug()));
        }
        return response;
    }

    @Override
    @Transactional
    public ContractRenewalResponse rejectRenewal(UUID renewalId, String reason) {
        if (reason == null || reason.isBlank()) {
            throw new AppException(ErrorCode.CONTRACT_RENEWAL_REJECTION_REASON_REQUIRED);
        }

        ContractRenewal renewal = contractRenewalRepository.findById(renewalId)
                .orElseThrow(() -> new AppException(ErrorCode.CONTRACT_RENEWAL_NOT_FOUND));

        RentalContract contract = renewal.getContract();
        if (facilityAccessGuard.isFacilityScoped()) {
            facilityAccessGuard.checkFacilityAccess(contract.getFacility().getId());
        }

        if (renewal.getStatus() == ContractRenewalStatus.COMPLETED || renewal.getStatus() == ContractRenewalStatus.CANCELLED) {
            throw new AppException(ErrorCode.CONTRACT_RENEWAL_CANNOT_BE_REJECTED);
        }

        User reviewer = null;
        UUID currentUserId = requestContext.currentUserId();
        if (currentUserId != null) {
            reviewer = userRepository.findById(currentUserId).orElse(null);
        }

        ContractRenewalStatus oldStatus = renewal.getStatus();
        renewal.setStatus(ContractRenewalStatus.REJECTED);
        renewal.setReviewedBy(reviewer);
        renewal.setReviewedAt(LocalDateTime.now());
        renewal.setRejectionReason(reason.trim());
        renewal = contractRenewalRepository.save(renewal);

        activityLogService.record(
                contract.getFacility().getId(),
                ActivityAction.RENEWAL_REJECTED,
                "ContractRenewal",
                renewal.getId(),
                "Tu choi yeu cau gia han hop dong " + contract.getContractCode() + " - Ly do: " + reason,
                oldStatus,
                ContractRenewalStatus.REJECTED
        );

        sendCustomerRenewalNotification(
                contract,
                "Yêu cầu gia hạn hợp đồng " + contract.getContractCode() + " đã bị từ chối",
                "Yêu cầu gia hạn thêm " + renewal.getCycleMonths() + " tháng cho kho #" + contract.getUnit().getUnitCode() + " đã bị từ chối với lý do: " + reason + ". Đơn từ chối sẽ có thể được kích hoạt duyệt lại sau 3 ngày kể từ ngày gửi đơn ban đầu.",
                NotificationType.RENEWAL_REJECTED
        );

        return contractRenewalMapper.toResponse(renewal);
    }

    @Override
    @Transactional
    public ContractRenewalResponse cancelRenewal(UUID renewalId) {
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

        if (renewal.getStatus() == ContractRenewalStatus.COMPLETED ||
                (renewal.getPayment() != null && renewal.getPayment().getStatus() == PaymentStatus.PAID)) {
            throw new AppException(ErrorCode.CONTRACT_RENEWAL_CANNOT_BE_CANCELLED);
        }

        ContractRenewalStatus oldStatus = renewal.getStatus();
        renewal.setStatus(ContractRenewalStatus.CANCELLED);
        renewal = contractRenewalRepository.save(renewal);

        activityLogService.record(
                contract.getFacility().getId(),
                ActivityAction.CONTRACT_SIGNED,
                "ContractRenewal",
                renewal.getId(),
                "Huy yeu cau gia han hop dong " + contract.getContractCode(),
                oldStatus,
                ContractRenewalStatus.CANCELLED
        );

        return contractRenewalMapper.toResponse(renewal);
    }

    @Override
    @Transactional
    public ContractRenewalResponse reactivateRenewal(UUID renewalId) {
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

        if (renewal.getStatus() != ContractRenewalStatus.REJECTED) {
            throw new AppException(ErrorCode.CONTRACT_RENEWAL_NOT_REJECTED);
        }

        // Quy tắc: Đơn từ chối chỉ có thể được kích hoạt duyệt lại sau 3 ngày kể từ ngày customer gửi đơn (createdAt)
        LocalDateTime createdAt = renewal.getCreatedAt();
        if (createdAt != null) {
            LocalDateTime unlockTime = createdAt.plusDays(3);
            if (LocalDateTime.now().isBefore(unlockTime)) {
                throw new AppException(ErrorCode.CONTRACT_RENEWAL_REACTIVATE_TOO_EARLY,
                        "Chưa đủ 3 ngày kể từ ngày gửi đơn (" + createdAt.format(DATE_FMT) + "), chưa thể kích hoạt duyệt lại. Thời gian mở lại: " + unlockTime.format(DateTimeFormatter.ofPattern("HH:mm dd/MM/yyyy")));
            }
        }

        ContractRenewalStatus oldStatus = renewal.getStatus();
        renewal.setStatus(ContractRenewalStatus.PENDING_REVIEW);
        if (renewal.getRejectionReason() != null) {
            String hist = "[Lý do từ chối trước đó]: " + renewal.getRejectionReason();
            renewal.setNotes(renewal.getNotes() != null ? renewal.getNotes() + " | " + hist : hist);
        }
        renewal.setRejectionReason(null);
        renewal.setReviewedBy(null);
        renewal.setReviewedAt(null);
        renewal = contractRenewalRepository.save(renewal);

        activityLogService.record(
                contract.getFacility().getId(),
                ActivityAction.RENEWAL_REACTIVATED,
                "ContractRenewal",
                renewal.getId(),
                "Kich hoat duyet lai don gia han hop dong " + contract.getContractCode() + " sau khi bi tu choi",
                oldStatus,
                ContractRenewalStatus.PENDING_REVIEW
        );

        sendCustomerRenewalNotification(
                contract,
                "Yêu cầu gia hạn hợp đồng " + contract.getContractCode() + " đã được kích hoạt duyệt lại",
                "Yêu cầu gia hạn kho #" + contract.getUnit().getUnitCode() + " đã được mở lại thành công và chuyển về trạng thái Chờ Quản lý cơ sở xét duyệt.",
                NotificationType.RENEWAL_REACTIVATED
        );

        return contractRenewalMapper.toResponse(renewal);
    }

    @Override
    @Transactional
    public ContractRenewalResponse undoApproval(UUID renewalId, String reason) {
        ContractRenewal renewal = contractRenewalRepository.findById(renewalId)
                .orElseThrow(() -> new AppException(ErrorCode.CONTRACT_RENEWAL_NOT_FOUND));

        RentalContract contract = renewal.getContract();
        if (facilityAccessGuard.isFacilityScoped()) {
            facilityAccessGuard.checkFacilityAccess(contract.getFacility().getId());
        }

        // Chỉ cho phép bỏ duyệt khi đang ở trạng thái PENDING_SIGNATURE
        if (renewal.getStatus() != ContractRenewalStatus.PENDING_SIGNATURE) {
            throw new AppException(ErrorCode.CONTRACT_RENEWAL_CANNOT_UNDO_APPROVAL,
                    "Chỉ có thể bỏ duyệt khi yêu cầu đang ở trạng thái Chờ ký và chưa tiến hành ký hoặc thanh toán");
        }

        // Nếu khách hàng đã ký rồi hoặc đã nộp tiền rồi -> Bắt buộc không cho bỏ duyệt
        if (renewal.getSignedAt() != null || renewal.getSignatureData() != null 
                || (renewal.getPayment() != null && renewal.getPayment().getStatus() == PaymentStatus.PAID)) {
            throw new AppException(ErrorCode.CONTRACT_RENEWAL_CANNOT_UNDO_APPROVAL,
                    "Không thể bỏ duyệt yêu cầu gia hạn do khách hàng đã ký điện tử hoặc đã hoàn tất thanh toán cước phí");
        }

        ContractRenewalStatus oldStatus = renewal.getStatus();
        renewal.setStatus(ContractRenewalStatus.PENDING_REVIEW);
        renewal.setReviewedBy(null);
        renewal.setReviewedAt(null);
        if (reason != null && !reason.isBlank()) {
            renewal.setNotes(renewal.getNotes() != null ? renewal.getNotes() + " | Bỏ duyệt: " + reason : "Bỏ duyệt: " + reason);
        }
        renewal = contractRenewalRepository.save(renewal);

        activityLogService.record(
                contract.getFacility().getId(),
                ActivityAction.RENEWAL_APPROVAL_UNDONE,
                "ContractRenewal",
                renewal.getId(),
                "Quan ly co so bo duyet yeu cau gia han hop dong " + contract.getContractCode() + (reason != null ? " - Ly do: " + reason : ""),
                oldStatus,
                ContractRenewalStatus.PENDING_REVIEW
        );

        sendCustomerRenewalNotification(
                contract,
                "Trạng thái gia hạn hợp đồng " + contract.getContractCode() + " đã thay đổi",
                "Quản lý cơ sở đã thu hồi phê duyệt trước đó để xem xét lại phương án gia hạn cho kho #" + contract.getUnit().getUnitCode() + ". Quý khách vui lòng chờ cập nhật tiếp theo từ cơ sở.",
                NotificationType.RENEWAL_REMINDER_3D
        );

        return contractRenewalMapper.toResponse(renewal);
    }

    @Override
    @Transactional
    public ContractRenewalResponse assignStaff(UUID renewalId, com.boxora.dto.request.ContractRenewalAssignStaffRequest request) {
        String currentRole = requestContext.currentUserRole();
        if ("STAFF".equalsIgnoreCase(currentRole)) {
            throw new AppException(ErrorCode.FORBIDDEN, "Chỉ Quản lý cơ sở hoặc Business Manager mới có quyền phân công nhân viên tiếp đón");
        }

        if (request == null || request.getStaffId() == null) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Vui lòng chọn nhân viên được phân công tiếp đón");
        }

        ContractRenewal renewal = contractRenewalRepository.findById(renewalId)
                .orElseThrow(() -> new AppException(ErrorCode.CONTRACT_RENEWAL_NOT_FOUND));

        RentalContract contract = renewal.getContract();
        if (facilityAccessGuard.isFacilityScoped()) {
            facilityAccessGuard.checkFacilityAccess(contract.getFacility().getId());
        }

        User staff = userRepository.findById(request.getStaffId())
                .orElseThrow(() -> new AppException(ErrorCode.STAFF_USER_NOT_FOUND));

        if (!Boolean.TRUE.equals(staff.getIsActive())) {
            throw new AppException(ErrorCode.USER_NOT_FOUND);
        }

        // Cho phép phân công cho cả STAFF và FACILITY_MANAGER
        if (staff.getRole() != null 
                && !"STAFF".equalsIgnoreCase(staff.getRole().getName()) 
                && !"FACILITY_MANAGER".equalsIgnoreCase(staff.getRole().getName())) {
            throw new AppException(ErrorCode.FORBIDDEN, "Chỉ có thể phân tiếp đón cho Nhân viên hoặc Quản lý cơ sở");
        }

        // Kiểm tra cơ sở của nhân sự phải trùng với cơ sở của hợp đồng
        if (staff.getFacility() != null && !staff.getFacility().getId().equals(contract.getFacility().getId())) {
            throw new AppException(ErrorCode.CONTRACT_RENEWAL_STAFF_FACILITY_MISMATCH,
                    "Nhân sự được phân công (" + staff.getFullName() + ") không trực thuộc cơ sở " + contract.getFacility().getName());
        }

        renewal.setAssignedStaff(staff);
        renewal.setAssignedStaffAt(LocalDateTime.now());
        if (request.getNotes() != null && !request.getNotes().isBlank()) {
            renewal.setNotes(renewal.getNotes() != null ? renewal.getNotes() + " | Phân tiếp đón: " + request.getNotes() : "Phân tiếp đón: " + request.getNotes());
        }
        renewal = contractRenewalRepository.save(renewal);

        // Xác định ca trực tương ứng với giờ hẹn check-in của khách
        StaffShift shift = StaffShift.MORNING;
        if (renewal.getCounterAppointmentTime() != null && !renewal.getCounterAppointmentTime().isBlank()) {
            try {
                String[] parts = renewal.getCounterAppointmentTime().split(":");
                int hour = Integer.parseInt(parts[0].trim());
                shift = StaffShift.fromTime(LocalTime.of(hour, 0));
            } catch (Exception ignored) {}
        }
        LocalTime startTime = shift.getDefaultStartTime();
        LocalTime endTime = shift.getDefaultEndTime();
        String shiftLabel = String.format("%s (%02d:00 - %02d:00)",
                shift.getDisplayName(),
                startTime.getHour(),
                endTime.getHour());

        LocalDate appointmentDate = renewal.getCounterAppointmentDate() != null
                ? renewal.getCounterAppointmentDate()
                : LocalDate.now(BUSINESS_ZONE);

        // Kiểm tra xem nhân sự đã có ca trực trong khung giờ đó chưa, nếu chưa và không từ chối tạo -> Tự động tạo ca trực
        boolean hasShift = staffAssignmentRepository.existsByStaff_IdAndAssignedDateAndShift(
                staff.getId(), appointmentDate, shift
        );
        if (!hasShift && !Boolean.FALSE.equals(request.getAutoCreateShift())) {
            UUID currentUserId = requestContext.currentUserId();
            User assignedBy = currentUserId != null ? userRepository.findById(currentUserId).orElse(null) : null;

            StaffAssignment autoShift = StaffAssignment.builder()
                    .staff(staff)
                    .facility(contract.getFacility())
                    .assignedDate(appointmentDate)
                    .shift(shift)
                    .startTime(startTime)
                    .endTime(endTime)
                    .roleInShift("RECEPTION_STAFF")
                    .status(StaffAssignmentStatus.ASSIGNED)
                    .assignedBy(assignedBy)
                    .notes("Ca trực tự động tạo phục vụ tiếp đón gia hạn hợp đồng #" + contract.getContractCode())
                    .build();
            staffAssignmentRepository.save(autoShift);
            log.info("Auto-created shift {} on {} for user {} to handle contract renewal {}",
                    shift, appointmentDate, staff.getId(), renewal.getId());
        }

        activityLogService.record(
                contract.getFacility().getId(),
                ActivityAction.RENEWAL_STAFF_ASSIGNED,
                "ContractRenewal",
                renewal.getId(),
                "Phân công " + (staff.getRole() != null ? staff.getRole().getName() : "nhân sự") + " " + staff.getFullName() + " tiếp đón gia hạn hợp đồng " + contract.getContractCode(),
                null,
                staff.getId()
        );

        String timeText = renewal.getCounterAppointmentTime() != null ? " lúc " + renewal.getCounterAppointmentTime() : "";
        String dateText = appointmentDate.format(DATE_FMT);
        sendStaffNotification(
                staff,
                contract.getFacility(),
                "Phân công tiếp đón gia hạn hợp đồng #" + contract.getContractCode(),
                "Bạn được phân công tiếp đón và làm thủ tục gia hạn cho khách hàng " + contract.getCustomer().getFullName() + " (Kho #" + contract.getUnit().getUnitCode() + ") tại cơ sở vào ngày " + dateText + timeText + " (" + shiftLabel + "). Vui lòng kiểm tra và xác nhận tiếp đón.",
                NotificationType.RENEWAL_APPROVED,
                renewal.getId()
        );

        return contractRenewalMapper.toResponse(renewal);
    }

    @Override
    @Transactional
    public ContractRenewalResponse completeReception(UUID renewalId, com.boxora.dto.request.ContractRenewalReceptionRequest request) {
        if (request == null) {
            throw new AppException(ErrorCode.CONTRACT_RENEWAL_RECEPTION_CHECKLIST_INCOMPLETE);
        }

        ContractRenewal renewal = contractRenewalRepository.findById(renewalId)
                .orElseThrow(() -> new AppException(ErrorCode.CONTRACT_RENEWAL_NOT_FOUND));

        RentalContract contract = renewal.getContract();
        Facility facility = contract.getFacility();
        if (facilityAccessGuard.isFacilityScoped()) {
            facilityAccessGuard.checkFacilityAccess(facility.getId());
        }

        // 1. Kiểm tra trạng thái yêu cầu gia hạn: phải được phê duyệt trước đó
        if (renewal.getStatus() == ContractRenewalStatus.PENDING_REVIEW) {
            throw new AppException(ErrorCode.CONTRACT_RENEWAL_NOT_APPROVED);
        }
        if (renewal.getStatus() == ContractRenewalStatus.COMPLETED) {
            throw new AppException(ErrorCode.CONTRACT_RENEWAL_ALREADY_COMPLETED);
        }
        if (renewal.getStatus() == ContractRenewalStatus.REJECTED || renewal.getStatus() == ContractRenewalStatus.CANCELLED) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Yêu cầu gia hạn đã bị từ chối hoặc đã hủy");
        }

        // =========================================================================
        // QUY TẮC NGHIỆP VỤ THỜI ĐIỂM CHECK-IN (LỊCH HẸN TIẾP ĐÓN GIA HẠN TẠI QUẦY):
        // 1. Chưa đến ngày check-in -> Không cho phép -> Ném lỗi CONTRACT_RENEWAL_BEFORE_CHECKIN_DATE
        // 2. Đúng ngày nhưng chưa đến giờ check-in -> Không cho phép -> Ném lỗi CONTRACT_RENEWAL_BEFORE_CHECKIN_TIME
        // 3. Đã đến giờ check-in -> Có thể -> Tiếp tục kiểm tra các điều kiện tiếp nhận còn lại
        // 4. Khách đến muộn -> Có thể -> Cho tiếp nhận nếu hợp đồng, lịch hẹn và các điều kiện khác vẫn hợp lệ
        // =========================================================================
        if (renewal.getCounterAppointmentDate() != null) {
            LocalDate apptDate = renewal.getCounterAppointmentDate();
            LocalDateTime now = LocalDateTime.now(BUSINESS_ZONE);
            LocalDate today = now.toLocalDate();

            if (today.isBefore(apptDate)) {
                String timeSuffix = (renewal.getCounterAppointmentTime() != null && !renewal.getCounterAppointmentTime().isBlank())
                        ? " lúc " + renewal.getCounterAppointmentTime() : "";
                log.warn("[RENEWAL-CHECKIN-DATE] Reception rejected for renewal {}. Today {} is before appointment date {}{}",
                        renewal.getId(), today, apptDate, timeSuffix);
                throw new AppException(ErrorCode.CONTRACT_RENEWAL_BEFORE_CHECKIN_DATE,
                        String.format("Chưa đến ngày check-in. Thời điểm được phép tiếp nhận kho từ: %s%s",
                                apptDate.format(DATE_FMT), timeSuffix));
            } else if (today.isEqual(apptDate) && renewal.getCounterAppointmentTime() != null && !renewal.getCounterAppointmentTime().isBlank()) {
                LocalTime apptTime = null;
                try {
                    apptTime = LocalTime.parse(renewal.getCounterAppointmentTime().trim());
                } catch (Exception ex) {
                    log.warn("Could not parse renewal appointment time: {}", renewal.getCounterAppointmentTime());
                }
                if (apptTime != null && now.toLocalTime().isBefore(apptTime)) {
                    log.warn("[RENEWAL-CHECKIN-TIME] Reception rejected for renewal {}. Current time {} is before appointment time {}",
                            renewal.getId(), now.toLocalTime(), apptTime);
                    throw new AppException(ErrorCode.CONTRACT_RENEWAL_BEFORE_CHECKIN_TIME,
                            String.format("Đúng ngày nhưng chưa đến giờ check-in (Lịch hẹn lúc %s). Vui lòng chờ đến giờ hợp lệ.",
                                    renewal.getCounterAppointmentTime()));
                }
            }
        }

        // 2. Logic kiểm tra ca trực của người tiếp nhận: bắt buộc đã check-in vào ca trực hôm nay tại cơ sở này
        UUID currentUserId = requestContext.currentUserId();
        String currentRole = requestContext.currentUserRole();
        User currentUser = null;
        if (currentUserId != null) {
            currentUser = userRepository.findById(currentUserId).orElse(null);
        }

        boolean isAdminOrBm = "ADMIN".equalsIgnoreCase(currentRole) || "SYSTEM_ADMIN".equalsIgnoreCase(currentRole) || "BUSINESS_MANAGER".equalsIgnoreCase(currentRole);
        if (!isAdminOrBm && currentUserId != null) {
            LocalDate today = LocalDate.now(BUSINESS_ZONE);
            List<StaffAssignment> todayAssignments = staffAssignmentRepository.findByStaff_IdAndAssignedDate(currentUserId, today);
            boolean isCheckedIn = todayAssignments.stream().anyMatch(a ->
                    a.getFacility() != null && a.getFacility().getId().equals(facility.getId())
                    && a.getStatus() == StaffAssignmentStatus.CHECKED_IN
            );

            if (!isCheckedIn) {
                log.warn("User {} attempted to receive renewal without checked-in shift at facility {}", currentUserId, facility.getId());
                throw new AppException(ErrorCode.STAFF_NOT_CHECKED_IN_SHIFT,
                        "Bạn chưa điểm danh vào ca trực hôm nay tại cơ sở " + facility.getName() + ". Vui lòng check-in ca trực tại Bàn vận hành quầy trước khi thực hiện tiếp nhận khách.");
            }
        }

        // 3. Tiêu chí 1: Danh tính và quyền gia hạn đã được xác minh
        if (!Boolean.TRUE.equals(request.getIdentityVerified())) {
            throw new AppException(ErrorCode.CONTRACT_RENEWAL_RECEPTION_CHECKLIST_INCOMPLETE,
                    "Tiêu chí 1: Bắt buộc phải đối chiếu và xác minh danh tính khách hàng (CCCD/Hộ chiếu) hợp lệ");
        }

        // 4. Tiêu chí 2: Hợp đồng và kho được đối soát chính xác
        if (!Boolean.TRUE.equals(request.getUnitAudited())) {
            throw new AppException(ErrorCode.CONTRACT_RENEWAL_RECEPTION_CHECKLIST_INCOMPLETE,
                    "Tiêu chí 2: Bắt buộc phải đối soát hợp đồng và kiểm tra hiện trạng an toàn kho lưu trữ");
        }

        // 5. Tiêu chí 3: Không có trạng thái chặn gia hạn chưa được xử lý
        if (!Boolean.TRUE.equals(request.getNoBlockingIssues())) {
            throw new AppException(ErrorCode.CONTRACT_RENEWAL_RECEPTION_CHECKLIST_INCOMPLETE,
                    "Tiêu chí 3: Bắt buộc phải xác nhận không có tranh chấp hay trạng thái chặn gia hạn");
        }
        if (contract.getStatus() == RentalContractStatus.OVERDUE_LOCKED
                || (contract.getUnit() != null && contract.getUnit().getStatus() == UnitStatus.OVERDUE_LOCKED)) {
            throw new AppException(ErrorCode.UNIT_OVERDUE_LOCKED,
                    "Kho lưu trữ đang bị niêm phong khóa quá hạn. Cần giải tỏa niêm phong trước khi tiếp nhận gia hạn");
        }
        if (contract.getStatus() == RentalContractStatus.TERMINATED || contract.getStatus() == RentalContractStatus.CANCELLED) {
            throw new AppException(ErrorCode.CONTRACT_NOT_ACTIVE, "Hợp đồng đã kết thúc hoặc bị hủy, không thể tiếp nhận gia hạn");
        }

        // 6. Tiêu chí 4: Giá, thời hạn và các khoản phí đã được xác nhận
        if (!Boolean.TRUE.equals(request.getTermsConfirmed())) {
            throw new AppException(ErrorCode.CONTRACT_RENEWAL_RECEPTION_CHECKLIST_INCOMPLETE,
                    "Tiêu chí 4: Bắt buộc phải xác nhận đơn giá thuê, thời hạn gia hạn và các khoản cước phí với khách hàng");
        }

        // 7. Tiêu chí 5: Thanh toán và phê duyệt bắt buộc đã hoàn tất
        if (!Boolean.TRUE.equals(request.getPaymentConfirmed())) {
            throw new AppException(ErrorCode.CONTRACT_RENEWAL_RECEPTION_CHECKLIST_INCOMPLETE,
                    "Tiêu chí 5: Bắt buộc phải hoàn tất thủ tục thanh toán cước phí gia hạn");
        }

        // Ghi nhận thanh toán tại quầy nếu chưa có Payment hoàn tất
        Payment payment = renewal.getPayment();
        String payMethod = request.getPaymentMethod() != null && !request.getPaymentMethod().isBlank() 
                ? request.getPaymentMethod().toUpperCase() : (renewal.getPaymentMethod() != null ? renewal.getPaymentMethod() : "CASH");
        String voucherCode = request.getReceiptVoucherCode() != null && !request.getReceiptVoucherCode().isBlank()
                ? request.getReceiptVoucherCode().trim() : ("VCH-" + System.currentTimeMillis() % 1000000);

        if (payment == null || payment.getStatus() != PaymentStatus.PAID) {
            String txnRef = "CSH-" + System.currentTimeMillis() + "-" + voucherCode;
            payment = Payment.builder()
                    .transactionId(txnRef)
                    .contract(contract)
                    .amount(renewal.getRenewalFee())
                    .paymentType(PaymentType.RENEWAL_FEE)
                    .renewalMonths(renewal.getCycleMonths())
                    .status(PaymentStatus.PAID)
                    .paymentMethod(payMethod)
                    .receiptVoucherCode(voucherCode)
                    .collectedByStaff(currentUser)
                    .paymentTime(LocalDateTime.now())
                    .paymentNotes(request.getReceptionNotes())
                    .build();
            payment = paymentRepository.save(payment);
            renewal.setPayment(payment);
        }

        // Nếu khách ký xác nhận trực tiếp bằng chữ ký tay (chữ ký số trên tablet/màn hình cảm ứng)
        if (request.getSignatureData() != null && !request.getSignatureData().isBlank()) {
            renewal.setSignatureData(request.getSignatureData());
            renewal.setSignedAt(LocalDateTime.now());
            if (renewal.getSignedDocumentUrl() == null) {
                renewal.setSignedDocumentUrl("https://boxora.vn/contracts/renewals/signed-" + renewal.getId() + ".pdf");
            }
        }

        // 8. Tiêu chí 6: Backend ghi nhận người thực hiện, thời điểm, kết quả kiểm tra và lịch sử thay đổi
        renewal.setIdentityVerified(true);
        renewal.setIdentityDocType(request.getIdentityDocType());
        renewal.setIdentityNumber(request.getIdentityNumber());
        renewal.setIdentityNotes(request.getIdentityNotes());

        renewal.setUnitAudited(true);
        renewal.setUnitAuditNotes(request.getUnitAuditNotes());

        renewal.setNoBlockingIssues(true);
        renewal.setBlockingNotes(request.getBlockingNotes());

        renewal.setTermsConfirmed(true);
        renewal.setTermsNotes(request.getTermsNotes());

        renewal.setPaymentConfirmed(true);
        renewal.setPaymentMethod(payMethod);
        renewal.setReceiptVoucherCode(voucherCode);
        renewal.setPaidAt(LocalDateTime.now());
        renewal.setCashierStaff(currentUser);

        renewal.setHandledBy(currentUser);
        renewal.setHandledAt(LocalDateTime.now());
        renewal.setReceptionNotes(request.getReceptionNotes());
        renewal.setStatus(ContractRenewalStatus.COMPLETED);

        renewal = contractRenewalRepository.save(renewal);

        // Kéo dài thời hạn hợp đồng chính thức
        contract.setEndDate(renewal.getNewEndDate());
        contract.setStatus(RentalContractStatus.ACTIVE);
        rentalContractRepository.save(contract);

        // Ghi nhận Activity Log đầy đủ
        String handledName = currentUser != null && currentUser.getFullName() != null ? currentUser.getFullName() : (currentUser != null ? currentUser.getUsername() : "Staff");
        activityLogService.record(
                facility.getId(),
                ActivityAction.RENEWAL_RECEPTION_COMPLETE,
                "RentalContract",
                contract.getId(),
                String.format("Nhan vien %s hoan tat tiep nhan gia han hop dong %s them %d thang den %s (Doi soat 6 tieu chi dat chuan, phieu thu: %s)",
                        handledName,
                        contract.getContractCode(),
                        renewal.getCycleMonths(),
                        renewal.getNewEndDate().format(DATE_FMT),
                        voucherCode),
                null,
                renewal.getId()
        );

        sendCustomerRenewalNotification(
                contract,
                "Hợp đồng " + contract.getContractCode() + " đã hoàn tất tiếp nhận gia hạn thành công",
                String.format("Boxora trân trọng thông báo thủ tục tiếp nhận gia hạn kho #%s tại cơ sở %s đã hoàn tất 100%%. Thời hạn thuê của quý khách đã được gia hạn thêm %d tháng (đến ngày %s).",
                        contract.getUnit().getUnitCode(),
                        facility.getName(),
                        renewal.getCycleMonths(),
                        renewal.getNewEndDate().format(DATE_FMT)),
                NotificationType.RENEWAL_COMPLETED
        );

        return contractRenewalMapper.toResponse(renewal);
    }

    @Override
    @Transactional
    public ContractRenewalResponse switchRenewalMethod(UUID renewalId, com.boxora.dto.request.ContractRenewalSwitchMethodRequest request) {
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

        // 1. Chỉ khi Facility Manager duyệt (không còn ở PENDING_REVIEW) thì customer mới có thể chọn / đổi phương thức
        if (renewal.getStatus() == ContractRenewalStatus.PENDING_REVIEW) {
            throw new AppException(ErrorCode.CONTRACT_RENEWAL_NOT_APPROVED);
        }

        if (renewal.getStatus() == ContractRenewalStatus.COMPLETED) {
            throw new AppException(ErrorCode.CONTRACT_RENEWAL_ALREADY_COMPLETED);
        }
        if (renewal.getStatus() == ContractRenewalStatus.CANCELLED || renewal.getStatus() == ContractRenewalStatus.REJECTED) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Yêu cầu gia hạn này đã bị hủy hoặc từ chối");
        }

        String targetMethod = request.getMethod() != null ? request.getMethod().trim().toUpperCase() : "";

        if ("COUNTER".equals(targetMethod)) {
            // 2. Nếu đã ký rồi thì bắt buộc thanh toán online chứ không thể đổi được nữa
            boolean alreadySigned = renewal.getSignedAt() != null
                    || renewal.getSignatureData() != null
                    || renewal.getStatus() == ContractRenewalStatus.PENDING_PAYMENT;
            if (alreadySigned) {
                throw new AppException(ErrorCode.CONTRACT_RENEWAL_CANNOT_SWITCH_METHOD);
            }

            // 3. Nếu muốn chuyển sang trực tiếp thì cần ngày tới gia hạn ký và thanh toán
            if (request.getAppointmentDate() == null) {
                throw new AppException(ErrorCode.CONTRACT_RENEWAL_APPOINTMENT_DATE_REQUIRED);
            }
            if (request.getAppointmentDate().isBefore(LocalDate.now())) {
                throw new AppException(ErrorCode.CONTRACT_RENEWAL_INVALID_APPOINTMENT_DATE);
            }

            renewal.setPaymentMethod("COUNTER");
            renewal.setCounterAppointmentDate(request.getAppointmentDate());
            String appTime = (request.getAppointmentTime() != null && !request.getAppointmentTime().isBlank())
                    ? request.getAppointmentTime().trim()
                    : "09:00";
            renewal.setCounterAppointmentTime(appTime);
            String timeDisplay = " lúc " + appTime;
            if (request.getNotes() != null && !request.getNotes().isBlank()) {
                String existingNotes = renewal.getNotes() != null ? renewal.getNotes() + " | " : "";
                renewal.setNotes(existingNotes + "Đổi sang gia hạn tại quầy (Hẹn: " + request.getAppointmentDate().format(DATE_FMT) + timeDisplay + "): " + request.getNotes().trim());
            }

            activityLogService.record(
                    contract.getFacility().getId(),
                    ActivityAction.RENEWAL_REQUEST,
                    "ContractRenewal",
                    renewal.getId(),
                    "Khach hang chon hinh thuc gia han tai quay co so, hen: " + request.getAppointmentDate().format(DATE_FMT) + timeDisplay,
                    null,
                    renewal.getId()
            );
        } else if ("ONLINE".equals(targetMethod)) {
            renewal.setPaymentMethod("ONLINE");
            renewal.setCounterAppointmentDate(null);
            renewal.setCounterAppointmentTime(null);
            if (request.getNotes() != null && !request.getNotes().isBlank()) {
                String existingNotes = renewal.getNotes() != null ? renewal.getNotes() + " | " : "";
                renewal.setNotes(existingNotes + "Đổi sang ký & thanh toán trực tuyến: " + request.getNotes().trim());
            }

            // Đảm bảo đã có DocuSeal submitter slug
            if (renewal.getDocusealSubmitterSlug() == null) {
                createDocusealSubmissionForRenewal(renewal);
            }

            activityLogService.record(
                    contract.getFacility().getId(),
                    ActivityAction.RENEWAL_REQUEST,
                    "ContractRenewal",
                    renewal.getId(),
                    "Khach hang chon hinh thuc ky va thanh toan truc tuyen DocuSeal / VNPay",
                    null,
                    renewal.getId()
            );
        } else {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Phương thức không hợp lệ. Vui lòng chọn ONLINE hoặc COUNTER");
        }

        renewal = contractRenewalRepository.save(renewal);
        ContractRenewalResponse response = contractRenewalMapper.toResponse(renewal);
        if (renewal.getDocusealSubmitterSlug() != null) {
            response.setSigningUrl(signingUrl(renewal, renewal.getDocusealSubmitterSlug()));
        }
        return response;
    }

    @Override
    @Transactional
    public ContractRenewalResponse recordCounterPayment(UUID renewalId, ContractRenewalCounterPaymentRequest request) {
        ContractRenewal renewal = contractRenewalRepository.findById(renewalId)
                .orElseThrow(() -> new AppException(ErrorCode.CONTRACT_RENEWAL_NOT_FOUND));

        RentalContract contract = renewal.getContract();
        if (facilityAccessGuard.isFacilityScoped()) {
            facilityAccessGuard.checkFacilityAccess(contract.getFacility().getId());
        }

        if (renewal.getStatus() == ContractRenewalStatus.PENDING_REVIEW) {
            throw new AppException(ErrorCode.CONTRACT_RENEWAL_NOT_APPROVED);
        }

        if (renewal.getStatus() == ContractRenewalStatus.COMPLETED) {
            throw new AppException(ErrorCode.CONTRACT_RENEWAL_ALREADY_COMPLETED);
        }
        if (renewal.getStatus() == ContractRenewalStatus.CANCELLED || renewal.getStatus() == ContractRenewalStatus.REJECTED) {
            throw new AppException(ErrorCode.INVALID_REQUEST);
        }

        // Nếu hợp đồng đã ký trực tuyến, bắt buộc thanh toán online, không thể thu tại quầy
        if (renewal.getSignedAt() != null || renewal.getSignatureData() != null) {
            throw new AppException(ErrorCode.CONTRACT_RENEWAL_CANNOT_SWITCH_METHOD,
                    "Phụ lục gia hạn đã được ký điện tử trực tuyến, bắt buộc thanh toán trực tuyến qua cổng VNPay và không thể thu tại quầy");
        }

        if (renewal.getPayment() != null && renewal.getPayment().getStatus() == PaymentStatus.PAID) {
            throw new AppException(ErrorCode.CONTRACT_RENEWAL_ALREADY_PAID);
        }

        User staff = null;
        UUID currentUserId = requestContext.currentUserId();
        if (currentUserId != null) {
            staff = userRepository.findById(currentUserId).orElse(null);
        }

        String txnRef = "CSH-" + System.currentTimeMillis() + "-" + (request.getReceiptVoucherCode() != null && !request.getReceiptVoucherCode().isBlank() ? request.getReceiptVoucherCode() : "VCH");

        Payment payment = Payment.builder()
                .transactionId(txnRef)
                .contract(contract)
                .amount(renewal.getRenewalFee())
                .paymentType(PaymentType.RENEWAL_FEE)
                .renewalMonths(renewal.getCycleMonths())
                .status(PaymentStatus.PAID)
                .paymentMethod(request.getPaymentMethod() != null ? request.getPaymentMethod().toUpperCase() : "CASH")
                .receiptVoucherCode(request.getReceiptVoucherCode())
                .collectedByStaff(staff)
                .paymentTime(LocalDateTime.now())
                .paymentNotes(request.getNotes())
                .build();
        payment = paymentRepository.save(payment);

        renewal.setPayment(payment);
        renewal.setPaymentMethod(payment.getPaymentMethod());
        renewal.setReceiptVoucherCode(payment.getReceiptVoucherCode());
        renewal.setCashierStaff(staff);
        renewal.setPaidAt(LocalDateTime.now());
        renewal = contractRenewalRepository.save(renewal);

        // Kích hoạt hoàn tất hoặc chuyển sang chờ ký
        handleRenewalPaid(payment);

        renewal = contractRenewalRepository.findById(renewalId).orElse(renewal);

        activityLogService.record(
                contract.getFacility().getId(),
                ActivityAction.PAYMENT_CONFIRMED,
                "PAYMENT",
                payment.getId(),
                "Thu phi gia han hop dong " + contract.getContractCode() + " tai quay: " + renewal.getRenewalFee() + " VND (" + payment.getPaymentMethod() + ")",
                PaymentStatus.PENDING,
                PaymentStatus.PAID
        );

        sendCustomerRenewalNotification(
                contract,
                "Xác nhận thanh toán gia hạn hợp đồng " + contract.getContractCode(),
                "Hệ thống Boxora đã ghi nhận thanh toán phí gia hạn " + renewal.getRenewalFee() + " VND tại quầy qua hình thức " + payment.getPaymentMethod() + "."
        );

        ContractRenewalResponse response = contractRenewalMapper.toResponse(renewal);
        if (renewal.getDocusealSubmitterSlug() != null) {
            response.setSigningUrl(signingUrl(renewal, renewal.getDocusealSubmitterSlug()));
        }
        return response;
    }

    @Override
    @Transactional
    public ContractRenewalResponse mockSignRenewal(UUID renewalId, String signatureData) {
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

        if (renewal.getStatus() == ContractRenewalStatus.PENDING_REVIEW) {
            throw new AppException(ErrorCode.CONTRACT_RENEWAL_NOT_APPROVED);
        }
        if (renewal.getStatus() == ContractRenewalStatus.COMPLETED) {
            throw new AppException(ErrorCode.CONTRACT_RENEWAL_ALREADY_COMPLETED);
        }
        if (renewal.getStatus() == ContractRenewalStatus.CANCELLED || renewal.getStatus() == ContractRenewalStatus.REJECTED) {
            throw new AppException(ErrorCode.INVALID_REQUEST);
        }

        if (signatureData == null || signatureData.trim().isEmpty() || !signatureData.startsWith("data:image/")) {
            throw new AppException(ErrorCode.INVALID_REQUEST);
        }

        renewal.setPaymentMethod("ONLINE");
        renewal.setCounterAppointmentDate(null);
        renewal.setSignatureData(signatureData);
        String mockSignedUrl = "https://boxora.vn/contracts/renewals/signed-" + renewal.getId() + ".pdf";
        renewal.setSignedDocumentUrl(mockSignedUrl);
        renewal.setSignedAt(LocalDateTime.now());
        renewal = contractRenewalRepository.save(renewal);

        handleRenewalSigned(renewal.getId(), mockSignedUrl);

        renewal = contractRenewalRepository.findById(renewalId).orElse(renewal);

        activityLogService.record(
                contract.getFacility().getId(),
                ActivityAction.CONTRACT_SIGNED,
                "ContractRenewal",
                renewal.getId(),
                "Khach hang da ky dien tu phu luc gia han hop dong " + contract.getContractCode(),
                null,
                renewal.getId()
        );

        ContractRenewalResponse response = contractRenewalMapper.toResponse(renewal);
        if (renewal.getDocusealSubmitterSlug() != null) {
            response.setSigningUrl(signingUrl(renewal, renewal.getDocusealSubmitterSlug()));
        }
        return response;
    }

    @Override
    @Transactional
    public VNPayPaymentResponse createRenewalPayment(UUID renewalId, HttpServletRequest httpRequest) {
        ContractRenewal renewal = contractRenewalRepository.findById(renewalId)
                .orElseThrow(() -> new AppException(ErrorCode.CONTRACT_RENEWAL_NOT_FOUND));

        if (renewal.getStatus() == ContractRenewalStatus.PENDING_REVIEW) {
            throw new AppException(ErrorCode.CONTRACT_RENEWAL_NOT_APPROVED);
        }

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

        if (renewal.getSignedAt() == null) {
            renewal.setSignedAt(LocalDateTime.now());
        }
        renewal.setSignedDocumentUrl(documentUrl);

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

            sendCustomerRenewalNotification(
                    contract,
                    "Hợp đồng " + contract.getContractCode() + " đã được gia hạn thành công",
                    "Hợp đồng thuê kho #" + contract.getUnit().getUnitCode() + " đã được gia hạn thành công đến ngày " + renewal.getNewEndDate().format(DATE_FMT) + "."
            );
        } else {
            // Chờ thanh toán
            renewal.setStatus(ContractRenewalStatus.PENDING_PAYMENT);
            activityLogService.recordSystem(
                    renewal.getContract().getFacility().getId(),
                    ActivityAction.CONTRACT_SIGNED,
                    "ContractRenewal",
                    renewal.getId(),
                    "Phu luc gia han hop dong da duoc ky, cho thanh toan phi"
            );
        }

        contractRenewalRepository.save(renewal);
    }

    @Override
    @Transactional
    public void handleRenewalPaid(Payment payment) {
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
        if (renewal.getPaidAt() == null) {
            renewal.setPaidAt(LocalDateTime.now());
        }

        // Kiểm tra xem khách đã ký phụ lục gia hạn chưa
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

            sendCustomerRenewalNotification(
                    contract,
                    "Hợp đồng " + contract.getContractCode() + " đã được gia hạn thành công",
                    "Hợp đồng thuê kho #" + contract.getUnit().getUnitCode() + " đã được gia hạn thành công đến ngày " + renewal.getNewEndDate().format(DATE_FMT) + "."
            );
        } else {
            // Đã nộp tiền nhưng chưa ký -> Chờ ký
            renewal.setStatus(ContractRenewalStatus.PENDING_SIGNATURE);
            activityLogService.recordSystem(
                    renewal.getContract().getFacility().getId(),
                    ActivityAction.RENEWAL_PAID,
                    "ContractRenewal",
                    renewal.getId(),
                    "Phi gia han hop dong da thanh toan thanh cong, cho ky phu luc"
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
            res.setSigningUrl(signingUrl(renewal, renewal.getDocusealSubmitterSlug()));
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
                res.setSigningUrl(signingUrl(r, r.getDocusealSubmitterSlug()));
            }
            return res;
        }).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<ContractRenewalResponse> getAllRenewals(int page, int size, String sortBy, String sortDir) {
        return getAllRenewals(null, null, null, null, null, null, page, size, sortBy, sortDir);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<ContractRenewalResponse> getAllRenewals(
            UUID contractId, UUID facilityId, ContractRenewalStatus status,
            int page, int size, String sortBy, String sortDir) {
        return getAllRenewals(contractId, facilityId, status, null, null, null, page, size, sortBy, sortDir);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<ContractRenewalResponse> getAllRenewals(
            UUID contractId, UUID facilityId, ContractRenewalStatus status,
            String search, LocalDate fromDate, LocalDate toDate,
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
        final String searchPattern = (search != null && !search.trim().isEmpty())
                ? "%" + search.trim().toLowerCase() + "%" : null;

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
            if (fromDate != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), fromDate.atStartOfDay()));
            }
            if (toDate != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("createdAt"), toDate.atTime(23, 59, 59)));
            }
            if (searchPattern != null) {
                Predicate pContractCode = cb.like(cb.lower(root.get("contract").get("contractCode")), searchPattern);
                Predicate pUnitCode = cb.like(cb.lower(root.get("contract").get("unit").get("unitCode")), searchPattern);
                Predicate pCustomerName = cb.like(cb.lower(root.get("contract").get("customer").get("fullName")), searchPattern);
                Predicate pCustomerEmail = cb.like(cb.lower(root.get("contract").get("customer").get("email")), searchPattern);
                Predicate pReceipt = cb.like(cb.lower(root.get("receiptVoucherCode")), searchPattern);
                predicates.add(cb.or(pContractCode, pUnitCode, pCustomerName, pCustomerEmail, pReceipt));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };

        Page<ContractRenewal> result = contractRenewalRepository.findAll(spec, pageable);
        return PageResponse.from(result.map(r -> {
            ContractRenewalResponse res = contractRenewalMapper.toResponse(r);
            if (r.getDocusealSubmitterSlug() != null) {
                res.setSigningUrl(signingUrl(r, r.getDocusealSubmitterSlug()));
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

        if (renewal.getStatus() == ContractRenewalStatus.PENDING_REVIEW) {
            throw new AppException(ErrorCode.CONTRACT_RENEWAL_NOT_APPROVED);
        }

        if (renewal.getDocusealSubmitterSlug() == null) {
            createDocusealSubmissionForRenewal(renewal);
        }

        if (renewal.getDocusealSubmitterSlug() != null) {
            return signingUrl(renewal, renewal.getDocusealSubmitterSlug());
        }

        if (renewal.getSignedDocumentUrl() != null) {
            return renewal.getSignedDocumentUrl();
        }

        throw new AppException(ErrorCode.CONTRACT_SIGNING_FAILED);
    }

    private String signingUrl(ContractRenewal renewal, String slug) {
        if (docuSealConfig.isMockActive() && slug != null && slug.startsWith("mock-")) {
            return frontendUrl + "/portal/customer?tab=contracts&mockSignRenewalId=" + renewal.getId();
        }
        return docuSealConfig.getWebBaseUrl() + "/s/" + slug;
    }

    private DocuSealSubmissionRequest.Field field(String name, String value) {
        return DocuSealSubmissionRequest.Field.builder()
                .name(name)
                .default_value(value != null ? value : "")
                .build();
    }

    private void sendCustomerRenewalNotification(RentalContract contract, String title, String content) {
        sendCustomerRenewalNotification(contract, title, content, NotificationType.RENEWAL_REMINDER_3D);
    }

    private void sendCustomerRenewalNotification(RentalContract contract, String title, String content, NotificationType type) {
        try {
            User customer = contract.getCustomer();
            if (customer == null || customer.getEmail() == null) return;

            NotificationLog logEntry = NotificationLog.builder()
                    .recipient(customer)
                    .recipientEmail(customer.getEmail())
                    .recipientName(customer.getFullName() != null ? customer.getFullName() : customer.getUsername())
                    .facility(contract.getFacility())
                    .channel(NotificationChannel.EMAIL)
                    .notificationType(type != null ? type : NotificationType.RENEWAL_REMINDER_3D)
                    .referenceType("CONTRACT_RENEWAL")
                    .referenceId(contract.getId())
                    .title(title)
                    .content(content)
                    .status("SENT")
                    .retryCount(0)
                    .build();
            notificationLogRepository.save(logEntry);
        } catch (Exception ex) {
            log.warn("Failed to create renewal notification log: {}", ex.getMessage());
        }
    }

    private void sendStaffNotification(User staff, Facility facility, String title, String content, NotificationType type, UUID referenceId) {
        try {
            if (staff == null || staff.getEmail() == null) return;

            NotificationLog logEntry = NotificationLog.builder()
                    .recipient(staff)
                    .recipientEmail(staff.getEmail())
                    .recipientName(staff.getFullName() != null ? staff.getFullName() : staff.getUsername())
                    .facility(facility)
                    .channel(NotificationChannel.EMAIL)
                    .notificationType(type != null ? type : NotificationType.RENEWAL_REMINDER_3D)
                    .referenceType("CONTRACT_RENEWAL")
                    .referenceId(referenceId)
                    .title(title)
                    .content(content)
                    .status("SENT")
                    .retryCount(0)
                    .build();
            notificationLogRepository.save(logEntry);
        } catch (Exception ex) {
            log.warn("Failed to create staff notification log: {}", ex.getMessage());
        }
    }
}

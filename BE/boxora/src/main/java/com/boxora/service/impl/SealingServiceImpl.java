package com.boxora.service.impl;

import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.SealingCreateRequest;
import com.boxora.dto.request.SealingUnsealRequest;
import com.boxora.dto.response.AccessRestorationResponse;
import com.boxora.dto.response.SealingRecordResponse;
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
import com.boxora.repository.UserRepository;
import com.boxora.security.FacilityAccessGuard;
import com.boxora.security.RequestContext;
import com.boxora.service.ActivityLogService;
import com.boxora.service.OverdueFeeCalculator;
import com.boxora.service.OverdueFeeCalculator.OverdueAssessment;
import com.boxora.service.OverdueFeeCalculator.OverduePolicy;
import com.boxora.service.OverdueFeeCalculator.Stage;
import com.boxora.service.SealingService;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static com.boxora.service.impl.OverdueNotificationSender.date;
import static com.boxora.service.impl.OverdueNotificationSender.money;

@Service
@RequiredArgsConstructor
@Slf4j
public class SealingServiceImpl implements SealingService {

    private static final Set<String> WITNESS_ROLES = Set.of("STAFF", "FACILITY_MANAGER");
    private static final Set<RentalContractStatus> SEALABLE_CONTRACT_STATUSES =
            EnumSet.of(RentalContractStatus.ACTIVE, RentalContractStatus.OVERDUE);
    private static final Set<RentalContractStatus> RESTORABLE_CONTRACT_STATUSES =
            EnumSet.of(RentalContractStatus.ACTIVE, RentalContractStatus.OVERDUE, RentalContractStatus.OVERDUE_LOCKED);
    private static final String ALPHANUM = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final DateTimeFormatter COMPACT_DATE = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final DateTimeFormatter VN_DATE_TIME = DateTimeFormatter.ofPattern("HH:mm dd/MM/yyyy");

    private final SealingRecordRepository sealingRecordRepository;
    private final RentalContractRepository rentalContractRepository;
    private final StorageUnitRepository storageUnitRepository;
    private final BookingRepository bookingRepository;
    private final UserRepository userRepository;
    private final OverdueCaseRepository overdueCaseRepository;
    private final OverdueFeeCalculator overdueFeeCalculator;
    private final AccessRestorationServiceImpl accessRestorationService;
    private final OverdueNotificationSender notificationSender;
    private final ActivityLogService activityLogService;
    private final FacilityAccessGuard facilityAccessGuard;
    private final RequestContext requestContext;

    // =====================================================================================================
    // Seal
    // =====================================================================================================

    @Override
    @Transactional
    public SealingRecordResponse createSealing(SealingCreateRequest request) {
        RentalContract contract = resolveContract(request);
        StorageUnit unit = contract.getUnit();
        Facility facility = contract.getFacility();
        if (unit == null || facility == null) {
            throw new AppException(ErrorCode.SEALING_CONTRACT_REQUIRED);
        }
        checkFacility(facility.getId());

        if (sealingRecordRepository.existsByUnitIdAndStatus(unit.getId(), SealingStatus.SEALED)
                || sealingRecordRepository.existsByContractIdAndStatus(contract.getId(), SealingStatus.SEALED)) {
            throw new AppException(ErrorCode.UNIT_ALREADY_SEALED);
        }

        // Eligibility: the facility policy decides when a unit may be sealed.
        LocalDate today = LocalDate.now();
        OverduePolicy policy = overdueFeeCalculator.policyFor(contract);
        OverdueAssessment assessment = overdueFeeCalculator.assess(contract, today,
                overdueCaseRepository.sumOverdueCredits(contract), policy);
        if (!isSealable(contract) || assessment.daysOverdue() < 1) {
            throw new AppException(ErrorCode.OVERDUE_CONTRACT_NOT_OVERDUE,
                    "Hợp đồng " + contract.getContractCode() + " không quá hạn nên không thể niêm phong kho.");
        }
        if (assessment.stage() != Stage.ELIGIBLE_FOR_SEALING) {
            throw new AppException(ErrorCode.OVERDUE_ACTION_NOT_ELIGIBLE, String.format(
                    "Chỉ niêm phong được từ ngày quá hạn thứ %d theo chính sách của cơ sở (hiện quá hạn %d ngày).",
                    policy.sealingDays(), assessment.daysOverdue()));
        }
        Booking booking = contract.getBooking();
        if (booking != null && (booking.getStatus() == BookingStatus.CHECKOUT_REQUESTED || booking.getStatus() == BookingStatus.INSPECTED)) {
            throw new AppException(ErrorCode.OVERDUE_ACTION_NOT_ELIGIBLE,
                    "Khách đang làm thủ tục trả kho nên không niêm phong. Phí trễ hạn được tính khi quyết toán trả kho.");
        }

        // Two-person rule: the signed-in operator plus a witness of the same facility.
        User performer = currentUser();
        User witness = validateWitness(request.getWitnessId(), performer, facility);

        String sealTag = resolveSealTag(request.getSealTagNumber());
        String protocolNumber = newProtocolNumber(today);
        String reason = request.getReason() != null && !request.getReason().isBlank()
                ? request.getReason().trim()
                : String.format("Quá hạn thanh toán %d ngày, đã đến mốc niêm phong của cơ sở (từ ngày thứ %d)",
                assessment.daysOverdue(), policy.sealingDays());
        LocalDateTime now = LocalDateTime.now();

        SealingRecord record = sealingRecordRepository.save(SealingRecord.builder()
                .protocolNumber(protocolNumber)
                .contract(contract)
                .unit(unit)
                .facility(facility)
                .performedBy(performer)
                .witness(witness)
                .sealTagNumber(sealTag)
                .reason(reason)
                .overdueDays((long) assessment.daysOverdue())
                .totalDebtAmount(assessment.totalDebt())
                .inventorySummary(blankToNull(request.getInventorySummary()))
                .notes(blankToNull(request.getNotes()))
                .evidenceUrls(blankToNull(request.getEvidenceUrls()))
                .status(SealingStatus.SEALED)
                .sealedAt(now)
                .build());

        // Sealing always revokes the tenant credentials and locks unit + contract.
        if (booking != null) {
            if (booking.getStatus() == BookingStatus.ACTIVE) {
                booking.setStatus(BookingStatus.OVERDUE);
            }
            booking.setAccessPin(null);
            booking.setQrAccessToken(OverdueProcessingServiceImpl.REVOKED_OVERDUE);
            booking.setPinUpdatedAt(now);
            bookingRepository.save(booking);
        }
        UnitStatus previousUnitStatus = unit.getStatus();
        unit.setStatus(UnitStatus.OVERDUE_LOCKED);
        storageUnitRepository.save(unit);
        contract.setStatus(RentalContractStatus.OVERDUE_LOCKED);
        rentalContractRepository.save(contract);

        OverdueCase overdueCase = overdueCaseRepository.findFirstByContract_IdAndStatus(contract.getId(), OverdueCaseStatus.OPEN)
                .orElseGet(() -> OverdueCase.builder().contract(contract).facility(facility).dueDate(contract.getEndDate()).build());
        if (overdueCase.getAccessLockedAt() == null) {
            overdueCase.setAccessLockedAt(now);
        }
        overdueCase.setAccessHoldUntil(null);
        overdueCase.setDaysOverdue(assessment.daysOverdue());
        overdueCase.setGraceDays(policy.graceDays());
        overdueCase.setDailyLateFee(policy.dailyLateFee());
        overdueCase.setLateFeeAmount(assessment.lateFee());
        overdueCase.setOverdueRentAmount(assessment.overdueRent());
        overdueCase.setLastAssessedOn(today);
        overdueCaseRepository.save(overdueCase);

        activityLogService.record(facility.getId(), ActivityAction.OVERDUE_UNIT_LOCKED, "SealingRecord", record.getId(),
                String.format("Niêm phong kho %s theo hợp đồng %s, biên bản %s, tem %s. Người lập: %s, người chứng kiến: %s. "
                                + "Đã thu hồi mã PIN/QR của khách.",
                        unit.getUnitCode(), contract.getContractCode(), protocolNumber, sealTag,
                        OverdueNotificationSender.displayName(performer), OverdueNotificationSender.displayName(witness)),
                previousUnitStatus != null ? previousUnitStatus.name() : null, UnitStatus.OVERDUE_LOCKED.name());

        // Notice to the tenant: reported honestly, never blocks the sealing itself.
        User customer = contract.getCustomer();
        String html = notificationSender.render("Thông báo niêm phong kho " + unit.getUnitCode(),
                "Xin chào " + OverdueNotificationSender.displayName(customer)
                        + ", kho bạn thuê đã được niêm phong do hợp đồng quá hạn thanh toán.",
                List.of(
                        Map.entry("Số biên bản", protocolNumber),
                        Map.entry("Số tem niêm phong", sealTag),
                        Map.entry("Kho", unit.getUnitCode()),
                        Map.entry("Hợp đồng", contract.getContractCode()),
                        Map.entry("Cơ sở", facility.getName()),
                        Map.entry("Thời điểm niêm phong", now.format(VN_DATE_TIME)),
                        Map.entry("Số ngày quá hạn", assessment.daysOverdue() + " ngày"),
                        Map.entry("Tổng cần thanh toán", money(assessment.totalDebt())),
                        Map.entry("Lý do", reason)),
                List.of("Mã PIN/QR mở kho đã bị thu hồi. Tài sản bên trong được giữ nguyên trạng.",
                        "Kho sẽ được gỡ niêm phong có người chứng kiến sau khi bạn gia hạn hoặc thanh toán đủ công nợ.",
                        OverdueNotificationSender.facilityContact(facility)));
        OverdueNotificationSender.Outcome outcome = notificationSender.send(customer, facility, NotificationType.SEALING_NOTICE,
                "SealingRecord", record.getId(), "[Boxora] Thông báo niêm phong kho " + unit.getUnitCode(),
                "Kho " + unit.getUnitCode() + " đã được niêm phong, biên bản " + protocolNumber + ".", html);

        SealingRecordResponse response = toResponse(record);
        response.setCustomerNotified(outcome.sent());
        response.setNotificationMessage(outcome.sent()
                ? "Đã gửi email thông báo tới " + outcome.recipientEmail() + "."
                : "Chưa gửi được email thông báo cho khách: " + outcome.error() + ". Hãy liên hệ khách qua điện thoại.");
        return response;
    }

    private RentalContract resolveContract(SealingCreateRequest request) {
        if (request.getContractId() != null) {
            RentalContract contract = rentalContractRepository.findById(request.getContractId())
                    .orElseThrow(() -> new AppException(ErrorCode.CONTRACT_NOT_FOUND, "Không tìm thấy hợp đồng thuê"));
            if (request.getUnitId() != null && contract.getUnit() != null && !request.getUnitId().equals(contract.getUnit().getId())) {
                throw new AppException(ErrorCode.INVALID_REQUEST, "Kho được chọn không thuộc hợp đồng này");
            }
            return contract;
        }
        if (request.getUnitId() != null) {
            StorageUnit unit = storageUnitRepository.findById(request.getUnitId())
                    .orElseThrow(() -> new AppException(ErrorCode.STORAGE_UNIT_NOT_FOUND, "Không tìm thấy kho"));
            return rentalContractRepository.findFirstByUnit_IdOrderByCreatedAtDesc(unit.getId())
                    .filter(SealingServiceImpl::isSealable)
                    .orElseThrow(() -> new AppException(ErrorCode.SEALING_CONTRACT_REQUIRED));
        }
        throw new AppException(ErrorCode.INVALID_REQUEST, "Vui lòng chọn hợp đồng hoặc kho cần niêm phong");
    }

    /** ACTIVE or OVERDUE contracts, and EXPIRED ones whose tenant never returned the unit. */
    private static boolean isSealable(RentalContract contract) {
        return SEALABLE_CONTRACT_STATUSES.contains(contract.getStatus()) || AccessRestorationServiceImpl.isHeldAfterExpiry(contract);
    }

    private User validateWitness(UUID witnessId, User performer, Facility facility) {
        if (witnessId == null) {
            throw new AppException(ErrorCode.SEALING_WITNESS_INVALID, "Vui lòng chọn người chứng kiến tại hiện trường");
        }
        User witness = userRepository.findById(witnessId)
                .orElseThrow(() -> new AppException(ErrorCode.SEALING_WITNESS_INVALID, "Không tìm thấy người chứng kiến đã chọn"));
        String role = witness.getRole() != null ? witness.getRole().getName() : null;
        boolean sameFacility = witness.getFacility() != null && facility.getId().equals(witness.getFacility().getId());
        if (witness.getId().equals(performer.getId())) {
            throw new AppException(ErrorCode.SEALING_WITNESS_INVALID, "Người chứng kiến phải khác người lập biên bản");
        }
        if (!Boolean.TRUE.equals(witness.getIsActive()) || role == null || !WITNESS_ROLES.contains(role) || !sameFacility) {
            throw new AppException(ErrorCode.SEALING_WITNESS_INVALID);
        }
        return witness;
    }

    private String resolveSealTag(String requested) {
        if (requested != null && !requested.isBlank()) {
            String tag = requested.trim();
            if (sealingRecordRepository.existsBySealTagNumberIgnoreCase(tag)) {
                throw new AppException(ErrorCode.SEAL_TAG_ALREADY_USED);
            }
            return tag;
        }
        for (int i = 0; i < 10; i++) {
            String tag = "TEM-" + LocalDate.now().format(COMPACT_DATE).substring(2) + "-" + random(5);
            if (!sealingRecordRepository.existsBySealTagNumberIgnoreCase(tag)) {
                return tag;
            }
        }
        throw new AppException(ErrorCode.INTERNAL_SERVER_ERROR, "Không cấp được số tem niêm phong. Vui lòng nhập số tem.");
    }

    private String newProtocolNumber(LocalDate today) {
        for (int i = 0; i < 10; i++) {
            String number = "BBNP-" + today.format(COMPACT_DATE) + "-" + random(6);
            if (!sealingRecordRepository.existsByProtocolNumber(number)) {
                return number;
            }
        }
        throw new AppException(ErrorCode.INTERNAL_SERVER_ERROR, "Không cấp được số biên bản. Vui lòng thử lại.");
    }

    // =====================================================================================================
    // Unseal
    // =====================================================================================================

    @Override
    @Transactional
    public SealingRecordResponse unseal(UUID sealingId, SealingUnsealRequest request) {
        SealingRecord record = sealingRecordRepository.findById(sealingId)
                .orElseThrow(() -> new AppException(ErrorCode.SEALING_RECORD_NOT_FOUND, "Không tìm thấy biên bản niêm phong"));
        if (record.getStatus() != SealingStatus.SEALED) {
            throw new AppException(ErrorCode.UNIT_NOT_SEALED);
        }
        Facility facility = record.getFacility();
        if (facility != null) {
            checkFacility(facility.getId());
        }
        User actor = currentUser();
        String reason = request.getReason().trim();
        LocalDateTime now = LocalDateTime.now();

        record.setStatus(SealingStatus.UNSEALED);
        record.setUnsealedAt(now);
        record.setUnsealedBy(actor);
        record.setUnsealReason(reason);
        if (request.getNotes() != null && !request.getNotes().isBlank()) {
            record.setNotes((record.getNotes() != null ? record.getNotes() + "\n" : "") + "Ghi chú khi gỡ niêm phong: " + request.getNotes().trim());
        }
        record = sealingRecordRepository.saveAndFlush(record);

        StorageUnit unit = record.getUnit();
        RentalContract contract = record.getContract();
        AccessRestorationResponse restoration = null;
        if (contract != null && RESTORABLE_CONTRACT_STATUSES.contains(contract.getStatus())) {
            // Goods are still inside: the unit is never released to AVAILABLE here, only the tenant access reopens.
            restoration = accessRestorationService.restoreAfterUnseal(contract,
                    "Gỡ niêm phong biên bản " + record.getProtocolNumber() + ": " + reason, request.getHoldUntil());
        }

        activityLogService.record(facility != null ? facility.getId() : null, ActivityAction.STORAGE_UNIT_STATUS_CHANGE,
                "SealingRecord", record.getId(),
                String.format("Gỡ niêm phong kho %s (biên bản %s, tem %s). Người thực hiện: %s. Lý do: %s",
                        unit != null ? unit.getUnitCode() : "—", record.getProtocolNumber(), record.getSealTagNumber(),
                        OverdueNotificationSender.displayName(actor), reason),
                SealingStatus.SEALED.name(), SealingStatus.UNSEALED.name());

        User customer = contract != null ? contract.getCustomer() : null;
        List<String> closing = new ArrayList<>();
        if (restoration != null && restoration.isSettled()) {
            closing.add("Quyền truy cập kho đã được mở lại. Mã PIN mới hiển thị trong mục Mã truy cập của cổng khách hàng Boxora.");
        } else if (restoration != null && restoration.getAccessHoldUntil() != null) {
            closing.add("Quyền truy cập kho được mở lại đến ngày " + date(restoration.getAccessHoldUntil())
                    + ". Hợp đồng vẫn quá hạn; vui lòng gia hạn hoặc thanh toán đủ trước ngày này.");
        }
        closing.add(OverdueNotificationSender.facilityContact(facility));
        String unitCode = unit != null ? unit.getUnitCode() : "—";
        String html = notificationSender.render("Thông báo gỡ niêm phong kho " + unitCode,
                "Xin chào " + OverdueNotificationSender.displayName(customer) + ", kho bạn thuê đã được gỡ niêm phong.",
                List.of(
                        Map.entry("Số biên bản", record.getProtocolNumber() != null ? record.getProtocolNumber() : "—"),
                        Map.entry("Kho", unitCode),
                        Map.entry("Hợp đồng", contract != null ? contract.getContractCode() : "—"),
                        Map.entry("Thời điểm gỡ niêm phong", now.format(VN_DATE_TIME)),
                        Map.entry("Người thực hiện", OverdueNotificationSender.displayName(actor)),
                        Map.entry("Lý do", reason)),
                closing);
        OverdueNotificationSender.Outcome outcome = customer == null
                ? new OverdueNotificationSender.Outcome(false, null, "Biên bản không gắn với khách thuê")
                : notificationSender.send(customer, facility, NotificationType.UNSEALING_NOTICE, "SealingRecord", record.getId(),
                "[Boxora] Thông báo gỡ niêm phong kho " + unitCode, "Kho " + unitCode + " đã được gỡ niêm phong.", html);

        SealingRecordResponse response = toResponse(record);
        response.setAccessRestoration(restoration);
        response.setCustomerNotified(outcome.sent());
        response.setNotificationMessage(outcome.sent()
                ? "Đã gửi email thông báo tới " + outcome.recipientEmail() + "."
                : "Chưa gửi được email thông báo cho khách: " + outcome.error() + ".");
        return response;
    }

    // =====================================================================================================
    // Read
    // =====================================================================================================

    @Override
    @Transactional(readOnly = true)
    public SealingRecordResponse getById(UUID sealingId) {
        SealingRecord record = sealingRecordRepository.findById(sealingId)
                .orElseThrow(() -> new AppException(ErrorCode.SEALING_RECORD_NOT_FOUND, "Không tìm thấy biên bản niêm phong"));
        if (record.getFacility() != null) {
            checkFacility(record.getFacility().getId());
        }
        return toResponse(record);
    }

    @Override
    @Transactional(readOnly = true)
    public SealingRecordResponse getActiveSealingByContractId(UUID contractId) {
        RentalContract contract = rentalContractRepository.findById(contractId)
                .orElseThrow(() -> new AppException(ErrorCode.CONTRACT_NOT_FOUND, "Không tìm thấy hợp đồng thuê"));
        if ("CUSTOMER".equalsIgnoreCase(requestContext.currentUserRole())) {
            UUID me = requestContext.currentUserId();
            if (me == null || contract.getCustomer() == null || !me.equals(contract.getCustomer().getId())) {
                throw new AppException(ErrorCode.CONTRACT_NOT_FOUND, "Không tìm thấy hợp đồng thuê");
            }
        } else if (contract.getFacility() != null) {
            checkFacility(contract.getFacility().getId());
        }
        return sealingRecordRepository.findFirstByContract_IdAndStatusOrderBySealedAtDesc(contractId, SealingStatus.SEALED)
                .map(this::toResponse)
                .orElse(null);
    }

    @Override
    @Transactional(readOnly = true)
    public SealingRecordResponse getActiveSealingByUnitId(UUID unitId) {
        StorageUnit unit = storageUnitRepository.findById(unitId)
                .orElseThrow(() -> new AppException(ErrorCode.STORAGE_UNIT_NOT_FOUND, "Không tìm thấy kho"));
        if (unit.getFacility() != null) {
            checkFacility(unit.getFacility().getId());
        }
        return sealingRecordRepository.findFirstByStorageUnit_IdAndStatusOrderBySealedAtDesc(unitId, SealingStatus.SEALED)
                .map(this::toResponse)
                .orElse(null);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<SealingRecordResponse> getAll(UUID facilityId, SealingStatus status, int page, int size) {
        UUID scope = facilityId;
        if (facilityAccessGuard.isFacilityScoped()) {
            UUID own = requestContext.currentUserFacilityId();
            if (own == null || (facilityId != null && !facilityId.equals(own))) {
                throw new AppException(ErrorCode.FACILITY_ACCESS_DENIED);
            }
            scope = own;
        }
        final UUID queryFacilityId = scope;
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 100),
                Sort.by(Sort.Direction.DESC, "sealedAt"));

        Specification<SealingRecord> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (queryFacilityId != null) {
                predicates.add(cb.equal(root.get("facility").get("id"), queryFacilityId));
            }
            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };

        Page<SealingRecord> pageResult = sealingRecordRepository.findAll(spec, pageable);
        return PageResponse.from(pageResult.map(this::toResponse));
    }

    // =====================================================================================================
    // Helpers
    // =====================================================================================================

    private void checkFacility(UUID facilityId) {
        if (facilityAccessGuard.isFacilityScoped() && requestContext.currentUserFacilityId() == null) {
            throw new AppException(ErrorCode.FACILITY_ACCESS_DENIED);
        }
        facilityAccessGuard.checkFacilityAccess(facilityId);
    }

    private User currentUser() {
        UUID id = requestContext.currentUserId();
        return id == null ? throwUnauthorized() : userRepository.findById(id).orElseGet(this::throwUnauthorized);
    }

    private User throwUnauthorized() {
        throw new AppException(ErrorCode.UNAUTHORIZED);
    }

    private static String random(int length) {
        StringBuilder sb = new StringBuilder(length);
        for (int i = 0; i < length; i++) {
            sb.append(ALPHANUM.charAt(RANDOM.nextInt(ALPHANUM.length())));
        }
        return sb.toString();
    }

    private static String blankToNull(String value) {
        return value != null && !value.isBlank() ? value.trim() : null;
    }

    private static String roleOf(User user) {
        return user != null && user.getRole() != null ? user.getRole().getName() : null;
    }

    SealingRecordResponse toResponse(SealingRecord r) {
        StorageUnit unit = r.getUnit();
        RentalContract contract = r.getContract();
        User customer = contract != null ? contract.getCustomer() : null;
        Facility facility = r.getFacility();
        User performer = r.getPerformedBy();
        User witness = r.getWitness();
        UUID unitId = unit != null ? unit.getId() : null;
        UUID performerId = performer != null ? performer.getId() : null;
        String performerName = OverdueNotificationSender.displayName(performer);

        return SealingRecordResponse.builder()
                .id(r.getId())
                .protocolNumber(r.getProtocolNumber())
                .contractId(contract != null ? contract.getId() : null)
                .contractCode(contract != null ? contract.getContractCode() : null)
                .contractStartDate(contract != null ? contract.getStartDate() : null)
                .contractEndDate(contract != null ? contract.getEndDate() : null)
                .storageUnitId(unitId)
                .unitId(unitId)
                .unitCode(unit != null ? unit.getUnitCode() : null)
                .facilityId(facility != null ? facility.getId() : null)
                .facilityName(facility != null ? facility.getName() : null)
                .facilityAddress(facility != null ? facility.getAddress() : null)
                .facilityPhone(facility != null ? facility.getContactPhone() : null)
                .customerId(customer != null ? customer.getId() : null)
                .customerName(OverdueNotificationSender.displayName(customer))
                .customerEmail(customer != null ? customer.getEmail() : null)
                .customerPhone(customer != null ? customer.getPhone() : null)
                .sealedById(performerId)
                .sealedByName(performerName)
                .sealedByRole(roleOf(performer))
                .performedById(performerId)
                .performedByName(performerName)
                .witnessId(witness != null ? witness.getId() : null)
                .witnessName(OverdueNotificationSender.displayName(witness))
                .witnessRole(roleOf(witness))
                .sealTagNumber(r.getSealTagNumber())
                .reason(r.getReason())
                .overdueDays(r.getOverdueDays())
                .totalDebtAmount(r.getTotalDebtAmount())
                .inventorySummary(r.getInventorySummary())
                .notes(r.getNotes())
                .evidenceUrls(r.getEvidenceUrls())
                .photoEvidenceUrl(r.getPhotoEvidenceUrl())
                .status(r.getStatus())
                .sealedAt(r.getSealedAt())
                .unsealedAt(r.getUnsealedAt())
                .unsealedById(r.getUnsealedBy() != null ? r.getUnsealedBy().getId() : null)
                .unsealedByName(OverdueNotificationSender.displayName(r.getUnsealedBy()))
                .unsealReason(r.getUnsealReason())
                .createdAt(r.getCreatedAt())
                .updatedAt(r.getUpdatedAt())
                .build();
    }
}

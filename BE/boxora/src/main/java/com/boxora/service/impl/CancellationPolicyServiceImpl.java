package com.boxora.service.impl;

import com.boxora.dto.request.PolicyConfirmationRequest;
import com.boxora.dto.response.CancellationPolicyDetailResponse;
import com.boxora.dto.response.PolicyConfirmationResponse;
import com.boxora.dto.response.PolicyConfirmationStatusResponse;
import com.boxora.entity.Booking;
import com.boxora.entity.BookingPolicyConfirmation;
import com.boxora.entity.Facility;
import com.boxora.entity.FacilityPolicy;
import com.boxora.enums.BookingStatus;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.repository.BookingPolicyConfirmationRepository;
import com.boxora.repository.BookingRepository;
import com.boxora.repository.FacilityPolicyRepository;
import com.boxora.repository.FacilityRepository;
import com.boxora.security.RequestContext;
import com.boxora.service.CancellationPolicyService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class CancellationPolicyServiceImpl implements CancellationPolicyService {

    private final FacilityRepository facilityRepository;
    private final FacilityPolicyRepository facilityPolicyRepository;
    private final BookingRepository bookingRepository;
    private final BookingPolicyConfirmationRepository confirmationRepository;
    private final RequestContext requestContext;

    @Override
    @Transactional(readOnly = true)
    public CancellationPolicyDetailResponse getPolicyDetailByFacilityId(UUID facilityId) {
        if (facilityId == null) {
            throw new AppException(ErrorCode.FACILITY_NOT_FOUND);
        }

        Facility facility = facilityRepository.findById(facilityId)
                .orElseThrow(() -> new AppException(ErrorCode.FACILITY_NOT_FOUND));

        Optional<FacilityPolicy> policyOpt = facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(facilityId);

        if (policyOpt.isEmpty()) {
            return CancellationPolicyDetailResponse.builder()
                    .facilityId(facility.getId())
                    .facilityName(facility.getName())
                    .policyVersion(null)
                    .isConfigured(false)
                    .policySummaryText("Cơ sở hiện chưa được thiết lập chính sách hủy hợp đồng & hoàn tiền đầy đủ.")
                    .build();
        }

        FacilityPolicy policy = policyOpt.get();
        String version = policy.getEffectiveVersion();

        return CancellationPolicyDetailResponse.builder()
                .facilityId(facility.getId())
                .facilityName(facility.getName())
                .policyVersion(version)
                .isConfigured(true)
                .cancellationFullRefundHours(policy.getCancellationFullRefundHours())
                .cancellationPartialRefundHours(policy.getCancellationPartialRefundHours())
                .cancellationPartialRefundPercent(policy.getCancellationPartialRefundPercent())
                .returnNoticeDays(policy.getReturnNoticeDays())
                .depositRefundSlaDays(policy.getDepositRefundSlaDays())
                .holdGraceHours(policy.getHoldGraceHours())
                .depositPercentage(policy.getDepositPercentage())
                .policySummaryText(buildPolicySummaryText(policy))
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public CancellationPolicyDetailResponse getPolicyDetailByBookingId(UUID bookingId) {
        if (bookingId == null) {
            throw new AppException(ErrorCode.BOOKING_NOT_FOUND);
        }

        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        validateBookingAccess(booking);

        if (booking.getFacility() == null) {
            throw new AppException(ErrorCode.FACILITY_NOT_FOUND);
        }

        return getPolicyDetailByFacilityId(booking.getFacility().getId());
    }

    @Override
    public PolicyConfirmationResponse confirmPolicy(PolicyConfirmationRequest request, HttpServletRequest httpRequest) {
        if (request == null || request.getBookingId() == null || request.getFacilityId() == null) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Thông tin xác nhận điều khoản không hợp lệ");
        }

        if (Boolean.FALSE.equals(request.getAgreed())) {
            throw new AppException(ErrorCode.POLICY_CONFIRMATION_REQUIRED);
        }

        Booking booking = bookingRepository.findById(request.getBookingId())
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        validateBookingAccess(booking);

        // Kiểm tra tính hợp lệ của đơn đặt kho
        if (booking.getStatus() == BookingStatus.CANCELLED
                || booking.getStatus() == BookingStatus.COMPLETED
                || booking.getStatus() == BookingStatus.OVERDUE) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Đơn đặt kho đã kết thúc hoặc không còn hợp lệ để xác nhận điều khoản");
        }

        // Kiểm tra khớp cơ sở
        if (booking.getFacility() == null || !booking.getFacility().getId().equals(request.getFacilityId())) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Cơ sở xác nhận không khớp với thông tin đơn đặt kho");
        }

        // Kiểm tra chính sách cơ sở đang kích hoạt
        FacilityPolicy policy = facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(request.getFacilityId())
                .orElseThrow(() -> new AppException(ErrorCode.POLICY_NOT_CONFIGURED));

        String currentVersion = policy.getEffectiveVersion();
        if (!currentVersion.equalsIgnoreCase(request.getPolicyVersion())) {
            throw new AppException(ErrorCode.POLICY_VERSION_MISMATCH);
        }

        // Idempotency: Kiểm tra nếu khách hàng đã xác nhận đúng phiên bản này trước đó -> tái sử dụng, không tạo bản ghi trùng
        Optional<BookingPolicyConfirmation> existingOpt = confirmationRepository
                .findByBooking_IdAndPolicyVersion(booking.getId(), currentVersion);

        if (existingOpt.isPresent()) {
            BookingPolicyConfirmation existing = existingOpt.get();
            // Đảm bảo cờ trên booking đồng bộ
            if (!Boolean.TRUE.equals(booking.getPolicyConfirmed())) {
                booking.setPolicyConfirmed(true);
                booking.setPolicyConfirmedAt(existing.getConfirmedAt());
                booking.setPolicyVersion(currentVersion);
                bookingRepository.save(booking);
            }

            return PolicyConfirmationResponse.builder()
                    .confirmationId(existing.getId())
                    .bookingId(booking.getId())
                    .customerId(booking.getCustomer().getId())
                    .policyVersion(existing.getPolicyVersion())
                    .confirmedAt(existing.getConfirmedAt())
                    .status("POLICY_CONFIRMED")
                    .message("Khách hàng đã xác nhận điều khoản hủy hợp đồng & hoàn tiền thành công")
                    .build();
        }

        String clientIp = resolveClientIp(httpRequest);
        String userAgent = httpRequest != null ? httpRequest.getHeader("User-Agent") : null;
        LocalDateTime now = LocalDateTime.now();

        String snapshot = buildPolicySnapshot(policy, booking);

        BookingPolicyConfirmation confirmation = BookingPolicyConfirmation.builder()
                .booking(booking)
                .customer(booking.getCustomer())
                .facility(booking.getFacility())
                .policyVersion(currentVersion)
                .confirmedAt(now)
                .ipAddress(clientIp)
                .userAgent(userAgent)
                .policyContentSnapshot(snapshot)
                .status("POLICY_CONFIRMED")
                .build();

        BookingPolicyConfirmation saved = confirmationRepository.save(confirmation);

        // Lưu thông tin xác nhận vào booking
        booking.setPolicyConfirmed(true);
        booking.setPolicyConfirmedAt(now);
        booking.setPolicyVersion(currentVersion);
        bookingRepository.save(booking);

        log.info("Policy confirmation saved for booking {} (code={}) by customer {} with policy version {}",
                booking.getId(), booking.getBookingCode(), booking.getCustomer().getId(), currentVersion);

        return PolicyConfirmationResponse.builder()
                .confirmationId(saved.getId())
                .bookingId(booking.getId())
                .customerId(booking.getCustomer().getId())
                .policyVersion(saved.getPolicyVersion())
                .confirmedAt(saved.getConfirmedAt())
                .status("POLICY_CONFIRMED")
                .message("Xác nhận điều khoản hủy hợp đồng & hoàn tiền thành công")
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public PolicyConfirmationStatusResponse getConfirmationStatus(UUID bookingId) {
        if (bookingId == null) {
            throw new AppException(ErrorCode.BOOKING_NOT_FOUND);
        }

        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        validateBookingAccess(booking);

        String currentActiveVersion = null;
        if (booking.getFacility() != null) {
            currentActiveVersion = facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(booking.getFacility().getId())
                    .map(FacilityPolicy::getEffectiveVersion)
                    .orElse(null);
        }

        Optional<BookingPolicyConfirmation> latestOpt = confirmationRepository
                .findTopByBooking_IdOrderByConfirmedAtDesc(booking.getId());

        if (latestOpt.isEmpty() || !Boolean.TRUE.equals(booking.getPolicyConfirmed())) {
            return PolicyConfirmationStatusResponse.builder()
                    .bookingId(booking.getId())
                    .policyConfirmed(false)
                    .policyVersion(null)
                    .currentActivePolicyVersion(currentActiveVersion)
                    .confirmedAt(null)
                    .status("POLICY_NOT_CONFIRMED")
                    .isLatestPolicy(false)
                    .build();
        }

        BookingPolicyConfirmation latest = latestOpt.get();
        boolean isLatest = currentActiveVersion != null && currentActiveVersion.equalsIgnoreCase(latest.getPolicyVersion());

        return PolicyConfirmationStatusResponse.builder()
                .bookingId(booking.getId())
                .policyConfirmed(isLatest)
                .policyVersion(latest.getPolicyVersion())
                .currentActivePolicyVersion(currentActiveVersion)
                .confirmedAt(latest.getConfirmedAt())
                .status(isLatest ? "POLICY_CONFIRMED" : "POLICY_VERSION_OUTDATED")
                .isLatestPolicy(isLatest)
                .build();
    }

    private void validateBookingAccess(Booking booking) {
        UUID currentUserId = requestContext.currentUserId();
        String currentRole = requestContext.currentUserRole();

        if (currentUserId == null) {
            return;
        }

        if ("CUSTOMER".equalsIgnoreCase(currentRole)) {
            if (booking.getCustomer() == null || !currentUserId.equals(booking.getCustomer().getId())) {
                throw new AppException(ErrorCode.FORBIDDEN);
            }
        }
    }

    private String resolveClientIp(HttpServletRequest request) {
        if (request == null) return "UNKNOWN";
        String xf = request.getHeader("X-Forwarded-For");
        if (xf != null && !xf.isBlank()) {
            return xf.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private String buildPolicySummaryText(FacilityPolicy policy) {
        int fullHours = policy.getCancellationFullRefundHours() != null ? policy.getCancellationFullRefundHours() : 24;
        int partialHours = policy.getCancellationPartialRefundHours() != null ? policy.getCancellationPartialRefundHours() : 48;
        double partialPercent = policy.getCancellationPartialRefundPercent() != null ? policy.getCancellationPartialRefundPercent() : 70.0;
        int slaDays = policy.getDepositRefundSlaDays() != null ? policy.getDepositRefundSlaDays() : 5;
        int noticeDays = policy.getReturnNoticeDays() != null ? policy.getReturnNoticeDays() : 0;

        return String.format(
                "Chính sách hủy: Hoàn 100%% tiền cọc trong vòng %d giờ kể từ khi đặt kho; hoàn %.0f%% trong vòng %d giờ; thông báo trả kho trước %d ngày; xử lý hoàn tiền trong %d ngày làm việc.",
                fullHours, partialPercent, partialHours, noticeDays, slaDays
        );
    }

    private String buildPolicySnapshot(FacilityPolicy policy, Booking booking) {
        return String.format(
                "{\"facilityId\":\"%s\",\"facilityName\":\"%s\",\"policyVersion\":\"%s\",\"cancellationFullRefundHours\":%d,\"cancellationPartialRefundHours\":%d,\"cancellationPartialRefundPercent\":%.1f,\"depositRefundSlaDays\":%d,\"returnNoticeDays\":%d,\"bookingCode\":\"%s\",\"totalRentalFee\":\"%s\",\"depositAmount\":\"%s\"}",
                policy.getFacility().getId(),
                policy.getFacility().getName(),
                policy.getEffectiveVersion(),
                policy.getCancellationFullRefundHours() != null ? policy.getCancellationFullRefundHours() : 24,
                policy.getCancellationPartialRefundHours() != null ? policy.getCancellationPartialRefundHours() : 48,
                policy.getCancellationPartialRefundPercent() != null ? policy.getCancellationPartialRefundPercent() : 70.0,
                policy.getDepositRefundSlaDays() != null ? policy.getDepositRefundSlaDays() : 5,
                policy.getReturnNoticeDays() != null ? policy.getReturnNoticeDays() : 0,
                booking.getBookingCode(),
                booking.getTotalRentalFee() != null ? booking.getTotalRentalFee().toPlainString() : "0",
                booking.getDepositAmount() != null ? booking.getDepositAmount().toPlainString() : "0"
        );
    }
}

package com.boxora.controller;

import com.boxora.common.response.ApiResponse;
import com.boxora.common.response.PageResponse;
import com.boxora.config.DocuSealConfig;
import com.boxora.dto.request.ContractCreateRequest;
import com.boxora.dto.request.ContractOtpVerifyRequest;
import com.boxora.dto.request.ContractRenewalCreateRequest;
import com.boxora.dto.response.ContractOtpResponse;
import com.boxora.dto.response.ContractRenewalResponse;
import com.boxora.dto.response.RentalContractResponse;
import com.boxora.dto.response.VNPayPaymentResponse;
import com.boxora.enums.RentalContractStatus;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.service.ContractOtpService;
import com.boxora.service.ContractRenewalService;
import com.boxora.service.ContractSigningService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("api/v1/contracts")
@Tag(name = "Contracts & Renewal", description = "API quản lý hợp đồng thuê, ký điện tử và gia hạn hợp đồng qua DocuSeal")
@RequiredArgsConstructor
@Slf4j
public class ContractSigningController {

    private final ContractSigningService contractSigningService;
    private final ContractOtpService contractOtpService;
    private final ContractRenewalService contractRenewalService;
    private final DocuSealConfig docuSealConfig;

    @PostMapping
    @PreAuthorize("hasAuthority('CONTRACT_CREATE')")
    @Operation(summary = "Tạo hợp đồng thuê mới")
    public ResponseEntity<ApiResponse<RentalContractResponse>> createContract(
            @Valid @RequestBody ContractCreateRequest request) {
        RentalContractResponse response = contractSigningService.createContract(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Tạo hợp đồng thành công", response));
    }

    @GetMapping("{contractId}")
    @PreAuthorize("hasAuthority('CONTRACT_VIEW') or hasRole('BUSINESS_MANAGER') or hasRole('FACILITY_MANAGER') or hasRole('FACILITY_STAFF') or hasRole('STAFF') or hasRole('CUSTOMER') or hasRole('ADMIN')")
    @Operation(summary = "Lấy thông tin chi tiết hợp đồng theo ID")
    public ResponseEntity<ApiResponse<RentalContractResponse>> getContractById(
            @PathVariable UUID contractId) {
        RentalContractResponse response = contractSigningService.getContractById(contractId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("booking/{bookingId}")
    @PreAuthorize("hasAuthority('CONTRACT_VIEW') or hasRole('BUSINESS_MANAGER') or hasRole('FACILITY_MANAGER') or hasRole('FACILITY_STAFF') or hasRole('STAFF') or hasRole('CUSTOMER') or hasRole('ADMIN')")
    @Operation(summary = "Lấy hợp đồng thuê theo Booking ID")
    public ResponseEntity<ApiResponse<RentalContractResponse>> getContractByBookingId(
            @PathVariable UUID bookingId) {
        RentalContractResponse response = contractSigningService.getContractByBookingId(bookingId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping
    @PreAuthorize("hasAuthority('CONTRACT_VIEW') or hasRole('BUSINESS_MANAGER') or hasRole('FACILITY_MANAGER') or hasRole('FACILITY_STAFF') or hasRole('STAFF') or hasRole('CUSTOMER') or hasRole('ADMIN')")
    @Operation(summary = "Lấy danh sách hợp đồng phân trang theo bộ lọc")
    public ResponseEntity<ApiResponse<PageResponse<RentalContractResponse>>> getAllContracts(
            @RequestParam(required = false) UUID customerId,
            @RequestParam(required = false) UUID facilityId,
            @RequestParam(required = false) RentalContractStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir) {
        PageResponse<RentalContractResponse> response = contractSigningService.getAllContracts(
                customerId, facilityId, status, page, size, sortBy, sortDir);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping("{contractId}/send-for-signature")
    @PreAuthorize("hasAuthority('CONTRACT_CREATE') or hasRole('CUSTOMER')")
    @Operation(summary = "Gửi hợp đồng sang DocuSeal để khách ký, trả về link ký")
    public ResponseEntity<ApiResponse<Map<String, String>>> sendForSignature(
            @PathVariable UUID contractId) {
        contractOtpService.requireVerified(contractId);
        String signingUrl = contractSigningService.createSigningRequest(contractId);
        return ResponseEntity.ok(ApiResponse.success("Đã gửi yêu cầu ký DocuSeal", Map.of("signingUrl", signingUrl)));
    }

    @GetMapping("{contractId}/signing-url")
    @PreAuthorize("hasAuthority('CONTRACT_VIEW')")
    @Operation(summary = "Lấy link ký DocuSeal của hợp đồng")
    public ResponseEntity<ApiResponse<Map<String, String>>> getSigningUrl(
            @PathVariable UUID contractId) {
        contractOtpService.requireVerified(contractId);
        String signingUrl = contractSigningService.getSigningUrl(contractId);
        return ResponseEntity.ok(ApiResponse.success(Map.of("signingUrl", signingUrl)));
    }

    @PostMapping("{contractId}/otp/send")
    @PreAuthorize("hasAuthority('CONTRACT_VIEW')")
    @Operation(summary = "Gửi OTP email để xác thực trước khi ký hợp đồng")
    public ResponseEntity<ApiResponse<ContractOtpResponse>> sendContractOtp(
            @PathVariable UUID contractId) {
        return ResponseEntity.ok(ApiResponse.success(
                "Mã OTP ký hợp đồng đã được gửi tới email của bạn",
                contractOtpService.sendOtp(contractId)));
    }

    @PostMapping("{contractId}/otp/resend")
    @PreAuthorize("hasAuthority('CONTRACT_VIEW')")
    @Operation(summary = "Gửi lại OTP xác thực ký hợp đồng")
    public ResponseEntity<ApiResponse<ContractOtpResponse>> resendContractOtp(
            @PathVariable UUID contractId) {
        return ResponseEntity.ok(ApiResponse.success(
                "Đã gửi lại mã OTP ký hợp đồng",
                contractOtpService.resendOtp(contractId)));
    }

    @PostMapping("{contractId}/otp/verify")
    @PreAuthorize("hasAuthority('CONTRACT_VIEW')")
    @Operation(summary = "Xác thực OTP và lấy liên kết ký DocuSeal")
    public ResponseEntity<ApiResponse<ContractOtpResponse>> verifyContractOtp(
            @PathVariable UUID contractId,
            @Valid @RequestBody ContractOtpVerifyRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                "Xác thực OTP thành công",
                contractOtpService.verifyOtp(contractId, request.getOtp())));
    }

    // =========================================================================
    // CONTRACT RENEWAL (GIA HẠN HỢP ĐỒNG)
    // =========================================================================

    @PostMapping("{contractId}/renew")
    @PreAuthorize("hasAuthority('RENEWAL_CREATE') or hasRole('CUSTOMER')")
    @Operation(summary = "Yêu cầu gia hạn hợp đồng, tạo phụ lục và gửi link ký qua DocuSeal")
    public ResponseEntity<ApiResponse<ContractRenewalResponse>> requestRenewal(
            @PathVariable UUID contractId,
            @Valid @RequestBody ContractRenewalCreateRequest request) {
        ContractRenewalResponse response = contractRenewalService.requestRenewal(contractId, request.getCycleMonths(), request.getNotes());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Khởi tạo yêu cầu gia hạn hợp đồng thành công", response));
    }

    @GetMapping("{contractId}/renewals")
    @PreAuthorize("hasAuthority('RENEWAL_VIEW') or hasRole('CUSTOMER')")
    @Operation(summary = "Lấy lịch sử gia hạn của một hợp đồng")
    public ResponseEntity<ApiResponse<List<ContractRenewalResponse>>> getRenewalsByContractId(
            @PathVariable UUID contractId) {
        List<ContractRenewalResponse> response = contractRenewalService.getRenewalsByContractId(contractId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("renewals/{renewalId}")
    @PreAuthorize("hasAuthority('RENEWAL_VIEW') or hasRole('CUSTOMER')")
    @Operation(summary = "Lấy chi tiết yêu cầu gia hạn")
    public ResponseEntity<ApiResponse<ContractRenewalResponse>> getRenewalById(
            @PathVariable UUID renewalId) {
        ContractRenewalResponse response = contractRenewalService.getById(renewalId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("renewals/{renewalId}/signing-url")
    @PreAuthorize("hasAuthority('RENEWAL_VIEW') or hasRole('CUSTOMER')")
    @Operation(summary = "Lấy link ký phụ lục gia hạn DocuSeal")
    public ResponseEntity<ApiResponse<Map<String, String>>> getRenewalSigningUrl(
            @PathVariable UUID renewalId) {
        String signingUrl = contractRenewalService.getRenewalSigningUrl(renewalId);
        return ResponseEntity.ok(ApiResponse.success(Map.of("signingUrl", signingUrl)));
    }

    @PostMapping("renewals/{renewalId}/mock-sign")
    @PreAuthorize("hasAuthority('RENEWAL_VIEW') or hasRole('CUSTOMER')")
    @Operation(summary = "Ký xác nhận phụ lục gia hạn ở chế độ mô phỏng / local development kèm chữ ký tay")
    public ResponseEntity<ApiResponse<ContractRenewalResponse>> mockSignRenewal(
            @PathVariable UUID renewalId,
            @RequestBody(required = false) com.boxora.dto.request.ContractMockSignRequest request) {
        String signatureData = request != null ? request.getSignatureData() : null;
        ContractRenewalResponse response = contractRenewalService.mockSignRenewal(renewalId, signatureData);
        return ResponseEntity.ok(ApiResponse.success("Ký phụ lục gia hạn hợp đồng điện tử thành công", response));
    }

    @PostMapping("renewals/{renewalId}/payment")
    @PreAuthorize("hasAuthority('PAYMENT_CREATE') or hasRole('CUSTOMER')")
    @Operation(summary = "Khởi tạo thanh toán phí gia hạn qua cổng VNPay Sandbox")
    public ResponseEntity<ApiResponse<VNPayPaymentResponse>> createRenewalPayment(
            @PathVariable UUID renewalId,
            HttpServletRequest httpRequest) {
        VNPayPaymentResponse response = contractRenewalService.createRenewalPayment(renewalId, httpRequest);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Khởi tạo thanh toán phí gia hạn thành công", response));
    }

    @PostMapping("renewals/{renewalId}/counter-payment")
    @PreAuthorize("hasAuthority('PAYMENT_CREATE') or hasAuthority('RENEWAL_CREATE')")
    @Operation(summary = "Thu phí gia hạn hợp đồng tại quầy cơ sở (tiền mặt / chuyển khoản / POS)")
    public ResponseEntity<ApiResponse<ContractRenewalResponse>> recordCounterPayment(
            @PathVariable UUID renewalId,
            @Valid @RequestBody com.boxora.dto.request.ContractRenewalCounterPaymentRequest request) {
        ContractRenewalResponse response = contractRenewalService.recordCounterPayment(renewalId, request);
        return ResponseEntity.ok(ApiResponse.success("Ghi nhận thu phí gia hạn hợp đồng tại quầy thành công", response));
    }

    @PutMapping("renewals/{renewalId}/method")
    @PreAuthorize("hasAuthority('RENEWAL_CREATE') or hasRole('CUSTOMER') or hasRole('FACILITY_MANAGER') or hasRole('BUSINESS_MANAGER')")
    @Operation(summary = "Chọn hoặc thay đổi phương thức ký và thanh toán gia hạn (ONLINE hoặc COUNTER kèm ngày hẹn)")
    public ResponseEntity<ApiResponse<ContractRenewalResponse>> switchRenewalMethod(
            @PathVariable UUID renewalId,
            @Valid @RequestBody com.boxora.dto.request.ContractRenewalSwitchMethodRequest request) {
        ContractRenewalResponse response = contractRenewalService.switchRenewalMethod(renewalId, request);
        return ResponseEntity.ok(ApiResponse.success("Cập nhật phương thức gia hạn hợp đồng thành công", response));
    }

    @PostMapping("renewals/{renewalId}/approve")
    @PreAuthorize("hasAuthority('RENEWAL_APPROVE')")
    @Operation(summary = "Phê duyệt yêu cầu gia hạn hợp đồng (Facility Manager / Business Manager)")
    public ResponseEntity<ApiResponse<ContractRenewalResponse>> approveRenewal(
            @PathVariable UUID renewalId,
            @RequestBody(required = false) com.boxora.dto.request.ContractRenewalApproveRequest request) {
        String notes = request != null ? request.getNotes() : null;
        ContractRenewalResponse response = contractRenewalService.approveRenewal(renewalId, notes);
        return ResponseEntity.ok(ApiResponse.success("Phê duyệt yêu cầu gia hạn hợp đồng thành công", response));
    }

    @PostMapping("renewals/{renewalId}/reject")
    @PreAuthorize("hasAuthority('RENEWAL_APPROVE')")
    @Operation(summary = "Từ chối yêu cầu gia hạn hợp đồng với lý do bắt buộc")
    public ResponseEntity<ApiResponse<ContractRenewalResponse>> rejectRenewal(
            @PathVariable UUID renewalId,
            @Valid @RequestBody com.boxora.dto.request.ContractRenewalRejectRequest request) {
        ContractRenewalResponse response = contractRenewalService.rejectRenewal(renewalId, request.getReason());
        return ResponseEntity.ok(ApiResponse.success("Từ chối yêu cầu gia hạn hợp đồng thành công", response));
    }

    @PostMapping("renewals/{renewalId}/cancel")
    @PreAuthorize("hasAuthority('RENEWAL_CREATE') or hasRole('CUSTOMER')")
    @Operation(summary = "Hủy yêu cầu gia hạn hợp đồng (khách hàng hoặc quản lý khi chưa thanh toán)")
    public ResponseEntity<ApiResponse<ContractRenewalResponse>> cancelRenewal(
            @PathVariable UUID renewalId) {
        ContractRenewalResponse response = contractRenewalService.cancelRenewal(renewalId);
        return ResponseEntity.ok(ApiResponse.success("Hủy yêu cầu gia hạn hợp đồng thành công", response));
    }

    @PostMapping("renewals/{renewalId}/reactivate")
    @PreAuthorize("hasAuthority('RENEWAL_CREATE') or hasRole('CUSTOMER') or hasRole('FACILITY_MANAGER')")
    @Operation(summary = "Kích hoạt duyệt lại yêu cầu gia hạn bị từ chối sau 3 ngày kể từ ngày gửi đơn ban đầu")
    public ResponseEntity<ApiResponse<ContractRenewalResponse>> reactivateRenewal(
            @PathVariable UUID renewalId) {
        ContractRenewalResponse response = contractRenewalService.reactivateRenewal(renewalId);
        return ResponseEntity.ok(ApiResponse.success("Kích hoạt duyệt lại yêu cầu gia hạn thành công", response));
    }

    @PostMapping("renewals/{renewalId}/undo-approval")
    @PreAuthorize("hasAuthority('RENEWAL_APPROVE')")
    @Operation(summary = "Bỏ duyệt yêu cầu gia hạn để xem xét lại phương án (chỉ khi khách chưa ký và chưa nộp tiền)")
    public ResponseEntity<ApiResponse<ContractRenewalResponse>> undoApproval(
            @PathVariable UUID renewalId,
            @RequestBody(required = false) Map<String, String> body) {
        String reason = body != null ? body.get("reason") : null;
        ContractRenewalResponse response = contractRenewalService.undoApproval(renewalId, reason);
        return ResponseEntity.ok(ApiResponse.success("Đã thu hồi phê duyệt yêu cầu gia hạn thành công", response));
    }

    @PutMapping("renewals/{renewalId}/assign-staff")
    @PreAuthorize("hasAuthority('RENEWAL_APPROVE')")
    @Operation(summary = "Phân công nhân viên tiếp đón gia hạn tại cơ sở (chỉ Quản lý cơ sở / Quản lý kinh doanh)")
    public ResponseEntity<ApiResponse<ContractRenewalResponse>> assignStaff(
            @PathVariable UUID renewalId,
            @Valid @RequestBody com.boxora.dto.request.ContractRenewalAssignStaffRequest request) {
        ContractRenewalResponse response = contractRenewalService.assignStaff(renewalId, request);
        return ResponseEntity.ok(ApiResponse.success("Phân công nhân viên tiếp đón gia hạn thành công", response));
    }

    @PostMapping("renewals/{renewalId}/reception-complete")
    @PreAuthorize("hasAuthority('RENEWAL_CREATE') or hasAuthority('PAYMENT_CREATE')")
    @Operation(summary = "Tiếp nhận và hoàn tất gia hạn tại quầy với quy trình đối soát 6 tiêu chí")
    public ResponseEntity<ApiResponse<ContractRenewalResponse>> completeReception(
            @PathVariable UUID renewalId,
            @Valid @RequestBody com.boxora.dto.request.ContractRenewalReceptionRequest request) {
        ContractRenewalResponse response = contractRenewalService.completeReception(renewalId, request);
        return ResponseEntity.ok(ApiResponse.success("Tiếp nhận và hoàn tất gia hạn hợp đồng thành công", response));
    }

    @GetMapping("renewals")
    @PreAuthorize("hasAuthority('RENEWAL_VIEW') or hasRole('CUSTOMER')")
    @Operation(summary = "Lấy danh sách tất cả yêu cầu gia hạn phân trang theo bộ lọc")
    public ResponseEntity<ApiResponse<PageResponse<ContractRenewalResponse>>> getAllRenewals(
            @RequestParam(required = false) UUID contractId,
            @RequestParam(required = false) UUID facilityId,
            @RequestParam(required = false) com.boxora.enums.ContractRenewalStatus status,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate fromDate,
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate toDate,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir) {
        PageResponse<ContractRenewalResponse> response = contractRenewalService.getAllRenewals(
                contractId, facilityId, status, search, fromDate, toDate, page, size, sortBy, sortDir);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    // =========================================================================
    // MOCK SIGNING (SIMULATION / LOCAL TESTING)
    // =========================================================================

    @PostMapping("{contractId}/mock-sign")
    @PreAuthorize("hasAuthority('CONTRACT_VIEW') or hasRole('CUSTOMER')")
    @Operation(summary = "Ký xác nhận hợp đồng điện tử ở chế độ mô phỏng / local development kèm chữ ký tay")
    public ResponseEntity<ApiResponse<RentalContractResponse>> mockSign(
            @PathVariable UUID contractId,
            @RequestBody(required = false) com.boxora.dto.request.ContractMockSignRequest request) {
        String signatureData = request != null ? request.getSignatureData() : null;
        RentalContractResponse response = contractSigningService.mockSign(contractId, signatureData);
        return ResponseEntity.ok(ApiResponse.success("Ký hợp đồng điện tử thành công", response));
    }

    // =========================================================================
    // DOCUSEAL WEBHOOK (PUBLIC - XÁC THỰC BẰNG WEBHOOK TOKEN TRONG PATH/HEADER)
    // =========================================================================

    @PostMapping(value = {"webhook/docuseal/{webhookToken}", "webhook/docuseal"})
    @Operation(summary = "Webhook DocuSeal gọi khi hoàn tất ký hợp đồng hoặc phụ lục gia hạn")
    public ResponseEntity<Void> docusealWebhook(
            @PathVariable(required = false) String webhookToken,
            @RequestHeader(value = "X-Webhook-Token", required = false) String headerToken,
            @RequestParam(value = "token", required = false) String queryToken,
            @RequestBody Map<String, Object> payload) {
        String expectedToken = docuSealConfig.getWebhookToken();
        String actualToken = webhookToken != null ? webhookToken : (headerToken != null ? headerToken : queryToken);
        boolean tokenMatches = expectedToken != null && !expectedToken.isBlank()
                && actualToken != null
                && MessageDigest.isEqual(
                        expectedToken.getBytes(StandardCharsets.UTF_8),
                        actualToken.getBytes(StandardCharsets.UTF_8));
        if (!tokenMatches) {
            log.warn("Rejected DocuSeal webhook because token validation failed or no webhook token is configured");
            throw new AppException(ErrorCode.CONTRACT_SIGNING_INVALID_WEBHOOK_TOKEN);
        }
        contractSigningService.handleWebhook(payload);
        return ResponseEntity.ok().build();
    }
}

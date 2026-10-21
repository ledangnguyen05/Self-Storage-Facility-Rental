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
    @PreAuthorize("hasAuthority('CONTRACT_CREATE') or hasAnyRole('ADMIN', 'FACILITY_MANAGER', 'STAFF')")
    @Operation(summary = "Tạo hợp đồng thuê mới")
    public ResponseEntity<ApiResponse<RentalContractResponse>> createContract(
            @Valid @RequestBody ContractCreateRequest request) {
        RentalContractResponse response = contractSigningService.createContract(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Tạo hợp đồng thành công", response));
    }

    @GetMapping("{contractId}")
    @PreAuthorize("hasAuthority('CONTRACT_VIEW') or hasAnyRole('CUSTOMER', 'ADMIN', 'FACILITY_MANAGER', 'BUSINESS_MANAGER', 'STAFF')")
    @Operation(summary = "Lấy thông tin chi tiết hợp đồng theo ID")
    public ResponseEntity<ApiResponse<RentalContractResponse>> getContractById(
            @PathVariable UUID contractId) {
        RentalContractResponse response = contractSigningService.getContractById(contractId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("booking/{bookingId}")
    @PreAuthorize("hasAuthority('CONTRACT_VIEW') or hasAnyRole('CUSTOMER', 'ADMIN', 'FACILITY_MANAGER', 'BUSINESS_MANAGER', 'STAFF')")
    @Operation(summary = "Lấy hợp đồng thuê theo Booking ID")
    public ResponseEntity<ApiResponse<RentalContractResponse>> getContractByBookingId(
            @PathVariable UUID bookingId) {
        RentalContractResponse response = contractSigningService.getContractByBookingId(bookingId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping
    @PreAuthorize("hasAuthority('CONTRACT_VIEW') or hasAnyRole('CUSTOMER', 'ADMIN', 'FACILITY_MANAGER', 'BUSINESS_MANAGER', 'STAFF')")
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
    @PreAuthorize("hasAuthority('CONTRACT_CREATE') or hasAnyRole('CUSTOMER', 'ADMIN', 'FACILITY_MANAGER', 'STAFF')")
    @Operation(summary = "Gửi hợp đồng sang DocuSeal để khách ký, trả về link ký")
    public ResponseEntity<ApiResponse<Map<String, String>>> sendForSignature(
            @PathVariable UUID contractId) {
        contractOtpService.requireVerified(contractId);
        String signingUrl = contractSigningService.createSigningRequest(contractId);
        return ResponseEntity.ok(ApiResponse.success("Đã gửi yêu cầu ký DocuSeal", Map.of("signingUrl", signingUrl)));
    }

    @GetMapping("{contractId}/signing-url")
    @PreAuthorize("hasAuthority('CONTRACT_VIEW') or hasAnyRole('CUSTOMER', 'ADMIN', 'FACILITY_MANAGER', 'STAFF')")
    @Operation(summary = "Lấy link ký DocuSeal của hợp đồng")
    public ResponseEntity<ApiResponse<Map<String, String>>> getSigningUrl(
            @PathVariable UUID contractId) {
        contractOtpService.requireVerified(contractId);
        String signingUrl = contractSigningService.getSigningUrl(contractId);
        return ResponseEntity.ok(ApiResponse.success(Map.of("signingUrl", signingUrl)));
    }

    @PostMapping("{contractId}/otp/send")
    @PreAuthorize("hasAuthority('CONTRACT_VIEW') or hasAnyRole('CUSTOMER', 'ADMIN', 'FACILITY_MANAGER', 'STAFF')")
    @Operation(summary = "Gửi OTP email để xác thực trước khi ký hợp đồng")
    public ResponseEntity<ApiResponse<ContractOtpResponse>> sendContractOtp(
            @PathVariable UUID contractId) {
        return ResponseEntity.ok(ApiResponse.success(
                "Mã OTP ký hợp đồng đã được gửi tới email của bạn",
                contractOtpService.sendOtp(contractId)));
    }

    @PostMapping("{contractId}/otp/resend")
    @PreAuthorize("hasAuthority('CONTRACT_VIEW') or hasAnyRole('CUSTOMER', 'ADMIN', 'FACILITY_MANAGER', 'STAFF')")
    @Operation(summary = "Gửi lại OTP xác thực ký hợp đồng")
    public ResponseEntity<ApiResponse<ContractOtpResponse>> resendContractOtp(
            @PathVariable UUID contractId) {
        return ResponseEntity.ok(ApiResponse.success(
                "Đã gửi lại mã OTP ký hợp đồng",
                contractOtpService.resendOtp(contractId)));
    }

    @PostMapping("{contractId}/otp/verify")
    @PreAuthorize("hasAuthority('CONTRACT_VIEW') or hasAnyRole('CUSTOMER', 'ADMIN', 'FACILITY_MANAGER', 'STAFF')")
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
    @PreAuthorize("hasAuthority('RENEWAL_CREATE') or hasAnyRole('CUSTOMER', 'ADMIN', 'FACILITY_MANAGER', 'STAFF')")
    @Operation(summary = "Yêu cầu gia hạn hợp đồng (trong cửa sổ gia hạn của cơ sở hoặc khi đang quá hạn): phí tính qua PricingService + phí trễ hạn, tạo phụ lục để ký")
    public ResponseEntity<ApiResponse<ContractRenewalResponse>> requestRenewal(
            @PathVariable UUID contractId,
            @Valid @RequestBody ContractRenewalCreateRequest request) {
        ContractRenewalResponse response = contractRenewalService.requestRenewal(contractId, request.getCycleMonths());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Khởi tạo yêu cầu gia hạn hợp đồng thành công", response));
    }

    @GetMapping("{contractId}/renewals")
    @PreAuthorize("hasAuthority('RENEWAL_VIEW') or hasAnyRole('CUSTOMER', 'ADMIN', 'BUSINESS_MANAGER', 'FACILITY_MANAGER', 'STAFF')")
    @Operation(summary = "Lấy lịch sử gia hạn của một hợp đồng")
    public ResponseEntity<ApiResponse<List<ContractRenewalResponse>>> getRenewalsByContractId(
            @PathVariable UUID contractId) {
        List<ContractRenewalResponse> response = contractRenewalService.getRenewalsByContractId(contractId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("renewals/{renewalId}")
    @PreAuthorize("hasAuthority('RENEWAL_VIEW') or hasAnyRole('CUSTOMER', 'ADMIN', 'BUSINESS_MANAGER', 'FACILITY_MANAGER', 'STAFF')")
    @Operation(summary = "Lấy chi tiết yêu cầu gia hạn")
    public ResponseEntity<ApiResponse<ContractRenewalResponse>> getRenewalById(
            @PathVariable UUID renewalId) {
        ContractRenewalResponse response = contractRenewalService.getById(renewalId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("renewals/{renewalId}/signing-url")
    @PreAuthorize("hasAuthority('RENEWAL_VIEW') or hasAnyRole('CUSTOMER', 'ADMIN', 'FACILITY_MANAGER', 'STAFF')")
    @Operation(summary = "Lấy link ký phụ lục gia hạn DocuSeal")
    public ResponseEntity<ApiResponse<Map<String, String>>> getRenewalSigningUrl(
            @PathVariable UUID renewalId) {
        String signingUrl = contractRenewalService.getRenewalSigningUrl(renewalId);
        return ResponseEntity.ok(ApiResponse.success(Map.of("signingUrl", signingUrl)));
    }

    @PostMapping("renewals/{renewalId}/payment")
    @PreAuthorize("hasAuthority('PAYMENT_CREATE') or hasAnyRole('CUSTOMER', 'ADMIN', 'FACILITY_MANAGER', 'STAFF')")
    @Operation(summary = "Khởi tạo thanh toán phí gia hạn qua cổng VNPay Sandbox")
    public ResponseEntity<ApiResponse<VNPayPaymentResponse>> createRenewalPayment(
            @PathVariable UUID renewalId,
            HttpServletRequest httpRequest) {
        VNPayPaymentResponse response = contractRenewalService.createRenewalPayment(renewalId, httpRequest);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Khởi tạo thanh toán phí gia hạn thành công", response));
    }

    @GetMapping("renewals")
    @PreAuthorize("hasAuthority('RENEWAL_VIEW') or hasAnyRole('CUSTOMER', 'ADMIN', 'FACILITY_MANAGER', 'BUSINESS_MANAGER', 'STAFF')")
    @Operation(summary = "Lấy danh sách tất cả yêu cầu gia hạn phân trang theo bộ lọc")
    public ResponseEntity<ApiResponse<PageResponse<ContractRenewalResponse>>> getAllRenewals(
            @RequestParam(required = false) UUID contractId,
            @RequestParam(required = false) UUID facilityId,
            @RequestParam(required = false) com.boxora.enums.ContractRenewalStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir) {
        PageResponse<ContractRenewalResponse> response = contractRenewalService.getAllRenewals(
                contractId, facilityId, status, page, size, sortBy, sortDir);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    // =========================================================================
    // MOCK SIGNING (SIMULATION / LOCAL TESTING)
    // =========================================================================

    @PostMapping("{contractId}/mock-sign")
    @PreAuthorize("hasAuthority('CONTRACT_VIEW') or hasAnyRole('CUSTOMER', 'ADMIN', 'FACILITY_MANAGER', 'STAFF')")
    @Operation(summary = "Ký xác nhận hợp đồng điện tử ở chế độ mô phỏng / local development kèm chữ ký tay")
    public ResponseEntity<ApiResponse<RentalContractResponse>> mockSign(
            @PathVariable UUID contractId,
            @RequestBody(required = false) com.boxora.dto.request.ContractMockSignRequest request) {
        if (!docuSealConfig.isMockActive()) {
            throw new AppException(ErrorCode.CONTRACT_MOCK_SIGN_DISABLED);
        }
        // Same rule as the DocuSeal path: the customer must have verified the OTP sent to their email.
        contractOtpService.requireVerified(contractId);
        String signatureData = request != null ? request.getSignatureData() : null;
        RentalContractResponse response = contractSigningService.mockSign(contractId, signatureData);
        return ResponseEntity.ok(ApiResponse.success("Đã ký hợp đồng điện tử (môi trường thử nghiệm)", response));
    }

    @GetMapping("signing-config")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Chế độ ký điện tử hiện tại: DOCUSEAL (đã cấu hình) hoặc SIMULATION (môi trường thử nghiệm, ký trong cổng Boxora)")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getSigningConfig() {
        boolean simulated = docuSealConfig.isMockActive();
        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "mode", simulated ? "SIMULATION" : "DOCUSEAL",
                "simulated", simulated,
                "otpRequired", true
        )));
    }

    // =========================================================================
    // RENEWAL ADDENDUM: IN-APP SIGNING (TEST ENVIRONMENT) AND CANCELLATION
    // =========================================================================

    @PostMapping("renewals/{renewalId}/mock-sign")
    @PreAuthorize("hasAnyRole('CUSTOMER', 'ADMIN')")
    @Operation(summary = "Ký phụ lục gia hạn trong cổng Boxora khi chưa cấu hình DocuSeal (môi trường thử nghiệm)")
    public ResponseEntity<ApiResponse<ContractRenewalResponse>> mockSignRenewal(
            @PathVariable UUID renewalId,
            @RequestBody(required = false) com.boxora.dto.request.ContractMockSignRequest request) {
        String signatureData = request != null ? request.getSignatureData() : null;
        ContractRenewalResponse response = contractRenewalService.mockSignRenewal(renewalId, signatureData);
        return ResponseEntity.ok(ApiResponse.success("Đã ký phụ lục gia hạn (môi trường thử nghiệm)", response));
    }

    @PostMapping("renewals/{renewalId}/cancel")
    @PreAuthorize("hasAuthority('RENEWAL_CREATE') or hasAnyRole('CUSTOMER', 'ADMIN', 'FACILITY_MANAGER', 'STAFF')")
    @Operation(summary = "Hủy yêu cầu gia hạn chưa thanh toán")
    public ResponseEntity<ApiResponse<ContractRenewalResponse>> cancelRenewal(
            @PathVariable UUID renewalId,
            @RequestBody(required = false) Map<String, String> body) {
        String reason = body != null ? body.get("reason") : null;
        ContractRenewalResponse response = contractRenewalService.cancelRenewal(renewalId, reason);
        return ResponseEntity.ok(ApiResponse.success("Đã hủy yêu cầu gia hạn", response));
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
        if (expectedToken != null && !expectedToken.isBlank()) {
            if (actualToken == null || !expectedToken.equals(actualToken)) {
                log.warn("Unauthorized DocuSeal webhook call attempt. Received token: {}", actualToken);
                throw new AppException(ErrorCode.CONTRACT_SIGNING_INVALID_WEBHOOK_TOKEN);
            }
        }
        contractSigningService.handleWebhook(payload);
        return ResponseEntity.ok().build();
    }
}
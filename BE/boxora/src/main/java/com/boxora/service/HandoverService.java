package com.boxora.service;

import com.boxora.dto.request.HandoverRequest;
import com.boxora.dto.response.HandoverResponse;

import com.boxora.dto.response.HandoverPrerequisitesResponse;
import com.boxora.dto.response.ReturnSettlementPreviewResponse;
import com.boxora.dto.response.ReturnSettlementResponse;

import java.util.List;
import java.util.UUID;

public interface HandoverService {

    /**
     * Kiểm tra và đối soát 4 điều kiện tiên quyết trước khi check-in bàn giao (BR-RULE-005):
     * 1. Đủ tiền cọc (Full deposit)
     * 2. Đủ tiền thuê tháng đầu (First month rental fee)
     * 3. Hợp đồng điện tử đã ký qua OTP / DocuSeal (Signed e-contract)
     * 4. Xác minh CCCD / giấy tờ tùy thân gốc (Original identity verification)
     */
    HandoverPrerequisitesResponse getCheckInPrerequisites(UUID bookingId);

    /**
     * Bước 2: Nhân viên chọn và gán vị trí ô kho vật lý (Unit Selection & Assignment)
     */
    HandoverPrerequisitesResponse assignUnitToBooking(UUID bookingId, String unitCode);

    HandoverResponse checkIn(HandoverRequest request);

    /**
     * Hành động 1 Trả kho: Khách hàng hoặc nhân viên yêu cầu trả kho
     */
    HandoverResponse requestCheckout(UUID bookingId, String notes);

    /**
     * Hành động 2 Trả kho: Nhân viên kiểm tra hiện trường, lưu ảnh & ghi nhận hư hỏng
     */
    HandoverResponse performInspection(HandoverRequest request);

    /**
     * Xem trước quyết toán tiền cọc và thẩm định hiện trường trả kho (BR-RULE-013/014/015)
     */
    ReturnSettlementPreviewResponse getReturnSettlementPreview(UUID bookingId);

    /**
     * Xử lý nghiệm thu trả kho, quyết toán hoàn cọc, thu hồi mã khóa SmartLock (BR-RULE-013/014/015)
     */
    HandoverResponse processReturn(HandoverRequest request);

    /**
     * Chi tiết nghiệm thu quyết toán cọc trả kho với đầy đủ thông tin breakdown
     */
    ReturnSettlementResponse processReturnSettlement(HandoverRequest request);

    List<HandoverResponse> getByBookingId(UUID bookingId);

    void sendHandoverPinEmail(UUID bookingId, String customEmail);

    com.boxora.dto.response.NotificationLogResponse sendHandoverWebNotification(UUID bookingId);

    // =========================================================================
    // QUY TRÌNH CHECK-IN ĐỐI SOÁT 4 ĐIỀU KIỆN & NGHIỆM THU HIỆN TRƯỜNG
    // =========================================================================

    /** Điều kiện 1: Khởi tạo hoặc tải lên bản scan hợp đồng giấy tại kho */
    com.boxora.dto.response.RentalContractResponse createOrUploadPaperContract(com.boxora.dto.request.PaperContractCreateRequest request);

    /** Điều kiện 1: Nhân viên xác minh tính hợp lệ của hợp đồng giấy */
    com.boxora.dto.response.RentalContractResponse verifyPaperContract(UUID bookingId, String notes);

    /** Điều kiện 2 & 3: Ghi nhận giao dịch tiền mặt hoặc thông tin chuyển khoản ngân hàng */
    com.boxora.dto.response.PaymentResponse recordManualPayment(com.boxora.dto.request.ManualPaymentRecordRequest request);

    /** Điều kiện 2 & 3: Nhân viên có thẩm quyền xác nhận tiền chuyển khoản đã vào tài khoản */
    com.boxora.dto.response.PaymentResponse confirmBankTransferPayment(UUID paymentId, String notes);

    /** Điều kiện 4: Nhân viên tại quầy xác nhận đã đối chiếu giấy tờ tùy thân CCCD/Passport gốc */
    HandoverPrerequisitesResponse verifyIdentity(com.boxora.dto.request.IdentityVerifyRequest request);

    /** Hoàn tất Bước 1: Đối soát 4 điều kiện và ghi log chuyển sang Bước 2 */
    void completeCheckInStep1(UUID bookingId);

    /** Bước 2: Lưu biên bản nghiệm thu 5 tiêu chuẩn hiện trường và ảnh kiểm định */
    HandoverResponse recordCheckInInspection(com.boxora.dto.request.CheckInInspectionRequest request);

    /** Tải lên tài liệu nghiệp vụ bàn giao (Hợp đồng giấy scan / Chứng từ chuyển khoản / Ảnh nghiệm thu: PDF, JPG, JPEG, PNG, WEBP) */
    com.boxora.dto.response.FileUploadResponse uploadHandoverDocument(
            UUID bookingId,
            org.springframework.web.multipart.MultipartFile file,
            String documentType
    );

    /** Kiểm tra quyền truy cập và phân giải đường dẫn tệp tài liệu nhạy cảm (Hợp đồng giấy / Chứng từ thanh toán) */
    java.nio.file.Path getAuthorizedHandoverDocumentPath(UUID bookingId, String fileUrl);

    // =========================================================================
    // QUY TRÌNH TOÀN DIỆN: NGHIỆM THU HIỆN TRƯỜNG & TRẢ KHO (WAREHOUSE RETURN)
    // =========================================================================

    /** Danh sách hồ sơ trả kho của cơ sở với tìm kiếm và lọc đa tiêu chí */
    List<com.boxora.dto.response.ReturnCaseResponse> getReturnCases(
            UUID facilityId,
            String search,
            String status,
            java.time.LocalDate dateFrom,
            java.time.LocalDate dateTo
    );

    /** Chi tiết hồ sơ trả kho */
    com.boxora.dto.response.ReturnCaseResponse getReturnCaseDetail(UUID bookingId);

    /** Xác nhận hoặc đổi lịch hẹn nghiệm thu hiện trường */
    HandoverResponse scheduleInspection(UUID bookingId, java.time.LocalDateTime scheduledAt, String notes);

    /** Bắt đầu nghiệm thu hiện trường */
    HandoverResponse startInspection(UUID bookingId);

    /** Lưu biên bản kiểm định 7 tiêu chí hiện trường (hỗ trợ lưu nháp hoặc chốt biên bản) */
    HandoverResponse saveInspection(HandoverRequest request);

    /** Tính toán đối soát quyết toán tiền cọc, công nợ và chi phí hư hại */
    ReturnSettlementResponse calculateSettlement(UUID bookingId, HandoverRequest request);

    /** Trình cấp quản lý phê duyệt các khoản khấu trừ bồi thường */
    HandoverResponse submitDeductionsForApproval(UUID bookingId, String notes);

    /** Quản lý cơ sở / Ban quản lý phê duyệt hoặc từ chối quyết toán khấu trừ */
    ReturnSettlementResponse approveSettlement(UUID bookingId, HandoverRequest request);

    /** Ghi nhận khiếu nại / tranh chấp từ khách hàng đối với số tiền bồi thường */
    HandoverResponse recordCustomerDispute(UUID bookingId, String disputeReason);

    /** Thu khoản bồi thường bổ sung khi chi phí vượt quá tiền cọc */
    com.boxora.dto.response.PaymentResponse collectAdditionalPayment(UUID bookingId, HandoverRequest request);

    /** Thực hiện lệnh hoàn trả tiền cọc cho khách hàng */
    ReturnSettlementResponse executeRefund(UUID bookingId, HandoverRequest request);

    /** Xác nhận nhận lại kho vật lý & đồ đạc đã dọn sạch */
    HandoverResponse confirmPhysicalReturn(UUID bookingId, HandoverRequest request);

    /** Thu hồi mã PIN SmartLock và quyền truy cập kho của khách hàng */
    HandoverResponse revokeAccess(UUID bookingId);

    /** Hoàn tất toàn bộ hồ sơ trả kho, thanh lý hợp đồng và chuyển trạng thái kho */
    ReturnSettlementResponse completeReturn(UUID bookingId);

    /** Task 16.1: Nhân viên xác nhận đã kiểm tra hiện trường & chốt tính phí quyết toán gửi khách hàng */
    ReturnSettlementResponse confirmSettlementCalculation(UUID bookingId, com.boxora.dto.request.SettlementConfirmRequest request);

    /** Task 16.3 & 16.4: Khách hàng đồng ý hoặc khiếu nại đối với kết quả quyết toán */
    ReturnSettlementResponse handleCustomerDecision(UUID bookingId, com.boxora.dto.request.CustomerDecisionRequest request);

    /** Khách hàng hủy / rút lại yêu cầu khiếu nại quyết toán */
    ReturnSettlementResponse cancelDispute(UUID bookingId);

    /** Task 16.3: Quản lý cơ sở (FACILITY_MANAGER) giải quyết khiếu nại từ khách hàng */
    ReturnSettlementResponse resolveDispute(UUID bookingId, com.boxora.dto.request.DisputeResolveRequest request);

    /** Task 16.4: Kế toán / Quản lý kinh doanh (BUSINESS_MANAGER/ADMIN) thực hiện giải ngân tiền hoàn */
    ReturnSettlementResponse executePayout(UUID bookingId, com.boxora.dto.request.ReturnPayoutRequest request);
}

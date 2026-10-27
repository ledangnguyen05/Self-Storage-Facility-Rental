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

    /** Tải lên tài liệu nghiệp vụ bàn giao (Hợp đồng giấy scan / Chứng từ chuyển khoản: PDF, JPG, JPEG, PNG, WEBP) */
    com.boxora.dto.response.FileUploadResponse uploadHandoverDocument(
            UUID bookingId,
            org.springframework.web.multipart.MultipartFile file,
            String documentType
    );

    /** Kiểm tra quyền truy cập và phân giải đường dẫn tệp tài liệu nhạy cảm (Hợp đồng giấy / Chứng từ thanh toán) */
    java.nio.file.Path getAuthorizedHandoverDocumentPath(UUID bookingId, String fileUrl);
}


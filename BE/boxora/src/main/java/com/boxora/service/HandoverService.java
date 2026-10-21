package com.boxora.service;

import com.boxora.dto.request.HandoverRequest;
import com.boxora.dto.response.CustomerDebtResponse;
import com.boxora.dto.response.FileUploadResponse;
import com.boxora.dto.response.HandoverLookupResponse;
import com.boxora.dto.response.HandoverResponse;

import com.boxora.dto.response.HandoverPrerequisitesResponse;
import com.boxora.dto.response.ReturnSettlementPreviewResponse;
import com.boxora.dto.response.ReturnSettlementResponse;
import org.springframework.web.multipart.MultipartFile;

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
     * Check-in bàn giao kho. Chỉ phản hồi này (và không phản hồi nào khác) mang mã PIN nguyên bản, đúng một lần.
     */
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

    /** Lịch sử biên bản của một đơn. Khách chỉ xem đơn của mình, nhân viên chỉ xem cơ sở của mình. Không chứa mã PIN. */
    List<HandoverResponse> getByBookingId(UUID bookingId);

    /**
     * Gửi lại mã PIN tới email của khách trong hồ sơ. Gửi đồng bộ: trả về địa chỉ đã gửi khi máy chủ email nhận thư,
     * ném lỗi khi không gửi được.
     */
    String sendHandoverPinEmail(UUID bookingId);

    /** Thông báo trong ứng dụng cho khách (không chứa mã PIN). Gọi lại không tạo thông báo trùng. */
    com.boxora.dto.response.NotificationLogResponse sendHandoverWebNotification(UUID bookingId);

    /** Tải lên ảnh nghiệm thu, bản scan hợp đồng giấy hoặc biên lai chuyển khoản; trả về URL /uploads/handover/... */
    FileUploadResponse uploadEvidence(MultipartFile file, UUID bookingId);

    /**
     * Tra cứu đơn đặt kho tại quầy theo mã QR ("BOXORA-CHECKIN:&lt;mã đặt chỗ&gt;"), mã đặt chỗ hoặc UUID của đơn.
     * Chỉ trong phạm vi cơ sở của nhân viên.
     */
    HandoverLookupResponse lookupBooking(String code);

    /** Công nợ khách còn nợ sau quyết toán trả kho (khấu trừ vượt tiền cọc). */
    List<CustomerDebtResponse> getCustomerDebts(UUID facilityId, String status);

    CustomerDebtResponse resolveCustomerDebt(UUID debtId, String status, String note);

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
}

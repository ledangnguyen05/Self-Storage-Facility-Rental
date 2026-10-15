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
}

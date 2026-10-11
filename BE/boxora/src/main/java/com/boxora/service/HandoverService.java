package com.boxora.service;

import com.boxora.dto.request.HandoverRequest;
import com.boxora.dto.response.HandoverResponse;

import com.boxora.dto.response.HandoverPrerequisitesResponse;

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
    HandoverResponse processReturn(HandoverRequest request);
    List<HandoverResponse> getByBookingId(UUID bookingId);
}

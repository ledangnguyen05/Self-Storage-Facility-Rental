package com.boxora.service;

import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.ContractCreateRequest;
import com.boxora.dto.response.RentalContractResponse;
import com.boxora.entity.RentalContract;
import com.boxora.enums.RentalContractStatus;

import java.util.Map;
import java.util.UUID;

public interface ContractSigningService {

    /** Tạo hợp đồng mới trong hệ thống. */
    RentalContractResponse createContract(ContractCreateRequest request);

    /** Lấy chi tiết hợp đồng theo ID. */
    RentalContractResponse getContractById(UUID contractId);

    /** Lấy danh sách hợp đồng phân trang theo tiêu chí. */
    PageResponse<RentalContractResponse> getAllContracts(
            UUID customerId, UUID facilityId, RentalContractStatus status,
            int page, int size, String sortBy, String sortDir);

    /** Gửi hợp đồng sang DocuSeal để khách ký, trả về URL ký. */
    String createSigningRequest(RentalContract contract);

    /** Gửi hợp đồng sang DocuSeal theo contractId, trả về URL ký. */
    String createSigningRequest(UUID contractId);

    /** Lấy URL ký hợp đồng (từ slug hoặc tạo mới nếu chưa có). */
    String getSigningUrl(UUID contractId);

    /** Xử lý webhook từ DocuSeal cho cả hợp đồng chính và phụ lục gia hạn. */
    void handleWebhook(Map<String, Object> payload);

    /** Ký hợp đồng điện tử ở chế độ mô phỏng / local simulation. */
    RentalContractResponse mockSign(UUID contractId);

    /** Ký hợp đồng điện tử ở chế độ mô phỏng kèm theo chữ ký tay thực của khách hàng. */
    RentalContractResponse mockSign(UUID contractId, String signatureData);

    /** Lấy chi tiết hợp đồng theo Booking ID. */
    RentalContractResponse getContractByBookingId(UUID bookingId);

    /** Đảm bảo tồn tại hợp đồng ở trạng thái PENDING_SIGNATURE cho đơn đặt kho đã xác nhận. */
    RentalContract ensureContractForBooking(com.boxora.entity.Booking booking);

    /** Đánh dấu hợp đồng cũ là SUPERSEDED và tạo phiên bản hợp đồng mới khớp thông tin booking hiện tại. */
    default RentalContract supersedeAndCreateNewContractForBooking(com.boxora.entity.Booking booking, String reason) {
        return ensureContractForBooking(booking);
    }

    /** Kiểm tra hợp đồng có khớp với snapshot thông tin đặt kho hiện tại hay không. */
    default boolean isContractMatchingBookingSnapshot(RentalContract contract, com.boxora.entity.Booking booking) {
        return true;
    }
}

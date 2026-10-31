package com.boxora.service;

import com.boxora.dto.request.BookingCancelRequest;
import com.boxora.dto.response.AutoCancelResult;
import com.boxora.dto.response.BookingCancelResponse;
import com.boxora.dto.response.BookingCancellationPreviewResponse;

import java.util.UUID;

public interface BookingCancellationService {

    /**
     * Xem trước thông tin hoàn tiền theo chính sách 3 mốc (>= 48h hoàn 100%, 24h-48h hoàn 50%, < 24h hoàn 0%).
     */
    BookingCancellationPreviewResponse previewCancellationRefund(UUID bookingId);

    /**
     * Thực hiện hủy booking, áp dụng hoàn tiền 3 mốc, thu hồi mã PIN/QR và giải phóng kho lưu trữ.
     */
    BookingCancelResponse cancelBooking(UUID bookingId, BookingCancelRequest request);

    /**
     * Thực hiện hủy booking theo mã đặt chỗ (bookingCode).
     */
    BookingCancelResponse cancelBookingByCode(String bookingCode, BookingCancelRequest request);

    /**
     * Kích hoạt quét tự động hủy các booking PENDING_PAYMENT quá hạn thanh toán (mặc định 15 phút).
     */
    AutoCancelResult triggerAutoCancel(Integer timeoutMinutes);

    /**
     * Hủy yêu cầu trả kho / rút lại yêu cầu hủy đơn và hoàn tiền cọc, khôi phục đơn đặt chỗ.
     */
    BookingCancelResponse revokeCancellation(UUID bookingId);

    /**
     * Hủy yêu cầu trả kho / rút lại yêu cầu hủy đơn và hoàn tiền cọc theo mã đặt chỗ.
     */
    BookingCancelResponse revokeCancellationByCode(String bookingCode);
}



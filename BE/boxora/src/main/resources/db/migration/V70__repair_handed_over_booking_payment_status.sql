-- =========================================================================
-- V70: Đơn đã bàn giao kho luôn là đã thanh toán đợt đầu.
--
-- Check-in (bàn giao) ghi bookings.payment_status = PAID, nhưng dữ liệu mẫu cũ (V29: BX-2026-OVD-TD01, đã trả đủ
-- tiền thuê 6 tháng và tiền cọc) vẫn mang PARTIALLY_PAID từ lần backfill V39, nên cổng khách hàng hiển thị
-- "Thanh toán một phần" dù công nợ bằng 0. Các đơn đã bàn giao và đang dùng / đã kết thúc chuyển sang PAID.
-- =========================================================================
UPDATE bookings
SET payment_status = 'PAID', updated_at = NOW()
WHERE payment_status IN ('UNPAID', 'PARTIALLY_PAID')
  AND handover_time IS NOT NULL
  AND status IN ('ACTIVE', 'CHECKOUT_REQUESTED', 'INSPECTED', 'COMPLETED', 'OVERDUE');

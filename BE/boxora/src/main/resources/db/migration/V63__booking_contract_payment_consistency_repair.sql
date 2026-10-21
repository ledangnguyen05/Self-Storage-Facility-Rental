-- =========================================================================
-- V63: Đặt kho, hợp đồng, thanh toán và hoàn tiền nhất quán với nhau (agent C).
--
-- 1) Lưu mã kết quả của cổng VNPay trên giao dịch để trang kết quả thanh toán và cổng khách hàng giải thích lý do
--    thất bại (khách hủy, không đủ số dư...) thay cho câu chung chung.
-- 2) Lượt thuê đã kết thúc trong dữ liệu mẫu nhưng đặt kho vẫn ghi ACTIVE (BX-2026-1006: hợp đồng CTR-2026-1006
--    EXPIRED từ 01/07/2026). Vì đặt kho còn ACTIVE, tác vụ quá hạn đã biến hợp đồng thành OVERDUE với 112 ngày và
--    27 triệu công nợ. Đặt kho chuyển sang COMPLETED, hợp đồng về EXPIRED, hồ sơ quá hạn đóng lại, kho được mở lại.
-- 3) Lượt giữ chỗ hết hạn mà chưa thanh toán khoản nào (đặt kho OVERDUE nhưng chưa từng bàn giao) là đơn đã hủy,
--    không phải khoản thuê quá hạn: chuyển sang CANCELLED, hủy hợp đồng chưa ký và trả lại kho nếu V61 đã khóa nó.
-- 4) Hợp đồng của đơn ký tại quầy (bookings.signing_method = IN_PERSON) được tạo với signing_method ELECTRONIC nên
--    màn hình bàn giao ghi "Ký điện tử". Hợp đồng chưa ký / chưa tải bản giấy được đổi sang IN_PERSON.
--    Ngược lại, đơn tại quầy mà khách đã ký điện tử trong cổng khách hàng được ghi lại là ký trực tuyến (ONLINE).
-- 5) Liên kết "bản ký số DocuSeal" giả trong dữ liệu mẫu (https://docuseal.com/contracts/...pdf, kể cả trên hợp đồng
--    chưa ký) được xóa: cổng hiển thị hợp đồng kèm chữ ký lưu trong hệ thống.
-- 6) Yêu cầu hoàn tiền khi hủy đơn: "số tiền yêu cầu" chỉ ghi tiền cọc trong khi "số tiền hoàn" gồm cả tiền thuê
--    trả trước, nên Số tiền yêu cầu - Khấu trừ != Số tiền hoàn. Số tiền yêu cầu = số tiền hoàn + khấu trừ. Lý do hoàn
--    tiền không còn mã kỹ thuật (STAGE_1_FULL_REFUND...).
-- 7) Giao dịch VNPay còn PENDING sau khi liên kết thanh toán đã hết hạn (15 phút) được đánh dấu EXPIRED.
-- =========================================================================

-- 1) Kết quả cổng VNPay
ALTER TABLE payments ADD COLUMN IF NOT EXISTS gateway_response_code VARCHAR(10);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS gateway_transaction_status VARCHAR(10);

-- 2) Lượt thuê đã kết thúc nhưng đặt kho vẫn ACTIVE
CREATE TEMP TABLE v63_ended_rentals ON COMMIT DROP AS
SELECT b.id AS booking_id, c.id AS contract_id, b.storage_unit_id, c.end_date
FROM bookings b
JOIN rental_contracts c ON c.booking_id = b.id
WHERE b.status = 'ACTIVE'
  AND (c.status IN ('EXPIRED', 'TERMINATED')
       OR (b.booking_code = 'BX-2026-1006' AND c.contract_code = 'CTR-2026-1006'
           AND c.status IN ('OVERDUE', 'OVERDUE_LOCKED') AND c.end_date = DATE '2026-07-01'));

UPDATE rental_contracts c
SET status = 'EXPIRED', updated_at = NOW()
WHERE c.id IN (SELECT contract_id FROM v63_ended_rentals)
  AND c.status IN ('OVERDUE', 'OVERDUE_LOCKED');

UPDATE overdue_cases oc
SET status = 'CLOSED', resolved_at = NOW(), updated_at = NOW(),
    resolution_note = 'Dữ liệu mẫu: lượt thuê đã kết thúc khi hợp đồng hết hạn, không phát sinh công nợ quá hạn'
WHERE oc.contract_id IN (SELECT contract_id FROM v63_ended_rentals)
  AND oc.status = 'OPEN';

UPDATE bookings b
SET status = 'COMPLETED',
    return_time = COALESCE(b.return_time, e.end_date + TIME '10:00'),
    access_pin = NULL,
    qr_access_token = 'REVOKED_EXPIRED',
    updated_at = NOW()
FROM v63_ended_rentals e
WHERE b.id = e.booking_id;

-- 3) Giữ chỗ hết hạn chưa thanh toán: đơn đã hủy
CREATE TEMP TABLE v63_expired_holds ON COMMIT DROP AS
SELECT b.id AS booking_id, b.storage_unit_id
FROM bookings b
WHERE b.status = 'OVERDUE'
  AND b.handover_time IS NULL
  AND COALESCE(b.deposit_paid, 0) = 0
  AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.booking_id = b.id AND p.status = 'PAID');

UPDATE bookings b
SET status = 'CANCELLED',
    cancelled_at = COALESCE(b.cancelled_at, NOW()),
    cancellation_reason = COALESCE(b.cancellation_reason, 'Hết thời hạn giữ chỗ: khách chưa đến nhận kho đúng lịch hẹn'),
    payment_status = 'UNPAID',
    payment_expires_at = NULL,
    updated_at = NOW()
WHERE b.id IN (SELECT booking_id FROM v63_expired_holds);

UPDATE rental_contracts c
SET status = 'CANCELLED', updated_at = NOW()
WHERE c.booking_id IN (SELECT booking_id FROM v63_expired_holds)
  AND c.status IN ('PENDING_SIGNATURE', 'PENDING_VERIFICATION', 'PENDING_ACTIVATION');

-- Kho của các lượt ở mục 2 và 3: mở lại khi không còn đặt kho hay hợp đồng nào đang giữ kho.
-- (V61 khóa OVERDUE_LOCKED mọi kho trống có đặt kho OVERDUE, kể cả lượt giữ chỗ hết hạn.)
UPDATE storage_units su
SET status = 'AVAILABLE', updated_at = NOW()
WHERE su.id IN (SELECT storage_unit_id FROM v63_ended_rentals UNION SELECT storage_unit_id FROM v63_expired_holds)
  AND su.status IN ('OCCUPIED', 'RESERVED', 'OVERDUE_LOCKED')
  AND NOT EXISTS (SELECT 1 FROM bookings b
                  WHERE b.storage_unit_id = su.id
                    AND (b.status IN ('ACTIVE', 'CHECKOUT_REQUESTED', 'INSPECTED', 'CONFIRMED', 'PENDING_PAYMENT', 'PENDING_APPROVAL')
                         OR (b.status = 'OVERDUE' AND b.handover_time IS NOT NULL)))
  AND NOT EXISTS (SELECT 1 FROM rental_contracts c
                  WHERE c.unit_id = su.id AND c.status IN ('ACTIVE', 'OVERDUE', 'OVERDUE_LOCKED'));

-- 4) Hình thức ký của hợp đồng theo hình thức ký của đơn
UPDATE rental_contracts c
SET signing_method = 'IN_PERSON', updated_at = NOW()
FROM bookings b
WHERE c.booking_id = b.id
  AND b.signing_method = 'IN_PERSON'
  AND c.signing_method = 'ELECTRONIC'
  AND c.signed_at IS NULL
  AND c.paper_contract_url IS NULL
  AND c.status = 'PENDING_SIGNATURE';

UPDATE bookings b
SET signing_method = 'ONLINE', updated_at = NOW()
FROM rental_contracts c
WHERE c.booking_id = b.id
  AND b.signing_method = 'IN_PERSON'
  AND b.status IN ('PENDING_PAYMENT', 'CONFIRMED')
  AND c.signed_at IS NOT NULL
  AND c.paper_contract_url IS NULL
  AND c.signing_method IN ('ELECTRONIC', 'ELECTRONIC_TEST');

-- 5) Liên kết DocuSeal giả của dữ liệu mẫu
UPDATE rental_contracts
SET signed_document_url = NULL, updated_at = NOW()
WHERE signed_document_url ~ '^https?://(www\.)?docuseal\.com/contracts/(pending_signature|pending|signed|active)/[A-Za-z0-9_-]+\.pdf$';

-- 6) Số tiền và lý do của yêu cầu hoàn tiền khi hủy đơn
UPDATE refund_requests
SET requested_amount = final_refund_amount + deduction_amount, updated_at = NOW()
WHERE requested_amount < final_refund_amount + deduction_amount;

UPDATE refund_requests
SET reason = REPLACE(REPLACE(REPLACE(REPLACE(reason,
        '(STAGE_1_FULL_REFUND)', '(mốc 1: hoàn 100% tiền cọc)'),
        '(STAGE_2_PARTIAL_REFUND)', '(mốc 2: hoàn một phần tiền cọc)'),
        '(STAGE_3_NO_REFUND)', '(mốc 3: không hoàn tiền cọc)'),
        'Hoàn cọc khi hủy đơn', 'Hoàn tiền khi hủy đơn'),
    updated_at = NOW()
WHERE reason LIKE '%(STAGE\_%' ESCAPE '\' OR reason LIKE 'Hoàn cọc khi hủy đơn%';

-- 7) Giao dịch VNPay bị bỏ dở
UPDATE payments
SET status = 'EXPIRED', updated_at = NOW()
WHERE status = 'PENDING'
  AND payment_method = 'VNPAY'
  AND payment_time < NOW() - INTERVAL '1 hour';

-- V89: Update Facility Policies Cancellation Thresholds and Defaults
-- Chính sách hủy đặt kho mới:
-- Mốc 1: Trong vòng 24h kể từ thời gian đặt kho -> Hoàn 100% tiền cọc
-- Mốc 2: Trong khoảng 24h - 48h kể từ thời gian đặt kho -> Hoàn 70% tiền cọc
-- Mốc 3: Quá 48h kể từ thời gian đặt kho -> Hoàn 50% tiền cọc

ALTER TABLE facility_policies
    ALTER COLUMN cancellation_full_refund_hours SET DEFAULT 24,
    ALTER COLUMN cancellation_partial_refund_hours SET DEFAULT 48,
    ALTER COLUMN cancellation_partial_refund_percent SET DEFAULT 70.0;

UPDATE facility_policies
SET
    cancellation_full_refund_hours = 24,
    cancellation_partial_refund_hours = 48,
    cancellation_partial_refund_percent = 70.0,
    updated_at = CURRENT_TIMESTAMP
WHERE cancellation_full_refund_hours = 48 AND cancellation_partial_refund_hours = 24;

-- V106: Add minimum_rental_days and cancellation_after_48h_refund_percent to facility_policies
-- Aligns with Boxora Task 1 & Task 2 specifications

ALTER TABLE facility_policies
    ADD COLUMN IF NOT EXISTS minimum_rental_days INTEGER DEFAULT 30,
    ADD COLUMN IF NOT EXISTS cancellation_after_48h_refund_percent DOUBLE PRECISION DEFAULT 50.0;

-- Backfill minimum_rental_days from existing minimum_rental_months (fallback 30 days)
UPDATE facility_policies
SET minimum_rental_days = COALESCE(minimum_rental_months * 30, 30)
WHERE minimum_rental_days IS NULL;

-- Backfill cancellation_after_48h_refund_percent
UPDATE facility_policies
SET cancellation_after_48h_refund_percent = 50.0
WHERE cancellation_after_48h_refund_percent IS NULL;

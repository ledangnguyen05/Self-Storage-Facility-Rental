-- =========================================================================
-- V39: Add separated hold periods, appointment check-in, and payment status
-- =========================================================================

-- 1. Add hold tracking & payment status fields to bookings
ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS hold_started_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS hold_expires_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS expected_check_in_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS payment_status VARCHAR(30) DEFAULT 'UNPAID';

-- 2. Add hold policies to facility_policies
ALTER TABLE facility_policies
    ADD COLUMN IF NOT EXISTS hold_grace_hours INTEGER NOT NULL DEFAULT 24,
    ADD COLUMN IF NOT EXISTS max_hold_days INTEGER NOT NULL DEFAULT 14;

-- 3. Backfill data for existing bookings
UPDATE bookings
SET hold_started_at = created_at
WHERE hold_started_at IS NULL;

UPDATE bookings
SET hold_expires_at = payment_expires_at
WHERE hold_expires_at IS NULL AND payment_expires_at IS NOT NULL;

UPDATE bookings
SET expected_check_in_at = (start_date || ' 09:00:00')::TIMESTAMP
WHERE expected_check_in_at IS NULL AND start_date IS NOT NULL;

UPDATE bookings
SET payment_status = CASE
    WHEN status IN ('ACTIVE', 'COMPLETED') THEN 'PAID'
    WHEN deposit_paid > 0 THEN 'PARTIALLY_PAID'
    ELSE 'UNPAID'
END
WHERE payment_status IS NULL OR payment_status = 'UNPAID';

-- 4. Create index for efficient expiration checks
CREATE INDEX IF NOT EXISTS idx_bookings_hold_expiry
    ON bookings (status, hold_expires_at);

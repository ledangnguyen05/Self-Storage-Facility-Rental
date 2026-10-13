ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS payment_expires_at TIMESTAMP WITH TIME ZONE;

UPDATE bookings
SET deposit_amount = deposit_paid
WHERE deposit_amount = 0 AND deposit_paid > 0;

CREATE INDEX IF NOT EXISTS idx_bookings_pending_payment_expiry
    ON bookings (status, payment_expires_at);

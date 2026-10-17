-- =========================================================================
-- V42: Enhance Refund Lifecycle and Booking Cancellation Tracking
-- =========================================================================

-- 1. Add lifecycle tracking columns to refund_requests
ALTER TABLE refund_requests
    ADD COLUMN IF NOT EXISTS transfer_initiated_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS transfer_initiated_by_id UUID,
    ADD COLUMN IF NOT EXISTS transfer_reference VARCHAR(100),
    ADD COLUMN IF NOT EXISTS customer_confirmed_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS customer_confirmation_notes VARCHAR(500),
    ADD COLUMN IF NOT EXISTS reconciled_by_id UUID,
    ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS reconciliation_notes VARCHAR(500);

-- Foreign keys for refund lifecycle users
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_refund_transfer_initiated_by'
    ) THEN
        ALTER TABLE refund_requests
            ADD CONSTRAINT fk_refund_transfer_initiated_by
            FOREIGN KEY (transfer_initiated_by_id) REFERENCES users(id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_refund_reconciled_by'
    ) THEN
        ALTER TABLE refund_requests
            ADD CONSTRAINT fk_refund_reconciled_by
            FOREIGN KEY (reconciled_by_id) REFERENCES users(id);
    END IF;
END $$;

-- 2. Add cancellation audit columns to bookings
ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS cancellation_reason VARCHAR(500),
    ADD COLUMN IF NOT EXISTS cancelled_by_id UUID,
    ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_bookings_cancelled_by'
    ) THEN
        ALTER TABLE bookings
            ADD CONSTRAINT fk_bookings_cancelled_by
            FOREIGN KEY (cancelled_by_id) REFERENCES users(id);
    END IF;
END $$;

ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS expected_arrival_at TIMESTAMP;

COMMENT ON COLUMN bookings.expected_arrival_at IS 'Customer-selected expected arrival date and local time for storage handover';

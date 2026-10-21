-- =========================================================================
-- V48: Add Target Staff Response Fields to Shift Swap Requests
-- =========================================================================

ALTER TABLE shift_swap_requests
    ADD COLUMN IF NOT EXISTS target_staff_responded_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS target_staff_notes TEXT;

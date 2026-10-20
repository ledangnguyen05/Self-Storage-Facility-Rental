-- =========================================================================
-- V50: Add counter appointment date to contract_renewals
-- =========================================================================

ALTER TABLE contract_renewals
ADD COLUMN IF NOT EXISTS counter_appointment_date DATE;

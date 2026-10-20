-- =========================================================================
-- V53: Add counter appointment time to contract_renewals
-- =========================================================================

ALTER TABLE contract_renewals
ADD COLUMN IF NOT EXISTS counter_appointment_time VARCHAR(10);

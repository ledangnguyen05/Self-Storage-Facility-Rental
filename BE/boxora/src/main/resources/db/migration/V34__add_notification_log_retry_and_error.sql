-- =========================================================================
-- V34: Synchronize schema for notification_logs and handover_records
-- Ensures all entity attributes exist across all environments
-- =========================================================================

ALTER TABLE notification_logs
    ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS error_message VARCHAR(1000);

ALTER TABLE handover_records
    ADD COLUMN IF NOT EXISTS deposit_settled NUMERIC(12, 2),
    ADD COLUMN IF NOT EXISTS deduction_amount NUMERIC(12, 2),
    ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(12, 2),
    ADD COLUMN IF NOT EXISTS review_status VARCHAR(50),
    ADD COLUMN IF NOT EXISTS checklist_summary TEXT,
    ADD COLUMN IF NOT EXISTS evidence_photos TEXT;

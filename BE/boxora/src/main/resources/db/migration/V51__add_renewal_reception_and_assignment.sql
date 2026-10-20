-- =========================================================================
-- V51: Add renewal reception, staff assignment, and 6-point verification fields
-- =========================================================================

ALTER TABLE contract_renewals
ADD COLUMN IF NOT EXISTS assigned_staff_id UUID REFERENCES users(id);

ALTER TABLE contract_renewals
ADD COLUMN IF NOT EXISTS assigned_staff_at TIMESTAMP;

ALTER TABLE contract_renewals
ADD COLUMN IF NOT EXISTS identity_verified BOOLEAN DEFAULT FALSE;

ALTER TABLE contract_renewals
ADD COLUMN IF NOT EXISTS identity_doc_type VARCHAR(50);

ALTER TABLE contract_renewals
ADD COLUMN IF NOT EXISTS identity_number VARCHAR(50);

ALTER TABLE contract_renewals
ADD COLUMN IF NOT EXISTS identity_notes TEXT;

ALTER TABLE contract_renewals
ADD COLUMN IF NOT EXISTS unit_audited BOOLEAN DEFAULT FALSE;

ALTER TABLE contract_renewals
ADD COLUMN IF NOT EXISTS unit_audit_notes TEXT;

ALTER TABLE contract_renewals
ADD COLUMN IF NOT EXISTS no_blocking_issues BOOLEAN DEFAULT FALSE;

ALTER TABLE contract_renewals
ADD COLUMN IF NOT EXISTS blocking_notes TEXT;

ALTER TABLE contract_renewals
ADD COLUMN IF NOT EXISTS terms_confirmed BOOLEAN DEFAULT FALSE;

ALTER TABLE contract_renewals
ADD COLUMN IF NOT EXISTS terms_notes TEXT;

ALTER TABLE contract_renewals
ADD COLUMN IF NOT EXISTS payment_confirmed BOOLEAN DEFAULT FALSE;

ALTER TABLE contract_renewals
ADD COLUMN IF NOT EXISTS handled_by_id UUID REFERENCES users(id);

ALTER TABLE contract_renewals
ADD COLUMN IF NOT EXISTS handled_at TIMESTAMP;

ALTER TABLE contract_renewals
ADD COLUMN IF NOT EXISTS reception_notes TEXT;

ALTER TABLE contract_renewals
ADD COLUMN IF NOT EXISTS reception_checklist_json TEXT;

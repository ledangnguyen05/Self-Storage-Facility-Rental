-- V79: Enhance shift_handovers with handover_type, target_shift, emergency_reason, transfer_scope, cash discrepancy, and dispatch fields
ALTER TABLE shift_handovers
    ADD COLUMN IF NOT EXISTS handover_type VARCHAR(30) NOT NULL DEFAULT 'ROUTINE',
    ADD COLUMN IF NOT EXISTS target_shift VARCHAR(30),
    ADD COLUMN IF NOT EXISTS emergency_reason TEXT,
    ADD COLUMN IF NOT EXISTS transfer_scope VARCHAR(200),
    ADD COLUMN IF NOT EXISTS cash_counted NUMERIC(12, 2),
    ADD COLUMN IF NOT EXISTS cash_discrepancy NUMERIC(12, 2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS cash_discrepancy_reason TEXT,
    ADD COLUMN IF NOT EXISTS dispatched_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_sh_handover_type ON shift_handovers(handover_type);

-- V87: Add support ticket refund workflow and bank transfer proof columns
ALTER TABLE support_tickets
    ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100),
    ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(50),
    ADD COLUMN IF NOT EXISTS bank_account_name VARCHAR(100),
    ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(15, 2),
    ADD COLUMN IF NOT EXISTS transfer_proof_url TEXT,
    ADD COLUMN IF NOT EXISTS transfer_transaction_ref VARCHAR(100),
    ADD COLUMN IF NOT EXISTS transfer_confirmed_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS transfer_confirmed_by_id UUID,
    ADD COLUMN IF NOT EXISTS fm_approved_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS fm_approved_by_id UUID,
    ADD COLUMN IF NOT EXISTS fm_approval_note TEXT,
    ADD COLUMN IF NOT EXISTS refund_status VARCHAR(50) DEFAULT 'NONE';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_support_tickets_transfer_confirmed_by'
    ) THEN
        ALTER TABLE support_tickets
            ADD CONSTRAINT fk_support_tickets_transfer_confirmed_by
            FOREIGN KEY (transfer_confirmed_by_id) REFERENCES users(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_support_tickets_fm_approved_by'
    ) THEN
        ALTER TABLE support_tickets
            ADD CONSTRAINT fk_support_tickets_fm_approved_by
            FOREIGN KEY (fm_approved_by_id) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;

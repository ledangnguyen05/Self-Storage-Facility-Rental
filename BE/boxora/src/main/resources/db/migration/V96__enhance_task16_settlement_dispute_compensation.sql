-- V96: Enhance Task 16 Return Settlement, Dispute, Refund & Compensation Workflow
-- Bổ sung phiên bản quyết toán, xác nhận quyết toán, phản hồi khách hàng (Đồng ý/Khiếu nại),
-- giải quyết khiếu nại bởi Facility Manager, và thông tin tài khoản hoàn tiền

ALTER TABLE handover_records
    ADD COLUMN IF NOT EXISTS settlement_version INT DEFAULT 1,
    ADD COLUMN IF NOT EXISTS settlement_confirmed BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS settlement_confirmed_by_id UUID,
    ADD COLUMN IF NOT EXISTS settlement_confirmed_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS customer_decision VARCHAR(50) DEFAULT 'NONE',
    ADD COLUMN IF NOT EXISTS customer_decision_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS dispute_reason TEXT,
    ADD COLUMN IF NOT EXISTS dispute_evidence_urls TEXT,
    ADD COLUMN IF NOT EXISTS dispute_resolved_by_id UUID,
    ADD COLUMN IF NOT EXISTS dispute_resolved_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS dispute_resolution_note TEXT,
    ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100),
    ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(100),
    ADD COLUMN IF NOT EXISTS bank_account_name VARCHAR(100),
    ADD COLUMN IF NOT EXISTS refund_request_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_handover_records_settlement_confirmed_by'
    ) THEN
        ALTER TABLE handover_records
            ADD CONSTRAINT fk_handover_records_settlement_confirmed_by
            FOREIGN KEY (settlement_confirmed_by_id) REFERENCES users(id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_handover_records_dispute_resolved_by'
    ) THEN
        ALTER TABLE handover_records
            ADD CONSTRAINT fk_handover_records_dispute_resolved_by
            FOREIGN KEY (dispute_resolved_by_id) REFERENCES users(id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_handover_records_refund_request'
    ) THEN
        ALTER TABLE handover_records
            ADD CONSTRAINT fk_handover_records_refund_request
            FOREIGN KEY (refund_request_id) REFERENCES refund_requests(id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_handover_records_customer_decision ON handover_records(customer_decision);
CREATE INDEX IF NOT EXISTS idx_handover_records_settlement_confirmed ON handover_records(settlement_confirmed);

-- V90: Enhance Return Settlement & Warehouse Return Workflow
-- Bổ sung đầy đủ 7 tiêu chí thẩm định, quy trình phê duyệt khấu trừ đa cấp,
-- thu bổ sung khi chi phí vượt cọc, thu hồi SmartLock và nghiệm thu bàn giao vật lý

ALTER TABLE handover_records
    ADD COLUMN IF NOT EXISTS assets_cleared_passed BOOLEAN,
    ADD COLUMN IF NOT EXISTS assets_cleared_notes TEXT,
    ADD COLUMN IF NOT EXISTS door_fee NUMERIC(12,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS door_notes TEXT,
    ADD COLUMN IF NOT EXISTS cleanliness_fee NUMERIC(12,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS cleanliness_notes TEXT,
    ADD COLUMN IF NOT EXISTS wall_structure_fee NUMERIC(12,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS wall_structure_notes TEXT,
    ADD COLUMN IF NOT EXISTS smart_lock_fee NUMERIC(12,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS smart_lock_notes TEXT,
    ADD COLUMN IF NOT EXISTS smart_lock_issue_type VARCHAR(50),
    ADD COLUMN IF NOT EXISTS lost_card_fee NUMERIC(12,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS sensor_notes TEXT,
    ADD COLUMN IF NOT EXISTS approved_deductions NUMERIC(12,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS additional_amount_due NUMERIC(12,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS additional_payment_status VARCHAR(50) DEFAULT 'NONE',
    ADD COLUMN IF NOT EXISTS additional_payment_txn_ref VARCHAR(100),
    ADD COLUMN IF NOT EXISTS additional_payment_method VARCHAR(50),
    ADD COLUMN IF NOT EXISTS additional_payment_recorded_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS refund_method VARCHAR(50),
    ADD COLUMN IF NOT EXISTS refund_txn_ref VARCHAR(100),
    ADD COLUMN IF NOT EXISTS refund_status VARCHAR(50) DEFAULT 'NONE',
    ADD COLUMN IF NOT EXISTS refund_processed_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS scheduled_inspection_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS inspection_status VARCHAR(50) DEFAULT 'PENDING',
    ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) DEFAULT 'DRAFT',
    ADD COLUMN IF NOT EXISTS approved_by_id UUID,
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS approval_notes TEXT,
    ADD COLUMN IF NOT EXISTS unit_returned_physically BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS returned_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS access_revoked BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS access_revoked_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS post_return_unit_status VARCHAR(30);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_handover_records_approved_by'
    ) THEN
        ALTER TABLE handover_records
            ADD CONSTRAINT fk_handover_records_approved_by
            FOREIGN KEY (approved_by_id) REFERENCES users(id);
    END IF;
END $$;

ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS return_scheduled_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_handover_records_booking_type ON handover_records(booking_id, record_type);
CREATE INDEX IF NOT EXISTS idx_handover_records_inspection_status ON handover_records(inspection_status);
CREATE INDEX IF NOT EXISTS idx_handover_records_approval_status ON handover_records(approval_status);

-- V100: Create settlement_snapshots table for immutable versioned settlement snapshots
CREATE TABLE IF NOT EXISTS settlement_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    handover_record_id UUID NOT NULL,
    booking_id UUID NOT NULL,
    contract_id UUID,
    facility_id UUID,
    settlement_version INT NOT NULL,
    deposit_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    door_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
    cleaning_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
    wall_structure_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
    smart_lock_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
    smart_lock_issue_type VARCHAR(50),
    lost_card_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
    overdue_debt NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_deductions NUMERIC(12,2) NOT NULL DEFAULT 0,
    refund_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    additional_amount_due NUMERIC(12,2) NOT NULL DEFAULT 0,
    confirmed_by_id UUID,
    confirmed_by_name VARCHAR(255),
    confirmed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    customer_decision VARCHAR(50) DEFAULT 'PENDING',
    customer_decision_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_settlement_snapshots_record_version UNIQUE (handover_record_id, settlement_version),
    CONSTRAINT fk_settlement_snapshots_handover_record FOREIGN KEY (handover_record_id) REFERENCES handover_records(id) ON DELETE CASCADE,
    CONSTRAINT fk_settlement_snapshots_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    CONSTRAINT fk_settlement_snapshots_contract FOREIGN KEY (contract_id) REFERENCES rental_contracts(id) ON DELETE SET NULL,
    CONSTRAINT fk_settlement_snapshots_facility FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE SET NULL,
    CONSTRAINT fk_settlement_snapshots_confirmed_by FOREIGN KEY (confirmed_by_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_settlement_snapshots_booking_version ON settlement_snapshots(booking_id, settlement_version);
CREATE INDEX IF NOT EXISTS idx_settlement_snapshots_record_id ON settlement_snapshots(handover_record_id);

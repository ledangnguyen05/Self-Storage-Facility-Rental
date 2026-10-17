-- =========================================================================
-- V38: Add paper contract support, manual payment tracking, and identity verification
-- =========================================================================

-- 1. Add paper contract fields to rental_contracts
ALTER TABLE rental_contracts
ADD COLUMN IF NOT EXISTS signing_method VARCHAR(30) DEFAULT 'ELECTRONIC';

ALTER TABLE rental_contracts
ADD COLUMN IF NOT EXISTS paper_contract_url VARCHAR(500);

ALTER TABLE rental_contracts
ADD COLUMN IF NOT EXISTS paper_original_location VARCHAR(255);

ALTER TABLE rental_contracts
ADD COLUMN IF NOT EXISTS paper_verified_by_staff_id UUID REFERENCES users(id);

ALTER TABLE rental_contracts
ADD COLUMN IF NOT EXISTS paper_verified_at TIMESTAMP;

ALTER TABLE rental_contracts
ADD COLUMN IF NOT EXISTS paper_notes TEXT;

-- 2. Add manual payment fields to payments
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS collected_by_staff_id UUID REFERENCES users(id);

ALTER TABLE payments
ADD COLUMN IF NOT EXISTS receipt_voucher_code VARCHAR(100);

ALTER TABLE payments
ADD COLUMN IF NOT EXISTS reference_code VARCHAR(100);

ALTER TABLE payments
ADD COLUMN IF NOT EXISTS proof_document_url VARCHAR(500);

ALTER TABLE payments
ADD COLUMN IF NOT EXISTS confirmed_by_staff_id UUID REFERENCES users(id);

ALTER TABLE payments
ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP;

ALTER TABLE payments
ADD COLUMN IF NOT EXISTS payment_notes TEXT;

-- 3. Add identity verification & step transition fields to bookings
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS identity_card_type VARCHAR(30) DEFAULT 'CCCD';

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS identity_card_number VARCHAR(50);

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS identity_verified_by_staff_id UUID REFERENCES users(id);

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS identity_verified_at TIMESTAMP;

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS identity_verification_notes TEXT;

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS step_transition_history TEXT;

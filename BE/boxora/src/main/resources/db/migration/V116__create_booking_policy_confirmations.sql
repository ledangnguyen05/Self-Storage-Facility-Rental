-- =========================================================================
-- V116: Create booking_policy_confirmations table and sync missing entity columns
-- =========================================================================

-- 1. Create booking_policy_confirmations table
CREATE TABLE IF NOT EXISTS booking_policy_confirmations (
    id                          UUID PRIMARY KEY,
    created_at                  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    booking_id                  UUID NOT NULL,
    customer_id                 UUID NOT NULL,
    facility_id                 UUID NOT NULL,

    policy_version              VARCHAR(50) NOT NULL,
    confirmed_at                TIMESTAMP NOT NULL,
    ip_address                  VARCHAR(50),
    user_agent                  VARCHAR(500),
    policy_content_snapshot     TEXT,
    status                      VARCHAR(30) NOT NULL DEFAULT 'POLICY_CONFIRMED',

    CONSTRAINT fk_bpc_booking
        FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    CONSTRAINT fk_bpc_customer
        FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_bpc_facility
        FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE CASCADE
);

-- Indexes for performance & query lookups
CREATE INDEX IF NOT EXISTS idx_bpc_booking_confirmed
    ON booking_policy_confirmations (booking_id, confirmed_at DESC);

CREATE INDEX IF NOT EXISTS idx_bpc_booking_version
    ON booking_policy_confirmations (booking_id, policy_version);

CREATE INDEX IF NOT EXISTS idx_bpc_customer
    ON booking_policy_confirmations (customer_id);

CREATE INDEX IF NOT EXISTS idx_bpc_facility
    ON booking_policy_confirmations (facility_id);

-- 2. Sync missing columns for Booking entity
ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS contract_signed BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS policy_confirmed BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS policy_confirmed_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS policy_version VARCHAR(50);

-- 3. Sync missing columns for StorageUnit entity
ALTER TABLE storage_units
    ADD COLUMN IF NOT EXISTS maintenance_reason VARCHAR(500),
    ADD COLUMN IF NOT EXISTS maintenance_by VARCHAR(150),
    ADD COLUMN IF NOT EXISTS maintenance_at TIMESTAMP;

-- 4. Sync missing column for SupportTicket entity
ALTER TABLE support_tickets
    ADD COLUMN IF NOT EXISTS image_evidence TEXT;

-- 5. Align unit_types dimension column types with Double fields in UnitType entity
ALTER TABLE unit_types
    ALTER COLUMN volume_m3 TYPE DOUBLE PRECISION,
    ALTER COLUMN length_m TYPE DOUBLE PRECISION,
    ALTER COLUMN width_m TYPE DOUBLE PRECISION,
    ALTER COLUMN height_m TYPE DOUBLE PRECISION;

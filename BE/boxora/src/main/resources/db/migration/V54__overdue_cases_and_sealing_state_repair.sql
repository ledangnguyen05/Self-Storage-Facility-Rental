-- =========================================================================
-- V54: Persisted overdue episodes (late fee accrued by the nightly job, access
--      lockout / restoration, manager reprieve, last reminder) and repair of
--      units that the old nightly job sealed as UNDER_MAINTENANCE.
-- =========================================================================

CREATE TABLE IF NOT EXISTS overdue_cases (
    id                   UUID           NOT NULL,
    created_at           TIMESTAMP      NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMP      NOT NULL DEFAULT NOW(),
    contract_id          UUID           NOT NULL,
    facility_id          UUID           NOT NULL,
    due_date             DATE           NOT NULL,
    status               VARCHAR(20)    NOT NULL DEFAULT 'OPEN',
    days_overdue         INTEGER        NOT NULL DEFAULT 0,
    grace_days           INTEGER        NOT NULL DEFAULT 0,
    daily_late_fee       NUMERIC(15, 2) NOT NULL DEFAULT 0,
    late_fee_amount      NUMERIC(15, 2) NOT NULL DEFAULT 0,
    overdue_rent_amount  NUMERIC(15, 2) NOT NULL DEFAULT 0,
    last_assessed_on     DATE,
    access_locked_at     TIMESTAMP,
    access_restored_at   TIMESTAMP,
    access_hold_until    DATE,
    last_reminder_at     TIMESTAMP,
    last_reminder_status VARCHAR(20),
    last_reminder_error  VARCHAR(500),
    reminder_count       INTEGER        NOT NULL DEFAULT 0,
    resolved_at          TIMESTAMP,
    resolution_note      VARCHAR(500),

    CONSTRAINT pk_overdue_cases PRIMARY KEY (id),
    CONSTRAINT fk_overdue_cases_contract FOREIGN KEY (contract_id) REFERENCES rental_contracts (id),
    CONSTRAINT fk_overdue_cases_facility FOREIGN KEY (facility_id) REFERENCES facilities (id),
    CONSTRAINT ck_overdue_cases_status CHECK (status IN ('OPEN', 'SETTLED', 'CLOSED'))
);

-- At most one open episode per contract.
CREATE UNIQUE INDEX IF NOT EXISTS ux_overdue_cases_open_contract
    ON overdue_cases (contract_id) WHERE status = 'OPEN';
CREATE INDEX IF NOT EXISTS idx_overdue_cases_facility_status ON overdue_cases (facility_id, status);

-- The old nightly job created SEALED records but parked the unit in UNDER_MAINTENANCE, so the manager
-- UI offered "Hoàn tất bảo trì" and the unit could be rented again with the tenant's goods inside.
UPDATE storage_units su
SET status = 'OVERDUE_LOCKED', updated_at = NOW()
WHERE su.status = 'UNDER_MAINTENANCE'
  AND EXISTS (SELECT 1 FROM sealing_records s WHERE s.storage_unit_id = su.id AND s.status = 'SEALED');

UPDATE rental_contracts c
SET status = 'OVERDUE_LOCKED', updated_at = NOW()
WHERE c.status IN ('ACTIVE', 'OVERDUE')
  AND EXISTS (SELECT 1 FROM sealing_records s WHERE s.contract_id = c.id AND s.status = 'SEALED');

-- Sealing never revoked the door PIN; a sealed unit must not open with the tenant's code.
UPDATE bookings b
SET access_pin = NULL, qr_access_token = 'REVOKED_OVERDUE', status = 'OVERDUE', updated_at = NOW()
FROM rental_contracts c
WHERE c.booking_id = b.id
  AND b.status = 'ACTIVE'
  AND EXISTS (SELECT 1 FROM sealing_records s WHERE s.contract_id = c.id AND s.status = 'SEALED');

-- Records created by the old job had no protocol number, which the printable protocol needs.
UPDATE sealing_records
SET protocol_number = 'BBNP-' || to_char(sealed_at, 'YYYYMMDD') || '-' || upper(substr(replace(id::text, '-', ''), 1, 8))
WHERE protocol_number IS NULL;

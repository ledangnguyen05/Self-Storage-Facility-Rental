-- =========================================================================
-- V41: Enhance Support Tickets with Facility Scoping, SLA Due Date,
-- Timestamps, and Management Contact Logs (Facility Manager -> BOM)
-- =========================================================================

-- 1. Add facility_id, sla_due_at, resolved_at, closed_at to support_tickets
ALTER TABLE support_tickets
    ADD COLUMN IF NOT EXISTS facility_id UUID REFERENCES facilities(id),
    ADD COLUMN IF NOT EXISTS sla_due_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP;

-- 2. Backfill facility_id from linked bookings -> storage_units
UPDATE support_tickets st
SET facility_id = su.facility_id
FROM bookings b
JOIN storage_units su ON b.storage_unit_id = su.id
WHERE st.booking_id = b.id AND st.facility_id IS NULL;

-- 3. Fallback backfill for any remaining tickets without linked booking
UPDATE support_tickets st
SET facility_id = (SELECT id FROM facilities ORDER BY created_at ASC LIMIT 1)
WHERE st.facility_id IS NULL;

-- 4. Backfill sla_due_at (24h default SLA window from ticket creation)
UPDATE support_tickets
SET sla_due_at = created_at + INTERVAL '24 hours'
WHERE sla_due_at IS NULL;

-- 5. Backfill resolved_at and closed_at for existing resolved/closed tickets
UPDATE support_tickets
SET resolved_at = updated_at
WHERE status = 'RESOLVED' AND resolved_at IS NULL;

UPDATE support_tickets
SET closed_at = updated_at
WHERE status = 'CLOSED' AND closed_at IS NULL;

-- 6. Create table support_ticket_contact_logs for recording escalation communications
CREATE TABLE IF NOT EXISTS support_ticket_contact_logs (
    id                  UUID NOT NULL,
    ticket_id           UUID NOT NULL,
    contact_method      VARCHAR(50) NOT NULL,
    contacted_by        UUID NOT NULL,
    target_role         VARCHAR(50) NOT NULL DEFAULT 'BUSINESS_MANAGER',
    contact_target      VARCHAR(255) NOT NULL,
    summary             TEXT NOT NULL,
    result              TEXT,
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_support_ticket_contact_logs PRIMARY KEY (id),
    CONSTRAINT fk_stcl_ticket FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
    CONSTRAINT fk_stcl_contacted_by FOREIGN KEY (contacted_by) REFERENCES users(id)
);

-- 7. Performance & filtering indexes
CREATE INDEX IF NOT EXISTS idx_support_tickets_facility_id ON support_tickets(facility_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned_staff ON support_tickets(assigned_staff_id);
CREATE INDEX IF NOT EXISTS idx_stcl_ticket_id ON support_ticket_contact_logs(ticket_id);

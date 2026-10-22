-- V80: Enhance support tickets with storage unit linkage, staff recording audit, and creator tracking
ALTER TABLE support_tickets
    ADD COLUMN IF NOT EXISTS storage_unit_id UUID,
    ADD COLUMN IF NOT EXISTS created_by_staff_id UUID,
    ADD COLUMN IF NOT EXISTS is_staff_recorded BOOLEAN DEFAULT FALSE;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_support_tickets_storage_unit'
    ) THEN
        ALTER TABLE support_tickets
            ADD CONSTRAINT fk_support_tickets_storage_unit
            FOREIGN KEY (storage_unit_id) REFERENCES storage_units(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_support_tickets_created_by_staff'
    ) THEN
        ALTER TABLE support_tickets
            ADD CONSTRAINT fk_support_tickets_created_by_staff
            FOREIGN KEY (created_by_staff_id) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_support_tickets_storage_unit ON support_tickets(storage_unit_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_by_staff ON support_tickets(created_by_staff_id);

-- Backfill storage_unit_id from bookings where available
UPDATE support_tickets st
SET storage_unit_id = b.storage_unit_id
FROM bookings b
WHERE st.booking_id = b.id AND st.storage_unit_id IS NULL AND b.storage_unit_id IS NOT NULL;

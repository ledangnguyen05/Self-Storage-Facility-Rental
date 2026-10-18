-- Persist each inbound inspection decision so check-in cannot trust client state.
-- Existing records remain nullable and are not retroactively treated as passed.
ALTER TABLE handover_records
    ADD COLUMN IF NOT EXISTS door_condition_passed BOOLEAN,
    ADD COLUMN IF NOT EXISTS cleanliness_passed BOOLEAN,
    ADD COLUMN IF NOT EXISTS smart_lock_passed BOOLEAN,
    ADD COLUMN IF NOT EXISTS sensor_passed BOOLEAN,
    ADD COLUMN IF NOT EXISTS wall_structure_passed BOOLEAN;

ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS identity_original_document_seen BOOLEAN;

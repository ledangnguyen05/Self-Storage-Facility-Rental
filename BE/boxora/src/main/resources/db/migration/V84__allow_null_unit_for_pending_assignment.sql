-- V84__allow_null_unit_for_pending_assignment.sql
-- Cho phép storage_unit_id và unit_id null khi đơn hàng ở trạng thái chờ gán ô kho vật lý (PAID_PENDING_ASSIGNMENT / PENDING_CONTACT)

ALTER TABLE bookings ALTER COLUMN storage_unit_id DROP NOT NULL;
ALTER TABLE rental_contracts ALTER COLUMN unit_id DROP NOT NULL;

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS facility_id UUID REFERENCES facilities(id);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS unit_type_id UUID REFERENCES unit_types(id);

UPDATE bookings b
SET facility_id = su.facility_id,
    unit_type_id = su.unit_type_id
FROM storage_units su
WHERE b.storage_unit_id = su.id AND (b.facility_id IS NULL OR b.unit_type_id IS NULL);

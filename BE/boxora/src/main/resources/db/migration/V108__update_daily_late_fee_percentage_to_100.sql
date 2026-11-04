-- V100: Set default daily late fee percentage to 100% for all facilities
ALTER TABLE facility_policies
    ALTER COLUMN daily_late_fee SET DEFAULT 100.00;

UPDATE facility_policies
SET daily_late_fee = 100.00,
    updated_at = CURRENT_TIMESTAMP;


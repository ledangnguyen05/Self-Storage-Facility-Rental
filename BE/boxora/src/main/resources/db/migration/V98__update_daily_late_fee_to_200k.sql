-- V98: Update Daily Late Fee to 200,000 VND / day
ALTER TABLE facility_policies
    ALTER COLUMN daily_late_fee SET DEFAULT 200000.00;

UPDATE facility_policies
SET
    daily_late_fee = 200000.00,
    updated_at = CURRENT_TIMESTAMP;

-- V88: Add checkin_overdue_reminder_sent_at column to bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS checkin_overdue_reminder_sent_at TIMESTAMP;

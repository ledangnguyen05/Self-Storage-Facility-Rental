ALTER TABLE facility_policies
    ALTER COLUMN hold_grace_hours SET DEFAULT 1;

UPDATE facility_policies
SET hold_grace_hours = LEAST(GREATEST(hold_grace_hours, 0), 1);

UPDATE bookings
SET hold_expires_at = LEAST(
        COALESCE(hold_expires_at, (created_at AT TIME ZONE 'Asia/Ho_Chi_Minh') + INTERVAL '15 minutes'),
        (created_at AT TIME ZONE 'Asia/Ho_Chi_Minh') + INTERVAL '15 minutes'
    ),
    payment_expires_at = LEAST(
        COALESCE(payment_expires_at, (created_at AT TIME ZONE 'Asia/Ho_Chi_Minh') + INTERVAL '15 minutes'),
        (created_at AT TIME ZONE 'Asia/Ho_Chi_Minh') + INTERVAL '15 minutes'
    )
WHERE status = 'PENDING_PAYMENT'
  AND COALESCE(payment_status, 'UNPAID') <> 'PAID';

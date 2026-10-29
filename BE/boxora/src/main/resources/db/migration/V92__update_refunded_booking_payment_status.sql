-- V92: Sync payment_status to REFUNDED for bookings with processed refunds
UPDATE bookings
SET payment_status = 'REFUNDED', status = 'CANCELLED'
WHERE id IN (
    SELECT booking_id FROM refund_requests
    WHERE status IN ('AWAITING_CUSTOMER_CONFIRMATION', 'PROCESSED', 'COMPLETED', 'RECONCILED')
      AND booking_id IS NOT NULL
);


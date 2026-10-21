-- Indexes behind the revenue, monthly trend, payment-channel and overdue-debt reports.
-- The reports filter payments by status and payment time, join them to bookings/contracts to find the facility,
-- and the overdue ledger looks contracts up by status and end date. All statements are idempotent.

CREATE INDEX IF NOT EXISTS idx_payments_status_payment_time ON payments (status, payment_time);
CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON payments (booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_contract_id ON payments (contract_id);
CREATE INDEX IF NOT EXISTS idx_rental_contracts_status_end_date ON rental_contracts (status, end_date);

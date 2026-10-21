-- =========================================================================
-- V48: Billing breakdown on payments, renewal pricing / in-app signing,
--      refund bank details provided by the customer, data clean-up of
--      placeholder values that were shown to users as if they were real.
-- =========================================================================

-- 1. payments: part of a RENTAL_FEE / RENEWAL_FEE payment that settles the late fee and the rent
--    for the time the tenant kept the unit after the term; extension_days is how far the contract
--    end date moves when an overdue settlement is paid (one 30-day block per started block).
ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS late_fee_amount     NUMERIC(15, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS overdue_rent_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS extension_days      INTEGER        NOT NULL DEFAULT 0;

-- 2. contract_renewals: fee breakdown (rent from the pricing quote + late fee of an overdue contract),
--    the in-app signature used when DocuSeal is not configured, and cancellation by the customer.
ALTER TABLE contract_renewals
    ADD COLUMN IF NOT EXISTS rental_fee_amount NUMERIC(15, 2),
    ADD COLUMN IF NOT EXISTS late_fee_amount   NUMERIC(15, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS signature_data    TEXT,
    ADD COLUMN IF NOT EXISTS signing_method    VARCHAR(30),
    ADD COLUMN IF NOT EXISTS cancelled_at      TIMESTAMP,
    ADD COLUMN IF NOT EXISTS cancel_reason     VARCHAR(500);

UPDATE contract_renewals SET rental_fee_amount = renewal_fee WHERE rental_fee_amount IS NULL;

-- 3. refund_requests: the bank account is supplied by the customer (possibly after the request is
--    created); placeholder strings such as 'CHỜ_CẬP_NHẬT' / 'N/A' must never look like real data.
ALTER TABLE refund_requests ALTER COLUMN bank_name DROP NOT NULL;
ALTER TABLE refund_requests ALTER COLUMN bank_account_number DROP NOT NULL;
ALTER TABLE refund_requests ALTER COLUMN bank_account_name DROP NOT NULL;

ALTER TABLE refund_requests
    ADD COLUMN IF NOT EXISTS transfer_evidence_url VARCHAR(500),
    ADD COLUMN IF NOT EXISTS bank_info_updated_at  TIMESTAMP;

UPDATE refund_requests
SET bank_account_number = NULL
WHERE bank_account_number IS NOT NULL
  AND (TRIM(bank_account_number) IN ('', 'N/A', 'CHỜ_CẬP_NHẬT') OR bank_account_number !~ '[0-9]');

UPDATE refund_requests
SET bank_name = NULL
WHERE bank_name IS NOT NULL
  AND TRIM(bank_name) IN ('', 'N/A', 'CHỜ_CẬP_NHẬT', 'BANK_TRANSFER', 'VNPAY_REFUND', 'CASH', 'Chuyển khoản / VNPay');

UPDATE refund_requests
SET bank_account_name = NULL
WHERE bank_account_name IS NOT NULL
  AND TRIM(bank_account_name) IN ('', 'N/A', 'CHỜ_CẬP_NHẬT', 'KHACH_HANG');

CREATE INDEX IF NOT EXISTS idx_refund_requests_facility_status ON refund_requests (facility_id, status);
CREATE INDEX IF NOT EXISTS idx_refund_requests_customer ON refund_requests (customer_id);

-- 4. rental_contracts: seeded / simulated "signed document" links point to files that do not exist.
UPDATE rental_contracts
SET signed_document_url = NULL
WHERE signed_document_url LIKE 'https://boxora.vn/contracts/signed/%'
   OR signed_document_url LIKE 'https://docuseal.com/documents/contract-%-signed.pdf';

-- 5. rental_contracts: the deposit held is the deposit actually collected on the booking
--    (counter payments and check-in only updated the booking).
UPDATE rental_contracts c
SET deposit_held = b.deposit_paid
FROM bookings b
WHERE c.booking_id = b.id
  AND b.deposit_paid IS NOT NULL
  AND b.deposit_paid > COALESCE(c.deposit_held, 0)
  AND c.status IN ('PENDING_SIGNATURE', 'PENDING_VERIFICATION', 'PENDING_ACTIVATION', 'ACTIVE', 'OVERDUE', 'OVERDUE_LOCKED');

-- 6. rental_contracts not signed yet: monthly fee = discounted monthly rent the customer was quoted
--    (booking total / months), not the undiscounted list price.
UPDATE rental_contracts c
SET monthly_fee = ROUND(b.total_rental_fee / b.rental_months, 2)
FROM bookings b
WHERE c.booking_id = b.id
  AND c.status = 'PENDING_SIGNATURE'
  AND c.signed_at IS NULL
  AND b.rental_months > 0
  AND b.total_rental_fee > 0;

-- 7. Booking codes are generated as BX-<year>-<6 chars>; lookups by code must stay cheap.
CREATE INDEX IF NOT EXISTS idx_bookings_facility_lookup ON bookings (storage_unit_id, status);

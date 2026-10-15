-- =========================================================================
-- V32: Add signing_method to bookings and sanitize dummy contract URLs
--      1. Add signing_method (ONLINE / IN_PERSON) to bookings table
--      2. Sanitize dummy https://boxora.vn URLs to internal / mock URLs
-- =========================================================================

-- 1. Add signing_method to bookings
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS signing_method VARCHAR(30) DEFAULT 'ONLINE';

COMMENT ON COLUMN bookings.signing_method IS 'Contract signing option: ONLINE (DocuSeal e-sign) or IN_PERSON (at facility counter)';

-- 2. Add assigned_staff_id to bookings if not already present
-- Note: handed_over_by_staff_id is already present, but we can also ensure assigned staff note
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS staff_assignment_notes TEXT;

-- 3. Sanitize invalid dummy https://boxora.vn URLs in rental_contracts
-- Replace with clean internal placeholder URL so it does not trigger DNS NXDOMAIN errors
UPDATE rental_contracts
SET signed_document_url = REPLACE(signed_document_url, 'https://boxora.vn', 'https://docuseal.com')
WHERE signed_document_url LIKE 'https://boxora.vn%';

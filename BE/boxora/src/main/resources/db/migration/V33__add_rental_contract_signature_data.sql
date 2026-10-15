-- =========================================================================
-- V33: Add signature_data to rental_contracts
--      Stores customer's handwritten e-signature data (base64 image or vector)
-- =========================================================================

ALTER TABLE rental_contracts
ADD COLUMN IF NOT EXISTS signature_data TEXT;

COMMENT ON COLUMN rental_contracts.signature_data IS 'Base64 PNG data URL or serialized stroke representation of the customer handwritten signature';

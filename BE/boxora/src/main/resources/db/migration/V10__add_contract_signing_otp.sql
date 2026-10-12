CREATE TABLE IF NOT EXISTS contract_signing_otps
(
    id UUID NOT NULL PRIMARY KEY,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    contract_id UUID NOT NULL UNIQUE REFERENCES rental_contracts (id) ON DELETE CASCADE,
    otp_hash VARCHAR(100) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    last_sent_at TIMESTAMP NOT NULL,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    verified_at TIMESTAMP,
    revoked BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_contract_signing_otps_expiry
    ON contract_signing_otps (expires_at);

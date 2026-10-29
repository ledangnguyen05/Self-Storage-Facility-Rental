-- V93: Add transfer proof URL to refund_requests for manager payment evidence
ALTER TABLE refund_requests
    ADD COLUMN IF NOT EXISTS transfer_proof_url TEXT;


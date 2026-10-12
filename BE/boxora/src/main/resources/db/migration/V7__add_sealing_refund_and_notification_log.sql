-- =========================================================
-- V7: Add Sealing Records, Refund Requests, and Notification Logs
-- =========================================================

-- 1. SEALING RECORDS (Biên bản niêm phong kho & khóa cưỡng chế)
CREATE TABLE IF NOT EXISTS sealing_records
(
    id                  UUID            NOT NULL,
    created_at          TIMESTAMP       NOT NULL,
    updated_at          TIMESTAMP       NOT NULL,
    protocol_number     VARCHAR(60)     NOT NULL,
    contract_id         UUID            NOT NULL,
    unit_id             UUID            NOT NULL,
    facility_id         UUID            NOT NULL,
    performed_by_id     UUID            NOT NULL,
    witness_id          UUID            NOT NULL,
    seal_tag_number     VARCHAR(100)    NOT NULL,
    reason              VARCHAR(500)    NOT NULL,
    overdue_days        BIGINT          NOT NULL DEFAULT 0,
    total_debt_amount   NUMERIC(15,2)   NOT NULL DEFAULT 0,
    inventory_summary   TEXT,
    notes               TEXT,
    evidence_urls       TEXT,
    status              VARCHAR(30)     NOT NULL DEFAULT 'SEALED',
    sealed_at           TIMESTAMP       NOT NULL,
    unsealed_at         TIMESTAMP,
    unsealed_by_id      UUID,
    unseal_reason       VARCHAR(500),

    CONSTRAINT pk_sealing_records PRIMARY KEY (id),
    CONSTRAINT uc_sealing_protocol_number UNIQUE (protocol_number),
    CONSTRAINT fk_sealing_contract FOREIGN KEY (contract_id) REFERENCES rental_contracts(id),
    CONSTRAINT fk_sealing_unit FOREIGN KEY (unit_id) REFERENCES storage_units(id),
    CONSTRAINT fk_sealing_facility FOREIGN KEY (facility_id) REFERENCES facilities(id),
    CONSTRAINT fk_sealing_performed_by FOREIGN KEY (performed_by_id) REFERENCES users(id),
    CONSTRAINT fk_sealing_witness FOREIGN KEY (witness_id) REFERENCES users(id),
    CONSTRAINT fk_sealing_unsealed_by FOREIGN KEY (unsealed_by_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_sealing_contract_id ON sealing_records(contract_id);
CREATE INDEX IF NOT EXISTS idx_sealing_unit_id ON sealing_records(unit_id);
CREATE INDEX IF NOT EXISTS idx_sealing_facility_id ON sealing_records(facility_id);
CREATE INDEX IF NOT EXISTS idx_sealing_status ON sealing_records(status);

-- 2. REFUND REQUESTS (Quy trình duyệt hoàn tiền PENDING_REVIEW -> APPROVED -> PROCESSED)
CREATE TABLE IF NOT EXISTS refund_requests
(
    id                      UUID            NOT NULL,
    created_at              TIMESTAMP       NOT NULL,
    updated_at              TIMESTAMP       NOT NULL,
    request_code            VARCHAR(60)     NOT NULL,
    customer_id             UUID            NOT NULL,
    facility_id             UUID            NOT NULL,
    booking_id              UUID,
    contract_id             UUID,
    requested_amount        NUMERIC(15,2)   NOT NULL,
    deduction_amount        NUMERIC(15,2)   NOT NULL DEFAULT 0,
    final_refund_amount     NUMERIC(15,2)   NOT NULL,
    bank_name               VARCHAR(100)    NOT NULL,
    bank_account_number     VARCHAR(50)     NOT NULL,
    bank_account_name       VARCHAR(100)    NOT NULL,
    reason                  VARCHAR(500)    NOT NULL,
    status                  VARCHAR(30)     NOT NULL DEFAULT 'PENDING_REVIEW',

    requested_by_id         UUID            NOT NULL,
    reviewed_by_id          UUID,
    reviewed_at             TIMESTAMP,
    review_note             VARCHAR(500),
    rejection_reason        VARCHAR(500),

    processed_by_id         UUID,
    processed_at            TIMESTAMP,
    transaction_reference   VARCHAR(100),
    process_notes           VARCHAR(500),

    CONSTRAINT pk_refund_requests PRIMARY KEY (id),
    CONSTRAINT uc_refund_request_code UNIQUE (request_code),
    CONSTRAINT fk_refund_customer FOREIGN KEY (customer_id) REFERENCES users(id),
    CONSTRAINT fk_refund_facility FOREIGN KEY (facility_id) REFERENCES facilities(id),
    CONSTRAINT fk_refund_booking FOREIGN KEY (booking_id) REFERENCES bookings(id),
    CONSTRAINT fk_refund_contract FOREIGN KEY (contract_id) REFERENCES rental_contracts(id),
    CONSTRAINT fk_refund_requested_by FOREIGN KEY (requested_by_id) REFERENCES users(id),
    CONSTRAINT fk_refund_reviewed_by FOREIGN KEY (reviewed_by_id) REFERENCES users(id),
    CONSTRAINT fk_refund_processed_by FOREIGN KEY (processed_by_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_refund_customer_id ON refund_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_refund_facility_id ON refund_requests(facility_id);
CREATE INDEX IF NOT EXISTS idx_refund_status ON refund_requests(status);

-- 3. NOTIFICATION LOGS (Lịch sử gửi thông báo & Tránh gửi trùng nhắc gia hạn -7/-3)
CREATE TABLE IF NOT EXISTS notification_logs
(
    id                  UUID            NOT NULL,
    created_at          TIMESTAMP       NOT NULL,
    updated_at          TIMESTAMP       NOT NULL,
    recipient_id        UUID,
    recipient_email     VARCHAR(255)    NOT NULL,
    recipient_name      VARCHAR(100),
    facility_id         UUID,
    channel             VARCHAR(30)     NOT NULL DEFAULT 'EMAIL',
    notification_type   VARCHAR(50)     NOT NULL,
    reference_type      VARCHAR(50),
    reference_id        UUID,
    title               VARCHAR(255)    NOT NULL,
    content             TEXT,
    status              VARCHAR(30)     NOT NULL DEFAULT 'SENT',

    CONSTRAINT pk_notification_logs PRIMARY KEY (id),
    CONSTRAINT fk_notification_recipient FOREIGN KEY (recipient_id) REFERENCES users(id),
    CONSTRAINT fk_notification_facility FOREIGN KEY (facility_id) REFERENCES facilities(id)
);

CREATE INDEX IF NOT EXISTS idx_notif_recipient ON notification_logs(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notif_type_ref ON notification_logs(notification_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_notif_created_at ON notification_logs(created_at);

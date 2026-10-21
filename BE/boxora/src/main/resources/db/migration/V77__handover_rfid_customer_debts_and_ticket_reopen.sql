-- =========================================================================
-- V51: Handover RFID card, unrecovered customer debts after return settlement,
--      support ticket reopen tracking.
-- =========================================================================

-- 1. RFID card number was only appended to the free-text notes of the check-in record.
ALTER TABLE handover_records
    ADD COLUMN IF NOT EXISTS rfid_card_number VARCHAR(100);

-- 2. Debts the customer still owes after deductions exceeded the deposit at return time.
CREATE TABLE IF NOT EXISTS customer_debts (
    id                  UUID           NOT NULL,
    customer_id         UUID           NOT NULL,
    booking_id          UUID,
    facility_id         UUID,
    handover_record_id  UUID,
    amount              NUMERIC(15, 2) NOT NULL,
    reason              VARCHAR(500)   NOT NULL,
    status              VARCHAR(30)    NOT NULL DEFAULT 'OPEN',
    created_by_id       UUID,
    resolved_by_id      UUID,
    resolved_at         TIMESTAMP,
    resolution_note     VARCHAR(500),
    created_at          TIMESTAMP      NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP      NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_customer_debts PRIMARY KEY (id),
    CONSTRAINT fk_customer_debts_customer FOREIGN KEY (customer_id) REFERENCES users (id),
    CONSTRAINT fk_customer_debts_booking FOREIGN KEY (booking_id) REFERENCES bookings (id),
    CONSTRAINT fk_customer_debts_facility FOREIGN KEY (facility_id) REFERENCES facilities (id),
    CONSTRAINT fk_customer_debts_handover FOREIGN KEY (handover_record_id) REFERENCES handover_records (id),
    CONSTRAINT fk_customer_debts_created_by FOREIGN KEY (created_by_id) REFERENCES users (id),
    CONSTRAINT fk_customer_debts_resolved_by FOREIGN KEY (resolved_by_id) REFERENCES users (id)
);

CREATE INDEX IF NOT EXISTS idx_customer_debts_customer ON customer_debts (customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_debts_facility_status ON customer_debts (facility_id, status);
CREATE INDEX IF NOT EXISTS idx_customer_debts_booking ON customer_debts (booking_id);

-- 3. Support tickets: the reopen reason and counter used to be glued into resolution_note.
ALTER TABLE support_tickets
    ADD COLUMN IF NOT EXISTS reopen_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS reopen_reason TEXT;

-- Tickets that are currently reopened were reopened at least once; recover the last reason from the note.
UPDATE support_tickets
SET reopen_count = 1,
    reopen_reason = NULLIF(TRIM(substring(resolution_note FROM '.*\[REOPEN YÊU CẦU XỬ LÝ LẠI\]: ([^\n]*)')), '')
WHERE status = 'REOPENED' AND reopen_count = 0;

-- reopenTicket used to concatenate onto a NULL note, leaving a literal "null" prefix behind.
UPDATE support_tickets
SET resolution_note = regexp_replace(resolution_note, '^null' || E'\n', '')
WHERE resolution_note LIKE 'null' || E'\n' || '%';

UPDATE support_tickets
SET resolution_note = NULL
WHERE resolution_note = 'null';

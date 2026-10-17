-- =========================================================================
-- V40: Add Booking Reschedule History table for append-only audit tracking
-- =========================================================================

CREATE TABLE IF NOT EXISTS booking_reschedule_histories (
    id                          UUID PRIMARY KEY,
    created_at                  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    booking_id                  UUID NOT NULL,
    change_type                 VARCHAR(50) NOT NULL DEFAULT 'CHECKIN_RESCHEDULE',

    previous_appointment_at     TIMESTAMP NOT NULL,
    requested_appointment_at    TIMESTAMP NOT NULL,
    accepted_appointment_at     TIMESTAMP NOT NULL,

    previous_expected_start_date DATE NOT NULL,
    previous_expected_end_date   DATE NOT NULL,
    new_expected_start_date      DATE NOT NULL,
    new_expected_end_date        DATE NOT NULL,

    previous_hold_expires_at    TIMESTAMP WITH TIME ZONE,
    new_hold_expires_at         TIMESTAMP WITH TIME ZONE,

    requester_id                UUID,
    requester_role              VARCHAR(50),
    request_timestamp           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reason                      TEXT,

    processor_id                UUID,
    processor_role              VARCHAR(50),
    processed_at                TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    outcome                     VARCHAR(30) NOT NULL DEFAULT 'CONFIRMED',
    rejection_reason            TEXT,

    previous_booking_status     VARCHAR(30) NOT NULL,
    resulting_booking_status    VARCHAR(30) NOT NULL,

    contract_amendment_required BOOLEAN NOT NULL DEFAULT FALSE,
    contract_amendment_notes    TEXT,

    CONSTRAINT fk_reschedule_booking
        FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    CONSTRAINT fk_reschedule_requester
        FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_reschedule_processor
        FOREIGN KEY (processor_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_reschedule_history_booking_created
    ON booking_reschedule_histories (booking_id, created_at DESC);

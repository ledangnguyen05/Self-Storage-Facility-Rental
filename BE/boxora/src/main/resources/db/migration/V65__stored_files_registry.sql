-- =========================================================================
-- V65: Registry of uploaded evidence files.
--      Every file stored under /uploads is now recorded with its uploader, category and (when known) the booking
--      and facility it belongs to. The file endpoint only serves a file through a short-lived signed link, and the
--      API only hands out such a link to users who may see the record that references the file.
-- =========================================================================

CREATE TABLE IF NOT EXISTS stored_files (
    id              UUID         NOT NULL,
    url_path        VARCHAR(300) NOT NULL,
    category        VARCHAR(40)  NOT NULL,
    original_name   VARCHAR(255),
    content_type    VARCHAR(100),
    size_bytes      BIGINT,
    uploaded_by_id  UUID,
    facility_id     UUID,
    booking_id      UUID,
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP    NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_stored_files PRIMARY KEY (id),
    CONSTRAINT uq_stored_files_url_path UNIQUE (url_path)
);

CREATE INDEX IF NOT EXISTS idx_stored_files_booking ON stored_files (booking_id);
CREATE INDEX IF NOT EXISTS idx_stored_files_uploader ON stored_files (uploaded_by_id);
CREATE INDEX IF NOT EXISTS idx_stored_files_category_created ON stored_files (category, created_at);

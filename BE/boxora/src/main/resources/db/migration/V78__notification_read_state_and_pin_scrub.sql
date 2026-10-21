-- =========================================================================
-- V52: Server-side read state for in-app notifications and removal of the
--      plaintext door PIN that older handovers wrote into notification_logs.
-- =========================================================================

ALTER TABLE notification_logs
    ADD COLUMN IF NOT EXISTS read_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_notification_logs_recipient_read
    ON notification_logs (recipient_id, read_at);

-- Handover notifications used to say "... của bạn là: 123456. ..." which defeated the AES-256 PIN storage.
UPDATE notification_logs
SET content = regexp_replace(content, 'là: [0-9]{6}[.]', 'đã được cấp. Xem mã trong mục Mã truy cập của bạn.', 'g')
WHERE notification_type = 'HANDOVER_PIN'
  AND content ~ 'là: [0-9]{6}[.]';

-- Catch-all for any other stored copy of a 6-digit code in a handover notification.
UPDATE notification_logs
SET content = regexp_replace(content, '(^|[^0-9])[0-9]{6}([^0-9]|$)', '\1******\2', 'g')
WHERE notification_type = 'HANDOVER_PIN'
  AND content ~ '(^|[^0-9])[0-9]{6}([^0-9]|$)';

-- V60: e-mail addresses are case-insensitive, and refresh tokens remember why they were revoked.

-- ---------------------------------------------------------------------------------------------------------------
-- 1. Case-insensitive e-mail identity
--
-- "Ngoc@Gmail.com" and "ngoc@gmail.com" are the same mailbox, but the old unique constraint compared them
-- case-sensitively, so one person could own two accounts and could only sign in with the exact spelling used at
-- sign-up. From now on the application stores and compares the lower-case form.
--
-- Accounts that already collide once lower-cased are the same mailbox registered twice. Nothing is deleted:
-- the OLDEST account keeps the address; every newer twin is renamed to <local>+dup-<8 chars of its id>@<domain>
-- (unique and clearly marked, so an administrator can review / merge it and nobody can sign in to the wrong one).
-- ---------------------------------------------------------------------------------------------------------------
WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY lower(email) ORDER BY created_at, id) AS rn
    FROM users
)
UPDATE users u
SET email = CASE
                WHEN position('@' IN u.email) > 0
                    THEN lower(substring(u.email FROM 1 FOR position('@' IN u.email) - 1))
                         || '+dup-' || substr(replace(u.id::text, '-', ''), 1, 8)
                         || lower(substring(u.email FROM position('@' IN u.email)))
                ELSE lower(u.email) || '+dup-' || substr(replace(u.id::text, '-', ''), 1, 8)
            END
FROM ranked r
WHERE r.id = u.id
  AND r.rn > 1;

UPDATE users
SET email = lower(email)
WHERE email <> lower(email);

-- The application looks accounts up with lower(email) = lower(?), so this index serves those queries and is the
-- last line of defence against two simultaneous sign-ups with the same address.
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email_lower ON users (lower(email));

-- ---------------------------------------------------------------------------------------------------------------
-- 2. Why a token was revoked
--
-- Only a ROTATED token that is presented again means the token was copied (the legitimate client threw it away
-- when it received the successor). A token ended by sign-out, the device cap, a password change or a lock is just
-- a stale session: presenting it must not sign the user out of their other devices.
-- ---------------------------------------------------------------------------------------------------------------
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS revoked_reason VARCHAR(30);

-- Best-effort backfill: a rotation stamps last_used_at with the moment of the exchange, whereas a token that
-- was never exchanged keeps last_used_at = created_at.
UPDATE refresh_tokens
SET revoked_reason = 'ROTATED'
WHERE revoked = TRUE
  AND type = 'REFRESH'
  AND revoked_reason IS NULL
  AND last_used_at > created_at + INTERVAL '1 second';

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_type_revoked ON refresh_tokens (user_id, type, revoked);

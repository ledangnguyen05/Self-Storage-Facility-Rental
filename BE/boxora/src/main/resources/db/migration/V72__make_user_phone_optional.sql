-- Accounts created with Google sign-in have no phone number until the customer completes the profile.
-- Previously a fake placeholder (0000000000) was stored, which failed the profile phone validation.
ALTER TABLE users ALTER COLUMN phone DROP NOT NULL;

UPDATE users SET phone = NULL WHERE phone = '0000000000';

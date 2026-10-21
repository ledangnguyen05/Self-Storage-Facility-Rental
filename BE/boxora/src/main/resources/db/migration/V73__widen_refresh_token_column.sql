-- Refresh / reset-password tokens are JWTs. They now carry a unique jti claim (two tokens issued in the same second
-- used to be identical, violating the unique constraint), which makes them longer than the old varchar(255).
ALTER TABLE refresh_tokens ALTER COLUMN token TYPE VARCHAR(1024);

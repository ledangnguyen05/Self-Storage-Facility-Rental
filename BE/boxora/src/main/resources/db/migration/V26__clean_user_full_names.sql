-- =========================================================================
-- V26: Clean user full_name by removing role and facility suffix codes
-- =========================================================================

UPDATE users
SET full_name = TRIM(REGEXP_REPLACE(full_name, '\s*\([^)]*\)', '', 'g'))
WHERE full_name LIKE '%(%';

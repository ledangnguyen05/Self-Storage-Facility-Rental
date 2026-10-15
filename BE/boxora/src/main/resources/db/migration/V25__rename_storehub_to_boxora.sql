-- =========================================================================
-- V25: Rename StoreHub to Boxora across all facility records
-- =========================================================================

UPDATE facilities
SET name = REPLACE(name, 'StoreHub', 'Boxora'),
    email = REPLACE(email, 'storehub', 'boxora')
WHERE name LIKE '%StoreHub%' OR email LIKE '%storehub%';

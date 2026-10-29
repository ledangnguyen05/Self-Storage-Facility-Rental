-- V94: Grant HANDOVER_VIEW to BUSINESS_MANAGER for read-only supervisory access
-- Ensures Business Manager can view handover prerequisites and records without performing operational check-in mutations.

INSERT INTO role_permissions (id, created_at, updated_at, role_id, permission_id, is_active, description)
SELECT gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, r.id, p.id, TRUE,
       'V94 grant handover view to business manager for supervisory mode'
FROM roles r
JOIN permissions p ON p.name = 'HANDOVER_VIEW'
WHERE r.name = 'BUSINESS_MANAGER'
ON CONFLICT (role_id, permission_id) DO UPDATE
SET is_active = TRUE,
    description = EXCLUDED.description;

-- Ensure BUSINESS_MANAGER does NOT have operational check-in permissions
UPDATE role_permissions rp
SET is_active = FALSE,
    description = 'Revoked operational permissions from BUSINESS_MANAGER by V94'
FROM roles r, permissions p
WHERE rp.role_id = r.id
  AND p.id = rp.permission_id
  AND r.name = 'BUSINESS_MANAGER'
  AND p.name IN ('HANDOVER_CREATE');

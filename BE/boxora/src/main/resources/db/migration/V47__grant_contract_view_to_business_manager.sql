-- V47: Grant CONTRACT_VIEW to BUSINESS_MANAGER so operations dashboards can monitor contracts and renewals
INSERT INTO role_permissions (id, created_at, updated_at, role_id, permission_id, is_active, description)
SELECT gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, r.id, p.id, TRUE,
       'V47 grant contract view to business manager'
FROM roles r
JOIN permissions p ON p.name = 'CONTRACT_VIEW'
WHERE r.name = 'BUSINESS_MANAGER'
ON CONFLICT (role_id, permission_id) DO UPDATE
SET is_active = TRUE,
    description = EXCLUDED.description;

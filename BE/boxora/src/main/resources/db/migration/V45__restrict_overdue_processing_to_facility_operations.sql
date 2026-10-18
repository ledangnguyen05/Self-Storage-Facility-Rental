-- Chain-wide managers may review overdue reports, but the actions remain facility operations.
UPDATE role_permissions rp
SET is_active = FALSE,
    description = 'Removed from default BUSINESS_MANAGER overdue operation permissions by V45'
FROM roles r, permissions p
WHERE rp.role_id = r.id
  AND p.id = rp.permission_id
  AND r.name = 'BUSINESS_MANAGER'
  AND p.name = 'OVERDUE_PROCESS';

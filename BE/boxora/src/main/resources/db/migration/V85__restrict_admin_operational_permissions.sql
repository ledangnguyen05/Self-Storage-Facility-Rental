-- V85: Restrict ADMIN role to read-only oversight for renewals, handovers, and payments.
-- Admin can only view renewal requests, handover schedules, and dossier records without performing mutations.

UPDATE role_permissions rp
SET is_active = FALSE,
    description = 'Revoked from default ADMIN operational permissions by V85 (view-only oversight)'
FROM roles r, permissions p
WHERE rp.role_id = r.id
  AND p.id = rp.permission_id
  AND r.name = 'ADMIN'
  AND p.name IN (
      'RENEWAL_APPROVE',
      'RENEWAL_CREATE',
      'HANDOVER_CREATE',
      'PAYMENT_CREATE'
  );

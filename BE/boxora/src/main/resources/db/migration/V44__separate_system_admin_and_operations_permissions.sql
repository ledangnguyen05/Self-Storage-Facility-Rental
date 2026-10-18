-- Keep system administration focused on account, RBAC, configuration and oversight.
-- Permission rows remain in place so history and explicit later grants are preserved.
UPDATE role_permissions rp
SET is_active = FALSE,
    description = 'Removed from default ADMIN operational permissions by V44'
FROM roles r, permissions p
WHERE rp.role_id = r.id
  AND p.id = rp.permission_id
  AND r.name = 'ADMIN'
  AND p.name IN (
      'FACILITY_CREATE', 'FACILITY_UPDATE', 'FACILITY_DELETE',
      'STORAGE_UNIT_CREATE', 'STORAGE_UNIT_UPDATE', 'STORAGE_UNIT_DELETE',
      'UNIT_TYPE_CREATE', 'UNIT_TYPE_UPDATE', 'UNIT_TYPE_DELETE',
      'POLICY_CREATE', 'POLICY_UPDATE', 'POLICY_DELETE',
      'BOOKING_CREATE', 'BOOKING_UPDATE', 'BOOKING_CANCEL',
      'CONTRACT_CREATE', 'CONTRACT_UPDATE',
      'HANDOVER_CREATE',
      'ACCESS_CREDENTIAL_UPDATE', 'ACCESS_CREDENTIAL_REVOKE',
      'PAYMENT_CREATE', 'PRICE_ADJUST',
      'FEE_CREATE', 'FEE_UPDATE', 'FEE_DELETE',
      'SEALING_CREATE', 'SEALING_UNSEAL',
      'RENEWAL_CREATE', 'OVERDUE_PROCESS',
      'REFUND_APPROVE',
      'DISCOUNT_CREATE', 'DISCOUNT_UPDATE', 'DISCOUNT_DELETE',
      'SUPPORT_CREATE', 'SUPPORT_UPDATE',
      'STAFF_ASSIGNMENT_CREATE', 'STAFF_ASSIGNMENT_DELETE'
  );

-- Business managers retain chain reports and business configuration, while routine
-- booking, warehouse-status, and payment collection writes remain facility operations.
UPDATE role_permissions rp
SET is_active = FALSE,
    description = 'Removed from default BUSINESS_MANAGER operational permissions by V44'
FROM roles r, permissions p
WHERE rp.role_id = r.id
  AND p.id = rp.permission_id
  AND r.name = 'BUSINESS_MANAGER'
  AND p.name IN (
      'STORAGE_UNIT_CREATE', 'STORAGE_UNIT_UPDATE', 'STORAGE_UNIT_DELETE',
      'BOOKING_CREATE', 'BOOKING_UPDATE', 'BOOKING_CANCEL',
      'PAYMENT_CREATE', 'SEALING_CREATE', 'SEALING_UNSEAL'
  );

-- Separate ticket oversight from facility actions. These use the existing RBAC tables.
INSERT INTO permissions (id, created_at, updated_at, name, permission_group, description, is_active)
VALUES
    (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'SUPPORT_ASSIGN', 'SUPPORT', 'Assign support tickets to staff', TRUE),
    (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'SUPPORT_ESCALATE', 'SUPPORT', 'Escalate support tickets to business management', TRUE),
    (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'SUPPORT_CLOSE', 'SUPPORT', 'Close or reopen owned support tickets', TRUE),
    (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'MASTER_KEY_VIEW', 'MASTER_KEY', 'View master key override audit records', TRUE),
    (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'MASTER_KEY_OVERRIDE', 'MASTER_KEY', 'Record emergency master key use', TRUE),
    (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'RENEWAL_SCAN', 'RENEWAL', 'Run system-wide renewal reminder scans', TRUE),
    (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'RENEWAL_SEND', 'RENEWAL', 'Send a renewal reminder for a contract', TRUE)
ON CONFLICT (name) DO NOTHING;

INSERT INTO role_permissions (id, created_at, updated_at, role_id, permission_id, is_active, description)
SELECT gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, r.id, p.id, TRUE,
       'V44 explicit ticket and emergency operation permission'
FROM roles r
JOIN permissions p ON
    (p.name = 'SUPPORT_VIEW' AND r.name IN ('ADMIN', 'BUSINESS_MANAGER', 'FACILITY_MANAGER', 'STAFF', 'CUSTOMER'))
 OR (p.name = 'SUPPORT_CREATE' AND r.name IN ('FACILITY_MANAGER', 'STAFF', 'CUSTOMER'))
 OR (p.name = 'SUPPORT_UPDATE' AND r.name IN ('FACILITY_MANAGER', 'STAFF'))
 OR (p.name = 'SUPPORT_ASSIGN' AND r.name = 'FACILITY_MANAGER')
 OR (p.name = 'SUPPORT_ESCALATE' AND r.name = 'FACILITY_MANAGER')
 OR (p.name = 'SUPPORT_CLOSE' AND r.name IN ('FACILITY_MANAGER', 'CUSTOMER'))
 OR (p.name = 'MASTER_KEY_VIEW' AND r.name IN ('ADMIN', 'BUSINESS_MANAGER', 'FACILITY_MANAGER', 'STAFF'))
 OR (p.name = 'MASTER_KEY_OVERRIDE' AND r.name IN ('FACILITY_MANAGER', 'STAFF'))
 OR (p.name = 'RENEWAL_SCAN' AND r.name = 'BUSINESS_MANAGER')
 OR (p.name = 'RENEWAL_SEND' AND r.name IN ('BUSINESS_MANAGER', 'FACILITY_MANAGER', 'STAFF'))
 OR (p.name = 'STAFF_ASSIGNMENT_VIEW' AND r.name IN ('ADMIN', 'BUSINESS_MANAGER', 'FACILITY_MANAGER', 'STAFF'))
ON CONFLICT (role_id, permission_id) DO UPDATE
SET is_active = TRUE,
    description = EXCLUDED.description;

-- System and business managers retain read-only chain-wide overdue oversight.
INSERT INTO role_permissions (id, created_at, updated_at, role_id, permission_id, is_active, description)
SELECT gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, r.id, p.id, TRUE,
       'V44 read-only overdue monitoring permission'
FROM roles r
JOIN permissions p ON p.name = 'OVERDUE_VIEW'
WHERE r.name IN ('ADMIN', 'BUSINESS_MANAGER', 'FACILITY_MANAGER')
ON CONFLICT (role_id, permission_id) DO UPDATE
SET is_active = TRUE,
    description = EXCLUDED.description;

UPDATE role_permissions rp
SET is_active = FALSE,
    description = 'Master-key execution requires explicit V44 permission'
FROM roles r, permissions p
WHERE rp.role_id = r.id
  AND p.id = rp.permission_id
  AND r.name IN ('ADMIN', 'BUSINESS_MANAGER')
  AND p.name = 'MASTER_KEY_OVERRIDE';

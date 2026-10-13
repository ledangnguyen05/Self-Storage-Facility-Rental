INSERT INTO permissions (id, created_at, updated_at, name, permission_group, description, is_active)
VALUES
-- USER
(gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'USER_VIEW', 'USER', 'View users', TRUE),
(gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'USER_CREATE', 'USER', 'Create users', TRUE),
(gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'USER_UPDATE', 'USER', 'Update users', TRUE),
(gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'USER_DELETE', 'USER', 'Delete users', TRUE),

-- ROLE
(gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'ROLE_VIEW', 'ROLE', 'View roles', TRUE),
(gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'ROLE_CREATE', 'ROLE', 'Create roles', TRUE),
(gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'ROLE_UPDATE', 'ROLE', 'Update roles', TRUE),
(gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'ROLE_DELETE', 'ROLE', 'Delete roles', TRUE),

-- PERMISSION
(gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'PERMISSION_VIEW', 'PERMISSION', 'View permissions', TRUE),
(gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'PERMISSION_CREATE', 'PERMISSION', 'Create permissions', TRUE),
(gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'PERMISSION_UPDATE', 'PERMISSION', 'Update permissions', TRUE),
(gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'PERMISSION_DELETE', 'PERMISSION', 'Delete permissions', TRUE),

-- ROLE_PERMISSION
(gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'ROLE_PERMISSION_VIEW', 'ROLE_PERMISSION', 'View role-permission assignments', TRUE),
(gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'ROLE_PERMISSION_ASSIGN', 'ROLE_PERMISSION', 'Assign a permission to a role', TRUE),
(gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'ROLE_PERMISSION_REVOKE', 'ROLE_PERMISSION', 'Revoke a permission from a role', TRUE),

-- FACILITY
(gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'FACILITY_VIEW', 'FACILITY', 'View facilities', TRUE),
(gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'FACILITY_CREATE', 'FACILITY', 'Create facilities', TRUE),
(gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'FACILITY_UPDATE', 'FACILITY', 'Update facilities', TRUE),
(gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'FACILITY_DELETE', 'FACILITY', 'Delete facilities', TRUE),

-- UNIT_TYPE
(gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'UNIT_TYPE_VIEW', 'UNIT_TYPE', 'View unit types', TRUE),
(gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'UNIT_TYPE_CREATE', 'UNIT_TYPE', 'Create unit types', TRUE),
(gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'UNIT_TYPE_UPDATE', 'UNIT_TYPE', 'Update unit types', TRUE),
(gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'UNIT_TYPE_DELETE', 'UNIT_TYPE', 'Delete unit types', TRUE),

-- STORAGE_UNIT
(gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'STORAGE_UNIT_VIEW', 'STORAGE_UNIT', 'View storage units', TRUE),
(gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'STORAGE_UNIT_CREATE', 'STORAGE_UNIT', 'Create storage units', TRUE),
(gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'STORAGE_UNIT_UPDATE', 'STORAGE_UNIT', 'Update storage units', TRUE),
(gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'STORAGE_UNIT_DELETE', 'STORAGE_UNIT', 'Delete storage units', TRUE),

-- POLICY (facility policy)
(gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'POLICY_VIEW', 'POLICY', 'View facility policies', TRUE),
(gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'POLICY_CREATE', 'POLICY', 'Create facility policies', TRUE),
(gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'POLICY_UPDATE', 'POLICY', 'Update facility policies', TRUE),
(gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'POLICY_DELETE', 'POLICY', 'Delete facility policies', TRUE),

-- BOOKING (reservation)
(gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'BOOKING_VIEW', 'BOOKING', 'View bookings', TRUE),
(gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'BOOKING_CREATE', 'BOOKING', 'Create bookings', TRUE),
(gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'BOOKING_UPDATE', 'BOOKING', 'Update bookings', TRUE),
(gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'BOOKING_CANCEL', 'BOOKING', 'Cancel bookings', TRUE),

-- CONTRACT (rental contract)
(gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'CONTRACT_VIEW', 'CONTRACT', 'View rental contracts', TRUE),
(gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'CONTRACT_CREATE', 'CONTRACT', 'Create rental contracts', TRUE),
(gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'CONTRACT_UPDATE', 'CONTRACT', 'Update rental contract status', TRUE),

-- HANDOVER (check-in / checkout records)
(gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'HANDOVER_VIEW', 'HANDOVER', 'View handover/checkout records', TRUE),
(gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'HANDOVER_CREATE', 'HANDOVER', 'Complete check-in handover or checkout inspection', TRUE),

-- ACCESS_CREDENTIAL
(gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'ACCESS_CREDENTIAL_VIEW', 'ACCESS_CREDENTIAL', 'View a unit''s access credential', TRUE),
(gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'ACCESS_CREDENTIAL_UPDATE', 'ACCESS_CREDENTIAL', 'Regenerate an access PIN/code', TRUE),
(gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'ACCESS_CREDENTIAL_REVOKE', 'ACCESS_CREDENTIAL', 'Revoke an access credential', TRUE),

-- PAYMENT
(gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'PAYMENT_VIEW', 'PAYMENT', 'View payments', TRUE),
(gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'PAYMENT_CREATE', 'PAYMENT', 'Create payments', TRUE),

-- RENEWAL
(gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'RENEWAL_VIEW', 'RENEWAL', 'View renewal requests', TRUE),
(gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'RENEWAL_CREATE', 'RENEWAL', 'Create/pay a renewal request', TRUE),

-- OVERDUE
(gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'OVERDUE_VIEW', 'OVERDUE', 'View overdue cases', TRUE),
(gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'OVERDUE_PROCESS', 'OVERDUE', 'Approve overdue sealing/processing', TRUE),

-- REFUND (deposit refund)
(gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'REFUND_VIEW', 'REFUND', 'View deposit refund requests', TRUE),
(gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'REFUND_APPROVE', 'REFUND', 'Approve a deposit refund', TRUE),

-- DISCOUNT
(gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'DISCOUNT_VIEW', 'DISCOUNT', 'View discounts', TRUE),
(gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'DISCOUNT_CREATE', 'DISCOUNT', 'Create discounts', TRUE),
(gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'DISCOUNT_UPDATE', 'DISCOUNT', 'Update discounts', TRUE),
(gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'DISCOUNT_DELETE', 'DISCOUNT', 'Delete discounts', TRUE),

-- SUPPORT
(gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'SUPPORT_VIEW', 'SUPPORT', 'View support tickets', TRUE),
(gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'SUPPORT_CREATE', 'SUPPORT', 'Create support tickets', TRUE),
(gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'SUPPORT_UPDATE', 'SUPPORT', 'Update support tickets', TRUE),

-- STAFF_ASSIGNMENT
(gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'STAFF_ASSIGNMENT_VIEW', 'STAFF_ASSIGNMENT', 'View staff assignments', TRUE),
(gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'STAFF_ASSIGNMENT_CREATE', 'STAFF_ASSIGNMENT', 'Assign staff to a facility', TRUE),
(gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'STAFF_ASSIGNMENT_DELETE', 'STAFF_ASSIGNMENT', 'Remove a staff assignment', TRUE),

-- REPORT
(gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'REPORT_VIEW', 'REPORT', 'View business reports', TRUE),

-- ACTIVITY_LOG / LOGIN_HISTORY
(gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'ACTIVITY_LOG_VIEW', 'ACTIVITY_LOG', 'View activity/audit logs', TRUE),
(gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'LOGIN_HISTORY_VIEW', 'LOGIN_HISTORY', 'View login history', TRUE)

ON CONFLICT (name) DO NOTHING;


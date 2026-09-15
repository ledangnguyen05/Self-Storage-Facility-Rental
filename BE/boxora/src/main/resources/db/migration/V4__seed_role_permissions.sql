INSERT INTO role_permissions
(
    id,
    created_at,
    updated_at,
    role_id,
    permission_id,
    is_active,
    description
)
SELECT
    gen_random_uuid(),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    '11111111-1111-1111-1111-111111111111',
    p.id,
    TRUE,
    'ADMIN full system access'
FROM permissions p
WHERE p.is_active = TRUE
    ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions
(
    id,
    created_at,
    updated_at,
    role_id,
    permission_id,
    is_active,
    description
)
SELECT
    gen_random_uuid(),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    '22222222-2222-2222-2222-222222222222',
    p.id,
    TRUE,
    'Business operations management permission'
FROM permissions p
WHERE p.permission_group IN
      (
       'FACILITY',
       'STORAGE_UNIT',
       'BOOKING',
       'PAYMENT',
       'REPORT',
       'POLICY'
          )
    ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions
(
    id,
    created_at,
    updated_at,
    role_id,
    permission_id,
    is_active,
    description
)
SELECT
    gen_random_uuid(),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    '33333333-3333-3333-3333-333333333333',
    p.id,
    TRUE,
    'Facility manager permission'
FROM permissions p
WHERE p.permission_group IN
      (
       'FACILITY',
       'STORAGE_UNIT',
       'BOOKING',
       'PAYMENT',
       'SUPPORT',
       'REPORT'
          )
    ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions
(
    id,
    created_at,
    updated_at,
    role_id,
    permission_id,
    is_active,
    description
)
SELECT
    gen_random_uuid(),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    '44444444-4444-4444-4444-444444444444',
    p.id,
    TRUE,
    'Facility staff permission'
FROM permissions p
WHERE p.name IN
      (
       'FACILITY_VIEW',
       'STORAGE_UNIT_VIEW',
       'STORAGE_UNIT_UPDATE',
       'BOOKING_VIEW',
       'BOOKING_UPDATE',
       'PAYMENT_VIEW',
       'SUPPORT_VIEW',
       'SUPPORT_UPDATE'
          )
    ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions
(
    id,
    created_at,
    updated_at,
    role_id,
    permission_id,
    is_active,
    description
)
SELECT
    gen_random_uuid(),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    '55555555-5555-5555-5555-555555555555',
    p.id,
    TRUE,
    'Customer permission'
FROM permissions p
WHERE p.name IN
      (
       'FACILITY_VIEW',
       'STORAGE_UNIT_VIEW',
       'BOOKING_VIEW',
       'BOOKING_CREATE',
       'BOOKING_CANCEL',
       'PAYMENT_VIEW',
       'PAYMENT_CREATE',
       'SUPPORT_VIEW',
       'SUPPORT_CREATE'
          )
    ON CONFLICT (role_id, permission_id) DO NOTHING;




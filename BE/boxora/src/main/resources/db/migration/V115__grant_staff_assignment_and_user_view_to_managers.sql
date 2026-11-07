-- V115__grant_staff_assignment_and_user_view_to_managers.sql
-- Grant USER_VIEW to BUSINESS_MANAGER, FACILITY_MANAGER, and STAFF
-- Grant STAFF_ASSIGNMENT_CREATE and STAFF_ASSIGNMENT_DELETE to BUSINESS_MANAGER
-- Seed missing facility, manager, and staff for Boxora Quan 2 and Vinhomes Grand Park Hub
-- Link manager_id to facilities where empty

-- 1. Grant USER_VIEW to managers and staff for shift and operational lookups
INSERT INTO role_permissions (id, created_at, updated_at, role_id, permission_id, is_active, description)
SELECT gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, r.id, p.id, TRUE,
       'Quyen tra cuu nhan su he thong'
FROM roles r, permissions p
WHERE r.name IN ('BUSINESS_MANAGER', 'FACILITY_MANAGER', 'STAFF')
  AND p.name = 'USER_VIEW'
ON CONFLICT (role_id, permission_id) DO UPDATE
SET is_active = TRUE, updated_at = CURRENT_TIMESTAMP;

-- 2. Grant STAFF_ASSIGNMENT permissions to BUSINESS_MANAGER
INSERT INTO role_permissions (id, created_at, updated_at, role_id, permission_id, is_active, description)
SELECT gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, r.id, p.id, TRUE,
       'Quyen dieu phoi va quan ly ca truc cho Business Manager'
FROM roles r, permissions p
WHERE r.name = 'BUSINESS_MANAGER'
  AND p.name IN ('STAFF_ASSIGNMENT_CREATE', 'STAFF_ASSIGNMENT_DELETE', 'STAFF_ASSIGNMENT_VIEW')
ON CONFLICT (role_id, permission_id) DO UPDATE
SET is_active = TRUE, updated_at = CURRENT_TIMESTAMP;

-- 3. Ensure FACILITY_MANAGER has all STAFF_ASSIGNMENT permissions
INSERT INTO role_permissions (id, created_at, updated_at, role_id, permission_id, is_active, description)
SELECT gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, r.id, p.id, TRUE,
       'Quyen dieu phoi va quan ly ca truc cho Facility Manager'
FROM roles r, permissions p
WHERE r.name = 'FACILITY_MANAGER'
  AND p.name IN ('STAFF_ASSIGNMENT_CREATE', 'STAFF_ASSIGNMENT_DELETE', 'STAFF_ASSIGNMENT_VIEW')
ON CONFLICT (role_id, permission_id) DO UPDATE
SET is_active = TRUE, updated_at = CURRENT_TIMESTAMP;

-- 4. Ensure Facility "Boxora Thao Dien - Quan 2" exists
INSERT INTO facilities (
    id, name, code, address, city, contact_phone, email, status, open_time, close_time, created_at, updated_at, description
)
SELECT
    '164a297c-8f96-4102-9e0e-ed9339121902',
    'Boxora Thảo Điền - Quận 2',
    'HCM-Q2',
    'Số 26 Đường Thảo Điền, Phường Thảo Điền, Quận 2, TP. Thủ Đức, TP. Hồ Chí Minh',
    'TP. Hồ Chí Minh',
    '02873009988',
    'boxora.quan2@gmail.com',
    'ACTIVE',
    '08:00:00',
    '21:00:00',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    'Cơ sở lưu trữ thông minh Boxora Quận 2 - Thảo Điền'
WHERE NOT EXISTS (
    SELECT 1 FROM facilities WHERE id = '164a297c-8f96-4102-9e0e-ed9339121902' OR code = 'HCM-Q2'
);

-- Ensure facility policy exists for Boxora Quan 2
INSERT INTO facility_policies (
    id, created_at, updated_at, facility_id, deposit_percentage,
    renewal_window_days,
    cancellation_full_refund_hours, cancellation_partial_refund_hours, cancellation_partial_refund_percent,
    return_notice_days, deposit_refund_sla_days,
    daily_late_fee, overdue_grace_days, overdue_access_disable_days, overdue_sealing_days,
    minimum_rental_months
)
SELECT
    gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, f.id, 100.0,
    3,
    48, 24, 50.0,
    0, 5,
    50000.00, 1, 3, 7,
    1
FROM facilities f
WHERE (f.code = 'HCM-Q2' OR f.id = '164a297c-8f96-4102-9e0e-ed9339121902')
  AND NOT EXISTS (SELECT 1 FROM facility_policies fp WHERE fp.facility_id = f.id);

-- 5. Seed Facility Manager for Boxora Quan 2 if missing
INSERT INTO users (id, created_at, updated_at, username, email, password, phone, full_name, is_active, role_id, facility_id)
SELECT 'e0000000-0000-0000-0000-000000020001', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'facility1_q2', 'facility1q2@gmail.com',
       '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG', '0902221199', 'Nguyen Van Manager Q2', TRUE,
       (SELECT id FROM roles WHERE name = 'FACILITY_MANAGER' LIMIT 1),
       (SELECT id FROM facilities WHERE id = '164a297c-8f96-4102-9e0e-ed9339121902' OR code = 'HCM-Q2' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'facility1q2@gmail.com' OR username = 'facility1_q2')
  AND EXISTS (SELECT 1 FROM facilities WHERE id = '164a297c-8f96-4102-9e0e-ed9339121902' OR code = 'HCM-Q2');

-- Update manager_id for Boxora Quan 2 if null
UPDATE facilities
SET manager_id = (SELECT id FROM users WHERE email = 'facility1q2@gmail.com' LIMIT 1)
WHERE (id = '164a297c-8f96-4102-9e0e-ed9339121902' OR code = 'HCM-Q2')
  AND manager_id IS NULL
  AND EXISTS (SELECT 1 FROM users WHERE email = 'facility1q2@gmail.com');

-- 6. Seed Facility Manager for Vinhomes Grand Park Hub if missing
INSERT INTO users (id, created_at, updated_at, username, email, password, phone, full_name, is_active, role_id, facility_id)
SELECT 'e0000000-0000-0000-0000-000000050001', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'facility1_vgp', 'facility1vgp@gmail.com',
       '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG', '0905556677', 'Nguyen Van Manager VGP', TRUE,
       (SELECT id FROM roles WHERE name = 'FACILITY_MANAGER' LIMIT 1),
       (SELECT id FROM facilities WHERE id = 'e5555555-5555-5555-5555-555555555555' OR code = 'HCM-VGP' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'facility1vgp@gmail.com' OR username = 'facility1_vgp')
  AND EXISTS (SELECT 1 FROM facilities WHERE id = 'e5555555-5555-5555-5555-555555555555' OR code = 'HCM-VGP');

-- Update manager_id for Vinhomes Grand Park Hub if null
UPDATE facilities
SET manager_id = (SELECT id FROM users WHERE email = 'facility1vgp@gmail.com' LIMIT 1)
WHERE (id = 'e5555555-5555-5555-5555-555555555555' OR code = 'HCM-VGP')
  AND manager_id IS NULL
  AND EXISTS (SELECT 1 FROM users WHERE email = 'facility1vgp@gmail.com');

-- 7. Seed STAFF for Boxora Thao Dien - Quan 2
INSERT INTO users (id, created_at, updated_at, username, email, password, phone, full_name, is_active, role_id, facility_id)
SELECT 'e0000000-0000-0000-0000-000000120001', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'staff1_q2', 'staff1q2@gmail.com',
       '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG', '0901112233', 'Nguyen Van Staff Q2', TRUE,
       (SELECT id FROM roles WHERE name = 'STAFF' LIMIT 1),
       (SELECT id FROM facilities WHERE id = '164a297c-8f96-4102-9e0e-ed9339121902' OR code = 'HCM-Q2' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'staff1q2@gmail.com' OR username = 'staff1_q2')
  AND EXISTS (SELECT 1 FROM facilities WHERE id = '164a297c-8f96-4102-9e0e-ed9339121902' OR code = 'HCM-Q2');

INSERT INTO users (id, created_at, updated_at, username, email, password, phone, full_name, is_active, role_id, facility_id)
SELECT 'e0000000-0000-0000-0000-000000120002', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'staff2_q2', 'staff2q2@gmail.com',
       '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG', '0902223344', 'Tran Thi Staff Q2', TRUE,
       (SELECT id FROM roles WHERE name = 'STAFF' LIMIT 1),
       (SELECT id FROM facilities WHERE id = '164a297c-8f96-4102-9e0e-ed9339121902' OR code = 'HCM-Q2' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'staff2q2@gmail.com' OR username = 'staff2_q2')
  AND EXISTS (SELECT 1 FROM facilities WHERE id = '164a297c-8f96-4102-9e0e-ed9339121902' OR code = 'HCM-Q2');

INSERT INTO users (id, created_at, updated_at, username, email, password, phone, full_name, is_active, role_id, facility_id)
SELECT 'e0000000-0000-0000-0000-000000120003', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'staff3_q2', 'staff3q2@gmail.com',
       '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG', '0903334455', 'Le Hoang Staff Q2', TRUE,
       (SELECT id FROM roles WHERE name = 'STAFF' LIMIT 1),
       (SELECT id FROM facilities WHERE id = '164a297c-8f96-4102-9e0e-ed9339121902' OR code = 'HCM-Q2' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'staff3q2@gmail.com' OR username = 'staff3_q2')
  AND EXISTS (SELECT 1 FROM facilities WHERE id = '164a297c-8f96-4102-9e0e-ed9339121902' OR code = 'HCM-Q2');

-- 8. Seed STAFF for Vinhomes Grand Park Hub
INSERT INTO users (id, created_at, updated_at, username, email, password, phone, full_name, is_active, role_id, facility_id)
SELECT 'e0000000-0000-0000-0000-000000150001', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'staff1_vgp', 'staff1vgp@gmail.com',
       '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG', '0904445566', 'Pham Van Staff VGP', TRUE,
       (SELECT id FROM roles WHERE name = 'STAFF' LIMIT 1),
       (SELECT id FROM facilities WHERE id = 'e5555555-5555-5555-5555-555555555555' OR code = 'HCM-VGP' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'staff1vgp@gmail.com' OR username = 'staff1_vgp')
  AND EXISTS (SELECT 1 FROM facilities WHERE id = 'e5555555-5555-5555-5555-555555555555' OR code = 'HCM-VGP');

-- V115__grant_staff_assignment_and_user_view_to_managers.sql
-- Grant USER_VIEW to BUSINESS_MANAGER, FACILITY_MANAGER, and STAFF
-- Grant STAFF_ASSIGNMENT_CREATE and STAFF_ASSIGNMENT_DELETE to BUSINESS_MANAGER
-- Seed missing staff for Boxora Quan 2 and Vinhomes Grand Park Hub
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

-- 4. Set facility manager_id for facilities currently without manager_id
-- Boxora Thao Dien - Quan 2
UPDATE facilities
SET manager_id = '4867f35a-0f1c-4aa4-9511-b557140bd5ff'
WHERE id = '164a297c-8f96-4102-9e0e-ed9339121902' AND (manager_id IS NULL OR manager_id != '4867f35a-0f1c-4aa4-9511-b557140bd5ff');

-- Boxora quan 3
UPDATE facilities
SET manager_id = '64d6e4fa-b48f-45d4-a943-ba81863fc0e1'
WHERE id = '160d2bed-a701-4d00-b6f6-357039960d68' AND (manager_id IS NULL OR manager_id != '64d6e4fa-b48f-45d4-a943-ba81863fc0e1');

-- 5. Seed Facility Manager for Vinhomes Grand Park Hub if missing
INSERT INTO users (id, created_at, updated_at, username, email, password, phone, full_name, is_active, role_id, facility_id)
SELECT 'e0000000-0000-0000-0000-000000050001', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'facility1_vgp', 'facility1vgp@gmail.com',
       '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG', '0905556677', 'Nguyen Van Manager VGP', TRUE,
       (SELECT id FROM roles WHERE name = 'FACILITY_MANAGER' LIMIT 1), 'e5555555-5555-5555-5555-555555555555'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'facility1vgp@gmail.com');

UPDATE facilities
SET manager_id = 'e0000000-0000-0000-0000-000000050001'
WHERE id = 'e5555555-5555-5555-5555-555555555555' AND (manager_id IS NULL OR manager_id != 'e0000000-0000-0000-0000-000000050001');

-- 6. Seed STAFF for Boxora Thao Dien - Quan 2
INSERT INTO users (id, created_at, updated_at, username, email, password, phone, full_name, is_active, role_id, facility_id)
SELECT 'e0000000-0000-0000-0000-000000120001', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'staff1_q2', 'staff1q2@gmail.com',
       '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG', '0901112233', 'Nguyen Van Staff Q2', TRUE,
       (SELECT id FROM roles WHERE name = 'STAFF' LIMIT 1), '164a297c-8f96-4102-9e0e-ed9339121902'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'staff1q2@gmail.com');

INSERT INTO users (id, created_at, updated_at, username, email, password, phone, full_name, is_active, role_id, facility_id)
SELECT 'e0000000-0000-0000-0000-000000120002', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'staff2_q2', 'staff2q2@gmail.com',
       '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG', '0902223344', 'Tran Thi Staff Q2', TRUE,
       (SELECT id FROM roles WHERE name = 'STAFF' LIMIT 1), '164a297c-8f96-4102-9e0e-ed9339121902'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'staff2q2@gmail.com');

INSERT INTO users (id, created_at, updated_at, username, email, password, phone, full_name, is_active, role_id, facility_id)
SELECT 'e0000000-0000-0000-0000-000000120003', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'staff3_q2', 'staff3q2@gmail.com',
       '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG', '0903334455', 'Le Hoang Staff Q2', TRUE,
       (SELECT id FROM roles WHERE name = 'STAFF' LIMIT 1), '164a297c-8f96-4102-9e0e-ed9339121902'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'staff3q2@gmail.com');

-- 7. Seed STAFF for Vinhomes Grand Park Hub
INSERT INTO users (id, created_at, updated_at, username, email, password, phone, full_name, is_active, role_id, facility_id)
SELECT 'e0000000-0000-0000-0000-000000150001', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'staff1_vgp', 'staff1vgp@gmail.com',
       '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG', '0904445566', 'Pham Van Staff VGP', TRUE,
       (SELECT id FROM roles WHERE name = 'STAFF' LIMIT 1), 'e5555555-5555-5555-5555-555555555555'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'staff1vgp@gmail.com');

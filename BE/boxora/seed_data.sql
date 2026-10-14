-- =========================================================================
-- BOXORA FULL SYSTEM DEMO SEED DATA SCRIPT
-- =========================================================================

BEGIN;

-- -------------------------------------------------------------------------
-- 1. FACILITIES (4 facilities, range 3-5)
-- -------------------------------------------------------------------------
INSERT INTO facilities (id, created_at, updated_at, name, code, address, city, contact_phone, email, status, open_time, close_time, description)
VALUES 
    ('a1111111-2222-3333-4444-555555555555', NOW(), NOW(), 'StoreHub Tan Binh Mega Hub', 'HCM-TB', '102 Truong Son, Ward 2, Tan Binh District', 'Ho Chi Minh City', '0904567890', 'tanbinh@boxora.vn', 'ACTIVE', '08:00:00', '21:00:00', 'Cơ sở trung tâm tiếp giáp sân bay Tân Sơn Nhất, phục vụ lưu kho cá nhân và kho thương mại điện tử 24/7.')
ON CONFLICT (code) DO UPDATE 
SET name = EXCLUDED.name, address = EXCLUDED.address, status = EXCLUDED.status;

-- -------------------------------------------------------------------------
-- 2. FACILITY POLICIES (4 policies, range 3-5)
-- -------------------------------------------------------------------------
INSERT INTO facility_policies (
    id, created_at, updated_at, facility_id, deposit_percentage, renewal_window_days,
    cancellation_full_refund_hours, cancellation_partial_refund_hours, cancellation_partial_refund_percent,
    return_notice_days, deposit_refund_sla_days, daily_late_fee, overdue_grace_days,
    overdue_access_disable_days, overdue_sealing_days, minimum_rental_months
)
VALUES (
    '55555555-4444-3333-2222-111111111111', NOW(), NOW(),
    'a1111111-2222-3333-4444-555555555555', 100.0, 3, 48, 24, 50.0, 0, 5, 50000.00, 1, 3, 7, 1
)
ON CONFLICT (facility_id) DO NOTHING;

-- -------------------------------------------------------------------------
-- 3. UNIT TYPES (4 types: Small, Medium, Large, Extra Large)
-- -------------------------------------------------------------------------
INSERT INTO unit_types (id, created_at, updated_at, type_name, dimensions, area_sqm, base_price_per_month, deposit_amount)
VALUES
    ('10000000-0000-0000-0000-000000000001', NOW(), NOW(), 'Small (Personal Locker)', '1.0m x 1.0m x 1.2m', 1.0, 450000.00, 450000.00),
    ('10000000-0000-0000-0000-000000000002', NOW(), NOW(), 'Medium (Compact Studio)', '1.5m x 2.0m x 2.6m', 3.0, 1250000.00, 1250000.00),
    ('10000000-0000-0000-0000-000000000003', NOW(), NOW(), 'Large (Standard 1-Bedroom)', '2.0m x 3.0m x 2.8m', 6.0, 2400000.00, 2400000.00),
    ('10000000-0000-0000-0000-000000000004', NOW(), NOW(), 'Extra Large (Commercial Suite)', '3.0m x 4.0m x 3.0m', 12.0, 4800000.00, 4800000.00)
ON CONFLICT (id) DO UPDATE 
SET type_name = EXCLUDED.type_name, base_price_per_month = EXCLUDED.base_price_per_month, deposit_amount = EXCLUDED.deposit_amount;

-- -------------------------------------------------------------------------
-- 4. USERS (20 users, range 15-25: Admin, Operations, Facility Managers, Staff, Customers)
-- Password for all seeded users: 123456
-- BCrypt Hash: $2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG
-- -------------------------------------------------------------------------
INSERT INTO users (id, created_at, updated_at, username, email, password, phone, full_name, is_active, role_id, facility_id)
VALUES
    -- Operations Manager #2
    ('e0000000-0000-0000-0000-000000000001', NOW(), NOW(), 'ops_lead', 'ops.lead@boxora.vn', '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG', '0908111222', 'Trần Đình Trọng (Lead Ops)', true, '33333333-3333-3333-3333-333333333333', NULL),
    
    -- Facility Managers for D7, Thu Duc, Tan Binh
    ('e0000000-0000-0000-0000-000000000002', NOW(), NOW(), 'manager_d7', 'manager.d7@boxora.vn', '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG', '0908222333', 'Lê Hoàng Nam (FM Q7)', true, '22222222-2222-2222-2222-222222222222', '45e03ded-5da1-43d5-bea7-96c645d5f96c'),
    ('e0000000-0000-0000-0000-000000000003', NOW(), NOW(), 'manager_td', 'manager.td@boxora.vn', '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG', '0908333444', 'Nguyễn Thị Bích (FM Thủ Đức)', true, '22222222-2222-2222-2222-222222222222', 'fd8f948e-fdff-4a81-ad0f-fc45639b545d'),
    ('e0000000-0000-0000-0000-000000000004', NOW(), NOW(), 'manager_tb', 'manager.tb@boxora.vn', '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG', '0908444555', 'Đỗ Quang Huy (FM Tân Bình)', true, '22222222-2222-2222-2222-222222222222', 'a1111111-2222-3333-4444-555555555555'),
    
    -- Staff for Thu Duc and Tan Binh
    ('e0000000-0000-0000-0000-000000000005', NOW(), NOW(), 'staff_td', 'staff.td@boxora.vn', '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG', '0908555666', 'Phan Văn Hậu (Staff Thủ Đức)', true, '44444444-4444-4444-4444-444444444444', 'fd8f948e-fdff-4a81-ad0f-fc45639b545d'),
    ('e0000000-0000-0000-0000-000000000006', NOW(), NOW(), 'staff_tb', 'staff.tb@boxora.vn', '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG', '0908666777', 'Vũ Thị Ngọc (Staff Tân Bình)', true, '44444444-4444-4444-4444-444444444444', 'a1111111-2222-3333-4444-555555555555'),
    
    -- Additional Customers with realistic Vietnamese profiles
    ('e0000000-0000-0000-0000-000000000007', NOW(), NOW(), 'cust_minh', 'minh.tuan@gmail.com', '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG', '0912345678', 'Trần Minh Tuấn', true, '55555555-5555-5555-5555-555555555555', NULL),
    ('e0000000-0000-0000-0000-000000000008', NOW(), NOW(), 'cust_lan', 'hoangyen.le@gmail.com', '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG', '0988219002', 'Lê Thị Hoàng Yến', true, '55555555-5555-5555-5555-555555555555', NULL),
    ('e0000000-0000-0000-0000-000000000009', NOW(), NOW(), 'cust_hoang', 'namanh.hoang@gmail.com', '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG', '0977334455', 'Hoàng Nam Anh', true, '55555555-5555-5555-5555-555555555555', NULL),
    ('e0000000-0000-0000-0000-000000000010', NOW(), NOW(), 'cust_phuong', 'maiphuong.pham@gmail.com', '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG', '0933887766', 'Phạm Mai Phương', true, '55555555-5555-5555-5555-555555555555', NULL),
    ('e0000000-0000-0000-0000-000000000011', NOW(), NOW(), 'cust_duc', 'ducthang.vu@gmail.com', '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG', '0944890123', 'Vũ Đức Thắng', true, '55555555-5555-5555-5555-555555555555', NULL)
ON CONFLICT (username) DO NOTHING;

-- Cập nhật manager cho các cơ sở
UPDATE facilities SET manager_id = '43695aac-1802-4a5d-82aa-2ef466796e10' WHERE code = 'HCM-D1';
UPDATE facilities SET manager_id = 'e0000000-0000-0000-0000-000000000002' WHERE code = 'HCM-D7';
UPDATE facilities SET manager_id = 'e0000000-0000-0000-0000-000000000003' WHERE code = 'HCM-TD';
UPDATE facilities SET manager_id = 'e0000000-0000-0000-0000-000000000004' WHERE code = 'HCM-TB';

-- -------------------------------------------------------------------------
-- 5. STORAGE UNITS (36 units across 4 facilities, range 30-50)
-- D1: Block A (9 units), D7: Block B (9 units), TD: Block C (9 units), TB: Block D (9 units)
-- -------------------------------------------------------------------------
INSERT INTO storage_units (id, created_at, updated_at, unit_code, floor_level, status, facility_id, unit_type_id, price_per_month)
VALUES
    -- District 1 (HCM-D1)
    ('b0000000-0000-0000-0000-000000000101', NOW(), NOW(), 'A-101', 'Tầng 1', 'AVAILABLE', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', '10000000-0000-0000-0000-000000000001', 450000.00),
    ('b0000000-0000-0000-0000-000000000102', NOW(), NOW(), 'A-102', 'Tầng 1', 'OCCUPIED',  'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', '10000000-0000-0000-0000-000000000002', 1250000.00),
    ('b0000000-0000-0000-0000-000000000103', NOW(), NOW(), 'A-103', 'Tầng 1', 'AVAILABLE', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', '10000000-0000-0000-0000-000000000003', 2400000.00),
    ('b0000000-0000-0000-0000-000000000104', NOW(), NOW(), 'A-104', 'Tầng 1', 'OCCUPIED',  'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', '10000000-0000-0000-0000-000000000004', 4800000.00),
    ('b0000000-0000-0000-0000-000000000201', NOW(), NOW(), 'A-201', 'Tầng 2', 'AVAILABLE', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', '10000000-0000-0000-0000-000000000001', 450000.00),
    ('b0000000-0000-0000-0000-000000000202', NOW(), NOW(), 'A-202', 'Tầng 2', 'RESERVED',   'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', '10000000-0000-0000-0000-000000000002', 1250000.00),
    ('b0000000-0000-0000-0000-000000000203', NOW(), NOW(), 'A-203', 'Tầng 2', 'OCCUPIED',  'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', '10000000-0000-0000-0000-000000000003', 2400000.00),
    ('b0000000-0000-0000-0000-000000000204', NOW(), NOW(), 'A-204', 'Tầng 2', 'UNDER_MAINTENANCE', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', '10000000-0000-0000-0000-000000000004', 4800000.00),
    ('b0000000-0000-0000-0000-000000000301', NOW(), NOW(), 'A-301', 'Tầng 3', 'AVAILABLE', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', '10000000-0000-0000-0000-000000000002', 1250000.00),

    -- District 7 (HCM-D7)
    ('b0000000-0000-0000-0000-000000000205', NOW(), NOW(), 'B-101', 'Tầng 1', 'AVAILABLE', '45e03ded-5da1-43d5-bea7-96c645d5f96c', '10000000-0000-0000-0000-000000000001', 450000.00),
    ('b0000000-0000-0000-0000-000000000206', NOW(), NOW(), 'B-102', 'Tầng 1', 'OCCUPIED',  '45e03ded-5da1-43d5-bea7-96c645d5f96c', '10000000-0000-0000-0000-000000000002', 1250000.00),
    ('b0000000-0000-0000-0000-000000000207', NOW(), NOW(), 'B-103', 'Tầng 1', 'AVAILABLE', '45e03ded-5da1-43d5-bea7-96c645d5f96c', '10000000-0000-0000-0000-000000000003', 2400000.00),
    ('b0000000-0000-0000-0000-000000000208', NOW(), NOW(), 'B-104', 'Tầng 1', 'OCCUPIED',  '45e03ded-5da1-43d5-bea7-96c645d5f96c', '10000000-0000-0000-0000-000000000004', 4800000.00),
    ('b0000000-0000-0000-0000-000000000209', NOW(), NOW(), 'B-201', 'Tầng 2', 'AVAILABLE', '45e03ded-5da1-43d5-bea7-96c645d5f96c', '10000000-0000-0000-0000-000000000001', 450000.00),
    ('b0000000-0000-0000-0000-000000000210', NOW(), NOW(), 'B-202', 'Tầng 2', 'OCCUPIED',  '45e03ded-5da1-43d5-bea7-96c645d5f96c', '10000000-0000-0000-0000-000000000002', 1250000.00),
    ('b0000000-0000-0000-0000-000000000211', NOW(), NOW(), 'B-203', 'Tầng 2', 'OVERDUE_LOCKED', '45e03ded-5da1-43d5-bea7-96c645d5f96c', '10000000-0000-0000-0000-000000000003', 2400000.00),
    ('b0000000-0000-0000-0000-000000000212', NOW(), NOW(), 'B-204', 'Tầng 2', 'AVAILABLE', '45e03ded-5da1-43d5-bea7-96c645d5f96c', '10000000-0000-0000-0000-000000000004', 4800000.00),
    ('b0000000-0000-0000-0000-000000000302', NOW(), NOW(), 'B-301', 'Tầng 3', 'AVAILABLE', '45e03ded-5da1-43d5-bea7-96c645d5f96c', '10000000-0000-0000-0000-000000000003', 2400000.00),

    -- Thu Duc City (HCM-TD)
    ('b0000000-0000-0000-0000-000000000303', NOW(), NOW(), 'C-101', 'Tầng 1', 'AVAILABLE', 'fd8f948e-fdff-4a81-ad0f-fc45639b545d', '10000000-0000-0000-0000-000000000001', 450000.00),
    ('b0000000-0000-0000-0000-000000000304', NOW(), NOW(), 'C-102', 'Tầng 1', 'OCCUPIED',  'fd8f948e-fdff-4a81-ad0f-fc45639b545d', '10000000-0000-0000-0000-000000000002', 1250000.00),
    ('b0000000-0000-0000-0000-000000000305', NOW(), NOW(), 'C-103', 'Tầng 1', 'AVAILABLE', 'fd8f948e-fdff-4a81-ad0f-fc45639b545d', '10000000-0000-0000-0000-000000000003', 2400000.00),
    ('b0000000-0000-0000-0000-000000000306', NOW(), NOW(), 'C-104', 'Tầng 1', 'OCCUPIED',  'fd8f948e-fdff-4a81-ad0f-fc45639b545d', '10000000-0000-0000-0000-000000000004', 4800000.00),
    ('b0000000-0000-0000-0000-000000000307', NOW(), NOW(), 'C-201', 'Tầng 2', 'AVAILABLE', 'fd8f948e-fdff-4a81-ad0f-fc45639b545d', '10000000-0000-0000-0000-000000000001', 450000.00),
    ('b0000000-0000-0000-0000-000000000308', NOW(), NOW(), 'C-202', 'Tầng 2', 'OCCUPIED',  'fd8f948e-fdff-4a81-ad0f-fc45639b545d', '10000000-0000-0000-0000-000000000002', 1250000.00),
    ('b0000000-0000-0000-0000-000000000309', NOW(), NOW(), 'C-203', 'Tầng 2', 'RESERVED',   'fd8f948e-fdff-4a81-ad0f-fc45639b545d', '10000000-0000-0000-0000-000000000003', 2400000.00),
    ('b0000000-0000-0000-0000-000000000310', NOW(), NOW(), 'C-204', 'Tầng 2', 'AVAILABLE', 'fd8f948e-fdff-4a81-ad0f-fc45639b545d', '10000000-0000-0000-0000-000000000004', 4800000.00),
    ('b0000000-0000-0000-0000-000000000311', NOW(), NOW(), 'C-301', 'Tầng 3', 'AVAILABLE', 'fd8f948e-fdff-4a81-ad0f-fc45639b545d', '10000000-0000-0000-0000-000000000002', 1250000.00),

    -- Tan Binh Mega Hub (HCM-TB)
    ('b0000000-0000-0000-0000-000000000401', NOW(), NOW(), 'D-101', 'Tầng 1', 'AVAILABLE', 'a1111111-2222-3333-4444-555555555555', '10000000-0000-0000-0000-000000000001', 450000.00),
    ('b0000000-0000-0000-0000-000000000402', NOW(), NOW(), 'D-102', 'Tầng 1', 'OCCUPIED',  'a1111111-2222-3333-4444-555555555555', '10000000-0000-0000-0000-000000000002', 1250000.00),
    ('b0000000-0000-0000-0000-000000000403', NOW(), NOW(), 'D-103', 'Tầng 1', 'AVAILABLE', 'a1111111-2222-3333-4444-555555555555', '10000000-0000-0000-0000-000000000003', 2400000.00),
    ('b0000000-0000-0000-0000-000000000404', NOW(), NOW(), 'D-104', 'Tầng 1', 'OCCUPIED',  'a1111111-2222-3333-4444-555555555555', '10000000-0000-0000-0000-000000000004', 4800000.00),
    ('b0000000-0000-0000-0000-000000000405', NOW(), NOW(), 'D-201', 'Tầng 2', 'AVAILABLE', 'a1111111-2222-3333-4444-555555555555', '10000000-0000-0000-0000-000000000001', 450000.00),
    ('b0000000-0000-0000-0000-000000000406', NOW(), NOW(), 'D-202', 'Tầng 2', 'OCCUPIED',  'a1111111-2222-3333-4444-555555555555', '10000000-0000-0000-0000-000000000002', 1250000.00),
    ('b0000000-0000-0000-0000-000000000407', NOW(), NOW(), 'D-203', 'Tầng 2', 'UNDER_MAINTENANCE', 'a1111111-2222-3333-4444-555555555555', '10000000-0000-0000-0000-000000000003', 2400000.00),
    ('b0000000-0000-0000-0000-000000000408', NOW(), NOW(), 'D-204', 'Tầng 2', 'RESERVED',   'a1111111-2222-3333-4444-555555555555', '10000000-0000-0000-0000-000000000004', 4800000.00),
    ('b0000000-0000-0000-0000-000000000409', NOW(), NOW(), 'D-301', 'Tầng 3', 'AVAILABLE', 'a1111111-2222-3333-4444-555555555555', '10000000-0000-0000-0000-000000000001', 450000.00)
ON CONFLICT (id) DO UPDATE 
SET status = EXCLUDED.status, price_per_month = EXCLUDED.price_per_month;

-- -------------------------------------------------------------------------
-- 6. BOOKINGS (18 bookings, range 15-25)
-- -------------------------------------------------------------------------
INSERT INTO bookings (
    id, created_at, updated_at, booking_code, customer_id, storage_unit_id,
    start_date, end_date, rental_months, total_rental_fee, deposit_paid, deposit_amount,
    status, access_code, handed_over_by_staff_id, handover_time, return_time, access_pin, qr_access_token, pin_updated_at, payment_expires_at
)
VALUES
    -- 1. Active: cust_minh at A-102 (D1)
    ('c0000000-0000-0000-0000-000000000001', '2026-03-01 09:00:00', NOW(), 'BX-2026-1001', 'e0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000102', '2026-03-01', '2026-09-01', 6, 7500000.00, 1250000.00, 1250000.00, 'ACTIVE', 'BX-88219', '0f3386ad-0ff9-4c8f-b01b-7a8f783c7afc', '2026-03-01 10:15:00', NULL, '739215', 'QR-TOKEN-A102-SECURE', NOW(), NULL),
    
    -- 2. Active: cust_lan at A-104 (D1)
    ('c0000000-0000-0000-0000-000000000002', '2026-04-10 14:00:00', NOW(), 'BX-2026-1002', 'e0000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000104', '2026-04-10', '2026-10-10', 6, 28800000.00, 4800000.00, 4800000.00, 'ACTIVE', 'BX-88220', '0f3386ad-0ff9-4c8f-b01b-7a8f783c7afc', '2026-04-10 15:30:00', NULL, '849204', 'QR-TOKEN-A104-SECURE', NOW(), NULL),
    
    -- 3. Active: cust_hoang at A-203 (D1)
    ('c0000000-0000-0000-0000-000000000003', '2026-05-15 08:30:00', NOW(), 'BX-2026-1003', 'e0000000-0000-0000-0000-000000000009', 'b0000000-0000-0000-0000-000000000203', '2026-05-15', '2026-11-15', 6, 14400000.00, 2400000.00, 2400000.00, 'ACTIVE', 'BX-88221', '0f3386ad-0ff9-4c8f-b01b-7a8f783c7afc', '2026-05-15 09:45:00', NULL, '551928', 'QR-TOKEN-A203-SECURE', NOW(), NULL),
    
    -- 4. Active: cust_phuong at B-102 (D7)
    ('c0000000-0000-0000-0000-000000000004', '2026-06-01 10:00:00', NOW(), 'BX-2026-1004', 'e0000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0000-000000000206', '2026-06-01', '2026-12-01', 6, 7500000.00, 1250000.00, 1250000.00, 'ACTIVE', 'BX-88222', 'bce331ef-5656-4fa6-bb19-8528a10e9671', '2026-06-01 11:20:00', NULL, '912384', 'QR-TOKEN-B102-SECURE', NOW(), NULL),
    
    -- 5. Active: cust_duc at B-104 (D7)
    ('c0000000-0000-0000-0000-000000000005', '2026-06-15 13:30:00', NOW(), 'BX-2026-1005', 'e0000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0000-000000000208', '2026-06-15', '2026-12-15', 6, 28800000.00, 4800000.00, 4800000.00, 'ACTIVE', 'BX-88223', 'bce331ef-5656-4fa6-bb19-8528a10e9671', '2026-06-15 14:15:00', NULL, '339102', 'QR-TOKEN-B104-SECURE', NOW(), NULL),
    
    -- 6. Overdue Locked: customer at B-203 (D7)
    ('c0000000-0000-0000-0000-000000000006', '2026-01-01 08:00:00', NOW(), 'BX-2026-1006', 'cd45b91a-5267-4478-aa59-f6f37e678344', 'b0000000-0000-0000-0000-000000000211', '2026-01-01', '2026-07-01', 6, 14400000.00, 2400000.00, 2400000.00, 'ACTIVE', 'BX-88224', 'bce331ef-5656-4fa6-bb19-8528a10e9671', '2026-01-01 09:00:00', NULL, '119283', 'QR-TOKEN-B203-SECURE', NOW(), NULL),
    
    -- 7. Active: dnguyen at C-102 (TD)
    ('c0000000-0000-0000-0000-000000000007', '2026-07-01 09:15:00', NOW(), 'BX-2026-1007', 'afc5e388-0c32-40f2-b909-4df9837d2253', 'b0000000-0000-0000-0000-000000000304', '2026-07-01', '2027-01-01', 6, 7500000.00, 1250000.00, 1250000.00, 'ACTIVE', 'BX-88225', 'e0000000-0000-0000-0000-000000000005', '2026-07-01 10:30:00', NULL, '662819', 'QR-TOKEN-C102-SECURE', NOW(), NULL),
    
    -- 8. Active: Shelfy at C-104 (TD)
    ('c0000000-0000-0000-0000-000000000008', '2026-07-15 11:00:00', NOW(), 'BX-2026-1008', 'e4048fe9-bbc6-4b41-8f93-bd8e7b73e7a0', 'b0000000-0000-0000-0000-000000000306', '2026-07-15', '2027-01-15', 6, 28800000.00, 4800000.00, 4800000.00, 'ACTIVE', 'BX-88226', 'e0000000-0000-0000-0000-000000000005', '2026-07-15 11:45:00', NULL, '448192', 'QR-TOKEN-C104-SECURE', NOW(), NULL),
    
    -- 9. Active: danguyen at D-102 (TB)
    ('c0000000-0000-0000-0000-000000000009', '2026-08-01 08:30:00', NOW(), 'BX-2026-1009', '2e398528-931b-4d06-bcd7-5a1d6424aeab', 'b0000000-0000-0000-0000-000000000402', '2026-08-01', '2027-02-01', 6, 7500000.00, 1250000.00, 1250000.00, 'ACTIVE', 'BX-88227', 'e0000000-0000-0000-0000-000000000006', '2026-08-01 09:20:00', NULL, '771294', 'QR-TOKEN-D102-SECURE', NOW(), NULL),
    
    -- 10. Active: cust_minh at D-104 (TB)
    ('c0000000-0000-0000-0000-000000000010', '2026-08-15 14:00:00', NOW(), 'BX-2026-1010', 'e0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000404', '2026-08-15', '2027-02-15', 6, 28800000.00, 4800000.00, 4800000.00, 'ACTIVE', 'BX-88228', 'e0000000-0000-0000-0000-000000000006', '2026-08-15 15:00:00', NULL, '883921', 'QR-TOKEN-D104-SECURE', NOW(), NULL),
    
    -- 11. Confirmed (Upcoming Arrival): cust_lan at A-202 (D1)
    ('c0000000-0000-0000-0000-000000000011', NOW() - INTERVAL '1 day', NOW(), 'BX-2026-1011', 'e0000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000202', CURRENT_DATE + INTERVAL '1 day', CURRENT_DATE + INTERVAL '91 days', 3, 3750000.00, 1250000.00, 1250000.00, 'CONFIRMED', 'BX-88229', NULL, NULL, NULL, '294819', 'QR-TOKEN-A202-PENDING', NOW(), NULL),
    
    -- 12. Confirmed (Upcoming Arrival): cust_hoang at C-203 (TD)
    ('c0000000-0000-0000-0000-000000000012', NOW() - INTERVAL '1 day', NOW(), 'BX-2026-1012', 'e0000000-0000-0000-0000-000000000009', 'b0000000-0000-0000-0000-000000000309', CURRENT_DATE + INTERVAL '2 days', CURRENT_DATE + INTERVAL '182 days', 6, 14400000.00, 2400000.00, 2400000.00, 'CONFIRMED', 'BX-88230', NULL, NULL, NULL, '559281', 'QR-TOKEN-C203-PENDING', NOW(), NULL),
    
    -- 13. Confirmed (Upcoming Arrival): cust_phuong at D-204 (TB)
    ('c0000000-0000-0000-0000-000000000013', NOW() - INTERVAL '2 hours', NOW(), 'BX-2026-1013', 'e0000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0000-000000000408', CURRENT_DATE + INTERVAL '3 days', CURRENT_DATE + INTERVAL '368 days', 12, 57600000.00, 4800000.00, 4800000.00, 'CONFIRMED', 'BX-88231', NULL, NULL, NULL, '662019', 'QR-TOKEN-D204-PENDING', NOW(), NULL),
    
    -- 14. Pending Payment: cust_duc at A-101 (D1)
    ('c0000000-0000-0000-0000-000000000014', NOW() - INTERVAL '30 minutes', NOW(), 'BX-2026-1014', 'e0000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0000-000000000101', CURRENT_DATE + INTERVAL '1 day', CURRENT_DATE + INTERVAL '31 days', 1, 450000.00, 450000.00, 450000.00, 'PENDING_PAYMENT', 'BX-88232', NULL, NULL, NULL, NULL, NULL, NULL, NOW() + INTERVAL '23 hours 30 minutes'),
    
    -- 15. Pending Payment: customer at B-101 (D7)
    ('c0000000-0000-0000-0000-000000000015', NOW() - INTERVAL '2 hours', NOW(), 'BX-2026-1015', 'cd45b91a-5267-4478-aa59-f6f37e678344', 'b0000000-0000-0000-0000-000000000205', CURRENT_DATE + INTERVAL '1 day', CURRENT_DATE + INTERVAL '91 days', 3, 1350000.00, 450000.00, 450000.00, 'PENDING_PAYMENT', 'BX-88233', NULL, NULL, NULL, NULL, NULL, NULL, NOW() + INTERVAL '22 hours'),
    
    -- 16. Completed: dnguyen at C-101 (TD) (Previous rental)
    ('c0000000-0000-0000-0000-000000000016', '2025-06-01 08:00:00', '2025-12-05 16:00:00', 'BX-2025-9001', 'afc5e388-0c32-40f2-b909-4df9837d2253', 'b0000000-0000-0000-0000-000000000303', '2025-06-01', '2025-12-01', 6, 2700000.00, 450000.00, 450000.00, 'COMPLETED', 'BX-88101', 'e0000000-0000-0000-0000-000000000005', '2025-06-01 09:00:00', '2025-12-01 15:30:00', '991823', NULL, '2025-06-01 09:00:00', NULL),
    
    -- 17. Completed: Shelfy at D-101 (TB) (Previous rental)
    ('c0000000-0000-0000-0000-000000000017', '2025-07-01 10:00:00', '2026-01-05 11:00:00', 'BX-2025-9002', 'e4048fe9-bbc6-4b41-8f93-bd8e7b73e7a0', 'b0000000-0000-0000-0000-000000000401', '2025-07-01', '2026-01-01', 6, 2700000.00, 450000.00, 450000.00, 'COMPLETED', 'BX-88102', 'e0000000-0000-0000-0000-000000000006', '2025-07-01 10:45:00', '2026-01-02 10:00:00', '773918', NULL, '2025-07-01 10:45:00', NULL),
    
    -- 18. Cancelled: danguyen at A-103 (D1)
    ('c0000000-0000-0000-0000-000000000018', '2026-02-10 09:00:00', '2026-02-11 10:00:00', 'BX-2026-8001', '2e398528-931b-4d06-bcd7-5a1d6424aeab', 'b0000000-0000-0000-0000-000000000103', '2026-02-15', '2026-05-15', 3, 7200000.00, 2400000.00, 2400000.00, 'CANCELLED', 'BX-88199', NULL, NULL, NULL, NULL, NULL, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- -------------------------------------------------------------------------
-- 7. RENTAL CONTRACTS (12 contracts, range 10-15)
-- -------------------------------------------------------------------------
INSERT INTO rental_contracts (
    id, created_at, updated_at, contract_code, customer_id, unit_id, facility_id, booking_id,
    start_date, end_date, monthly_fee, deposit_held, status, signed_document_url, signed_at
)
VALUES
    ('d0000000-0000-0000-0000-000000000001', '2026-03-01 09:10:00', NOW(), 'CTR-2026-1001', 'e0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000102', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', 'c0000000-0000-0000-0000-000000000001', '2026-03-01', '2026-09-01', 1250000.00, 1250000.00, 'ACTIVE', 'https://boxora.vn/contracts/signed/CTR-2026-1001.pdf', '2026-03-01 09:30:00'),
    ('d0000000-0000-0000-0000-000000000002', '2026-04-10 14:10:00', NOW(), 'CTR-2026-1002', 'e0000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000104', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', 'c0000000-0000-0000-0000-000000000002', '2026-04-10', '2026-10-10', 4800000.00, 4800000.00, 'ACTIVE', 'https://boxora.vn/contracts/signed/CTR-2026-1002.pdf', '2026-04-10 14:45:00'),
    ('d0000000-0000-0000-0000-000000000003', '2026-05-15 08:45:00', NOW(), 'CTR-2026-1003', 'e0000000-0000-0000-0000-000000000009', 'b0000000-0000-0000-0000-000000000203', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', 'c0000000-0000-0000-0000-000000000003', '2026-05-15', '2026-11-15', 2400000.00, 2400000.00, 'ACTIVE', 'https://boxora.vn/contracts/signed/CTR-2026-1003.pdf', '2026-05-15 09:15:00'),
    ('d0000000-0000-0000-0000-000000000004', '2026-06-01 10:15:00', NOW(), 'CTR-2026-1004', 'e0000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0000-000000000206', '45e03ded-5da1-43d5-bea7-96c645d5f96c', 'c0000000-0000-0000-0000-000000000004', '2026-06-01', '2026-12-01', 1250000.00, 1250000.00, 'ACTIVE', 'https://boxora.vn/contracts/signed/CTR-2026-1004.pdf', '2026-06-01 10:50:00'),
    ('d0000000-0000-0000-0000-000000000005', '2026-06-15 13:45:00', NOW(), 'CTR-2026-1005', 'e0000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0000-000000000208', '45e03ded-5da1-43d5-bea7-96c645d5f96c', 'c0000000-0000-0000-0000-000000000005', '2026-06-15', '2026-12-15', 4800000.00, 4800000.00, 'ACTIVE', 'https://boxora.vn/contracts/signed/CTR-2026-1005.pdf', '2026-06-15 14:05:00'),
    ('d0000000-0000-0000-0000-000000000006', '2026-01-01 08:15:00', NOW(), 'CTR-2026-1006', 'cd45b91a-5267-4478-aa59-f6f37e678344', 'b0000000-0000-0000-0000-000000000211', '45e03ded-5da1-43d5-bea7-96c645d5f96c', 'c0000000-0000-0000-0000-000000000006', '2026-01-01', '2026-07-01', 2400000.00, 2400000.00, 'EXPIRED', 'https://boxora.vn/contracts/signed/CTR-2026-1006.pdf', '2026-01-01 08:45:00'),
    ('d0000000-0000-0000-0000-000000000007', '2026-07-01 09:30:00', NOW(), 'CTR-2026-1007', 'afc5e388-0c32-40f2-b909-4df9837d2253', 'b0000000-0000-0000-0000-000000000304', 'fd8f948e-fdff-4a81-ad0f-fc45639b545d', 'c0000000-0000-0000-0000-000000000007', '2026-07-01', '2027-01-01', 1250000.00, 1250000.00, 'ACTIVE', 'https://boxora.vn/contracts/signed/CTR-2026-1007.pdf', '2026-07-01 10:00:00'),
    ('d0000000-0000-0000-0000-000000000008', '2026-07-15 11:15:00', NOW(), 'CTR-2026-1008', 'e4048fe9-bbc6-4b41-8f93-bd8e7b73e7a0', 'b0000000-0000-0000-0000-000000000306', 'fd8f948e-fdff-4a81-ad0f-fc45639b545d', 'c0000000-0000-0000-0000-000000000008', '2026-07-15', '2027-01-15', 4800000.00, 4800000.00, 'ACTIVE', 'https://boxora.vn/contracts/signed/CTR-2026-1008.pdf', '2026-07-15 11:35:00'),
    ('d0000000-0000-0000-0000-000000000009', '2026-08-01 08:45:00', NOW(), 'CTR-2026-1009', '2e398528-931b-4d06-bcd7-5a1d6424aeab', 'b0000000-0000-0000-0000-000000000402', 'a1111111-2222-3333-4444-555555555555', 'c0000000-0000-0000-0000-000000000009', '2026-08-01', '2027-02-01', 1250000.00, 1250000.00, 'ACTIVE', 'https://boxora.vn/contracts/signed/CTR-2026-1009.pdf', '2026-08-01 09:05:00'),
    ('d0000000-0000-0000-0000-000000000010', '2026-08-15 14:15:00', NOW(), 'CTR-2026-1010', 'e0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000404', 'a1111111-2222-3333-4444-555555555555', 'c0000000-0000-0000-0000-000000000010', '2026-08-15', '2027-02-15', 4800000.00, 4800000.00, 'ACTIVE', 'https://boxora.vn/contracts/signed/CTR-2026-1010.pdf', '2026-08-15 14:40:00'),
    ('d0000000-0000-0000-0000-000000000011', NOW() - INTERVAL '1 day', NOW(), 'CTR-2026-1011', 'e0000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000202', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', 'c0000000-0000-0000-0000-000000000011', CURRENT_DATE + INTERVAL '1 day', CURRENT_DATE + INTERVAL '91 days', 1250000.00, 1250000.00, 'PENDING_SIGNATURE', NULL, NULL),
    ('d0000000-0000-0000-0000-000000000012', NOW() - INTERVAL '1 day', NOW(), 'CTR-2026-1012', 'e0000000-0000-0000-0000-000000000009', 'b0000000-0000-0000-0000-000000000309', 'fd8f948e-fdff-4a81-ad0f-fc45639b545d', 'c0000000-0000-0000-0000-000000000012', CURRENT_DATE + INTERVAL '2 days', CURRENT_DATE + INTERVAL '182 days', 2400000.00, 2400000.00, 'PENDING_SIGNATURE', NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- -------------------------------------------------------------------------
-- 8. PAYMENTS (20 payments, range 15-30)
-- -------------------------------------------------------------------------
INSERT INTO payments (
    id, created_at, updated_at, transaction_id, booking_id, contract_id,
    renewal_months, amount, payment_type, status, payment_method, payment_time
)
VALUES
    ('f0000000-0000-0000-0000-000000000001', '2026-03-01 09:05:00', NOW(), 'TXN-2026-1001-DEP', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', NULL, 1250000.00, 'DEPOSIT', 'COMPLETED', 'VNPAY', '2026-03-01 09:05:00'),
    ('f0000000-0000-0000-0000-000000000002', '2026-03-01 09:06:00', NOW(), 'TXN-2026-1001-RENT', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', NULL, 7500000.00, 'RENTAL', 'COMPLETED', 'VNPAY', '2026-03-01 09:06:00'),
    ('f0000000-0000-0000-0000-000000000003', '2026-04-10 14:05:00', NOW(), 'TXN-2026-1002-DEP', 'c0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002', NULL, 4800000.00, 'DEPOSIT', 'COMPLETED', 'BANK_TRANSFER', '2026-04-10 14:05:00'),
    ('f0000000-0000-0000-0000-000000000004', '2026-04-10 14:06:00', NOW(), 'TXN-2026-1002-RENT', 'c0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002', NULL, 28800000.00, 'RENTAL', 'COMPLETED', 'BANK_TRANSFER', '2026-04-10 14:06:00'),
    ('f0000000-0000-0000-0000-000000000005', '2026-05-15 08:35:00', NOW(), 'TXN-2026-1003-FULL', 'c0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000003', NULL, 16800000.00, 'RENTAL', 'COMPLETED', 'MOMO', '2026-05-15 08:35:00'),
    ('f0000000-0000-0000-0000-000000000006', '2026-06-01 10:05:00', NOW(), 'TXN-2026-1004-DEP', 'c0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000004', NULL, 1250000.00, 'DEPOSIT', 'COMPLETED', 'VNPAY', '2026-06-01 10:05:00'),
    ('f0000000-0000-0000-0000-000000000007', '2026-06-01 10:06:00', NOW(), 'TXN-2026-1004-RENT', 'c0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000004', NULL, 7500000.00, 'RENTAL', 'COMPLETED', 'VNPAY', '2026-06-01 10:06:00'),
    ('f0000000-0000-0000-0000-000000000008', '2026-06-15 13:35:00', NOW(), 'TXN-2026-1005-FULL', 'c0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000005', NULL, 33600000.00, 'RENTAL', 'COMPLETED', 'BANK_TRANSFER', '2026-06-15 13:35:00'),
    ('f0000000-0000-0000-0000-000000000009', '2026-07-01 09:20:00', NOW(), 'TXN-2026-1007-FULL', 'c0000000-0000-0000-0000-000000000007', 'd0000000-0000-0000-0000-000000000007', NULL, 8750000.00, 'RENTAL', 'COMPLETED', 'VNPAY', '2026-07-01 09:20:00'),
    ('f0000000-0000-0000-0000-000000000010', '2026-07-15 11:05:00', NOW(), 'TXN-2026-1008-FULL', 'c0000000-0000-0000-0000-000000000008', 'd0000000-0000-0000-0000-000000000008', NULL, 33600000.00, 'RENTAL', 'COMPLETED', 'BANK_TRANSFER', '2026-07-15 11:05:00'),
    ('f0000000-0000-0000-0000-000000000011', '2026-08-01 08:35:00', NOW(), 'TXN-2026-1009-FULL', 'c0000000-0000-0000-0000-000000000009', 'd0000000-0000-0000-0000-000000000009', NULL, 8750000.00, 'RENTAL', 'COMPLETED', 'MOMO', '2026-08-01 08:35:00'),
    ('f0000000-0000-0000-0000-000000000012', '2026-08-15 14:05:00', NOW(), 'TXN-2026-1010-FULL', 'c0000000-0000-0000-0000-000000000010', 'd0000000-0000-0000-0000-000000000010', NULL, 33600000.00, 'RENTAL', 'COMPLETED', 'VNPAY', '2026-08-15 14:05:00'),
    ('f0000000-0000-0000-0000-000000000013', '2026-08-25 10:00:00', NOW(), 'TXN-2026-1001-REN3M', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 3, 3750000.00, 'RENEWAL', 'COMPLETED', 'VNPAY', '2026-08-25 10:00:00'),
    ('f0000000-0000-0000-0000-000000000014', NOW() - INTERVAL '1 day', NOW(), 'TXN-2026-1011-DEP', 'c0000000-0000-0000-0000-000000000011', 'd0000000-0000-0000-0000-000000000011', NULL, 1250000.00, 'DEPOSIT', 'COMPLETED', 'VNPAY', NOW() - INTERVAL '1 day'),
    ('f0000000-0000-0000-0000-000000000015', NOW() - INTERVAL '1 day', NOW(), 'TXN-2026-1012-DEP', 'c0000000-0000-0000-0000-000000000012', 'd0000000-0000-0000-0000-000000000012', NULL, 2400000.00, 'DEPOSIT', 'COMPLETED', 'MOMO', NOW() - INTERVAL '1 day'),
    ('f0000000-0000-0000-0000-000000000016', NOW() - INTERVAL '2 hours', NOW(), 'TXN-2026-1013-DEP', 'c0000000-0000-0000-0000-000000000013', NULL, NULL, 4800000.00, 'DEPOSIT', 'COMPLETED', 'VNPAY', NOW() - INTERVAL '2 hours'),
    ('f0000000-0000-0000-0000-000000000017', NOW() - INTERVAL '30 minutes', NOW(), 'TXN-2026-1014-PEND', 'c0000000-0000-0000-0000-000000000014', NULL, NULL, 450000.00, 'DEPOSIT', 'PENDING', 'VNPAY', NOW() - INTERVAL '30 minutes'),
    ('f0000000-0000-0000-0000-000000000018', NOW() - INTERVAL '2 hours', NOW(), 'TXN-2026-1015-PEND', 'c0000000-0000-0000-0000-000000000015', NULL, NULL, 1350000.00, 'RENTAL', 'PENDING', 'VNPAY', NOW() - INTERVAL '2 hours'),
    ('f0000000-0000-0000-0000-000000000019', '2025-12-05 16:30:00', NOW(), 'TXN-2025-9001-REF', 'c0000000-0000-0000-0000-000000000016', NULL, NULL, 450000.00, 'REFUND', 'COMPLETED', 'BANK_TRANSFER', '2025-12-05 16:30:00'),
    ('f0000000-0000-0000-0000-000000000020', '2026-01-05 11:30:00', NOW(), 'TXN-2025-9002-REF', 'c0000000-0000-0000-0000-000000000017', NULL, NULL, 450000.00, 'REFUND', 'COMPLETED', 'BANK_TRANSFER', '2026-01-05 11:30:00')
ON CONFLICT (id) DO NOTHING;

-- -------------------------------------------------------------------------
-- 9. HANDOVER RECORDS (8 records: 4 Check-In, 4 Check-Out, range 5-10)
-- -------------------------------------------------------------------------
INSERT INTO handover_records (
    id, created_at, updated_at, booking_id, staff_id, record_type, unit_condition, notes,
    recorded_at, checklist_summary, deduction_amount, deposit_settled, evidence_photos, refund_amount, review_status
)
VALUES
    -- Check-in 1: cust_minh at A-102
    ('11110000-0000-0000-0000-000000000001', '2026-03-01 10:15:00', NOW(), 'c0000000-0000-0000-0000-000000000001', '0f3386ad-0ff9-4c8f-b01b-7a8f783c7afc', 'CHECK_IN',
     'Kho nguyên vẹn 100%, sàn sạch, khóa IoT hoạt động trơn tru.', 'Khách nhận phòng đúng hẹn, cấp mã PIN và bàn giao thẻ RFID số RF-401.',
     '2026-03-01 10:15:00', '5/5 tiêu chuẩn nghiệm thu đạt chuẩn', 0.00, 1250000.00, 'https://boxora.vn/photos/handover/A102_in.jpg', 0.00, 'COMPLETED'),

    -- Check-in 2: cust_lan at A-104
    ('11110000-0000-0000-0000-000000000002', '2026-04-10 15:30:00', NOW(), 'c0000000-0000-0000-0000-000000000002', '0f3386ad-0ff9-4c8f-b01b-7a8f783c7afc', 'CHECK_IN',
     'Cửa cuốn điện hoạt động tốt, hệ thống cảm biến khói bình thường.', 'Khách gửi hàng mẫu xuất nhập khẩu, mượn xe đẩy số 02.',
     '2026-04-10 15:30:00', '5/5 tiêu chuẩn nghiệm thu đạt chuẩn', 0.00, 4800000.00, 'https://boxora.vn/photos/handover/A104_in.jpg', 0.00, 'COMPLETED'),

    -- Check-in 3: cust_phuong at B-102
    ('11110000-0000-0000-0000-000000000003', '2026-06-01 11:20:00', NOW(), 'c0000000-0000-0000-0000-000000000004', 'bce331ef-5656-4fa6-bb19-8528a10e9671', 'CHECK_IN',
     'Kho sạch sẽ, hệ thống điều hòa vi khí hậu 21°C đạt chuẩn.', 'Bàn giao chìa khóa dự phòng niêm phong và hướng dẫn mở cửa bằng Bluetooth/App.',
     '2026-06-01 11:20:00', '5/5 tiêu chuẩn nghiệm thu đạt chuẩn', 0.00, 1250000.00, 'https://boxora.vn/photos/handover/B102_in.jpg', 0.00, 'COMPLETED'),

    -- Check-in 4: dnguyen at C-102
    ('11110000-0000-0000-0000-000000000004', '2026-07-01 10:30:00', NOW(), 'c0000000-0000-0000-0000-000000000007', 'e0000000-0000-0000-0000-000000000005', 'CHECK_IN',
     'Hiện trạng hoàn hảo, khóa điện tử pin 100%.', 'Bàn giao cho khách hàng cá nhân chứa vật dụng gia đình.',
     '2026-07-01 10:30:00', '5/5 tiêu chuẩn nghiệm thu đạt chuẩn', 0.00, 1250000.00, 'https://boxora.vn/photos/handover/C102_in.jpg', 0.00, 'COMPLETED'),

    -- Check-out 1: Hoàn tất hoàn cọc đầy đủ cho booking 16
    ('11110000-0000-0000-0000-000000000005', '2025-12-01 15:30:00', NOW(), 'c0000000-0000-0000-0000-000000000016', 'e0000000-0000-0000-0000-000000000005', 'CHECK_OUT',
     'Kho trả lại sạch sẽ, không hư hỏng tài sản.', 'Đã thu hồi thẻ RFID, giải tỏa mã PIN truy cập.',
     '2025-12-01 15:30:00', '5/5 tiêu chuẩn kiểm tra đạt yêu cầu', 0.00, 450000.00, 'https://boxora.vn/photos/handover/C101_out.jpg', 450000.00, 'COMPLETED'),

    -- Check-out 2: Hoàn cọc đầy đủ cho booking 17
    ('11110000-0000-0000-0000-000000000006', '2026-01-02 10:00:00', NOW(), 'c0000000-0000-0000-0000-000000000017', 'e0000000-0000-0000-0000-000000000006', 'CHECK_OUT',
     'Kho trả lại đúng hiện trạng bàn giao ban đầu.', 'Khách dọn hết đồ đạc, thanh lý hợp đồng đúng hạn.',
     '2026-01-02 10:00:00', '5/5 tiêu chuẩn kiểm tra đạt yêu cầu', 0.00, 450000.00, 'https://boxora.vn/photos/handover/D101_out.jpg', 450000.00, 'COMPLETED'),

    -- Check-out 3: Có khấu trừ phí vệ sinh và chuyển Kế toán duyệt hoàn cọc
    ('11110000-0000-0000-0000-000000000007', NOW() - INTERVAL '3 days', NOW(), 'c0000000-0000-0000-0000-000000000018', '0f3386ad-0ff9-4c8f-b01b-7a8f783c7afc', 'CHECK_OUT',
     'Mặt sàn có vết bẩn dầu mỡ cần xử lý tẩy rửa công nghiệp.', 'Khách đồng ý khấu trừ 150.000đ phí vệ sinh tiêu chuẩn từ tiền cọc.',
     NOW() - INTERVAL '3 days', '4/5 tiêu chuẩn đạt (Cần vệ sinh sàn)', 150000.00, 2400000.00, 'https://boxora.vn/photos/handover/A103_stain.jpg', 2250000.00, 'PENDING_ACCOUNTING_REVIEW'),

    -- Check-out 4: Đã lập biên bản kiểm tra trả kho cơ sở Q7
    ('11110000-0000-0000-0000-000000000008', NOW() - INTERVAL '1 day', NOW(), 'c0000000-0000-0000-0000-000000000006', 'bce331ef-5656-4fa6-bb19-8528a10e9671', 'CHECK_OUT',
     'Kiểm kê tài sản tồn đọng sau khi kho quá hạn thanh toán.', 'Lập biên bản ghi nhận hiện trạng để tiến hành thủ tục pháp lý niêm phong.',
     NOW() - INTERVAL '1 day', 'Kiểm tra hiện trạng niêm phong', 0.00, 2400000.00, 'https://boxora.vn/photos/handover/B203_sealed.jpg', 0.00, 'COMPLETED')
ON CONFLICT (id) DO NOTHING;

-- -------------------------------------------------------------------------
-- 10. SMART KEY / PIN (6 Master Key Overrides, range 5-10)
-- -------------------------------------------------------------------------
INSERT INTO master_key_overrides (
    id, created_at, updated_at, facility_id, performed_by_id, witness_id, category, severity, reason, document_reference, resource_type, resource_id
)
VALUES
    ('22220000-0000-0000-0000-000000000001', '2026-09-10 14:00:00', NOW(), 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', '0f3386ad-0ff9-4c8f-b01b-7a8f783c7afc', '43695aac-1802-4a5d-82aa-2ef466796e10', 'EMERGENCY', 'CRITICAL', 'Cảm biến báo nhiệt độ buồng kho tăng cao bất thường; mở kiểm tra an toàn PCCC.', 'BB-KH-2026-091', 'STORAGE_UNIT', 'b0000000-0000-0000-0000-000000000204'),
    ('22220000-0000-0000-0000-000000000002', '2026-09-15 09:30:00', NOW(), '45e03ded-5da1-43d5-bea7-96c645d5f96c', 'bce331ef-5656-4fa6-bb19-8528a10e9671', 'e0000000-0000-0000-0000-000000000002', 'MAINTENANCE', 'HIGH', 'Pin ổ khóa điện tử SmartLock báo dưới 10%; thay pin khẩn cấp bảo đảm kết nối.', 'BB-BT-2026-112', 'STORAGE_UNIT', 'b0000000-0000-0000-0000-000000000210'),
    ('22220000-0000-0000-0000-000000000003', '2026-09-20 10:15:00', NOW(), 'fd8f948e-fdff-4a81-ad0f-fc45639b545d', 'e0000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000003', 'AUDIT', 'MEDIUM', 'Kiểm tra độ ẩm định kỳ theo tiêu chuẩn bảo quản tài liệu văn phòng.', 'BB-KT-2026-045', 'STORAGE_UNIT', 'b0000000-0000-0000-0000-000000000306'),
    ('22220000-0000-0000-0000-000000000004', '2026-09-28 16:20:00', NOW(), 'a1111111-2222-3333-4444-555555555555', 'e0000000-0000-0000-0000-000000000006', 'e0000000-0000-0000-0000-000000000004', 'EMERGENCY', 'HIGH', 'Hỗ trợ khách hàng mở kho khẩn cấp do điện thoại hết pin và không nhớ mã PIN.', 'BB-HOTRO-2026-08', 'STORAGE_UNIT', 'b0000000-0000-0000-0000-000000000402'),
    ('22220000-0000-0000-0000-000000000005', '2026-10-02 11:00:00', NOW(), 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', '0f3386ad-0ff9-4c8f-b01b-7a8f783c7afc', '43695aac-1802-4a5d-82aa-2ef466796e10', 'MAINTENANCE', 'MEDIUM', 'Kỹ thuật viên kiểm tra tra dầu ray trượt cửa cuốn buồng kho.', 'BB-BT-2026-130', 'STORAGE_UNIT', 'b0000000-0000-0000-0000-000000000104'),
    ('22220000-0000-0000-0000-000000000006', '2026-10-08 15:45:00', NOW(), '45e03ded-5da1-43d5-bea7-96c645d5f96c', 'bce331ef-5656-4fa6-bb19-8528a10e9671', 'e0000000-0000-0000-0000-000000000002', 'AUDIT', 'HIGH', 'Niêm phong kho quá hạn ngày thứ 7 theo quy chuẩn BR-RULE-012.', 'BB-NP-2026-007', 'STORAGE_UNIT', 'b0000000-0000-0000-0000-000000000211')
ON CONFLICT (id) DO NOTHING;

-- -------------------------------------------------------------------------
-- 11. SUPPORT TICKETS (8 tickets, range 5-10)
-- -------------------------------------------------------------------------
INSERT INTO support_tickets (
    id, ticket_code, user_id, booking_id, category, title, description,
    status, priority, assigned_staff_id, resolution_note, created_at, updated_at
)
VALUES
    ('33330000-0000-0000-0000-000000000001', 'TK-2026-0001', 'e0000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000001',
     'PIN_CODE', 'Yêu cầu cấp lại mã PIN do quên mật khẩu', 'Tôi đến cơ sở lúc 19h nhưng không nhớ mã PIN 6 số, nhờ hỗ trợ gửi lại qua email.',
     'RESOLVED', 'HIGH', '0f3386ad-0ff9-4c8f-b01b-7a8f783c7afc', 'Đã xác thực CCCD khách hàng qua Zalo và reset mã PIN mới thành công.',
     NOW() - INTERVAL '5 days', NOW() - INTERVAL '4 days'),

    ('33330000-0000-0000-0000-000000000002', 'TK-2026-0002', 'e0000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000002',
     'LOCK_ISSUE', 'Ổ khóa thông minh chập chờn khi nhập mã', 'Bàn phím cảm ứng trên cửa kho A-104 phản hồi chậm khi bấm phím số 8.',
     'RESOLVED', 'MEDIUM', '0f3386ad-0ff9-4c8f-b01b-7a8f783c7afc', 'Kỹ thuật viên đã lau sạch bề mặt cảm ứng và cập nhật firmware khóa IoT.',
     NOW() - INTERVAL '4 days', NOW() - INTERVAL '3 days'),

    ('33330000-0000-0000-0000-000000000003', 'TK-2026-0003', 'e0000000-0000-0000-0000-000000000009', 'c0000000-0000-0000-0000-000000000003',
     'PAYMENT_ISSUE', 'Hóa đơn điện tử VAT cho công ty', 'Nhờ quầy gửi hóa đơn điện tử GTGT tháng 9 cho công ty TNHH Hóa Mỹ Phẩm An Bình.',
     'IN_PROGRESS', 'MEDIUM', '0f3386ad-0ff9-4c8f-b01b-7a8f783c7afc', 'Đã chuyển thông tin mã số thuế cho bộ phận Kế toán xuất e-Invoice.',
     NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day'),

    ('33330000-0000-0000-0000-000000000004', 'TK-2026-0004', 'e0000000-0000-0000-0000-000000000010', 'c0000000-0000-0000-0000-000000000004',
     'FACILITY_DAMAGE', 'Đèn LED hành lang tầng 2 khu B bị nhấp nháy', 'Đoạn hành lang trước kho B-202 bóng đèn LED bị chớp giật gây khó quan sát khi dỡ hàng ban đêm.',
     'OPEN', 'LOW', 'bce331ef-5656-4fa6-bb19-8528a10e9671', NULL,
     NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),

    ('33330000-0000-0000-0000-000000000005', 'TK-2026-0005', 'e0000000-0000-0000-0000-000000000011', 'c0000000-0000-0000-0000-000000000005',
     'OTHER', 'Mượn xe nâng tay và pallet di chuyển đồ nặng', 'Sáng thứ 7 tôi chuyển 30 thùng tài liệu vào kho, nhờ quầy chuẩn bị xe đẩy 4 bánh lớn.',
     'RESOLVED', 'LOW', 'bce331ef-5656-4fa6-bb19-8528a10e9671', 'Đã bố trí sẵn xe đẩy số 01 tại sảnh bốc dỡ hàng hóa tầng 1.',
     NOW() - INTERVAL '3 days', NOW() - INTERVAL '2 days'),

    ('33330000-0000-0000-0000-000000000006', 'TK-2026-0006', 'afc5e388-0c32-40f2-b909-4df9837d2253', 'c0000000-0000-0000-0000-000000000007',
     'LOCK_ISSUE', 'Khóa phát tiếng bíp cảnh báo pin yếu', 'Mỗi lần mở kho C-102 khóa kêu 3 tiếng bíp ngắn.',
     'RESOLVED', 'HIGH', 'e0000000-0000-0000-0000-000000000005', 'Đã thay bộ pin 4 viên AA mới, ổ khóa hoạt động êm ái.',
     NOW() - INTERVAL '6 days', NOW() - INTERVAL '5 days'),

    ('33330000-0000-0000-0000-000000000007', 'TK-2026-0007', 'e4048fe9-bbc6-4b41-8f93-bd8e7b73e7a0', 'c0000000-0000-0000-0000-000000000008',
     'OTHER', 'Hỏi thủ tục ủy quyền cho nhân viên vào lấy hàng', 'Tôi muốn cấp mã PIN phụ cho tài xế giao nhận vào lấy kiện hàng số 4.',
     'OPEN', 'MEDIUM', NULL, NULL,
     NOW() - INTERVAL '4 hours', NOW() - INTERVAL '4 hours'),

    ('33330000-0000-0000-0000-000000000008', 'TK-2026-0008', 'cd45b91a-5267-4478-aa59-f6f37e678344', 'c0000000-0000-0000-0000-000000000006',
     'PAYMENT_ISSUE', 'Khiếu nại phí phạt chậm thanh toán hợp đồng B-203', 'Tôi đi công tác nước ngoài nên chưa kịp chuyển tiền, xin miễn giảm phí phạt trễ hạn.',
     'IN_PROGRESS', 'URGENT', 'bce331ef-5656-4fa6-bb19-8528a10e9671', 'Đã chuyển báo cáo lên Facility Manager Q7 xem xét theo điều khoản miễn trừ bất khả kháng.',
     NOW() - INTERVAL '1 day', NOW() - INTERVAL '6 hours')
ON CONFLICT (ticket_code) DO NOTHING;

-- -------------------------------------------------------------------------
-- 12. NOTIFICATION LOGS (15 notifications, range 10-20)
-- -------------------------------------------------------------------------
INSERT INTO notification_logs (
    id, created_at, updated_at, recipient_id, recipient_email, recipient_name, facility_id, channel,
    notification_type, reference_type, reference_id, title, content, status
)
VALUES
    ('44440000-0000-0000-0000-000000000001', '2026-03-01 09:07:00', NOW(), 'e0000000-0000-0000-0000-000000000007', 'minh.tuan@gmail.com', 'Trần Minh Tuấn', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', 'EMAIL',
     'PAYMENT_SUCCESS', 'PAYMENT', 'f0000000-0000-0000-0000-000000000001',
     'Thanh toán thành công đơn đặt kho #BX-2026-1001', 'Boxora đã nhận thanh toán tiền cọc 1.250.000₫ và tiền thuê cho buồng kho A-102. Chúc quý khách trải nghiệm dịch vụ tiện ích!', 'SENT'),

    ('44440000-0000-0000-0000-000000000002', '2026-03-01 09:12:00', NOW(), 'e0000000-0000-0000-0000-000000000007', 'minh.tuan@gmail.com', 'Trần Minh Tuấn', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', 'EMAIL',
     'CONTRACT_READY_TO_SIGN', 'CONTRACT', 'd0000000-0000-0000-0000-000000000001',
     'Hợp đồng thuê kho điện tử #CTR-2026-1001 đã sẵn sàng ký', 'Kính mời quý khách kiểm tra điều khoản và thực hiện ký điện tử bằng mã OTP đã gửi qua email.', 'SENT'),

    ('44440000-0000-0000-0000-000000000003', '2026-03-01 10:20:00', NOW(), 'e0000000-0000-0000-0000-000000000007', 'minh.tuan@gmail.com', 'Trần Minh Tuấn', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', 'EMAIL',
     'PIN_DISPATCHED', 'BOOKING', 'c0000000-0000-0000-0000-000000000001',
     'Mã PIN truy cập kho số hóa của bạn: 739215', 'Mã khóa phòng kho A-102 đã được kích hoạt trên hệ thống IoT. Quý khách có thể mở cửa 24/7.', 'SENT'),

    ('44440000-0000-0000-0000-000000000004', '2026-04-10 14:08:00', NOW(), 'e0000000-0000-0000-0000-000000000008', 'hoangyen.le@gmail.com', 'Lê Thị Hoàng Yến', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', 'EMAIL',
     'BOOKING_CONFIRMED', 'BOOKING', 'c0000000-0000-0000-0000-000000000002',
     'Xác nhận giữ chỗ thành công kho #A-104', 'Đơn đặt kho #BX-2026-1002 đã được xác nhận. Hẹn gặp quý khách tại cơ sở Quận 1.', 'SENT'),

    ('44440000-0000-0000-0000-000000000005', '2026-05-15 08:38:00', NOW(), 'e0000000-0000-0000-0000-000000000009', 'namanh.hoang@gmail.com', 'Hoàng Nam Anh', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', 'EMAIL',
     'HANDOVER_COMPLETED', 'HANDOVER', '11110000-0000-0000-0000-000000000002',
     'Biên bản bàn giao kho #A-203 đã được ký kết', 'Quá trình nghiệm thu hiện trường hoàn tất, chúc quý khách lưu trữ đồ an toàn và thuận tiện.', 'SENT'),

    ('44440000-0000-0000-0000-000000000006', '2026-06-01 10:10:00', NOW(), 'e0000000-0000-0000-0000-000000000010', 'maiphuong.pham@gmail.com', 'Phạm Mai Phương', '45e03ded-5da1-43d5-bea7-96c645d5f96c', 'EMAIL',
     'PAYMENT_SUCCESS', 'PAYMENT', 'f0000000-0000-0000-0000-000000000006',
     'Xác nhận thanh toán tiền thuê buồng kho #B-102', 'Cảm ơn quý khách đã tin tưởng dịch vụ Boxora cơ sở Quận 7 Nam Sài Gòn.', 'SENT'),

    ('44440000-0000-0000-0000-000000000007', '2026-06-24 09:00:00', NOW(), 'cd45b91a-5267-4478-aa59-f6f37e678344', 'customer@gmail.com', 'System Customer', '45e03ded-5da1-43d5-bea7-96c645d5f96c', 'EMAIL',
     'EXPIRATION_REMINDER_7DAYS', 'CONTRACT', 'd0000000-0000-0000-0000-000000000006',
     'Nhắc gia hạn hợp đồng thuê kho #CTR-2026-1006 (Còn 7 ngày)', 'Hợp đồng của quý khách sẽ hết hạn vào ngày 01/07/2026. Quý khách vui lòng gia hạn trực tuyến để duy trì quyền truy cập kho.', 'SENT'),

    ('44440000-0000-0000-0000-000000000008', '2026-06-28 09:00:00', NOW(), 'cd45b91a-5267-4478-aa59-f6f37e678344', 'customer@gmail.com', 'System Customer', '45e03ded-5da1-43d5-bea7-96c645d5f96c', 'EMAIL',
     'EXPIRATION_REMINDER_3DAYS', 'CONTRACT', 'd0000000-0000-0000-0000-000000000006',
     'Cảnh báo hết hạn hợp đồng thuê kho #B-203 (Còn 3 ngày cuối)', 'Sau ngày 01/07/2026, mã PIN điện tử sẽ tạm ngắt kết nối theo quy định quản lý buồng kho.', 'SENT'),

    ('44440000-0000-0000-0000-000000000009', '2026-07-01 09:25:00', NOW(), 'afc5e388-0c32-40f2-b909-4df9837d2253', 'ledangnguyena6@gmail.com', 'nguyen', 'fd8f948e-fdff-4a81-ad0f-fc45639b545d', 'EMAIL',
     'BOOKING_CONFIRMED', 'BOOKING', 'c0000000-0000-0000-0000-000000000007',
     'Đăng ký thuê kho #C-102 thành công tại Boxora Thủ Đức', 'Buồng kho cá nhân 3m² của bạn đã sẵn sàng bàn giao.', 'SENT'),

    ('44440000-0000-0000-0000-000000000010', '2026-07-15 11:10:00', NOW(), 'e4048fe9-bbc6-4b41-8f93-bd8e7b73e7a0', 'shelfyorganization@gmail.com', 'shelfy', 'fd8f948e-fdff-4a81-ad0f-fc45639b545d', 'EMAIL',
     'PAYMENT_SUCCESS', 'PAYMENT', 'f0000000-0000-0000-0000-000000000010',
     'Xác nhận hóa đơn chuyển khoản thuê kho thương mại #C-104', 'Kho diện tích 12m² đã được cấp mã truy cập thông minh.', 'SENT'),

    ('44440000-0000-0000-0000-000000000011', '2026-08-01 08:40:00', NOW(), '2e398528-931b-4d06-bcd7-5a1d6424aeab', 'ledangnguyena1@gmail.com', 'nguyen', 'a1111111-2222-3333-4444-555555555555', 'EMAIL',
     'BOOKING_CONFIRMED', 'BOOKING', 'c0000000-0000-0000-0000-000000000009',
     'Chào mừng quý khách đến cơ sở Tân Bình Mega Hub', 'Đơn đặt kho #BX-2026-1009 của quý khách đã được ghi nhận vào hệ thống.', 'SENT'),

    ('44440000-0000-0000-0000-000000000012', '2026-08-15 14:10:00', NOW(), 'e0000000-0000-0000-0000-000000000007', 'minh.tuan@gmail.com', 'Trần Minh Tuấn', 'a1111111-2222-3333-4444-555555555555', 'EMAIL',
     'PAYMENT_SUCCESS', 'PAYMENT', 'f0000000-0000-0000-0000-000000000012',
     'Thanh toán hoàn tất kho hàng lớn #D-104', 'Kích hoạt thành công hợp đồng thuê 6 tháng với ưu đãi chiết khấu 10%.', 'SENT'),

    ('44440000-0000-0000-0000-000000000013', '2026-08-25 10:05:00', NOW(), 'e0000000-0000-0000-0000-000000000007', 'minh.tuan@gmail.com', 'Trần Minh Tuấn', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', 'EMAIL',
     'PAYMENT_SUCCESS', 'RENEWAL', 'f0000000-0000-0000-0000-000000000013',
     'Gia hạn hợp đồng thành công thêm 3 tháng kho #A-102', 'Thời hạn hợp đồng mới kéo dài đến 01/12/2026. Mã PIN cũ tiếp tục có hiệu lực.', 'SENT'),

    ('44440000-0000-0000-0000-000000000014', NOW() - INTERVAL '1 day', NOW(), 'e0000000-0000-0000-0000-000000000008', 'hoangyen.le@gmail.com', 'Lê Thị Hoàng Yến', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', 'EMAIL',
     'BOOKING_CONFIRMED', 'BOOKING', 'c0000000-0000-0000-0000-000000000011',
     'Nhắc lịch bàn giao nhận kho #A-202 vào ngày mai', 'Quý khách vui lòng mang theo CCCD bản gốc để nhân viên quầy hoàn tất thủ tục bàn giao.', 'SENT'),

    ('44440000-0000-0000-0000-000000000015', '2025-12-05 16:35:00', NOW(), 'afc5e388-0c32-40f2-b909-4df9837d2253', 'ledangnguyena6@gmail.com', 'nguyen', 'fd8f948e-fdff-4a81-ad0f-fc45639b545d', 'EMAIL',
     'PAYMENT_SUCCESS', 'REFUND', 'f0000000-0000-0000-0000-000000000019',
     'Hoàn trả tiền đặt cọc 450.000₫ thành công', 'Khoản tiền đặt cọc buồng kho #C-101 đã được hoàn về tài khoản ngân hàng của quý khách.', 'SENT')
ON CONFLICT (id) DO NOTHING;

-- -------------------------------------------------------------------------
-- 13. ACTIVITY LOGS (Thêm 15 logs nghiệp vụ bổ sung thực tế)
-- -------------------------------------------------------------------------
INSERT INTO activity_logs (
    id, created_at, updated_at, user_id, facility_id, log_type, action, email_attempted, resource_type, resource_id, description, status, ip_address, user_agent
)
VALUES
    (gen_random_uuid(), NOW() - INTERVAL '15 days', NOW(), '539baeff-b6a8-4b46-aed1-1206777f2155', NULL, 'AUTH', 'LOGIN_SUCCESS', 'admin@gmail.com', 'USER', '539baeff-b6a8-4b46-aed1-1206777f2155', 'Quản trị viên đăng nhập hệ thống quản lý', 'SUCCESS', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'),
    (gen_random_uuid(), NOW() - INTERVAL '14 days', NOW(), '0188dfad-0dd0-4d91-8dec-605b0f03aceb', NULL, 'BUSINESS', 'POLICY_UPDATE', 'business@gmail.com', 'POLICY', '55555555-4444-3333-2222-111111111111', 'Cập nhật chính sách chiết khấu 10% cho kỳ hạn thuê 6 tháng', 'SUCCESS', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'),
    (gen_random_uuid(), NOW() - INTERVAL '12 days', NOW(), '43695aac-1802-4a5d-82aa-2ef466796e10', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', 'FACILITY', 'UNIT_STATUS_UPDATE', 'facility@gmail.com', 'STORAGE_UNIT', 'b0000000-0000-0000-0000-000000000204', 'Chuyển trạng thái kho A-204 sang UNDER_MAINTENANCE để sửa cửa cuốn', 'SUCCESS', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'),
    (gen_random_uuid(), NOW() - INTERVAL '10 days', NOW(), '0f3386ad-0ff9-4c8f-b01b-7a8f783c7afc', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', 'HANDOVER', 'CHECK_IN_COMPLETE', 'staff@gmail.com', 'BOOKING', 'c0000000-0000-0000-0000-000000000001', 'Nhân viên quầy hoàn tất check-in bàn giao kho A-102 cho khách Trần Minh Tuấn', 'SUCCESS', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'),
    (gen_random_uuid(), NOW() - INTERVAL '8 days', NOW(), 'e0000000-0000-0000-0000-000000000007', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', 'ACCESS', 'REMOTE_UNLOCK', 'minh.tuan@gmail.com', 'STORAGE_UNIT', 'b0000000-0000-0000-0000-000000000102', 'Khách hàng kích hoạt mở khóa từ xa qua App Boxora', 'SUCCESS', '14.161.22.45', 'BoxoraMobileApp/2.4 (Android 14)'),
    (gen_random_uuid(), NOW() - INTERVAL '6 days', NOW(), 'e0000000-0000-0000-0000-000000000007', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', 'SECURITY', 'PIN_ROTATION', 'minh.tuan@gmail.com', 'BOOKING', 'c0000000-0000-0000-0000-000000000001', 'Khách hàng đổi mã PIN bảo mật mới thành công', 'SUCCESS', '14.161.22.45', 'BoxoraMobileApp/2.4 (Android 14)'),
    (gen_random_uuid(), NOW() - INTERVAL '5 days', NOW(), 'bce331ef-5656-4fa6-bb19-8528a10e9671', '45e03ded-5da1-43d5-bea7-96c645d5f96c', 'SUPPORT', 'TICKET_RESOLVE', 'staff_d7@gmail.com', 'SUPPORT_TICKET', '33330000-0000-0000-0000-000000000001', 'Xử lý hoàn tất yêu cầu cấp lại mã PIN cho khách hàng', 'SUCCESS', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'),
    (gen_random_uuid(), NOW() - INTERVAL '4 days', NOW(), '0f3386ad-0ff9-4c8f-b01b-7a8f783c7afc', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', 'OVERRIDE', 'MASTER_KEY_DISPATCH', 'staff@gmail.com', 'MASTER_KEY_OVERRIDE', '22220000-0000-0000-0000-000000000001', 'Mở khóa cưỡng chế buồng kho kiểm tra an toàn nhiệt độ PCCC', 'SUCCESS', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'),
    (gen_random_uuid(), NOW() - INTERVAL '3 days', NOW(), 'e0000000-0000-0000-0000-000000000002', '45e03ded-5da1-43d5-bea7-96c645d5f96c', 'AUDIT', 'SEALING_EXECUTE', 'manager.d7@boxora.vn', 'SEALING_RECORD', 'b0000000-0000-0000-0000-000000000211', 'Thực hiện niêm phong buồng kho B-203 do quá hạn 7 ngày theo BR-RULE-012', 'SUCCESS', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'),
    (gen_random_uuid(), NOW() - INTERVAL '2 days', NOW(), '0188dfad-0dd0-4d91-8dec-605b0f03aceb', NULL, 'FINANCE', 'REFUND_APPROVE', 'business@gmail.com', 'HANDOVER_RECORD', '11110000-0000-0000-0000-000000000007', 'Kế toán trưởng phê duyệt hoàn tiền đặt cọc 2.250.000₫ sau khấu trừ phí vệ sinh', 'SUCCESS', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'),
    (gen_random_uuid(), NOW() - INTERVAL '1 day', NOW(), 'e0000000-0000-0000-0000-000000000008', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', 'BOOKING', 'CREATE_BOOKING', 'hoangyen.le@gmail.com', 'BOOKING', 'c0000000-0000-0000-0000-000000000011', 'Khách hàng đặt trước buồng kho A-202 cơ sở Quận 1', 'SUCCESS', '118.69.182.10', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'),
    (gen_random_uuid(), NOW() - INTERVAL '12 hours', NOW(), 'e0000000-0000-0000-0000-000000000008', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', 'PAYMENT', 'VNPAY_SUCCESS', 'hoangyen.le@gmail.com', 'PAYMENT', 'f0000000-0000-0000-0000-000000000014', 'Thanh toán đặt cọc 1.250.000₫ qua cổng VNPay thành công', 'SUCCESS', '118.69.182.10', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'),
    (gen_random_uuid(), NOW() - INTERVAL '6 hours', NOW(), 'e0000000-0000-0000-0000-000000000008', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', 'CONTRACT', 'OTP_SIGN_START', 'hoangyen.le@gmail.com', 'CONTRACT', 'd0000000-0000-0000-0000-000000000011', 'Khách hàng yêu cầu mã OTP ký hợp đồng thuê kho #CTR-2026-1011', 'SUCCESS', '118.69.182.10', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'),
    (gen_random_uuid(), NOW() - INTERVAL '2 hours', NOW(), '0f3386ad-0ff9-4c8f-b01b-7a8f783c7afc', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', 'STAFF', 'DAILY_INSPECTION', 'staff@gmail.com', 'FACILITY', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', 'Nhân viên hoàn tất tuần tra an ninh tầng 1 & tầng 2 Block A', 'SUCCESS', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'),
    (gen_random_uuid(), NOW() - INTERVAL '30 minutes', NOW(), 'e0000000-0000-0000-0000-000000000011', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', 'BOOKING', 'SOFT_LOCK_ACQUIRED', 'ducthang.vu@gmail.com', 'BOOKING', 'c0000000-0000-0000-0000-000000000014', 'Khởi tạo giữ chỗ buồng kho A-101 (Soft-lock 24 giờ)', 'SUCCESS', '14.241.12.90', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)')
ON CONFLICT (id) DO NOTHING;

COMMIT;

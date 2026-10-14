-- =========================================================================
-- V14: Seed Users
-- Passwords for newly seeded users: 123456
-- BCrypt: $2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG
-- =========================================================================

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
    
    -- Additional Customers with realistic profiles
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

-- =========================================================================
-- V14: Seed Users per Facility and System Roles
-- All accounts have password: 123456
-- BCrypt: $2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG
-- =========================================================================

-- 1. Synchronize all existing users password to 123456
UPDATE users SET password = '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG';

-- 2. Update existing accounts to conform to the new naming scheme
UPDATE users SET email = 'facility1q1@gmail.com', username = 'facility1_q1', full_name = 'Nguyen Van An (FM 1 Q1)' WHERE id = '43695aac-1802-4a5d-82aa-2ef466796e10';
UPDATE users SET email = 'staff1q1@gmail.com', username = 'staff1_q1', full_name = 'Vu Thi Lan (Staff 1 Q1)' WHERE id = '0f3386ad-0ff9-4c8f-b01b-7a8f783c7afc';

UPDATE users SET email = 'facility1q7@gmail.com', username = 'facility1_q7', full_name = 'Le Hoang Nam (FM 1 Q7)' WHERE id = 'e0000000-0000-0000-0000-000000000002';
UPDATE users SET email = 'staff1q7@gmail.com', username = 'staff1_q7', full_name = 'Bui Quoc Anh (Staff 1 Q7)' WHERE id = 'bce331ef-5656-4fa6-bb19-8528a10e9671';

UPDATE users SET email = 'facility1td@gmail.com', username = 'facility1_td', full_name = 'Nguyen Thi Bich (FM 1 TD)' WHERE id = 'e0000000-0000-0000-0000-000000000003';
UPDATE users SET email = 'staff1td@gmail.com', username = 'staff1_td', full_name = 'Phan Van Hau (Staff 1 TD)' WHERE id = 'e0000000-0000-0000-0000-000000000005';

UPDATE users SET email = 'facility1tb@gmail.com', username = 'facility1_tb', full_name = 'Do Quang Huy (FM 1 TB)' WHERE id = 'e0000000-0000-0000-0000-000000000004';
UPDATE users SET email = 'staff1tb@gmail.com', username = 'staff1_tb', full_name = 'Vu Thi Ngoc (Staff 1 TB)' WHERE id = 'e0000000-0000-0000-0000-000000000006';

UPDATE users SET email = 'business2@gmail.com', username = 'business2', full_name = 'Hoang Minh Tri (BM 2)' WHERE id = 'e0000000-0000-0000-0000-000000000001';

-- 3. Insert remaining requested accounts
INSERT INTO users (id, created_at, updated_at, username, email, password, phone, full_name, is_active, role_id, facility_id)
VALUES
    -- Admin 2
    ('e0000000-0000-0000-0000-000000000099', NOW(), NOW(), 'admin2', 'admin2@gmail.com', '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG', '0371234568', 'Tran Duc Minh (Admin 2)', true, '11111111-1111-1111-1111-111111111111', NULL),
    
    -- Customer 2
    ('e0000000-0000-0000-0000-000000000098', NOW(), NOW(), 'customer2', 'customer2@gmail.com', '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG', '0373214569', 'Nguyen Gia Huy (Customer 2)', true, '55555555-5555-5555-5555-555555555555', NULL),

    -- Additional Customers with active rental contracts
    ('e0000000-0000-0000-0000-000000000007', NOW(), NOW(), 'cust_minh', 'minh.tuan@gmail.com', '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG', '0912345678', 'Tran Minh Tuan', true, '55555555-5555-5555-5555-555555555555', NULL),
    ('e0000000-0000-0000-0000-000000000008', NOW(), NOW(), 'cust_lan', 'hoangyen.le@gmail.com', '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG', '0988219002', 'Le Thi Hoang Yen', true, '55555555-5555-5555-5555-555555555555', NULL),
    ('e0000000-0000-0000-0000-000000000009', NOW(), NOW(), 'cust_hoang', 'namanh.hoang@gmail.com', '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG', '0977334455', 'Hoang Nam Anh', true, '55555555-5555-5555-5555-555555555555', NULL),
    ('e0000000-0000-0000-0000-000000000010', NOW(), NOW(), 'cust_phuong', 'maiphuong.pham@gmail.com', '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG', '0933887766', 'Pham Mai Phuong', true, '55555555-5555-5555-5555-555555555555', NULL),
    ('e0000000-0000-0000-0000-000000000011', NOW(), NOW(), 'cust_duc', 'ducthang.vu@gmail.com', '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG', '0944890123', 'Vu Duc Thang', true, '55555555-5555-5555-5555-555555555555', NULL),

    -- Facility Managers Q1 (3 FMs total)
    ('e0000000-0000-0000-0000-000000010002', NOW(), NOW(), 'facility2_q1', 'facility2q1@gmail.com', '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG', '0901111002', 'Tran Thi Binh (FM 2 Q1)', true, '22222222-2222-2222-2222-222222222222', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c'),
    ('e0000000-0000-0000-0000-000000010003', NOW(), NOW(), 'facility3_q1', 'facility3q1@gmail.com', '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG', '0901111003', 'Le Van Cuong (FM 3 Q1)', true, '22222222-2222-2222-2222-222222222222', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c'),

    -- Facility Managers Q7 (3 FMs total)
    ('e0000000-0000-0000-0000-000000070002', NOW(), NOW(), 'facility2_q7', 'facility2q7@gmail.com', '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG', '0907111002', 'Pham Thanh Hung (FM 2 Q7)', true, '22222222-2222-2222-2222-222222222222', '45e03ded-5da1-43d5-bea7-96c645d5f96c'),
    ('e0000000-0000-0000-0000-000000070003', NOW(), NOW(), 'facility3_q7', 'facility3q7@gmail.com', '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG', '0907111003', 'Vo Thi Mai (FM 3 Q7)', true, '22222222-2222-2222-2222-222222222222', '45e03ded-5da1-43d5-bea7-96c645d5f96c'),

    -- Facility Managers TD (3 FMs total)
    ('e0000000-0000-0000-0000-000000090002', NOW(), NOW(), 'facility2_td', 'facility2td@gmail.com', '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG', '0909111002', 'Dang Quoc Huy (FM 2 TD)', true, '22222222-2222-2222-2222-222222222222', 'fd8f948e-fdff-4a81-ad0f-fc45639b545d'),
    ('e0000000-0000-0000-0000-000000090003', NOW(), NOW(), 'facility3_td', 'facility3td@gmail.com', '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG', '0909111003', 'Trinh Thu Ha (FM 3 TD)', true, '22222222-2222-2222-2222-222222222222', 'fd8f948e-fdff-4a81-ad0f-fc45639b545d'),

    -- Facility Managers TB (3 FMs total)
    ('e0000000-0000-0000-0000-000000040002', NOW(), NOW(), 'facility2_tb', 'facility2tb@gmail.com', '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG', '0904111002', 'Bui Duc Minh (FM 2 TB)', true, '22222222-2222-2222-2222-222222222222', 'a1111111-2222-3333-4444-555555555555'),
    ('e0000000-0000-0000-0000-000000040003', NOW(), NOW(), 'facility3_tb', 'facility3tb@gmail.com', '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG', '0904111003', 'Hoang Thi Loan (FM 3 TB)', true, '22222222-2222-2222-2222-222222222222', 'a1111111-2222-3333-4444-555555555555'),

    -- Staff Q1 (5 Staff total)
    ('e0000000-0000-0000-0000-000000110002', NOW(), NOW(), 'staff2_q1', 'staff2q1@gmail.com', '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG', '0901222002', 'Ngo Thanh Dat (Staff 2 Q1)', true, '44444444-4444-4444-4444-444444444444', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c'),
    ('e0000000-0000-0000-0000-000000110003', NOW(), NOW(), 'staff3_q1', 'staff3q1@gmail.com', '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG', '0901222003', 'Dinh Thi Thao (Staff 3 Q1)', true, '44444444-4444-4444-4444-444444444444', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c'),
    ('e0000000-0000-0000-0000-000000110004', NOW(), NOW(), 'staff4_q1', 'staff4q1@gmail.com', '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG', '0901222004', 'Phan Hai Nam (Staff 4 Q1)', true, '44444444-4444-4444-4444-444444444444', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c'),
    ('e0000000-0000-0000-0000-000000110005', NOW(), NOW(), 'staff5_q1', 'staff5q1@gmail.com', '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG', '0901222005', 'Duong Thu Trang (Staff 5 Q1)', true, '44444444-4444-4444-4444-444444444444', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c'),

    -- Staff Q7 (5 Staff total)
    ('e0000000-0000-0000-0000-000000170002', NOW(), NOW(), 'staff2_q7', 'staff2q7@gmail.com', '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG', '0907222002', 'Lam Gia Bao (Staff 2 Q7)', true, '44444444-4444-4444-4444-444444444444', '45e03ded-5da1-43d5-bea7-96c645d5f96c'),
    ('e0000000-0000-0000-0000-000000170003', NOW(), NOW(), 'staff3_q7', 'staff3q7@gmail.com', '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG', '0907222003', 'Nguyen Kieu Oanh (Staff 3 Q7)', true, '44444444-4444-4444-4444-444444444444', '45e03ded-5da1-43d5-bea7-96c645d5f96c'),
    ('e0000000-0000-0000-0000-000000170004', NOW(), NOW(), 'staff4_q7', 'staff4q7@gmail.com', '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG', '0907222004', 'Ta Minh Duc (Staff 4 Q7)', true, '44444444-4444-4444-4444-444444444444', '45e03ded-5da1-43d5-bea7-96c645d5f96c'),
    ('e0000000-0000-0000-0000-000000170005', NOW(), NOW(), 'staff5_q7', 'staff5q7@gmail.com', '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG', '0907222005', 'Ho Bao Ngoc (Staff 5 Q7)', true, '44444444-4444-4444-4444-444444444444', '45e03ded-5da1-43d5-bea7-96c645d5f96c'),

    -- Staff TD (5 Staff total)
    ('e0000000-0000-0000-0000-000000190002', NOW(), NOW(), 'staff2_td', 'staff2td@gmail.com', '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG', '0909222002', 'Vo Thi Cam Tu (Staff 2 TD)', true, '44444444-4444-4444-4444-444444444444', 'fd8f948e-fdff-4a81-ad0f-fc45639b545d'),
    ('e0000000-0000-0000-0000-000000190003', NOW(), NOW(), 'staff3_td', 'staff3td@gmail.com', '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG', '0909222003', 'Luong Tuan Khai (Staff 3 TD)', true, '44444444-4444-4444-4444-444444444444', 'fd8f948e-fdff-4a81-ad0f-fc45639b545d'),
    ('e0000000-0000-0000-0000-000000190004', NOW(), NOW(), 'staff4_td', 'staff4td@gmail.com', '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG', '0909222004', 'Doan My Duyen (Staff 4 TD)', true, '44444444-4444-4444-4444-444444444444', 'fd8f948e-fdff-4a81-ad0f-fc45639b545d'),
    ('e0000000-0000-0000-0000-000000190005', NOW(), NOW(), 'staff5_td', 'staff5td@gmail.com', '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG', '0909222005', 'Nguyen Hoang Long (Staff 5 TD)', true, '44444444-4444-4444-4444-444444444444', 'fd8f948e-fdff-4a81-ad0f-fc45639b545d'),

    -- Staff TB (5 Staff total)
    ('e0000000-0000-0000-0000-000000140002', NOW(), NOW(), 'staff2_tb', 'staff2tb@gmail.com', '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG', '0904222002', 'Cao Thanh Tung (Staff 2 TB)', true, '44444444-4444-4444-4444-444444444444', 'a1111111-2222-3333-4444-555555555555'),
    ('e0000000-0000-0000-0000-000000140003', NOW(), NOW(), 'staff3_tb', 'staff3tb@gmail.com', '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG', '0904222003', 'Mai Phuong Thuy (Staff 3 TB)', true, '44444444-4444-4444-4444-444444444444', 'a1111111-2222-3333-4444-555555555555'),
    ('e0000000-0000-0000-0000-000000140004', NOW(), NOW(), 'staff4_tb', 'staff4tb@gmail.com', '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG', '0904222004', 'Dang Thai Son (Staff 4 TB)', true, '44444444-4444-4444-4444-444444444444', 'a1111111-2222-3333-4444-555555555555'),
    ('e0000000-0000-0000-0000-000000140005', NOW(), NOW(), 'staff5_tb', 'staff5tb@gmail.com', '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG', '0904222005', 'Le Hong Nhung (Staff 5 TB)', true, '44444444-4444-4444-4444-444444444444', 'a1111111-2222-3333-4444-555555555555')
ON CONFLICT (username) DO NOTHING;

-- 4. Update facilities primary managers
UPDATE facilities SET manager_id = '43695aac-1802-4a5d-82aa-2ef466796e10' WHERE code = 'HCM-D1';
UPDATE facilities SET manager_id = 'e0000000-0000-0000-0000-000000000002' WHERE code = 'HCM-D7';
UPDATE facilities SET manager_id = 'e0000000-0000-0000-0000-000000000003' WHERE code = 'HCM-TD';
UPDATE facilities SET manager_id = 'e0000000-0000-0000-0000-000000000004' WHERE code = 'HCM-TB';

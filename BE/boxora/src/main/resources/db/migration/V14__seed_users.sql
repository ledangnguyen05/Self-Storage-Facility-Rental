
-- =========================================================================

-- Password for all demo accounts: 123456
-- BCrypt hash for 123456
-- =========================================================================

-- 1. Seed 1 ADMIN, 2 BUSINESS_MANAGER, 4 FACILITY_MANAGER,
--    12 STAFF and 10 CUSTOMER accounts.

INSERT INTO users (
    id,
    created_at,
    updated_at,
    username,
    email,
    password,
    phone,
    full_name,
    is_active,
    role_id,
    facility_id
)
VALUES
    -- =========================================================
    -- SYSTEM ADMINISTRATOR: 1 account
    -- =========================================================
    (
        'e0000000-0000-0000-0000-000000000090',
        NOW(), NOW(),
        'admin1',
        'admin1@gmail.com',
        '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG',
        '0371234567',
        'Tran Duc Minh (Admin)',
        TRUE,
        '11111111-1111-1111-1111-111111111111',
        NULL
    ),

    -- =========================================================
    -- BUSINESS OPERATIONS MANAGERS: 2 accounts
    -- =========================================================
    (
        'e0000000-0000-0000-0000-000000000091',
        NOW(), NOW(),
        'business1',
        'business1@gmail.com',
        '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG',
        '0371234569',
        'Nguyen Hoang Long (Business Manager 1)',
        TRUE,
        '33333333-3333-3333-3333-333333333333',
        NULL
    ),
    (
        'e0000000-0000-0000-0000-000000000001',
        NOW(), NOW(),
        'business2',
        'business2@gmail.com',
        '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG',
        '0371234570',
        'Hoang Minh Tri (Business Manager 2)',
        TRUE,
        '33333333-3333-3333-3333-333333333333',
        NULL
    ),

    -- =========================================================
    -- FACILITY MANAGERS: 1 per facility (4 accounts)
    -- =========================================================
    (
        '43695aac-1802-4a5d-82aa-2ef466796e10',
        NOW(), NOW(),
        'facility1_q1',
        'facility1q1@gmail.com',
        '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG',
        '0901111001',
        'Nguyen Van An (FM Q1)',
        TRUE,
        '22222222-2222-2222-2222-222222222222',
        'f7af2794-0d0d-4c68-9e36-c44bf3034f6c'
    ),
    (
        'e0000000-0000-0000-0000-000000000002',
        NOW(), NOW(),
        'facility1_q7',
        'facility1q7@gmail.com',
        '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG',
        '0907111001',
        'Le Hoang Nam (FM Q7)',
        TRUE,
        '22222222-2222-2222-2222-222222222222',
        '45e03ded-5da1-43d5-bea7-96c645d5f96c'
    ),
    (
        'e0000000-0000-0000-0000-000000000003',
        NOW(), NOW(),
        'facility1_td',
        'facility1td@gmail.com',
        '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG',
        '0909111001',
        'Nguyen Thi Bich (FM Thu Duc)',
        TRUE,
        '22222222-2222-2222-2222-222222222222',
        'fd8f948e-fdff-4a81-ad0f-fc45639b545d'
    ),
    (
        'e0000000-0000-0000-0000-000000000004',
        NOW(), NOW(),
        'facility1_tb',
        'facility1tb@gmail.com',
        '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG',
        '0904111001',
        'Do Quang Huy (FM Tan Binh)',
        TRUE,
        '22222222-2222-2222-2222-222222222222',
        'a1111111-2222-3333-4444-555555555555'
    ),

    -- =========================================================
    -- FACILITY STAFF: 3 per facility (12 accounts)
    -- =========================================================

    -- HCM-D1
    (
        '0f3386ad-0ff9-4c8f-b01b-7a8f783c7afc',
        NOW(), NOW(),
        'staff1_q1',
        'staff1q1@gmail.com',
        '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG',
        '0901222001',
        'Vu Thi Lan (Staff Q1 1)',
        TRUE,
        '44444444-4444-4444-4444-444444444444',
        'f7af2794-0d0d-4c68-9e36-c44bf3034f6c'
    ),
    (
        'e0000000-0000-0000-0000-000000110002',
        NOW(), NOW(),
        'staff2_q1',
        'staff2q1@gmail.com',
        '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG',
        '0901222002',
        'Ngo Thanh Dat (Staff Q1 2)',
        TRUE,
        '44444444-4444-4444-4444-444444444444',
        'f7af2794-0d0d-4c68-9e36-c44bf3034f6c'
    ),
    (
        'e0000000-0000-0000-0000-000000110003',
        NOW(), NOW(),
        'staff3_q1',
        'staff3q1@gmail.com',
        '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG',
        '0901222003',
        'Dinh Thi Thao (Staff Q1 3)',
        TRUE,
        '44444444-4444-4444-4444-444444444444',
        'f7af2794-0d0d-4c68-9e36-c44bf3034f6c'
    ),

    -- HCM-D7
    (
        'bce331ef-5656-4fa6-bb19-8528a10e9671',
        NOW(), NOW(),
        'staff1_q7',
        'staff1q7@gmail.com',
        '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG',
        '0907222001',
        'Bui Quoc Anh (Staff Q7 1)',
        TRUE,
        '44444444-4444-4444-4444-444444444444',
        '45e03ded-5da1-43d5-bea7-96c645d5f96c'
    ),
    (
        'e0000000-0000-0000-0000-000000170002',
        NOW(), NOW(),
        'staff2_q7',
        'staff2q7@gmail.com',
        '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG',
        '0907222002',
        'Lam Gia Bao (Staff Q7 2)',
        TRUE,
        '44444444-4444-4444-4444-444444444444',
        '45e03ded-5da1-43d5-bea7-96c645d5f96c'
    ),
    (
        'e0000000-0000-0000-0000-000000170003',
        NOW(), NOW(),
        'staff3_q7',
        'staff3q7@gmail.com',
        '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG',
        '0907222003',
        'Nguyen Kieu Oanh (Staff Q7 3)',
        TRUE,
        '44444444-4444-4444-4444-444444444444',
        '45e03ded-5da1-43d5-bea7-96c645d5f96c'
    ),

    -- HCM-TD
    (
        'e0000000-0000-0000-0000-000000000005',
        NOW(), NOW(),
        'staff1_td',
        'staff1td@gmail.com',
        '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG',
        '0909222001',
        'Phan Van Hau (Staff Thu Duc 1)',
        TRUE,
        '44444444-4444-4444-4444-444444444444',
        'fd8f948e-fdff-4a81-ad0f-fc45639b545d'
    ),
    (
        'e0000000-0000-0000-0000-000000190002',
        NOW(), NOW(),
        'staff2_td',
        'staff2td@gmail.com',
        '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG',
        '0909222002',
        'Vo Thi Cam Tu (Staff Thu Duc 2)',
        TRUE,
        '44444444-4444-4444-4444-444444444444',
        'fd8f948e-fdff-4a81-ad0f-fc45639b545d'
    ),
    (
        'e0000000-0000-0000-0000-000000190003',
        NOW(), NOW(),
        'staff3_td',
        'staff3td@gmail.com',
        '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG',
        '0909222003',
        'Luong Tuan Khai (Staff Thu Duc 3)',
        TRUE,
        '44444444-4444-4444-4444-444444444444',
        'fd8f948e-fdff-4a81-ad0f-fc45639b545d'
    ),

    -- HCM-TB
    (
        'e0000000-0000-0000-0000-000000000006',
        NOW(), NOW(),
        'staff1_tb',
        'staff1tb@gmail.com',
        '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG',
        '0904222001',
        'Vu Thi Ngoc (Staff Tan Binh 1)',
        TRUE,
        '44444444-4444-4444-4444-444444444444',
        'a1111111-2222-3333-4444-555555555555'
    ),
    (
        'e0000000-0000-0000-0000-000000140002',
        NOW(), NOW(),
        'staff2_tb',
        'staff2tb@gmail.com',
        '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG',
        '0904222002',
        'Cao Thanh Tung (Staff Tan Binh 2)',
        TRUE,
        '44444444-4444-4444-4444-444444444444',
        'a1111111-2222-3333-4444-555555555555'
    ),
    (
        'e0000000-0000-0000-0000-000000140003',
        NOW(), NOW(),
        'staff3_tb',
        'staff3tb@gmail.com',
        '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG',
        '0904222003',
        'Mai Phuong Thuy (Staff Tan Binh 3)',
        TRUE,
        '44444444-4444-4444-4444-444444444444',
        'a1111111-2222-3333-4444-555555555555'
    ),

    -- =========================================================
    -- STORAGE CUSTOMERS: 10 accounts
    -- =========================================================
    (
        'e0000000-0000-0000-0000-000000000007',
        NOW(), NOW(),
        'cust_minh',
        'minh.tuan@gmail.com',
        '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG',
        '0912345678',
        'Tran Minh Tuan',
        TRUE,
        '55555555-5555-5555-5555-555555555555',
        NULL
    ),
    (
        'e0000000-0000-0000-0000-000000000008',
        NOW(), NOW(),
        'cust_lan',
        'hoangyen.le@gmail.com',
        '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG',
        '0988219002',
        'Le Thi Hoang Yen',
        TRUE,
        '55555555-5555-5555-5555-555555555555',
        NULL
    ),
    (
        'e0000000-0000-0000-0000-000000000009',
        NOW(), NOW(),
        'cust_hoang',
        'namanh.hoang@gmail.com',
        '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG',
        '0977334455',
        'Hoang Nam Anh',
        TRUE,
        '55555555-5555-5555-5555-555555555555',
        NULL
    ),
    (
        'e0000000-0000-0000-0000-000000000010',
        NOW(), NOW(),
        'cust_phuong',
        'maiphuong.pham@gmail.com',
        '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG',
        '0933887766',
        'Pham Mai Phuong',
        TRUE,
        '55555555-5555-5555-5555-555555555555',
        NULL
    ),
    (
        'e0000000-0000-0000-0000-000000000011',
        NOW(), NOW(),
        'cust_duc',
        'ducthang.vu@gmail.com',
        '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG',
        '0944890123',
        'Vu Duc Thang',
        TRUE,
        '55555555-5555-5555-5555-555555555555',
        NULL
    ),
    (
        'e0000000-0000-0000-0000-000000000012',
        NOW(), NOW(),
        'customer6',
        'customer6@gmail.com',
        '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG',
        '0912000012',
        'Nguyen Thanh Binh',
        TRUE,
        '55555555-5555-5555-5555-555555555555',
        NULL
    ),
    (
        'e0000000-0000-0000-0000-000000000013',
        NOW(), NOW(),
        'customer7',
        'customer7@gmail.com',
        '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG',
        '0912000013',
        'Le Minh Chau',
        TRUE,
        '55555555-5555-5555-5555-555555555555',
        NULL
    ),
    (
        'e0000000-0000-0000-0000-000000000014',
        NOW(), NOW(),
        'customer8',
        'customer8@gmail.com',
        '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG',
        '0912000014',
        'Pham Quoc Bao',
        TRUE,
        '55555555-5555-5555-5555-555555555555',
        NULL
    ),
    (
        'e0000000-0000-0000-0000-000000000015',
        NOW(), NOW(),
        'customer9',
        'customer9@gmail.com',
        '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG',
        '0912000015',
        'Vo Ngoc Han',
        TRUE,
        '55555555-5555-5555-5555-555555555555',
        NULL
    ),
    (
        'e0000000-0000-0000-0000-000000000098',
        NOW(), NOW(),
        'customer10',
        'customer10@gmail.com',
        '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG',
        '0373214569',
        'Nguyen Gia Huy',
        TRUE,
        '55555555-5555-5555-5555-555555555555',
        NULL
    )
ON CONFLICT (id) DO NOTHING;

-- =============================================================
-- 2. Assign each facility's primary manager
-- =============================================================
UPDATE facilities
SET manager_id = '43695aac-1802-4a5d-82aa-2ef466796e10'
WHERE code = 'HCM-D1';

UPDATE facilities
SET manager_id = 'e0000000-0000-0000-0000-000000000002'
WHERE code = 'HCM-D7';

UPDATE facilities
SET manager_id = 'e0000000-0000-0000-0000-000000000003'
WHERE code = 'HCM-TD';

UPDATE facilities
SET manager_id = 'e0000000-0000-0000-0000-000000000004'
WHERE code = 'HCM-TB';

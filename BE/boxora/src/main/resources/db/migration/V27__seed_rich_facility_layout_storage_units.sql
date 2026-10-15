-- =========================================================================
-- V27: Seed Rich Distinct Facility Layouts & Storage Units
-- =========================================================================

-- 1. Standardize existing 36 storage units with facility-prefixed codes
-- District 1 (HCM-D1: f7af2794-0d0d-4c68-9e36-c44bf3034f6c)
UPDATE storage_units SET unit_code = 'D1-A101', floor_level = 'Tầng 1' WHERE id = 'b0000000-0000-0000-0000-000000000101';
UPDATE storage_units SET unit_code = 'D1-A102', floor_level = 'Tầng 1' WHERE id = 'b0000000-0000-0000-0000-000000000102';
UPDATE storage_units SET unit_code = 'D1-A103', floor_level = 'Tầng 1' WHERE id = 'b0000000-0000-0000-0000-000000000103';
UPDATE storage_units SET unit_code = 'D1-A104', floor_level = 'Tầng 1' WHERE id = 'b0000000-0000-0000-0000-000000000104';
UPDATE storage_units SET unit_code = 'D1-C201', floor_level = 'Tầng 2' WHERE id = 'b0000000-0000-0000-0000-000000000201';
UPDATE storage_units SET unit_code = 'D1-C202', floor_level = 'Tầng 2' WHERE id = 'b0000000-0000-0000-0000-000000000202';
UPDATE storage_units SET unit_code = 'D1-C203', floor_level = 'Tầng 2' WHERE id = 'b0000000-0000-0000-0000-000000000203';
UPDATE storage_units SET unit_code = 'D1-C204', floor_level = 'Tầng 2' WHERE id = 'b0000000-0000-0000-0000-000000000204';
UPDATE storage_units SET unit_code = 'D1-B101', floor_level = 'Tầng 1' WHERE id = 'b0000000-0000-0000-0000-000000000301';

-- District 7 (HCM-D7: 45e03ded-5da1-43d5-bea7-96c645d5f96c)
UPDATE storage_units SET unit_code = 'D7-A101', floor_level = 'Tầng 1' WHERE id = 'b0000000-0000-0000-0000-000000000205';
UPDATE storage_units SET unit_code = 'D7-A102', floor_level = 'Tầng 1' WHERE id = 'b0000000-0000-0000-0000-000000000206';
UPDATE storage_units SET unit_code = 'D7-A103', floor_level = 'Tầng 1' WHERE id = 'b0000000-0000-0000-0000-000000000207';
UPDATE storage_units SET unit_code = 'D7-A104', floor_level = 'Tầng 1' WHERE id = 'b0000000-0000-0000-0000-000000000208';
UPDATE storage_units SET unit_code = 'D7-C201', floor_level = 'Tầng 2' WHERE id = 'b0000000-0000-0000-0000-000000000209';
UPDATE storage_units SET unit_code = 'D7-C202', floor_level = 'Tầng 2' WHERE id = 'b0000000-0000-0000-0000-000000000210';
UPDATE storage_units SET unit_code = 'D7-C203', floor_level = 'Tầng 2' WHERE id = 'b0000000-0000-0000-0000-000000000211';
UPDATE storage_units SET unit_code = 'D7-C204', floor_level = 'Tầng 2' WHERE id = 'b0000000-0000-0000-0000-000000000212';
UPDATE storage_units SET unit_code = 'D7-B101', floor_level = 'Tầng 1' WHERE id = 'b0000000-0000-0000-0000-000000000302';

-- Thu Duc (HCM-TD: fd8f948e-fdff-4a81-ad0f-fc45639b545d)
UPDATE storage_units SET unit_code = 'TD-A101', floor_level = 'Tầng 1' WHERE id = 'b0000000-0000-0000-0000-000000000303';
UPDATE storage_units SET unit_code = 'TD-A102', floor_level = 'Tầng 1' WHERE id = 'b0000000-0000-0000-0000-000000000304';
UPDATE storage_units SET unit_code = 'TD-A103', floor_level = 'Tầng 1' WHERE id = 'b0000000-0000-0000-0000-000000000305';
UPDATE storage_units SET unit_code = 'TD-A104', floor_level = 'Tầng 1' WHERE id = 'b0000000-0000-0000-0000-000000000306';
UPDATE storage_units SET unit_code = 'TD-C201', floor_level = 'Tầng 2' WHERE id = 'b0000000-0000-0000-0000-000000000307';
UPDATE storage_units SET unit_code = 'TD-C202', floor_level = 'Tầng 2' WHERE id = 'b0000000-0000-0000-0000-000000000308';
UPDATE storage_units SET unit_code = 'TD-C203', floor_level = 'Tầng 2' WHERE id = 'b0000000-0000-0000-0000-000000000309';
UPDATE storage_units SET unit_code = 'TD-C204', floor_level = 'Tầng 2' WHERE id = 'b0000000-0000-0000-0000-000000000310';
UPDATE storage_units SET unit_code = 'TD-B101', floor_level = 'Tầng 1' WHERE id = 'b0000000-0000-0000-0000-000000000311';

-- Tan Binh Mega Hub (HCM-TB: a1111111-2222-3333-4444-555555555555)
UPDATE storage_units SET unit_code = 'TB-A101', floor_level = 'Tầng 1' WHERE id = 'b0000000-0000-0000-0000-000000000401';
UPDATE storage_units SET unit_code = 'TB-A102', floor_level = 'Tầng 1' WHERE id = 'b0000000-0000-0000-0000-000000000402';
UPDATE storage_units SET unit_code = 'TB-A103', floor_level = 'Tầng 1' WHERE id = 'b0000000-0000-0000-0000-000000000403';
UPDATE storage_units SET unit_code = 'TB-A104', floor_level = 'Tầng 1' WHERE id = 'b0000000-0000-0000-0000-000000000404';
UPDATE storage_units SET unit_code = 'TB-C201', floor_level = 'Tầng 2' WHERE id = 'b0000000-0000-0000-0000-000000000405';
UPDATE storage_units SET unit_code = 'TB-C202', floor_level = 'Tầng 2' WHERE id = 'b0000000-0000-0000-0000-000000000406';
UPDATE storage_units SET unit_code = 'TB-C203', floor_level = 'Tầng 2' WHERE id = 'b0000000-0000-0000-0000-000000000407';
UPDATE storage_units SET unit_code = 'TB-C204', floor_level = 'Tầng 2' WHERE id = 'b0000000-0000-0000-0000-000000000408';
UPDATE storage_units SET unit_code = 'TB-B101', floor_level = 'Tầng 1' WHERE id = 'b0000000-0000-0000-0000-000000000409';


-- 2. Insert Additional Distinct Storage Units for each Facility

-- A. TAN BINH MEGA HUB (Airport Logistics Center - 36 Units Total)
-- Unit Types:
-- 10000000-0000-0000-0000-000000000001: Small 1m2 (450,000)
-- 10000000-0000-0000-0000-000000000002: Medium 3m2 (1,250,000)
-- 10000000-0000-0000-0000-000000000003: Large 6m2 (2,400,000)
-- 10000000-0000-0000-0000-000000000004: Commercial 12m2 (4,800,000)

INSERT INTO storage_units (id, created_at, updated_at, unit_code, floor_level, status, facility_id, unit_type_id, price_per_month)
VALUES
    -- Tan Binh Zone A (Tầng 1 - Tiếp vận Container & Cửa cuốn điện tử): TB-A105 to TB-A112
    (gen_random_uuid(), NOW(), NOW(), 'TB-A105', 'Tầng 1', 'AVAILABLE', 'a1111111-2222-3333-4444-555555555555', '10000000-0000-0000-0000-000000000003', 2400000.00),
    (gen_random_uuid(), NOW(), NOW(), 'TB-A106', 'Tầng 1', 'OCCUPIED',  'a1111111-2222-3333-4444-555555555555', '10000000-0000-0000-0000-000000000003', 2400000.00),
    (gen_random_uuid(), NOW(), NOW(), 'TB-A107', 'Tầng 1', 'AVAILABLE', 'a1111111-2222-3333-4444-555555555555', '10000000-0000-0000-0000-000000000004', 4800000.00),
    (gen_random_uuid(), NOW(), NOW(), 'TB-A108', 'Tầng 1', 'AVAILABLE', 'a1111111-2222-3333-4444-555555555555', '10000000-0000-0000-0000-000000000002', 1250000.00),
    (gen_random_uuid(), NOW(), NOW(), 'TB-A109', 'Tầng 1', 'OCCUPIED',  'a1111111-2222-3333-4444-555555555555', '10000000-0000-0000-0000-000000000003', 2400000.00),
    (gen_random_uuid(), NOW(), NOW(), 'TB-A110', 'Tầng 1', 'AVAILABLE', 'a1111111-2222-3333-4444-555555555555', '10000000-0000-0000-0000-000000000004', 4800000.00),
    (gen_random_uuid(), NOW(), NOW(), 'TB-A111', 'Tầng 1', 'RESERVED',   'a1111111-2222-3333-4444-555555555555', '10000000-0000-0000-0000-000000000002', 1250000.00),
    (gen_random_uuid(), NOW(), NOW(), 'TB-A112', 'Tầng 1', 'AVAILABLE', 'a1111111-2222-3333-4444-555555555555', '10000000-0000-0000-0000-000000000004', 4800000.00),

    -- Tan Binh Zone B (Tầng 1 - Pallet tải nặng & Trần cao 4.2m): TB-B102 to TB-B112
    (gen_random_uuid(), NOW(), NOW(), 'TB-B102', 'Tầng 1', 'AVAILABLE', 'a1111111-2222-3333-4444-555555555555', '10000000-0000-0000-0000-000000000003', 2400000.00),
    (gen_random_uuid(), NOW(), NOW(), 'TB-B103', 'Tầng 1', 'OCCUPIED',  'a1111111-2222-3333-4444-555555555555', '10000000-0000-0000-0000-000000000004', 4800000.00),
    (gen_random_uuid(), NOW(), NOW(), 'TB-B104', 'Tầng 1', 'AVAILABLE', 'a1111111-2222-3333-4444-555555555555', '10000000-0000-0000-0000-000000000003', 2400000.00),
    (gen_random_uuid(), NOW(), NOW(), 'TB-B105', 'Tầng 1', 'AVAILABLE', 'a1111111-2222-3333-4444-555555555555', '10000000-0000-0000-0000-000000000004', 4800000.00),
    (gen_random_uuid(), NOW(), NOW(), 'TB-B106', 'Tầng 1', 'OCCUPIED',  'a1111111-2222-3333-4444-555555555555', '10000000-0000-0000-0000-000000000004', 4800000.00),
    (gen_random_uuid(), NOW(), NOW(), 'TB-B107', 'Tầng 1', 'AVAILABLE', 'a1111111-2222-3333-4444-555555555555', '10000000-0000-0000-0000-000000000003', 2400000.00),
    (gen_random_uuid(), NOW(), NOW(), 'TB-B108', 'Tầng 1', 'UNDER_MAINTENANCE', 'a1111111-2222-3333-4444-555555555555', '10000000-0000-0000-0000-000000000003', 2400000.00),
    (gen_random_uuid(), NOW(), NOW(), 'TB-B109', 'Tầng 1', 'OCCUPIED',  'a1111111-2222-3333-4444-555555555555', '10000000-0000-0000-0000-000000000004', 4800000.00),
    (gen_random_uuid(), NOW(), NOW(), 'TB-B110', 'Tầng 1', 'AVAILABLE', 'a1111111-2222-3333-4444-555555555555', '10000000-0000-0000-0000-000000000004', 4800000.00),
    (gen_random_uuid(), NOW(), NOW(), 'TB-B111', 'Tầng 1', 'AVAILABLE', 'a1111111-2222-3333-4444-555555555555', '10000000-0000-0000-0000-000000000003', 2400000.00),
    (gen_random_uuid(), NOW(), NOW(), 'TB-B112', 'Tầng 1', 'AVAILABLE', 'a1111111-2222-3333-4444-555555555555', '10000000-0000-0000-0000-000000000004', 4800000.00),

    -- Tan Binh Zone C (Tầng 2 - Climate Controlled Vi Khí Hậu 18-22°C): TB-C205 to TB-C212
    (gen_random_uuid(), NOW(), NOW(), 'TB-C205', 'Tầng 2', 'AVAILABLE', 'a1111111-2222-3333-4444-555555555555', '10000000-0000-0000-0000-000000000002', 1250000.00),
    (gen_random_uuid(), NOW(), NOW(), 'TB-C206', 'Tầng 2', 'OCCUPIED',  'a1111111-2222-3333-4444-555555555555', '10000000-0000-0000-0000-000000000003', 2400000.00),
    (gen_random_uuid(), NOW(), NOW(), 'TB-C207', 'Tầng 2', 'AVAILABLE', 'a1111111-2222-3333-4444-555555555555', '10000000-0000-0000-0000-000000000003', 2400000.00),
    (gen_random_uuid(), NOW(), NOW(), 'TB-C208', 'Tầng 2', 'OCCUPIED',  'a1111111-2222-3333-4444-555555555555', '10000000-0000-0000-0000-000000000004', 4800000.00),
    (gen_random_uuid(), NOW(), NOW(), 'TB-C209', 'Tầng 2', 'AVAILABLE', 'a1111111-2222-3333-4444-555555555555', '10000000-0000-0000-0000-000000000002', 1250000.00),
    (gen_random_uuid(), NOW(), NOW(), 'TB-C210', 'Tầng 2', 'RESERVED',   'a1111111-2222-3333-4444-555555555555', '10000000-0000-0000-0000-000000000003', 2400000.00),
    (gen_random_uuid(), NOW(), NOW(), 'TB-C211', 'Tầng 2', 'AVAILABLE', 'a1111111-2222-3333-4444-555555555555', '10000000-0000-0000-0000-000000000002', 1250000.00),
    (gen_random_uuid(), NOW(), NOW(), 'TB-C212', 'Tầng 2', 'AVAILABLE', 'a1111111-2222-3333-4444-555555555555', '10000000-0000-0000-0000-000000000003', 2400000.00)
ON CONFLICT (id) DO NOTHING;


-- B. DISTRICT 1 (Boutique Luxury Central Hub - 30 Units Total)
-- f7af2794-0d0d-4c68-9e36-c44bf3034f6c
INSERT INTO storage_units (id, created_at, updated_at, unit_code, floor_level, status, facility_id, unit_type_id, price_per_month)
VALUES
    -- D1 Zone A (Tầng 1 - Smart Personal Lockers): D1-A105 to D1-A110
    (gen_random_uuid(), NOW(), NOW(), 'D1-A105', 'Tầng 1', 'AVAILABLE', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', '10000000-0000-0000-0000-000000000001', 450000.00),
    (gen_random_uuid(), NOW(), NOW(), 'D1-A106', 'Tầng 1', 'OCCUPIED',  'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', '10000000-0000-0000-0000-000000000001', 450000.00),
    (gen_random_uuid(), NOW(), NOW(), 'D1-A107', 'Tầng 1', 'AVAILABLE', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', '10000000-0000-0000-0000-000000000001', 450000.00),
    (gen_random_uuid(), NOW(), NOW(), 'D1-A108', 'Tầng 1', 'AVAILABLE', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', '10000000-0000-0000-0000-000000000001', 450000.00),
    (gen_random_uuid(), NOW(), NOW(), 'D1-A109', 'Tầng 1', 'OCCUPIED',  'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', '10000000-0000-0000-0000-000000000001', 450000.00),
    (gen_random_uuid(), NOW(), NOW(), 'D1-A110', 'Tầng 1', 'AVAILABLE', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', '10000000-0000-0000-0000-000000000001', 450000.00),

    -- D1 Zone B (Tầng 1 - Boutique Fashion Suites): D1-B102 to D1-B110
    (gen_random_uuid(), NOW(), NOW(), 'D1-B102', 'Tầng 1', 'AVAILABLE', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', '10000000-0000-0000-0000-000000000002', 1250000.00),
    (gen_random_uuid(), NOW(), NOW(), 'D1-B103', 'Tầng 1', 'OCCUPIED',  'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', '10000000-0000-0000-0000-000000000002', 1250000.00),
    (gen_random_uuid(), NOW(), NOW(), 'D1-B104', 'Tầng 1', 'AVAILABLE', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', '10000000-0000-0000-0000-000000000002', 1250000.00),
    (gen_random_uuid(), NOW(), NOW(), 'D1-B105', 'Tầng 1', 'AVAILABLE', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', '10000000-0000-0000-0000-000000000002', 1250000.00),
    (gen_random_uuid(), NOW(), NOW(), 'D1-B106', 'Tầng 1', 'OCCUPIED',  'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', '10000000-0000-0000-0000-000000000003', 2400000.00),
    (gen_random_uuid(), NOW(), NOW(), 'D1-B107', 'Tầng 1', 'AVAILABLE', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', '10000000-0000-0000-0000-000000000002', 1250000.00),
    (gen_random_uuid(), NOW(), NOW(), 'D1-B108', 'Tầng 1', 'UNDER_MAINTENANCE', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', '10000000-0000-0000-0000-000000000002', 1250000.00),
    (gen_random_uuid(), NOW(), NOW(), 'D1-B109', 'Tầng 1', 'AVAILABLE', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', '10000000-0000-0000-0000-000000000003', 2400000.00),
    (gen_random_uuid(), NOW(), NOW(), 'D1-B110', 'Tầng 1', 'AVAILABLE', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', '10000000-0000-0000-0000-000000000003', 2400000.00),

    -- D1 Zone C (Tầng 2 - Luxury Wine & Art Vault 18°C): D1-C205 to D1-C210
    (gen_random_uuid(), NOW(), NOW(), 'D1-C205', 'Tầng 2', 'AVAILABLE', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', '10000000-0000-0000-0000-000000000003', 2400000.00),
    (gen_random_uuid(), NOW(), NOW(), 'D1-C206', 'Tầng 2', 'OCCUPIED',  'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', '10000000-0000-0000-0000-000000000003', 2400000.00),
    (gen_random_uuid(), NOW(), NOW(), 'D1-C207', 'Tầng 2', 'AVAILABLE', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', '10000000-0000-0000-0000-000000000004', 4800000.00),
    (gen_random_uuid(), NOW(), NOW(), 'D1-C208', 'Tầng 2', 'AVAILABLE', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', '10000000-0000-0000-0000-000000000003', 2400000.00),
    (gen_random_uuid(), NOW(), NOW(), 'D1-C209', 'Tầng 2', 'OCCUPIED',  'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', '10000000-0000-0000-0000-000000000004', 4800000.00),
    (gen_random_uuid(), NOW(), NOW(), 'D1-C210', 'Tầng 2', 'AVAILABLE', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', '10000000-0000-0000-0000-000000000004', 4800000.00)
ON CONFLICT (id) DO NOTHING;


-- C. DISTRICT 7 (Residential Family Hub - 32 Units Total)
-- 45e03ded-5da1-43d5-bea7-96c645d5f96c
INSERT INTO storage_units (id, created_at, updated_at, unit_code, floor_level, status, facility_id, unit_type_id, price_per_month)
VALUES
    -- D7 Zone A (Tầng 1 - Kho Nội Thất & Đồ Gỗ Lớn Family Extra): D7-A105 to D7-A110
    (gen_random_uuid(), NOW(), NOW(), 'D7-A105', 'Tầng 1', 'AVAILABLE', '45e03ded-5da1-43d5-bea7-96c645d5f96c', '10000000-0000-0000-0000-000000000003', 2400000.00),
    (gen_random_uuid(), NOW(), NOW(), 'D7-A106', 'Tầng 1', 'OCCUPIED',  '45e03ded-5da1-43d5-bea7-96c645d5f96c', '10000000-0000-0000-0000-000000000004', 4800000.00),
    (gen_random_uuid(), NOW(), NOW(), 'D7-A107', 'Tầng 1', 'AVAILABLE', '45e03ded-5da1-43d5-bea7-96c645d5f96c', '10000000-0000-0000-0000-000000000003', 2400000.00),
    (gen_random_uuid(), NOW(), NOW(), 'D7-A108', 'Tầng 1', 'AVAILABLE', '45e03ded-5da1-43d5-bea7-96c645d5f96c', '10000000-0000-0000-0000-000000000004', 4800000.00),
    (gen_random_uuid(), NOW(), NOW(), 'D7-A109', 'Tầng 1', 'OCCUPIED',  '45e03ded-5da1-43d5-bea7-96c645d5f96c', '10000000-0000-0000-0000-000000000004', 4800000.00),
    (gen_random_uuid(), NOW(), NOW(), 'D7-A110', 'Tầng 1', 'AVAILABLE', '45e03ded-5da1-43d5-bea7-96c645d5f96c', '10000000-0000-0000-0000-000000000003', 2400000.00),

    -- D7 Zone B (Tầng 1 - Kho Chuyển Nhà & Thiết Bị Gia Dụng): D7-B102 to D7-B110
    (gen_random_uuid(), NOW(), NOW(), 'D7-B102', 'Tầng 1', 'AVAILABLE', '45e03ded-5da1-43d5-bea7-96c645d5f96c', '10000000-0000-0000-0000-000000000002', 1250000.00),
    (gen_random_uuid(), NOW(), NOW(), 'D7-B103', 'Tầng 1', 'OCCUPIED',  '45e03ded-5da1-43d5-bea7-96c645d5f96c', '10000000-0000-0000-0000-000000000003', 2400000.00),
    (gen_random_uuid(), NOW(), NOW(), 'D7-B104', 'Tầng 1', 'AVAILABLE', '45e03ded-5da1-43d5-bea7-96c645d5f96c', '10000000-0000-0000-0000-000000000002', 1250000.00),
    (gen_random_uuid(), NOW(), NOW(), 'D7-B105', 'Tầng 1', 'AVAILABLE', '45e03ded-5da1-43d5-bea7-96c645d5f96c', '10000000-0000-0000-0000-000000000003', 2400000.00),
    (gen_random_uuid(), NOW(), NOW(), 'D7-B106', 'Tầng 1', 'OCCUPIED',  '45e03ded-5da1-43d5-bea7-96c645d5f96c', '10000000-0000-0000-0000-000000000002', 1250000.00),
    (gen_random_uuid(), NOW(), NOW(), 'D7-B107', 'Tầng 1', 'AVAILABLE', '45e03ded-5da1-43d5-bea7-96c645d5f96c', '10000000-0000-0000-0000-000000000003', 2400000.00),
    (gen_random_uuid(), NOW(), NOW(), 'D7-B108', 'Tầng 1', 'UNDER_MAINTENANCE', '45e03ded-5da1-43d5-bea7-96c645d5f96c', '10000000-0000-0000-0000-000000000002', 1250000.00),
    (gen_random_uuid(), NOW(), NOW(), 'D7-B109', 'Tầng 1', 'AVAILABLE', '45e03ded-5da1-43d5-bea7-96c645d5f96c', '10000000-0000-0000-0000-000000000003', 2400000.00),
    (gen_random_uuid(), NOW(), NOW(), 'D7-B110', 'Tầng 1', 'AVAILABLE', '45e03ded-5da1-43d5-bea7-96c645d5f96c', '10000000-0000-0000-0000-000000000002', 1250000.00),

    -- D7 Zone C (Tầng 2 - Căn Hộ Condo Mini & Đồ Theo Mùa): D7-C205 to D7-C212
    (gen_random_uuid(), NOW(), NOW(), 'D7-C205', 'Tầng 2', 'AVAILABLE', '45e03ded-5da1-43d5-bea7-96c645d5f96c', '10000000-0000-0000-0000-000000000001', 450000.00),
    (gen_random_uuid(), NOW(), NOW(), 'D7-C206', 'Tầng 2', 'OCCUPIED',  '45e03ded-5da1-43d5-bea7-96c645d5f96c', '10000000-0000-0000-0000-000000000002', 1250000.00),
    (gen_random_uuid(), NOW(), NOW(), 'D7-C207', 'Tầng 2', 'AVAILABLE', '45e03ded-5da1-43d5-bea7-96c645d5f96c', '10000000-0000-0000-0000-000000000001', 450000.00),
    (gen_random_uuid(), NOW(), NOW(), 'D7-C208', 'Tầng 2', 'AVAILABLE', '45e03ded-5da1-43d5-bea7-96c645d5f96c', '10000000-0000-0000-0000-000000000002', 1250000.00),
    (gen_random_uuid(), NOW(), NOW(), 'D7-C209', 'Tầng 2', 'OCCUPIED',  '45e03ded-5da1-43d5-bea7-96c645d5f96c', '10000000-0000-0000-0000-000000000003', 2400000.00),
    (gen_random_uuid(), NOW(), NOW(), 'D7-C210', 'Tầng 2', 'AVAILABLE', '45e03ded-5da1-43d5-bea7-96c645d5f96c', '10000000-0000-0000-0000-000000000002', 1250000.00),
    (gen_random_uuid(), NOW(), NOW(), 'D7-C211', 'Tầng 2', 'AVAILABLE', '45e03ded-5da1-43d5-bea7-96c645d5f96c', '10000000-0000-0000-0000-000000000001', 450000.00),
    (gen_random_uuid(), NOW(), NOW(), 'D7-C212', 'Tầng 2', 'AVAILABLE', '45e03ded-5da1-43d5-bea7-96c645d5f96c', '10000000-0000-0000-0000-000000000002', 1250000.00)
ON CONFLICT (id) DO NOTHING;


-- D. THU DUC (Tech & E-Commerce Fulfillment Hub - 36 Units Total)
-- fd8f948e-fdff-4a81-ad0f-fc45639b545d
INSERT INTO storage_units (id, created_at, updated_at, unit_code, floor_level, status, facility_id, unit_type_id, price_per_month)
VALUES
    -- TD Zone A (Tầng 1 - Fulfillment & Soát Hàng Nhanh TMĐT): TD-A105 to TD-A112
    (gen_random_uuid(), NOW(), NOW(), 'TD-A105', 'Tầng 1', 'AVAILABLE', 'fd8f948e-fdff-4a81-ad0f-fc45639b545d', '10000000-0000-0000-0000-000000000003', 2400000.00),
    (gen_random_uuid(), NOW(), NOW(), 'TD-A106', 'Tầng 1', 'OCCUPIED',  'fd8f948e-fdff-4a81-ad0f-fc45639b545d', '10000000-0000-0000-0000-000000000003', 2400000.00),
    (gen_random_uuid(), NOW(), NOW(), 'TD-A107', 'Tầng 1', 'AVAILABLE', 'fd8f948e-fdff-4a81-ad0f-fc45639b545d', '10000000-0000-0000-0000-000000000004', 4800000.00),
    (gen_random_uuid(), NOW(), NOW(), 'TD-A108', 'Tầng 1', 'AVAILABLE', 'fd8f948e-fdff-4a81-ad0f-fc45639b545d', '10000000-0000-0000-0000-000000000002', 1250000.00),
    (gen_random_uuid(), NOW(), NOW(), 'TD-A109', 'Tầng 1', 'OCCUPIED',  'fd8f948e-fdff-4a81-ad0f-fc45639b545d', '10000000-0000-0000-0000-000000000004', 4800000.00),
    (gen_random_uuid(), NOW(), NOW(), 'TD-A110', 'Tầng 1', 'AVAILABLE', 'fd8f948e-fdff-4a81-ad0f-fc45639b545d', '10000000-0000-0000-0000-000000000003', 2400000.00),
    (gen_random_uuid(), NOW(), NOW(), 'TD-A111', 'Tầng 1', 'RESERVED',   'fd8f948e-fdff-4a81-ad0f-fc45639b545d', '10000000-0000-0000-0000-000000000002', 1250000.00),
    (gen_random_uuid(), NOW(), NOW(), 'TD-A112', 'Tầng 1', 'AVAILABLE', 'fd8f948e-fdff-4a81-ad0f-fc45639b545d', '10000000-0000-0000-0000-000000000004', 4800000.00),

    -- TD Zone B (Tầng 1 - Kho Hàng Xuất Livestream & Phụ Kiện): TD-B102 to TD-B112
    (gen_random_uuid(), NOW(), NOW(), 'TD-B102', 'Tầng 1', 'AVAILABLE', 'fd8f948e-fdff-4a81-ad0f-fc45639b545d', '10000000-0000-0000-0000-000000000003', 2400000.00),
    (gen_random_uuid(), NOW(), NOW(), 'TD-B103', 'Tầng 1', 'OCCUPIED',  'fd8f948e-fdff-4a81-ad0f-fc45639b545d', '10000000-0000-0000-0000-000000000003', 2400000.00),
    (gen_random_uuid(), NOW(), NOW(), 'TD-B104', 'Tầng 1', 'AVAILABLE', 'fd8f948e-fdff-4a81-ad0f-fc45639b545d', '10000000-0000-0000-0000-000000000004', 4800000.00),
    (gen_random_uuid(), NOW(), NOW(), 'TD-B105', 'Tầng 1', 'AVAILABLE', 'fd8f948e-fdff-4a81-ad0f-fc45639b545d', '10000000-0000-0000-0000-000000000002', 1250000.00),
    (gen_random_uuid(), NOW(), NOW(), 'TD-B106', 'Tầng 1', 'OCCUPIED',  'fd8f948e-fdff-4a81-ad0f-fc45639b545d', '10000000-0000-0000-0000-000000000003', 2400000.00),
    (gen_random_uuid(), NOW(), NOW(), 'TD-B107', 'Tầng 1', 'AVAILABLE', 'fd8f948e-fdff-4a81-ad0f-fc45639b545d', '10000000-0000-0000-0000-000000000003', 2400000.00),
    (gen_random_uuid(), NOW(), NOW(), 'TD-B108', 'Tầng 1', 'UNDER_MAINTENANCE', 'fd8f948e-fdff-4a81-ad0f-fc45639b545d', '10000000-0000-0000-0000-000000000002', 1250000.00),
    (gen_random_uuid(), NOW(), NOW(), 'TD-B109', 'Tầng 1', 'OCCUPIED',  'fd8f948e-fdff-4a81-ad0f-fc45639b545d', '10000000-0000-0000-0000-000000000004', 4800000.00),
    (gen_random_uuid(), NOW(), NOW(), 'TD-B110', 'Tầng 1', 'AVAILABLE', 'fd8f948e-fdff-4a81-ad0f-fc45639b545d', '10000000-0000-0000-0000-000000000003', 2400000.00),
    (gen_random_uuid(), NOW(), NOW(), 'TD-B111', 'Tầng 1', 'AVAILABLE', 'fd8f948e-fdff-4a81-ad0f-fc45639b545d', '10000000-0000-0000-0000-000000000002', 1250000.00),
    (gen_random_uuid(), NOW(), NOW(), 'TD-B112', 'Tầng 1', 'AVAILABLE', 'fd8f948e-fdff-4a81-ad0f-fc45639b545d', '10000000-0000-0000-0000-000000000004', 4800000.00),

    -- TD Zone C (Tầng 2 - Tech Cleanroom & Server Spares): TD-C205 to TD-C212
    (gen_random_uuid(), NOW(), NOW(), 'TD-C205', 'Tầng 2', 'AVAILABLE', 'fd8f948e-fdff-4a81-ad0f-fc45639b545d', '10000000-0000-0000-0000-000000000002', 1250000.00),
    (gen_random_uuid(), NOW(), NOW(), 'TD-C206', 'Tầng 2', 'OCCUPIED',  'fd8f948e-fdff-4a81-ad0f-fc45639b545d', '10000000-0000-0000-0000-000000000003', 2400000.00),
    (gen_random_uuid(), NOW(), NOW(), 'TD-C207', 'Tầng 2', 'AVAILABLE', 'fd8f948e-fdff-4a81-ad0f-fc45639b545d', '10000000-0000-0000-0000-000000000002', 1250000.00),
    (gen_random_uuid(), NOW(), NOW(), 'TD-C208', 'Tầng 2', 'AVAILABLE', 'fd8f948e-fdff-4a81-ad0f-fc45639b545d', '10000000-0000-0000-0000-000000000003', 2400000.00),
    (gen_random_uuid(), NOW(), NOW(), 'TD-C209', 'Tầng 2', 'OCCUPIED',  'fd8f948e-fdff-4a81-ad0f-fc45639b545d', '10000000-0000-0000-0000-000000000004', 4800000.00),
    (gen_random_uuid(), NOW(), NOW(), 'TD-C210', 'Tầng 2', 'RESERVED',   'fd8f948e-fdff-4a81-ad0f-fc45639b545d', '10000000-0000-0000-0000-000000000003', 2400000.00),
    (gen_random_uuid(), NOW(), NOW(), 'TD-C211', 'Tầng 2', 'AVAILABLE', 'fd8f948e-fdff-4a81-ad0f-fc45639b545d', '10000000-0000-0000-0000-000000000002', 1250000.00),
    (gen_random_uuid(), NOW(), NOW(), 'TD-C212', 'Tầng 2', 'AVAILABLE', 'fd8f948e-fdff-4a81-ad0f-fc45639b545d', '10000000-0000-0000-0000-000000000004', 4800000.00)
ON CONFLICT (id) DO NOTHING;

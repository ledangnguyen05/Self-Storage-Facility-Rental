-- =========================================================================
-- V101: Overdue Debt Processing, SmartLock PIN/QR Revocation, and Sealing
-- =========================================================================

-- 1. Alter rental_contracts with overdue, smartlock, and sealing tracking fields
ALTER TABLE rental_contracts
    ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS overdue_pin_status VARCHAR(40) DEFAULT 'PIN_ACTIVE',
    ADD COLUMN IF NOT EXISTS overdue_sealing_status VARCHAR(40) DEFAULT 'NONE',
    ADD COLUMN IF NOT EXISTS smart_lock_online_status VARCHAR(30) DEFAULT 'ONLINE',
    ADD COLUMN IF NOT EXISTS smart_lock_is_mock BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS smart_lock_last_unlocked_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS temp_pin_granted_until TIMESTAMP,
    ADD COLUMN IF NOT EXISTS temp_pin_grant_reason VARCHAR(255);

-- 2. Alter sealing_records with multi-step approval workflow fields
ALTER TABLE sealing_records
    ADD COLUMN IF NOT EXISTS request_status VARCHAR(40) DEFAULT 'COMPLETED',
    ADD COLUMN IF NOT EXISTS requested_by_id UUID REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS requested_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS approved_by_id UUID REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- 3. Table: overdue_notice_logs (Reminder and legal notice logs)
CREATE TABLE IF NOT EXISTS overdue_notice_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    contract_id UUID NOT NULL REFERENCES rental_contracts(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES users(id),
    channel VARCHAR(30) NOT NULL, -- SMS, EMAIL, CALL, MULTI
    template_type VARCHAR(50) NOT NULL, -- REMINDER, WARNING, LOCKOUT_NOTICE, SEAL_WARNING
    content TEXT NOT NULL,
    sent_by_id UUID REFERENCES users(id),
    sent_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    delivery_status VARCHAR(30) DEFAULT 'DELIVERED',
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_overdue_notice_contract ON overdue_notice_logs(contract_id);
CREATE INDEX IF NOT EXISTS idx_overdue_notice_customer ON overdue_notice_logs(customer_id);

-- 4. Table: pin_revocation_requests (Tracking SmartLock PIN/QR revocations)
CREATE TABLE IF NOT EXISTS pin_revocation_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    contract_id UUID NOT NULL REFERENCES rental_contracts(id) ON DELETE CASCADE,
    unit_id UUID REFERENCES storage_units(id),
    request_code VARCHAR(60) NOT NULL UNIQUE,
    reason VARCHAR(255),
    status VARCHAR(40) NOT NULL, -- PENDING, SUCCESS_MOCK, SUCCESS_HARDWARE, FAILED_OFFLINE, FAILED_ERROR
    is_mock BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    retry_count INT DEFAULT 0,
    requested_by_id UUID REFERENCES users(id),
    requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    executed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pin_req_contract ON pin_revocation_requests(contract_id);

-- 5. Table: asset_inventory_items (Sealed unit itemized inventory)
CREATE TABLE IF NOT EXISTS asset_inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sealing_record_id UUID NOT NULL REFERENCES sealing_records(id) ON DELETE CASCADE,
    item_name VARCHAR(255) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    condition_status VARCHAR(100),
    estimated_value NUMERIC(15, 2) DEFAULT 0,
    photo_url VARCHAR(500),
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_inventory_sealing ON asset_inventory_items(sealing_record_id);

-- 6. Table: overdue_audit_logs (Comprehensive action & state change audit trail)
CREATE TABLE IF NOT EXISTS overdue_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    contract_id UUID REFERENCES rental_contracts(id) ON DELETE CASCADE,
    action VARCHAR(60) NOT NULL,
    performed_by_id UUID REFERENCES users(id),
    performed_by_name VARCHAR(100),
    performed_by_role VARCHAR(50),
    before_state VARCHAR(100),
    after_state VARCHAR(100),
    details TEXT
);

CREATE INDEX IF NOT EXISTS idx_overdue_audit_contract ON overdue_audit_logs(contract_id);

-- 7. Ensure demo facility for Group E (Thiếu chính sách / Unconfigured policy)
INSERT INTO facilities (id, name, code, address, city, contact_phone, email, status, open_time, close_time, created_at, updated_at, description)
VALUES (
    'e5555555-5555-5555-5555-555555555555',
    'Boxora Vinhomes Grand Park Hub',
    'HCM-VGP',
    'Phân khu Rainbow, Vinhomes Grand Park, Long Thạnh Mỹ, TP. Thủ Đức',
    'Ho Chi Minh City',
    '0908889999',
    'vgp@boxora.vn',
    'ACTIVE',
    '08:00:00',
    '21:00:00',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    'Cơ sở mới đang hoàn thiện hạ tầng chính sách (Chưa cấu hình chính sách quá hạn)'
)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name, address = EXCLUDED.address, description = EXCLUDED.description;

-- Ensure facility policy for HCM-VGP is inactive or unconfigured
INSERT INTO facility_policies (id, created_at, updated_at, facility_id, is_active, deposit_percentage, renewal_window_days, minimum_rental_months, overdue_grace_days, daily_late_fee, overdue_access_disable_days, overdue_sealing_days)
VALUES (
    'e6666666-5555-5555-5555-555555555555',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    'e5555555-5555-5555-5555-555555555555',
    FALSE, -- Inactive policy explicitly triggers Group 5
    100.0,
    3,
    1,
    1,
    200000.00,
    3,
    7
)
ON CONFLICT (facility_id) DO UPDATE
SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP;

-- 8. Seed dedicated demo Storage Units for the 25 demo cases
-- Group A (Tan Binh: a1111111-2222-3333-4444-555555555555)
INSERT INTO storage_units (id, created_at, updated_at, unit_code, floor_level, status, facility_id, unit_type_id, price_per_month)
VALUES
    ('d0000000-0001-0000-0000-000000000001', NOW(), NOW(), 'TB-A201', 'Tầng 2', 'OCCUPIED', 'a1111111-2222-3333-4444-555555555555', '10000000-0000-0000-0000-000000000001', 1500000.00),
    ('d0000000-0001-0000-0000-000000000002', NOW(), NOW(), 'TB-A202', 'Tầng 2', 'OCCUPIED', 'a1111111-2222-3333-4444-555555555555', '10000000-0000-0000-0000-000000000002', 2000000.00),
    ('d0000000-0001-0000-0000-000000000003', NOW(), NOW(), 'TB-A203', 'Tầng 2', 'OCCUPIED', 'a1111111-2222-3333-4444-555555555555', '10000000-0000-0000-0000-000000000003', 2500000.00),
    ('d0000000-0001-0000-0000-000000000004', NOW(), NOW(), 'TB-A204', 'Tầng 2', 'OCCUPIED', 'a1111111-2222-3333-4444-555555555555', '10000000-0000-0000-0000-000000000001', 1500000.00),
    ('d0000000-0001-0000-0000-000000000005', NOW(), NOW(), 'TB-A205', 'Tầng 2', 'OCCUPIED', 'a1111111-2222-3333-4444-555555555555', '10000000-0000-0000-0000-000000000002', 1800000.00)
ON CONFLICT (id) DO UPDATE SET unit_code = EXCLUDED.unit_code, status = 'OCCUPIED';

-- Group B (District 1: f7af2794-0d0d-4c68-9e36-c44bf3034f6c)
INSERT INTO storage_units (id, created_at, updated_at, unit_code, floor_level, status, facility_id, unit_type_id, price_per_month)
VALUES
    ('d0000000-0002-0000-0000-000000000001', NOW(), NOW(), 'D1-B201', 'Tầng 2', 'OCCUPIED', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', '10000000-0000-0000-0000-000000000001', 1200000.00),
    ('d0000000-0002-0000-0000-000000000002', NOW(), NOW(), 'D1-B202', 'Tầng 2', 'OCCUPIED', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', '10000000-0000-0000-0000-000000000002', 1600000.00),
    ('d0000000-0002-0000-0000-000000000003', NOW(), NOW(), 'D1-B203', 'Tầng 2', 'OCCUPIED', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', '10000000-0000-0000-0000-000000000003', 2200000.00),
    ('d0000000-0002-0000-0000-000000000004', NOW(), NOW(), 'D1-B204', 'Tầng 2', 'OCCUPIED', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', '10000000-0000-0000-0000-000000000001', 1400000.00),
    ('d0000000-0002-0000-0000-000000000005', NOW(), NOW(), 'D1-B205', 'Tầng 2', 'OCCUPIED', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', '10000000-0000-0000-0000-000000000002', 1900000.00)
ON CONFLICT (id) DO UPDATE SET unit_code = EXCLUDED.unit_code, status = 'OCCUPIED';

-- Group C (District 7: 45e03ded-5da1-43d5-bea7-96c645d5f96c)
INSERT INTO storage_units (id, created_at, updated_at, unit_code, floor_level, status, facility_id, unit_type_id, price_per_month)
VALUES
    ('d0000000-0003-0000-0000-000000000001', NOW(), NOW(), 'D7-C301', 'Tầng 3', 'OCCUPIED', '45e03ded-5da1-43d5-bea7-96c645d5f96c', '10000000-0000-0000-0000-000000000001', 1700000.00),
    ('d0000000-0003-0000-0000-000000000002', NOW(), NOW(), 'D7-C302', 'Tầng 3', 'OCCUPIED', '45e03ded-5da1-43d5-bea7-96c645d5f96c', '10000000-0000-0000-0000-000000000002', 2100000.00),
    ('d0000000-0003-0000-0000-000000000003', NOW(), NOW(), 'D7-C303', 'Tầng 3', 'OCCUPIED', '45e03ded-5da1-43d5-bea7-96c645d5f96c', '10000000-0000-0000-0000-000000000003', 2600000.00),
    ('d0000000-0003-0000-0000-000000000004', NOW(), NOW(), 'D7-C304', 'Tầng 3', 'OCCUPIED', '45e03ded-5da1-43d5-bea7-96c645d5f96c', '10000000-0000-0000-0000-000000000001', 1800000.00),
    ('d0000000-0003-0000-0000-000000000005', NOW(), NOW(), 'D7-C305', 'Tầng 3', 'OCCUPIED', '45e03ded-5da1-43d5-bea7-96c645d5f96c', '10000000-0000-0000-0000-000000000002', 2300000.00)
ON CONFLICT (id) DO UPDATE SET unit_code = EXCLUDED.unit_code, status = 'OCCUPIED';

-- Group D (Thu Duc: fd8f948e-fdff-4a81-ad0f-fc45639b545d)
INSERT INTO storage_units (id, created_at, updated_at, unit_code, floor_level, status, facility_id, unit_type_id, price_per_month)
VALUES
    ('d0000000-0004-0000-0000-000000000001', NOW(), NOW(), 'TD-D401', 'Tầng 4', 'OCCUPIED', 'fd8f948e-fdff-4a81-ad0f-fc45639b545d', '10000000-0000-0000-0000-000000000001', 1500000.00),
    ('d0000000-0004-0000-0000-000000000002', NOW(), NOW(), 'TD-D402', 'Tầng 4', 'OCCUPIED', 'fd8f948e-fdff-4a81-ad0f-fc45639b545d', '10000000-0000-0000-0000-000000000002', 1900000.00),
    ('d0000000-0004-0000-0000-000000000003', NOW(), NOW(), 'TD-D403', 'Tầng 4', 'OCCUPIED', 'fd8f948e-fdff-4a81-ad0f-fc45639b545d', '10000000-0000-0000-0000-000000000003', 2400000.00),
    ('d0000000-0004-0000-0000-000000000004', NOW(), NOW(), 'TD-D404', 'Tầng 4', 'OCCUPIED', 'fd8f948e-fdff-4a81-ad0f-fc45639b545d', '10000000-0000-0000-0000-000000000001', 1600000.00),
    ('d0000000-0004-0000-0000-000000000005', NOW(), NOW(), 'TD-D405', 'Tầng 4', 'OCCUPIED', 'fd8f948e-fdff-4a81-ad0f-fc45639b545d', '10000000-0000-0000-0000-000000000002', 2000000.00)
ON CONFLICT (id) DO UPDATE SET unit_code = EXCLUDED.unit_code, status = 'OCCUPIED';

-- Group E (Vinhomes Grand Park: e5555555-5555-5555-5555-555555555555)
INSERT INTO storage_units (id, created_at, updated_at, unit_code, floor_level, status, facility_id, unit_type_id, price_per_month)
VALUES
    ('d0000000-0005-0000-0000-000000000001', NOW(), NOW(), 'VGP-E101', 'Tầng 1', 'OCCUPIED', 'e5555555-5555-5555-5555-555555555555', '10000000-0000-0000-0000-000000000001', 1600000.00),
    ('d0000000-0005-0000-0000-000000000002', NOW(), NOW(), 'VGP-E102', 'Tầng 1', 'OCCUPIED', 'e5555555-5555-5555-5555-555555555555', '10000000-0000-0000-0000-000000000002', 2100000.00),
    ('d0000000-0005-0000-0000-000000000003', NOW(), NOW(), 'VGP-E103', 'Tầng 1', 'OCCUPIED', 'e5555555-5555-5555-5555-555555555555', '10000000-0000-0000-0000-000000000003', 2700000.00),
    ('d0000000-0005-0000-0000-000000000004', NOW(), NOW(), 'VGP-E104', 'Tầng 1', 'OCCUPIED', 'e5555555-5555-5555-5555-555555555555', '10000000-0000-0000-0000-000000000001', 1700000.00),
    ('d0000000-0005-0000-0000-000000000005', NOW(), NOW(), 'VGP-E105', 'Tầng 1', 'OCCUPIED', 'e5555555-5555-5555-5555-555555555555', '10000000-0000-0000-0000-000000000002', 2200000.00)
ON CONFLICT (id) DO UPDATE SET unit_code = EXCLUDED.unit_code, status = 'OCCUPIED';

-- 9. Seed 25 Demo Rental Contracts (is_demo = TRUE)
-- Pick existing customer id: 'e0000000-0000-0000-0000-000000000007' or customer6-10

-- Delete existing demo contracts if any
DELETE FROM rental_contracts WHERE is_demo = TRUE;

-- -------------------------------------------------------------------------
-- NHÓM 1: ÂN HẠN NHẮC CƯỚC (5 ca, overdueDays = 1, lateFee = 0)
-- -------------------------------------------------------------------------
INSERT INTO rental_contracts (
    id, created_at, updated_at, contract_code, customer_id, unit_id, facility_id,
    start_date, end_date, monthly_fee, deposit_held, status, signing_method,
    is_demo, overdue_pin_status, overdue_sealing_status, smart_lock_online_status, smart_lock_is_mock
)
VALUES
    ('c0000000-0001-0000-0000-000000000001', NOW(), NOW(), 'DEMO-CTR-A01', 'e0000000-0000-0000-0000-000000000007', 'd0000000-0001-0000-0000-000000000001', 'a1111111-2222-3333-4444-555555555555', CURRENT_DATE - 31, CURRENT_DATE - 1, 1500000.00, 1500000.00, 'OVERDUE', 'ELECTRONIC', TRUE, 'PIN_ACTIVE', 'NONE', 'ONLINE', TRUE),
    ('c0000000-0001-0000-0000-000000000002', NOW(), NOW(), 'DEMO-CTR-A02', 'e0000000-0000-0000-0000-000000000007', 'd0000000-0001-0000-0000-000000000002', 'a1111111-2222-3333-4444-555555555555', CURRENT_DATE - 31, CURRENT_DATE - 1, 2000000.00, 2000000.00, 'OVERDUE', 'ELECTRONIC', TRUE, 'PIN_ACTIVE', 'NONE', 'ONLINE', TRUE),
    ('c0000000-0001-0000-0000-000000000003', NOW(), NOW(), 'DEMO-CTR-A03', 'e0000000-0000-0000-0000-000000000007', 'd0000000-0001-0000-0000-000000000003', 'a1111111-2222-3333-4444-555555555555', CURRENT_DATE - 31, CURRENT_DATE - 1, 2500000.00, 2500000.00, 'OVERDUE', 'ELECTRONIC', TRUE, 'PIN_ACTIVE', 'NONE', 'ONLINE', TRUE),
    ('c0000000-0001-0000-0000-000000000004', NOW(), NOW(), 'DEMO-CTR-A04', 'e0000000-0000-0000-0000-000000000007', 'd0000000-0001-0000-0000-000000000004', 'a1111111-2222-3333-4444-555555555555', CURRENT_DATE - 31, CURRENT_DATE - 1, 1500000.00, 1500000.00, 'OVERDUE', 'ELECTRONIC', TRUE, 'PIN_ACTIVE', 'NONE', 'ONLINE', TRUE),
    ('c0000000-0001-0000-0000-000000000005', NOW(), NOW(), 'DEMO-CTR-A05', 'e0000000-0000-0000-0000-000000000007', 'd0000000-0001-0000-0000-000000000005', 'a1111111-2222-3333-4444-555555555555', CURRENT_DATE - 31, CURRENT_DATE - 1, 1800000.00, 1800000.00, 'OVERDUE', 'ELECTRONIC', TRUE, 'PIN_ACTIVE', 'NONE', 'ONLINE', TRUE);

-- -------------------------------------------------------------------------
-- NHÓM 2: CẢNH BÁO (5 ca, overdueDays = 2, lateFee = 200,000)
-- -------------------------------------------------------------------------
INSERT INTO rental_contracts (
    id, created_at, updated_at, contract_code, customer_id, unit_id, facility_id,
    start_date, end_date, monthly_fee, deposit_held, status, signing_method,
    is_demo, overdue_pin_status, overdue_sealing_status, smart_lock_online_status, smart_lock_is_mock
)
VALUES
    ('c0000000-0002-0000-0000-000000000001', NOW(), NOW(), 'DEMO-CTR-B01', 'e0000000-0000-0000-0000-000000000007', 'd0000000-0002-0000-0000-000000000001', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', CURRENT_DATE - 32, CURRENT_DATE - 2, 1200000.00, 1200000.00, 'OVERDUE', 'ELECTRONIC', TRUE, 'PIN_ACTIVE', 'NONE', 'ONLINE', TRUE),
    ('c0000000-0002-0000-0000-000000000002', NOW(), NOW(), 'DEMO-CTR-B02', 'e0000000-0000-0000-0000-000000000007', 'd0000000-0002-0000-0000-000000000002', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', CURRENT_DATE - 32, CURRENT_DATE - 2, 1600000.00, 1600000.00, 'OVERDUE', 'ELECTRONIC', TRUE, 'PIN_ACTIVE', 'NONE', 'ONLINE', TRUE),
    ('c0000000-0002-0000-0000-000000000003', NOW(), NOW(), 'DEMO-CTR-B03', 'e0000000-0000-0000-0000-000000000007', 'd0000000-0002-0000-0000-000000000003', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', CURRENT_DATE - 32, CURRENT_DATE - 2, 2200000.00, 2200000.00, 'OVERDUE', 'ELECTRONIC', TRUE, 'PIN_ACTIVE', 'NONE', 'ONLINE', TRUE),
    ('c0000000-0002-0000-0000-000000000004', NOW(), NOW(), 'DEMO-CTR-B04', 'e0000000-0000-0000-0000-000000000007', 'd0000000-0002-0000-0000-000000000004', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', CURRENT_DATE - 32, CURRENT_DATE - 2, 1400000.00, 1400000.00, 'OVERDUE', 'ELECTRONIC', TRUE, 'PIN_ACTIVE', 'NONE', 'ONLINE', TRUE),
    ('c0000000-0002-0000-0000-000000000005', NOW(), NOW(), 'DEMO-CTR-B05', 'e0000000-0000-0000-0000-000000000007', 'd0000000-0002-0000-0000-000000000005', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', CURRENT_DATE - 32, CURRENT_DATE - 2, 1900000.00, 1900000.00, 'OVERDUE', 'ELECTRONIC', TRUE, 'PIN_ACTIVE', 'NONE', 'ONLINE', TRUE);

-- -------------------------------------------------------------------------
-- NHÓM 3: ĐẠT NGƯỠNG THU HỒI PIN/QR (5 ca, 3 <= overdueDays < 7)
-- C01: day 3 (400k, PIN_REVOKED)
-- C02: day 4 (600k, PIN_REVOCATION_PENDING)
-- C03: day 4 (600k, PIN_REVOCATION_FAILED, OFFLINE mock)
-- C04: day 5 (800k, PIN_REVOKED)
-- C05: day 6 (1000k, PIN_REVOKED)
-- -------------------------------------------------------------------------
INSERT INTO rental_contracts (
    id, created_at, updated_at, contract_code, customer_id, unit_id, facility_id,
    start_date, end_date, monthly_fee, deposit_held, status, signing_method,
    is_demo, overdue_pin_status, overdue_sealing_status, smart_lock_online_status, smart_lock_is_mock
)
VALUES
    ('c0000000-0003-0000-0000-000000000001', NOW(), NOW(), 'DEMO-CTR-C01', 'e0000000-0000-0000-0000-000000000007', 'd0000000-0003-0000-0000-000000000001', '45e03ded-5da1-43d5-bea7-96c645d5f96c', CURRENT_DATE - 33, CURRENT_DATE - 3, 1700000.00, 1700000.00, 'OVERDUE_LOCKED', 'ELECTRONIC', TRUE, 'PIN_REVOKED', 'NONE', 'ONLINE', TRUE),
    ('c0000000-0003-0000-0000-000000000002', NOW(), NOW(), 'DEMO-CTR-C02', 'e0000000-0000-0000-0000-000000000007', 'd0000000-0003-0000-0000-000000000002', '45e03ded-5da1-43d5-bea7-96c645d5f96c', CURRENT_DATE - 34, CURRENT_DATE - 4, 2100000.00, 2100000.00, 'OVERDUE', 'ELECTRONIC', TRUE, 'PIN_REVOCATION_PENDING', 'NONE', 'ONLINE', TRUE),
    ('c0000000-0003-0000-0000-000000000003', NOW(), NOW(), 'DEMO-CTR-C03', 'e0000000-0000-0000-0000-000000000007', 'd0000000-0003-0000-0000-000000000003', '45e03ded-5da1-43d5-bea7-96c645d5f96c', CURRENT_DATE - 34, CURRENT_DATE - 4, 2600000.00, 2600000.00, 'OVERDUE', 'ELECTRONIC', TRUE, 'PIN_REVOCATION_FAILED', 'NONE', 'OFFLINE', TRUE),
    ('c0000000-0003-0000-0000-000000000004', NOW(), NOW(), 'DEMO-CTR-C04', 'e0000000-0000-0000-0000-000000000007', 'd0000000-0003-0000-0000-000000000004', '45e03ded-5da1-43d5-bea7-96c645d5f96c', CURRENT_DATE - 35, CURRENT_DATE - 5, 1800000.00, 1800000.00, 'OVERDUE_LOCKED', 'ELECTRONIC', TRUE, 'PIN_REVOKED', 'NONE', 'ONLINE', TRUE),
    ('c0000000-0003-0000-0000-000000000005', NOW(), NOW(), 'DEMO-CTR-C05', 'e0000000-0000-0000-0000-000000000007', 'd0000000-0003-0000-0000-000000000005', '45e03ded-5da1-43d5-bea7-96c645d5f96c', CURRENT_DATE - 36, CURRENT_DATE - 6, 2300000.00, 2300000.00, 'OVERDUE_LOCKED', 'ELECTRONIC', TRUE, 'PIN_REVOKED', 'NONE', 'ONLINE', TRUE);

-- -------------------------------------------------------------------------
-- NHÓM 4: ĐỦ ĐIỀU KIỆN NIÊM PHONG (5 ca, overdueDays >= 7)
-- D01: day 7 (1.2M, SEALING_ELIGIBLE)
-- D02: day 8 (1.4M, SEALING_REQUESTED)
-- D03: day 10 (1.8M, SEALING_APPROVED)
-- D04: day 12 (2.2M, SEALING_IN_PROGRESS)
-- D05: day 15 (2.8M, SEALING_COMPLETED with Sealing Record & Asset Inventory)
-- -------------------------------------------------------------------------
INSERT INTO rental_contracts (
    id, created_at, updated_at, contract_code, customer_id, unit_id, facility_id,
    start_date, end_date, monthly_fee, deposit_held, status, signing_method,
    is_demo, overdue_pin_status, overdue_sealing_status, smart_lock_online_status, smart_lock_is_mock
)
VALUES
    ('c0000000-0004-0000-0000-000000000001', NOW(), NOW(), 'DEMO-CTR-D01', 'e0000000-0000-0000-0000-000000000007', 'd0000000-0004-0000-0000-000000000001', 'fd8f948e-fdff-4a81-ad0f-fc45639b545d', CURRENT_DATE - 37, CURRENT_DATE - 7, 1500000.00, 1500000.00, 'OVERDUE_LOCKED', 'ELECTRONIC', TRUE, 'PIN_REVOKED', 'SEALING_ELIGIBLE', 'ONLINE', TRUE),
    ('c0000000-0004-0000-0000-000000000002', NOW(), NOW(), 'DEMO-CTR-D02', 'e0000000-0000-0000-0000-000000000007', 'd0000000-0004-0000-0000-000000000002', 'fd8f948e-fdff-4a81-ad0f-fc45639b545d', CURRENT_DATE - 38, CURRENT_DATE - 8, 1900000.00, 1900000.00, 'OVERDUE_LOCKED', 'ELECTRONIC', TRUE, 'PIN_REVOKED', 'SEALING_REQUESTED', 'ONLINE', TRUE),
    ('c0000000-0004-0000-0000-000000000003', NOW(), NOW(), 'DEMO-CTR-D03', 'e0000000-0000-0000-0000-000000000007', 'd0000000-0004-0000-0000-000000000003', 'fd8f948e-fdff-4a81-ad0f-fc45639b545d', CURRENT_DATE - 40, CURRENT_DATE - 10, 2400000.00, 2400000.00, 'OVERDUE_LOCKED', 'ELECTRONIC', TRUE, 'PIN_REVOKED', 'SEALING_APPROVED', 'ONLINE', TRUE),
    ('c0000000-0004-0000-0000-000000000004', NOW(), NOW(), 'DEMO-CTR-D04', 'e0000000-0000-0000-0000-000000000007', 'd0000000-0004-0000-0000-000000000004', 'fd8f948e-fdff-4a81-ad0f-fc45639b545d', CURRENT_DATE - 42, CURRENT_DATE - 12, 1600000.00, 1600000.00, 'OVERDUE_LOCKED', 'ELECTRONIC', TRUE, 'PIN_REVOKED', 'SEALING_IN_PROGRESS', 'ONLINE', TRUE),
    ('c0000000-0004-0000-0000-000000000005', NOW(), NOW(), 'DEMO-CTR-D05', 'e0000000-0000-0000-0000-000000000007', 'd0000000-0004-0000-0000-000000000005', 'fd8f948e-fdff-4a81-ad0f-fc45639b545d', CURRENT_DATE - 45, CURRENT_DATE - 15, 2000000.00, 2000000.00, 'OVERDUE_LOCKED', 'ELECTRONIC', TRUE, 'PIN_REVOKED', 'SEALING_COMPLETED', 'ONLINE', TRUE);

-- Seed Sealing Record and Inventory Items for DEMO-CTR-D05
INSERT INTO sealing_records (
    id, created_at, updated_at, storage_unit_id, contract_id, facility_id, seal_tag_number,
    reason, sealed_at, sealed_by_id, witness_id, status, protocol_number, overdue_days,
    total_debt_amount, inventory_summary, request_status
)
VALUES (
    's0000000-0004-0000-0000-000000000005',
    NOW(), NOW(),
    'd0000000-0004-0000-0000-000000000005',
    'c0000000-0004-0000-0000-000000000005',
    'fd8f948e-fdff-4a81-ad0f-fc45639b545d',
    'SEAL-TD-2026-9905',
    'Quá hạn 15 ngày vượt ngưỡng chính sách BR-RULE-012, đã thu hồi PIN nhưng chưa thanh toán',
    CURRENT_TIMESTAMP - INTERVAL '1 day',
    'e0000000-0000-0000-0000-000000000002', -- staff user
    'e0000000-0000-0000-0000-000000000003', -- manager/witness
    'SEALED',
    'BB-NP-2026-TD05',
    15,
    4800000.00,
    'Kiểm kê hiện trường: 01 Máy khoan cầm tay Bosch, 01 Bộ đồ nghề Stanley, 03 Thùng carton tài liệu',
    'COMPLETED'
)
ON CONFLICT (seal_tag_number) DO NOTHING;

INSERT INTO asset_inventory_items (id, created_at, updated_at, sealing_record_id, item_name, quantity, condition_status, estimated_value, notes)
VALUES
    (gen_random_uuid(), NOW(), NOW(), 's0000000-0004-0000-0000-000000000005', 'Máy khoan búa cầm tay Bosch GSB 550', 1, 'Tốt, còn hộp bảo vệ', 1200000.00, 'Niêm phong cùng phụ kiện mũi khoan'),
    (gen_random_uuid(), NOW(), NOW(), 's0000000-0004-0000-0000-000000000005', 'Bộ vali đồ nghề cơ khí Stanley 110 món', 1, 'Đã qua sử dụng, hoạt động bình thường', 1800000.00, 'Khóa chốt vali còn nguyên vẹn'),
    (gen_random_uuid(), NOW(), NOW(), 's0000000-0004-0000-0000-000000000005', 'Thùng carton niêm phong chứa hồ sơ kế toán 2024', 3, 'Khô ráo, dán băng dính niêm phong Boxora', 300000.00, 'Tài liệu lưu trữ công ty')
ON CONFLICT DO NOTHING;

-- -------------------------------------------------------------------------
-- NHÓM 5: THIẾU CHÍNH SÁCH / POLICY_UNCONFIGURED (5 ca, facility HCM-VGP)
-- -------------------------------------------------------------------------
INSERT INTO rental_contracts (
    id, created_at, updated_at, contract_code, customer_id, unit_id, facility_id,
    start_date, end_date, monthly_fee, deposit_held, status, signing_method,
    is_demo, overdue_pin_status, overdue_sealing_status, smart_lock_online_status, smart_lock_is_mock
)
VALUES
    ('c0000000-0005-0000-0000-000000000001', NOW(), NOW(), 'DEMO-CTR-E01', 'e0000000-0000-0000-0000-000000000007', 'd0000000-0005-0000-0000-000000000001', 'e5555555-5555-5555-5555-555555555555', CURRENT_DATE - 35, CURRENT_DATE - 5, 1600000.00, 1600000.00, 'OVERDUE', 'ELECTRONIC', TRUE, 'PIN_ACTIVE', 'NONE', 'ONLINE', TRUE),
    ('c0000000-0005-0000-0000-000000000002', NOW(), NOW(), 'DEMO-CTR-E02', 'e0000000-0000-0000-0000-000000000007', 'd0000000-0005-0000-0000-000000000002', 'e5555555-5555-5555-5555-555555555555', CURRENT_DATE - 38, CURRENT_DATE - 8, 2100000.00, 2100000.00, 'OVERDUE', 'ELECTRONIC', TRUE, 'PIN_ACTIVE', 'NONE', 'ONLINE', TRUE),
    ('c0000000-0005-0000-0000-000000000003', NOW(), NOW(), 'DEMO-CTR-E03', 'e0000000-0000-0000-0000-000000000007', 'd0000000-0005-0000-0000-000000000003', 'e5555555-5555-5555-5555-555555555555', CURRENT_DATE - 42, CURRENT_DATE - 12, 2700000.00, 2700000.00, 'OVERDUE', 'ELECTRONIC', TRUE, 'PIN_ACTIVE', 'NONE', 'ONLINE', TRUE),
    ('c0000000-0005-0000-0000-000000000004', NOW(), NOW(), 'DEMO-CTR-E04', 'e0000000-0000-0000-0000-000000000007', 'd0000000-0005-0000-0000-000000000004', 'e5555555-5555-5555-5555-555555555555', CURRENT_DATE - 33, CURRENT_DATE - 3, 1700000.00, 1700000.00, 'OVERDUE', 'ELECTRONIC', TRUE, 'PIN_ACTIVE', 'NONE', 'ONLINE', TRUE),
    ('c0000000-0005-0000-0000-000000000005', NOW(), NOW(), 'DEMO-CTR-E05', 'e0000000-0000-0000-0000-000000000007', 'd0000000-0005-0000-0000-000000000005', 'e5555555-5555-5555-5555-555555555555', CURRENT_DATE - 32, CURRENT_DATE - 2, 2200000.00, 2200000.00, 'OVERDUE', 'ELECTRONIC', TRUE, 'PIN_ACTIVE', 'NONE', 'ONLINE', TRUE);

-- Initial Audit Logs for Demo Contracts
INSERT INTO overdue_audit_logs (contract_id, action, performed_by_name, performed_by_role, before_state, after_state, details)
VALUES
    ('c0000000-0001-0000-0000-000000000001', 'OVERDUE_DETECTED', 'Hệ thống tự động', 'SYSTEM', 'ACTIVE', 'OVERDUE', 'Hợp đồng quá hạn 1 ngày. Đang trong thời gian ân hạn miễn phí phạt.'),
    ('c0000000-0002-0000-0000-000000000001', 'WARNING_ISSUED', 'Hệ thống tự động', 'SYSTEM', 'GRACE_PERIOD', 'WARNING', 'Hợp đồng quá hạn 2 ngày. Phát sinh phí phạt trễ hạn 200.000 VNĐ.'),
    ('c0000000-0003-0000-0000-000000000001', 'PIN_REVOCATION_EXECUTED', 'Hệ thống tự động (MOCK)', 'SYSTEM', 'PIN_ACTIVE', 'PIN_REVOKED', 'Hợp đồng quá hạn 3 ngày. Thu hồi PIN/QR trên hệ thống SmartLock Mock thành công.'),
    ('c0000000-0003-0000-0000-000000000003', 'PIN_REVOCATION_FAILED', 'Hệ thống tự động (MOCK)', 'SYSTEM', 'PIN_ACTIVE', 'PIN_REVOCATION_FAILED', 'SmartLock IoT Gateway phản hồi thiết bị OFFLINE. Thu hồi PIN thất bại cần nhân viên kiểm tra trực tiếp.'),
    ('c0000000-0004-0000-0000-000000000005', 'SEALING_COMPLETED', 'Nguyễn Văn Quản Lý', 'FACILITY_MANAGER', 'SEALING_IN_PROGRESS', 'SEALING_COMPLETED', 'Đã hoàn tất dán tem niêm phong SEAL-TD-2026-9905 và lập danh mục kiểm kê 03 mục tài sản.');


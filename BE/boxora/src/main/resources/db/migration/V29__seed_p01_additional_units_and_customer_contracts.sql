-- =========================================================================
-- V29: Task P-01 - Seed Storage Units for 3 Facilities (HCM-D1, HCM-D7, HCM-TD)
--      with Mini, Standard, Cold room types on Floor 1 & Floor 2
--      Seed 4 real sample bookings & rental contracts for 'customer'
--      in CONFIRMED, ACTIVE, OVERDUE statuses.
-- =========================================================================

-- 1. Ensure Unit Types: Mini, Medium, Standard, Commercial, Cold Storage
INSERT INTO unit_types (id, created_at, updated_at, type_name, dimensions, area_sqm, base_price_per_month, deposit_amount)
VALUES
    ('10000000-0000-0000-0000-000000000001', NOW(), NOW(), 'Mini (Personal Locker)', '1.0m x 1.0m x 1.2m', 1.0, 450000.00, 450000.00),
    ('10000000-0000-0000-0000-000000000002', NOW(), NOW(), 'Medium (Compact Studio)', '1.5m x 2.0m x 2.6m', 3.0, 1250000.00, 1250000.00),
    ('10000000-0000-0000-0000-000000000003', NOW(), NOW(), 'Standard (1-Bedroom)', '2.0m x 3.0m x 2.8m', 6.0, 2400000.00, 2400000.00),
    ('10000000-0000-0000-0000-000000000004', NOW(), NOW(), 'Extra Large (Commercial Suite)', '3.0m x 4.0m x 3.0m', 12.0, 4800000.00, 4800000.00),
    ('10000000-0000-0000-0000-000000000005', NOW(), NOW(), 'Cold Storage (Climate Controlled 18-22°C)', '2.0m x 2.5m x 2.8m', 5.0, 3200000.00, 3200000.00)
ON CONFLICT (id) DO UPDATE 
SET type_name = EXCLUDED.type_name,
    base_price_per_month = EXCLUDED.base_price_per_month,
    deposit_amount = EXCLUDED.deposit_amount,
    dimensions = EXCLUDED.dimensions,
    area_sqm = EXCLUDED.area_sqm;

-- 2. Seed 14 Storage Units for HCM-D1 (District 1: f7af2794-0d0d-4c68-9e36-c44bf3034f6c)
INSERT INTO storage_units (id, created_at, updated_at, unit_code, floor_level, status, facility_id, unit_type_id, price_per_month)
VALUES
    -- Floor 1: Mini
    ('b0000000-0001-0000-0000-000000000111', NOW(), NOW(), 'D1-A111', 'Floor 1', 'AVAILABLE', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', '10000000-0000-0000-0000-000000000001', 450000.00),
    ('b0000000-0001-0000-0000-000000000112', NOW(), NOW(), 'D1-A112', 'Floor 1', 'AVAILABLE', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', '10000000-0000-0000-0000-000000000001', 450000.00),
    -- Floor 1: Standard
    ('b0000000-0001-0000-0000-000000000113', NOW(), NOW(), 'D1-B111', 'Floor 1', 'AVAILABLE', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', '10000000-0000-0000-0000-000000000003', 2400000.00),
    ('b0000000-0001-0000-0000-000000000114', NOW(), NOW(), 'D1-B112', 'Floor 1', 'AVAILABLE', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', '10000000-0000-0000-0000-000000000003', 2400000.00),
    ('b0000000-0001-0000-0000-000000000117', NOW(), NOW(), 'D1-B115', 'Floor 1', 'AVAILABLE', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', '10000000-0000-0000-0000-000000000003', 2400000.00),
    -- Floor 1: Cold Storage (1 reserved for sample confirmed booking)
    ('b0000000-0001-0000-0000-000000000115', NOW(), NOW(), 'D1-B113', 'Floor 1', 'AVAILABLE', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', '10000000-0000-0000-0000-000000000005', 3200000.00),
    ('b0000000-0001-0000-0000-000000000116', NOW(), NOW(), 'D1-B114', 'Floor 1', 'RESERVED',  'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', '10000000-0000-0000-0000-000000000005', 3200000.00),
    -- Floor 2: Mini
    ('b0000000-0001-0000-0000-000000000211', NOW(), NOW(), 'D1-C211', 'Floor 2', 'AVAILABLE', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', '10000000-0000-0000-0000-000000000001', 450000.00),
    ('b0000000-0001-0000-0000-000000000212', NOW(), NOW(), 'D1-C212', 'Floor 2', 'AVAILABLE', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', '10000000-0000-0000-0000-000000000001', 450000.00),
    -- Floor 2: Standard
    ('b0000000-0001-0000-0000-000000000213', NOW(), NOW(), 'D1-C213', 'Floor 2', 'AVAILABLE', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', '10000000-0000-0000-0000-000000000003', 2400000.00),
    ('b0000000-0001-0000-0000-000000000214', NOW(), NOW(), 'D1-C214', 'Floor 2', 'AVAILABLE', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', '10000000-0000-0000-0000-000000000003', 2400000.00),
    -- Floor 2: Cold Storage
    ('b0000000-0001-0000-0000-000000000215', NOW(), NOW(), 'D1-C215', 'Floor 2', 'AVAILABLE', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', '10000000-0000-0000-0000-000000000005', 3200000.00),
    ('b0000000-0001-0000-0000-000000000216', NOW(), NOW(), 'D1-C216', 'Floor 2', 'AVAILABLE', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', '10000000-0000-0000-0000-000000000005', 3200000.00),
    ('b0000000-0001-0000-0000-000000000217', NOW(), NOW(), 'D1-C217', 'Floor 2', 'AVAILABLE', 'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', '10000000-0000-0000-0000-000000000005', 3200000.00)
ON CONFLICT (id) DO UPDATE
SET unit_code = EXCLUDED.unit_code,
    floor_level = EXCLUDED.floor_level,
    status = EXCLUDED.status,
    facility_id = EXCLUDED.facility_id,
    unit_type_id = EXCLUDED.unit_type_id,
    price_per_month = EXCLUDED.price_per_month;

-- 3. Seed 14 Storage Units for HCM-D7 (District 7: 45e03ded-5da1-43d5-bea7-96c645d5f96c)
INSERT INTO storage_units (id, created_at, updated_at, unit_code, floor_level, status, facility_id, unit_type_id, price_per_month)
VALUES
    -- Floor 1: Mini
    ('b0000000-0007-0000-0000-000000000111', NOW(), NOW(), 'D7-A111', 'Floor 1', 'AVAILABLE', '45e03ded-5da1-43d5-bea7-96c645d5f96c', '10000000-0000-0000-0000-000000000001', 450000.00),
    ('b0000000-0007-0000-0000-000000000112', NOW(), NOW(), 'D7-A112', 'Floor 1', 'AVAILABLE', '45e03ded-5da1-43d5-bea7-96c645d5f96c', '10000000-0000-0000-0000-000000000001', 450000.00),
    -- Floor 1: Standard (1 occupied for sample active booking)
    ('b0000000-0007-0000-0000-000000000113', NOW(), NOW(), 'D7-B111', 'Floor 1', 'OCCUPIED',  '45e03ded-5da1-43d5-bea7-96c645d5f96c', '10000000-0000-0000-0000-000000000003', 2400000.00),
    ('b0000000-0007-0000-0000-000000000114', NOW(), NOW(), 'D7-B112', 'Floor 1', 'AVAILABLE', '45e03ded-5da1-43d5-bea7-96c645d5f96c', '10000000-0000-0000-0000-000000000003', 2400000.00),
    ('b0000000-0007-0000-0000-000000000117', NOW(), NOW(), 'D7-B115', 'Floor 1', 'AVAILABLE', '45e03ded-5da1-43d5-bea7-96c645d5f96c', '10000000-0000-0000-0000-000000000003', 2400000.00),
    -- Floor 1: Cold Storage
    ('b0000000-0007-0000-0000-000000000115', NOW(), NOW(), 'D7-B113', 'Floor 1', 'AVAILABLE', '45e03ded-5da1-43d5-bea7-96c645d5f96c', '10000000-0000-0000-0000-000000000005', 3200000.00),
    ('b0000000-0007-0000-0000-000000000116', NOW(), NOW(), 'D7-B114', 'Floor 1', 'AVAILABLE', '45e03ded-5da1-43d5-bea7-96c645d5f96c', '10000000-0000-0000-0000-000000000005', 3200000.00),
    -- Floor 2: Mini
    ('b0000000-0007-0000-0000-000000000213', NOW(), NOW(), 'D7-C213', 'Floor 2', 'AVAILABLE', '45e03ded-5da1-43d5-bea7-96c645d5f96c', '10000000-0000-0000-0000-000000000001', 450000.00),
    ('b0000000-0007-0000-0000-000000000214', NOW(), NOW(), 'D7-C214', 'Floor 2', 'AVAILABLE', '45e03ded-5da1-43d5-bea7-96c645d5f96c', '10000000-0000-0000-0000-000000000001', 450000.00),
    -- Floor 2: Standard
    ('b0000000-0007-0000-0000-000000000215', NOW(), NOW(), 'D7-C215', 'Floor 2', 'AVAILABLE', '45e03ded-5da1-43d5-bea7-96c645d5f96c', '10000000-0000-0000-0000-000000000003', 2400000.00),
    ('b0000000-0007-0000-0000-000000000216', NOW(), NOW(), 'D7-C216', 'Floor 2', 'AVAILABLE', '45e03ded-5da1-43d5-bea7-96c645d5f96c', '10000000-0000-0000-0000-000000000003', 2400000.00),
    -- Floor 2: Cold Storage (1 occupied for sample active cold booking)
    ('b0000000-0007-0000-0000-000000000217', NOW(), NOW(), 'D7-C217', 'Floor 2', 'OCCUPIED',  '45e03ded-5da1-43d5-bea7-96c645d5f96c', '10000000-0000-0000-0000-000000000005', 3200000.00),
    ('b0000000-0007-0000-0000-000000000218', NOW(), NOW(), 'D7-C218', 'Floor 2', 'AVAILABLE', '45e03ded-5da1-43d5-bea7-96c645d5f96c', '10000000-0000-0000-0000-000000000005', 3200000.00),
    ('b0000000-0007-0000-0000-000000000219', NOW(), NOW(), 'D7-C219', 'Floor 2', 'AVAILABLE', '45e03ded-5da1-43d5-bea7-96c645d5f96c', '10000000-0000-0000-0000-000000000005', 3200000.00)
ON CONFLICT (id) DO UPDATE
SET unit_code = EXCLUDED.unit_code,
    floor_level = EXCLUDED.floor_level,
    status = EXCLUDED.status,
    facility_id = EXCLUDED.facility_id,
    unit_type_id = EXCLUDED.unit_type_id,
    price_per_month = EXCLUDED.price_per_month;

-- 4. Seed 14 Storage Units for HCM-TD (Thu Duc: fd8f948e-fdff-4a81-ad0f-fc45639b545d)
INSERT INTO storage_units (id, created_at, updated_at, unit_code, floor_level, status, facility_id, unit_type_id, price_per_month)
VALUES
    -- Floor 1: Mini
    ('b0000000-000d-0000-0000-000000000113', NOW(), NOW(), 'TD-A113', 'Floor 1', 'AVAILABLE', 'fd8f948e-fdff-4a81-ad0f-fc45639b545d', '10000000-0000-0000-0000-000000000001', 450000.00),
    ('b0000000-000d-0000-0000-000000000114', NOW(), NOW(), 'TD-A114', 'Floor 1', 'AVAILABLE', 'fd8f948e-fdff-4a81-ad0f-fc45639b545d', '10000000-0000-0000-0000-000000000001', 450000.00),
    -- Floor 1: Standard
    ('b0000000-000d-0000-0000-000000000115', NOW(), NOW(), 'TD-B113', 'Floor 1', 'AVAILABLE', 'fd8f948e-fdff-4a81-ad0f-fc45639b545d', '10000000-0000-0000-0000-000000000003', 2400000.00),
    ('b0000000-000d-0000-0000-000000000116', NOW(), NOW(), 'TD-B114', 'Floor 1', 'AVAILABLE', 'fd8f948e-fdff-4a81-ad0f-fc45639b545d', '10000000-0000-0000-0000-000000000003', 2400000.00),
    ('b0000000-000d-0000-0000-000000000119', NOW(), NOW(), 'TD-B117', 'Floor 1', 'AVAILABLE', 'fd8f948e-fdff-4a81-ad0f-fc45639b545d', '10000000-0000-0000-0000-000000000003', 2400000.00),
    -- Floor 1: Cold Storage (1 overdue locked for sample overdue booking)
    ('b0000000-000d-0000-0000-000000000117', NOW(), NOW(), 'TD-B115', 'Floor 1', 'AVAILABLE',      'fd8f948e-fdff-4a81-ad0f-fc45639b545d', '10000000-0000-0000-0000-000000000005', 3200000.00),
    ('b0000000-000d-0000-0000-000000000118', NOW(), NOW(), 'TD-B116', 'Floor 1', 'OVERDUE_LOCKED', 'fd8f948e-fdff-4a81-ad0f-fc45639b545d', '10000000-0000-0000-0000-000000000005', 3200000.00),
    -- Floor 2: Mini
    ('b0000000-000d-0000-0000-000000000213', NOW(), NOW(), 'TD-C213', 'Floor 2', 'AVAILABLE', 'fd8f948e-fdff-4a81-ad0f-fc45639b545d', '10000000-0000-0000-0000-000000000001', 450000.00),
    ('b0000000-000d-0000-0000-000000000214', NOW(), NOW(), 'TD-C214', 'Floor 2', 'AVAILABLE', 'fd8f948e-fdff-4a81-ad0f-fc45639b545d', '10000000-0000-0000-0000-000000000001', 450000.00),
    -- Floor 2: Standard
    ('b0000000-000d-0000-0000-000000000215', NOW(), NOW(), 'TD-C215', 'Floor 2', 'AVAILABLE', 'fd8f948e-fdff-4a81-ad0f-fc45639b545d', '10000000-0000-0000-0000-000000000003', 2400000.00),
    ('b0000000-000d-0000-0000-000000000216', NOW(), NOW(), 'TD-C216', 'Floor 2', 'AVAILABLE', 'fd8f948e-fdff-4a81-ad0f-fc45639b545d', '10000000-0000-0000-0000-000000000003', 2400000.00),
    -- Floor 2: Cold Storage
    ('b0000000-000d-0000-0000-000000000217', NOW(), NOW(), 'TD-C217', 'Floor 2', 'AVAILABLE', 'fd8f948e-fdff-4a81-ad0f-fc45639b545d', '10000000-0000-0000-0000-000000000005', 3200000.00),
    ('b0000000-000d-0000-0000-000000000218', NOW(), NOW(), 'TD-C218', 'Floor 2', 'AVAILABLE', 'fd8f948e-fdff-4a81-ad0f-fc45639b545d', '10000000-0000-0000-0000-000000000005', 3200000.00),
    ('b0000000-000d-0000-0000-000000000219', NOW(), NOW(), 'TD-C219', 'Floor 2', 'AVAILABLE', 'fd8f948e-fdff-4a81-ad0f-fc45639b545d', '10000000-0000-0000-0000-000000000005', 3200000.00)
ON CONFLICT (id) DO UPDATE
SET unit_code = EXCLUDED.unit_code,
    floor_level = EXCLUDED.floor_level,
    status = EXCLUDED.status,
    facility_id = EXCLUDED.facility_id,
    unit_type_id = EXCLUDED.unit_type_id,
    price_per_month = EXCLUDED.price_per_month;

-- 5. Seed 4 Sample Bookings for user 'customer'
-- Resolve customer UUID (default fallback to 4c617ecc-d66b-4d81-9a63-49afc11068b3)
DO $$
DECLARE
    v_customer_id UUID;
    v_staff_d1 UUID := '0f3386ad-0ff9-4c8f-b01b-7a8f783c7afc';
    v_staff_d7 UUID := 'bce331ef-5656-4fa6-bb19-8528a10e9671';
    v_staff_td UUID := 'e0000000-0000-0000-0000-000000000005';
BEGIN
    SELECT id INTO v_customer_id FROM users WHERE username = 'customer' LIMIT 1;
    IF v_customer_id IS NULL THEN
        v_customer_id := '4c617ecc-d66b-4d81-9a63-49afc11068b3'::uuid;
    END IF;

    -- Booking 1: CONFIRMED (Chờ nhận kho) at HCM-D1 (D1-B114 Cold Storage)
    INSERT INTO bookings (
        id, created_at, updated_at, booking_code, customer_id, storage_unit_id,
        start_date, end_date, rental_months, total_rental_fee, deposit_paid, deposit_amount,
        status, access_code, access_pin, qr_access_token, pin_updated_at, payment_expires_at
    )
    VALUES (
        'c0000000-0000-0000-0000-000000000021', NOW() - INTERVAL '3 hours', NOW(),
        'BX-2026-CONF-D101', v_customer_id, 'b0000000-0001-0000-0000-000000000116',
        CURRENT_DATE + INTERVAL '1 day', CURRENT_DATE + INTERVAL '91 days',
        3, 9600000.00, 3200000.00, 3200000.00,
        'CONFIRMED', 'BX-90021', '628194', 'QR-BX-CONF-D1B114', NOW(), NULL
    )
    ON CONFLICT (id) DO UPDATE SET
        customer_id = EXCLUDED.customer_id,
        status = EXCLUDED.status,
        access_pin = EXCLUDED.access_pin,
        start_date = EXCLUDED.start_date,
        end_date = EXCLUDED.end_date;

    -- Booking 2: ACTIVE (Đang thuê) at HCM-D7 (D7-B111 Standard 6.0m2)
    INSERT INTO bookings (
        id, created_at, updated_at, booking_code, customer_id, storage_unit_id,
        start_date, end_date, rental_months, total_rental_fee, deposit_paid, deposit_amount,
        status, access_code, access_pin, qr_access_token, pin_updated_at,
        handed_over_by_staff_id, handover_time
    )
    VALUES (
        'c0000000-0000-0000-0000-000000000022', NOW() - INTERVAL '30 days', NOW(),
        'BX-2026-ACT-D701', v_customer_id, 'b0000000-0007-0000-0000-000000000113',
        CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE + INTERVAL '150 days',
        6, 14400000.00, 2400000.00, 2400000.00,
        'ACTIVE', 'BX-90022', '839120', 'QR-BX-ACT-D7B111', NOW() - INTERVAL '30 days',
        v_staff_d7, NOW() - INTERVAL '30 days'
    )
    ON CONFLICT (id) DO UPDATE SET
        customer_id = EXCLUDED.customer_id,
        status = EXCLUDED.status,
        access_pin = EXCLUDED.access_pin,
        start_date = EXCLUDED.start_date,
        end_date = EXCLUDED.end_date;

    -- Booking 3: OVERDUE (Quá hạn) at HCM-TD (TD-B116 Cold Storage)
    INSERT INTO bookings (
        id, created_at, updated_at, booking_code, customer_id, storage_unit_id,
        start_date, end_date, rental_months, total_rental_fee, deposit_paid, deposit_amount,
        status, access_code, access_pin, qr_access_token, pin_updated_at,
        handed_over_by_staff_id, handover_time
    )
    VALUES (
        'c0000000-0000-0000-0000-000000000023', NOW() - INTERVAL '185 days', NOW(),
        'BX-2026-OVD-TD01', v_customer_id, 'b0000000-000d-0000-0000-000000000118',
        CURRENT_DATE - INTERVAL '185 days', CURRENT_DATE - INTERVAL '5 days',
        6, 19200000.00, 3200000.00, 3200000.00,
        'OVERDUE', 'BX-90023', '552194', 'QR-BX-OVD-TDB116', NOW() - INTERVAL '185 days',
        v_staff_td, NOW() - INTERVAL '185 days'
    )
    ON CONFLICT (id) DO UPDATE SET
        customer_id = EXCLUDED.customer_id,
        status = EXCLUDED.status,
        access_pin = EXCLUDED.access_pin,
        start_date = EXCLUDED.start_date,
        end_date = EXCLUDED.end_date;

    -- Booking 4: ACTIVE (Đang thuê kho lạnh) at HCM-D7 (D7-C217 Cold Storage Floor 2)
    INSERT INTO bookings (
        id, created_at, updated_at, booking_code, customer_id, storage_unit_id,
        start_date, end_date, rental_months, total_rental_fee, deposit_paid, deposit_amount,
        status, access_code, access_pin, qr_access_token, pin_updated_at,
        handed_over_by_staff_id, handover_time
    )
    VALUES (
        'c0000000-0000-0000-0000-000000000024', NOW() - INTERVAL '15 days', NOW(),
        'BX-2026-ACT-D702', v_customer_id, 'b0000000-0007-0000-0000-000000000217',
        CURRENT_DATE - INTERVAL '15 days', CURRENT_DATE + INTERVAL '350 days',
        12, 38400000.00, 3200000.00, 3200000.00,
        'ACTIVE', 'BX-90024', '918234', 'QR-BX-ACT-D7C217', NOW() - INTERVAL '15 days',
        v_staff_d7, NOW() - INTERVAL '15 days'
    )
    ON CONFLICT (id) DO UPDATE SET
        customer_id = EXCLUDED.customer_id,
        status = EXCLUDED.status,
        access_pin = EXCLUDED.access_pin,
        start_date = EXCLUDED.start_date,
        end_date = EXCLUDED.end_date;

    -- 6. Seed Rental Contracts for these 4 bookings
    -- Contract 1: PENDING_SIGNATURE for Booking 1 (CONFIRMED)
    INSERT INTO rental_contracts (
        id, created_at, updated_at, contract_code, customer_id, unit_id, facility_id, booking_id,
        start_date, end_date, monthly_fee, deposit_held, status, signed_document_url
    )
    VALUES (
        'd0000000-0000-0000-0000-000000000021', NOW() - INTERVAL '3 hours', NOW(),
        'CTR-2026-CONF-001', v_customer_id, 'b0000000-0001-0000-0000-000000000116',
        'f7af2794-0d0d-4c68-9e36-c44bf3034f6c', 'c0000000-0000-0000-0000-000000000021',
        CURRENT_DATE + INTERVAL '1 day', CURRENT_DATE + INTERVAL '91 days',
        3200000.00, 3200000.00, 'PENDING_SIGNATURE', 'https://boxora.vn/contracts/pending/CTR-2026-CONF-001.pdf'
    )
    ON CONFLICT (id) DO UPDATE SET
        customer_id = EXCLUDED.customer_id,
        status = EXCLUDED.status,
        start_date = EXCLUDED.start_date,
        end_date = EXCLUDED.end_date;

    -- Contract 2: ACTIVE for Booking 2 (ACTIVE)
    INSERT INTO rental_contracts (
        id, created_at, updated_at, contract_code, customer_id, unit_id, facility_id, booking_id,
        start_date, end_date, monthly_fee, deposit_held, status, signed_document_url, signed_at
    )
    VALUES (
        'd0000000-0000-0000-0000-000000000022', NOW() - INTERVAL '30 days', NOW(),
        'CTR-2026-ACT-002', v_customer_id, 'b0000000-0007-0000-0000-000000000113',
        '45e03ded-5da1-43d5-bea7-96c645d5f96c', 'c0000000-0000-0000-0000-000000000022',
        CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE + INTERVAL '150 days',
        2400000.00, 2400000.00, 'ACTIVE', 'https://boxora.vn/contracts/signed/CTR-2026-ACT-002.pdf', NOW() - INTERVAL '30 days'
    )
    ON CONFLICT (id) DO UPDATE SET
        customer_id = EXCLUDED.customer_id,
        status = EXCLUDED.status,
        start_date = EXCLUDED.start_date,
        end_date = EXCLUDED.end_date;

    -- Contract 3: OVERDUE for Booking 3 (OVERDUE)
    INSERT INTO rental_contracts (
        id, created_at, updated_at, contract_code, customer_id, unit_id, facility_id, booking_id,
        start_date, end_date, monthly_fee, deposit_held, status, signed_document_url, signed_at
    )
    VALUES (
        'd0000000-0000-0000-0000-000000000023', NOW() - INTERVAL '185 days', NOW(),
        'CTR-2026-OVD-003', v_customer_id, 'b0000000-000d-0000-0000-000000000118',
        'fd8f948e-fdff-4a81-ad0f-fc45639b545d', 'c0000000-0000-0000-0000-000000000023',
        CURRENT_DATE - INTERVAL '185 days', CURRENT_DATE - INTERVAL '5 days',
        3200000.00, 3200000.00, 'OVERDUE', 'https://boxora.vn/contracts/signed/CTR-2026-OVD-003.pdf', NOW() - INTERVAL '185 days'
    )
    ON CONFLICT (id) DO UPDATE SET
        customer_id = EXCLUDED.customer_id,
        status = EXCLUDED.status,
        start_date = EXCLUDED.start_date,
        end_date = EXCLUDED.end_date;

    -- Contract 4: ACTIVE for Booking 4 (ACTIVE Cold)
    INSERT INTO rental_contracts (
        id, created_at, updated_at, contract_code, customer_id, unit_id, facility_id, booking_id,
        start_date, end_date, monthly_fee, deposit_held, status, signed_document_url, signed_at
    )
    VALUES (
        'd0000000-0000-0000-0000-000000000024', NOW() - INTERVAL '15 days', NOW(),
        'CTR-2026-ACT-004', v_customer_id, 'b0000000-0007-0000-0000-000000000217',
        '45e03ded-5da1-43d5-bea7-96c645d5f96c', 'c0000000-0000-0000-0000-000000000024',
        CURRENT_DATE - INTERVAL '15 days', CURRENT_DATE + INTERVAL '350 days',
        3200000.00, 3200000.00, 'ACTIVE', 'https://boxora.vn/contracts/signed/CTR-2026-ACT-004.pdf', NOW() - INTERVAL '15 days'
    )
    ON CONFLICT (id) DO UPDATE SET
        customer_id = EXCLUDED.customer_id,
        status = EXCLUDED.status,
        start_date = EXCLUDED.start_date,
        end_date = EXCLUDED.end_date;

    -- 7. Seed Payments for Bookings & Contracts
    -- Payment for Booking 1 (Deposit Paid)
    INSERT INTO payments (
        id, created_at, updated_at, transaction_id, booking_id, contract_id,
        amount, payment_type, status, payment_method, payment_time
    )
    VALUES (
        'f0000000-0000-0000-0000-000000000021', NOW() - INTERVAL '3 hours', NOW(),
        'TXN-2026-CONF-DEP', 'c0000000-0000-0000-0000-000000000021', 'd0000000-0000-0000-0000-000000000021',
        3200000.00, 'DEPOSIT', 'PAID', 'VNPAY', NOW() - INTERVAL '3 hours'
    )
    ON CONFLICT (id) DO NOTHING;

    -- Payments for Booking 2 (Deposit & 6-month Rental Paid)
    INSERT INTO payments (
        id, created_at, updated_at, transaction_id, booking_id, contract_id,
        amount, payment_type, status, payment_method, payment_time
    )
    VALUES
        ('f0000000-0000-0000-0000-000000000022', NOW() - INTERVAL '30 days', NOW(), 'TXN-2026-ACT-DEP', 'c0000000-0000-0000-0000-000000000022', 'd0000000-0000-0000-0000-000000000022', 2400000.00, 'DEPOSIT', 'PAID', 'VNPAY', NOW() - INTERVAL '30 days'),
        ('f0000000-0000-0000-0000-000000000023', NOW() - INTERVAL '30 days', NOW(), 'TXN-2026-ACT-RENT', 'c0000000-0000-0000-0000-000000000022', 'd0000000-0000-0000-0000-000000000022', 14400000.00, 'RENTAL_FEE', 'PAID', 'VNPAY', NOW() - INTERVAL '30 days')
    ON CONFLICT (id) DO NOTHING;

    -- Payments for Booking 3 (Initial Deposit & Rental Paid, now Overdue)
    INSERT INTO payments (
        id, created_at, updated_at, transaction_id, booking_id, contract_id,
        amount, payment_type, status, payment_method, payment_time
    )
    VALUES
        ('f0000000-0000-0000-0000-000000000024', NOW() - INTERVAL '185 days', NOW(), 'TXN-2026-OVD-DEP', 'c0000000-0000-0000-0000-000000000023', 'd0000000-0000-0000-0000-000000000023', 3200000.00, 'DEPOSIT', 'PAID', 'BANK_TRANSFER', NOW() - INTERVAL '185 days'),
        ('f0000000-0000-0000-0000-000000000025', NOW() - INTERVAL '185 days', NOW(), 'TXN-2026-OVD-RENT', 'c0000000-0000-0000-0000-000000000023', 'd0000000-0000-0000-0000-000000000023', 19200000.00, 'RENTAL_FEE', 'PAID', 'BANK_TRANSFER', NOW() - INTERVAL '185 days')
    ON CONFLICT (id) DO NOTHING;

    -- Payments for Booking 4 (Deposit & 12-month Rental Paid)
    INSERT INTO payments (
        id, created_at, updated_at, transaction_id, booking_id, contract_id,
        amount, payment_type, status, payment_method, payment_time
    )
    VALUES
        ('f0000000-0000-0000-0000-000000000026', NOW() - INTERVAL '15 days', NOW(), 'TXN-2026-ACT2-DEP', 'c0000000-0000-0000-0000-000000000024', 'd0000000-0000-0000-0000-000000000024', 3200000.00, 'DEPOSIT', 'PAID', 'MOMO', NOW() - INTERVAL '15 days'),
        ('f0000000-0000-0000-0000-000000000027', NOW() - INTERVAL '15 days', NOW(), 'TXN-2026-ACT2-RENT', 'c0000000-0000-0000-0000-000000000024', 'd0000000-0000-0000-0000-000000000024', 38400000.00, 'RENTAL_FEE', 'PAID', 'MOMO', NOW() - INTERVAL '15 days')
    ON CONFLICT (id) DO NOTHING;

END $$;


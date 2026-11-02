-- ====================================================================
-- SEED DISTRICT 2 (QUAN 2) FACILITY DATA FOR USER f@gmail.com
-- Reference Date: 2026-11-02
-- ====================================================================

DO $$
DECLARE
    v_facility_id UUID := '164a297c-8f96-4102-9e0e-ed9339121902';
    v_customer_id UUID;
    v_customer_name VARCHAR(150);
    v_customer_phone VARCHAR(20);
    v_staff_id UUID;
    v_type_mini UUID := '10000000-0000-0000-0000-000000000001';
    v_type_vua UUID := '10000000-0000-0000-0000-000000000002';
    v_type_compact UUID := 'dd168b92-ebdd-4e84-a6e1-7715b4745a26';
    v_type_tieuchuan UUID := '10000000-0000-0000-0000-000000000003';
    v_type_kholanh UUID := '10000000-0000-0000-0000-000000000005';
    v_type_ratlon UUID := '10000000-0000-0000-0000-000000000004';
    
    v_unit_id UUID;
    v_booking_id UUID;
    v_contract_id UUID;
    v_unit_type UUID;
    v_fee NUMERIC(15,2);
    v_end_date DATE;
    v_start_date DATE;
    v_status VARCHAR(30);
    v_pin_status VARCHAR(40);
    v_sealing_status VARCHAR(40);
    v_code_prefix VARCHAR(20);
    v_unit_code VARCHAR(50);
    i INT;
    grp INT;
BEGIN
    -- 1. Get customer f@gmail.com
    SELECT id, full_name, phone INTO v_customer_id, v_customer_name, v_customer_phone
    FROM users WHERE email = 'f@gmail.com';
    
    IF v_customer_id IS NULL THEN
        RAISE EXCEPTION 'User f@gmail.com not found!';
    END IF;

    -- Update f@gmail.com facility_id to District 2
    UPDATE users SET facility_id = v_facility_id WHERE id = v_customer_id;

    -- Get a manager/staff ID for logging
    SELECT id INTO v_staff_id FROM users WHERE email = 'business@gmail.com' LIMIT 1;
    IF v_staff_id IS NULL THEN
        SELECT id INTO v_staff_id FROM users WHERE role_id = (SELECT id FROM roles WHERE name = 'ADMIN') LIMIT 1;
    END IF;

    -- Clean up any existing units/contracts for District 2 to avoid conflicts
    DELETE FROM overdue_notice_logs WHERE contract_id IN (SELECT id FROM rental_contracts WHERE facility_id = v_facility_id);
    DELETE FROM overdue_audit_logs WHERE contract_id IN (SELECT id FROM rental_contracts WHERE facility_id = v_facility_id);
    DELETE FROM rental_contracts WHERE facility_id = v_facility_id;
    DELETE FROM bookings WHERE facility_id = v_facility_id;
    DELETE FROM storage_unit_price_histories WHERE storage_unit_id IN (SELECT id FROM storage_units WHERE facility_id = v_facility_id);
    DELETE FROM storage_units WHERE facility_id = v_facility_id;

    -- ====================================================================
    -- 2. CREATE 40 OCCUPIED UNITS & ACTIVE/OVERDUE CONTRACTS FOR f@gmail.com
    -- 8 Groups x 5 Units/Contracts = 40
    -- ====================================================================

    -- Groups definition:
    -- grp = 1: Hết hạn trong 3 ngày tới -> 2026-11-05
    -- grp = 2: Hết hạn trong 2 ngày tới -> 2026-11-04
    -- grp = 3: Hết hạn trong 1 ngày tới -> 2026-11-03
    -- grp = 4: Hết hạn trong hôm nay   -> 2026-11-02
    -- grp = 5: Ân hạn (1 ngày quá hạn) -> 2026-11-01
    -- grp = 6: Cảnh báo (2 ngày quá hạn) -> 2026-10-31
    -- grp = 7: Thu hồi PIN (4 ngày quá hạn) -> 2026-10-29
    -- grp = 8: Đủ ĐK Niêm phong (8 ngày quá hạn) -> 2026-10-25

    FOR grp IN 1..8 LOOP
        IF grp = 1 THEN
            v_end_date := '2026-11-05';
            v_code_prefix := 'EXP3D';
            v_status := 'ACTIVE';
            v_pin_status := 'PIN_ACTIVE';
            v_sealing_status := 'NONE';
        ELSIF grp = 2 THEN
            v_end_date := '2026-11-04';
            v_code_prefix := 'EXP2D';
            v_status := 'ACTIVE';
            v_pin_status := 'PIN_ACTIVE';
            v_sealing_status := 'NONE';
        ELSIF grp = 3 THEN
            v_end_date := '2026-11-03';
            v_code_prefix := 'EXP1D';
            v_status := 'ACTIVE';
            v_pin_status := 'PIN_ACTIVE';
            v_sealing_status := 'NONE';
        ELSIF grp = 4 THEN
            v_end_date := '2026-11-02';
            v_code_prefix := 'EXPTODAY';
            v_status := 'ACTIVE';
            v_pin_status := 'PIN_ACTIVE';
            v_sealing_status := 'NONE';
        ELSIF grp = 5 THEN
            v_end_date := '2026-11-01';
            v_code_prefix := 'GRACE';
            v_status := 'OVERDUE';
            v_pin_status := 'PIN_ACTIVE';
            v_sealing_status := 'NONE';
        ELSIF grp = 6 THEN
            v_end_date := '2026-10-31';
            v_code_prefix := 'WARN';
            v_status := 'OVERDUE';
            v_pin_status := 'PIN_ACTIVE';
            v_sealing_status := 'NONE';
        ELSIF grp = 7 THEN
            v_end_date := '2026-10-29';
            v_code_prefix := 'PINREV';
            v_status := 'OVERDUE_LOCKED';
            v_pin_status := 'PIN_REVOKED';
            v_sealing_status := 'NONE';
        ELSIF grp = 8 THEN
            v_end_date := '2026-10-25';
            v_code_prefix := 'SEAL';
            v_status := 'OVERDUE_LOCKED';
            v_pin_status := 'PIN_REVOKED';
            v_sealing_status := 'SEALING_REQUESTED';
        END IF;

        v_start_date := v_end_date - INTERVAL '6 months';

        FOR i IN 1..5 LOOP
            -- Determine unit code and floor
            IF grp <= 4 THEN
                v_unit_code := 'Q2-T1-' || v_code_prefix || LPAD(i::text, 2, '0');
            ELSE
                v_unit_code := 'Q2-T2-' || v_code_prefix || LPAD(i::text, 2, '0');
            END IF;

            -- Assign unit types rotation
            IF (i = 1) THEN
                v_unit_type := v_type_mini;
                v_fee := 350000.00;
            ELSIF (i = 2) THEN
                v_unit_type := v_type_vua;
                v_fee := 1850000.00;
            ELSIF (i = 3) THEN
                v_unit_type := v_type_compact;
                v_fee := 1250000.00;
            ELSIF (i = 4) THEN
                v_unit_type := v_type_tieuchuan;
                v_fee := 3500000.00;
            ELSE
                v_unit_type := v_type_kholanh;
                v_fee := 3100000.00;
            END IF;

            v_unit_id := gen_random_uuid();
            v_booking_id := gen_random_uuid();
            v_contract_id := gen_random_uuid();

            -- Create Storage Unit (Status: OCCUPIED)
            INSERT INTO storage_units (
                id, created_at, updated_at, unit_code, floor_level,
                status, price_per_month, facility_id, unit_type_id
            ) VALUES (
                v_unit_id, NOW(), NOW(), v_unit_code,
                CASE WHEN grp <= 4 THEN 'Tầng 1' ELSE 'Tầng 2' END,
                'OCCUPIED', v_fee, v_facility_id, v_unit_type
            );

            -- Create Booking
            INSERT INTO bookings (
                id, created_at, updated_at, booking_code,
                customer_id, storage_unit_id, facility_id, unit_type_id,
                start_date, end_date, rental_months,
                total_rental_fee, deposit_paid, deposit_amount,
                status, payment_status, contract_signed,
                access_code, access_pin
            ) VALUES (
                v_booking_id, v_start_date, NOW(), 'BK-Q2-' || v_code_prefix || '-' || LPAD(i::text, 2, '0'),
                v_customer_id, v_unit_id, v_facility_id, v_unit_type,
                v_start_date, v_end_date, 6,
                v_fee * 6, v_fee, v_fee,
                'ACTIVE', 'PAID', TRUE,
                '654321', '654321'
            );

            -- Create Rental Contract
            INSERT INTO rental_contracts (
                id, created_at, updated_at, contract_code,
                customer_id, unit_id, facility_id, booking_id,
                start_date, end_date, monthly_fee, deposit_held,
                status, overdue_pin_status, overdue_sealing_status,
                smart_lock_online_status, smart_lock_is_mock, is_demo
            ) VALUES (
                v_contract_id, v_start_date, NOW(), 'CTR-Q2-' || v_code_prefix || '-' || LPAD(i::text, 2, '0'),
                v_customer_id, v_unit_id, v_facility_id, v_booking_id,
                v_start_date, v_end_date, v_fee, v_fee,
                v_status, v_pin_status, v_sealing_status,
                'ONLINE', TRUE, FALSE
            );

            -- Create initial audit log for contract creation
            INSERT INTO overdue_audit_logs (
                id, contract_id, performed_by_id, performed_by_name,
                performed_by_role, action, before_state, after_state,
                details, created_at
            ) VALUES (
                gen_random_uuid(), v_contract_id, v_staff_id, 'System Manager',
                'BUSINESS_MANAGER', 'CONTRACT_CREATED', NULL, v_status,
                'Khởi tạo hợp đồng thuê kho ' || v_unit_code || ' cho khách hàng f@gmail.com', v_start_date
            );

            -- For Overdue Contracts, record stage-specific notice logs and audit trails
            IF grp = 6 THEN -- WARNING
                INSERT INTO overdue_audit_logs (
                    id, contract_id, performed_by_id, performed_by_name,
                    performed_by_role, action, before_state, after_state,
                    details, created_at
                ) VALUES (
                    gen_random_uuid(), v_contract_id, v_staff_id, 'Hệ thống Boxora',
                    'SYSTEM', 'OVERDUE_ENTERED_WARNING', 'GRACE_PERIOD', 'WARNING',
                    'Hết thời gian ân hạn 1 ngày. Chuyển sang giai đoạn cảnh báo nhắc nợ.', '2026-11-01 08:00:00'
                );
            ELSIF grp = 7 THEN -- PIN REVOCATION
                INSERT INTO overdue_audit_logs (
                    id, contract_id, performed_by_id, performed_by_name,
                    performed_by_role, action, before_state, after_state,
                    details, created_at
                ) VALUES (
                    gen_random_uuid(), v_contract_id, v_staff_id, 'Hệ thống Boxora',
                    'SYSTEM', 'PIN_REVOCATION_AUTO', 'PIN_ACTIVE', 'PIN_REVOKED',
                    'Tự động thu hồi mã PIN kho # ' || v_unit_code || ' do quá hạn 4 ngày.', '2026-10-31 09:00:00'
                );
            ELSIF grp = 8 THEN -- SEALING ELIGIBLE
                INSERT INTO overdue_audit_logs (
                    id, contract_id, performed_by_id, performed_by_name,
                    performed_by_role, action, before_state, after_state,
                    details, created_at
                ) VALUES (
                    gen_random_uuid(), v_contract_id, v_staff_id, 'System Manager',
                    'BUSINESS_MANAGER', 'SEALING_REQUEST_CREATED', 'NONE', 'SEALING_REQUESTED',
                    'Lập đề xuất niêm phong buồng kho ' || v_unit_code || ' do quá hạn 8 ngày.', '2026-11-01 10:30:00'
                );
            END IF;
        END LOOP;
    END LOOP;

    -- ====================================================================
    -- 3. CREATE ADDITIONAL UNITS (12 units) WITH DIFFERENT STATUSES
    -- 6 AVAILABLE, 3 UNDER_MAINTENANCE, 3 RESERVED
    -- Total units for District 2 facility = 40 + 12 = 52 units
    -- ====================================================================

    -- 6 Available Units on Floor 1
    FOR i IN 1..6 LOOP
        INSERT INTO storage_units (
            id, created_at, updated_at, unit_code, floor_level,
            status, price_per_month, facility_id, unit_type_id
        ) VALUES (
            gen_random_uuid(), NOW(), NOW(), 'Q2-T1-AVL' || LPAD(i::text, 2, '0'), 'Tầng 1',
            'AVAILABLE', 1250000.00, v_facility_id, v_type_compact
        );
    END LOOP;

    -- 3 Maintenance Units on Floor 2
    FOR i IN 1..3 LOOP
        INSERT INTO storage_units (
            id, created_at, updated_at, unit_code, floor_level,
            status, price_per_month, facility_id, unit_type_id
        ) VALUES (
            gen_random_uuid(), NOW(), NOW(), 'Q2-T2-MNT' || LPAD(i::text, 2, '0'), 'Tầng 2',
            'UNDER_MAINTENANCE', 3500000.00, v_facility_id, v_type_tieuchuan
        );
    END LOOP;

    -- 3 Reserved Units on Floor 2
    FOR i IN 1..3 LOOP
        INSERT INTO storage_units (
            id, created_at, updated_at, unit_code, floor_level,
            status, price_per_month, facility_id, unit_type_id
        ) VALUES (
            gen_random_uuid(), NOW(), NOW(), 'Q2-T2-RSV' || LPAD(i::text, 2, '0'), 'Tầng 2',
            'RESERVED', 5000000.00, v_facility_id, v_type_ratlon
        );
    END LOOP;

    RAISE NOTICE 'Successfully seeded District 2 facility with 52 units and 40 contracts for f@gmail.com!';
END $$;

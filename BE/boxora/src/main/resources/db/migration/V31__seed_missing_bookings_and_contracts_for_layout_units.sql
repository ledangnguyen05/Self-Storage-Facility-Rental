-- =========================================================================
-- V31: Seed Missing Bookings & Contracts for Layout Storage Units (P-01 & Layout Fix)
--      Ensures all RESERVED, OCCUPIED, and OVERDUE units have valid customers,
--      active or confirmed bookings, and associated rental contracts so that
--      Tenant Name, Contract Code, and Rental Due Date are fully populated.
-- =========================================================================

DO $$
DECLARE
    r RECORD;
    v_customers UUID[] := ARRAY[
        'e0000000-0000-0000-0000-000000000007'::uuid, -- Tran Minh Tuan
        'e0000000-0000-0000-0000-000000000008'::uuid, -- Le Thi Hoang Yen
        'e0000000-0000-0000-0000-000000000009'::uuid, -- Hoang Nam Anh
        'e0000000-0000-0000-0000-000000000010'::uuid, -- Pham Mai Phuong
        'e0000000-0000-0000-0000-000000000011'::uuid, -- Vu Duc Thang
        'cd45b91a-5267-4478-aa59-f6f37e678344'::uuid, -- System Customer
        'e0000000-0000-0000-0000-000000000098'::uuid  -- Nguyen Gia Huy
    ];
    v_cust_idx INT := 1;
    v_cust_id UUID;
    v_staff_id UUID;
    v_booking_id UUID;
    v_contract_id UUID;
    v_fee NUMERIC;
    v_bcode VARCHAR(30);
    v_ccode VARCHAR(50);
    v_start DATE;
    v_end DATE;
    v_b_status VARCHAR(30);
    v_c_status VARCHAR(30);
    v_signed_at TIMESTAMP;
BEGIN
    FOR r IN (
        SELECT su.id, su.unit_code, su.status, su.facility_id, COALESCE(su.price_per_month, 1250000.00) AS price
        FROM storage_units su
        LEFT JOIN bookings b ON b.storage_unit_id = su.id
        LEFT JOIN rental_contracts rc ON rc.unit_id = su.id
        WHERE su.status IN ('RESERVED', 'OCCUPIED', 'OVERDUE_LOCKED')
          AND b.id IS NULL
          AND rc.id IS NULL
        ORDER BY su.unit_code
    ) LOOP
        -- Distribute customers cleanly; specific assignment for TD-A111 to Tran Minh Tuan
        IF r.unit_code = 'TD-A111' THEN
            v_cust_id := 'e0000000-0000-0000-0000-000000000007'::uuid; -- Tran Minh Tuan
        ELSE
            v_cust_id := v_customers[((v_cust_idx - 1) % array_length(v_customers, 1)) + 1];
            v_cust_idx := v_cust_idx + 1;
        END IF;

        -- Staff in that facility
        SELECT id INTO v_staff_id FROM users WHERE facility_id = r.facility_id LIMIT 1;
        IF v_staff_id IS NULL THEN
            SELECT id INTO v_staff_id FROM users LIMIT 1;
        END IF;

        v_booking_id := gen_random_uuid();
        v_contract_id := gen_random_uuid();
        v_fee := r.price;

        IF r.status = 'RESERVED' THEN
            v_bcode := 'BX-RES-' || replace(r.unit_code, '-', '');
            v_ccode := 'CTR-2026-RES-' || replace(r.unit_code, '-', '');
            v_b_status := 'CONFIRMED';
            v_c_status := 'PENDING_SIGNATURE';
            v_start := CURRENT_DATE + INTERVAL '1 day';
            v_end := CURRENT_DATE + INTERVAL '181 days';
            v_signed_at := NULL;
        ELSE
            v_bcode := 'BX-ACT-' || replace(r.unit_code, '-', '');
            v_ccode := 'CTR-2026-ACT-' || replace(r.unit_code, '-', '');
            v_b_status := 'ACTIVE';
            v_c_status := 'ACTIVE';
            v_start := CURRENT_DATE - INTERVAL '30 days';
            v_end := CURRENT_DATE + INTERVAL '150 days';
            v_signed_at := CURRENT_DATE - INTERVAL '30 days';
        END IF;

        -- Insert Booking
        INSERT INTO bookings (
            id, created_at, updated_at, booking_code, customer_id, storage_unit_id,
            start_date, end_date, rental_months, total_rental_fee, deposit_paid, deposit_amount,
            status, access_code, handed_over_by_staff_id, handover_time,
            access_pin, qr_access_token, pin_updated_at
        ) VALUES (
            v_booking_id, NOW(), NOW(), v_bcode, v_cust_id, r.id,
            v_start, v_end, 6, v_fee * 6, v_fee, v_fee,
            v_b_status, 'BX-' || floor(10000 + random() * 90000)::text,
            CASE WHEN r.status = 'OCCUPIED' THEN v_staff_id ELSE NULL END,
            CASE WHEN r.status = 'OCCUPIED' THEN (NOW() - INTERVAL '30 days') ELSE NULL END,
            floor(100000 + random() * 900000)::text,
            'QR-' || v_bcode, NOW()
        )
        ON CONFLICT (id) DO NOTHING;

        -- Insert Rental Contract
        INSERT INTO rental_contracts (
            id, created_at, updated_at, contract_code, customer_id, unit_id, facility_id, booking_id,
            start_date, end_date, monthly_fee, deposit_held, status, signed_document_url, signed_at
        ) VALUES (
            v_contract_id, NOW(), NOW(), v_ccode, v_cust_id, r.id, r.facility_id, v_booking_id,
            v_start, v_end, v_fee, v_fee, v_c_status,
            'https://boxora.vn/contracts/' || lower(v_c_status) || '/' || v_ccode || '.pdf',
            v_signed_at
        )
        ON CONFLICT (id) DO NOTHING;
    END LOOP;
END $$;

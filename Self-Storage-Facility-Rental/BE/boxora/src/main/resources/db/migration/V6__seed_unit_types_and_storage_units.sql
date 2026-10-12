-- V6: Seed unit types, storage units and initial contracts

-- 1. Seed Unit Types
INSERT INTO unit_types (id, created_at, updated_at, type_name, dimensions, area_sqm, base_price_per_month, deposit_amount)
VALUES
    ('11111111-1111-1111-1111-111111111101', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'Compact Studio S', '2.0m x 3.25m x 3.0m', 6.5, 1250000.00, 1250000.00),
    ('11111111-1111-1111-1111-111111111102', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'Standard Dry M', '2.0m x 4.0m x 3.0m', 8.0, 1950000.00, 1950000.00),
    ('11111111-1111-1111-1111-111111111103', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'Standard Roll-up', '2.5m x 4.0m x 3.0m', 10.0, 2450000.00, 2450000.00),
    ('11111111-1111-1111-1111-111111111104', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'Medium Roll-up', '3.0m x 4.0m x 3.0m', 12.0, 2950000.00, 2950000.00),
    ('11111111-1111-1111-1111-111111111105', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'Large Bulk Space', '3.0m x 5.0m x 3.8m', 15.0, 3850000.00, 3850000.00),
    ('11111111-1111-1111-1111-111111111106', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'High Ceiling Bulk', '4.0m x 5.0m x 3.8m', 20.0, 4950000.00, 4950000.00),
    ('11111111-1111-1111-1111-111111111107', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'Climate Cold (18°C-22°C)', '3.0m x 4.0m x 3.0m', 12.0, 3500000.00, 3500000.00)
ON CONFLICT (id) DO NOTHING;

-- 2. Seed Storage Units for District 1 (HCM-D1)
DO $$
DECLARE
    v_fac_d1 UUID;
    v_fac_d7 UUID;
    v_fac_td UUID;
    v_ut_s UUID := '11111111-1111-1111-1111-111111111101';
    v_ut_m UUID := '11111111-1111-1111-1111-111111111102';
    v_ut_rollup UUID := '11111111-1111-1111-1111-111111111103';
    v_ut_m_rollup UUID := '11111111-1111-1111-1111-111111111104';
    v_ut_large UUID := '11111111-1111-1111-1111-111111111105';
    v_ut_high UUID := '11111111-1111-1111-1111-111111111106';
    v_ut_cold UUID := '11111111-1111-1111-1111-111111111107';
    v_cust_id UUID;
    v_unit_id UUID;
BEGIN
    SELECT id INTO v_fac_d1 FROM facilities WHERE code = 'HCM-D1' LIMIT 1;
    SELECT id INTO v_fac_d7 FROM facilities WHERE code = 'HCM-D7' LIMIT 1;
    SELECT id INTO v_fac_td FROM facilities WHERE code = 'HCM-TD' LIMIT 1;
    SELECT id INTO v_cust_id FROM users WHERE username = 'customer' LIMIT 1;

    IF v_fac_d1 IS NOT NULL THEN
        -- Zone A (Floor 1)
        INSERT INTO storage_units (id, created_at, updated_at, unit_code, floor_level, status, facility_id, unit_type_id) VALUES
            (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'A-101', 'Floor 1', 'AVAILABLE', v_fac_d1, v_ut_s),
            (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'A-102', 'Floor 1', 'AVAILABLE', v_fac_d1, v_ut_s),
            (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'A-103', 'Floor 1', 'OCCUPIED', v_fac_d1, v_ut_m_rollup),
            (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'A-104', 'Floor 1', 'OCCUPIED', v_fac_d1, v_ut_m_rollup),
            (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'A-105', 'Floor 1', 'OCCUPIED', v_fac_d1, v_ut_m),
            (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'A-106', 'Floor 1', 'OCCUPIED', v_fac_d1, v_ut_m),
            (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'A-107', 'Floor 1', 'OCCUPIED', v_fac_d1, v_ut_m),
            (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'A-108', 'Floor 1', 'RESERVED', v_fac_d1, v_ut_m),
            (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'A-109', 'Floor 1', 'OCCUPIED', v_fac_d1, v_ut_large),
            (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'A-110', 'Floor 1', 'UNDER_MAINTENANCE', v_fac_d1, v_ut_large),
            (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'A-111', 'Floor 1', 'OCCUPIED', v_fac_d1, v_ut_rollup),
            (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'A-112', 'Floor 1', 'OCCUPIED', v_fac_d1, v_ut_rollup),
            (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'A-113', 'Floor 1', 'OCCUPIED', v_fac_d1, v_ut_rollup),
            (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'A-114', 'Floor 1', 'OCCUPIED', v_fac_d1, v_ut_rollup),
            (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'A-115', 'Floor 1', 'OCCUPIED', v_fac_d1, v_ut_rollup),
            (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'A-116', 'Floor 1', 'OCCUPIED', v_fac_d1, v_ut_m);

        -- Zone B (Floor 1)
        INSERT INTO storage_units (id, created_at, updated_at, unit_code, floor_level, status, facility_id, unit_type_id) VALUES
            (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'B-101', 'Floor 1', 'OCCUPIED', v_fac_d1, v_ut_high),
            (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'B-102', 'Floor 1', 'OCCUPIED', v_fac_d1, v_ut_high),
            (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'B-103', 'Floor 1', 'OCCUPIED', v_fac_d1, v_ut_large),
            (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'B-104', 'Floor 1', 'OCCUPIED', v_fac_d1, v_ut_large),
            (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'B-105', 'Floor 1', 'RESERVED', v_fac_d1, v_ut_m_rollup),
            (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'B-106', 'Floor 1', 'OCCUPIED', v_fac_d1, v_ut_m_rollup),
            (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'B-107', 'Floor 1', 'OCCUPIED', v_fac_d1, v_ut_m_rollup),
            (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'B-108', 'Floor 1', 'OCCUPIED', v_fac_d1, v_ut_m),
            (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'B-109', 'Floor 1', 'OCCUPIED', v_fac_d1, v_ut_m),
            (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'B-110', 'Floor 1', 'AVAILABLE', v_fac_d1, v_ut_m),
            (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'B-111', 'Floor 1', 'AVAILABLE', v_fac_d1, v_ut_m),
            (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'B-112', 'Floor 1', 'OCCUPIED', v_fac_d1, v_ut_large),
            (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'B-113', 'Floor 1', 'OCCUPIED', v_fac_d1, v_ut_large),
            (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'B-114', 'Floor 1', 'OCCUPIED', v_fac_d1, v_ut_large),
            (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'B-120', 'Floor 1', 'OCCUPIED', v_fac_d1, v_ut_high),
            (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'B-121', 'Floor 1', 'OCCUPIED', v_fac_d1, v_ut_high);

        -- Zone C (Floor 2 - Climate Controlled Cold)
        INSERT INTO storage_units (id, created_at, updated_at, unit_code, floor_level, status, facility_id, unit_type_id) VALUES
            (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'C-201', 'Floor 2', 'AVAILABLE', v_fac_d1, v_ut_cold),
            (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'C-202', 'Floor 2', 'AVAILABLE', v_fac_d1, v_ut_cold),
            (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'C-203', 'Floor 2', 'OCCUPIED', v_fac_d1, v_ut_cold),
            (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'C-204', 'Floor 2', 'OCCUPIED', v_fac_d1, v_ut_cold),
            (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'C-205', 'Floor 2', 'OCCUPIED', v_fac_d1, v_ut_cold),
            (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'C-206', 'Floor 2', 'UNDER_MAINTENANCE', v_fac_d1, v_ut_cold),
            (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'C-207', 'Floor 2', 'OCCUPIED', v_fac_d1, v_ut_cold),
            (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'C-208', 'Floor 2', 'AVAILABLE', v_fac_d1, v_ut_cold),
            (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'C-209', 'Floor 2', 'RESERVED', v_fac_d1, v_ut_cold),
            (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'C-210', 'Floor 2', 'OCCUPIED', v_fac_d1, v_ut_cold),
            (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'C-211', 'Floor 2', 'OCCUPIED', v_fac_d1, v_ut_cold),
            (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'C-212', 'Floor 2', 'AVAILABLE', v_fac_d1, v_ut_cold),
            (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'C-213', 'Floor 2', 'OCCUPIED', v_fac_d1, v_ut_cold),
            (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'C-214', 'Floor 2', 'OCCUPIED', v_fac_d1, v_ut_cold),
            (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'C-215', 'Floor 2', 'OCCUPIED', v_fac_d1, v_ut_cold),
            (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'C-216', 'Floor 2', 'AVAILABLE', v_fac_d1, v_ut_cold);
    END IF;

    -- Seed initial units for District 7 if exists
    IF v_fac_d7 IS NOT NULL THEN
        INSERT INTO storage_units (id, created_at, updated_at, unit_code, floor_level, status, facility_id, unit_type_id) VALUES
            (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'A-101', 'Floor 1', 'AVAILABLE', v_fac_d7, v_ut_s),
            (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'A-102', 'Floor 1', 'OCCUPIED', v_fac_d7, v_ut_m),
            (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'A-103', 'Floor 1', 'AVAILABLE', v_fac_d7, v_ut_rollup),
            (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'B-101', 'Floor 1', 'AVAILABLE', v_fac_d7, v_ut_large),
            (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'B-102', 'Floor 1', 'UNDER_MAINTENANCE', v_fac_d7, v_ut_high);
    END IF;

    -- Seed initial units for Thu Duc if exists
    IF v_fac_td IS NOT NULL THEN
        INSERT INTO storage_units (id, created_at, updated_at, unit_code, floor_level, status, facility_id, unit_type_id) VALUES
            (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'A-101', 'Floor 1', 'AVAILABLE', v_fac_td, v_ut_s),
            (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'A-102', 'Floor 1', 'OCCUPIED', v_fac_td, v_ut_m),
            (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'B-101', 'Floor 1', 'AVAILABLE', v_fac_td, v_ut_large);
    END IF;

    -- Seed active contracts for customer on A-103 and A-105 in District 1
    IF v_cust_id IS NOT NULL AND v_fac_d1 IS NOT NULL THEN
        SELECT id INTO v_unit_id FROM storage_units WHERE unit_code = 'A-103' AND facility_id = v_fac_d1 LIMIT 1;
        IF v_unit_id IS NOT NULL THEN
            INSERT INTO rental_contracts (id, created_at, updated_at, contract_code, customer_id, unit_id, facility_id, start_date, end_date, monthly_fee, deposit_held, status)
            VALUES (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'HD-2024-8891', v_cust_id, v_unit_id, v_fac_d1, CURRENT_DATE - INTERVAL '60 days', CURRENT_DATE + INTERVAL '120 days', 2950000.00, 2950000.00, 'ACTIVE');
        END IF;

        SELECT id INTO v_unit_id FROM storage_units WHERE unit_code = 'A-105' AND facility_id = v_fac_d1 LIMIT 1;
        IF v_unit_id IS NOT NULL THEN
            INSERT INTO rental_contracts (id, created_at, updated_at, contract_code, customer_id, unit_id, facility_id, start_date, end_date, monthly_fee, deposit_held, status)
            VALUES (gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'HD-2025-0102', v_cust_id, v_unit_id, v_fac_d1, CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE + INTERVAL '150 days', 1950000.00, 1950000.00, 'ACTIVE');
        END IF;
    END IF;
END $$;

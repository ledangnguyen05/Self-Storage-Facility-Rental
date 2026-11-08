-- =========================================================================
-- V117: Seed 3 Facility Managers and 5 Facility Staff for all facilities
-- Format:
-- Facility Manager:
--   Full Name: facility {index} {shortCode}
--   Email:     facility{index}{shortCode}@gmail.com
--   Role:      FACILITY_MANAGER (22222222-2222-2222-2222-222222222222)
-- Facility Staff:
--   Full Name: staff {index} {shortCode}
--   Email:     staff{index}{shortCode}@gmail.com
--   Role:      STAFF (44444444-4444-4444-4444-444444444444)
-- Password for all accounts: 123456 ($2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG)
-- =========================================================================

DO $$
DECLARE
    v_role_fm_id UUID := '22222222-2222-2222-2222-222222222222';
    v_role_staff_id UUID := '44444444-4444-4444-4444-444444444444';
    v_password VARCHAR(255) := '$2a$10$hMVUHe8WiMBj0XuOXrEQ0.wyoGmDycfNfG0czBbbWym/hf.7rYYyG'; -- 123456

    -- Record structure for facilities
    fac RECORD;
    v_short_code VARCHAR(10);
    v_fac_num INT := 0;

    -- Inner loop variables
    i INT;
    v_email VARCHAR(255);
    v_username VARCHAR(50);
    v_fullname VARCHAR(100);
    v_phone VARCHAR(20);
    v_user_id UUID;
    v_first_fm_id UUID;
BEGIN
    FOR fac IN 
        SELECT id, code, name 
        FROM facilities 
        ORDER BY 
            CASE 
                WHEN code = 'HCM-D1' THEN 1
                WHEN code = 'HCM-Q2' THEN 2
                WHEN code = 'BX0HCM-Q3' THEN 3
                WHEN code = 'HCM-TD' THEN 4
                WHEN code = 'HCM-TB' THEN 5
                WHEN code = 'HCM-VGP' THEN 6
                WHEN code = 'HCM-D7' THEN 7
                WHEN code = 'BX-HCM-VIN' THEN 8
                ELSE 99
            END, code
    LOOP
        v_fac_num := v_fac_num + 1;

        -- Map facility code to shortCode
        IF fac.code = 'HCM-D1' THEN
            v_short_code := 'q1';
        ELSIF fac.code = 'HCM-Q2' THEN
            v_short_code := 'q2';
        ELSIF fac.code = 'BX0HCM-Q3' THEN
            v_short_code := 'q3';
        ELSIF fac.code = 'HCM-D7' THEN
            v_short_code := 'q7';
        ELSIF fac.code = 'HCM-TB' THEN
            v_short_code := 'tb';
        ELSIF fac.code = 'HCM-TD' THEN
            v_short_code := 'td';
        ELSIF fac.code = 'HCM-VGP' THEN
            v_short_code := 'vgp';
        ELSIF fac.code = 'BX-HCM-VIN' THEN
            v_short_code := 'vin';
        ELSE
            v_short_code := LOWER(REGEXP_REPLACE(fac.code, '[^a-zA-Z0-9]', '', 'g'));
        END IF;

        v_first_fm_id := NULL;

        -- 1. Seed / Standardize 3 Facility Managers
        FOR i IN 1..3 LOOP
            v_email := 'facility' || i || v_short_code || '@gmail.com';
            v_username := 'facility' || i || '_' || v_short_code;
            v_fullname := 'facility ' || i || ' ' || v_short_code;
            v_phone := '037795' || LPAD(v_fac_num::TEXT, 2, '0') || LPAD(i::TEXT, 2, '0');

            SELECT id INTO v_user_id FROM users WHERE LOWER(email) = LOWER(v_email);

            IF v_user_id IS NOT NULL THEN
                UPDATE users SET
                    full_name = v_fullname,
                    password = v_password,
                    is_active = TRUE,
                    role_id = v_role_fm_id,
                    facility_id = fac.id,
                    updated_at = NOW()
                WHERE id = v_user_id;
            ELSE
                v_user_id := gen_random_uuid();
                INSERT INTO users (
                    id, created_at, updated_at, username, email, password, phone, full_name, is_active, role_id, facility_id
                ) VALUES (
                    v_user_id, NOW(), NOW(), v_username, v_email, v_password, v_phone, v_fullname, TRUE, v_role_fm_id, fac.id
                );
            END IF;

            IF i = 1 THEN
                v_first_fm_id := v_user_id;
            END IF;
        END LOOP;

        -- Set primary facility manager if not currently assigned
        UPDATE facilities
        SET manager_id = v_first_fm_id
        WHERE id = fac.id AND (manager_id IS NULL OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = facilities.manager_id));

        -- 2. Seed / Standardize 5 Facility Staff
        FOR i IN 1..5 LOOP
            v_email := 'staff' || i || v_short_code || '@gmail.com';
            v_username := 'staff' || i || '_' || v_short_code;
            v_fullname := 'staff ' || i || ' ' || v_short_code;
            v_phone := '037785' || LPAD(v_fac_num::TEXT, 2, '0') || LPAD(i::TEXT, 2, '0');

            SELECT id INTO v_user_id FROM users WHERE LOWER(email) = LOWER(v_email);

            IF v_user_id IS NOT NULL THEN
                UPDATE users SET
                    full_name = v_fullname,
                    password = v_password,
                    is_active = TRUE,
                    role_id = v_role_staff_id,
                    facility_id = fac.id,
                    updated_at = NOW()
                WHERE id = v_user_id;
            ELSE
                v_user_id := gen_random_uuid();
                INSERT INTO users (
                    id, created_at, updated_at, username, email, password, phone, full_name, is_active, role_id, facility_id
                ) VALUES (
                    v_user_id, NOW(), NOW(), v_username, v_email, v_password, v_phone, v_fullname, TRUE, v_role_staff_id, fac.id
                );
            END IF;
        END LOOP;

    END LOOP;
END $$;


-- =========================================================
-- EXPAND BOOKINGS.ACCESS_PIN FOR AES-256-GCM CIPHERTEXT
-- =========================================================

ALTER TABLE bookings ALTER COLUMN access_pin TYPE VARCHAR(255);

-- =========================================================
-- STORAGE UNIT PRICE HISTORIES (BR-RULE-011)
-- =========================================================

CREATE TABLE IF NOT EXISTS storage_unit_price_histories
(
    id               UUID           NOT NULL,
    created_at       TIMESTAMP      NOT NULL,
    updated_at       TIMESTAMP      NOT NULL,
    unit_type_id     UUID           NOT NULL,
    old_price        NUMERIC(12,2)  NOT NULL,
    new_price        NUMERIC(12,2)  NOT NULL,
    effective_from   TIMESTAMP      NOT NULL,
    effective_to     TIMESTAMP,
    reason           VARCHAR(255),
    changed_by_id    UUID,

    CONSTRAINT pk_storage_unit_price_histories PRIMARY KEY (id),

    CONSTRAINT fk_price_history_unit_type
        FOREIGN KEY (unit_type_id)
        REFERENCES unit_types(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_price_history_changed_by
        FOREIGN KEY (changed_by_id)
        REFERENCES users(id)
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_price_history_unit_type_id ON storage_unit_price_histories(unit_type_id);
CREATE INDEX IF NOT EXISTS idx_price_history_effective_from ON storage_unit_price_histories(effective_from);

-- =========================================================
-- SEED STANDARD UNIT TYPES IF NOT PRESENT
-- =========================================================

INSERT INTO unit_types (id, created_at, updated_at, type_name, dimensions, area_sqm, base_price_per_month, deposit_amount)
SELECT gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'Personal Locker (Mini Box)', '1.0m x 1.0m x 1.2m', 1.0, 450000.00, 450000.00
WHERE NOT EXISTS (SELECT 1 FROM unit_types WHERE type_name = 'Personal Locker (Mini Box)');

INSERT INTO unit_types (id, created_at, updated_at, type_name, dimensions, area_sqm, base_price_per_month, deposit_amount)
SELECT gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'Compact Studio Unit', '1.5m x 2.0m x 2.6m', 3.0, 1250000.00, 1250000.00
WHERE NOT EXISTS (SELECT 1 FROM unit_types WHERE type_name = 'Compact Studio Unit');

INSERT INTO unit_types (id, created_at, updated_at, type_name, dimensions, area_sqm, base_price_per_month, deposit_amount)
SELECT gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'Standard 1-Bedroom Storage', '2.0m x 3.0m x 2.8m', 6.0, 2400000.00, 2400000.00
WHERE NOT EXISTS (SELECT 1 FROM unit_types WHERE type_name = 'Standard 1-Bedroom Storage');

INSERT INTO unit_types (id, created_at, updated_at, type_name, dimensions, area_sqm, base_price_per_month, deposit_amount)
SELECT gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'Commercial & E-Commerce Suite', '3.0m x 4.0m x 3.0m', 12.0, 4800000.00, 4800000.00
WHERE NOT EXISTS (SELECT 1 FROM unit_types WHERE type_name = 'Commercial & E-Commerce Suite');

-- Seed initial price history entry for each unit type
INSERT INTO storage_unit_price_histories (id, created_at, updated_at, unit_type_id, old_price, new_price, effective_from, effective_to, reason)
SELECT gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ut.id, ut.base_price_per_month, ut.base_price_per_month, CURRENT_TIMESTAMP, NULL, 'Thiết lập biểu giá cơ sở ban đầu (BR-RULE-011)'
FROM unit_types ut
WHERE NOT EXISTS (SELECT 1 FROM storage_unit_price_histories WHERE unit_type_id = ut.id);

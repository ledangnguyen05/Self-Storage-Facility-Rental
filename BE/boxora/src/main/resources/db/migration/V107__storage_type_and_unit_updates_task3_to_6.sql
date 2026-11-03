-- =========================================================================
-- V107: Storage Type Management, Dynamic Pricing, Discounts & Facility Floor Plan (Tasks 3 - 6)
-- =========================================================================

-- 1. Unit Types: Add is_active and detail measurement columns
ALTER TABLE unit_types
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS volume_m3 NUMERIC(6, 2),
    ADD COLUMN IF NOT EXISTS length_m NUMERIC(5, 2),
    ADD COLUMN IF NOT EXISTS width_m NUMERIC(5, 2),
    ADD COLUMN IF NOT EXISTS height_m NUMERIC(5, 2),
    ADD COLUMN IF NOT EXISTS capacity_boxes INT;

-- Seed default measurement values for existing canonical unit types
UPDATE unit_types
SET volume_m3 = 1.0, length_m = 1.0, width_m = 1.0, height_m = 1.2, capacity_boxes = 6, is_active = TRUE
WHERE id = '10000000-0000-0000-0000-000000000001';

UPDATE unit_types
SET volume_m3 = 8.0, length_m = 2.0, width_m = 1.5, height_m = 2.6, capacity_boxes = 48, is_active = TRUE
WHERE id = '10000000-0000-0000-0000-000000000002';

UPDATE unit_types
SET volume_m3 = 14.0, length_m = 2.5, width_m = 2.0, height_m = 2.8, capacity_boxes = 85, is_active = TRUE
WHERE id = '10000000-0000-0000-0000-000000000005';

UPDATE unit_types
SET volume_m3 = 16.0, length_m = 3.0, width_m = 2.0, height_m = 2.8, capacity_boxes = 100, is_active = TRUE
WHERE id = '10000000-0000-0000-0000-000000000003';

UPDATE unit_types
SET volume_m3 = 24.0, length_m = 4.0, width_m = 3.0, height_m = 3.0, capacity_boxes = 160, is_active = TRUE
WHERE id = '10000000-0000-0000-0000-000000000004';

-- Fallback for any other unit types
UPDATE unit_types
SET volume_m3 = COALESCE(volume_m3, ROUND(area_sqm * 2.8, 1)),
    length_m = COALESCE(length_m, 2.0),
    width_m = COALESCE(width_m, ROUND(area_sqm / 2.0, 1)),
    height_m = COALESCE(height_m, 2.8),
    capacity_boxes = COALESCE(capacity_boxes, ROUND(area_sqm * 16)::INT),
    is_active = TRUE
WHERE volume_m3 IS NULL;

-- 2. Storage Units: Add zone_code and zone_name
ALTER TABLE storage_units
    ADD COLUMN IF NOT EXISTS zone_code VARCHAR(50),
    ADD COLUMN IF NOT EXISTS zone_name VARCHAR(100);

-- 3. Facility Policies: Add duration discount percentage columns
ALTER TABLE facility_policies
    ADD COLUMN IF NOT EXISTS discount_3_month_percent NUMERIC(5, 2) DEFAULT 5.0,
    ADD COLUMN IF NOT EXISTS discount_6_month_percent NUMERIC(5, 2) DEFAULT 10.0,
    ADD COLUMN IF NOT EXISTS discount_12_month_percent NUMERIC(5, 2) DEFAULT 15.0;

UPDATE facility_policies
SET discount_3_month_percent = 5.0
WHERE discount_3_month_percent IS NULL;

UPDATE facility_policies
SET discount_6_month_percent = 10.0
WHERE discount_6_month_percent IS NULL;

UPDATE facility_policies
SET discount_12_month_percent = 15.0
WHERE discount_12_month_percent IS NULL;

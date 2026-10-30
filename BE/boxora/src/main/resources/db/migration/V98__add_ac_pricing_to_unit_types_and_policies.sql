-- =========================================================================
-- V98: Add AC (Climate Control) Pricing Support for Unit Types and Facility Policies
-- =========================================================================

-- 1. Add ac_price_per_month to unit_types
ALTER TABLE unit_types
    ADD COLUMN IF NOT EXISTS ac_price_per_month NUMERIC(12, 2);

-- 2. Add ac_monthly_price to facility_policy_prices
ALTER TABLE facility_policy_prices
    ADD COLUMN IF NOT EXISTS ac_monthly_price NUMERIC(12, 2);

-- 3. Initialize AC prices and align standard base prices for the 5 canonical types
-- Mini (1 m3 / 1.0 m2): Tiêu chuẩn 350.000, Máy lạnh A/C 420.000
UPDATE unit_types
SET base_price_per_month = 350000.00,
    ac_price_per_month = 420000.00
WHERE id = '10000000-0000-0000-0000-000000000001';

-- Medium (8 m3 / 3.0 m2): Tiêu chuẩn 1.850.000, Máy lạnh A/C 2.220.000
UPDATE unit_types
SET base_price_per_month = 1850000.00,
    ac_price_per_month = 2220000.00
WHERE id = '10000000-0000-0000-0000-000000000002';

-- Cold Storage (14 m3 / 5.0 m2): Tiêu chuẩn 3.100.000, Máy lạnh A/C 3.720.000
UPDATE unit_types
SET base_price_per_month = 3100000.00,
    ac_price_per_month = 3720000.00
WHERE id = '10000000-0000-0000-0000-000000000005';

-- Standard (16 m3 / 6.0 m2): Tiêu chuẩn 3.500.000, Máy lạnh A/C 4.200.000
UPDATE unit_types
SET base_price_per_month = 3500000.00,
    ac_price_per_month = 4200000.00
WHERE id = '10000000-0000-0000-0000-000000000003';

-- Extra Large (24 m3 / 12.0 m2): Tiêu chuẩn 5.000.000, Máy lạnh A/C 6.000.000
UPDATE unit_types
SET base_price_per_month = 5000000.00,
    ac_price_per_month = 6000000.00
WHERE id = '10000000-0000-0000-0000-000000000004';


-- =========================================================================
-- V13: Seed Unit Types
-- =========================================================================

INSERT INTO unit_types (id, created_at, updated_at, type_name, dimensions, area_sqm, base_price_per_month, deposit_amount)
VALUES
    ('10000000-0000-0000-0000-000000000001', NOW(), NOW(), 'Small (Personal Locker)', '1.0m x 1.0m x 1.2m', 1.0, 450000.00, 450000.00),
    ('10000000-0000-0000-0000-000000000002', NOW(), NOW(), 'Medium (Compact Studio)', '1.5m x 2.0m x 2.6m', 3.0, 1250000.00, 1250000.00),
    ('10000000-0000-0000-0000-000000000003', NOW(), NOW(), 'Large (Standard 1-Bedroom)', '2.0m x 3.0m x 2.8m', 6.0, 2400000.00, 2400000.00),
    ('10000000-0000-0000-0000-000000000004', NOW(), NOW(), 'Extra Large (Commercial Suite)', '3.0m x 4.0m x 3.0m', 12.0, 4800000.00, 4800000.00)
ON CONFLICT (id) DO UPDATE 
SET type_name = EXCLUDED.type_name, base_price_per_month = EXCLUDED.base_price_per_month, deposit_amount = EXCLUDED.deposit_amount;

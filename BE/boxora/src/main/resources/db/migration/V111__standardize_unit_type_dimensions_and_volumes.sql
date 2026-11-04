-- =========================================================================
-- V111: Standardize Storage Unit Type Dimensions, Area (m2), and Volume (m3)
-- Formula: area_sqm = length_m * width_m; volume_m3 = length_m * width_m * height_m
-- =========================================================================

-- 1. Mini (1.0m x 1.0m x 1.2m -> 1.0 m2, 1.2 m3)
UPDATE unit_types
SET dimensions = '1.0m x 1.0m x 1.2m',
    length_m = 1.0,
    width_m = 1.0,
    height_m = 1.2,
    area_sqm = 1.0,
    volume_m3 = 1.2,
    capacity_boxes = 6
WHERE id = '10000000-0000-0000-0000-000000000001';

-- 2. Compact Studio Unit (1.5m x 2.0m x 2.6m -> 3.0 m2, 7.8 m3)
UPDATE unit_types
SET dimensions = '1.5m x 2.0m x 2.6m',
    length_m = 2.0,
    width_m = 1.5,
    height_m = 2.6,
    area_sqm = 3.0,
    volume_m3 = 7.8,
    capacity_boxes = 48
WHERE id = 'dd168b92-ebdd-4e84-a6e1-7715b4745a26';

-- 3. Vừa (phòng studio nhỏ) (1.5m x 2.0m x 2.6m -> 3.0 m2, 7.8 m3)
UPDATE unit_types
SET dimensions = '1.5m x 2.0m x 2.6m',
    length_m = 2.0,
    width_m = 1.5,
    height_m = 2.6,
    area_sqm = 3.0,
    volume_m3 = 7.8,
    capacity_boxes = 48
WHERE id = '10000000-0000-0000-0000-000000000002';

-- 4. Kho lạnh (kiểm soát nhiệt độ 18-22°C) (2.0m x 2.5m x 2.8m -> 5.0 m2, 14.0 m3)
UPDATE unit_types
SET dimensions = '2.0m x 2.5m x 2.8m',
    length_m = 2.5,
    width_m = 2.0,
    height_m = 2.8,
    area_sqm = 5.0,
    volume_m3 = 14.0,
    capacity_boxes = 85
WHERE id = '10000000-0000-0000-0000-000000000005';

-- 5. Tiêu chuẩn (căn một phòng ngủ) (2.0m x 3.0m x 2.8m -> 6.0 m2, 16.8 m3)
UPDATE unit_types
SET dimensions = '2.0m x 3.0m x 2.8m',
    length_m = 3.0,
    width_m = 2.0,
    height_m = 2.8,
    area_sqm = 6.0,
    volume_m3 = 16.8,
    capacity_boxes = 100
WHERE id = '10000000-0000-0000-0000-000000000003';

-- 6. Rất lớn (văn phòng thương mại) (5.0m x 4.0m x 3.5m -> 20.0 m2, 70.0 m3)
UPDATE unit_types
SET dimensions = '5.0m x 4.0m x 3.5m',
    length_m = 5.0,
    width_m = 4.0,
    height_m = 3.5,
    area_sqm = 20.0,
    volume_m3 = 70.0,
    capacity_boxes = 160
WHERE id = '10000000-0000-0000-0000-000000000004';

-- Auto-recalculate for any other unit types with physical length, width, and height
UPDATE unit_types
SET area_sqm = ROUND((length_m * width_m)::NUMERIC, 2),
    volume_m3 = ROUND((length_m * width_m * height_m)::NUMERIC, 2)
WHERE length_m IS NOT NULL AND width_m IS NOT NULL AND height_m IS NOT NULL;

